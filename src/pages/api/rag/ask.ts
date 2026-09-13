import type { NextApiRequest, NextApiResponse } from 'next';
import { db } from '@/db';
import { RagSysService } from '@/lib/rag/ragSysService';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  const userId = (req.headers['x-hasura-user-id'] || req.headers['authorization']?.replace('Bearer ', '') || '') as string;

  if (!userId) {
    return res.status(401).json({ message: '401: Unauthorized — Authentication required' });
  }

  const memberships = await db.getUserMemberships(userId);
  if (!memberships || memberships.length === 0) {
    return res.status(403).json({ message: '403: Forbidden — User does not belong to any organization' });
  }

  const primaryOrgId = memberships[0].org_id;

  try {
    const { org_id, document_id, question, top_k } = req.body || {};
    const targetOrgId = org_id || primaryOrgId;

    const member = await db.getOrgMember(userId, targetOrgId);
    if (!member) {
      return res.status(403).json({ message: `403: Forbidden — Access to organization ${targetOrgId} denied` });
    }

    if (!question || typeof question !== 'string' || question.trim() === '') {
      return res.status(400).json({ message: 'Question parameter is required' });
    }

    const result = await RagSysService.askQuestion({
      orgId: targetOrgId,
      documentId: document_id,
      question: question.trim(),
      topK: top_k ? Number(top_k) : 3,
    });

    await db.logAuditEvent({
      org_id: targetOrgId,
      user_id: userId,
      action: 'rag_sys_question_asked',
      resource_type: 'rag_document',
      resource_id: document_id || null,
      details: {
        question: question.trim(),
        sources_found: result.chunkCount,
      },
    });

    return res.status(200).json({
      success: true,
      answer: result.answer,
      sources: result.sources,
      source_details: result.sourceDetails,
      chunk_count: result.chunkCount,
    });
  } catch (err: any) {
    console.error('[API /api/rag/ask] Error:', err);
    return res.status(500).json({ message: err.message || 'Failed to process RAG question' });
  }
}
