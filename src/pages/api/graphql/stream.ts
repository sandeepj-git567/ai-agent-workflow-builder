import type { NextApiRequest, NextApiResponse } from 'next';
import { pubsub, db } from '@/db';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  const { workflow_run_id, org_id } = req.query;

  // Set SSE headers
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': '*',
  });

  res.write(': connected\n\n');

  const cleanups: Array<() => void> = [];

  if (workflow_run_id && typeof workflow_run_id === 'string') {
    // Send initial snapshot
    const initialRun = await db.getWorkflowRun(workflow_run_id);
    if (initialRun) {
      res.write(`data: ${JSON.stringify({ type: 'workflow_run', data: initialRun })}\n\n`);
    }

    const initialSteps = await db.listStepRunsForWorkflowRun(workflow_run_id);
    if (initialSteps.length > 0) {
      res.write(`data: ${JSON.stringify({ type: 'step_runs', data: initialSteps })}\n\n`);
    }

    // Subscribe to workflow run changes
    const unsubRun = pubsub.subscribe(`workflow_run:${workflow_run_id}`, (data) => {
      res.write(`data: ${JSON.stringify({ type: 'workflow_run', data })}\n\n`);
    });
    cleanups.push(unsubRun);

    // Subscribe to step runs changes
    const unsubSteps = pubsub.subscribe(`step_runs:${workflow_run_id}`, (data) => {
      res.write(`data: ${JSON.stringify({ type: 'step_runs', data })}\n\n`);
    });
    cleanups.push(unsubSteps);
  }

  if (org_id && typeof org_id === 'string') {
    const unsubNotifs = pubsub.subscribe(`notifications:${org_id}`, (data) => {
      res.write(`data: ${JSON.stringify({ type: 'notification', data })}\n\n`);
    });
    cleanups.push(unsubNotifs);
  }

  // Heartbeat to keep connection alive
  const heartbeat = setInterval(() => {
    res.write(': ping\n\n');
  }, 10000);

  req.on('close', () => {
    clearInterval(heartbeat);
    cleanups.forEach(fn => fn());
    res.end();
  });
}
