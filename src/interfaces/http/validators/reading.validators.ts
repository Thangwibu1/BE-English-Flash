import { z } from 'zod';

export const createReadingSchema = z.object({
  title: z.string().min(1, 'Title is required').max(500),
  subtitle: z.string().max(500).optional(),
  content: z.string().min(1, 'Content is required'),
  level: z.enum(['A1', 'A2', 'B1', 'B2', 'C1', 'C2']).optional(),
  topicIds: z.array(z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid topic ID')).default([]),
  source: z.string().optional(),
  status: z.enum(['draft', 'published', 'archived']).default('draft'),
});

export const updateReadingSchema = z.object({
  title: z.string().min(1).max(500).optional(),
  subtitle: z.string().max(500).optional(),
  content: z.string().min(1).optional(),
  level: z.enum(['A1', 'A2', 'B1', 'B2', 'C1', 'C2']).optional(),
  topicIds: z.array(z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid topic ID')).optional(),
  source: z.string().optional(),
  status: z.enum(['draft', 'published', 'archived']).optional(),
});

export const trackLookupSchema = z.object({
  vocabularyId: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid vocabulary ID'),
  readingSpanId: z.string().optional(),
  lookupText: z.string().optional(),
});

export const updateProgressSchema = z.object({
  progressPercent: z.number().min(0).max(100),
  lastPositionIndex: z.number().min(0),
});
