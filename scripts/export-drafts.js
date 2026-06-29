/**
 * Export Draft Vocabularies
 * Connects to MongoDB and exports all documents from "vocabularies" collection
 * where status is "draft" into a JSON file.
 * Usage: node scripts/export-drafts.js
 */

const { MongoClient } = require('mongodb');
const fs = require('fs');
const path = require('path');

const MONGODB_URI = 'mongodb://root:lameojicomatkhau@coolify.be-learning.io.vn:2808/English?authSource=admin&directConnection=true';
const OUTPUT_PATH = path.resolve(__dirname, '../draft_vocabularies.json');

async function main() {
  console.log('Connecting to MongoDB...');
  const client = new MongoClient(MONGODB_URI);
  try {
    await client.connect();
    console.log('Connected successfully.');
    
    const db = client.db('English');
    const collection = db.collection('vocabularies');
    
    console.log('Querying draft vocabularies...');
    const drafts = await collection.find({ status: 'draft' }).toArray();
    
    console.log(`Found ${drafts.length} draft documents.`);
    
    fs.writeFileSync(OUTPUT_PATH, JSON.stringify(drafts, null, 2), 'utf8');
    console.log(`Successfully exported to: ${OUTPUT_PATH}`);
  } catch (err) {
    console.error('Error during export:', err);
  } finally {
    await client.close();
    console.log('Database connection closed.');
  }
}

main().catch(console.error);
