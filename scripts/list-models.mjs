import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '../.env') });

const apiKey = process.env.NINEROUTER_9R_API_KEY;
const baseUrl = process.env.NINEROUTER_9R_BASE_URL || 'https://9router.ngocthang.io.vn/v1';

if (!apiKey) {
  console.error('❌ NINEROUTER_9R_API_KEY is missing from .env!');
  process.exit(1);
}

async function listModels() {
  console.log(`Querying available models on: ${baseUrl}/models`);
  try {
    const res = await fetch(`${baseUrl}/models`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiKey}`
      }
    });

    if (!res.ok) {
      throw new Error(`HTTP Error ${res.status}: ${res.statusText}`);
    }

    const data = await res.json();
    console.log('\nSupported Models:');
    if (data && Array.isArray(data.data)) {
      data.data.forEach(m => console.log(`- ${m.id}`));
    } else {
      console.log(JSON.stringify(data, null, 2));
    }
  } catch (err) {
    console.error('❌ Failed to fetch models!');
    console.error('Error details:', err.message);
  }
}

listModels();
