import { DocumentExtractionResult, ParseDocumentParams } from '../documentTypes';
import { DocumentNormalizer } from '../documentNormalizer';

export class DocxParser {
  static parse(params: ParseDocumentParams): DocumentExtractionResult {
    let rawText = '';
    if (typeof params.content === 'string') {
      rawText = params.content;
    } else {
      rawText = params.content.toString('utf-8').replace(/<[^>]+>/g, ' ');
    }

    const normalizedText = DocumentNormalizer.normalizeText(rawText);
    const lines = normalizedText.split('\n');

    return {
      filename: params.filename,
      fileType: 'docx',
      fileSizeBytes: typeof params.content === 'string' ? Buffer.byteLength(params.content) : params.content.length,
      rawText,
      normalizedText,
      charCount: normalizedText.length,
      wordCount: DocumentNormalizer.countWords(normalizedText),
      lineCount: lines.length,
      pageCount: Math.max(1, Math.ceil(normalizedText.length / 3000)),
      metadata: {
        title: params.filename,
        extractedAt: new Date().toISOString(),
        ...params.metadata,
      },
    };
  }
}
