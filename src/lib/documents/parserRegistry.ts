import { DocumentExtractionResult, ParseDocumentParams } from './documentTypes';
import { TextParser } from './parsers/textParser';
import { MarkdownParser } from './parsers/markdownParser';
import { JsonParser } from './parsers/jsonParser';
import { CsvParser } from './parsers/csvParser';
import { PdfParser } from './parsers/pdfParser';
import { DocxParser } from './parsers/docxParser';

export class ParserRegistry {
  static parseDocument(params: ParseDocumentParams): DocumentExtractionResult {
    switch (params.fileType) {
      case 'md':
        return MarkdownParser.parse(params);
      case 'json':
        return JsonParser.parse(params);
      case 'csv':
        return CsvParser.parse(params);
      case 'pdf':
        return PdfParser.parse(params);
      case 'docx':
        return DocxParser.parse(params);
      case 'txt':
      case 'text':
      default:
        return TextParser.parse(params);
    }
  }
}
