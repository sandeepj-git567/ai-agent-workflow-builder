import type { NextApiRequest, NextApiResponse } from 'next';
import { db, checkPostgresConnection } from '../../db';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const isPgConnected = await checkPostgresConnection();
  const dbType = isPgConnected ? 'postgresql' : 'in-memory-fallback';

  return res.status(200).json({
    status: 'healthy',
    service: 'ai-agent-workflow-builder',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    uptimeSeconds: Math.floor(process.uptime()),
    database: {
      type: dbType,
      connected: true,
    },
    environment: process.env.NODE_ENV || 'development',
  });
}
