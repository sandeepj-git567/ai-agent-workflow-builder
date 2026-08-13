import type { NextApiRequest, NextApiResponse } from 'next';

export const TEST_USERS = [
  // Org A
  {
    id: 'a1111111-1111-1111-1111-111111111111',
    email: 'owner-a@acme.com',
    name: 'Alice (Owner Org A)',
    orgId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    orgName: 'Acme Corp (Org A)',
    role: 'owner',
  },
  {
    id: 'a2222222-2222-2222-2222-222222222222',
    email: 'editor-a@acme.com',
    name: 'Edward (Editor Org A)',
    orgId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    orgName: 'Acme Corp (Org A)',
    role: 'editor',
  },
  {
    id: 'a3333333-3333-3333-3333-333333333333',
    email: 'viewer-a@acme.com',
    name: 'Victor (Viewer Org A)',
    orgId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    orgName: 'Acme Corp (Org A)',
    role: 'viewer',
  },
  // Org B
  {
    id: 'b1111111-1111-1111-1111-111111111111',
    email: 'owner-b@betalabs.com',
    name: 'Bob (Owner Org B)',
    orgId: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
    orgName: 'Beta Labs (Org B)',
    role: 'owner',
  },
  {
    id: 'b2222222-2222-2222-2222-222222222222',
    email: 'editor-b@betalabs.com',
    name: 'Emma (Editor Org B)',
    orgId: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
    orgName: 'Beta Labs (Org B)',
    role: 'editor',
  },
  {
    id: 'b3333333-3333-3333-3333-333333333333',
    email: 'viewer-b@betalabs.com',
    name: 'Vincent (Viewer Org B)',
    orgId: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
    orgName: 'Beta Labs (Org B)',
    role: 'viewer',
  },
  // Multi-tenant
  {
    id: 'ab111111-1111-1111-1111-111111111111',
    email: 'multi-user@domain.com',
    name: 'Morgan (Editor in A, Viewer in B)',
    orgId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    orgName: 'Acme Corp (Org A)',
    role: 'editor',
  }
];

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  return res.status(200).json({ users: TEST_USERS });
}
