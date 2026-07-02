import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '../.env') });

const mongoUri = process.env.MONGODB_URI;
const apiKey = process.env.NINEROUTER_9R_API_KEY;
const baseUrl = process.env.NINEROUTER_9R_BASE_URL || 'https://aishop24h.com/v1';
const modelName = process.env.NINEROUTER_9R_MODEL || 'z-ai/glm-5.2';

if (!mongoUri || !apiKey) {
  console.error('❌ MONGODB_URI or NINEROUTER_9R_API_KEY is missing from .env!');
  process.exit(1);
}

function slugify(text) {
  return text
    .toString()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // remove accents
    .replace(/[^a-z0-9 -]/g, '') // remove invalid chars
    .replace(/\s+/g, '-') // collapse whitespace and replace by -
    .replace(/-+/g, '-') // collapse dashes
    .trim();
}

function safeParseJson(input) {
  try {
    return JSON.parse(input);
  } catch {
    const cleaned = input
      .replace(/^```json/i, '')
      .replace(/^```/i, '')
      .replace(/```$/i, '')
      .trim();
    return JSON.parse(cleaned);
  }
}

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function run() {
  console.log('Connecting to MongoDB...');
  await mongoose.connect(mongoUri);
  console.log('Connected!');

  const db = mongoose.connection.db;
  const vocabCollection = db.collection('vocabularies');
  const topicsCollection = db.collection('topics');
  const decksCollection = db.collection('flashcarddecks');
  const cardsCollection = db.collection('flashcardcards');
  const usersCollection = db.collection('users');

  // 1. Get Admin User to own the decks
  const adminUser = await usersCollection.findOne({ role: 'admin', deletedAt: null });
  const systemOwnerId = adminUser ? adminUser._id : (await usersCollection.findOne({ deletedAt: null }))?._id;
  if (!systemOwnerId) {
    console.error('❌ No users found in database to own flashcard decks!');
    await mongoose.disconnect();
    return;
  }
  console.log(`Decks will be owned by user ID: ${systemOwnerId}`);

  // 2. Load all topics into memory
  const rawTopics = await topicsCollection.find({ deletedAt: null }).toArray();
  const topicsMap = new Map(); // Name (lowercase) -> ID
  rawTopics.forEach(t => topicsMap.set(t.name.toLowerCase().trim(), t._id));
  const existingTopicNames = rawTopics.map(t => t.name);
  console.log(`Loaded ${topicsMap.size} existing topics.`);

  // Helper to get or create topic
  async function getOrCreateTopicId(topicName) {
    const trimmed = topicName.trim();
    const key = trimmed.toLowerCase();
    if (topicsMap.has(key)) {
      return topicsMap.get(key);
    }
    
    // Create new topic
    const slug = slugify(trimmed);
    const doc = {
      name: trimmed,
      slug,
      description: `Automatically created topic for ${trimmed}`,
      deletedAt: null,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    try {
      const result = await topicsCollection.insertOne(doc);
      topicsMap.set(key, result.insertedId);
      console.log(`🆕 Created new topic: "${trimmed}" (slug: ${slug})`);
      return result.insertedId;
    } catch (err) {
      // Handle potential race condition if slug already exists
      const existing = await topicsCollection.findOne({ slug });
      if (existing) {
        topicsMap.set(key, existing._id);
        return existing._id;
      }
      throw err;
    }
  }

  // 3. Find all approved words that DO NOT have topics
  const unclassifiedWords = await vocabCollection.find({
    status: 'approved',
    deletedAt: null,
    $or: [
      { topicIds: { $exists: false } },
      { topicIds: { $size: 0 } },
      { topicIds: null }
    ]
  }).project({ text: 1, meanings: 1 }).toArray();

  console.log(`Found ${unclassifiedWords.length} vocabularies needing classification.`);

  if (unclassifiedWords.length > 0) {
    // 4. Batch words and classify using GLM model (concurrency = 30, batchSize = 40)
    const batchSize = 40;
    const batches = [];
    for (let i = 0; i < unclassifiedWords.length; i += batchSize) {
      batches.push(unclassifiedWords.slice(i, i + batchSize));
    }

    console.log(`Split into ${batches.length} batches of up to ${batchSize} words.`);
    console.log(`Starting classification with concurrency of 30 using GLM model...`);

    let completedBatches = 0;
    const concurrency = 30;

    async function processBatch(batch, batchIdx) {
      const wordListText = batch.map((w, index) => `${index + 1}. "${w.text}" (Meaning: ${w.meanings?.[0]?.meaningVi || 'unknown'})`).join('\n');
      
      const prompt = `You are a professional lexicographer. Classify the following list of English words into one or more categories (topics).

Existing categories list:
${existingTopicNames.map(name => `- ${name}`).join('\n')}

For each word, choose the most appropriate category or categories from the list above. 
If none of the existing categories fit a word at all, you may suggest a new general category name (keep it simple and in English, e.g., "Arts", "History", "Sports", "Science").

Words to classify:
${wordListText}

Return JSON shape:
{
  "items": [
    { "word": "word text here", "topics": ["Category1", "Category2"] }
  ]
}`;

      let attempts = 5;
      let responseJson = null;
      let backoffTime = 2000;

      while (attempts > 0) {
        try {
          const res = await fetch(`${baseUrl}/chat/completions`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify({
              model: modelName,
              stream: false,
              response_format: { type: "json_object" },
              messages: [
                {
                  role: 'system',
                  content: 'You are an English vocabulary classification assistant. Return only valid JSON.'
                },
                {
                  role: 'user',
                  content: prompt
                }
              ]
            })
          });

          if (res.status === 429) {
            console.warn(`⚠️ Rate limited (429) on batch ${batchIdx + 1}. Retrying in ${backoffTime / 1000}s...`);
            await delay(backoffTime);
            backoffTime *= 2;
            attempts--;
            continue;
          }

          if (!res.ok) {
            throw new Error(`HTTP Error ${res.status}: ${res.statusText}`);
          }

          const data = await res.json();
          const textResponse = data.choices?.[0]?.message?.content?.trim();
          if (!textResponse) throw new Error('Empty response from AI model');

          responseJson = safeParseJson(textResponse);
          break; // Success
        } catch (err) {
          attempts--;
          console.warn(`⚠️ Batch ${batchIdx + 1} error (Attempts remaining: ${attempts}). Error: ${err.message}`);
          if (attempts > 0) {
            await delay(2000);
          } else {
            console.error(`❌ Batch ${batchIdx + 1} failed permanently!`);
          }
        }
      }

      if (responseJson && Array.isArray(responseJson.items)) {
        // Apply topics to database
        const bulkOps = [];
        for (const item of responseJson.items) {
          const vocabItem = batch.find(w => w.text.toLowerCase() === item.word.toLowerCase());
          if (!vocabItem || !Array.isArray(item.topics)) continue;

          const topicIds = [];
          for (const tName of item.topics) {
            if (!tName || typeof tName !== 'string') continue;
            try {
              const tId = await getOrCreateTopicId(tName);
              topicIds.push(tId);
            } catch (err) {
              console.error(`Error resolving topic "${tName}":`, err.message);
            }
          }

          if (topicIds.length > 0) {
            bulkOps.push({
              updateOne: {
                filter: { _id: vocabItem._id },
                update: { $set: { topicIds, updatedAt: new Date() } }
              }
            });
          }
        }

        if (bulkOps.length > 0) {
          await vocabCollection.bulkWrite(bulkOps);
        }
      }

      completedBatches++;
      console.log(`[Progress] ${completedBatches}/${batches.length} batches completed (${Math.round((completedBatches / batches.length) * 100)}%)`);
      await delay(500);
    }

    // Promise Pool for parallel execution
    let currentIdx = 0;
    const pool = Array.from({ length: concurrency }, async () => {
      while (currentIdx < batches.length) {
        const idx = currentIdx++;
        if (idx >= batches.length) break;
        await processBatch(batches[idx], idx);
      }
    });
    await Promise.all(pool);
    console.log('✅ All vocabularies successfully classified!');
  } else {
    console.log('No new words to classify.');
  }

  // 5. Build Flashcard Decks by Topic & Level
  console.log('\n--- Building Flashcard Decks by Topic and Level ---');

  // Aggregate vocabulary details by topicId and level
  const vocabItems = await vocabCollection.find({
    status: 'approved',
    deletedAt: null,
    level: { $exists: true, $ne: null },
    topicIds: { $exists: true, $not: { $size: 0 } }
  }).project({ level: 1, topicIds: 1, text: 1, meanings: 1 }).toArray();

  console.log(`Grouping ${vocabItems.length} items by topic and level...`);

  // Pre-load all topics into a Map by ID string for fast lookup (no per-deck DB query)
  const topicsById = new Map();
  rawTopics.forEach(t => topicsById.set(t._id.toString(), t));

  // Map of "topicId_level" -> array of vocabulary item documents
  const groups = new Map();
  vocabItems.forEach(item => {
    item.topicIds.forEach(topicId => {
      const key = `${topicId.toString()}_${item.level}`;
      if (!groups.has(key)) {
        groups.set(key, []);
      }
      groups.get(key).push(item);
    });
  });

  console.log(`Found ${groups.size} unique Topic-Level combinations.`);
  console.log(`Building decks... (this will be fast with bulk insert)`);

  let decksCreated = 0;
  let cardsAdded = 0;
  let processed = 0;

  // Prepare all deck inserts in memory
  const deckDocs = [];
  const groupEntries = [...groups.entries()];

  for (const [key, itemsList] of groupEntries) {
    const [topicIdStr, level] = key.split('_');
    const topic = topicsById.get(topicIdStr);
    if (!topic) continue;

    const deckName = `${topic.name} - ${level}`;
    const deckDescription = `System flashcard deck for ${topic.name} at CEFR level ${level}`;

    deckDocs.push({
      key,
      deckDoc: {
        ownerId: systemOwnerId,
        name: deckName,
        description: deckDescription,
        visibility: 'public',
        status: 'active',
        cardCount: 0,
        sourceDeckId: null,
        deletedAt: null,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      itemsList
    });
  }

  // Bulk insert all decks at once
  if (deckDocs.length > 0) {
    const deckInsertResult = await decksCollection.insertMany(
      deckDocs.map(d => d.deckDoc),
      { ordered: false }
    );
    decksCreated = deckInsertResult.insertedCount;
    console.log(`✅ Created ${decksCreated} decks. Now inserting cards...`);

    // Build all cards in memory and bulk insert per deck
    const allCards = [];
    deckDocs.forEach((entry, i) => {
      const deckId = deckInsertResult.insertedIds[i];
      if (!deckId) return;

      // Deduplicate vocabs for this deck
      const uniqueMap = new Map();
      entry.itemsList.forEach(item => uniqueMap.set(item._id.toString(), item));

      let orderIndex = 0;
      for (const [vocabIdStr, vocab] of uniqueMap.entries()) {
        allCards.push({
          deckId,
          vocabularyId: new mongoose.Types.ObjectId(vocabIdStr),
          front: vocab.text || '',
          back: vocab.meanings?.[0]?.meaningVi || '',
          example: vocab.meanings?.[0]?.examples?.[0]?.exampleEn || '',
          orderIndex: orderIndex++,
          deletedAt: null,
          createdAt: new Date(),
          updatedAt: new Date()
        });
      }
    });

    console.log(`Prepared ${allCards.length} cards. Inserting in chunks...`);

    // Insert cards in chunks of 1000 to avoid memory issues
    const chunkSize = 1000;
    for (let i = 0; i < allCards.length; i += chunkSize) {
      const chunk = allCards.slice(i, i + chunkSize);
      await cardsCollection.insertMany(chunk, { ordered: false });
      cardsAdded += chunk.length;
      const pct = Math.round((i + chunk.length) / allCards.length * 100);
      console.log(`  [Cards] ${i + chunk.length}/${allCards.length} inserted (${pct}%)`);
    }

    // Update cardCount for each deck
    console.log(`Updating cardCount for each deck...`);
    const cardCountBulk = [];
    deckDocs.forEach((entry, i) => {
      const deckId = deckInsertResult.insertedIds[i];
      if (!deckId) return;
      const uniqueMap = new Map();
      entry.itemsList.forEach(item => uniqueMap.set(item._id.toString(), item));
      cardCountBulk.push({
        updateOne: {
          filter: { _id: deckId },
          update: { $set: { cardCount: uniqueMap.size } }
        }
      });
    });
    if (cardCountBulk.length > 0) {
      await decksCollection.bulkWrite(cardCountBulk);
    }
  }

  console.log(`\n✅ Flashcard decks sync completed!`);
  console.log(`- Decks created: ${decksCreated}`);
  console.log(`- Cards added: ${cardsAdded}`);

  await mongoose.disconnect();
  console.log('\nDisconnected from MongoDB.');
}

run().catch(console.error);
