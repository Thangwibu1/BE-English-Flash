/**
 * Backfill script: adds searchTokens to all existing Vocabulary documents.
 * Run once after deploying the searchTokens field to MongoDB.
 *
 * Usage: ts-node src/scripts/backfillSearchTokens.ts
 */
import 'dotenv/config';
import mongoose from 'mongoose';
import { VocabularyModel } from '../infrastructure/database/mongoose/models/VocabularyModel';
import { normalizeText } from '../shared/utils/normalizeText';
import { buildPrefixTokens } from '../shared/utils/buildPrefixTokens';

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/english-learning';

async function run() {
  await mongoose.connect(MONGO_URI);
  console.log('[Backfill] Connected to MongoDB');

  const vocabularies = await VocabularyModel.find({}).lean();
  console.log(`[Backfill] Found ${vocabularies.length} vocabulary documents to process`);

  let updated = 0;
  for (const vocab of vocabularies) {
    const textParts: string[] = [vocab.text];

    if (vocab.forms && vocab.forms.length > 0) {
      for (const f of vocab.forms as any[]) {
        const ft = typeof f === 'string' ? f : f.formText;
        if (ft) textParts.push(ft);
      }
    }

    const searchTokens = buildPrefixTokens(textParts.join(' '));

    await VocabularyModel.updateOne(
      { _id: vocab._id },
      { $set: { searchTokens } }
    );
    updated++;

    if (updated % 100 === 0) {
      console.log(`[Backfill] Updated ${updated}/${vocabularies.length}...`);
    }
  }

  console.log(`[Backfill] Done. Updated ${updated} documents.`);
  await mongoose.disconnect();
}

run().catch((err) => {
  console.error('[Backfill] Error:', err);
  process.exit(1);
});
