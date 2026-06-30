/**
 * AuraEnglish — Synonym/Antonym Enrichment Script
 * Follows: auraenglish_approved_vocab_synonym_antonym_enrichment_spec.md
 *
 * Modes:
 *   --mode=fix-and-relations   (Phase 1 + 2: fix [Draft] + add synonyms/antonyms)
 *   --mode=relations-only      (Phase 2: add synonyms/antonyms to clean approved)
 *   --mode=word-family         (Phase 3: generate wordFamily for approved records)
 *
 * Usage:
 *   node scripts/enrich-synonyms-antonyms.mjs --mode=fix-and-relations
 *   node scripts/enrich-synonyms-antonyms.mjs --mode=relations-only
 *   node scripts/enrich-synonyms-antonyms.mjs --mode=word-family
 *
 * Env required (already in .env):
 *   MONGODB_URI
 *   NINEROUTER_API_KEY
 *   NINEROUTER_BASE_URL
 *   NINEROUTER_MODEL
 */

import { readFileSync, writeFileSync, existsSync, appendFileSync } from 'fs';
import { MongoClient, ObjectId } from 'mongodb';

// ──────────────────────────────────────────
// 0. CONFIG
// ──────────────────────────────────────────

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

// Suppress TLS warning
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const MONGODB_URI   = process.env.MONGODB_URI;
const API_KEY       = process.env.NINEROUTER_API_KEY;
const BASE_URL      = process.env.NINEROUTER_BASE_URL;
const MODEL         = process.env.NINEROUTER_MODEL || 'deepseek-v4-flash';

const BATCH_SIZE    = 80;   // words per AI call — spec Section 18 recommends 80
const WORKERS       = 2;    // parallel workers (both call AI concurrently via Promise.all)
const RETRY_MAX     = 3;    // per-batch retries on parse/network failure
const REPORT_FILE   = 'enrichment_report_synonyms.jsonl';
const ENRICHED_BY   = 'ai:9router:deepseek-v4-flash';

// Parse CLI args
const mode = (process.argv.find(a => a.startsWith('--mode=')) || '--mode=fix-and-relations').split('=')[1];
const DRY_RUN = process.argv.includes('--dry-run');

if (!['fix-and-relations', 'relations-only', 'word-family'].includes(mode)) {
  console.error('❌ Invalid --mode. Use: fix-and-relations | relations-only | word-family');
  process.exit(1);
}

console.log(`\n🚀 Mode: ${mode}${DRY_RUN ? ' [DRY RUN]' : ''}`);
console.log(`   Batch size: ${BATCH_SIZE}, Workers: ${WORKERS}`);

// ──────────────────────────────────────────
// 1. HELPERS
// ──────────────────────────────────────────

function normalizeText(text) {
  return text.toLowerCase().trim().replace(/\s+/g, ' ');
}

function normalizeWordList(arr) {
  if (!Array.isArray(arr)) return [];
  return [...new Set(arr.map(w => w.toLowerCase().trim()).filter(Boolean))];
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function appendReport(entry) {
  appendFileSync(REPORT_FILE, JSON.stringify(entry) + '\n', 'utf8');
}

// ──────────────────────────────────────────
// 2. VALIDATION
// ──────────────────────────────────────────

function validateItem(item) {
  const errors = [];

  if (!item.id && !item.text)               errors.push('missing id/text');
  if (!item.text)                           errors.push('missing text');
  if (!item.normalizedText)                 errors.push('missing normalizedText');
  if (!item.type)                           errors.push('missing type');
  if (!item.level)                          errors.push('missing level');
  if (!item.partOfSpeech)                   errors.push('missing partOfSpeech');
  if (!item.meaningVi || item.meaningVi.match(/\[Draft\]/i))
                                            errors.push('invalid meaningVi');
  if (!item.meaningEn)                      errors.push('missing meaningEn');
  if (!item.exampleEn || item.exampleEn.match(/^Example for/i))
                                            errors.push('invalid exampleEn');
  if (!item.exampleVi)                      errors.push('missing exampleVi');
  if (!Array.isArray(item.forms) || item.forms.length === 0)
                                            errors.push('missing forms');
  if (!Array.isArray(item.topics) || item.topics.length === 0)
                                            errors.push('missing topics');
  if (item.status !== 'approved')           errors.push('status must be approved');
  if (item.needsReview !== false)           errors.push('needsReview must be false');
  if (typeof item.qualityScore !== 'number' || item.qualityScore < 0.75)
                                            errors.push('qualityScore < 0.75');
  if (!Array.isArray(item.synonyms))        errors.push('synonyms must be array');
  if (!Array.isArray(item.antonyms))        errors.push('antonyms must be array');

  return errors;
}

function validateRelationsOnlyItem(item) {
  const errors = [];
  if (!item.id)                             errors.push('missing id');
  if (!Array.isArray(item.synonyms))        errors.push('synonyms must be array');
  if (!Array.isArray(item.antonyms))        errors.push('antonyms must be array');
  return errors;
}

// ──────────────────────────────────────────
// 3. MAP AI RESPONSE → MONGO PATCH
// ──────────────────────────────────────────

function mapToVocabularyPatch(item) {
  return {
    text: item.text,
    normalizedText: normalizeText(item.normalizedText || item.text),

    type: item.type,
    level: item.level,
    partOfSpeech: item.partOfSpeech,

    meanings: [
      {
        meaningVi: item.meaningVi,
        meaningEn: item.meaningEn,
        synonyms: normalizeWordList(item.synonyms),
        antonyms: normalizeWordList(item.antonyms),
        examples: [
          {
            exampleEn: item.exampleEn,
            exampleVi: item.exampleVi,
          },
        ],
      },
    ],

    forms: normalizeWordList(item.forms).map(form => ({
      formText: form,
      normalizedFormText: normalizeText(form),
    })),

    components: [],
    topicIds: [],
    topics: item.topics,

    status: 'approved',
    deletedAt: null,

    autoHighlight: item.autoHighlight ?? true,

    enrichedAt: new Date(),
    enrichedBy: ENRICHED_BY,

    needsReview: false,

    qualityNotes: item.qualityNotes || [],
    qualityScore: item.qualityScore,

    ...(item.wordFamily && item.wordFamily.length > 0
      ? { wordFamily: normalizeWordList(item.wordFamily) }
      : {}),
  };
}

// ──────────────────────────────────────────
// 4. PROMPTS
// ──────────────────────────────────────────

const FULL_ENRICH_SYSTEM = `You are an expert English vocabulary editor for a Vietnamese English-learning app.
Your task is to enrich vocabulary records so they are ready to be inserted or updated as fully approved records.
Return ONLY valid JSON with no markdown fences. No explanations.

Rules:
- Keep original id if present.
- Add Vietnamese meaning (meaningVi). No [Draft]. No TODO.
- Add simple English meaning (meaningEn).
- Add a natural English example sentence (exampleEn). Do NOT start with "Example for".
- Add Vietnamese translation of the example (exampleVi).
- Add partOfSpeech (noun / verb / adjective / adverb / preposition / conjunction / etc.).
- Add forms array (base form + inflections, lowercase).
- Add 1-3 relevant topics (English topic names like Work, Nature, Health, etc.).
- Add synonyms that match the selected meaning (can be empty []).
- Add antonyms ONLY if a natural direct opposite exists (can be empty []).
- Add wordFamily candidates (can be empty []).
- Set autoHighlight=false for very common function words (the, a, is, of, ...).
- Set autoHighlight=true for useful content words.
- Set status="approved" for every item.
- Set needsReview=false for every item.
- Set qualityScore between 0.75 and 1.0.`;

const FULL_ENRICH_SCHEMA = `Return JSON exactly:
{
  "items": [
    {
      "id": "string or null",
      "text": "string",
      "normalizedText": "string",
      "type": "single_word | compound_word | collocation | phrasal_verb | idiom | fixed_phrase | sentence_pattern",
      "level": "A1 | A2 | B1 | B2 | C1 | C2",
      "partOfSpeech": "string",
      "meaningVi": "string",
      "meaningEn": "string",
      "exampleEn": "string",
      "exampleVi": "string",
      "forms": ["string"],
      "topics": ["string"],
      "synonyms": ["string"],
      "antonyms": ["string"],
      "wordFamily": ["string"],
      "autoHighlight": true,
      "status": "approved",
      "needsReview": false,
      "qualityScore": 0.95,
      "qualityNotes": []
    }
  ]
}`;

const RELATIONS_ONLY_SYSTEM = `You are an expert English vocabulary editor.
Your task is to add synonyms, antonyms, and optional wordFamily to existing vocabulary records.
Return ONLY valid JSON with no markdown fences.

Rules:
- Keep the original id exactly.
- synonyms: natural synonyms matching the given meaning. Empty [] is valid.
- antonyms: only if a natural direct opposite exists. Empty [] is valid.
- Do NOT force antonyms for nouns without clear opposites (e.g. table, computer, company).
- wordFamily: related word forms (optional, can be []).`;

const WORD_FAMILY_SYSTEM = `You are an expert English vocabulary editor.
Your task is to generate word family candidates for each vocabulary record.
Return ONLY valid JSON with no markdown fences.

Rules:
- Keep the original id exactly.
- wordFamily: array of related word forms (verb, noun, adjective, adverb variants).
- Only include real English words, not invented forms.
- Normalize to lowercase.
- Can be [] if no clear word family exists.`;

// ──────────────────────────────────────────
// 5. AI CALL
// ──────────────────────────────────────────

async function callAI(systemPrompt, userContent, attempt = 1) {
  const url = `${BASE_URL}/chat/completions`;
  const body = JSON.stringify({
    model: MODEL,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user',   content: userContent  },
    ],
    temperature: 0.2,
    max_tokens: 8000,
  });

  try {
    const resp = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${API_KEY}`,
      },
      body,
      signal: AbortSignal.timeout(120_000), // 2 min timeout
    });

    if (!resp.ok) {
      const text = await resp.text();
      throw new Error(`HTTP ${resp.status}: ${text.slice(0, 200)}`);
    }

    const data = await resp.json();
    const content = data.choices?.[0]?.message?.content || '';

    // Strip markdown fences if AI adds them anyway
    const cleaned = content.replace(/^```(?:json)?\n?/m, '').replace(/```$/m, '').trim();
    return JSON.parse(cleaned);
  } catch (err) {
    if (attempt < RETRY_MAX) {
      console.warn(`  ⚠️  Retry ${attempt}/${RETRY_MAX}: ${err.message}`);
      await sleep(3000 * attempt);
      return callAI(systemPrompt, userContent, attempt + 1);
    }
    throw err;
  }
}

// ──────────────────────────────────────────
// 6. MONGO QUERIES
// ──────────────────────────────────────────

function getQueryForMode(mode) {
  if (mode === 'fix-and-relations') {
    // Phase 1+2: records with [Draft] meanings OR missing synonyms/antonyms
    return {
      deletedAt: null,
      $or: [
        { 'meanings.meaningVi': { $regex: /^\[Draft\]/i } },
        { 'meanings.0.meaningEn': { $exists: false } },
        { 'meanings.0.examples.0.exampleVi': { $exists: false } },
        { partOfSpeech: { $exists: false } },
        { forms: { $size: 0 } },
        { 'meanings.0.synonyms': { $exists: false } },
        { 'meanings.0.antonyms': { $exists: false } },
      ],
    };
  }

  if (mode === 'relations-only') {
    // Phase 2: approved records missing synonyms/antonyms
    return {
      deletedAt: null,
      status: 'approved',
      $or: [
        { 'meanings.0.synonyms': { $exists: false } },
        { 'meanings.0.antonyms': { $exists: false } },
      ],
    };
  }

  if (mode === 'word-family') {
    // Phase 3: approved records missing wordFamily
    return {
      deletedAt: null,
      status: 'approved',
      $or: [
        { wordFamily: { $exists: false } },
        { wordFamily: { $size: 0 } },
      ],
    };
  }
}

// ──────────────────────────────────────────
// 7. PROCESS BATCH
// ──────────────────────────────────────────

async function processFullEnrichBatch(db, batch, batchIndex, total) {
  const label = `Batch ${batchIndex} (${batch.length} items)`;
  console.log(`\n📦 ${label} — full enrich`);

  const inputStr = JSON.stringify(
    batch.map(doc => ({
      id: doc._id.toString(),
      text: doc.text,
      normalizedText: doc.normalizedText || doc.text,
      existingMeaningVi: doc.meanings?.[0]?.meaningVi || '',
      existingMeaningEn: doc.meanings?.[0]?.meaningEn || '',
      existingExample:   doc.meanings?.[0]?.examples?.[0]?.exampleEn || '',
      existingLevel:     doc.level || '',
      existingPos:       doc.partOfSpeech || '',
    }))
  );

  const userContent = `${FULL_ENRICH_SCHEMA}\n\nVocabulary items:\n${inputStr}`;

  let aiResult;
  try {
    aiResult = await callAI(FULL_ENRICH_SYSTEM, userContent);
  } catch (err) {
    console.error(`  ❌ AI call failed for ${label}: ${err.message}`);
    for (const doc of batch) {
      appendReport({ mode, status: 'ai-error', id: doc._id.toString(), text: doc.text, error: err.message });
    }
    return { success: 0, failed: batch.length };
  }

  const items = aiResult?.items || [];
  let success = 0, failed = 0;

  for (const item of items) {
    const errors = validateItem(item);
    if (errors.length > 0) {
      console.warn(`  ⚠️  Validation failed [${item.text}]: ${errors.join(', ')}`);
      appendReport({ mode, status: 'validation-failed', id: item.id, text: item.text, errors });
      failed++;
      continue;
    }

    if (DRY_RUN) {
      console.log(`  [DRY] Would update: ${item.text}`);
      success++;
      continue;
    }

    try {
      const patch = mapToVocabularyPatch(item);
      await db.collection('vocabularies').updateOne(
        { _id: new ObjectId(item.id) },
        { $set: patch }
      );
      success++;
    } catch (err) {
      console.error(`  ❌ DB write failed [${item.text}]: ${err.message}`);
      appendReport({ mode, status: 'db-error', id: item.id, text: item.text, error: err.message });
      failed++;
    }
  }

  // Items returned by AI but not in batch (should not happen, but guard)
  const missingCount = batch.length - items.length;
  if (missingCount > 0) {
    console.warn(`  ⚠️  AI returned ${items.length}/${batch.length} items`);
    failed += missingCount;
  }

  console.log(`  ✅ success=${success}, failed=${failed}`);
  return { success, failed };
}

async function processRelationsOnlyBatch(db, batch, batchIndex) {
  console.log(`\n📦 Batch ${batchIndex} (${batch.length} items) — relations only`);

  const inputStr = JSON.stringify(
    batch.map(doc => ({
      id: doc._id.toString(),
      text: doc.text,
      meaningEn: doc.meanings?.[0]?.meaningEn || '',
      meaningVi: doc.meanings?.[0]?.meaningVi || '',
    }))
  );

  const userContent = `Return JSON exactly:
{
  "items": [
    {
      "id": "string",
      "synonyms": ["string"],
      "antonyms": ["string"],
      "wordFamily": ["string"]
    }
  ]
}

Vocabulary items:
${inputStr}`;

  let aiResult;
  try {
    aiResult = await callAI(RELATIONS_ONLY_SYSTEM, userContent);
  } catch (err) {
    console.error(`  ❌ AI call failed: ${err.message}`);
    for (const doc of batch) {
      appendReport({ mode, status: 'ai-error', id: doc._id.toString(), text: doc.text, error: err.message });
    }
    return { success: 0, failed: batch.length };
  }

  const items = aiResult?.items || [];
  let success = 0, failed = 0;

  for (const item of items) {
    const errors = validateRelationsOnlyItem(item);
    if (errors.length > 0) {
      console.warn(`  ⚠️  Validation [${item.id}]: ${errors.join(', ')}`);
      appendReport({ mode, status: 'validation-failed', id: item.id, errors });
      failed++;
      continue;
    }

    if (DRY_RUN) {
      console.log(`  [DRY] Would update relations: ${item.id}`);
      success++;
      continue;
    }

    try {
      await db.collection('vocabularies').updateOne(
        { _id: new ObjectId(item.id) },
        {
          $set: {
            'meanings.0.synonyms': normalizeWordList(item.synonyms),
            'meanings.0.antonyms': normalizeWordList(item.antonyms),
            ...(item.wordFamily?.length > 0
              ? { wordFamily: normalizeWordList(item.wordFamily) }
              : {}),
            enrichedAt: new Date(),
            enrichedBy: ENRICHED_BY,
          },
        }
      );
      success++;
    } catch (err) {
      console.error(`  ❌ DB write [${item.id}]: ${err.message}`);
      appendReport({ mode, status: 'db-error', id: item.id, error: err.message });
      failed++;
    }
  }

  console.log(`  ✅ success=${success}, failed=${failed}`);
  return { success, failed };
}

async function processWordFamilyBatch(db, batch, batchIndex) {
  console.log(`\n📦 Batch ${batchIndex} (${batch.length} items) — word family`);

  const inputStr = JSON.stringify(
    batch.map(doc => ({
      id: doc._id.toString(),
      text: doc.text,
      partOfSpeech: doc.partOfSpeech || '',
    }))
  );

  const userContent = `Return JSON exactly:
{
  "items": [
    {
      "id": "string",
      "wordFamily": ["string"]
    }
  ]
}

Vocabulary items:
${inputStr}`;

  let aiResult;
  try {
    aiResult = await callAI(WORD_FAMILY_SYSTEM, userContent);
  } catch (err) {
    console.error(`  ❌ AI call failed: ${err.message}`);
    return { success: 0, failed: batch.length };
  }

  const items = aiResult?.items || [];
  let success = 0, failed = 0;

  for (const item of items) {
    if (!item.id) { failed++; continue; }

    if (DRY_RUN) {
      console.log(`  [DRY] Would set wordFamily: ${item.id} → [${(item.wordFamily || []).join(', ')}]`);
      success++;
      continue;
    }

    try {
      await db.collection('vocabularies').updateOne(
        { _id: new ObjectId(item.id) },
        { $set: { wordFamily: normalizeWordList(item.wordFamily || []) } }
      );
      success++;
    } catch (err) {
      console.error(`  ❌ DB write [${item.id}]: ${err.message}`);
      failed++;
    }
  }

  console.log(`  ✅ success=${success}, failed=${failed}`);
  return { success, failed };
}

// ──────────────────────────────────────────
// 8. WORKER POOL
// ──────────────────────────────────────────

async function runWithWorkers(db, allDocs, processFn) {
  const totalBatches = Math.ceil(allDocs.length / BATCH_SIZE);
  let totalSuccess = 0;
  let totalFailed  = 0;
  let completedBatches = 0;

  // Build queue of batches upfront
  let batchIndex = 0;
  const queue = [];
  for (let i = 0; i < allDocs.length; i += BATCH_SIZE) {
    queue.push({ batch: allDocs.slice(i, i + BATCH_SIZE), idx: ++batchIndex });
  }

  console.log(`\n⚡ Starting ${WORKERS} parallel workers — ${totalBatches} batches total (${BATCH_SIZE} words/batch)`);
  console.log('   Both workers call the LLM API concurrently and independently.\n');

  async function worker(workerId) {
    while (queue.length > 0) {
      const job = queue.shift();
      if (!job) break;

      const pct = (((completedBatches) / totalBatches) * 100).toFixed(1);
      console.log(`\n🔧 [W${workerId}] Batch ${job.idx}/${totalBatches} (${pct}% done so far) — ${job.batch.length} words`);

      const t0 = Date.now();
      const result = await processFn(db, job.batch, job.idx);
      const elapsed = ((Date.now() - t0) / 1000).toFixed(1);

      // JS is single-threaded so these increments are safe
      totalSuccess     += result.success;
      totalFailed      += result.failed;
      completedBatches += 1;

      console.log(`   [W${workerId}] ✅ done in ${elapsed}s — success=${result.success} failed=${result.failed} | running total: ${totalSuccess} updated`);

      // Brief cooldown between batches per worker to be kind to the API
      await sleep(500);
    }
    console.log(`\n   [W${workerId}] 🏁 Worker finished.`);
  }

  // Launch both workers simultaneously — they pull from the shared queue concurrently
  await Promise.all(
    Array.from({ length: WORKERS }, (_, i) => worker(i + 1))
  );

  return { totalSuccess, totalFailed };
}

// ──────────────────────────────────────────
// 9. PREFLIGHT — LLM PING
// ──────────────────────────────────────────

/**
 * Send a minimal "hello" message to the LLM API.
 * Verifies the API key, base URL, and model are all reachable
 * before the script touches any database records.
 * Exits with code 1 if the ping fails.
 */
async function preflightLLMPing() {
  console.log('\n🏓 Preflight: pinging LLM API...');
  console.log(`   Endpoint : ${BASE_URL}/chat/completions`);
  console.log(`   Model    : ${MODEL}`);

  const t0 = Date.now();
  try {
    const resp = await fetch(`${BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${API_KEY}`,
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          { role: 'user', content: 'Reply with exactly one word: hello' },
        ],
        max_tokens: 10,
        temperature: 0,
      }),
      signal: AbortSignal.timeout(30_000),
    });

    if (!resp.ok) {
      const body = await resp.text();
      throw new Error(`HTTP ${resp.status} — ${body.slice(0, 300)}`);
    }

    const data = await resp.json();
    const reply = data.choices?.[0]?.message?.content?.trim() || '';
    const latency = Date.now() - t0;

    if (!reply) throw new Error('LLM returned empty response');

    console.log(`✅ LLM ping OK — reply: "${reply}" — latency: ${latency}ms`);
    console.log(`   Provider : ${ENRICHED_BY}`);
  } catch (err) {
    console.error(`\n❌ LLM preflight ping FAILED: ${err.message}`);
    console.error('   Script will NOT proceed. Fix the API connection and retry.');
    process.exit(1);
  }
}

// ──────────────────────────────────────────
// 10. MAIN
// ──────────────────────────────────────────

async function main() {
  // ── Guard: check required env vars ──
  if (!MONGODB_URI) {
    console.error('❌ MONGODB_URI not set in .env');
    process.exit(1);
  }
  if (!API_KEY) {
    console.error('❌ NINEROUTER_API_KEY not set in .env');
    process.exit(1);
  }
  if (!BASE_URL) {
    console.error('❌ NINEROUTER_BASE_URL not set in .env');
    process.exit(1);
  }

  // ── Phase 0: Preflight LLM ping (must succeed before touching DB) ──
  await preflightLLMPing();

  console.log('\n🔗 Connecting to MongoDB...');
  const client = new MongoClient(MONGODB_URI);
  await client.connect();
  const db = client.db();
  console.log('✅ Connected.');

  const query = getQueryForMode(mode);
  const projection = {
    _id: 1, text: 1, normalizedText: 1, meanings: 1, partOfSpeech: 1,
    forms: 1, level: 1, topics: 1, wordFamily: 1, status: 1,
  };

  console.log(`\n🔍 Querying documents for mode="${mode}"...`);
  const docs = await db.collection('vocabularies').find(query, { projection }).toArray();
  console.log(`📊 Found ${docs.length} documents to process.`);

  if (docs.length === 0) {
    console.log('🎉 Nothing to do! Database is already up to date.');
    await client.close();
    return;
  }

  const startTime = Date.now();

  let processFn;
  if (mode === 'fix-and-relations')  processFn = processFullEnrichBatch;
  else if (mode === 'relations-only') processFn = processRelationsOnlyBatch;
  else if (mode === 'word-family')    processFn = processWordFamilyBatch;

  const { totalSuccess, totalFailed } = await runWithWorkers(db, docs, processFn);

  const elapsed = ((Date.now() - startTime) / 1000 / 60).toFixed(1);

  console.log('\n' + '═'.repeat(60));
  console.log('🏁 ENRICHMENT COMPLETE');
  console.log(`   Mode:    ${mode}`);
  console.log(`   Success: ${totalSuccess}`);
  console.log(`   Failed:  ${totalFailed}`);
  console.log(`   Total:   ${docs.length}`);
  console.log(`   Time:    ${elapsed} minutes`);
  console.log(`   Report:  ${REPORT_FILE}`);
  console.log('═'.repeat(60));

  await client.close();
}

main().catch(err => {
  console.error('💥 Fatal error:', err);
  process.exit(1);
});
