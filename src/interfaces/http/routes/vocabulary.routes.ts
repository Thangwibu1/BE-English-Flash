import { Router, Request, Response, NextFunction } from 'express';
import { buildContainer } from '../../../shared/container/buildContainer';
import { validateRequest } from '../middlewares/validateRequest';
import { authMiddleware, optionalAuthMiddleware } from '../middlewares/authMiddleware';
import { requireRole } from '../middlewares/requireRole';
import { createVocabularySchema, updateVocabularySchema } from '../validators/vocabulary.validators';
import { VocabularyModel } from '../../../infrastructure/database/mongoose/models/VocabularyModel';
import { AppError } from '../../../core/errors/AppError';
import { normalizeText } from '../../../shared/utils/normalizeText';
import { buildPrefixTokens } from '../../../shared/utils/buildPrefixTokens';

const router = Router();
const { vocabularyController, searchVocabularyUseCase, fuzzyVocabularySearchService } = buildContainer();

router.get('/', optionalAuthMiddleware, vocabularyController.list);

// Fuzzy search endpoint — must be before /:id to avoid conflict
router.get('/search', optionalAuthMiddleware, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const q = String(req.query.q || '');
    const type = req.query.type ? String(req.query.type) : undefined;
    const level = req.query.level ? String(req.query.level) : undefined;
    const topic = req.query.topic ? String(req.query.topic) : undefined;
    const limit = req.query.limit ? Math.min(Number(req.query.limit), 50) : 20;

    const result = await searchVocabularyUseCase.execute({ query: q, type, level, topic, limit });

    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
});

// AI define: lookup or create a vocabulary using AI
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
    const normalizedTextVal = normalizeText(text.trim());
    
    let vocab = await VocabularyModel.findOne({ normalizedText: normalizedTextVal, deletedAt: null });
    if (!vocab) {
      const forms = [{ formText: parsed.text || text.trim(), normalizedFormText: normalizedTextVal }];
      const searchTokens = buildPrefixTokens((parsed.text || text.trim()));
      vocab = await VocabularyModel.create({
        text: parsed.text || text.trim(),
        normalizedText: normalizedTextVal,
        type: parsed.type || 'single_word',
        level: parsed.level || 'A1',
        partOfSpeech: parsed.partOfSpeech || undefined,
        phonetic: parsed.phonetic || undefined,
        meanings: [{
          meaningVi: parsed.meaningVi || 'Chưa có nghĩa',
          meaningEn: parsed.meaningEn || undefined,
          examples: parsed.exampleEn ? [{ exampleEn: parsed.exampleEn, exampleVi: parsed.exampleVi || undefined }] : [],
        }],
        forms,
        searchTokens,
        status: 'approved',
        createdBy: req.user!.id,
      });
      // Rebuild fuzzy index after new vocabulary created
      fuzzyVocabularySearchService.rebuildIndex().catch(() => {});
    }

    res.json({
      success: true,
      data: vocab,
    });
  } catch (error) {
    next(error);
  }
});

// Lookup vocabulary details and suggestions
router.post('/lookup', authMiddleware, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { text, includeSuggestions } = req.body;
    if (!text || !text.trim()) {
      throw new AppError('BAD_REQUEST', 'Text is required', 400);
    }
    const { lookupVocabularyByTextUseCase } = buildContainer();
    const result = await lookupVocabularyByTextUseCase.execute({
      text,
      includeSuggestions: includeSuggestions !== false,
    });
    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
});

// Admin: Add vocabulary to DB directly (with full fields + AI enrichment optional)
// POST /api/vocabularies/add-vocab
router.post(
  '/add-vocab',
  authMiddleware,
  requireRole('admin'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const {
        text,
        type,
        level,
        partOfSpeech,
        phonetic,
        meanings,
        forms: extraForms,
        topicIds,
        status,
        useAi,
      } = req.body;

      if (!text || !text.trim()) {
        throw new AppError('BAD_REQUEST', 'text is required', 400);
      }

      const normalizedTextVal = normalizeText(text.trim());

      // Check duplicate
      const existing = await VocabularyModel.findOne({ normalizedText: normalizedTextVal, deletedAt: null });
      if (existing) {
        return res.status(409).json({
          success: false,
          message: 'Vocabulary already exists',
          data: existing,
        });
      }

      let resolvedMeanings = meanings;
      let resolvedType = type;
      let resolvedLevel = level;
      let resolvedPartOfSpeech = partOfSpeech;
      let resolvedPhonetic = phonetic;

      // If useAi is true, fetch AI definition to enrich missing fields
      if (useAi || !meanings || meanings.length === 0) {
        try {
          const apiKey = process.env.NINEROUTER_API_KEY || '';
          const baseUrl = process.env.NINEROUTER_BASE_URL || 'https://api.nine-router.com/v1';
          const aiModel = process.env.NINEROUTER_MODEL || 'google/gemini-flash-1.5';

          const prompt = `Define the English word or phrase: "${text.trim()}". Return ONLY valid JSON in this exact shape:
{
  "type": "single_word" | "compound_word" | "collocation" | "phrasal_verb" | "idiom" | "fixed_phrase",
  "level": "A1" | "A2" | "B1" | "B2" | "C1" | "C2",
  "partOfSpeech": string,
  "phonetic": string,
  "meaningVi": string,
  "meaningEn": string,
  "exampleEn": string,
  "exampleVi": string,
  "forms": [string]
}`;

          const aiRes = await fetch(`${baseUrl}/chat/completions`, {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${apiKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              model: aiModel,
              stream: false,
              response_format: { type: 'json_object' },
              messages: [
                { role: 'system', content: 'You are a professional lexicographer. Return ONLY valid JSON.' },
                { role: 'user', content: prompt },
              ],
              temperature: 0.3,
            }),
          });

          if (aiRes.ok) {
            const aiData = await aiRes.json() as any;
            const aiContent = aiData?.choices?.[0]?.message?.content;
            if (aiContent) {
              const parsed = JSON.parse(aiContent);
              resolvedType = resolvedType || parsed.type || 'single_word';
              resolvedLevel = resolvedLevel || parsed.level;
              resolvedPartOfSpeech = resolvedPartOfSpeech || parsed.partOfSpeech;
              resolvedPhonetic = resolvedPhonetic || parsed.phonetic;

              if (!resolvedMeanings || resolvedMeanings.length === 0) {
                resolvedMeanings = [{
                  meaningVi: parsed.meaningVi || 'Chưa có nghĩa',
                  meaningEn: parsed.meaningEn,
                  examples: parsed.exampleEn ? [{ exampleEn: parsed.exampleEn, exampleVi: parsed.exampleVi }] : [],
                }];
              }

              // Merge AI-suggested forms with extra forms
              if (parsed.forms && Array.isArray(parsed.forms) && (!extraForms || extraForms.length === 0)) {
                req.body._aiForms = parsed.forms.filter((f: string) => normalizeText(f) !== normalizedTextVal);
              }
            }
          }
        } catch (_aiErr) {
          // AI enrichment is optional — continue without it
        }
      }

      // Build forms array
      const aiForms: string[] = req.body._aiForms || [];
      const manualForms: { formText: string; formType?: string }[] = extraForms || [];

      const forms = [
        { formText: text.trim(), normalizedFormText: normalizedTextVal, formType: 'base' },
        ...aiForms.map((f: string) => ({ formText: f, normalizedFormText: normalizeText(f), formType: 'inflection' })),
        ...manualForms.map((f) => ({
          formText: f.formText,
          normalizedFormText: normalizeText(f.formText),
          formType: f.formType,
        })),
      ];

      const allFormTexts = forms.map((f) => f.formText);
      const searchTokens = buildPrefixTokens(allFormTexts.join(' '));

      const vocab = await VocabularyModel.create({
        text: text.trim(),
        normalizedText: normalizedTextVal,
        type: resolvedType || 'single_word',
        level: resolvedLevel,
        partOfSpeech: resolvedPartOfSpeech,
        phonetic: resolvedPhonetic,
        meanings: resolvedMeanings || [{ meaningVi: 'Chưa có nghĩa', examples: [] }],
        forms,
        searchTokens,
        topicIds: topicIds || [],
        status: status || 'approved',
        createdBy: req.user!.id,
      });

      // Rebuild fuzzy index in background
      fuzzyVocabularySearchService.rebuildIndex().catch(() => {});

      res.status(201).json({ success: true, data: vocab });
    } catch (error) {
      next(error);
    }
  }
);

router.get('/:id', optionalAuthMiddleware, vocabularyController.getById);

// Admin CRUD with index refresh
router.post(
  '/',
  authMiddleware,
  requireRole('admin'),
  validateRequest(createVocabularySchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      await vocabularyController.create(req, res, next);
      // Rebuild fuzzy index after create
      fuzzyVocabularySearchService.rebuildIndex().catch(() => {});
    } catch (error) {
      next(error);
    }
  }
);

router.patch(
  '/:id',
  authMiddleware,
  requireRole('admin'),
  validateRequest(updateVocabularySchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      await vocabularyController.update(req, res, next);
      // Rebuild fuzzy index after update
      fuzzyVocabularySearchService.rebuildIndex().catch(() => {});
    } catch (error) {
      next(error);
    }
  }
);

router.delete(
  '/:id',
  authMiddleware,
  requireRole('admin'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      await vocabularyController.delete(req, res, next);
      // Rebuild fuzzy index after delete
      fuzzyVocabularySearchService.rebuildIndex().catch(() => {});
    } catch (error) {
      next(error);
    }
  }
);

router.post('/:id/save', authMiddleware, vocabularyController.save);
router.post('/:id/mark-known', authMiddleware, vocabularyController.markKnown);
router.post('/:id/mark-difficult', authMiddleware, vocabularyController.markDifficult);

export { router as vocabularyRoutes };
