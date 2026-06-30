/**
 * Backup all vocabulary records to a timestamped backup collection.
 * Run this BEFORE any enrichment job to have a safe restore point.
 *
 * Usage:
 *   node scripts/backup-vocabularies.mjs
 *
 * Creates collection: vocabularies_backup_YYYYMMDD_HHMMSS
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

const MONGODB_URI = process.env.MONGODB_URI;
if (!MONGODB_URI) {
  console.error('❌ MONGODB_URI not set in .env');
  process.exit(1);
}

// ── Timestamp for collection name ──
function getTimestamp() {
  const now = new Date();
  const pad = n => String(n).padStart(2, '0');
  return `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
}

async function main() {
  const backupCollection = `vocabularies_backup_${getTimestamp()}`;

  console.log('\n🔗 Connecting to MongoDB...');
  const client = new MongoClient(MONGODB_URI);
  await client.connect();
  const db = client.db();
  console.log('✅ Connected.\n');

  // Count source documents
  const total = await db.collection('vocabularies').countDocuments({ deletedAt: null });
  console.log(`📊 Found ${total.toLocaleString()} vocabulary records to backup.`);
  console.log(`📦 Backup target collection: "${backupCollection}"\n`);

  // Check if backup collection already exists (safety)
  const existing = await db.listCollections({ name: backupCollection }).toArray();
  if (existing.length > 0) {
    console.warn(`⚠️  Collection "${backupCollection}" already exists. Aborting to prevent overwrite.`);
    await client.close();
    process.exit(1);
  }

  // Stream in batches of 1000 to avoid memory spikes
  const CHUNK = 1000;
  let copied = 0;
  const startTime = Date.now();

  console.log('🚀 Starting backup...\n');

  let skip = 0;
  while (true) {
    const docs = await db.collection('vocabularies')
      .find({})
      .skip(skip)
      .limit(CHUNK)
      .toArray();

    if (docs.length === 0) break;

    await db.collection(backupCollection).insertMany(docs, { ordered: false });
    copied += docs.length;
    skip += CHUNK;

    const pct = ((copied / total) * 100).toFixed(1);
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    process.stdout.write(`\r  ⏳ Copied ${copied.toLocaleString()}/${total.toLocaleString()} (${pct}%) — ${elapsed}s elapsed`);
  }

  const totalTime = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log('\n');

  // Create index on _id for fast lookup
  await db.collection(backupCollection).createIndex({ _id: 1 });
  await db.collection(backupCollection).createIndex({ normalizedText: 1 });

  // Verify count
  const backupCount = await db.collection(backupCollection).countDocuments();

  console.log('═'.repeat(60));
  console.log('✅ BACKUP COMPLETE');
  console.log(`   Source records : ${total.toLocaleString()}`);
  console.log(`   Backed up      : ${backupCount.toLocaleString()}`);
  console.log(`   Collection     : ${backupCollection}`);
  console.log(`   Time           : ${totalTime}s`);
  console.log(`\n💡 To restore: db.${backupCollection}.aggregate([{ $out: "vocabularies" }])`);
  console.log('═'.repeat(60));

  if (backupCount !== total) {
    console.warn(`\n⚠️  WARNING: count mismatch! Source=${total}, Backup=${backupCount}`);
  }

  await client.close();
}

main().catch(err => {
  console.error('💥 Fatal error:', err);
  process.exit(1);
});
