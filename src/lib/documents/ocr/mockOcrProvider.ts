import { OcrProvider, OcrResult } from './ocrTypes';

export class MockOcrProvider implements OcrProvider {
  name = 'mock_ocr';

  isConfigured(): boolean {
    return true; // Always available as local fallback for development
  }

  async processDocument(buffer: Buffer, fileType: string): Promise<OcrResult> {
    const fileSizeKb = (buffer.length / 1024).toFixed(1);
    const text = `[OCR Simulated Extraction]: Document (${fileType.toUpperCase()}, ${fileSizeKb} KB) requires OCR processing. No raw embedded text was detected in PDF structure.`;

    return {
      text,
      confidence: 0.85,
      pageCount: 1,
      pages: [{ pageNumber: 1, text }],
      providerName: this.name,
      isMock: true,
    };
  }
}
