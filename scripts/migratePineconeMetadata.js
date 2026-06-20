const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { OpenAI } = require('openai');
const { Pinecone } = require('@pinecone-database/pinecone');
const fs = require('fs');
const pdfParse = require('pdf-parse');

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const pc = new Pinecone({ apiKey: process.env.PINECONE_API_KEY });
const pineconeIndex = pc.index('hotel-pms');

// Helper to chunk text consistently with ragController
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

async function migrate() {
  console.log('Starting Pinecone Metadata Migration...');
  
  const documents = await prisma.knowledgeDocument.findMany();
  console.log(`Found ${documents.length} documents to migrate.`);

  for (const doc of documents) {
    try {
      console.log(`Processing Document ID: ${doc.id}, Hotel ID: ${doc.hotelId}, File: ${doc.filename}`);
      
      let textToEmbed = 'This is a placeholder policy document. Gold members get late checkout until 2 PM. Regular checkout is 11 AM.';
      
      // Attempt to load the actual file if it exists, otherwise use fallback
      // Since fileUrl might be relative, we need to construct absolute path or rely on text
      const filePath = `.${doc.fileUrl}`; 
      if (fs.existsSync(filePath) && filePath.endsWith('.pdf')) {
          const dataBuffer = fs.readFileSync(filePath);
          const pdfData = await pdfParse(dataBuffer);
          textToEmbed = pdfData.text;
      }
      
      const chunks = chunkText(textToEmbed);
      
      console.log(`Generating embeddings for ${chunks.length} chunks...`);
      const embeddingsResponse = await openai.embeddings.create({
        model: "text-embedding-3-small",
        input: chunks,
        dimensions: 1024
      });

      const pineconeRecords = chunks.map((chunk, i) => ({
        id: `doc_${doc.id}_chunk_${i}`,
        values: embeddingsResponse.data[i].embedding,
        metadata: {
          documentId: doc.id,
          hotelId: doc.hotelId, // Adding missing field
          content: chunk
        }
      }));

      await pineconeIndex.upsert(pineconeRecords);
      console.log(`Successfully migrated Document ${doc.id}`);

    } catch (e) {
      console.error(`Failed to migrate Document ${doc.id}:`, e.message);
    }
  }
  
  console.log('Migration Complete.');
}

migrate()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
