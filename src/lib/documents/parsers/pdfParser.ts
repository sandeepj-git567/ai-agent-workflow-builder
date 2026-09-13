import { DocumentExtractionResult, ExtractedPage, ParseDocumentParams } from '../documentTypes';
import { DocumentNormalizer } from '../documentNormalizer';

export class PdfParser {
  static parse(params: ParseDocumentParams): DocumentExtractionResult {
    let rawText = '';
    if (typeof params.content === 'string') {
      rawText = params.content;
    } else {
      // Decode buffer text cleanly, stripping raw PDF syntax markers if binary
      rawText = params.content.toString('utf-8').replace(/%PDF-[\s\S]*?%%EOF/g, (match) => {
        return match.replace(/[\x00-\x1F\x7F-\xFF]/g, ' ');
      });
    }

    const normalizedText = DocumentNormalizer.normalizeText(rawText);
    const pages: ExtractedPage[] = [];
    const rawPages = normalizedText.split(/Page\s+\d+|--- Page \d+ ---|\f/gi);

    if (rawPages.length > 1) {
      rawPages.forEach((pText, i) => {
        const pageClean = pText.trim();
        if (pageClean.length > 0) {
          pages.push({ pageNumber: i + 1, text: pageClean });
        }
      });
    } else {
      pages.push({ pageNumber: 1, text: normalizedText });
    }

    return {
      filename: params.filename,
      fileType: 'pdf',
      fileSizeBytes: typeof params.content === 'string' ? Buffer.byteLength(params.content) : params.content.length,
      rawText,
      normalizedText,
      charCount: normalizedText.length,
      wordCount: DocumentNormalizer.countWords(normalizedText),
      lineCount: normalizedText.split('\n').length,
      pageCount: Math.max(pages.length, 1),
      pages,
      metadata: {
        title: params.filename,
        pageCount: pages.length,
        extractedAt: new Date().toISOString(),
        ...params.metadata,
      },
    };
  }
}
