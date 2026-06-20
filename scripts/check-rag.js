const { Pinecone } = require('@pinecone-database/pinecone');
require('dotenv').config({ path: '../Frontend/.env' });

const pc = new Pinecone({ apiKey: process.env.PINECONE_API_KEY || '' });

async function checkPinecone() {
  try {
    const index = pc.index('hotel-pms');
    // We can query with dummy vector to see what comes back
    const dummyVector = new Array(1024).fill(0.1);
    const response = await index.query({ topK: 10, vector: dummyVector, filter: { hotelId: 13 }, includeMetadata: true });
    
    console.log("Pinecone Matches for Hotel 13:", response.matches.length);
    for (const m of response.matches) {
       console.log(" - Content:", m.metadata.content.substring(0, 100));
    }
  } catch (err) {
    console.error("Pinecone Error:", err);
  }
}

checkPinecone();
