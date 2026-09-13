import { db } from '@/db';
import { RAGSearchResult } from '@/types';
import { EmbeddingManager } from './embeddings';

export interface RAGRetrieveParams {
  orgId: string;
  query: string;
  topK?: number;
  minScore?: number;
  documentId?: string;
  maxResultsPerDoc?: number;
}

export class RAGRetriever {
  /**
   * Performs semantic similarity search against embedded document chunks.
   * GUARANTEES strict Organization Tenant Isolation via mandatory orgId parameter.
   * Performs deduplication and quality validation before returning results.
   */
  static async retrieve(params: RAGRetrieveParams): Promise<RAGSearchResult[]> {
    const { orgId, query, topK = 3, minScore = 0.05, documentId, maxResultsPerDoc = 2 } = params;

    if (!orgId) {
      throw new Error('401: Unauthorized — orgId is strictly required for RAG search tenant isolation');
    }

    if (!query || query.trim() === '') {
      return [];
    }

    // 1. Embed Query
    const { vector: queryVector } = await EmbeddingManager.embedText(query);

    // 2. Perform Vector Search in DB (enforcing orgId and optional documentId)
    let rawResults = await db.searchEmbeddings(orgId, queryVector, topK * 5, minScore, documentId);

    // Filter by specific document if requested
    if (documentId) {
      rawResults = rawResults.filter(r => r.document_id === documentId);
    }

    // 3. Filter out corrupted, failed, or non-readable chunks
    const validResults = rawResults.filter(r => {
      if (!r.content || r.content.trim().length === 0) return false;
      if (r.content.includes('\uFFFD') || r.content.includes('\u0000')) return false;
      if (r.content.includes('This PDF could not be extracted as readable text')) return false;
      if (r.metadata?.quality_status === 'failed') return false;
      return true;
    });

    // 4. Deduplicate search results
    const deduplicatedResults: RAGSearchResult[] = [];
    const seenContentHashes = new Set<string>();
    const seenExactTexts = new Set<string>();
    const docCountMap = new Map<string, number>();

    for (const res of validResults) {
      const contentHash = res.metadata?.content_hash || res.content.trim().toLowerCase();
      const exactText = res.content.trim().toLowerCase();

      if (seenContentHashes.has(contentHash) || seenExactTexts.has(exactText)) {
        continue;
      }

      const currentDocCount = docCountMap.get(res.document_id) || 0;
      if (currentDocCount >= maxResultsPerDoc) {
        continue;
      }

      seenContentHashes.add(contentHash);
      seenExactTexts.add(exactText);
      docCountMap.set(res.document_id, currentDocCount + 1);
      deduplicatedResults.push(res);

      if (deduplicatedResults.length >= topK) {
        break;
      }
    }

    return deduplicatedResults;
  }

  /**
   * Assembles retrieved chunks into controlled LLM prompt context with clear source attribution headers.
   */
  static buildContext(results: RAGSearchResult[]): string {
    if (!results || results.length === 0) {
      return 'No readable matching content was found in the selected documents.';
    }

    const blocks = results.map((res, index) => {
      const scorePct = Math.round(res.score * 100);
      const pageInfo = res.metadata?.page_number ? ` (Page ${res.metadata.page_number})` : '';
      const sectionInfo = res.metadata?.section_title ? ` · ${res.metadata.section_title}` : '';
      return `[Source #${index + 1}: ${res.document_name}${pageInfo}${sectionInfo} — Relevance: ${scorePct}%]\n${res.content}`;
    });

    return blocks.join('\n\n---\n\n');
  }
}
