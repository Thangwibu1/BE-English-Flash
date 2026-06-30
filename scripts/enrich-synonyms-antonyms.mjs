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

const MONGODB_URI = process.env.MONGODB_URI;

// ── Dual provider config ──
// Worker 1 → DeepSeek (via NINEROUTER_*)
// Worker 2 → 9Router  (via NINEROUTER_9R_*)
const PROVIDERS = [
  {
    name:      'DeepSeek (NINEROUTER)',
    apiKey:    process.env.NINEROUTER_API_KEY,
    baseUrl:   process.env.NINEROUTER_BASE_URL,
    model:     process.env.NINEROUTER_MODEL    || 'deepseek-v4-flash',
    enrichedBy:'ai:deepseek:deepseek-v4-flash',
  },
  {
    name:      '9Router (ngocthang.io.vn)',
    apiKey:    process.env.NINEROUTER_9R_API_KEY,
    baseUrl:   process.env.NINEROUTER_9R_BASE_URL,
    model:     process.env.NINEROUTER_9R_MODEL || 'my-combo',
    enrichedBy:'ai:9router:my-combo',
  },
];

const BATCH_SIZE  = 30;  // words per AI call — reduced from 80 to prevent output truncation/JSON parse errors
const RETRY_MAX   = 3;   // per-batch retries on parse/network failure
const REPORT_FILE = 'enrichment_report_synonyms.jsonl';

// Parse CLI args
const mode = (process.argv.find(a => a.startsWith('--mode=')) || '--mode=fix-and-relations').split('=')[1];
const DRY_RUN = process.argv.includes('--dry-run');

if (!['fix-and-relations', 'relations-only', 'word-family'].includes(mode)) {
  console.error('❌ Invalid --mode. Use: fix-and-relations | relations-only | word-family');
  process.exit(1);
}

console.log(`\n🚀 Mode: ${mode}${DRY_RUN ? ' [DRY RUN]' : ''}`);
console.log(`   Batch size: ${BATCH_SIZE}, Workers: 2 (DeepSeek + 9Router)`);

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
  if (item.status !== undefined && item.status !== 'approved')           errors.push('status must be approved');
  if (item.needsReview !== undefined && item.needsReview !== false)       errors.push('needsReview must be false');
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
    enrichedBy: item._enrichedBy || 'ai:9router:deepseek-v4-flash',

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

async function callAI(provider, systemPrompt, userContent, attempt = 1) {
  const url = `${provider.baseUrl}/chat/completions`;
  const body = JSON.stringify({
    model: provider.model,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user',   content: userContent  },
    ],
    temperature: 0.2,
    max_tokens: 8000,
    stream: false, // explicitly disable streaming
  });

  try {
    const resp = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${provider.apiKey}`,
      },
      body,
      signal: AbortSignal.timeout(120_000), // 2 min timeout
    });

    if (!resp.ok) {
      const text = await resp.text();
      throw new Error(`HTTP ${resp.status}: ${text.slice(0, 200)}`);
    }

    const rawText = await resp.text();

    // Handle SSE streaming format (some providers stream even with stream:false)
    let content = '';
    if (rawText.includes('data: ')) {
      // SSE format — concatenate all delta content
      const lines = rawText.split('\n');
      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        const chunk = line.slice('data: '.length).trim();
        if (chunk === '[DONE]') break;
        try {
          const parsed = JSON.parse(chunk);
          const delta = parsed.choices?.[0]?.delta?.content;
          if (delta) content += delta;
        } catch { /* skip malformed chunks */ }
      }
    } else {
      // Standard JSON format
      const data = JSON.parse(rawText);
      content = data.choices?.[0]?.message?.content || '';
    }

    // Strip markdown fences if AI adds them anyway
    const cleaned = content.replace(/^```(?:json)?\n?/m, '').replace(/```$/m, '').trim();
    return JSON.parse(cleaned);
  } catch (err) {
    if (attempt < RETRY_MAX) {
      console.warn(`  ⚠️  Retry ${attempt}/${RETRY_MAX} [${provider.name}]: ${err.message}`);
      await sleep(3000 * attempt);
      return callAI(provider, systemPrompt, userContent, attempt + 1);
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

async function processFullEnrichBatch(db, provider, batch, batchIndex) {
  const label = `Batch ${batchIndex} (${batch.length} items)`;
  console.log(`\n📦 ${label} — full enrich [${provider.name}]`);

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
    aiResult = await callAI(provider, FULL_ENRICH_SYSTEM, userContent);
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
    // Tag which provider enriched this item
    item._enrichedBy = provider.enrichedBy;

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

async function processRelationsOnlyBatch(db, provider, batch, batchIndex) {
  console.log(`\n📦 Batch ${batchIndex} (${batch.length} items) — relations only [${provider.name}]`);

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
    aiResult = await callAI(provider, RELATIONS_ONLY_SYSTEM, userContent);
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
            enrichedBy: provider.enrichedBy,
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

async function processWordFamilyBatch(db, provider, batch, batchIndex) {
  console.log(`\n📦 Batch ${batchIndex} (${batch.length} items) — word family [${provider.name}]`);

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
    aiResult = await callAI(provider, WORD_FAMILY_SYSTEM, userContent);
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

  console.log(`\n⚡ Starting 2 parallel workers — ${totalBatches} batches total (${BATCH_SIZE} words/batch)`);
  console.log(`   Worker 1 → ${PROVIDERS[0].name}`);
  console.log(`   Worker 2 → ${PROVIDERS[1].name}\n`);

  // Each worker is permanently bound to its own provider
  async function worker(workerId) {
    const provider = PROVIDERS[workerId - 1]; // W1→PROVIDERS[0], W2→PROVIDERS[1]
    while (queue.length > 0) {
      const job = queue.shift();
      if (!job) break;

      const pct = ((completedBatches / totalBatches) * 100).toFixed(1);
      console.log(`\n🔧 [W${workerId}:${provider.name}] Batch ${job.idx}/${totalBatches} (${pct}% done) — ${job.batch.length} words`);

      const t0 = Date.now();
      const result = await processFn(db, provider, job.batch, job.idx);
      const elapsed = ((Date.now() - t0) / 1000).toFixed(1);

      totalSuccess     += result.success;
      totalFailed      += result.failed;
      completedBatches += 1;

      console.log(`   [W${workerId}] ✅ done in ${elapsed}s — +${result.success} updated | running total: ${totalSuccess}`);

      await sleep(500);
    }
    console.log(`\n   [W${workerId}] 🏁 Worker finished.`);
  }

  // Launch both workers simultaneously — each uses its own AI provider
  await Promise.all([worker(1), worker(2)]);

  return { totalSuccess, totalFailed };
}

// ──────────────────────────────────────────
// 9. PREFLIGHT — LLM PING
// ──────────────────────────────────────────

/**
 * Ping both AI providers simultaneously.
 * Both must respond before any DB work starts.
 */
async function preflightBothProviders() {
  console.log('\n🏓 Preflight: pinging BOTH providers simultaneously...');

  async function pingOne(provider) {
    console.log(`   ► [${provider.name}] ${provider.baseUrl} (model: ${provider.model})`);
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

      // Read raw text to handle both SSE and standard JSON
      const rawText = await resp.text();
      let reply = '';
      if (rawText.includes('data: ')) {
        for (const line of rawText.split('\n')) {
          if (!line.startsWith('data: ')) continue;
          const chunk = line.slice('data: '.length).trim();
          if (chunk === '[DONE]') break;
          try { const d = JSON.parse(chunk); const delta = d.choices?.[0]?.delta?.content; if (delta) reply += delta; } catch {}
        }
      } else {
        try { reply = JSON.parse(rawText).choices?.[0]?.message?.content?.trim() || ''; } catch {}
      }
      // Accept any HTTP 200 as valid ping
      console.log(`   ✅ [${provider.name}] OK — reply: "${reply || '(response received)'}" — ${latency}ms`);
      return { ok: true };
    } catch (err) {
      console.error(`   ❌ [${provider.name}] FAILED: ${err.message}`);
      return { ok: false, error: err.message };
    }
  }

  // Ping both at the same time
  const [r1, r2] = await Promise.all([
    pingOne(PROVIDERS[0]),
    pingOne(PROVIDERS[1]),
  ]);

  if (!r1.ok || !r2.ok) {
    console.error('\n❌ One or more providers failed preflight ping.');
    console.error('   Fix the failing provider before running the enrichment job.');
    process.exit(1);
  }

  console.log('\n✅ Both providers are reachable and responding!');
}

// ──────────────────────────────────────────
// 10. MAIN
// ──────────────────────────────────────────

async function main() {
  // ── Guard: check both providers have credentials ──
  for (const p of PROVIDERS) {
    if (!p.apiKey || !p.baseUrl) {
      console.error(`\n❌ Missing credentials for provider: ${p.name}`);
      console.error('   Check NINEROUTER_* and NINEROUTER_9R_* in .env');
      process.exit(1);
    }
  }

  // ── Phase 0: Preflight — ping BOTH providers before touching DB ──
  await preflightBothProviders();

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
