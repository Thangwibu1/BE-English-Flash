import { AIProviderService } from '../../app/ports/services/AIProviderService';

export class NineRouterAIProvider implements AIProviderService {
  constructor(private config: {
    apiKey: string;
    baseUrl: string;
    model: string;
  }) {}

  async extractVocabularyFromReading(input: {
    title?: string;
    content: string;
    maxItems?: number;
  }) {
    const prompt = buildReadingVocabularyPrompt({
      title: input.title,
      content: input.content,
      maxItems: input.maxItems || 30,
    });

    const res = await fetch(`${this.config.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.config.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: this.config.model,
        messages: [
          {
            role: 'system',
            content:
              'You are an English vocabulary extraction assistant. Return only valid JSON.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature: 0.2,
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`9Router request failed: ${res.status} ${text}`);
    }

    const data = await res.json() as any;
    const message = data?.choices?.[0]?.message?.content;

    if (!message) {
      throw new Error('9Router returned empty content');
    }

    const parsed = safeParseJson(message);

    return {
      provider: '9router' as const,
      model: this.config.model,
      items: parsed.items || [],
      rawResponse: data,
    };
  }
}

function safeParseJson(input: string) {
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

function buildReadingVocabularyPrompt(input: {
  title?: string;
  content: string;
  maxItems: number;
}) {
  return `
You are an English vocabulary extraction assistant for an English learning app.

Analyze the reading text and extract useful vocabulary items for learners.

Return ONLY valid JSON. Do not include markdown.

Extract:
- single words
- compound words
- collocations
- phrasal verbs
- idioms
- fixed phrases
- useful sentence patterns if important

Focus on useful learning items, not every word.

For each item, return:
{
  "text": string,
  "type": "single_word" | "compound_word" | "collocation" | "phrasal_verb" | "idiom" | "fixed_phrase" | "sentence_pattern",
  "level": "A1" | "A2" | "B1" | "B2" | "C1" | "C2",
  "partOfSpeech": string,
  "meaningVi": string,
  "meaningEn": string,
  "forms": string[],
  "topics": string[],
  "exampleEn": string,
  "exampleVi": string,
  "sourceText": string,
  "confidence": number
}

Rules:
- Do not extract proper nouns unless important learning vocabulary.
- Do not extract very basic stop words.
- Prefer phrases when the meaning is better learned as a phrase.
- If a phrase appears in the text, keep the exact phrase.
- For phrasal verbs, include common forms.
- For collocations, include natural phrase forms.
- Use Vietnamese meanings suitable for learners.
- sourceText must be copied from the reading sentence where the item appears.
- confidence must be between 0 and 1.
- Return at most ${input.maxItems} items.
- Return this JSON shape: { "items": [] }

Reading title:
${input.title || ''}

Reading text:
\"\"\"
${input.content}
\"\"\"
`;
}
