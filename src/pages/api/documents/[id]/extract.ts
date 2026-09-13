import type { NextApiRequest, NextApiResponse } from 'next';
import { db } from '@/db';
import { DetailExtractor } from '@/lib/documents/detailExtractor';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST' && req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { id } = req.query;
  const orgId = (req.headers['x-hasura-org-id'] as string) || (req.body?.org_id as string) || 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';

  if (!id || typeof id !== 'string') {
    return res.status(400).json({ error: 'Invalid document ID' });
  }

  try {
    const doc = await db.getDocument(id, orgId);
    if (!doc) {
      return res.status(404).json({ error: `Document ${id} not found in org ${orgId}` });
    }

    const details = await DetailExtractor.extractDetails(doc.id, doc.name, doc.content);
    return res.status(200).json({ success: true, details });
  } catch (err: any) {
    console.error(`[API /api/documents/${id}/extract] Error:`, err);
    return res.status(500).json({ error: err.message || 'Failed to extract details from document' });
  }
}
