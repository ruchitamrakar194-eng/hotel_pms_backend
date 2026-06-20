const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.NEON_VECTOR_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

let isInitialized = false;

async function initDb() {
  if (isInitialized) return;
  const client = await pool.connect();
  try {
    console.log('[Vector DB] Ensuring pgvector extension and embeddings table exist...');
    await client.query('CREATE EXTENSION IF NOT EXISTS vector;');
    await client.query(`
      CREATE TABLE IF NOT EXISTS embeddings (
        id VARCHAR(255) PRIMARY KEY,
        document_id INT NOT NULL,
        hotel_id INT NOT NULL,
        content TEXT NOT NULL,
        embedding vector(1024) NOT NULL
      );
    `);
    
    // Add index for faster similarity searches if needed, but not strictly required for small datasets
    await client.query(`
      CREATE INDEX IF NOT EXISTS embeddings_hotel_idx ON embeddings (hotel_id);
    `);
    
    isInitialized = true;
    console.log('[Vector DB] Initialized successfully.');
  } catch (error) {
    console.error('[Vector DB] Initialization failed:', error);
    throw error;
  } finally {
    client.release();
  }
}

// Convert JS array [0.1, 0.2, ...] to PG vector string format '[0.1,0.2,...]'
function formatVector(arr) {
  return `[${arr.join(',')}]`;
}

async function upsertEmbeddings(records) {
  await initDb();
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    for (const record of records) {
      const { id, documentId, hotelId, content, embedding } = record;
      const vectorStr = formatVector(embedding);
      
      await client.query(
        `INSERT INTO embeddings (id, document_id, hotel_id, content, embedding)
         VALUES ($1, $2, $3, $4, $5::vector)
         ON CONFLICT (id) 
         DO UPDATE SET 
           document_id = EXCLUDED.document_id,
           hotel_id = EXCLUDED.hotel_id,
           content = EXCLUDED.content,
           embedding = EXCLUDED.embedding`,
        [id, documentId, hotelId, content, vectorStr]
      );
    }
    await client.query('COMMIT');
    console.log(`[Vector DB] Upserted ${records.length} embeddings successfully.`);
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('[Vector DB] Upsert failed:', error);
    throw error;
  } finally {
    client.release();
  }
}

async function querySimilarEmbeddings(embedding, hotelId, topK = 3) {
  await initDb();
  const client = await pool.connect();
  try {
    const vectorStr = formatVector(embedding);
    // cosine distance operator is <=>
    // similarity = 1 - distance
    const query = `
      SELECT 
        document_id, 
        content, 
        (1 - (embedding <=> $1::vector)) as similarity
      FROM embeddings
      WHERE hotel_id = $2
      ORDER BY embedding <=> $1::vector ASC
      LIMIT $3
    `;
    const res = await client.query(query, [vectorStr, hotelId, topK]);
    return res.rows.map(row => ({
      metadata: {
        documentId: row.document_id,
        content: row.content
      },
      score: parseFloat(row.similarity)
    }));
  } catch (error) {
    console.error('[Vector DB] Query failed:', error);
    throw error;
  } finally {
    client.release();
  }
}

async function deleteDocumentEmbeddings(documentId) {
  await initDb();
  const client = await pool.connect();
  try {
    await client.query('DELETE FROM embeddings WHERE document_id = $1', [documentId]);
    console.log(`[Vector DB] Deleted embeddings for document ID ${documentId}.`);
  } catch (error) {
    console.error('[Vector DB] Delete failed:', error);
    throw error;
  } finally {
    client.release();
  }
}

module.exports = {
  pool,
  initDb,
  upsertEmbeddings,
  querySimilarEmbeddings,
  deleteDocumentEmbeddings
};
