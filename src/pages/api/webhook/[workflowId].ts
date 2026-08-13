import type { NextApiRequest, NextApiResponse } from 'next';
import { WorkflowExecutor } from '@/lib/executor/engine';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST' && req.method !== 'GET') {
    return res.status(405).json({ message: 'Method not allowed. Use POST or GET' });
  }

  const { workflowId } = req.query;

  if (!workflowId || typeof workflowId !== 'string') {
    return res.status(400).json({ message: 'Valid workflowId parameter is required' });
  }

  try {
    const payload = req.method === 'POST' ? req.body || {} : req.query;

    console.log(`[Webhook] Inbound webhook received for workflow: ${workflowId}`);

    const result = await WorkflowExecutor.startRun({
      workflowId,
      triggerType: 'webhook',
      initialInput: payload,
    });

    return res.status(200).json({
      success: true,
      message: 'Workflow triggered successfully via webhook',
      ...result,
    });
  } catch (err: any) {
    console.error(`[Webhook] Error executing webhook for workflow ${workflowId}:`, err.message);
    const statusCode = err.message.startsWith('404') ? 404 :
                       err.message.startsWith('403') ? 403 :
                       err.message.startsWith('429') ? 429 : 500;
    return res.status(statusCode).json({
      success: false,
      error: err.message,
    });
  }
}
