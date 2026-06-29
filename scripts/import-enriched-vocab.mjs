/**
 * Import Enriched Vocabulary Script
 * Reads enriched_vocabularies.jsonl and updates existing vocabulary documents in MongoDB.
 * Usage: node scripts/import-enriched-vocab.mjs
 */

import fs from 'fs';
import readline from 'readline';
import mongoose from 'mongoose';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// --- Config ---
const MONGODB_URI = 'mongodb://root:lameojicomatkhau@coolify.be-learning.io.vn:2808/English?authSource=admin&directConnection=true';
const JSONL_PATH = path.resolve(__dirname, '../enriched_vocabularies.jsonl');
const BATCH_SIZE = 100;

// --- Schema ---
const exampleSchema = new mongoose.Schema({
  exampleEn: { type: String, required: true },
  exampleVi: { type: String },
  source: { type: String },
});

const meaningSchema = new mongoose.Schema({
  meaningVi: { type: String, required: true },
  meaningEn: { type: String },
  note: { type: String },
  examples: [exampleSchema],
});

const formSchema = new mongoose.Schema({
  formText: { type: String, required: true },
  normalizedFormText: { type: String, required: true },
  formType: { type: String },
  note: { type: String },
});

const componentSchema = new mongoose.Schema({
  componentText: { type: String, required: true },
  componentVocabularyId: { type: mongoose.Schema.Types.ObjectId },
  role: { type: String },
  orderIndex: { type: Number, required: true },
});

const VocabularySchema = new mongoose.Schema(
  {
    text: { type: String, required: true },
    normalizedText: { type: String, required: true, index: true },
    type: {
      type: String,
      enum: ['single_word', 'compound_word', 'collocation', 'phrasal_verb', 'idiom', 'fixed_phrase', 'sentence_pattern'],
      required: true,
    },
    level: { type: String, enum: ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'] },
    partOfSpeech: { type: String },
    phonetic: { type: String },
    audioUrl: { type: String },
    meanings: [meaningSchema],
    forms: [formSchema],
    components: [componentSchema],
    topicIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Topic' }],
    status: {
      type: String,
      enum: ['draft', 'approved', 'rejected', 'archived'],
      default: 'draft',
    },
    autoHighlight: { type: Boolean, default: true },
    needsReview: { type: Boolean, default: false },
    qualityScore: { type: Number },
    qualityNotes: [{ type: String }],
    enrichedAt: { type: Date },
    enrichedBy: { type: String },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

const VocabularyModel = mongoose.model('Vocabulary', VocabularySchema);

// --- Main ---
async function main() {
  console.log('Connecting to MongoDB...');
  await mongoose.connect(MONGODB_URI);
  console.log('Connected.');
  console.log(`Reading from: ${JSONL_PATH}\n`);

  if (!fs.existsSync(JSONL_PATH)) {
    console.error(`Enriched JSONL file not found at: ${JSONL_PATH}`);
    process.exit(1);
  }

  const rl = readline.createInterface({
    input: fs.createReadStream(JSONL_PATH, { encoding: 'utf8' }),
    crlfDelay: Infinity,
  });

  let bulkOps = [];
  let totalProcessed = 0;
  let totalUpdated = 0;
  let totalErrors = 0;

  async function flushBulk() {
    if (bulkOps.length === 0) return;

    try {
      const result = await VocabularyModel.bulkWrite(bulkOps, { ordered: false });
      totalUpdated += result.modifiedCount + result.upsertedCount;
    } catch (err) {
      console.error('Bulk write error:', err.message);
      totalErrors += bulkOps.length;
    }

    bulkOps = [];
  }

  for await (const line of rl) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    try {
      const item = JSON.parse(trimmed);
      totalProcessed++;

      bulkOps.push({
        updateOne: {
          filter: { _id: item.vocabularyId },
          update: {
            $set: {
              text: item.text,
              normalizedText: item.normalizedText,
              type: item.type,
              level: item.level,
              partOfSpeech: item.partOfSpeech,
              meanings: item.meanings,
              forms: item.forms,
              topics: item.topics,
              autoHighlight: item.autoHighlight,
              status: item.status,
              needsReview: item.needsReview,
              qualityScore: item.qualityScore,
              qualityNotes: item.qualityNotes || [],
              enrichedAt: new Date(),
              enrichedBy: 'ai'
            }
          }
        }
      });

      if (bulkOps.length >= BATCH_SIZE) {
        await flushBulk();
        console.log(`  Processed ${totalProcessed} rows... (updated: ${totalUpdated}, errors: ${totalErrors})`);
      }
    } catch (e) {
      console.warn(`Skipping invalid JSON line: ${trimmed.substring(0, 60)}...`);
    }
  }

  await flushBulk();

  console.log('\n=== Import Complete ===');
  console.log(`Total rows processed : ${totalProcessed}`);
  console.log(`Updated documents    : ${totalUpdated}`);
  console.log(`Errors               : ${totalErrors}`);

  await mongoose.disconnect();
  console.log('Disconnected from MongoDB.');
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
