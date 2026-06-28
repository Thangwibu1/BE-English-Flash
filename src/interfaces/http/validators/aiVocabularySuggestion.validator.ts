import { z } from 'zod';

export const aiExtractedVocabularyItemSchema = z.object({
  text: z.string().min(1),
  type: z.enum([
    'single_word',
    'compound_word',
    'collocation',
    'phrasal_verb',
    'idiom',
    'fixed_phrase',
    'sentence_pattern',
  ]),
  level: z.enum(['A1', 'A2', 'B1', 'B2', 'C1', 'C2']),
  partOfSpeech: z.string().optional().nullable(),
  meaningVi: z.string().min(1),
  meaningEn: z.string().optional().nullable(),
  forms: z.array(z.string()).optional().default([]),
  topics: z.array(z.string()).optional().default([]),
  exampleEn: z.string().optional().nullable(),
  exampleVi: z.string().optional().nullable(),
  sourceText: z.string().optional().nullable(),
  confidence: z.number().min(0).max(1).optional().default(0.5),
});

export const aiExtractedVocabularyResponseSchema = z.object({
  items: z.array(aiExtractedVocabularyItemSchema),
});
