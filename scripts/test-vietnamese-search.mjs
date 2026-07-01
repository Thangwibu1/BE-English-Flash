import mongoose from 'mongoose';
import { MongoVocabularyRepository } from '../dist/infrastructure/database/mongoose/repositories/MongoVocabularyRepository.js';
import { FuzzyVocabularySearchService } from '../dist/infrastructure/services/FuzzyVocabularySearchService.js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '../.env') });

const mongoUri = process.env.MONGODB_URI;

if (!mongoUri) {
  console.error('MONGODB_URI not found in env!');
  process.exit(1);
}

async function run() {
  console.log('Connecting to MongoDB...');
  await mongoose.connect(mongoUri);
  console.log('Connected!');

  const repo = new MongoVocabularyRepository();
  const fuzzyService = new FuzzyVocabularySearchService({ vocabularyRepository: repo });

  console.log('\n--- Rebuilding Fuzzy Index ---');
  await fuzzyService.rebuildIndex();
  console.log(`Fuzzy index built with ${fuzzyService.getDocCount()} docs.`);

  // Test 1: Exact search for a Vietnamese word
  const exactTerm = 'thế giới';
  console.log(`\n--- Test 1: Exact Search for "${exactTerm}" ---`);
  const exactResults = await repo.searchExact({
    normalizedQuery: exactTerm,
    limit: 5
  });
  console.log(`Found ${exactResults.length} results:`);
  exactResults.forEach(r => {
    console.log(`- [${r.text}] level: ${r.level}, POS: ${r.partOfSpeech}, meaningVi: ${r.meanings?.[0]?.meaningVi}`);
  });

  // Test 2: Prefix search for a Vietnamese word
  const prefixTerm = 'nông';
  console.log(`\n--- Test 2: Prefix Search for "${prefixTerm}" ---`);
  const prefixResults = await repo.searchPrefix({
    token: prefixTerm,
    limit: 5
  });
  console.log(`Found ${prefixResults.length} results:`);
  prefixResults.forEach(r => {
    console.log(`- [${r.text}] level: ${r.level}, POS: ${r.partOfSpeech}, meaningVi: ${r.meanings?.[0]?.meaningVi}`);
  });

  // Test 3: Fuzzy search for a Vietnamese word
  const fuzzyTerm = 'nông nghiệp';
  console.log(`\n--- Test 3: Fuzzy Search for "${fuzzyTerm}" ---`);
  const fuzzyResults = await fuzzyService.search({
    query: fuzzyTerm,
    limit: 5
  });
  console.log(`Found ${fuzzyResults.length} results:`);
  fuzzyResults.forEach(r => {
    console.log(`- [${r.text}] score: ${r.score}, meaningVi: ${r.meaningVi}`);
  });

  await mongoose.disconnect();
  console.log('\nDisconnected from MongoDB.');
}

run().catch(console.error);
