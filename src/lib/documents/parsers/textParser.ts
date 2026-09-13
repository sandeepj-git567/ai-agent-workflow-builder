import { DocumentExtractionResult, ParseDocumentParams } from '../documentTypes';
import { DocumentNormalizer } from '../documentNormalizer';

export class TextParser {
  static parse(params: ParseDocumentParams): DocumentExtractionResult {
    const rawText = typeof params.content === 'string' ? params.content : params.content.toString('utf-8');
    const normalizedText = DocumentNormalizer.normalizeText(rawText);
    const lines = normalizedText.split('\n');

    return {
      filename: params.filename,
      fileType: params.fileType,
      fileSizeBytes: typeof params.content === 'string' ? Buffer.byteLength(params.content) : params.content.length,
      rawText,
      normalizedText,
      charCount: normalizedText.length,
      wordCount: DocumentNormalizer.countWords(normalizedText),
      lineCount: lines.length,
      pageCount: Math.max(1, Math.ceil(normalizedText.length / 3000)),
      pages: [
        {
          pageNumber: 1,
          text: normalizedText,
        },
      ],
      metadata: {
        title: params.filename,
        extractedAt: new Date().toISOString(),
        ...params.metadata,
      },
    };
  }
}
