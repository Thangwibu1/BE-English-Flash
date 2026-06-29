/**
 * Approve All Drafts Script
 * Connects to MongoDB and updates the status of all vocabulary items
 * from "draft" to "approved".
 * Usage: node scripts/approve-all-drafts.mjs
 */

import mongoose from 'mongoose';

const MONGODB_URI = 'mongodb://root:lameojicomatkhau@coolify.be-learning.io.vn:2808/English?authSource=admin&directConnection=true';

const VocabularySchema = new mongoose.Schema(
  {
    status: {
      type: String,
      enum: ['draft', 'approved', 'rejected', 'archived'],
      default: 'draft',
    },
    deletedAt: { type: Date, default: null },
  },
  { collection: 'vocabularies' }
);

const VocabularyModel = mongoose.model('Vocabulary', VocabularySchema);

async function main() {
  console.log('Connecting to MongoDB...');
  await mongoose.connect(MONGODB_URI);
  console.log('Connected.');

  console.log('Updating all "draft" vocabularies to "approved"...');
  
  const result = await VocabularyModel.updateMany(
    { status: 'draft', deletedAt: null },
    { $set: { status: 'approved' } }
  );

  console.log('\n=== Update Complete ===');
  console.log(`Matched documents : ${result.matchedCount}`);
  console.log(`Updated documents : ${result.modifiedCount}`);

  await mongoose.disconnect();
  console.log('Disconnected from MongoDB.');
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
