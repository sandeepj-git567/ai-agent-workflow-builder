import { LLMProvider, LLMGenerateParams, LLMGenerateResult } from './types';
import { GroqProvider } from './groqProvider';
import { OpenAIProvider } from './openaiProvider';
import { GeminiProvider } from './geminiProvider';
import { MockLLMProvider } from './mockProvider';

export * from './types';
export * from './groqProvider';
export * from './openaiProvider';
export * from './geminiProvider';
export * from './mockProvider';

export class LLMManager {
  private static providers: Map<string, LLMProvider> = new Map([
    ['groq', new GroqProvider()],
    ['openai', new OpenAIProvider()],
    ['gemini', new GeminiProvider()],
    ['mock', new MockLLMProvider()],
  ]);

  /**
   * Generates text via requested provider with automatic fallback to available providers or mock.
   */
  static async generate(params: LLMGenerateParams & { provider?: string }): Promise<LLMGenerateResult> {
    const requestedProviderName = (params.provider || 'groq').toLowerCase();
    let provider = this.providers.get(requestedProviderName);

    // Fallback logic if requested provider isn't available
    if (!provider || !provider.isAvailable()) {
      if (requestedProviderName !== 'gemini' && this.providers.get('gemini')?.isAvailable()) {
        provider = this.providers.get('gemini');
      } else if (requestedProviderName !== 'openai' && this.providers.get('openai')?.isAvailable()) {
        provider = this.providers.get('openai');
      } else if (requestedProviderName !== 'groq' && this.providers.get('groq')?.isAvailable()) {
        provider = this.providers.get('groq');
      } else {
        provider = this.providers.get('mock')!;
      }
    }

    const activeProvider = provider || this.providers.get('mock')!;

    try {
      return await activeProvider.generateText(params);
    } catch (err: any) {
      console.warn(`[LLMManager] Provider '${activeProvider.name}' failed: ${err.message}. Falling back to MockLLMProvider.`);
      const fallbackProvider = this.providers.get('mock')!;
      return await fallbackProvider.generateText(params);
    }
  }

  static registerProvider(provider: LLMProvider): void {
    this.providers.set(provider.name.toLowerCase(), provider);
  }
}
