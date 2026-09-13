import { LLMProvider, LLMGenerateParams, LLMGenerateResult } from './types';

export class GeminiProvider implements LLMProvider {
  name = 'gemini';

  isAvailable(): boolean {
    const key = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
    return !!(key && key.trim() !== '');
  }

  async generateText(params: LLMGenerateParams): Promise<LLMGenerateResult> {
    const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
    if (!apiKey) {
      throw new Error('Gemini API key is not configured');
    }

    const modelName = params.model || 'gemini-1.5-flash';
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;

    const contents = [];
    if (params.systemPrompt) {
      contents.push({
        role: 'user',
        parts: [{ text: `System Instruction: ${params.systemPrompt}` }],
      });
    }
    contents.push({
      role: 'user',
      parts: [{ text: params.prompt }],
    });

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents,
        generationConfig: {
          temperature: params.temperature ?? 0.7,
          maxOutputTokens: params.maxTokens ?? 1000,
          ...(params.responseFormat === 'json' ? { responseMimeType: 'application/json' } : {}),
        },
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Gemini API Error (${res.status}): ${err}`);
    }

    const data = await res.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    const totalTokens = data.usageMetadata?.totalTokenCount;

    let sentiment: string | undefined;
    let structuredOutput: Record<string, any> | undefined;

    if (params.responseFormat === 'json') {
      try {
        const parsed = JSON.parse(text);
        if (parsed && typeof parsed === 'object') {
          structuredOutput = parsed;
          if (parsed.sentiment) sentiment = String(parsed.sentiment);
        }
      } catch {
        // Fallback text parsing if not strict JSON
      }
    }

    return {
      text,
      provider: 'gemini',
      model: modelName,
      usage: totalTokens ? { totalTokens } : undefined,
      sentiment,
      structuredOutput,
    };
  }
}
