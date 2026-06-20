require('dotenv').config();
const { Client } = require('pg');

async function setupNeon() {
  const client = new Client({
    connectionString: process.env.NEON_VECTOR_URL,
  });

  try {
    await client.connect();
    console.log('Connected to Neon database.');

    // Enable pgvector
    await client.query('CREATE EXTENSION IF NOT EXISTS vector;');
    console.log('Enabled pgvector extension.');

    // Create the document_chunks table
    const createTableQuery = `
      CREATE TABLE IF NOT EXISTS document_chunks (
        id SERIAL PRIMARY KEY,
        document_id INT NOT NULL,
        chunk_index INT NOT NULL,
        content TEXT NOT NULL,
        embedding vector(1536),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `;
    await client.query(createTableQuery);
    console.log('Created document_chunks table.');

    // Create an index for faster similarity search
    // Note: HNSW is recommended for pgvector but requires specifying an operator class
    // For simplicity, we'll let it use exact search or standard index
    // HNSW index syntax: CREATE INDEX ON document_chunks USING hnsw (embedding vector_cosine_ops);
    const createIndexQuery = `
      CREATE INDEX IF NOT EXISTS document_chunks_embedding_idx 
      ON document_chunks 
      USING hnsw (embedding vector_cosine_ops);
    `;
    await client.query(createIndexQuery);
    console.log('Created HNSW index for vector similarity search.');

  } catch (error) {
    console.error('Error setting up Neon DB:', error);
  } finally {
    await client.end();
    console.log('Database connection closed.');
  }
}

setupNeon();
