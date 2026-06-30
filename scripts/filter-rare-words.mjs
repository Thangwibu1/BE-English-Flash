/**
 * AuraEnglish — Filter Out Rare/Obscure Words (Interactive Version)
 *
 * This script reads `missing_word_family_list.json` and uses the selected AI provider
 * (DeepSeek or Claude) to filter out extremely rare, obscure, highly technical jargon,
 * or plain plural/inflection words, keeping only standard vocabulary for learners (CEFR A1-C2).
 *
 * It processes the list sequentially in batches of 200 words with a cooldown.
 * If a batch fails, it keeps the original words as a fallback.
 *
 * Usage:
 *   node scripts/filter-rare-words.mjs
 *   node scripts/filter-rare-words.mjs --provider=deepseek
 *   node scripts/filter-rare-words.mjs --provider=claude
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import readline from 'readline';

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

// ── Providers Config ──
const PROVIDERS = [
  {
    name:      'DeepSeek (NINEROUTER)',
    apiKey:    process.env.NINEROUTER_API_KEY,
    baseUrl:   process.env.NINEROUTER_BASE_URL,
    model:     process.env.NINEROUTER_MODEL    || 'deepseek-v4-flash',
  },
  {
    name:      'Claude',
    apiKey:    process.env.NINEROUTER_9R_API_KEY,
    baseUrl:   process.env.NINEROUTER_9R_BASE_URL,
    model:     process.env.NINEROUTER_9R_MODEL || 'claude-3-5-sonnet',
  },
];

const FILE_PATH = 'missing_word_family_list.json';
const CHUNK_SIZE = 200; // 200 words is very safe and fast
const RETRY_MAX = 3;

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ── AI Call ──
async function callAI(provider, systemPrompt, userContent, attempt = 1) {
  const url = `${provider.baseUrl}/chat/completions`;
  try {
    const resp = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${provider.apiKey}`,
      },
      body: JSON.stringify({
        model: provider.model,
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
      // SSE format
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
      // Standard JSON
      content = JSON.parse(rawText).choices?.[0]?.message?.content || '';
    }

    const cleaned = content.replace(/^```(?:json)?\n?/m, '').replace(/```$/m, '').trim();
    return JSON.parse(cleaned);
  } catch (err) {
    if (attempt < RETRY_MAX) {
      console.warn(`  ⚠️  [Attempt ${attempt}/${RETRY_MAX} on ${provider.name}] Failed: ${err.message}. Retrying in 4s...`);
      await sleep(4000);
      return callAI(provider, systemPrompt, userContent, attempt + 1);
    }
    throw err;
  }
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

// ── Interactive Helper ──
function askQuestion(query) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  return new Promise(resolve => rl.question(query, ans => {
    rl.close();
    resolve(ans.trim());
  }));
}

async function main() {
  if (!existsSync(FILE_PATH)) {
    console.error(`❌ File "${FILE_PATH}" not found.`);
    process.exit(1);
  }

  const words = JSON.parse(readFileSync(FILE_PATH, 'utf8'));
  console.log(`\n📖 Loaded ${words.length.toLocaleString()} words to filter.`);

  if (words.length === 0) {
    console.log('🎉 List is empty. Nothing to do!');
    process.exit(0);
  }

  // 1. Choose provider
  let provider;
  const cliProvider = (process.argv.find(a => a.startsWith('--provider=')) || '').split('=')[1];

  if (cliProvider) {
    if (cliProvider === 'deepseek') {
      provider = PROVIDERS[0];
    } else if (cliProvider === '9router' || cliProvider === 'claude') {
      provider = PROVIDERS[1];
    } else {
      console.error('❌ Invalid --provider. Use: deepseek | claude');
      process.exit(1);
    }
  } else {
    console.log('\n🤖 Select AI Provider to use for Filtering:');
    console.log('   [1] DeepSeek (NINEROUTER)');
    console.log('   [2] Claude (Default)');
    
    if (process.stdin.isTTY) {
      const choice = await askQuestion('👉 Enter choice (1-2): ');
      if (choice === '1') {
        provider = PROVIDERS[0];
      } else {
        provider = PROVIDERS[1];
      }
    } else {
      console.log('   (Non-interactive environment detected, defaulting to Claude)');
      provider = PROVIDERS[1];
    }
  }

  // Guard key
  if (!provider.apiKey || !provider.baseUrl) {
    console.error(`\n❌ Missing credentials for selected provider: ${provider.name}`);
    console.error('   Please check NINEROUTER_* or NINEROUTER_9R_* in your .env file.');
    process.exit(1);
  }

  const batches = [];
  for (let i = 0; i < words.length; i += CHUNK_SIZE) {
    batches.push(words.slice(i, i + CHUNK_SIZE));
  }

  console.log(`🚀 Using provider: ${provider.name} (${provider.model})`);
  console.log(`🚀 Processing ${batches.length} batches sequentially (${CHUNK_SIZE} words/batch)...`);
  const startTime = Date.now();

  const cleanWords = [];

  for (let i = 0; i < batches.length; i++) {
    const batch = batches[i];
    const userContent = `Filter this list of ${batch.length} words:\n${JSON.stringify(batch)}`;
    
    console.log(`\n⏳ Batch ${i + 1}/${batches.length} (${batch.length} words)...`);
    
    let filtered = [];
    try {
      filtered = await callAI(provider, SYSTEM_PROMPT, userContent);
      if (Array.isArray(filtered)) {
        console.log(`   ✅ Success: ${batch.length} -> ${filtered.length} words`);
      } else {
        throw new Error('AI response is not a valid JSON array.');
      }
    } catch (err) {
      console.error(`   ❌ Failed after all attempts: ${err.message}`);
      console.error(`      Fallback: keeping all ${batch.length} original words of this batch.`);
      filtered = batch;
    }
    
    cleanWords.push(...filtered);
    
    // Cooldown
    await sleep(2000);
  }

  // Safety guard: Never write if the resulting array is completely empty
  if (cleanWords.length === 0) {
    console.error('\n❌ Error: The filtered list is empty. Aborting write to prevent data corruption.');
    process.exit(1);
  }

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
  console.log(`   Time taken:     ${((Date.now() - startTime) / 1000 / 60).toFixed(1)} minutes`);
  console.log('═'.repeat(60));
}

main().catch(err => {
  console.error('💥 Fatal error:', err);
  process.exit(1);
});
