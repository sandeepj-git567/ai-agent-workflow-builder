import { OcrProvider, OcrResult } from './ocrTypes';
import { MockOcrProvider } from './mockOcrProvider';
import { TesseractOcrProvider } from './tesseractProvider';

export class OcrManager {
  private static providers: OcrProvider[] = [
    new TesseractOcrProvider(),
    new MockOcrProvider(),
  ];

  static getActiveProvider(): OcrProvider {
    const configured = this.providers.find(p => p.isConfigured() && p.name !== 'mock_ocr');
    return configured || this.providers.find(p => p.name === 'mock_ocr')!;
  }

  static async processDocument(buffer: Buffer, fileType: string): Promise<OcrResult> {
    const provider = this.getActiveProvider();
    return provider.processDocument(buffer, fileType);
  }
}
