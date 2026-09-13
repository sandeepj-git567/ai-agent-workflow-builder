export interface LLMMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface LLMGenerateParams {
  model?: string;
  systemPrompt?: string;
  prompt: string;
  temperature?: number;
  maxTokens?: number;
  responseFormat?: 'text' | 'json';
}

export interface LLMGenerateResult {
  text: string;
  provider: string;
  model: string;
  usage?: {
    promptTokens?: number;
    completionTokens?: number;
    totalTokens?: number;
  };
  sentiment?: string;
  structuredOutput?: Record<string, any>;
}

export interface LLMProvider {
  name: string;
  isAvailable(): boolean;
  generateText(params: LLMGenerateParams): Promise<LLMGenerateResult>;
}
