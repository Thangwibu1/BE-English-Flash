import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '../.env') });

const mongoUri = process.env.MONGODB_URI;

if (!mongoUri) {
  console.error('❌ MONGODB_URI is missing from .env!');
  process.exit(1);
}

async function run() {
  console.log('Connecting to MongoDB...');
  await mongoose.connect(mongoUri);
  console.log('Connected!');

  const db = mongoose.connection.db;
  const decksCollection = db.collection('flashcarddecks');
  const cardsCollection = db.collection('flashcardcards');

  console.log('Clearing ALL documents in flashcardcards...');
  const deletedCards = await cardsCollection.deleteMany({});
  console.log(`🧹 Deleted ${deletedCards.deletedCount} cards.`);

  console.log('Clearing ALL documents in flashcarddecks...');
  const deletedDecks = await decksCollection.deleteMany({});
  console.log(`🧹 Deleted ${deletedDecks.deletedCount} decks.`);

  await mongoose.disconnect();
  console.log('Disconnected from MongoDB. Database is now completely empty for flashcards!');
}

run().catch(console.error);
