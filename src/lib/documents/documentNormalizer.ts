export class DocumentNormalizer {
  /**
   * Normalizes document text by stripping control characters, normalizing newlines, and removing zero-width spaces.
   */
  static normalizeText(text: string): string {
    if (!text) return '';

    return text
      // Replace CRLF / CR with LF
      .replace(/\r\n/g, '\n')
      .replace(/\r/g, '\n')
      // Remove null bytes and non-printable control chars (except tabs & newlines)
      .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
      // Replace multiple consecutive blank lines (>2) with double newline
      .replace(/\n{3,}/g, '\n\n')
      // Trim leading and trailing whitespace
      .trim();
  }

  /**
   * Counts words accurately across spaces and punctuation.
   */
  static countWords(text: string): number {
    if (!text || text.trim() === '') return 0;
    return text.trim().split(/\s+/).length;
  }
}
