/**
 * Vocab Seed Import Script — Additional 6000
 * Imports additional 6000 vocabulary rows from auraenglish_vocab_seed_6000_additional_import.jsonl
 * into MongoDB, skipping any words that already exist (upsert by normalizedText).
 * Usage: node scripts/import-vocab-seed-additional.mjs
 */

import fs from 'fs';
import readline from 'readline';
import mongoose from 'mongoose';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// --- Config ---
const MONGODB_URI = 'mongodb://root:lameojicomatkhau@coolify.be-learning.io.vn:2808/English?authSource=admin&directConnection=true';
const JSONL_PATH = path.resolve(__dirname, '../../addition/auraenglish_vocab_seed_6000_additional_import.jsonl');
const BATCH_SIZE = 200;

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
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

const VocabularyModel = mongoose.model('Vocabulary', VocabularySchema);

// --- Helpers ---
function mapRowToDocument(row) {
  const forms = Array.isArray(row.forms)
    ? row.forms.map((f) => ({
        formText: f,
        normalizedFormText: f.trim().toLowerCase(),
      }))
    : [{ formText: row.text, normalizedFormText: row.normalizedText }];

  const meaningVi = row.meaningVi && !row.meaningVi.startsWith('TODO') ? row.meaningVi : `[Draft] ${row.text}`;
  const meaningEn = row.meaningEn && !row.meaningEn.startsWith('TODO') ? row.meaningEn : undefined;
  const exampleEn = row.exampleEn && !row.exampleEn.startsWith('TODO') ? row.exampleEn : `Example for "${row.text}".`;
  const exampleVi = row.exampleVi && !row.exampleVi.startsWith('TODO') ? row.exampleVi : undefined;

  return {
    text: row.text,
    normalizedText: row.normalizedText,
    type: row.type || 'single_word',
    level: row.level || undefined,
    partOfSpeech: row.partOfSpeech && row.partOfSpeech !== 'unknown' ? row.partOfSpeech : undefined,
    meanings: [
      {
        meaningVi,
        meaningEn,
        examples: [{ exampleEn, exampleVi }],
      },
    ],
    forms,
    components: [],
    topicIds: [],
    status: 'draft',
  };
}

// --- Main ---
async function main() {
  console.log('Connecting to MongoDB...');
  await mongoose.connect(MONGODB_URI);
  console.log('Connected.');
  console.log(`Reading from: ${JSONL_PATH}\n`);

  const rl = readline.createInterface({
    input: fs.createReadStream(JSONL_PATH, { encoding: 'utf8' }),
    crlfDelay: Infinity,
  });

  let batch = [];
  let totalProcessed = 0;
  let totalInserted = 0;
  let totalSkipped = 0;
  let totalErrors = 0;

  async function flushBatch() {
    if (batch.length === 0) return;

    const normalizedTexts = batch.map((r) => r.normalizedText);

    const existing = await VocabularyModel.find(
      { normalizedText: { $in: normalizedTexts }, deletedAt: null },
      { normalizedText: 1 }
    ).lean();
    const existingSet = new Set(existing.map((e) => e.normalizedText));

    const toInsert = batch.filter((r) => !existingSet.has(r.normalizedText));
    totalSkipped += batch.length - toInsert.length;

    if (toInsert.length > 0) {
      try {
        const docs = toInsert.map(mapRowToDocument);
        await VocabularyModel.insertMany(docs, { ordered: false });
        totalInserted += docs.length;
      } catch (err) {
        if (err.writeErrors) {
          totalErrors += err.writeErrors.length;
          totalInserted += toInsert.length - err.writeErrors.length;
          console.warn(`Batch partial error: ${err.writeErrors.length} write errors`);
        } else {
          console.error('Batch insert error:', err.message);
          totalErrors += toInsert.length;
        }
      }
    }

    batch = [];
  }

  for await (const line of rl) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    try {
      const row = JSON.parse(trimmed);
      batch.push(row);
      totalProcessed++;

      if (batch.length >= BATCH_SIZE) {
        await flushBatch();
        console.log(`  Processed ${totalProcessed} rows... (inserted: ${totalInserted}, skipped: ${totalSkipped}, errors: ${totalErrors})`);
      }
    } catch (e) {
      console.warn(`Skipping invalid JSON line: ${trimmed.substring(0, 60)}...`);
    }
  }

  await flushBatch();

  console.log('\n=== Import Complete ===');
  console.log(`Total rows processed : ${totalProcessed}`);
  console.log(`Inserted (new)       : ${totalInserted}`);
  console.log(`Skipped (existing)   : ${totalSkipped}`);
  console.log(`Errors               : ${totalErrors}`);

  await mongoose.disconnect();
  console.log('Disconnected from MongoDB.');
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
