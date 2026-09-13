import crypto from 'crypto';
import { db } from '@/db';
import { Document, DocumentChunk } from '@/types';
import { EmbeddingManager } from './embeddings';
import { DocumentExtractor } from '../documents/extractor';
import { DocumentNormalizer } from '../documents/documentNormalizer';
import { ExtractedPage } from '../documents/documentTypes';

export interface IngestDocumentParams {
  orgId: string;
  name: string;
  content: string | Buffer;
  fileType?: string;
  sourceUrl?: string;
  metadata?: Record<string, any>;
  chunkSize?: number;
  chunkOverlap?: number;
}

export class DocumentService {
  /**
   * Ingests a raw document, performs text extraction, validates quality,
   * handles page-aware chunking with SHA-256 deduplication, generates embeddings, and persists all chunks.
   */
  static async ingestDocument(params: IngestDocumentParams): Promise<Document> {
    const { orgId, name, content, fileType = 'text', sourceUrl, metadata = {} } = params;
    const chunkSize = params.chunkSize || 500;
    const chunkOverlap = params.chunkOverlap || 50;

    // 1. Extract & validate document
    const extractionResult = await DocumentExtractor.extractAsync({
      filename: name,
      fileType: fileType as any,
      content,
      metadata,
    });

    const extractionQuality = DocumentNormalizer.checkExtractionQuality(
      extractionResult.rawText,
      extractionResult.normalizedText
    );

    const isExtractionFailed =
      extractionResult.metadata?.qualityStatus === 'failed' ||
      extractionResult.metadata?.extractionMethod === 'failed' ||
      extractionQuality.qualityStatus === 'failed' ||
      extractionResult.normalizedText.includes('This PDF could not be extracted as readable text');

    // 2. Create Document Record
    const doc = await db.createDocument({
      org_id: orgId,
      name,
      file_type: extractionResult.fileType,
      source_url: sourceUrl,
      content: extractionResult.normalizedText,
      metadata: {
        ...metadata,
        char_count: extractionResult.charCount,
        word_count: extractionResult.wordCount,
        page_count: extractionResult.pageCount,
        quality_status: isExtractionFailed ? 'failed' : extractionQuality.qualityStatus,
        extraction_method: extractionResult.metadata?.extractionMethod || 'text',
        readable_ratio: extractionQuality.readableCharacterRatio,
        replacement_count: extractionQuality.replacementCharacterCount,
        suspicious_ratio: extractionQuality.suspiciousCharacterRatio,
        chunk_size: chunkSize,
        chunk_overlap: chunkOverlap,
      },
    });

    if (isExtractionFailed) {
      await db.updateDocumentStatus(doc.id, orgId, 'failed');
      const failedDoc = await db.getDocument(doc.id, orgId);
      return failedDoc || doc;
    }

    try {
      // 3. Perform Page-Aware Text Chunking
      const pageChunks = this.chunkPages(extractionResult.pages || [], chunkSize, chunkOverlap, extractionResult.normalizedText);
      const createdChunks: DocumentChunk[] = [];
      const seenHashes = new Set<string>();

      let chunkIndex = 0;
      for (const pChunk of pageChunks) {
        const normalizedChunk = DocumentNormalizer.normalizeText(pChunk.text);
        if (!normalizedChunk || normalizedChunk.length < 5) continue;

        // Compute SHA-256 contentHash for idempotent chunking
        const contentHash = crypto
          .createHash('sha256')
          .update(`${doc.id}:${pChunk.pageNumber}:${normalizedChunk}`)
          .digest('hex');

        // Deduplicate chunks within the document
        if (seenHashes.has(contentHash)) {
          continue;
        }
        seenHashes.add(contentHash);

        const chunk = await db.createDocumentChunk({
          document_id: doc.id,
          org_id: orgId,
          chunk_index: chunkIndex++,
          content: normalizedChunk,
          token_count: Math.ceil(normalizedChunk.length / 4),
          metadata: {
            source_document: name,
            page_number: pChunk.pageNumber,
            section_title: pChunk.sectionTitle || `Page ${pChunk.pageNumber}`,
            content_hash: contentHash,
            extraction_method: extractionResult.metadata?.extractionMethod || 'text',
            quality_status: extractionQuality.qualityStatus,
            chunk_index: chunkIndex - 1,
          },
        });

        // Generate Embedding only for valid readable text
        const { vector, provider } = await EmbeddingManager.embedText(normalizedChunk);
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
   * Page-aware chunking function that retains page number and section title for every chunk segment.
   */
  static chunkPages(
    pages: ExtractedPage[],
    chunkSize = 500,
    overlap = 50,
    fallbackText = ''
  ): Array<{ pageNumber: number; sectionTitle?: string; text: string }> {
    const results: Array<{ pageNumber: number; sectionTitle?: string; text: string }> = [];

    if (pages && pages.length > 0) {
      for (const page of pages) {
        const pageText = page.text.trim();
        if (!pageText) continue;

        const chunks = this.chunkText(pageText, chunkSize, overlap);
        for (const cText of chunks) {
          results.push({
            pageNumber: page.pageNumber,
            sectionTitle: `Page ${page.pageNumber}`,
            text: cText,
          });
        }
      }
    } else if (fallbackText.trim()) {
      const chunks = this.chunkText(fallbackText, chunkSize, overlap);
      for (const cText of chunks) {
        results.push({
          pageNumber: 1,
          sectionTitle: 'Section 1',
          text: cText,
        });
      }
    }

    return results;
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
