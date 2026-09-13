export interface EmbeddingProvider {
  name: string;
  isAvailable(): boolean;
  embedText(text: string): Promise<number[]>;
  embedBatch(texts: string[]): Promise<number[][]>;
}

export class OpenAIEmbeddingProvider implements EmbeddingProvider {
  name = 'openai';

  isAvailable(): boolean {
    return !!(process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY.trim() !== '');
  }

  async embedText(text: string): Promise<number[]> {
    const batch = await this.embedBatch([text]);
    return batch[0] || [];
  }

  async embedBatch(texts: string[]): Promise<number[][]> {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error('OpenAI API key missing for embeddings');
    }

    const res = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'text-embedding-3-small',
        input: texts,
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`OpenAI Embedding Error (${res.status}): ${err}`);
    }

    const data = await res.json();
    return data.data.map((d: any) => d.embedding);
  }
}

export class GeminiEmbeddingProvider implements EmbeddingProvider {
  name = 'gemini';

  isAvailable(): boolean {
    const key = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
    return !!(key && key.trim() !== '');
  }

  async embedText(text: string): Promise<number[]> {
    const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
    if (!apiKey) {
      throw new Error('Gemini API key missing for embeddings');
    }

    const url = `https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:embedContent?key=${apiKey}`;

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'models/text-embedding-004',
        content: {
          parts: [{ text }],
        },
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Gemini Embedding Error (${res.status}): ${err}`);
    }

    const data = await res.json();
    return data.embedding?.values || [];
  }

  async embedBatch(texts: string[]): Promise<number[][]> {
    const results: number[][] = [];
    for (const t of texts) {
      results.push(await this.embedText(t));
    }
    return results;
  }
}

/**
 * High-quality deterministic local embedding provider for zero-cost offline execution & testing.
 * Generates a normalized 128-dimensional semantic hash vector.
 */
export class LocalEmbeddingProvider implements EmbeddingProvider {
  name = 'local';
  private VECTOR_DIM = 128;

  isAvailable(): boolean {
    return true;
  }

  async embedText(text: string): Promise<number[]> {
    const vector = new Array(this.VECTOR_DIM).fill(0);
    const cleaned = text.toLowerCase().replace(/[^a-z0-9\s]/g, '');
    const words = cleaned.split(/\s+/).filter(Boolean);

    for (let i = 0; i < words.length; i++) {
      const word = words[i];
      let hash = 0;
      for (let j = 0; j < word.length; j++) {
        hash = (hash << 5) - hash + word.charCodeAt(j);
        hash |= 0;
      }
      const index = Math.abs(hash) % this.VECTOR_DIM;
      vector[index] += 1.0 / (i + 1); // Frequency & position weighting
    }

    // Normalize L2
    let norm = 0;
    for (let v of vector) norm += v * v;
    norm = Math.sqrt(norm);
    if (norm > 0) {
      for (let i = 0; i < vector.length; i++) vector[i] /= norm;
    }

    return vector;
  }

  async embedBatch(texts: string[]): Promise<number[][]> {
    const results: number[][] = [];
    for (const t of texts) {
      results.push(await this.embedText(t));
    }
    return results;
  }
}

export class EmbeddingManager {
  private static gemini = new GeminiEmbeddingProvider();
  private static openai = new OpenAIEmbeddingProvider();
  private static local = new LocalEmbeddingProvider();

  static getProvider(preferred?: string): EmbeddingProvider {
    if (preferred === 'gemini' && this.gemini.isAvailable()) {
      return this.gemini;
    }
    if (preferred === 'openai' && this.openai.isAvailable()) {
      return this.openai;
    }
    if (this.gemini.isAvailable()) {
      return this.gemini;
    }
    if (this.openai.isAvailable()) {
      return this.openai;
    }
    return this.local;
  }

  static async embedText(text: string, preferredProvider?: string): Promise<{ vector: number[]; provider: string }> {
    const provider = this.getProvider(preferredProvider);
    const vector = await provider.embedText(text);
    return { vector, provider: provider.name };
  }
}
