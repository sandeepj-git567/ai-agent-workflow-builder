import { DocumentExtractionResult, ParseDocumentParams } from '../documentTypes';
import { DocumentNormalizer } from '../documentNormalizer';

export class JsonParser {
  static parse(params: ParseDocumentParams): DocumentExtractionResult {
    const rawText = typeof params.content === 'string' ? params.content : params.content.toString('utf-8');
    let parsedObj: any = null;
    let formattedText = rawText;

    try {
      parsedObj = JSON.parse(rawText);
      formattedText = JSON.stringify(parsedObj, null, 2);
    } catch (e) {
      formattedText = rawText;
    }

    const normalizedText = DocumentNormalizer.normalizeText(formattedText);
    const lines = normalizedText.split('\n');

    return {
      filename: params.filename,
      fileType: 'json',
      fileSizeBytes: typeof params.content === 'string' ? Buffer.byteLength(params.content) : params.content.length,
      rawText,
      normalizedText,
      charCount: normalizedText.length,
      wordCount: DocumentNormalizer.countWords(normalizedText),
      lineCount: lines.length,
      pageCount: Math.max(1, Math.ceil(normalizedText.length / 3000)),
      metadata: {
        title: params.filename,
        isJsonObject: typeof parsedObj === 'object' && parsedObj !== null,
        topLevelKeys: typeof parsedObj === 'object' && parsedObj !== null && !Array.isArray(parsedObj) ? Object.keys(parsedObj) : [],
        extractedAt: new Date().toISOString(),
        ...params.metadata,
      },
    };
  }
}
