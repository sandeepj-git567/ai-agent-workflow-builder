import { DocumentExtractionResult, ExtractedTable, ParseDocumentParams } from '../documentTypes';
import { DocumentNormalizer } from '../documentNormalizer';

export class CsvParser {
  static parse(params: ParseDocumentParams): DocumentExtractionResult {
    const rawText = typeof params.content === 'string' ? params.content : params.content.toString('utf-8');
    const normalizedText = DocumentNormalizer.normalizeText(rawText);
    const lines = normalizedText.split('\n').filter(l => l.trim().length > 0);

    const headers = lines[0] ? lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, '')) : [];
    const rows = lines.slice(1).map(line => line.split(',').map(cell => cell.trim().replace(/^"|"$/g, '')));

    const tables: ExtractedTable[] = [
      {
        headers,
        rows,
        caption: params.filename,
      },
    ];

    return {
      filename: params.filename,
      fileType: 'csv',
      fileSizeBytes: typeof params.content === 'string' ? Buffer.byteLength(params.content) : params.content.length,
      rawText,
      normalizedText,
      charCount: normalizedText.length,
      wordCount: DocumentNormalizer.countWords(normalizedText),
      lineCount: lines.length,
      pageCount: Math.max(1, Math.ceil(normalizedText.length / 3000)),
      tables,
      metadata: {
        title: params.filename,
        rowCount: rows.length,
        columnCount: headers.length,
        headers,
        extractedAt: new Date().toISOString(),
        ...params.metadata,
      },
    };
  }
}
