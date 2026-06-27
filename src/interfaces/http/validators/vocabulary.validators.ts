import { z } from 'zod';

export const createVocabularySchema = z.object({
  text: z.string().min(1, 'Text is required').max(500),
  type: z.enum([
    'single_word',
    'compound_word',
    'collocation',
    'phrasal_verb',
    'idiom',
    'fixed_phrase',
    'sentence_pattern',
  ]),
  level: z.enum(['A1', 'A2', 'B1', 'B2', 'C1', 'C2']).optional(),
  partOfSpeech: z.string().max(100).optional(),
  phonetic: z.string().max(100).optional(),
  audioUrl: z.string().url('Invalid audio URL').or(z.string().length(0)).optional(),
  meanings: z
    .array(
      z.object({
        meaningVi: z.string().min(1, 'Vietnamese meaning is required'),
        meaningEn: z.string().optional(),
        note: z.string().optional(),
        examples: z
          .array(
            z.object({
              exampleEn: z.string().min(1, 'Example in English is required'),
              exampleVi: z.string().optional(),
              source: z.string().optional(),
            })
          )
          .default([]),
      })
    )
    .min(1, 'At least one meaning is required'),
  forms: z
    .array(
      z.object({
        formText: z.string().min(1, 'Form text is required'),
        formType: z.string().optional(),
        note: z.string().optional(),
      })
    )
    .default([]),
  components: z
    .array(
      z.object({
        componentText: z.string().min(1),
        componentVocabularyId: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid ID').optional(),
        role: z.string().optional(),
        orderIndex: z.number(),
      })
    )
    .default([]),
  topicIds: z.array(z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid topic ID')).default([]),
  status: z.enum(['draft', 'approved', 'rejected', 'archived']).default('approved'),
});

export const updateVocabularySchema = z.object({
  text: z.string().min(1).max(500).optional(),
  type: z
    .enum([
      'single_word',
      'compound_word',
      'collocation',
      'phrasal_verb',
      'idiom',
      'fixed_phrase',
      'sentence_pattern',
    ])
    .optional(),
  level: z.enum(['A1', 'A2', 'B1', 'B2', 'C1', 'C2']).optional(),
  partOfSpeech: z.string().max(100).optional(),
  phonetic: z.string().max(100).optional(),
  audioUrl: z.string().url('Invalid audio URL').or(z.string().length(0)).optional(),
  meanings: z
    .array(
      z.object({
        meaningVi: z.string().min(1),
        meaningEn: z.string().optional(),
        note: z.string().optional(),
        examples: z
          .array(
            z.object({
              exampleEn: z.string().min(1),
              exampleVi: z.string().optional(),
              source: z.string().optional(),
            })
          )
          .default([]),
      })
    )
    .optional(),
  forms: z
    .array(
      z.object({
        formText: z.string().min(1),
        formType: z.string().optional(),
        note: z.string().optional(),
      })
    )
    .optional(),
  components: z
    .array(
      z.object({
        componentText: z.string().min(1),
        componentVocabularyId: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid ID').optional(),
        role: z.string().optional(),
        orderIndex: z.number(),
      })
    )
    .optional(),
  topicIds: z.array(z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid topic ID')).optional(),
  status: z.enum(['draft', 'approved', 'rejected', 'archived']).optional(),
});
