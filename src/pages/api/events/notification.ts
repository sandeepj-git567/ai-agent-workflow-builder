import type { NextApiRequest, NextApiResponse } from 'next';
import { db } from '@/db';
import { eventBus } from '@/lib/events/eventBus';

export const config = {
  api: {
    bodyParser: false, // Disable body parsing for streaming SSE
  },
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const userId = (req.query.user_id || req.headers['x-hasura-user-id'] || '') as string;
  const orgId = (req.query.org_id || '') as string;

  if (req.method === 'GET' && req.query.poll === 'true') {
    // Polling mode fallback
    const events = orgId ? eventBus.getEventsForOrg(orgId, 20) : [];
    return res.status(200).json({ events });
  }

  // SSE Real-Time Stream mode
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no',
  });

  res.write(`data: ${JSON.stringify({ type: 'connected', timestamp: new Date().toISOString() })}\n\n`);

  const onEvent = (event: any) => {
    if (!orgId || event.orgId === orgId) {
      res.write(`data: ${JSON.stringify(event)}\n\n`);
    }
  };

  eventBus.on('app_event', onEvent);

  const heartbeat = setInterval(() => {
    res.write(`data: ${JSON.stringify({ type: 'ping', timestamp: new Date().toISOString() })}\n\n`);
  }, 15000);

  req.on('close', () => {
    clearInterval(heartbeat);
    eventBus.off('app_event', onEvent);
  });
}
