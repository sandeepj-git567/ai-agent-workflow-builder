import type { NextApiRequest, NextApiResponse } from 'next';
import { db } from '@/db';
import { DetailExtractor } from '@/lib/documents/detailExtractor';
import { PlanGenerator } from '@/lib/planning/planGenerator';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
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
      return res.status(404).json({ error: `Document ${id} not found` });
    }

    const details = await DetailExtractor.extractDetails(doc.id, doc.name, doc.content);
    const plan = await PlanGenerator.generatePlan({
      orgId,
      title: req.body?.title || `Plan: ${doc.name}`,
      prompt: req.body?.prompt,
      documentDetails: details,
      documentId: doc.id,
      documentName: doc.name,
    });

    return res.status(200).json({ success: true, plan });
  } catch (err: any) {
    console.error(`[API /api/documents/${id}/generate-plan] Error:`, err);
    return res.status(500).json({ error: err.message || 'Failed to generate project plan' });
  }
}
