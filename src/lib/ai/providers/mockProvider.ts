import { LLMProvider, LLMGenerateParams, LLMGenerateResult } from './types';

export class MockLLMProvider implements LLMProvider {
  name = 'mock-llm-engine';

  isAvailable(): boolean {
    return true; // Always available fallback
  }

  async generateText(params: LLMGenerateParams): Promise<LLMGenerateResult> {
    const promptLower = params.prompt.toLowerCase();

    // RAG / RagSys Q&A prompt handling
    if (params.prompt.includes('RagSys') || params.prompt.includes('Context:')) {
      const contextMatch = params.prompt.match(/Context:\s*([\s\S]*?)\n\nQuestion:/i);
      const questionMatch = params.prompt.match(/Question:\s*([\s\S]*?)\n\nAnswer:/i);
      const questionText = questionMatch ? questionMatch[1].trim() : '';

      if (contextMatch && contextMatch[1].trim()) {
        const rawContext = contextMatch[1].trim();

        // Filter out header markers and retrieve clean context text lines
        const contentLines = rawContext
          .split('\n')
          .filter(l => !l.startsWith('[Source #') && !l.startsWith('---') && l.trim().length > 0);

        if (contentLines.length > 0) {
          const cleanText = contentLines.join(' ');
          const isSummary = /what is it about|summarize|summary|overview|what is this|brief|short|main topic/i.test(questionText || promptLower);

          if (isSummary) {
            const sentences = cleanText.match(/[^.!?]+[.!?]+/g) || [cleanText];
            const summarySentences = sentences.slice(0, 3).map(s => s.trim()).join(' ');
            return {
              text: `This PDF document covers key information extracted from the text:\n\n${summarySentences}\n\nIn short, it provides detailed content regarding ${sentences[0] ? sentences[0].substring(0, 60) + '...' : 'the uploaded topic'}.`,
              provider: 'local-llm-engine',
              model: params.model || 'mock-ragsys-1.0',
              usage: { promptTokens: Math.ceil(params.prompt.length / 4), completionTokens: 60, totalTokens: Math.ceil(params.prompt.length / 4) + 60 },
            };
          }

          // Specific Question Matching
          const qWords = (questionText || '').toLowerCase().split(/\s+/).filter(w => w.length > 3);
          const sentences = cleanText.match(/[^.!?]+[.!?]+/g) || [cleanText];
          let bestSentence = sentences[0];
          let maxMatches = 0;

          for (const sentence of sentences) {
            const sLower = sentence.toLowerCase();
            const matches = qWords.reduce((acc, w) => acc + (sLower.includes(w) ? 1 : 0), 0);
            if (matches > maxMatches) {
              maxMatches = matches;
              bestSentence = sentence;
            }
          }

          return {
            text: `Based on the document context:\n\n${bestSentence.trim()}`,
            provider: 'local-llm-engine',
            model: params.model || 'mock-ragsys-1.0',
            usage: { promptTokens: Math.ceil(params.prompt.length / 4), completionTokens: 40, totalTokens: Math.ceil(params.prompt.length / 4) + 40 },
          };
        }
      }

      return {
        text: "I couldn't find that information in the PDF.",
        provider: 'local-llm-engine',
        model: params.model || 'mock-ragsys-1.0',
        usage: { promptTokens: Math.ceil(params.prompt.length / 4), completionTokens: 10, totalTokens: Math.ceil(params.prompt.length / 4) + 10 },
      };
    }

    let sentiment = 'positive';
    const positiveKeywords = ['positive', 'love', 'great', 'amazing', 'excellent', 'good', 'happy', 'fantastic', 'superb', 'best'];
    const negativeKeywords = ['bad', 'fail', 'terrible', 'angry', 'awful', 'poor', 'hate', 'broken', 'issue', 'defect'];

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
