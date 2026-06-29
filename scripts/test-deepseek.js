const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const DEEPSEEK_API_KEY = process.env.NINEROUTER_API_KEY;
const DEEPSEEK_BASE_URL = process.env.NINEROUTER_BASE_URL || 'https://api.deepseek.com/v1';
const DEEPSEEK_API_URL = DEEPSEEK_BASE_URL.replace(/\/$/, '') + '/chat/completions';
const DEEPSEEK_MODEL = process.env.NINEROUTER_MODEL || 'deepseek-chat';

console.log('--- Test DeepSeek Config ---');
console.log('API Key:', DEEPSEEK_API_KEY ? 'Present (starts with ' + DEEPSEEK_API_KEY.substring(0, 8) + ')' : 'Missing');
console.log('Base URL:', DEEPSEEK_BASE_URL);
console.log('API URL:', DEEPSEEK_API_URL);
console.log('Model:', DEEPSEEK_MODEL);

async function test() {
  console.log('\nSending test request to API...');
  try {
    const response = await fetch(DEEPSEEK_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${DEEPSEEK_API_KEY}`
      },
      body: JSON.stringify({
        model: DEEPSEEK_MODEL,
        messages: [
          { role: 'user', content: 'Hello, respond with one word.' }
        ],
        temperature: 0.1
      }),
      signal: AbortSignal.timeout(10000)
    });

    console.log('Response status:', response.status);
    const text = await response.text();
    console.log('Response text:', text);
  } catch (err) {
    console.error('Test failed with error:', err.message);
  }
}

test();
