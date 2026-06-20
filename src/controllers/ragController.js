const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const path = require('path');
const fs = require('fs');
const { OpenAI } = require('openai');
const pdfParse = require('pdf-parse'); // v1.1.1 - exports a function directly


const vectorDb = require('../utils/vectorDb');

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Simple text chunker
function chunkText(text, maxChars = 1000) {
  const chunks = [];
  let currentChunk = '';
  const sentences = text.split(/(?<=[.?!])\s+/);
  
  for (const sentence of sentences) {
    if ((currentChunk + sentence).length > maxChars) {
      if (currentChunk.trim()) chunks.push(currentChunk.trim());
      currentChunk = sentence + ' ';
    } else {
      currentChunk += sentence + ' ';
    }
  }
  if (currentChunk.trim()) chunks.push(currentChunk.trim());
  return chunks;
}

// Fetch all uploaded knowledge documents
exports.getDocuments = async (req, res) => {
  try {
    let hotelId = req.user?.hotelId;
    if (!hotelId) {
      const hotel = await prisma.hotel.findFirst();
      if (!hotel) return res.status(404).json({ message: 'No hotel found' });
      hotelId = hotel.id;
    }
    hotelId = parseInt(hotelId, 10);

    const docs = await prisma.knowledgeDocument.findMany({
      where: { hotelId }
    });
    res.json(docs);
  } catch (error) {
    console.error('Get Documents Error:', error);
    res.status(500).json({ message: 'Failed to fetch knowledge documents' });
  }
};

// Handle document upload and trigger vectorization
exports.uploadDocument = async (req, res) => {
  try {
    let hotelId = req.user?.hotelId;
    if (!hotelId) {
      const hotel = await prisma.hotel.findFirst();
      if (!hotel) return res.status(404).json({ message: 'No hotel found' });
      hotelId = hotel.id;
    }
    hotelId = parseInt(hotelId, 10);

    const { filename, docType } = req.body; 
    
    // In a production app, use multer to handle req.file
    let textToEmbed = 'This is a placeholder policy document. Gold members get late checkout until 2 PM. Regular checkout is 11 AM.';
    
    if (req.file && req.file.buffer) {
      try {
        const dataBuffer = req.file.buffer;
        let pdfData;
        try {
          // Try default parser first
          pdfData = await pdfParse(dataBuffer);
        } catch (parseErr) {
          // If XRef/FormatError, retry with v2.0.550 which re-indexes all objects
          const isXRefError = parseErr.message?.includes('XRef') || parseErr.message?.includes('FormatError');
          if (isXRefError) {
            console.warn(`[RAG Engine] Default parser failed (${parseErr.message}). Retrying with v2.0.550 fallback...`);
            pdfData = await pdfParse(dataBuffer, { version: 'v2.0.550' });
          } else {
            throw parseErr;
          }
        }

        if (!pdfData.text || pdfData.text.trim().length < 20) {
          return res.status(400).json({
            message: 'This PDF appears to be a scanned image (no text layer found). Please upload a text-based PDF or copy-paste the content as a text file.'
          });
        }
        textToEmbed = pdfData.text;
        console.log(`[RAG Engine] Extracted ${textToEmbed.length} characters from memory buffer of "${req.file.originalname}"`);
      } catch (pdfError) {
        console.error('[RAG Engine] PDF parse failed:', pdfError.message);
        return res.status(400).json({
          message: `Failed to parse PDF: ${pdfError.message}. Please try re-exporting the PDF from your document editor.`
        });
      }
    }

    // 1. Create DB record for the file in Prisma (MySQL)
    const newDoc = await prisma.knowledgeDocument.create({
      data: {
        hotelId,
        filename: filename || (req.file ? req.file.originalname : 'Unknown_Document.pdf'),
        fileUrl: req.file ? `/uploads/in_memory` : `/uploads/${Date.now()}_doc.pdf`,
        rawText: textToEmbed,
        docType: docType || 'SOP',
        isVectorized: false
      }
    });

    // 2. Perform Vectorization
    (async () => {
      try {
        console.log(`[RAG Engine] Processing ${newDoc.filename}... chunking text...`);
        const chunks = chunkText(textToEmbed);
        
        console.log(`[RAG Engine] Generating ${chunks.length} embeddings...`);
        const embeddingsResponse = await openai.embeddings.create({
          model: "text-embedding-3-small",
          input: chunks,
          dimensions: 1024
        });

        console.log(`[RAG Engine] Saving vectors to Neon Vector DB...`);
        const records = chunks.map((chunk, i) => ({
          id: `doc_${newDoc.id}_chunk_${i}`,
          documentId: newDoc.id,
          hotelId: hotelId,
          content: chunk,
          embedding: embeddingsResponse.data[i].embedding
        }));

        if (!records || records.length === 0) {
          throw new Error('No records generated to upsert.');
        }
        await vectorDb.upsertEmbeddings(records);

        await prisma.knowledgeDocument.update({
          where: { id: newDoc.id },
          data: {
            isVectorized: true,
            vectorCount: chunks.length
          }
        });
        console.log(`[RAG Engine] ${newDoc.filename} vectorized successfully.`);
      } catch (err) {
        console.error(`[RAG Engine] Error vectorizing document ${newDoc.id}:`, err);
      }
    })();

    res.status(201).json({ 
      message: 'Document uploaded and is being processed by the RAG engine', 
      document: newDoc 
    });
  } catch (error) {
    console.error('Upload Document Error:', error);
    res.status(500).json({ message: 'Failed to upload document' });
  }
};

// Query the RAG knowledge base via Pinecone
exports.queryKnowledge = async (req, res) => {
  try {
    const { query } = req.body;
    
    if (!query) {
      return res.status(400).json({ message: 'Query is required' });
    }

    // 1. Embed the query string
    const queryEmbeddingResponse = await openai.embeddings.create({
      model: "text-embedding-3-small",
      input: query,
      dimensions: 1024
    });
    
    const queryVector = queryEmbeddingResponse.data[0].embedding;

    // 2. Perform similarity search in Neon Vector DB
    let hotelId = req.user?.hotelId;
    if (!hotelId) {
      const hotel = await prisma.hotel.findFirst();
      if (hotel) hotelId = hotel.id;
    }
    hotelId = hotelId ? parseInt(hotelId, 10) : 13;

    const matches = await vectorDb.querySimilarEmbeddings(queryVector, hotelId, 3);

    const results = matches.map(match => ({
      source: `Document ID: ${match.metadata?.documentId || 'Unknown'}`,
      content: match.metadata?.content || '',
      confidence: match.score?.toFixed(2) || 0
    }));

    res.json({
      query,
      results: results.length > 0 ? results : [{
        source: 'System',
        content: 'No relevant information found in the knowledge base.',
        confidence: 0
      }]
    });
  } catch (error) {
    console.error('RAG Query Error:', error);
    res.status(500).json({ message: 'Failed to query knowledge base' });
  }
};

// Delete a document
exports.deleteDocument = async (req, res) => {
  try {
    const { id } = req.params;
    const docId = parseInt(id, 10);

    // Fetch document first to check if there is a physical file on disk to remove
    const doc = await prisma.knowledgeDocument.findUnique({
      where: { id: docId }
    });

    if (doc && doc.fileUrl && !doc.fileUrl.includes('in_memory')) {
      const filename = doc.fileUrl.replace('/uploads/', '');
      const fullPath = path.join(__dirname, '../../uploads', filename);
      if (fs.existsSync(fullPath)) {
        try {
          fs.unlinkSync(fullPath);
          console.log(`[RAG Engine] Deleted physical file: ${fullPath}`);
        } catch (unlinkErr) {
          console.warn(`[RAG Engine] Failed to delete local file ${fullPath}:`, unlinkErr.message);
        }
      }
    }
    
    await vectorDb.deleteDocumentEmbeddings(docId);
    
    await prisma.knowledgeDocument.deleteMany({
      where: { id: docId }
    });

    res.json({ message: 'Document deleted successfully' });
  } catch (error) {
    console.error('Delete Document Error:', error);
    res.status(500).json({ message: 'Failed to delete document' });
  }
};

// Re-index / Sync an existing document back into the vector DB
exports.reindexDocument = async (req, res) => {
  try {
    const { id } = req.params;
    const doc = await prisma.knowledgeDocument.findUnique({ where: { id: parseInt(id) } });
    if (!doc) return res.status(404).json({ message: 'Document not found' });

    // Tell the frontend immediately so it doesn't time out
    res.json({ message: `Re-indexing "${doc.filename}" into AI response rules...` });

    // Run vectorization in background
    (async () => {
      try {
        let textToEmbed = doc.rawText;
        
        // Fallback to placeholder if file not in DB
        if (!textToEmbed) {
          textToEmbed = `Hotel document: ${doc.filename}. This document contains hotel policies and operational procedures.`;
          console.warn(`[RAG Re-index] No rawText stored in DB for doc ${id}, using minimal placeholder`);
        }

        // Delete old embeddings for this document
        await vectorDb.deleteDocumentEmbeddings(doc.id);

        // Re-chunk and re-embed
        const chunks = chunkText(textToEmbed);
        const embeddingsResponse = await openai.embeddings.create({
          model: "text-embedding-3-small",
          input: chunks,
          dimensions: 1024
        });

        const records = chunks.map((chunk, i) => ({
          id: `doc_${doc.id}_chunk_${i}`,
          documentId: doc.id,
          hotelId: doc.hotelId,
          content: chunk,
          embedding: embeddingsResponse.data[i].embedding
        }));

        await vectorDb.upsertEmbeddings(records);

        await prisma.knowledgeDocument.update({
          where: { id: doc.id },
          data: { isVectorized: true, vectorCount: chunks.length }
        });

        console.log(`[RAG Re-index] "${doc.filename}" re-indexed with ${chunks.length} chunks.`);
      } catch (err) {
        console.error(`[RAG Re-index] Error re-indexing doc ${id}:`, err.message);
      }
    })();

  } catch (error) {
    console.error('Reindex Document Error:', error);
    res.status(500).json({ message: 'Failed to re-index document' });
  }
};
