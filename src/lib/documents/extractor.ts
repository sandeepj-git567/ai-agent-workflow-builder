import { DocumentExtractionResult, ParseDocumentParams } from './documentTypes';
import { DocumentValidator } from './documentValidator';
import { ParserRegistry } from './parserRegistry';

export class DocumentExtractor {
  static extract(params: ParseDocumentParams): DocumentExtractionResult {
    const fileSizeBytes = typeof params.content === 'string' ? Buffer.byteLength(params.content) : params.content.length;
    const validation = DocumentValidator.validateFile(params.filename, params.fileType, fileSizeBytes);

    if (!validation.valid) {
      throw new Error(`Document Validation Error: ${validation.reason}`);
    }

    const result = ParserRegistry.parseDocument({
      ...params,
      fileType: validation.normalizedType,
    });

    return result;
  }
}
