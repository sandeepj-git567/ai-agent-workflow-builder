export interface GraphQLRequestOptions {
  query: string;
  variables?: Record<string, any>;
  userId?: string;
  role?: string;
  adminSecret?: string;
}

export async function fetchGraphQL<T = any>(options: GraphQLRequestOptions): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (options.userId) {
    headers['x-hasura-user-id'] = options.userId;
    headers['Authorization'] = `Bearer ${options.userId}`;
  }

  if (options.role) {
    headers['x-hasura-role'] = options.role;
  }

  if (options.adminSecret) {
    headers['x-hasura-admin-secret'] = options.adminSecret;
  }

  const endpoint = '/api/graphql';

  const res = await fetch(endpoint, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      query: options.query,
      variables: options.variables || {},
    }),
  });

  const json = await res.json();

  if (json.errors && json.errors.length > 0) {
    const errorMsg = json.errors.map((e: any) => e.message).join(', ');
    throw new Error(errorMsg);
  }

  return json.data as T;
}
