/**
 * Test script: verify both AI providers work correctly before full enrichment run.
 * Sends 1 real vocabulary batch to each provider and prints the results.
 *
 * Usage:
 *   node scripts/test-two-providers.mjs
 */

import { readFileSync, existsSync } from 'fs';
import { MongoClient } from 'mongodb';

// ── Load .env ──
const ENV_PATH = new URL('../.env', import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1');
function loadEnv(path) {
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const idx = trimmed.indexOf('=');
    if (idx === -1) continue;
    const key = trimmed.slice(0, idx).trim();
    const val = trimmed.slice(idx + 1).trim();
    if (!process.env[key]) process.env[key] = val;
  }
}
loadEnv(ENV_PATH);
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

// ── Provider configs ──
const PROVIDERS = [
  {
    name: 'DeepSeek (via NINEROUTER)',
    apiKey:  process.env.NINEROUTER_API_KEY,
    baseUrl: process.env.NINEROUTER_BASE_URL,
    model:   process.env.NINEROUTER_MODEL || 'deepseek-v4-flash',
  },
  {
    name: '9Router (ngocthang.io.vn)',
    apiKey:  process.env.NINEROUTER_9R_API_KEY,
    baseUrl: process.env.NINEROUTER_9R_BASE_URL,
    model:   process.env.NINEROUTER_9R_MODEL || 'my-combo',
  },
];

const MONGODB_URI = process.env.MONGODB_URI;

// ── Helpers ──
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function stripFences(text) {
  return text.replace(/^```(?:json)?\n?/m, '').replace(/```$/m, '').trim();
}

// ── Simple AI call ──
async function callProvider(provider, systemPrompt, userContent) {
  const url = `${provider.baseUrl}/chat/completions`;
  const t0 = Date.now();

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
      temperature: 0.2,
      max_tokens: 4000,
    }),
    signal: AbortSignal.timeout(90_000),
  });

  const latency = Date.now() - t0;

  if (!resp.ok) {
    const body = await resp.text();
    throw new Error(`HTTP ${resp.status}: ${body.slice(0, 300)}`);
  }

  const data = await resp.json();
  const content = data.choices?.[0]?.message?.content || '';
  const cleaned = stripFences(content);

  return { parsed: JSON.parse(cleaned), latency, rawContent: content };
}

// ── PING test ──
async function pingProvider(provider) {
  console.log(`\n🏓 Pinging: ${provider.name}`);
  console.log(`   URL   : ${provider.baseUrl}`);
  console.log(`   Model : ${provider.model}`);

  const t0 = Date.now();
  try {
    const resp = await fetch(`${provider.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${provider.apiKey}`,
      },
      body: JSON.stringify({
        model: provider.model,
        messages: [{ role: 'user', content: 'Reply with exactly one word: hello' }],
        max_tokens: 10,
        temperature: 0,
      }),
      signal: AbortSignal.timeout(30_000),
    });

    const latency = Date.now() - t0;
    if (!resp.ok) {
      const body = await resp.text();
      throw new Error(`HTTP ${resp.status}: ${body.slice(0, 200)}`);
    }

    const data = await resp.json();
    const reply = data.choices?.[0]?.message?.content?.trim() || '(empty)';
    console.log(`   ✅ PING OK — reply: "${reply}" — latency: ${latency}ms`);
    return true;
  } catch (err) {
    console.error(`   ❌ PING FAILED: ${err.message}`);
    return false;
  }
}

// ── Real vocabulary batch test ──
const SYSTEM_PROMPT = `You are an English vocabulary editor for a Vietnamese English-learning app.
Enrich each vocabulary item. Return ONLY valid JSON, no markdown fences.

Return JSON:
{
  "items": [
    {
      "id": "string",
      "text": "string",
      "meaningVi": "string (Vietnamese meaning, NO [Draft])",
      "meaningEn": "string (simple English definition)",
      "exampleEn": "string (natural example sentence, NOT starting with 'Example for')",
      "exampleVi": "string (Vietnamese translation of example)",
      "partOfSpeech": "noun|verb|adjective|adverb|etc",
      "forms": ["string"],
      "topics": ["string"],
      "synonyms": ["string"],
      "antonyms": ["string"],
      "level": "A1|A2|B1|B2|C1|C2",
      "type": "single_word|compound_word|collocation|phrasal_verb|idiom",
      "autoHighlight": true,
      "qualityScore": 0.9
    }
  ]
}`;

async function testBatch(provider, sampleDocs) {
  const inputStr = JSON.stringify(
    sampleDocs.map(d => ({
      id: d._id.toString(),
      text: d.text,
      existingMeaningVi: d.meanings?.[0]?.meaningVi || '',
    }))
  );

  const userContent = `Enrich these ${sampleDocs.length} vocabulary words:\n${inputStr}`;

  console.log(`\n📦 Sending ${sampleDocs.length} words to: ${provider.name}`);
  const t0 = Date.now();

  try {
    const { parsed, latency } = await callProvider(provider, SYSTEM_PROMPT, userContent);
    const items = parsed?.items || [];
    const elapsed = ((Date.now() - t0) / 1000).toFixed(1);

    console.log(`   ✅ Response received in ${elapsed}s`);
    console.log(`   📊 Items returned: ${items.length}/${sampleDocs.length}`);

    // Show first 3 results
    for (const item of items.slice(0, 3)) {
      console.log(`\n   📝 [${item.text}]`);
      console.log(`      VI: ${item.meaningVi}`);
      console.log(`      EN: ${item.meaningEn}`);
      console.log(`      synonyms: [${(item.synonyms || []).join(', ')}]`);
      console.log(`      antonyms: [${(item.antonyms || []).join(', ')}]`);
    }

    // Validate items
    let valid = 0, invalid = 0;
    for (const item of items) {
      const ok = item.meaningVi &&
                 !item.meaningVi.match(/\[Draft\]/i) &&
                 item.meaningEn &&
                 item.exampleEn &&
                 !item.exampleEn.match(/^Example for/i) &&
                 item.exampleVi &&
                 Array.isArray(item.synonyms) &&
                 Array.isArray(item.antonyms);
      ok ? valid++ : invalid++;
    }

    console.log(`\n   🔍 Validation: ${valid} valid, ${invalid} invalid`);
    return { ok: true, valid, invalid, total: items.length };
  } catch (err) {
    console.error(`   ❌ BATCH TEST FAILED: ${err.message}`);
    return { ok: false, error: err.message };
  }
}

// ── MAIN ──
async function main() {
  console.log('═'.repeat(60));
  console.log('🧪 TWO-PROVIDER TEST — AuraEnglish Enrichment');
  console.log('═'.repeat(60));

  // Check env vars
  for (const p of PROVIDERS) {
    if (!p.apiKey || !p.baseUrl) {
      console.error(`\n❌ Missing credentials for: ${p.name}`);
      console.error('   Check your .env file.');
      process.exit(1);
    }
  }

  // Step 1: Ping both providers simultaneously
  console.log('\n── STEP 1: PING BOTH PROVIDERS ──');
  const [ping1, ping2] = await Promise.all([
    pingProvider(PROVIDERS[0]),
    pingProvider(PROVIDERS[1]),
  ]);

  if (!ping1 || !ping2) {
    console.error('\n❌ One or more providers failed ping. Fix before proceeding.');
    process.exit(1);
  }

  console.log('\n✅ Both providers are reachable!\n');

  // Step 2: Connect to MongoDB and get sample words
  console.log('── STEP 2: FETCH SAMPLE VOCABULARY FROM DB ──');
  const client = new MongoClient(MONGODB_URI);
  await client.connect();
  const db = client.db();

  // Get 10 words that need enrichment (missing synonyms)
  const sampleDocs = await db.collection('vocabularies')
    .find({
      deletedAt: null,
      $or: [
        { 'meanings.0.synonyms': { $exists: false } },
        { 'meanings.meaningVi': { $regex: /^\[Draft\]/i } },
      ],
    })
    .limit(10)
    .toArray();

  console.log(`   Found ${sampleDocs.length} sample docs to test with.`);

  if (sampleDocs.length < 4) {
    console.warn('   ⚠️  Very few test docs. DB may already be mostly enriched!');
  }

  const half = Math.ceil(sampleDocs.length / 2);
  const batch1 = sampleDocs.slice(0, half);
  const batch2 = sampleDocs.slice(half);

  // Step 3: Test both providers with real batches simultaneously
  console.log('\n── STEP 3: TEST REAL BATCH ON BOTH PROVIDERS (parallel) ──');

  const [result1, result2] = await Promise.all([
    testBatch(PROVIDERS[0], batch1),
    testBatch(PROVIDERS[1], batch2),
  ]);

  // Summary
  console.log('\n' + '═'.repeat(60));
  console.log('📋 TEST SUMMARY');
  console.log('═'.repeat(60));
  console.log(`\n  Provider 1 — ${PROVIDERS[0].name}`);
  console.log(`    Status  : ${result1.ok ? '✅ PASS' : '❌ FAIL'}`);
  if (result1.ok) console.log(`    Valid   : ${result1.valid}/${result1.total}`);
  else            console.log(`    Error   : ${result1.error}`);

  console.log(`\n  Provider 2 — ${PROVIDERS[1].name}`);
  console.log(`    Status  : ${result2.ok ? '✅ PASS' : '❌ FAIL'}`);
  if (result2.ok) console.log(`    Valid   : ${result2.valid}/${result2.total}`);
  else            console.log(`    Error   : ${result2.error}`);

  const bothOk = result1.ok && result2.ok;
  console.log('\n' + '═'.repeat(60));
  if (bothOk) {
    console.log('🚀 BOTH PROVIDERS WORKING — Ready for full enrichment run!');
    console.log('   Next step:');
    console.log('   node scripts/enrich-synonyms-antonyms.mjs --mode=fix-and-relations');
  } else {
    console.log('⚠️  Some providers failed. Fix before running full enrichment.');
  }
  console.log('═'.repeat(60));

  await client.close();
}

main().catch(err => {
  console.error('💥 Fatal error:', err);
  process.exit(1);
});
