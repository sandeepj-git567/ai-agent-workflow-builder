import { DocumentExtractionResult, ExtractedPage, ParseDocumentParams } from '../documentTypes';
import { DocumentNormalizer, ExtractionQualityMetrics } from '../documentNormalizer';
import { OcrManager } from '../ocr/ocrManager';

export class PdfParser {
  /**
   * Safely parses PDF buffers and extracts clean structured text by page.
   * Handles scanned PDFs, binary stream parsing, and quality validation.
   */
  static async parseAsync(params: ParseDocumentParams): Promise<DocumentExtractionResult> {
    const buffer = this.toBuffer(params.content);
    let extractedPages: ExtractedPage[] = [];
    let rawText = '';
    let extractionMethod: 'pdf_text' | 'ocr' | 'failed' = 'pdf_text';
    let isScannedPdf = false;

    // 1. Try pdf-parse library if available
    try {
      const pdfParse = require('pdf-parse');
      const data = await pdfParse(buffer);
      if (data && data.text && data.text.trim().length > 0) {
        rawText = data.text;
        
        const rawPages = rawText.split(/\f|--- Page \d+ ---/g);
        if (rawPages.length > 1) {
          rawPages.forEach((pText, i) => {
            const cleanP = DocumentNormalizer.normalizeText(pText);
            if (cleanP.length > 0) {
              extractedPages.push({ pageNumber: i + 1, text: cleanP });
            }
          });
        }
      }
    } catch {
      // Fall back to built-in PDF stream extractor if pdf-parse fails or is unavailable
    }

    // 2. Fallback stream parsing if pdf-parse yielded no pages
    if (extractedPages.length === 0) {
      const fallbackResult = this.extractTextFromPdfBuffer(buffer);
      rawText = fallbackResult.rawText;
      extractedPages = fallbackResult.pages;
    }

    let normalizedText = DocumentNormalizer.normalizeText(rawText);
    let quality: ExtractionQualityMetrics = DocumentNormalizer.checkExtractionQuality(rawText, normalizedText);

    // 3. OCR Fallback if extraction failed or content is scanned PDF (no readable text)
    if (quality.qualityStatus === 'failed' || normalizedText.length === 0) {
      isScannedPdf = true;
      try {
        const ocrResult = await OcrManager.processDocument(buffer, 'pdf');
        if (ocrResult && ocrResult.text.length > 0) {
          rawText = ocrResult.text;
          normalizedText = DocumentNormalizer.normalizeText(rawText);
          extractedPages = ocrResult.pages.map(p => ({ pageNumber: p.pageNumber, text: DocumentNormalizer.normalizeText(p.text) }));
          extractionMethod = 'ocr';
          quality = {
            ...DocumentNormalizer.checkExtractionQuality(rawText, normalizedText),
            qualityStatus: 'failed', // Flag scanned PDFs as requiring OCR / extraction_failed for RAG validation
          };
        }
      } catch (ocrErr) {
        console.warn('[PdfParser] OCR Fallback failed:', ocrErr);
      }
    }

    // 4. Final safety fallback: If document is unreadable/corrupted scanned PDF, mark clearly
    if (quality.qualityStatus === 'failed' || normalizedText.length === 0) {
      extractionMethod = 'ocr';
      const warningMsg = '[OCR Simulated Extraction]: This PDF could not be extracted as readable text. It may be scanned or protected.';
      if (normalizedText.length === 0) {
        normalizedText = warningMsg;
        extractedPages = [{ pageNumber: 1, text: warningMsg }];
      }
    }

    if (extractedPages.length === 0) {
      extractedPages = [{ pageNumber: 1, text: normalizedText }];
    }

    return {
      filename: params.filename,
      fileType: 'pdf',
      fileSizeBytes: buffer.length,
      rawText,
      normalizedText,
      charCount: normalizedText.length,
      wordCount: DocumentNormalizer.countWords(normalizedText),
      lineCount: normalizedText.split('\n').length,
      pageCount: Math.max(extractedPages.length, 1),
      pages: extractedPages,
      metadata: {
        title: params.filename,
        pageCount: extractedPages.length,
        extractionMethod,
        qualityStatus: isScannedPdf ? 'failed' : quality.qualityStatus,
        readableCharacterRatio: quality.readableCharacterRatio,
        replacementCharacterCount: quality.replacementCharacterCount,
        suspiciousCharacterRatio: quality.suspiciousCharacterRatio,
        extractedAt: new Date().toISOString(),
        ...params.metadata,
      },
    };
  }

  /**
   * Synchronous parse entrypoint to maintain backward compatibility with ParserRegistry interface.
   */
  static parse(params: ParseDocumentParams): DocumentExtractionResult {
    const buffer = this.toBuffer(params.content);
    const { rawText, pages } = this.extractTextFromPdfBuffer(buffer);

    let normalizedText = DocumentNormalizer.normalizeText(rawText);
    let quality = DocumentNormalizer.checkExtractionQuality(typeof params.content === 'string' ? params.content : rawText, normalizedText);
    let extractionMethod: 'pdf_text' | 'ocr' | 'failed' = 'pdf_text';
    let finalPages = pages;

    if (quality.qualityStatus === 'failed' || normalizedText.length === 0) {
      extractionMethod = 'failed';
      const warningMsg = 'This PDF could not be extracted as readable text. It may be scanned or protected. Try OCR processing or upload a text-based PDF.';
      normalizedText = warningMsg;
      finalPages = [{ pageNumber: 1, text: warningMsg }];
    }

    if (finalPages.length === 0) {
      finalPages = [{ pageNumber: 1, text: normalizedText }];
    }

    return {
      filename: params.filename,
      fileType: 'pdf',
      fileSizeBytes: buffer.length,
      rawText,
      normalizedText,
      charCount: normalizedText.length,
      wordCount: DocumentNormalizer.countWords(normalizedText),
      lineCount: normalizedText.split('\n').length,
      pageCount: Math.max(finalPages.length, 1),
      pages: finalPages,
      metadata: {
        title: params.filename,
        pageCount: finalPages.length,
        extractionMethod,
        qualityStatus: quality.qualityStatus,
        readableCharacterRatio: quality.readableCharacterRatio,
        replacementCharacterCount: quality.replacementCharacterCount,
        suspiciousCharacterRatio: quality.suspiciousCharacterRatio,
        extractedAt: new Date().toISOString(),
        ...params.metadata,
      },
    };
  }

  /**
   * Converts string/base64/buffer content into a safe Buffer instance.
   */
  private static toBuffer(content: string | Buffer): Buffer {
    if (Buffer.isBuffer(content)) return content;
    if (typeof content === 'string') {
      if (content.startsWith('data:application/pdf;base64,')) {
        return Buffer.from(content.replace(/^data:application\/pdf;base64,/, ''), 'base64');
      }
      if (/^[A-Za-z0-9+/=]{100,}$/.test(content.trim().replace(/\s+/g, ''))) {
        return Buffer.from(content.trim(), 'base64');
      }
      return Buffer.from(content, 'utf-8');
    }
    return Buffer.from([]);
  }

  /**
   * Internal PDF Stream text extractor. Scans text blocks (BT...ET, Tj, TJ) in PDF streams.
   */
  private static extractTextFromPdfBuffer(buffer: Buffer): { rawText: string; pages: ExtractedPage[] } {
    const rawString = buffer.toString('binary');
    const pages: ExtractedPage[] = [];
    const textPieces: string[] = [];

    // Find stream blocks in PDF
    const streamRegex = /stream\r?\n([\s\S]*?)\r?\nendstream/gi;
    let match: RegExpExecArray | null;
    let currentPageNum = 1;

    while ((match = streamRegex.exec(rawString)) !== null) {
      const streamContent = match[1];
      
      const tjMatches = streamContent.match(/\(([^()]*)\)\s*Tj/g) || streamContent.match(/\[\s*\(([^()]*)\)\s*\]\s*TJ/g);
      
      if (tjMatches && tjMatches.length > 0) {
        const pageLines: string[] = [];
        for (const tj of tjMatches) {
          const inner = tj.replace(/^.*?\(/, '').replace(/\)\s*(Tj|TJ).*$/, '');
          const clean = inner.replace(/\\([()])/g, '$1').replace(/\\[rnt]/g, ' ').trim();
          if (clean.length > 0) {
            pageLines.push(clean);
          }
        }

        if (pageLines.length > 0) {
          const pageText = pageLines.join(' ');
          pages.push({ pageNumber: currentPageNum++, text: pageText });
          textPieces.push(pageText);
        }
      }
    }

    const rawText = textPieces.join('\n\n');
    return { rawText, pages };
  }
}
