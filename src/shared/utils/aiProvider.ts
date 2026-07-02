/**
 * AI Provider Configuration
 * 
 * ⚙️ ĐỂ CHUYỂN ĐỔI PROVIDER, CHỈ CẦN THAY ĐỔI DÒNG NÀY:
 *   'deepseek' → dùng DeepSeek (hỗ trợ temperature, response_format json_object)
 *   'kimi'     → dùng Kimi qua NineRouter (không hỗ trợ temperature tùy chỉnh)
 */
export const ACTIVE_AI_PROVIDER: 'deepseek' | 'kimi' = 'kimi';

// ─── Provider Definitions ───────────────────────────────────────────────────

const providers = {
  deepseek: {
    apiKey:  () => process.env.NINEROUTER_API_KEY   || '',
    baseUrl: () => process.env.NINEROUTER_BASE_URL  || 'https://api.deepseek.com/v1',
    model:   () => process.env.NINEROUTER_MODEL     || 'deepseek-v4-flash',
    /** DeepSeek supports temperature and json_object response_format */
    buildBody: (messages: { role: string; content: string }[]) => ({
      model:           process.env.NINEROUTER_MODEL || 'deepseek-v4-flash',
      stream:          false,
      response_format: { type: 'json_object' as const },
      messages,
      temperature:     0.3,
    }),
  },

  kimi: {
    apiKey:  () => process.env.NINEROUTER_9R_API_KEY  || '',
    baseUrl: () => process.env.NINEROUTER_9R_BASE_URL || 'https://9router.ngocthang.io.vn/v1',
    model:   () => process.env.NINEROUTER_9R_MODEL    || 'Kimi',
    /** Kimi does NOT allow custom temperature — omit it entirely */
    buildBody: (messages: { role: string; content: string }[]) => ({
      model:    process.env.NINEROUTER_9R_MODEL || 'Kimi',
      stream:   false,
      messages,
      // ⚠️ No temperature, no response_format — Kimi rejects them
    }),
  },
};

// ─── Active Provider (resolved at runtime) ──────────────────────────────────

export const aiProvider = providers[ACTIVE_AI_PROVIDER];

/**
 * Call the active AI provider's chat/completions endpoint.
 * Returns the raw text content of the first choice.
 */
export async function callAI(
  systemPrompt: string,
  userPrompt: string,
): Promise<string> {
  const provider = aiProvider;
  const apiKey   = provider.apiKey();
  const baseUrl  = provider.baseUrl();

  if (!apiKey) {
    throw new Error(`AI provider "${ACTIVE_AI_PROVIDER}" API key is not configured in .env`);
  }

  const messages = [
    { role: 'system', content: systemPrompt },
    { role: 'user',   content: userPrompt   },
  ];

  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      Authorization:  `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(provider.buildBody(messages)),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`AI request failed [${ACTIVE_AI_PROVIDER}] ${res.status}: ${errText}`);
  }

  const data    = await res.json() as any;
  const content = data?.choices?.[0]?.message?.content?.trim();

  if (!content) {
    throw new Error(`AI provider "${ACTIVE_AI_PROVIDER}" returned an empty response`);
  }

  // Parse JSON safely (strip markdown code fences if present)
  return content;
}

/**
 * Same as callAI but parses and returns the JSON object directly.
 */
export async function callAIJson<T = any>(
  systemPrompt: string,
  userPrompt: string,
): Promise<T> {
  const raw = await callAI(systemPrompt, userPrompt);
  try {
    return JSON.parse(raw) as T;
  } catch {
    // Strip markdown fences and retry
    const cleaned = raw
      .replace(/^```json\s*/i, '')
      .replace(/^```\s*/i, '')
      .replace(/\s*```$/i, '')
      .trim();
    return JSON.parse(cleaned) as T;
  }
}
