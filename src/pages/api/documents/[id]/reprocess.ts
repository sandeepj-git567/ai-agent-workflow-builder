import type { NextApiRequest, NextApiResponse } from 'next';
import { db } from '@/db';
import { DocumentExtractor } from '@/lib/documents/extractor';
import { DocumentNormalizer } from '@/lib/documents/documentNormalizer';
import { DocumentService } from '@/lib/rag/documentService';

// Concurrent job locks map to ensure idempotency
const processingLocks = new Set<string>();

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  const { id: docId } = req.query;
  const userId = (req.headers['x-hasura-user-id'] || req.headers['authorization']?.replace('Bearer ', '') || '') as string;

  if (!userId) {
    return res.status(401).json({ message: '401: Unauthorized — Authentication required' });
  }

  if (!docId || typeof docId !== 'string') {
    return res.status(400).json({ message: 'Valid document ID is required' });
  }

  const memberships = await db.getUserMemberships(userId);
  if (!memberships || memberships.length === 0) {
    return res.status(403).json({ message: '403: Forbidden — User does not belong to any organization' });
  }

  const primaryOrgId = memberships[0].org_id;
  const member = await db.getOrgMember(userId, primaryOrgId);

  if (!member || member.role === 'viewer') {
    return res.status(403).json({ message: '403: Forbidden — Insufficient permissions to reprocess documents' });
  }

  if (processingLocks.has(docId)) {
    return res.status(409).json({ message: '409: Conflict — Document is already being processed' });
  }

  processingLocks.add(docId);
  const startTime = Date.now();

  try {
    const doc = await db.getDocument(docId, primaryOrgId);
    if (!doc) {
      return res.status(404).json({ message: '404: Document not found or access denied' });
    }

    // 1. Clear existing chunks and embeddings
    await db.clearDocumentChunks(doc.id, primaryOrgId);
    await db.updateDocumentStatus(doc.id, primaryOrgId, 'pending');

    // 2. Perform Extraction & Quality Validation
    const extractionResult = await DocumentExtractor.extractAsync({
      filename: doc.name,
      fileType: doc.file_type as any,
      content: doc.content,
      metadata: doc.metadata,
    });

    const qualityMetrics = DocumentNormalizer.checkExtractionQuality(
      extractionResult.rawText,
      extractionResult.normalizedText
    );

    let finalStatus: 'processed' | 'failed' = 'processed';

    if (qualityMetrics.qualityStatus === 'failed') {
      finalStatus = 'failed';
      await db.updateDocumentStatus(doc.id, primaryOrgId, 'failed');
    } else {
      // Re-ingest chunks into database
      const reIngestedDoc = await DocumentService.ingestDocument({
        orgId: primaryOrgId,
        name: doc.name,
        content: doc.content,
        fileType: doc.file_type,
        metadata: doc.metadata,
      });
      finalStatus = reIngestedDoc.status as 'processed' | 'failed';
    }

    const updatedDoc = await db.getDocument(doc.id, primaryOrgId);
    const durationMs = Date.now() - startTime;

    await db.logAuditEvent({
      org_id: primaryOrgId,
      user_id: userId,
      action: 'document_reprocessed',
      resource_type: 'document',
      resource_id: doc.id,
      details: {
        filename: doc.name,
        quality_status: qualityMetrics.qualityStatus,
        duration_ms: durationMs,
      },
    });

    return res.status(200).json({
      success: true,
      diagnostics: {
        filename: doc.name,
        fileType: doc.file_type,
        fileSizeBytes: extractionResult.fileSizeBytes,
        pageCount: extractionResult.pageCount,
        extractionMethod: extractionResult.metadata?.extractionMethod || 'text',
        extractedCharCount: extractionResult.charCount,
        readableCharacterRatio: qualityMetrics.readableCharacterRatio,
        replacementCharacterCount: qualityMetrics.replacementCharacterCount,
        suspiciousCharacterRatio: qualityMetrics.suspiciousCharacterRatio,
        chunksCreated: updatedDoc?.chunks?.length || 0,
        processingDurationMs: durationMs,
        finalStatus,
      },
      document: updatedDoc,
    });
  } catch (err: any) {
    console.error(`[API Reprocess] Error for document ${docId}:`, err);
    await db.updateDocumentStatus(docId, primaryOrgId, 'failed');
    return res.status(500).json({ message: err.message || 'Failed to reprocess document' });
  } finally {
    processingLocks.delete(docId);
  }
}
