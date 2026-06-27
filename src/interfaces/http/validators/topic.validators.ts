import { z } from 'zod';

export const createTopicSchema = z.object({
  name: z.string().min(1, 'Topic name is required').max(100),
  description: z.string().max(500).optional(),
  parentTopicId: z.string().uuid().or(z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid parent topic ID')).optional(),
});

export const updateTopicSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional(),
  parentTopicId: z
    .string()
    .uuid()
    .or(z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid parent topic ID'))
    .nullable()
    .optional(),
});
