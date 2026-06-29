/**
 * Count and Export Draft Meanings
 * Queries MongoDB to find all vocabularies containing "[Draft]" in meaningVi
 * and prints the count.
 * Usage: node scripts/count-draft-meanings.mjs
 */

import mongoose from 'mongoose';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const MONGODB_URI = 'mongodb://root:lameojicomatkhau@coolify.be-learning.io.vn:2808/English?authSource=admin&directConnection=true';
const OUTPUT_PATH = path.resolve(__dirname, '../draft_meanings_words.json');

const VocabularySchema = new mongoose.Schema(
  {
    text: { type: String, required: true },
    meanings: [{
      meaningVi: { type: String },
      meaningEn: { type: String },
      examples: [{
        exampleEn: { type: String },
        exampleVi: { type: String },
      }]
    }],
    deletedAt: { type: Date, default: null },
  },
  { collection: 'vocabularies' }
);

const VocabularyModel = mongoose.model('Vocabulary', VocabularySchema);

async function main() {
  console.log('Connecting to MongoDB...');
  await mongoose.connect(MONGODB_URI);
  console.log('Connected.');

  console.log('Querying vocabularies with "[Draft]" in meaningVi...');
  
  // Find all documents where meaningVi contains "[Draft]"
  const docs = await VocabularyModel.find({
    'meanings.meaningVi': { $regex: '^\\[Draft\\]' },
    deletedAt: null
  }, {
    text: 1,
    meanings: 1
  }).lean();

  console.log(`\n=== Query Complete ===`);
  console.log(`Found ${docs.length} documents with draft meanings.`);

  // Write them to a JSON file
  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(docs, null, 2), 'utf8');
  console.log(`Saved details to: ${OUTPUT_PATH}`);

  await mongoose.disconnect();
  console.log('Disconnected from MongoDB.');
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
