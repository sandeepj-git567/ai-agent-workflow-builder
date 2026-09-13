import { RAGRetriever } from './retriever';
import { LLMManager } from '../ai/providers';

export interface RagSysQuestionParams {
  orgId: string;
  question: string;
  documentId?: string;
  topK?: number;
}

export interface RagSysQuestionResult {
  answer: string;
  sources: string[];
  sourceDetails: Array<{
    documentId: string;
    documentName: string;
    pageNumber?: number;
    sectionTitle?: string;
    content: string;
    relevanceScore: number;
  }>;
  chunkCount: number;
}

export class RagSysService {
  /**
   * Executes a strict document-grounded RAG query following the RagSys specification.
   * Guarantees strict prompt enforcement ("I couldn't find that information in the PDF.")
   * and provides source citations.
   */
  static async askQuestion(params: RagSysQuestionParams): Promise<RagSysQuestionResult> {
    const { orgId, question, documentId, topK = 3 } = params;

    if (!orgId) {
      throw new Error('401: Unauthorized — Organization ID is required');
    }

    if (!question || question.trim() === '') {
      throw new Error('Question cannot be empty');
    }

    // 1. Retrieve relevant vector chunks for organization & document
    const docs = await RAGRetriever.retrieve({
      orgId,
      query: question,
      topK,
      documentId,
      minScore: 0.05,
    });

    if (!docs || docs.length === 0) {
      return {
        answer: "I couldn't find that information in the PDF.",
        sources: [],
        sourceDetails: [],
        chunkCount: 0,
      };
    }

    // 2. Assemble context blocks
    const contextBlocks = docs.map((doc, i) => {
      const pageInfo = doc.metadata?.page_number ? ` (Page ${doc.metadata.page_number})` : '';
      return `[Source #${i + 1}: ${doc.document_name}${pageInfo}]\n${doc.content}`;
    });

    const contextText = contextBlocks.join('\n\n---\n\n');

    // 3. Assemble RagSys strict prompt
    const prompt = `You are a PDF Question Answering Assistant (RagSys).

Answer the user's question using ONLY the information provided in the context.

Rules:
1. Use only the context.
2. Do not invent information.
3. If the answer is not available in the context, say exactly:
   "I couldn't find that information in the PDF."
4. Give a clear and concise answer.

Context:
${contextText}

Question:
${question}

Answer:`;

    // 4. Generate grounded response using LLM Manager
    const llmResult = await LLMManager.generate({
      prompt,
      temperature: 0.0, // Zero temperature for strict factual accuracy
      maxTokens: 500,
    });

    const formattedAnswer = (llmResult.text || '').trim() || "I couldn't find that information in the PDF.";

    return {
      answer: formattedAnswer,
      sources: docs.map(d => d.content),
      sourceDetails: docs.map(d => ({
        documentId: d.document_id,
        documentName: d.document_name,
        pageNumber: d.metadata?.page_number,
        sectionTitle: d.metadata?.section_title,
        content: d.content,
        relevanceScore: Math.round(d.score * 100),
      })),
      chunkCount: docs.length,
    };
  }
}
