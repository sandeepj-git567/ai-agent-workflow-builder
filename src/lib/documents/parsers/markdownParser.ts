import { DocumentExtractionResult, ExtractedSection, ParseDocumentParams } from '../documentTypes';
import { DocumentNormalizer } from '../documentNormalizer';

export class MarkdownParser {
  static parse(params: ParseDocumentParams): DocumentExtractionResult {
    const rawText = typeof params.content === 'string' ? params.content : params.content.toString('utf-8');
    const normalizedText = DocumentNormalizer.normalizeText(rawText);
    const lines = normalizedText.split('\n');

    const sections: ExtractedSection[] = [];
    let currentHeading = 'Overview';
    let currentLevel = 1;
    let currentContent: string[] = [];

    for (const line of lines) {
      const headingMatch = line.match(/^(#{1,6})\s+(.+)$/);
      if (headingMatch) {
        if (currentContent.length > 0) {
          sections.push({
            heading: currentHeading,
            level: currentLevel,
            content: currentContent.join('\n').trim(),
          });
          currentContent = [];
        }
        currentLevel = headingMatch[1].length;
        currentHeading = headingMatch[2].trim();
      } else {
        currentContent.push(line);
      }
    }

    if (currentContent.length > 0) {
      sections.push({
        heading: currentHeading,
        level: currentLevel,
        content: currentContent.join('\n').trim(),
      });
    }

    return {
      filename: params.filename,
      fileType: 'md',
      fileSizeBytes: typeof params.content === 'string' ? Buffer.byteLength(params.content) : params.content.length,
      rawText,
      normalizedText,
      charCount: normalizedText.length,
      wordCount: DocumentNormalizer.countWords(normalizedText),
      lineCount: lines.length,
      pageCount: Math.max(1, Math.ceil(normalizedText.length / 3000)),
      sections,
      metadata: {
        title: sections[0]?.heading || params.filename,
        sectionCount: sections.length,
        extractedAt: new Date().toISOString(),
        ...params.metadata,
      },
    };
  }
}
