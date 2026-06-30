/**
 * AuraEnglish — Scan Missing Word Family Terms
 *
 * This script:
 * 1. Scans all approved vocabulary records in the database.
 * 2. Collects all unique words listed in their `wordFamily` arrays.
 * 3. Identifies which of these relative words are MISSING from the database entirely.
 * 4. Saves the missing words list to `missing_word_family_list.json` so they can
 *    be processed by the expansion script.
 *
 * Usage:
 *   node scripts/scan-missing-word-family.mjs
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { MongoClient } from 'mongodb';

// ── Load .env ──
const ENV_PATH = new URL('../.env', import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1');
function loadEnv(path) {
  if (!existsSync(path)) return;
  const lines = readFileSync(path, 'utf8').split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const idx = trimmed.indexOf('=');
    if (idx === -1) continue;
    const key = trimmed.slice(0, idx).trim();
    const value = trimmed.slice(idx + 1).trim();
    if (!process.env[key]) process.env[key] = value;
  }
}
loadEnv(ENV_PATH);
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const MONGODB_URI = process.env.MONGODB_URI;
const OUTPUT_FILE = 'missing_word_family_list.json';

function normalizeText(text) {
  return text.toLowerCase().trim().replace(/\s+/g, ' ');
}

async function main() {
  if (!MONGODB_URI) {
    console.error('❌ MONGODB_URI not set in .env');
    process.exit(1);
  }

  console.log('\n🔗 Connecting to MongoDB...');
  const client = new MongoClient(MONGODB_URI);
  await client.connect();
  const db = client.db();
  console.log('✅ Connected.');

  console.log('\n🔍 Scanning database to build vocabulary index...');
  const allExistingVocabs = await db.collection('vocabularies')
    .find({ deletedAt: null }, { projection: { normalizedText: 1, text: 1, wordFamily: 1 } })
    .toArray();

  const existingWordsSet = new Set();
  const collectedWordFamilyWords = new Set();

  for (const doc of allExistingVocabs) {
    if (doc.text) {
      existingWordsSet.add(normalizeText(doc.text));
    }
    if (doc.normalizedText) {
      existingWordsSet.add(normalizeText(doc.normalizedText));
    }
    
    // Accumulate wordFamily entries
    if (Array.isArray(doc.wordFamily)) {
      for (const wf of doc.wordFamily) {
        if (wf && typeof wf === 'string') {
          collectedWordFamilyWords.add(normalizeText(wf));
        }
      }
    }
  }

  console.log(`   Indexed ${existingWordsSet.size.toLocaleString()} unique existing words from DB.`);
  console.log(`   Collected ${collectedWordFamilyWords.size.toLocaleString()} unique word family terms.`);

  // Find missing word-family words
  const missingWords = [];
  for (const wf of collectedWordFamilyWords) {
    if (!existingWordsSet.has(wf)) {
      missingWords.push(wf);
    }
  }

  console.log(`\n📊 SUMMARY:`);
  console.log(`   - Existing words in DB: ${existingWordsSet.size.toLocaleString()}`);
  console.log(`   - Unique word family terms found: ${collectedWordFamilyWords.size.toLocaleString()}`);
  console.log(`   - Missing terms to insert: ${missingWords.length.toLocaleString()}`);

  if (missingWords.length === 0) {
    console.log('\n🎉 Perfect! No missing word family terms found. Your database is fully complete!');
    if (existsSync(OUTPUT_FILE)) {
      writeFileSync(OUTPUT_FILE, JSON.stringify([], null, 2), 'utf8');
    }
    await client.close();
    return;
  }

  // Save to JSON file
  writeFileSync(OUTPUT_FILE, JSON.stringify(missingWords, null, 2), 'utf8');
  console.log(`\n💾 Saved ${missingWords.length} missing words to: "${OUTPUT_FILE}"`);
  console.log('👉 Next step: Run the expansion script to enrich and insert them:');
  console.log('   node scripts/expand-missing-word-family.mjs');

  await client.close();
}

main().catch(err => {
  console.error('💥 Fatal error:', err);
  process.exit(1);
});
