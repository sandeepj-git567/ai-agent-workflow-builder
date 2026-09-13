import { db } from '@/db';
import { Document, DocumentChunk } from '@/types';
import { EmbeddingManager } from './embeddings';

export interface IngestDocumentParams {
  orgId: string;
  name: string;
  content: string;
  fileType?: string;
  sourceUrl?: string;
  metadata?: Record<string, any>;
  chunkSize?: number;
  chunkOverlap?: number;
}

export class DocumentService {
  /**
   * Ingests a raw document, performs text chunking, generates embeddings, and persists all chunks.
   */
  static async ingestDocument(params: IngestDocumentParams): Promise<Document> {
    const { orgId, name, content, fileType = 'text', sourceUrl, metadata = {} } = params;
    const chunkSize = params.chunkSize || 500;
    const chunkOverlap = params.chunkOverlap || 50;

    // 1. Create Document Record
    const doc = await db.createDocument({
      org_id: orgId,
      name,
      file_type: fileType,
      source_url: sourceUrl,
      content,
      metadata: {
        ...metadata,
        chunk_size: chunkSize,
        chunk_overlap: chunkOverlap,
      },
    });

    try {
      // 2. Perform Text Chunking
      const textChunks = this.chunkText(content, chunkSize, chunkOverlap);
      const createdChunks: DocumentChunk[] = [];

      // 3. Process each chunk & generate vector embeddings
      for (let i = 0; i < textChunks.length; i++) {
        const chunkText = textChunks[i];
        
        const chunk = await db.createDocumentChunk({
          document_id: doc.id,
          org_id: orgId,
          chunk_index: i,
          content: chunkText,
          token_count: Math.ceil(chunkText.length / 4),
          metadata: {
            source_document: name,
            chunk_index: i,
            total_chunks: textChunks.length,
          },
        });

        // Generate Embedding
        const { vector, provider } = await EmbeddingManager.embedText(chunkText);
        await db.createDocumentEmbedding({
          chunk_id: chunk.id,
          document_id: doc.id,
          org_id: orgId,
          provider,
          model: provider === 'openai' ? 'text-embedding-3-small' : 'local-semantic-128',
          vector,
        });

        createdChunks.push(chunk);
      }

      // 4. Mark Document as Processed
      await db.updateDocumentStatus(doc.id, orgId, 'processed');
      return (await db.getDocument(doc.id, orgId))!;
    } catch (err: any) {
      console.error(`[DocumentService] Error processing document ${doc.id}:`, err);
      await db.updateDocumentStatus(doc.id, orgId, 'failed');
      throw err;
    }
  }

  /**
   * Helper function to chunk text into overlapping segments based on paragraph & sentence boundaries.
   */
  static chunkText(text: string, chunkSize = 500, overlap = 50): string[] {
    if (!text || text.trim() === '') return [];

    const cleanedText = text.trim();
    if (cleanedText.length <= chunkSize) return [cleanedText];

    const chunks: string[] = [];
    let startIndex = 0;

    while (startIndex < cleanedText.length) {
      let endIndex = startIndex + chunkSize;

      if (endIndex < cleanedText.length) {
        // Try to break at paragraph boundary
        const paragraphBreak = cleanedText.lastIndexOf('\n\n', endIndex);
        if (paragraphBreak > startIndex + chunkSize / 2) {
          endIndex = paragraphBreak;
        } else {
          // Try to break at sentence boundary
          const sentenceBreak = cleanedText.lastIndexOf('. ', endIndex);
          if (sentenceBreak > startIndex + chunkSize / 2) {
            endIndex = sentenceBreak + 1;
          } else {
            // Fallback to space
            const spaceBreak = cleanedText.lastIndexOf(' ', endIndex);
            if (spaceBreak > startIndex) {
              endIndex = spaceBreak;
            }
          }
        }
      }

      const chunk = cleanedText.substring(startIndex, endIndex).trim();
      if (chunk.length > 0) {
        chunks.push(chunk);
      }

      // Advance with overlap
      startIndex = Math.max(endIndex - overlap, startIndex + 1);
      if (startIndex >= cleanedText.length) break;
    }

    return chunks;
  }
}
