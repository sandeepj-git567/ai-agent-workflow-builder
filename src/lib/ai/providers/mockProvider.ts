import { LLMProvider, LLMGenerateParams, LLMGenerateResult } from './types';

export class MockLLMProvider implements LLMProvider {
  name = 'mock-llm-engine';

  isAvailable(): boolean {
    return true; // Always available fallback
  }

  async generateText(params: LLMGenerateParams): Promise<LLMGenerateResult> {
    const promptLower = params.prompt.toLowerCase();
    let sentiment = 'positive';

    const positiveKeywords = ['positive', 'love', 'great', 'amazing', 'excellent', 'good', 'happy', 'fantastic', 'superb', 'best'];
    const negativeKeywords = ['bad', 'fail', 'terrible', 'angry', 'awful', 'poor', 'hate', 'broken', 'issue', 'defect'];

    // Check user content specifically if prompt includes quoted text
    const quotedMatch = params.prompt.match(/"([^"]+)"/);
    const targetText = quotedMatch ? quotedMatch[1].toLowerCase() : promptLower;

    const posScore = positiveKeywords.reduce((acc, w) => acc + (targetText.includes(w) ? 1 : 0), 0);
    const negScore = negativeKeywords.reduce((acc, w) => acc + (targetText.includes(w) ? 1 : 0), 0);

    if (posScore > negScore) {
      sentiment = 'positive';
    } else if (negScore > posScore) {
      sentiment = 'negative';
    } else if (promptLower.includes('positive') && !promptLower.includes('negative')) {
      sentiment = 'positive';
    } else if (promptLower.includes('negative') && !promptLower.includes('positive')) {
      sentiment = 'negative';
    } else {
      sentiment = 'positive';
    }

    const generatedText = `Analysis: The input sentiment is determined to be ${sentiment.toUpperCase()}. Details: User feedback processed successfully with high confidence.`;

    return {
      text: generatedText,
      provider: 'local-llm-engine',
      model: params.model || 'mock-llama-3.1',
      usage: {
        promptTokens: Math.ceil(params.prompt.length / 4),
        completionTokens: 25,
        totalTokens: Math.ceil(params.prompt.length / 4) + 25,
      },
      sentiment,
    };
  }
}
