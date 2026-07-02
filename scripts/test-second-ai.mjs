import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '../.env') });

const apiKey = process.env.NINEROUTER_9R_API_KEY;
const baseUrl = process.env.NINEROUTER_9R_BASE_URL || 'https://aishop24h.com/v1';
const modelName = process.env.NINEROUTER_9R_MODEL || 'z-ai/glm-5.2';

if (!apiKey) {
  console.error('❌ NINEROUTER_9R_API_KEY is missing from .env!');
  process.exit(1);
}

async function testAI() {
  console.log('Testing the second AI key (GLM-5.2)...');
  console.log(`Base URL: ${baseUrl}`);
  console.log(`Model: ${modelName}`);
  console.log('Sending test request...');

  try {
    const res = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: modelName,
        stream: false,
        messages: [
          { role: 'user', content: 'Say "NineRouter GLM Key is working perfectly!" and nothing else.' }
        ]
      })
    });

    if (!res.ok) {
      const errorText = await res.text();
      throw new Error(`HTTP Error ${res.status}: ${res.statusText} - Details: ${errorText}`);
    }

    const data = await res.json();
    const textResponse = data.choices?.[0]?.message?.content?.trim();
    
    console.log('\n✅ Test Success!');
    console.log(`AI Response: "${textResponse}"`);
  } catch (err) {
    console.error('\n❌ Test Failed!');
    console.error('Error details:', err.message);
  }
}

testAI();
