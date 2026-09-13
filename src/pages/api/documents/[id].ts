import type { NextApiRequest, NextApiResponse } from 'next';
import { db } from '@/db';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
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

  // GET /api/documents/[id]
  if (req.method === 'GET') {
    try {
      const doc = await db.getDocument(docId, primaryOrgId);
      if (!doc) {
        return res.status(404).json({ message: '404: Document not found or tenant access denied' });
      }
      return res.status(200).json({ document: doc });
    } catch (err: any) {
      return res.status(500).json({ message: err.message });
    }
  }

  // DELETE /api/documents/[id]
  if (req.method === 'DELETE') {
    try {
      const member = await db.getOrgMember(userId, primaryOrgId);
      if (!member || member.role === 'viewer') {
        return res.status(403).json({ message: '403: Forbidden — Insufficient permissions to delete documents' });
      }

      const deleted = await db.deleteDocument(docId, primaryOrgId);
      if (!deleted) {
        return res.status(404).json({ message: '404: Document not found or tenant access denied' });
      }

      await db.logAuditEvent({
        org_id: primaryOrgId,
        user_id: userId,
        action: 'document_deleted',
        resource_type: 'document',
        resource_id: docId,
        details: {},
      });

      return res.status(200).json({ success: true, message: 'Document deleted successfully' });
    } catch (err: any) {
      return res.status(500).json({ message: err.message });
    }
  }

  return res.status(405).json({ message: 'Method not allowed' });
}
