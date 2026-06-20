require('dotenv').config();
const { OpenAI } = require('openai');
const { Pinecone } = require('@pinecone-database/pinecone');

async function testIntegration() {
  console.log('--- Starting Integration Test ---');
  
  try {
    // 1. Test OpenAI
    console.log('1. Testing OpenAI connection...');
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const embeddingRes = await openai.embeddings.create({
      model: "text-embedding-3-small",
      input: "What is the checkout time?",
      dimensions: 1024
    });
    
    if (embeddingRes.data && embeddingRes.data.length > 0) {
      console.log('✅ OpenAI is working! Successfully generated embedding.');
    } else {
      console.log('❌ OpenAI failed to generate embedding.');
      return;
    }

    const testVector = embeddingRes.data[0].embedding;

    // 2. Test Pinecone
    console.log('\n2. Testing Pinecone connection...');
    const pc = new Pinecone({ apiKey: process.env.PINECONE_API_KEY });
    const index = pc.index('hotel-pms');

    // Attempt a dummy query
    const queryResponse = await index.query({
      topK: 1,
      vector: testVector,
      includeMetadata: true
    });

    console.log('✅ Pinecone is working! Query returned ' + queryResponse.matches.length + ' matches.');
    
    console.log('\n--- Integration Test Successful ---');

  } catch (err) {
    console.error('\n❌ Test Failed with Error:', err.message);
  }
}

testIntegration();
