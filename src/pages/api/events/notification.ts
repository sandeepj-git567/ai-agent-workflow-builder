import type { NextApiRequest, NextApiResponse } from 'next';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  const payload = req.body || {};
  console.log('[Event Trigger] Notification Event Received:', JSON.stringify(payload));

  // Process event trigger dispatch (e.g. In-app, Email, Slack, etc.)
  return res.status(200).json({
    status: 'delivered',
    event_id: payload.id || 'event_ack',
    timestamp: new Date().toISOString(),
  });
}
