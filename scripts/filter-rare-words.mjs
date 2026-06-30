/**
 * AuraEnglish — Filter Out Rare/Obscure Words
 *
 * This script reads `missing_word_family_list.json` and uses the AI (DeepSeek)
 * to filter out extremely rare, obscure, highly technical jargon, or non-standard inflections,
 * keeping only standard, useful vocabulary for English learners (CEFR A1-C2).
 *
 * It processes the list in parallel batches of 500 words to be extremely fast and cost-effective.
 *
 * Usage:
 *   node scripts/filter-rare-words.mjs
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';

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

const API_KEY  = process.env.NINEROUTER_API_KEY;
const BASE_URL = process.env.NINEROUTER_BASE_URL;
const MODEL    = process.env.NINEROUTER_MODEL || 'deepseek-v4-flash';
const FILE_PATH = 'missing_word_family_list.json';

const CHUNK_SIZE = 500;

async function callAI(systemPrompt, userContent) {
  const url = `${BASE_URL}/chat/completions`;
  const resp = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${API_KEY}`,
    },
    body: JSON.stringify({
      model: MODEL,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user',   content: userContent  },
      ],
      temperature: 0,
      max_tokens: 4000,
      stream: false,
    }),
    signal: AbortSignal.timeout(60_000),
  });

  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`HTTP ${resp.status}: ${text.slice(0, 200)}`);
  }

  const rawText = await resp.text();
  let content = '';

  if (rawText.includes('data: ')) {
    for (const line of rawText.split('\n')) {
      if (!line.startsWith('data: ')) continue;
      const chunk = line.slice('data: '.length).trim();
      if (chunk === '[DONE]') break;
      try {
        const delta = JSON.parse(chunk).choices?.[0]?.delta?.content;
        if (delta) content += delta;
      } catch {}
    }
  } else {
    content = JSON.parse(rawText).choices?.[0]?.message?.content || '';
  }

  const cleaned = content.replace(/^```(?:json)?\n?/m, '').replace(/```$/m, '').trim();
  return JSON.parse(cleaned);
}

const SYSTEM_PROMPT = `You are a lexicographer filtering a list of vocabulary words for Vietnamese English learners (CEFR level A1 to C2).
Your task is to filter the given list of words and keep ONLY words that are standard, useful, and commonly encountered in standard English text, speech, or exams.

Strictly REMOVE:
1. Extremely obscure, archaic, or rarely used words (e.g., "dharmashastra", "proximodistal", "deposer", "crucifier").
2. Highly specialized scientific, medical, or chemical jargon (e.g., "dialyzer", "dialytic", "gastroenterology" if too advanced for learners).
3. Plain plural inflections or simple verb inflections that add no new meaning over the base form (e.g. keep "empty", remove "empties"; keep "comma", remove "commas").
4. Rare or non-standard derivative adverbs/nouns (e.g. "concertedly", "subdivisional").

Strictly KEEP:
- Commonly used derivative words, adjectives, nouns, or verbs that are valuable for language learners (e.g., "audacious", "coercive", "customizable", "dogmatic", "evocative", "fretful", "gratifying").

Return ONLY a valid JSON array of strings containing the filtered words. Do not include markdown formatting or explanation.`;

async function main() {
  if (!API_KEY || !BASE_URL) {
    console.error('❌ Missing DeepSeek credentials in .env (NINEROUTER_API_KEY / NINEROUTER_BASE_URL).');
    process.exit(1);
  }

  if (!existsSync(FILE_PATH)) {
    console.error(`❌ File "${FILE_PATH}" not found.`);
    process.exit(1);
  }

  const words = JSON.parse(readFileSync(FILE_PATH, 'utf8'));
  console.log(`\n📖 Loaded ${words.length.toLocaleString()} words to filter.`);

  const batches = [];
  for (let i = 0; i < words.length; i += CHUNK_SIZE) {
    batches.push(words.slice(i, i + CHUNK_SIZE));
  }

  console.log(`🚀 Processing in ${batches.length} parallel batches of up to ${CHUNK_SIZE} words via DeepSeek...`);
  const startTime = Date.now();

  const results = await Promise.all(
    batches.map(async (batch, idx) => {
      const userContent = `Filter this list of ${batch.length} words:\n${JSON.stringify(batch)}`;
      try {
        const filtered = await callAI(SYSTEM_PROMPT, userContent);
        if (Array.isArray(filtered)) {
          console.log(`   ✅ Batch ${idx + 1}/${batches.length} complete: ${batch.length} -> ${filtered.length} words`);
          return filtered;
        }
        console.warn(`   ⚠️  Batch ${idx + 1} did not return an array. Falling back to empty.`);
        return [];
      } catch (err) {
        console.error(`   ❌ Batch ${idx + 1} failed: ${err.message}`);
        return [];
      }
    })
  );

  const cleanWords = results.flat();
  const removedCount = words.length - cleanWords.length;
  const pct = ((removedCount / words.length) * 100).toFixed(1);

  // Write back to file
  writeFileSync(FILE_PATH, JSON.stringify(cleanWords, null, 2), 'utf8');

  console.log('\n' + '═'.repeat(60));
  console.log('🏁 FILTERING COMPLETE');
  console.log(`   Original count: ${words.length.toLocaleString()}`);
  console.log(`   Filtered count: ${cleanWords.length.toLocaleString()}`);
  console.log(`   Removed words:  ${removedCount.toLocaleString()} (${pct}%)`);
  console.log(`   Saved file:     ${FILE_PATH}`);
  console.log(`   Time taken:     ${((Date.now() - startTime) / 1000).toFixed(1)}s`);
  console.log('═'.repeat(60));
}

main().catch(err => {
  console.error('💥 Fatal error:', err);
  process.exit(1);
});
