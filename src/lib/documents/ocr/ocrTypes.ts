export interface OcrPage {
  pageNumber: number;
  text: string;
  confidence?: number;
}

export interface OcrResult {
  text: string;
  confidence: number;
  pageCount: number;
  pages: OcrPage[];
  providerName: string;
  isMock?: boolean;
}

export interface OcrProvider {
  name: string;
  isConfigured(): boolean;
  processDocument(buffer: Buffer, fileType: string): Promise<OcrResult>;
}
