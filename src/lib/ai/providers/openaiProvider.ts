import { LLMProvider, LLMGenerateParams, LLMGenerateResult } from './types';

export class OpenAIProvider implements LLMProvider {
  name = 'openai';

  isAvailable(): boolean {
    return !!(process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY.trim() !== '');
  }

  async generateText(params: LLMGenerateParams): Promise<LLMGenerateResult> {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error('OpenAI API Key is not configured in environment variables');
    }

    const model = params.model || process.env.OPENAI_DEFAULT_MODEL || 'gpt-4o-mini';
    const systemPrompt = params.systemPrompt || 'You are an AI assistant in an automated workflow pipeline. Return concise and structured output.';

    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: params.prompt },
        ],
        temperature: params.temperature ?? 0.3,
        max_tokens: params.maxTokens ?? 350,
      }),
    });

    if (!res.ok) {
      const errData = await res.text();
      throw new Error(`OpenAI API Error (${res.status}): ${errData}`);
    }

    const data = await res.json();
    const outputText = data.choices?.[0]?.message?.content?.trim() || '';

    return {
      text: outputText,
      provider: 'openai',
      model: data.model || model,
      usage: {
        promptTokens: data.usage?.prompt_tokens,
        completionTokens: data.usage?.completion_tokens,
        totalTokens: data.usage?.total_tokens,
      },
      sentiment: extractSentiment(outputText),
    };
  }
}

function extractSentiment(text: string): string {
  const lower = text.toLowerCase();
  if (lower.includes('positive')) return 'positive';
  if (lower.includes('negative')) return 'negative';
  if (lower.includes('neutral')) return 'neutral';
  return 'positive';
}
