import { describe, it, expect, beforeEach } from 'vitest';
import { inMemoryDb } from '@/db';

// Simulate GraphQL execution logic
import handler from '@/pages/api/graphql';

function createMockReqRes(query: string, variables: any, headers: Record<string, string>) {
  const req: any = {
    method: 'POST',
    body: { query, variables },
    headers,
  };

  let statusCode = 200;
  let responseData: any = null;

  const res: any = {
    status(code: number) {
      statusCode = code;
      return this;
    },
    json(data: any) {
      responseData = data;
      return this;
    },
  };

  return { req, res, getResult: () => ({ statusCode, responseData }) };
}

describe('Role-Based Permissions & Step-Level Gating (Layer 2)', () => {
  const orgAId = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  const ownerA = 'a1111111-1111-1111-1111-111111111111';
  const editorA = 'a2222222-2222-2222-2222-222222222222';
  const viewerA = 'a3333333-3333-3333-3333-333333333333';

  beforeEach(() => {
    inMemoryDb.reset();
  });

  it('allows OWNER to add db_write step', async () => {
    const mutation = `
      mutation CreateWorkflow($object: workflows_insert_input!) {
        insert_workflows_one(object: $object) {
          id
          name
        }
      }
    `;

    const variables = {
      object: {
        org_id: orgAId,
        name: 'Owner DB Pipeline',
        steps: {
          data: [
            {
              name: 'Write Output',
              step_type: 'db_write',
              position: 0,
              config: { key: 'sentiment_report' },
            },
          ],
        },
      },
    };

    const { req, res, getResult } = createMockReqRes(mutation, variables, {
      'x-hasura-user-id': ownerA,
      'x-hasura-role': 'owner',
    });

    await handler(req, res);
    const { responseData } = getResult();
    expect(responseData.data?.insert_workflows_one).toBeDefined();
    expect(responseData.errors).toBeUndefined();
  });

  it('rejects EDITOR from adding db_write step', async () => {
    const mutation = `
      mutation CreateWorkflow($object: workflows_insert_input!) {
        insert_workflows_one(object: $object) {
          id
        }
      }
    `;

    const variables = {
      object: {
        org_id: orgAId,
        name: 'Editor Restricted Pipeline',
        steps: {
          data: [
            {
              name: 'Write DB',
              step_type: 'db_write',
              position: 0,
              config: {},
            },
          ],
        },
      },
    };

    const { req, res, getResult } = createMockReqRes(mutation, variables, {
      'x-hasura-user-id': editorA,
      'x-hasura-role': 'editor',
    });

    await handler(req, res);
    const { responseData } = getResult();
    expect(responseData.errors).toBeDefined();
    expect(responseData.errors[0].message).toMatch(/Editors cannot add restricted step type: db_write/);
  });

  it('rejects EDITOR from adding notify step', async () => {
    const mutation = `
      mutation CreateWorkflow($object: workflows_insert_input!) {
        insert_workflows_one(object: $object) {
          id
        }
      }
    `;

    const variables = {
      object: {
        org_id: orgAId,
        name: 'Editor Notify Pipeline',
        steps: {
          data: [
            {
              name: 'Send Notification',
              step_type: 'notify',
              position: 0,
              config: { message: 'Alert' },
            },
          ],
        },
      },
    };

    const { req, res, getResult } = createMockReqRes(mutation, variables, {
      'x-hasura-user-id': editorA,
      'x-hasura-role': 'editor',
    });

    await handler(req, res);
    const { responseData } = getResult();
    expect(responseData.errors).toBeDefined();
    expect(responseData.errors[0].message).toMatch(/Editors cannot add restricted step type: notify/);
  });

  it('rejects EDITOR from adding webhook trigger', async () => {
    const mutation = `
      mutation CreateWorkflow($object: workflows_insert_input!) {
        insert_workflows_one(object: $object) {
          id
        }
      }
    `;

    const variables = {
      object: {
        org_id: orgAId,
        name: 'Editor Webhook Pipeline',
        triggers: {
          data: [
            {
              trigger_type: 'webhook',
              config: {},
            },
          ],
        },
      },
    };

    const { req, res, getResult } = createMockReqRes(mutation, variables, {
      'x-hasura-user-id': editorA,
      'x-hasura-role': 'editor',
    });

    await handler(req, res);
    const { responseData } = getResult();
    expect(responseData.errors).toBeDefined();
    expect(responseData.errors[0].message).toMatch(/Editors cannot add webhook triggers/);
  });

  it('rejects VIEWER from creating workflows', async () => {
    const mutation = `
      mutation CreateWorkflow($object: workflows_insert_input!) {
        insert_workflows_one(object: $object) {
          id
        }
      }
    `;

    const variables = {
      object: {
        org_id: orgAId,
        name: 'Viewer Pipeline',
      },
    };

    const { req, res, getResult } = createMockReqRes(mutation, variables, {
      'x-hasura-user-id': viewerA,
      'x-hasura-role': 'viewer',
    });

    await handler(req, res);
    const { responseData } = getResult();
    expect(responseData.errors).toBeDefined();
    expect(responseData.errors[0].message).toMatch(/Viewers cannot create workflows/);
  });
});
