import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '../.env') });

const mongoUri = process.env.MONGODB_URI;

async function run() {
  if (!mongoUri) {
    console.error('MONGODB_URI not found!');
    return;
  }
  await mongoose.connect(mongoUri);
  console.log('Connected!');

  const db = mongoose.connection.db;
  const topicsCollection = db.collection('topics');
  const vocabCollection = db.collection('vocabularies');

  const topics = await topicsCollection.find({ deletedAt: null }).toArray();
  console.log(`\nExisting topics in DB (${topics.length}):`);
  topics.forEach(t => console.log(`- ID: ${t._id}, Name: ${t.name}, Slug: ${t.slug}`));

  const vocabCount = await vocabCollection.countDocuments({ status: 'approved', deletedAt: null });
  console.log(`\nTotal approved vocabularies: ${vocabCount}`);

  await mongoose.disconnect();
}

run().catch(console.error);
