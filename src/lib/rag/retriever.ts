import { db } from '@/db';
import { RAGSearchResult } from '@/types';
import { EmbeddingManager } from './embeddings';

export interface RAGRetrieveParams {
  orgId: string;
  query: string;
  topK?: number;
  minScore?: number;
  documentId?: string;
}

export class RAGRetriever {
  /**
   * Performs semantic similarity search against embedded document chunks.
   * GUARANTEES strict Organization Tenant Isolation via mandatory orgId parameter.
   */
  static async retrieve(params: RAGRetrieveParams): Promise<RAGSearchResult[]> {
    const { orgId, query, topK = 3, minScore = 0.05, documentId } = params;

    if (!orgId) {
      throw new Error('401: Unauthorized — orgId is strictly required for RAG search tenant isolation');
    }

    if (!query || query.trim() === '') {
      return [];
    }

    // 1. Embed Query
    const { vector: queryVector } = await EmbeddingManager.embedText(query);

    // 2. Perform Vector Search in DB (enforcing orgId)
    let results = await db.searchEmbeddings(orgId, queryVector, topK, minScore);

    // Filter by specific document if requested
    if (documentId) {
      results = results.filter(r => r.document_id === documentId);
    }

    return results;
  }

  /**
   * Assembles retrieved chunks into controlled LLM prompt context with clear source attribution headers.
   */
  static buildContext(results: RAGSearchResult[]): string {
    if (!results || results.length === 0) {
      return 'No relevant document context found in knowledge base.';
    }

    const blocks = results.map((res, index) => {
      const scorePct = Math.round(res.score * 100);
      return `[Source #${index + 1}: ${res.document_name} (Relevance: ${scorePct}%, Chunk ID: ${res.chunk_id})]\n${res.content}`;
    });

    return blocks.join('\n\n---\n\n');
  }
}
