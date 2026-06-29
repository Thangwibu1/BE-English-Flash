/**
 * Enrich Vocabulary using DeepSeek API
 * Queries MongoDB for vocabularies with "[Draft]" in meaningVi,
 * sends them to DeepSeek in batches to get clean translations, definitions, and examples,
 * and updates MongoDB directly.
 * 
 * Usage:
 * DEEPSEEK_API_KEY=your_key_here node scripts/enrich-with-deepseek.mjs
 */

import mongoose from 'mongoose';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Load environment variables from backend/.env if available
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://root:lameojicomatkhau@coolify.be-learning.io.vn:2808/English?authSource=admin&directConnection=true';
const DEEPSEEK_API_KEY = process.env.NINEROUTER_API_KEY || process.env.DEEPSEEK_API_KEY;
const DEEPSEEK_BASE_URL = process.env.NINEROUTER_BASE_URL || 'https://api.deepseek.com/v1';
const DEEPSEEK_API_URL = DEEPSEEK_BASE_URL.replace(/\/$/, '') + '/chat/completions';
const DEEPSEEK_MODEL = process.env.NINEROUTER_MODEL || 'deepseek-chat';
const BATCH_SIZE = 40;

const functionWords = new Set([
  'the', 'a', 'an', 'to', 'of', 'in', 'on', 'at', 'and', 'or', 'but', 'is', 'are', 'was', 'were',
  'be', 'been', 'have', 'has', 'had', 'do', 'does', 'did', 'this', 'that', 'it', 'you', 'he', 'she', 'they',
  'i', 'we', 'my', 'your', 'his', 'her', 'their', 'our', 'us', 'him', 'them', 'me', 'who', 'whom', 'which',
  'what', 'whose', 'why', 'how', 'if', 'then', 'else', 'for', 'with', 'about', 'by', 'from', 'up', 'down',
  'out', 'over', 'under', 'again', 'further', 'once', 'here', 'there', 'when', 'where', 'all', 'any', 'both',
  'each', 'few', 'more', 'most', 'other', 'some', 'such', 'no', 'nor', 'not', 'only', 'own', 'same', 'so',
  'than', 'too', 'very', 's', 't', 'can', 'will', 'just', 'should', 'now'
]);

// --- Mongoose Schema ---
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

const VocabularySchema = new mongoose.Schema(
  {
    text: { type: String, required: true },
    normalizedText: { type: String, required: true, index: true },
    type: { type: String },
    level: { type: String },
    partOfSpeech: { type: String },
    meanings: [meaningSchema],
    forms: [formSchema],
    topics: [{ type: String }],
    autoHighlight: { type: Boolean, default: true },
    status: { type: String, default: 'draft' },
    needsReview: { type: Boolean, default: false },
    qualityScore: { type: Number },
    qualityNotes: [{ type: String }],
    enrichedAt: { type: Date },
    enrichedBy: { type: String },
    deletedAt: { type: Date, default: null },
  },
  { collection: 'vocabularies' }
);

const VocabularyModel = mongoose.model('Vocabulary', VocabularySchema);

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Send batch to DeepSeek API
async function enrichBatchWithAI(batch) {
  const wordsPrompt = batch.map(w => ({
    id: w._id.toString(),
    text: w.text,
    level: w.level || 'A1'
  }));

  const systemMessage = `You are an expert English-Vietnamese lexicographer. Enrich the provided list of English words.
For each word, you must return:
- partOfSpeech (noun, verb, adjective, adverb, preposition, conjunction, pronoun, article, etc.)
- meaningVi (clear, concise Vietnamese translation, no "[Draft]" prefix)
- meaningEn (simple English definition suitable for learners)
- exampleEn (a natural example sentence containing the word)
- exampleVi (natural Vietnamese translation of exampleEn)
- forms (array of inflected forms, e.g. for "run": ["run", "runs", "ran", "running"])
- topics (1-2 topics from: Daily Life, School, Business, Technology, Travel, Food, Health, Nature, Society, Culture, Academic, Grammar)

Format rules:
- Keep the exact "id" from the input.
- Function/grammar words (like 'the', 'is', 'of', 'and') should have autoHighlight: false. Content words should have autoHighlight: true.
- Return ONLY a raw JSON array matching this structure without markdown formatting, code blocks, or explanations.`;

  const userMessage = JSON.stringify(wordsPrompt);

  for (let attempt = 0; attempt < 3; attempt++) {
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
            { role: 'system', content: systemMessage },
            { role: 'user', content: userMessage }
          ],
          temperature: 0.1
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP Error ${response.status}: ${await response.text()}`);
      }

      const resData = await response.json();
      const content = resData.choices[0].message.content.trim();
      
      // Clean up markdown block wrapping if present
      let cleanContent = content;
      if (cleanContent.startsWith('```json')) {
        cleanContent = cleanContent.substring(7);
      }
      if (cleanContent.endsWith('```')) {
        cleanContent = cleanContent.substring(0, cleanContent.length - 3);
      }
      cleanContent = cleanContent.trim();

      // DeepSeek might return the array inside a key or directly as array
      let parsed = JSON.parse(cleanContent);
      if (parsed.words) parsed = parsed.words;
      if (parsed.data) parsed = parsed.data;
      if (parsed.results) parsed = parsed.results;
      
      if (Array.isArray(parsed)) {
        return parsed;
      }
      throw new Error("DeepSeek response is not a valid JSON array.");
    } catch (e) {
      console.warn(`[Attempt ${attempt + 1}] DeepSeek API call failed: ${e.message}`);
      await sleep(2000 * (attempt + 1));
    }
  }
  return null;
}

async function main() {
  if (!DEEPSEEK_API_KEY) {
    console.error('ERROR: NINEROUTER_API_KEY or DEEPSEEK_API_KEY is not defined. Please check your .env file.');
    process.exit(1);
  }

  console.log('Connecting to MongoDB...');
  await mongoose.connect(MONGODB_URI);
  console.log('Connected.');

  console.log('Querying vocabularies with "[Draft]" in meaningVi...');
  const drafts = await VocabularyModel.find({
    'meanings.meaningVi': { $regex: '^\\[Draft\\]' },
    deletedAt: null
  }, {
    text: 1,
    level: 1
  }).lean();

  console.log(`Found ${drafts.length} documents to enrich.`);
  if (drafts.length === 0) {
    console.log('No draft meanings to process.');
    await mongoose.disconnect();
    return;
  }

  let totalUpdated = 0;

  for (let i = 0; i < drafts.length; i += BATCH_SIZE) {
    const batch = drafts.slice(i, i + BATCH_SIZE);
    console.log(`Processing batch ${i / BATCH_SIZE + 1}/${Math.ceil(drafts.length / BATCH_SIZE)} (${batch.length} items)...`);
    
    const enrichedResults = await enrichBatchWithAI(batch);

    if (enrichedResults && enrichedResults.length > 0) {
      const bulkOps = [];

      for (const result of enrichedResults) {
        const wordInfo = batch.find(w => w._id.toString() === result.id);
        if (!wordInfo) continue;

        const isFunc = functionWords.has(wordInfo.text.toLowerCase());
        const autoHighlight = result.autoHighlight !== undefined ? result.autoHighlight : !isFunc;

        const forms = result.forms ? result.forms.map(f => ({
          formText: f,
          normalizedFormText: f.trim().toLowerCase()
        })) : [{ formText: wordInfo.text, normalizedFormText: wordInfo.text.toLowerCase() }];

        bulkOps.push({
          updateOne: {
            filter: { _id: wordInfo._id },
            update: {
              $set: {
                partOfSpeech: result.partOfSpeech || 'unknown',
                meanings: [
                  {
                    meaningVi: result.meaningVi,
                    meaningEn: result.meaningEn,
                    examples: [{
                      exampleEn: result.exampleEn,
                      exampleVi: result.exampleVi
                    }]
                  }
                ],
                forms,
                topics: result.topics || ["Daily Life"],
                autoHighlight,
                status: 'approved',
                needsReview: false,
                qualityScore: 0.95,
                qualityNotes: [],
                enrichedAt: new Date(),
                enrichedBy: 'deepseek-ai'
              }
            }
          }
        });
      }

      if (bulkOps.length > 0) {
        try {
          const bulkResult = await VocabularyModel.bulkWrite(bulkOps, { ordered: false });
          totalUpdated += bulkResult.modifiedCount;
          console.log(`  Successfully updated ${bulkResult.modifiedCount} records in DB. (Total: ${totalUpdated})`);
        } catch (dbErr) {
          console.error(`  Database update error:`, dbErr.message);
        }
      }
    } else {
      console.warn(`  Failed to enrich batch ${i / BATCH_SIZE + 1}. Skipping...`);
    }

    // Delay between batches to respect API limits
    await sleep(1000);
  }

  console.log(`\n=== Process Complete ===`);
  console.log(`Successfully updated: ${totalUpdated}/${drafts.length} documents.`);

  await mongoose.disconnect();
  console.log('Disconnected from MongoDB.');
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
