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
        stream: false,
        response_format: { type: "json_object" },
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
    let message = data?.choices?.[0]?.message?.content;

    if (!message && data?.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments) {
      const argsStr = data.choices[0].message.tool_calls[0].function.arguments;
      try {
        const parsedArgs = JSON.parse(argsStr);
        message = parsedArgs.response || parsedArgs.content || argsStr;
      } catch {
        message = argsStr;
      }
    }

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

  async extractReadingCandidates(input: {
    title?: string;
    content: string;
    level?: string;
    mode?: 'focused' | 'coverage';
    maxItems?: number;
  }) {
    const maxItems = input.maxItems || 120;
    const prompt = buildCoveragePrompt({
      title: input.title,
      content: input.content,
      level: input.level,
      maxItems,
    });

    const res = await fetch(`${this.config.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.config.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: this.config.model,
        stream: false,
        response_format: { type: "json_object" },
        messages: [
          {
            role: 'system',
            content: 'You are an English reading annotation assistant. Return only valid JSON.',
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
    let message = data?.choices?.[0]?.message?.content;

    if (!message && data?.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments) {
      const argsStr = data.choices[0].message.tool_calls[0].function.arguments;
      try {
        const parsedArgs = JSON.parse(argsStr);
        message = parsedArgs.response || parsedArgs.content || argsStr;
      } catch {
        message = argsStr;
      }
    }

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

function buildCoveragePrompt(input: {
  title?: string;
  content: string;
  level?: string;
  maxItems: number;
}) {
  return `
You are an English reading annotation assistant for an English learning app.

Your job is to extract candidate vocabulary items that can be matched with a vocabulary database and turned into hover/click translation spans.

Return ONLY valid JSON. Do not include markdown.

Extraction goal:
- Find all useful translatable items in the reading.
- Include single words, compound words, collocations, phrasal verbs, idioms, fixed phrases, and sentence patterns.
- This is coverage mode: extract as many useful items as possible.
- The result will be normalized and searched in a vocabulary database.

Rules:
- Prefer longer phrases over shorter overlapping words.
- If "look forward to" appears, return "look forward to", not just "look".
- If "make a decision" appears, return "make a decision".
- If "as a result" appears, return "as a result".
- Also return important single words that are not part of a longer phrase.
- Do not include very basic stop words (a, an, the, is, are, was, were, etc.) unless part of a phrase.
- Do not include proper nouns unless useful learning items.
- Keep text exactly as it appears in the reading when possible.
- sourceText must be the original sentence containing the item.
- meaningVi must be concise Vietnamese for learners.
- confidence must be between 0 and 1.
- priority should be higher for longer/more important phrase items (0-10).
- Return at most ${input.maxItems} items.

For each item return:
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
  "confidence": number,
  "priority": number
}

Return JSON shape: { "items": [] }

Reading title:
${input.title || ''}

Reading level:
${input.level || 'unknown'}

Reading content:
\"\"\"
${input.content}
\"\"\"
`;
}
