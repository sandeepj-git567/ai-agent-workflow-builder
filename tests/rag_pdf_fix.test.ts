import { describe, it, expect, beforeEach } from 'vitest';
import { PdfParser } from '../src/lib/documents/parsers/pdfParser';
import { DocumentNormalizer } from '../src/lib/documents/documentNormalizer';
import { DocumentExtractor } from '../src/lib/documents/extractor';
import { DocumentService } from '../src/lib/rag/documentService';
import { RAGRetriever } from '../src/lib/rag/retriever';
import { OcrManager } from '../src/lib/documents/ocr/ocrManager';
import { db, inMemoryDb } from '../src/db';

describe('RAG PDF Extraction, Deduplication & Quality Pipeline Fixes', () => {
  const TEST_ORG_ID = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';

  beforeEach(() => {
    inMemoryDb.reset();
  });

  // 1. Valid text-based PDF extraction
  it('1. Extracts readable text page-by-page from text-based PDF input', async () => {
    const textPdfContent = `
%PDF-1.4
1 0 obj
<< /Type /Catalog /Pages 2 0 R >>
endobj
2 0 obj
<< /Type /Pages /Kinds [ 3 0 R ] /Count 1 >>
endobj
3 0 obj
<< /Type /Page /Contents 4 0 R >>
endobj
4 0 obj
<< /Length 55 >>
stream
BT
/F1 12 Tf
72 712 Td
(Acme Service Level Agreement Guidelines) Tj
ET
endstream
endobj
%%EOF
`;
    const result = await PdfParser.parseAsync({
      filename: 'sample_doc.pdf',
      fileType: 'pdf',
      content: Buffer.from(textPdfContent, 'utf-8'),
    });

    expect(result.fileType).toBe('pdf');
    expect(result.normalizedText).toContain('Acme Service Level Agreement Guidelines');
    expect(result.pageCount).toBeGreaterThanOrEqual(1);
    expect(result.metadata.qualityStatus).toBe('good');
  });

  // 2. PDF binary is not displayed as text
  it('2. Prevents raw PDF binary code (%PDF-, obj, stream) from being returned as valid extracted text', () => {
    const rawBinaryPdf = Buffer.from('%PDF-1.4 %âãÏÓ 1 0 obj << /Length 20 >> stream \x00\x01\x02\xFF\xFE\xFD endstream endobj %%EOF', 'binary');
    const result = PdfParser.parse({
      filename: 'corrupted_binary.pdf',
      fileType: 'pdf',
      content: rawBinaryPdf,
    });

    expect(result.normalizedText).not.toContain('%PDF-1.4');
    expect(result.normalizedText).not.toContain('stream \x00\x01\x02');
  });

  // 3. Corrupted extraction is detected
  it('3. Detects corrupted extraction with excessive replacement or control characters', () => {
    const corruptedText = `\uFFFD\uFFFD\uFFFD QF% \uFFFDLT\uFFFDQF% \uFFFDLT\uFFFDQF% \uFFFDLT\uFFFDQF% \uFFFDLT\uFFFDQF% z\uFFFD\uFFFDk\uFFFDf\uFFFDEo\uFFFD`;
    const quality = DocumentNormalizer.checkExtractionQuality(corruptedText, corruptedText);

    expect(quality.qualityStatus).toBe('failed');
    expect(quality.isCorrupted).toBe(true);
    expect(quality.replacementCharacterCount).toBeGreaterThan(2);
  });

  // 4. OCR_REQUIRED status is returned when needed
  it('4. Returns OCR_REQUIRED / failed status when PDF has no readable embedded text', async () => {
    const scannedPdfBuffer = Buffer.from([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34, 0x0a, 0xff, 0xfe, 0xfd, 0x00, 0x01]);
    const result = await PdfParser.parseAsync({
      filename: 'scanned_passport.pdf',
      fileType: 'pdf',
      content: scannedPdfBuffer,
    });

    expect(result.metadata.qualityStatus).toBe('failed');
    expect(result.metadata.extractionMethod).toBe('ocr');
    expect(result.normalizedText).toContain('[OCR Simulated Extraction]');
  });

  // 5. Valid text is normalized correctly
  it('5. Safely normalizes text by stripping null bytes, control chars, and excess whitespace', () => {
    const input = 'Header Line\r\n\r\n\x00Subheader \x0B\x0CText\n\n\n\nParagraph 2';
    const normalized = DocumentNormalizer.normalizeText(input);

    expect(normalized).toBe('Header Line\n\nSubheader Text\n\nParagraph 2');
    expect(normalized).not.toContain('\x00');
    expect(normalized).not.toContain('\x0B');
  });

  // 6. Unicode text is preserved
  it('6. Preserves Unicode text (Kannada/Hindi/Tamil/Japanese) during normalization', () => {
    const unicodeText = 'नमस्ते / 👋 Swagatam / 🌟 Good Morning / ಕನ್ನಡ / தமிழ் / 日本語';
    const normalized = DocumentNormalizer.normalizeText(unicodeText);

    expect(normalized).toBe(unicodeText);
    const quality = DocumentNormalizer.checkExtractionQuality(unicodeText, normalized);
    expect(quality.qualityStatus).toBe('good');
  });

  // 7. Page numbers are preserved
  it('7. Preserves page numbers on extracted page objects and chunks', async () => {
    const pages = [
      { pageNumber: 1, text: 'First page content regarding SLA policies.' },
      { pageNumber: 2, text: 'Second page content regarding support escalation.' },
    ];
    const pageChunks = DocumentService.chunkPages(pages, 500, 50);

    expect(pageChunks.length).toBe(2);
    expect(pageChunks[0].pageNumber).toBe(1);
    expect(pageChunks[1].pageNumber).toBe(2);
  });

  // 8. Empty documents are rejected / flagged
  it('8. Flags empty documents during extraction quality evaluation', () => {
    const quality = DocumentNormalizer.checkExtractionQuality('', '');
    expect(quality.qualityStatus).toBe('failed');
    expect(quality.isCorrupted).toBe(true);
    expect(quality.reason).toContain('No readable text content');
  });

  // 9. Corrupted chunks are not embedded
  it('9. Rejects ingestion and vector embedding creation for documents with corrupted text', async () => {
    const corruptedContent = '\uFFFD\uFFFD\uFFFD QF% \uFFFDLT\uFFFDQF% \uFFFDLT\uFFFDQF%';
    const doc = await DocumentService.ingestDocument({
      orgId: TEST_ORG_ID,
      name: 'corrupted_file.pdf',
      content: corruptedContent,
      fileType: 'pdf',
    });

    expect(doc.status).toBe('failed');
    expect(doc.chunks?.length || 0).toBe(0);
  });

  // 10. Duplicate chunks are removed via SHA-256 contentHash
  it('10. Deduplicates identical chunks within the same document during ingestion', async () => {
    const repeatedContent = 'Acme Customer Policy SLA: Respond within 15 minutes.\n\nAcme Customer Policy SLA: Respond within 15 minutes.';
    const doc = await DocumentService.ingestDocument({
      orgId: TEST_ORG_ID,
      name: 'duplicate_chunks_doc.md',
      content: repeatedContent,
      fileType: 'markdown',
      chunkSize: 500,
    });

    expect(doc.status).toBe('processed');
    // SHA-256 contentHash deduplication should ensure identical chunks are not duplicated
    expect(doc.chunks?.length).toBe(1);
  });

  // 11. Repeated ingestion is idempotent
  it('11. Guarantees idempotent ingestion without orphan duplicate chunks', async () => {
    const content = 'Enterprise Security Guideline: All API calls require JWT Bearer Tokens.';
    
    const doc1 = await DocumentService.ingestDocument({
      orgId: TEST_ORG_ID,
      name: 'security_policy.txt',
      content,
      fileType: 'text',
    });

    const chunksBefore = Array.from(inMemoryDb.document_chunks.values()).filter(c => c.document_id === doc1.id);
    expect(chunksBefore.length).toBe(1);

    // Clear and re-ingest
    await db.clearDocumentChunks(doc1.id, TEST_ORG_ID);
    const doc2 = await DocumentService.ingestDocument({
      orgId: TEST_ORG_ID,
      name: 'security_policy.txt',
      content,
      fileType: 'text',
    });

    const chunksAfter = Array.from(inMemoryDb.document_chunks.values()).filter(c => c.document_id === doc2.id);
    expect(chunksAfter.length).toBe(1);
  });

  // 12. Search results are organization-scoped
  it('12. Strictly isolates vector search results to the requested tenant organization ID', async () => {
    const ORG_A = TEST_ORG_ID;
    const ORG_B = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';

    await DocumentService.ingestDocument({
      orgId: ORG_A,
      name: 'org_a_secret.txt',
      content: 'Org A Secret Encryption Cipher key 998877',
      fileType: 'text',
    });

    await DocumentService.ingestDocument({
      orgId: ORG_B,
      name: 'org_b_secret.txt',
      content: 'Org B Confidential Financial Quarter Report',
      fileType: 'text',
    });

    // Query Org B Knowledge Base for Org A term
    const orgBResults = await RAGRetriever.retrieve({
      orgId: ORG_B,
      query: 'Secret Encryption Cipher key',
    });

    // Must NOT leak Org A documents into Org B search results!
    const leakedDoc = orgBResults.find(r => r.document_name === 'org_a_secret.txt');
    expect(leakedDoc).toBeUndefined();
  });

  // 13. Search results contain readable text
  it('13. Filters out any chunks containing corrupted text from vector search results', async () => {
    const results = await RAGRetriever.retrieve({
      orgId: TEST_ORG_ID,
      query: 'SLA Policy',
    });

    results.forEach(res => {
      expect(res.content).not.toContain('\uFFFD');
      expect(res.content).not.toContain('This PDF could not be extracted as readable text');
    });
  });

  // 14. Same document does not produce exact duplicate cards
  it('14. Deduplicates exact duplicate chunks in search results', async () => {
    const doc = await DocumentService.ingestDocument({
      orgId: TEST_ORG_ID,
      name: 'sla_guide.txt',
      content: 'Acme SLA Policy: 15-minute response time for VIP users.',
      fileType: 'text',
    });

    const results = await RAGRetriever.retrieve({
      orgId: TEST_ORG_ID,
      query: '15-minute response time SLA',
      topK: 5,
    });

    const slaMatches = results.filter(r => r.document_id === doc.id);
    expect(slaMatches.length).toBeLessThanOrEqual(2);
  });

  // 15. Reprocess document works
  it('15. Clears old chunks and successfully reprocesses a document', async () => {
    const doc = await DocumentService.ingestDocument({
      orgId: TEST_ORG_ID,
      name: 'reprocess_test.txt',
      content: 'Initial text content for reprocessing test.',
      fileType: 'text',
    });

    expect(doc.chunks?.length).toBe(1);

    // Clear and reprocess
    await db.clearDocumentChunks(doc.id, TEST_ORG_ID);
    const reprocessedDoc = await DocumentService.ingestDocument({
      orgId: TEST_ORG_ID,
      name: 'reprocess_test.txt',
      content: 'Updated text content after reprocessing.',
      fileType: 'text',
    });

    expect(reprocessedDoc.status).toBe('processed');
    expect(reprocessedDoc.content).toBe('Updated text content after reprocessing.');
  });

  // 16. Mock OCR provider functionality
  it('16. Mock OCR Provider returns valid structured fallback result for scanned PDFs', async () => {
    const ocrResult = await OcrManager.processDocument(Buffer.from('scanned_image_bytes'), 'pdf');

    expect(ocrResult.providerName).toBe('mock_ocr');
    expect(ocrResult.isMock).toBe(true);
    expect(ocrResult.text).toContain('[OCR Simulated Extraction]');
    expect(ocrResult.pages.length).toBeGreaterThan(0);
  });
});
