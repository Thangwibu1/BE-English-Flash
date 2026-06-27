import { z } from 'zod';

const idRegex = /^[0-9a-fA-F]{24}$/;

export const createDeckSchema = z.object({
  name: z.string().min(1, 'Deck name is required').max(100),
  description: z.string().max(500).optional(),
  visibility: z.enum(['public', 'private']).default('private'),
});

export const updateDeckSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional(),
  visibility: z.enum(['public', 'private']).optional(),
});

export const addCardSchema = z.object({
  vocabularyId: z.string().regex(idRegex, 'Invalid vocabulary ID'),
});

export const reviewCardSchema = z.object({
  cardId: z.string().regex(idRegex, 'Invalid card ID'),
  vocabularyId: z.string().regex(idRegex, 'Invalid vocabulary ID'),
  rating: z.enum(['again', 'hard', 'good', 'easy']),
});
