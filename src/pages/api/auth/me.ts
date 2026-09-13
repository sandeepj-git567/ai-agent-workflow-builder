import type { NextApiRequest, NextApiResponse } from 'next';
import { TEST_USERS } from './users';

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  const userId = (req.headers['x-hasura-user-id'] as string) || (req.headers['x-user-id'] as string);

  if (!userId) {
    // Default to first user if no header provided
    return res.status(200).json({
      user: TEST_USERS[0],
      authenticated: true,
      authMethod: 'persona-session',
    });
  }

  const user = TEST_USERS.find(u => u.id === userId);
  if (!user) {
    return res.status(401).json({ error: 'Unauthorized: User not found', authenticated: false });
  }

  return res.status(200).json({
    user,
    authenticated: true,
    authMethod: 'persona-session',
  });
}
