import type { NextApiRequest, NextApiResponse } from 'next';
import { WorkflowExecutor } from '@/lib/executor/engine';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    const body = req.body || {};
    
    // Support both Hasura Action payload format and direct API call format
    const workflowId = body.input?.workflow_id || body.workflow_id;
    const sessionVars = body.session_variables || {};
    const userId = sessionVars['x-hasura-user-id'] || req.headers['x-hasura-user-id'] as string;
    const role = sessionVars['x-hasura-role'] || req.headers['x-hasura-role'] as string;

    if (!workflowId) {
      return res.status(400).json({ message: 'workflow_id is required' });
    }

    if (!userId) {
      return res.status(401).json({ message: 'Authentication required (x-hasura-user-id header missing)' });
    }

    if (role === 'viewer') {
      return res.status(403).json({ message: 'Viewer role is not authorized to trigger workflow runs' });
    }

    const result = await WorkflowExecutor.startRun({
      workflowId,
      callerUserId: userId,
      triggerType: 'manual',
      initialInput: body.input || body,
    });

    return res.status(200).json(result);
  } catch (err: any) {
    console.error('[Action: triggerWorkflowRun] Error:', err.message);
    const statusCode = err.message.startsWith('401') ? 401 :
                       err.message.startsWith('403') ? 403 :
                       err.message.startsWith('404') ? 404 :
                       err.message.startsWith('429') ? 429 : 500;
    return res.status(statusCode).json({ message: err.message });
  }
}
