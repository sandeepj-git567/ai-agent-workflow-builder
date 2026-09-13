import type { NextApiRequest, NextApiResponse } from 'next';
import { ArchitectureGenerator } from '@/lib/architecture/architectureGenerator';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { org_id, title, diagram_type, plan_content, document_id, document_name } = req.body;
    const orgId = org_id || (req.headers['x-hasura-org-id'] as string) || 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';

    const diagram = await ArchitectureGenerator.generateArchitecture({
      orgId,
      title: title || 'System Architecture Diagram',
      diagramType: diagram_type || 'system_architecture',
      planContent: plan_content,
      documentId: document_id,
      documentName: document_name,
    });

    return res.status(200).json({ success: true, diagram });
  } catch (err: any) {
    console.error('[API /api/plans/generate-architecture] Error:', err);
    return res.status(500).json({ error: err.message || 'Failed to generate architecture diagram' });
  }
}
