import type { NextApiRequest, NextApiResponse } from 'next';
import { db, checkPostgresConnection } from '../../db';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  let dbReady = false;
  try {
    const demoOrg = await db.getOrganization('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa');
    dbReady = !!demoOrg;
  } catch (err) {
    dbReady = false;
  }

  const isPgConnected = await checkPostgresConnection();

  const mem = process.memoryUsage();
  const memoryMB = {
    rss: Math.round(mem.rss / 1024 / 1024),
    heapTotal: Math.round(mem.heapTotal / 1024 / 1024),
    heapUsed: Math.round(mem.heapUsed / 1024 / 1024),
  };

  const isReady = dbReady;

  return res.status(isReady ? 200 : 503).json({
    ready: isReady,
    checks: {
      databaseQuery: dbReady ? 'pass' : 'fail',
      postgresConnection: isPgConnected ? 'connected' : 'fallback-active',
      memoryMB,
    },
    timestamp: new Date().toISOString(),
  });
}
