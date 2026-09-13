import type { NextApiRequest, NextApiResponse } from 'next';
import { DocumentExtractor } from '@/lib/documents/extractor';
import { DocumentService } from '@/lib/rag/documentService';
import { db } from '@/db';

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '10mb',
    },
  },
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { org_id, filename, file_type, content, metadata } = req.body;

    if (!org_id || !filename || !content) {
      return res.status(400).json({ error: 'org_id, filename, and content are required' });
    }

    // 1. Extract & validate document
    const extractionResult = DocumentExtractor.extract({
      filename,
      fileType: file_type || 'txt',
      content,
      metadata,
    });

    // 2. Ingest document into RAG vector database
    const doc = await DocumentService.ingestDocument({
      orgId: org_id,
      name: filename,
      content: extractionResult.normalizedText,
      fileType: extractionResult.fileType,
      metadata: {
        ...metadata,
        char_count: extractionResult.charCount,
        word_count: extractionResult.wordCount,
        page_count: extractionResult.pageCount,
        sections_count: extractionResult.sections?.length || 0,
      },
    });

    return res.status(201).json({
      success: true,
      document: doc,
      extraction: extractionResult,
    });
  } catch (err: any) {
    console.error('[API /api/documents/upload] Error:', err);
    return res.status(500).json({ error: err.message || 'Failed to upload and extract document' });
  }
}
