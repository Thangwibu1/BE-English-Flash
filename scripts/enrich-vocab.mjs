/**
 * Vocab Seed Enrichment Script
 * Connects to Google Translate and Free Dictionary APIs to enrich
 * draft vocabularies from draft_vocabularies.json.
 * Writes output progressively to enriched_vocabularies.jsonl,
 * failed_vocabularies.jsonl, and enrichment_report.json.
 * Supports resume / caching.
 * Usage: node scripts/enrich-vocab.mjs
 */

import fs from 'fs';
import path from 'path';
import axios from 'axios';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Config
const SOURCE_PATH = path.resolve(__dirname, '../draft_vocabularies.json');
const ENRICHED_PATH = path.resolve(__dirname, '../enriched_vocabularies.jsonl');
const FAILED_PATH = path.resolve(__dirname, '../failed_vocabularies.jsonl');
const REPORT_PATH = path.resolve(__dirname, '../enrichment_report.json');

const CONCURRENCY = 5;
const REQUEST_DELAY_MS = 100; // delay between starting batches

const functionWords = new Set([
  'the', 'a', 'an', 'to', 'of', 'in', 'on', 'at', 'and', 'or', 'but', 'is', 'are', 'was', 'were',
  'be', 'been', 'have', 'has', 'had', 'do', 'does', 'did', 'this', 'that', 'it', 'you', 'he', 'she', 'they',
  'i', 'we', 'my', 'your', 'his', 'her', 'their', 'our', 'us', 'him', 'them', 'me', 'who', 'whom', 'which',
  'what', 'whose', 'why', 'how', 'if', 'then', 'else', 'for', 'with', 'about', 'by', 'from', 'up', 'down',
  'out', 'over', 'under', 'again', 'further', 'once', 'here', 'there', 'when', 'where', 'all', 'any', 'both',
  'each', 'few', 'more', 'most', 'other', 'some', 'such', 'no', 'nor', 'not', 'only', 'own', 'same', 'so',
  'than', 'too', 'very', 's', 't', 'can', 'will', 'just', 'should', 'now'
]);

// Helper: Translate text using Google Translate GTX endpoint
async function translate(text, sl = 'en', tl = 'vi', retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      const res = await axios.get('https://translate.googleapis.com/translate_a/single', {
        params: { client: 'gtx', sl, tl, dt: 't', q: text },
        timeout: 5000
      });
      if (res.data && res.data[0]) {
        return res.data[0].map(x => x[0]).join('').trim();
      }
    } catch (e) {
      if (e.response?.status === 429) {
        const delay = Math.pow(2, i) * 1000;
        console.warn(`[Translate] Rate limited (429). Retrying in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      } else {
        console.warn(`[Translate] Error: ${e.message}. Retrying...`);
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }
  }
  throw new Error(`Failed to translate text after ${retries} retries.`);
}

// Helper: Fetch dictionary info
async function fetchDict(word, retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      const res = await axios.get(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`, {
        timeout: 5000
      });
      return res.data;
    } catch (e) {
      if (e.response?.status === 404) {
        return null; // Word not found
      }
      if (e.response?.status === 429) {
        const delay = Math.pow(2, i) * 1000;
        console.warn(`[Dict] Rate limited (429) for "${word}". Retrying in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      } else {
        console.warn(`[Dict] Error for "${word}": ${e.message}. Retrying...`);
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }
  }
  return null; // Return null if all retries fail
}

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function run() {
  const processedIds = new Set();
  
  if (fs.existsSync(ENRICHED_PATH)) {
    const content = fs.readFileSync(ENRICHED_PATH, 'utf8');
    content.split('\n').forEach(line => {
      const trimmed = line.trim();
      if (trimmed) {
        try {
          const obj = JSON.parse(trimmed);
          processedIds.add(obj.vocabularyId);
        } catch {}
      }
    });
  }

  if (fs.existsSync(FAILED_PATH)) {
    const content = fs.readFileSync(FAILED_PATH, 'utf8');
    content.split('\n').forEach(line => {
      const trimmed = line.trim();
      if (trimmed) {
        try {
          const obj = JSON.parse(trimmed);
          processedIds.add(obj.vocabularyId);
        } catch {}
      }
    });
  }

  console.log(`Loaded ${processedIds.size} already processed records.`);

  if (!fs.existsSync(SOURCE_PATH)) {
    console.error(`Source file not found at: ${SOURCE_PATH}`);
    process.exit(1);
  }
  
  console.log('Loading source draft vocabularies...');
  const sourceData = JSON.parse(fs.readFileSync(SOURCE_PATH, 'utf8'));
  console.log(`Loaded ${sourceData.length} records from source.`);

  const toProcess = sourceData.filter(x => !processedIds.has(x._id));
  console.log(`Remaining records to process: ${toProcess.length}`);

  let approvedCount = 0;
  let draftCount = 0;
  let rejectedCount = 0;
  let failedCount = 0;

  if (fs.existsSync(REPORT_PATH)) {
    try {
      const report = JSON.parse(fs.readFileSync(REPORT_PATH, 'utf8'));
      approvedCount = report.approved || 0;
      draftCount = report.draftNeedsReview || 0;
      rejectedCount = report.rejected || 0;
      failedCount = report.failed || 0;
    } catch {}
  }

  const writeReport = () => {
    const report = {
      total: sourceData.length,
      approved: approvedCount,
      draftNeedsReview: draftCount,
      rejected: rejectedCount,
      failed: failedCount
    };
    fs.writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2), 'utf8');
  };

  const processItem = async (item) => {
    const word = item.text;
    const vocabularyId = item._id;
    
    try {
      const dictData = await fetchDict(word);
      
      if (dictData && dictData.length > 0) {
        let definitionEn = '';
        let exampleEn = '';
        let partOfSpeech = 'unknown';

        for (const entry of dictData) {
          for (const meaning of entry.meanings || []) {
            if (meaning.partOfSpeech) {
              partOfSpeech = meaning.partOfSpeech;
            }
            for (const def of meaning.definitions || []) {
              if (!definitionEn) {
                definitionEn = def.definition;
              }
              if (def.example && !exampleEn) {
                exampleEn = def.example;
              }
            }
          }
        }

        if (!definitionEn) {
          definitionEn = `The word "${word}"`;
        }
        
        if (!exampleEn) {
          exampleEn = `We studied the word "${word}".`;
        }

        const meaningVi = await translate(definitionEn);
        const exampleVi = await translate(exampleEn);

        const forms = item.forms || [{ formText: word, normalizedFormText: word.toLowerCase() }];
        
        const isFunc = functionWords.has(word.toLowerCase());
        const topics = isFunc ? ["Grammar", "Daily Life"] : ["Daily Life"];
        const autoHighlight = !isFunc;

        const enrichedObj = {
          vocabularyId,
          text: word,
          normalizedText: item.normalizedText,
          type: item.type || 'single_word',
          level: item.level || 'A1',
          partOfSpeech,
          meanings: [
            {
              meaningVi,
              meaningEn: definitionEn,
              examples: [{ exampleEn, exampleVi }]
            }
          ],
          forms,
          topics,
          autoHighlight,
          status: 'approved',
          needsReview: false,
          qualityScore: 0.95,
          qualityNotes: [],
          enrichedBy: 'ai'
        };

        fs.appendFileSync(ENRICHED_PATH, JSON.stringify(enrichedObj) + '\n', 'utf8');
        approvedCount++;
      } else {
        const meaningVi = await translate(word);
        
        const fallbackObj = {
          vocabularyId,
          text: word,
          normalizedText: item.normalizedText,
          type: item.type || 'single_word',
          level: item.level || 'A1',
          partOfSpeech: 'unknown',
          meanings: [
            {
              meaningVi: meaningVi || `[Draft] ${word}`,
              meaningEn: `[Draft] definition for ${word}`,
              examples: [{
                exampleEn: `Example for "${word}".`,
                exampleVi: `Ví dụ cho từ "${word}".`
              }]
            }
          ],
          forms: item.forms || [{ formText: word, normalizedFormText: word.toLowerCase() }],
          topics: ["Daily Life"],
          autoHighlight: true,
          status: 'draft',
          needsReview: true,
          qualityScore: 0.5,
          qualityNotes: ["DICTIONARY_NOT_FOUND"],
          enrichedBy: 'ai'
        };

        fs.appendFileSync(ENRICHED_PATH, JSON.stringify(fallbackObj) + '\n', 'utf8');
        draftCount++;
      }
    } catch (err) {
      const failedObj = {
        vocabularyId,
        text: word,
        error: err.message
      };
      fs.appendFileSync(FAILED_PATH, JSON.stringify(failedObj) + '\n', 'utf8');
      failedCount++;
      console.error(`Failed to process "${word}": ${err.message}`);
    }
  };

  for (let i = 0; i < toProcess.length; i += CONCURRENCY) {
    const chunk = toProcess.slice(i, i + CONCURRENCY);
    console.log(`Processing batch ${i / CONCURRENCY + 1}/${Math.ceil(toProcess.length / CONCURRENCY)} (items: ${chunk.map(x => x.text).join(', ')})`);
    
    await Promise.all(chunk.map(processItem));
    
    writeReport();
    await sleep(REQUEST_DELAY_MS);
  }

  console.log('Enrichment process completed.');
  writeReport();
}

run().catch(console.error);
