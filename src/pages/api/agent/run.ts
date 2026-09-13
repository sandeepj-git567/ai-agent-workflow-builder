import type { NextApiRequest, NextApiResponse } from 'next';
import { db } from '@/db';
import { AgentOrchestrator } from '@/lib/agent/orchestrator';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  const userId = (req.headers['x-hasura-user-id'] || req.headers['authorization']?.replace('Bearer ', '') || '') as string;
  if (!userId) {
    return res.status(401).json({ message: '401: Unauthorized — Authentication required (x-hasura-user-id header missing)' });
  }

  const body = req.body || {};
  const memberships = await db.getUserMemberships(userId);
  if (!memberships || memberships.length === 0) {
    return res.status(403).json({ message: '403: Forbidden — User does not belong to any organization' });
  }

  const orgId = body.org_id || memberships[0].org_id;
  const member = await db.getOrgMember(userId, orgId);

  if (!member) {
    return res.status(403).json({ message: `403: Forbidden — Access to organization ${orgId} denied` });
  }

  if (member.role === 'viewer') {
    return res.status(403).json({ message: '403: Forbidden — Viewers are not authorized to run AI agents' });
  }

  if (!body.request && !body.user_request) {
    return res.status(400).json({ message: 'user_request string parameter is required' });
  }

  try {
    const agentRun = await AgentOrchestrator.runAgent({
      orgId,
      userId,
      userRole: member.role,
      userRequest: body.user_request || body.request,
      workflowRunId: body.workflow_run_id,
    });

    return res.status(200).json({
      success: true,
      agent_run: agentRun,
    });
  } catch (err: any) {
    return res.status(500).json({ message: err.message });
  }
}
