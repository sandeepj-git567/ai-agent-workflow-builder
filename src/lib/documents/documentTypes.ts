export type SupportedFileType = 'txt' | 'md' | 'pdf' | 'docx' | 'json' | 'csv' | 'text';

export type DocumentProcessingStatus =
  | 'uploaded'
  | 'processing'
  | 'extracted'
  | 'chunked'
  | 'embedded'
  | 'ready'
  | 'failed';

export interface ExtractedPage {
  pageNumber: number;
  text: string;
}

export interface ExtractedSection {
  heading: string;
  level: number;
  content: string;
}

export interface ExtractedTable {
  headers: string[];
  rows: string[][];
  caption?: string;
}

export interface DocumentExtractionResult {
  filename: string;
  fileType: SupportedFileType;
  fileSizeBytes: number;
  rawText: string;
  normalizedText: string;
  charCount: number;
  wordCount: number;
  lineCount: number;
  pageCount: number;
  pages?: ExtractedPage[];
  sections?: ExtractedSection[];
  tables?: ExtractedTable[];
  metadata: {
    title?: string;
    author?: string;
    creationDate?: string;
    language?: string;
    encoding?: string;
    extractedAt: string;
    [key: string]: any;
  };
}

export interface ParseDocumentParams {
  filename: string;
  fileType: SupportedFileType;
  content: string | Buffer;
  mimeType?: string;
  metadata?: Record<string, any>;
}
