export interface ExtractionQualityMetrics {
  totalChars: number;
  readableCharacterRatio: number;
  replacementCharacterCount: number;
  suspiciousCharacterRatio: number;
  qualityStatus: 'good' | 'warning' | 'failed';
  isCorrupted: boolean;
  reason?: string;
}

export class DocumentNormalizer {
  /**
   * Normalizes document text by stripping raw PDF binary markers, control characters,
   * normalizing line breaks, and cleaning zero-width spaces.
   */
  static normalizeText(text: string): string {
    if (!text) return '';

    return text
      // Remove raw PDF binary stream header/footer artifacts if present in decoded string
      .replace(/%PDF-\d\.\d[\s\S]*?%%EOF/gi, '')
      .replace(/stream[\s\S]*?endstream/gi, '')
      .replace(/\r\n/g, '\n')
      .replace(/\r/g, '\n')
      // Remove null bytes, replacement chars, and non-printable control chars (except tabs & newlines)
      .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F\uFFFD]/g, '')
      // Replace multiple consecutive spaces
      .replace(/[ \t]{2,}/g, ' ')
      // Replace multiple consecutive blank lines (>2) with double newline
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  }

  /**
   * Evaluates text quality and detects corrupted binary garbage or scanned PDFs.
   * Uses Unicode property escapes so foreign languages (Kannada, Hindi, Tamil, Japanese, etc.) are recognized as valid readable text.
   */
  static checkExtractionQuality(rawText: string, text: string): ExtractionQualityMetrics {
    const cleanText = text || '';
    const totalChars = cleanText.length;

    // Count replacement characters (\uFFFD) in clean text only
    const replacementMatch = cleanText.match(/\uFFFD/g);
    const replacementCharacterCount = replacementMatch ? replacementMatch.length : 0;

    if (totalChars === 0) {
      return {
        totalChars: 0,
        readableCharacterRatio: 0,
        replacementCharacterCount,
        suspiciousCharacterRatio: 1.0,
        qualityStatus: 'failed',
        isCorrupted: true,
        reason: 'No readable text content extracted (Empty or Scanned document).',
      };
    }

    // Count printable Unicode letters, numbers, punctuation, symbols, and spaces across all languages
    const readableMatch = cleanText.match(/[\p{L}\p{N}\p{P}\p{Z}\s]/gu);
    const readableCount = readableMatch ? readableMatch.length : 0;
    const readableCharacterRatio = Math.min(1.0, readableCount / Math.max(1, totalChars));

    // Count non-printable or control symbols in clean text
    const suspiciousMatch = cleanText.match(/[\x00-\x1F\x7F-\x9F]/g);
    const suspiciousCount = suspiciousMatch ? suspiciousMatch.length : 0;
    const suspiciousCharacterRatio = suspiciousCount / Math.max(1, totalChars);

    // Check for raw PDF syntax signatures (e.g. %PDF-, obj, endobj, trailer, xref)
    const containsRawPdfMarkers = /%PDF-|\bobj\b|\bendobj\b|\bstream\b|\bendstream\b|\btrailer\b|\bxref\b/i.test(cleanText);

    let qualityStatus: 'good' | 'warning' | 'failed' = 'good';
    let isCorrupted = false;
    let reason: string | undefined;

    if (replacementCharacterCount > 5 || containsRawPdfMarkers || readableCharacterRatio < 0.40 || suspiciousCharacterRatio > 0.20) {
      qualityStatus = 'failed';
      isCorrupted = true;
      reason = 'Extracted text contains binary garbage, replacement characters, or PDF code syntax.';
    } else if (readableCharacterRatio < 0.70 || replacementCharacterCount > 0) {
      qualityStatus = 'warning';
      reason = 'Extracted text contains low readable character ratio or minor encoding anomalies.';
    }

    return {
      totalChars,
      readableCharacterRatio: Number(readableCharacterRatio.toFixed(3)),
      replacementCharacterCount,
      suspiciousCharacterRatio: Number(suspiciousCharacterRatio.toFixed(3)),
      qualityStatus,
      isCorrupted,
      reason,
    };
  }

  /**
   * Counts words accurately across spaces and punctuation.
   */
  static countWords(text: string): number {
    if (!text || text.trim() === '') return 0;
    return text.trim().split(/\s+/).length;
  }
}
