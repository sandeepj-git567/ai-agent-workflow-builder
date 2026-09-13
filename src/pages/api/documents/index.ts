import type { NextApiRequest, NextApiResponse } from 'next';
import { db } from '@/db';
import { DocumentService } from '@/lib/rag/documentService';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const userId = (req.headers['x-hasura-user-id'] || req.headers['authorization']?.replace('Bearer ', '') || '') as string;
  
  if (!userId) {
    return res.status(401).json({ message: '401: Unauthorized — Authentication required (x-hasura-user-id header missing)' });
  }

  // Get memberships
  const memberships = await db.getUserMemberships(userId);
  if (!memberships || memberships.length === 0) {
    return res.status(403).json({ message: '403: Forbidden — User does not belong to any organization' });
  }

  const primaryOrgId = memberships[0].org_id;

  // GET /api/documents -> List documents for caller's organization
  if (req.method === 'GET') {
    try {
      const orgId = (req.query.org_id as string) || primaryOrgId;
      const member = await db.getOrgMember(userId, orgId);
      if (!member) {
        return res.status(403).json({ message: `403: Forbidden — Access to organization ${orgId} denied` });
      }

      const docs = await db.listDocuments(orgId);
      return res.status(200).json({ documents: docs });
    } catch (err: any) {
      return res.status(500).json({ message: err.message });
    }
  }

  // POST /api/documents -> Ingest new document
  if (req.method === 'POST') {
    try {
      const body = req.body || {};
      const orgId = body.org_id || primaryOrgId;
      const member = await db.getOrgMember(userId, orgId);

      if (!member) {
        return res.status(403).json({ message: `403: Forbidden — Access to organization ${orgId} denied` });
      }

      if (member.role === 'viewer') {
        return res.status(403).json({ message: '403: Forbidden — Viewers are not authorized to upload documents' });
      }

      if (!body.name || !body.content) {
        return res.status(400).json({ message: 'Document name and content are required' });
      }

      const doc = await DocumentService.ingestDocument({
        orgId,
        name: body.name,
        content: body.content,
        fileType: body.file_type || 'text',
        sourceUrl: body.source_url,
        metadata: body.metadata || {},
        chunkSize: body.chunk_size ? Number(body.chunk_size) : 500,
        chunkOverlap: body.chunk_overlap ? Number(body.chunk_overlap) : 50,
      });

      await db.logAuditEvent({
        org_id: orgId,
        user_id: userId,
        action: 'document_ingested',
        resource_type: 'document',
        resource_id: doc.id,
        details: { doc_name: doc.name, chunk_count: doc.chunks?.length || 0 },
      });

      return res.status(201).json({ success: true, document: doc });
    } catch (err: any) {
      return res.status(500).json({ message: err.message });
    }
  }

  return res.status(405).json({ message: 'Method not allowed' });
}
