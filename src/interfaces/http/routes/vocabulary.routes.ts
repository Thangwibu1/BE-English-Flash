import { Router, Request, Response, NextFunction } from 'express';
import { buildContainer } from '../../../shared/container/buildContainer';
import { validateRequest } from '../middlewares/validateRequest';
import { authMiddleware, optionalAuthMiddleware } from '../middlewares/authMiddleware';
import { requireRole } from '../middlewares/requireRole';
import { createVocabularySchema, updateVocabularySchema } from '../validators/vocabulary.validators';
import { VocabularyModel } from '../../../infrastructure/database/mongoose/models/VocabularyModel';
import { AppError } from '../../../core/errors/AppError';

const router = Router();
const { vocabularyController } = buildContainer();

router.get('/', optionalAuthMiddleware, vocabularyController.list);

router.post('/ai-define', authMiddleware, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { text } = req.body;
    if (!text || !text.trim()) {
      throw new AppError('BAD_REQUEST', 'Text is required', 400);
    }
    
    const apiKey = process.env.NINEROUTER_API_KEY || '';
    const baseUrl = process.env.NINEROUTER_BASE_URL || 'https://api.nine-router.com/v1';
    const model = process.env.NINEROUTER_MODEL || 'google/gemini-flash-1.5';
    
    const prompt = `Define the English word or phrase: "${text.trim()}". Return ONLY valid JSON.
For this item, return this JSON shape:
{
  "text": "${text.trim()}",
  "type": "single_word" | "compound_word" | "collocation" | "phrasal_verb" | "idiom" | "fixed_phrase",
  "level": "A1" | "A2" | "B1" | "B2" | "C1" | "C2",
  "partOfSpeech": string,
  "phonetic": string,
  "meaningVi": string,
  "meaningEn": string,
  "exampleEn": string,
  "exampleVi": string
}`;

    const apiRes = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        stream: false,
        response_format: { type: "json_object" },
        messages: [
          {
            role: 'system',
            content: 'You are a professional lexicographer and English teacher. Return ONLY valid JSON.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature: 0.3,
      }),
    });

    if (!apiRes.ok) {
      const errorText = await apiRes.text();
      throw new Error(`AI Request failed: ${apiRes.status} ${errorText}`);
    }

    const data = await apiRes.json() as any;
    const content = data?.choices?.[0]?.message?.content;
    if (!content) {
      throw new Error('AI returned empty response');
    }

    const parsed = JSON.parse(content);
    const normalizedText = text.trim().toLowerCase();
    
    let vocab = await VocabularyModel.findOne({ normalizedText, deletedAt: null });
    if (!vocab) {
      vocab = await VocabularyModel.create({
        text: parsed.text || text.trim(),
        normalizedText,
        type: parsed.type || 'single_word',
        level: parsed.level || 'A1',
        partOfSpeech: parsed.partOfSpeech || undefined,
        phonetic: parsed.phonetic || undefined,
        meanings: [{
          meaningVi: parsed.meaningVi || 'Chưa có nghĩa',
          meaningEn: parsed.meaningEn || undefined,
          examples: parsed.exampleEn ? [{ exampleEn: parsed.exampleEn, exampleVi: parsed.exampleVi || undefined }] : [],
        }],
        forms: [{ formText: parsed.text || text.trim(), normalizedFormText: normalizedText }],
        status: 'approved',
        createdBy: req.user!.id,
      });
    }

    res.json({
      success: true,
      data: vocab,
    });
  } catch (error) {
    next(error);
  }
});

router.get('/:id', optionalAuthMiddleware, vocabularyController.getById);

router.post(
  '/',
  authMiddleware,
  requireRole('admin'),
  validateRequest(createVocabularySchema),
  vocabularyController.create
);

router.patch(
  '/:id',
  authMiddleware,
  requireRole('admin'),
  validateRequest(updateVocabularySchema),
  vocabularyController.update
);

router.delete(
  '/:id',
  authMiddleware,
  requireRole('admin'),
  vocabularyController.delete
);

router.post('/:id/save', authMiddleware, vocabularyController.save);
router.post('/:id/mark-known', authMiddleware, vocabularyController.markKnown);
router.post('/:id/mark-difficult', authMiddleware, vocabularyController.markDifficult);

export { router as vocabularyRoutes };
