import type { NextApiRequest, NextApiResponse } from 'next';
import { db } from '@/db';
import { PlanToWorkflowConverter } from '@/lib/planning/planToWorkflow';
import { ProjectPlan } from '@/lib/planning/planTypes';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { plan, user_id } = req.body;
    const userId = user_id || (req.headers['x-hasura-user-id'] as string) || 'a1111111-1111-1111-1111-111111111111';

    if (!plan || !plan.phases) {
      return res.status(400).json({ error: 'Valid plan object with phases is required' });
    }

    const workflowDef = PlanToWorkflowConverter.convertPlanToWorkflow(plan as ProjectPlan, userId);

    // Persist generated workflow into database
    const created = await db.createWorkflow({
      org_id: workflowDef.org_id,
      name: workflowDef.name,
      description: workflowDef.description,
      created_by: userId,
      steps: workflowDef.steps,
      triggers: workflowDef.triggers,
    });

    return res.status(201).json({
      success: true,
      workflow: created,
    });
  } catch (err: any) {
    console.error('[API /api/plans/convert-to-workflow] Error:', err);
    return res.status(500).json({ error: err.message || 'Failed to convert plan to workflow' });
  }
}
