import { describe, it, expect } from 'vitest';
import { DocumentExtractor } from '@/lib/documents/extractor';
import { DetailExtractor } from '@/lib/documents/detailExtractor';
import { DocumentValidator } from '@/lib/documents/documentValidator';

describe('Document Intelligence Pipeline', () => {
  it('validates file formats and rejects oversized or invalid extensions', () => {
    const validTxt = DocumentValidator.validateFile('specs.txt', 'txt', 1024);
    expect(validTxt.valid).toBe(true);

    const validMd = DocumentValidator.validateFile('README.md', 'md', 2048);
    expect(validMd.valid).toBe(true);
    expect(validMd.normalizedType).toBe('md');

    const oversized = DocumentValidator.validateFile('huge.pdf', 'pdf', 15 * 1024 * 1024);
    expect(oversized.valid).toBe(false);
    expect(oversized.reason).toContain('exceeds maximum limit');

    const invalidExt = DocumentValidator.validateFile('malicious.exe', 'exe', 100);
    expect(invalidExt.valid).toBe(false);
    expect(invalidExt.reason).toContain('Unsupported file extension');
  });

  it('extracts Markdown headings and sections', () => {
    const mdContent = `# System Overview\nThis is system text.\n## Functional Requirements\n- Must authenticate users.\n- Must log events.`;
    const result = DocumentExtractor.extract({
      filename: 'architecture.md',
      fileType: 'md',
      content: mdContent,
    });

    expect(result.fileType).toBe('md');
    expect(result.sections).toBeDefined();
    expect(result.sections!.length).toBe(2);
    expect(result.sections![0].heading).toBe('System Overview');
    expect(result.sections![1].heading).toBe('Functional Requirements');
  });

  it('extracts CSV headers and rows as structured tables', () => {
    const csvContent = `id,name,role\n1,Alice,Owner\n2,Edward,Editor`;
    const result = DocumentExtractor.extract({
      filename: 'team.csv',
      fileType: 'csv',
      content: csvContent,
    });

    expect(result.fileType).toBe('csv');
    expect(result.tables).toBeDefined();
    expect(result.tables![0].headers).toEqual(['id', 'name', 'role']);
    expect(result.tables![0].rows.length).toBe(2);
  });

  it('extracts structured details from document text using DetailExtractor', async () => {
    const sampleText = `# E-Commerce Platform Architecture Requirements
Purpose: Build a scalable online retail system.
Requirements:
1. User Registration and Login.
2. Payment gateway integration with Stripe.
Risks: Third party payment gateway latency.`;

    const details = await DetailExtractor.extractDetails('doc-101', 'E-Commerce Spec.md', sampleText);
    expect(details.title).toBe('E-Commerce Spec.md');
    expect(details.summary).toBeDefined();
    expect(details.requirements.length).toBeGreaterThanOrEqual(1);
    expect(details.sourceReferences.length).toBeGreaterThanOrEqual(1);
  });
});
