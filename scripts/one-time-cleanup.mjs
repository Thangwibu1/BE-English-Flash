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
  const usersCollection = db.collection('users');

  // 1. Get Admin User to identify system public decks
  const adminUser = await usersCollection.findOne({ role: 'admin', deletedAt: null });
  const systemOwnerId = adminUser ? adminUser._id : (await usersCollection.findOne({ deletedAt: null }))?._id;
  
  if (!systemOwnerId) {
    console.error('❌ No admin/system user found in database!');
    await mongoose.disconnect();
    return;
  }
  console.log(`System user ID identified: ${systemOwnerId}`);

  // 2. Find all system public decks
  const systemDecks = await decksCollection.find({ ownerId: systemOwnerId, visibility: 'public' }).toArray();
  const systemDeckIds = systemDecks.map(d => d._id);

  console.log(`Found ${systemDecks.length} system public decks to delete.`);

  if (systemDeckIds.length > 0) {
    // Delete cards belonging to these decks
    const deletedCards = await cardsCollection.deleteMany({ deckId: { $in: systemDeckIds } });
    console.log(`🧹 Deleted ${deletedCards.deletedCount} cards.`);

    // Delete the decks themselves
    const deletedDecks = await decksCollection.deleteMany({ _id: { $in: systemDeckIds } });
    console.log(`🧹 Deleted ${deletedDecks.deletedCount} decks.`);
  } else {
    console.log('No system public decks found to delete.');
  }

  await mongoose.disconnect();
  console.log('Disconnected from MongoDB. One-time cleanup finished!');
}

run().catch(console.error);
