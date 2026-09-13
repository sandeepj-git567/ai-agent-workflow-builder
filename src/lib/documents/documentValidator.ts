import { SupportedFileType } from './documentTypes';

export class DocumentValidator {
  private static MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10MB limit
  private static SUPPORTED_EXTENSIONS = new Set<string>(['txt', 'md', 'pdf', 'docx', 'json', 'csv', 'text']);

  static validateFile(filename: string, fileType: string, fileSizeBytes: number): { valid: boolean; reason?: string; normalizedType: SupportedFileType } {
    const ext = filename.split('.').pop()?.toLowerCase() || fileType.toLowerCase();

    if (fileSizeBytes > this.MAX_FILE_SIZE_BYTES) {
      return {
        valid: false,
        reason: `File size (${(fileSizeBytes / (1024 * 1024)).toFixed(2)}MB) exceeds maximum limit of 10MB`,
        normalizedType: 'txt',
      };
    }

    let normalizedType: SupportedFileType = 'txt';
    if (ext === 'md' || ext === 'markdown') normalizedType = 'md';
    else if (ext === 'pdf') normalizedType = 'pdf';
    else if (ext === 'docx') normalizedType = 'docx';
    else if (ext === 'json') normalizedType = 'json';
    else if (ext === 'csv') normalizedType = 'csv';
    else if (ext === 'txt' || ext === 'text') normalizedType = 'txt';
    else {
      return {
        valid: false,
        reason: `Unsupported file extension '.${ext}'. Supported formats: TXT, MD, PDF, DOCX, JSON, CSV`,
        normalizedType: 'txt',
      };
    }

    return { valid: true, normalizedType };
  }
}
