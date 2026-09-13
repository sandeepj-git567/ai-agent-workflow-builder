import { UserRole } from '@/types';
import { db } from '@/db';

export type RbacAction =
  | 'manage_org'
  | 'manage_members'
  | 'manage_billing'
  | 'create_workflow'
  | 'edit_workflow'
  | 'delete_workflow'
  | 'execute_workflow'
  | 'approve_step'
  | 'manage_webhooks'
  | 'view_audit_logs'
  | 'run_security_audit'
  | 'add_restricted_step'
  | 'add_webhook_trigger';

const PERMISSION_MATRIX: Record<UserRole, Set<RbacAction>> = {
  owner: new Set<RbacAction>([
    'manage_org',
    'manage_members',
    'manage_billing',
    'create_workflow',
    'edit_workflow',
    'delete_workflow',
    'execute_workflow',
    'approve_step',
    'manage_webhooks',
    'view_audit_logs',
    'run_security_audit',
    'add_restricted_step',
    'add_webhook_trigger',
  ]),
  editor: new Set<RbacAction>([
    'create_workflow',
    'edit_workflow',
    'execute_workflow',
  ]),
  viewer: new Set<RbacAction>([]),
};

export function checkRolePermission(role: UserRole, action: RbacAction): boolean {
  const allowedActions = PERMISSION_MATRIX[role];
  return allowedActions ? allowedActions.has(action) : false;
}

export async function validateUserAccess(
  userId: string,
  orgId: string,
  action: RbacAction
): Promise<{ allowed: boolean; role?: UserRole; reason?: string }> {
  if (!userId) {
    return { allowed: false, reason: '401: Unauthorized - Missing user identity' };
  }

  const member = await db.getOrgMember(userId, orgId);
  if (!member) {
    return { allowed: false, reason: `403: Forbidden - User ${userId} does not belong to organization ${orgId}` };
  }

  const role = member.role;
  const isAllowed = checkRolePermission(role, action);

  if (!isAllowed) {
    return {
      allowed: false,
      role,
      reason: `403: Forbidden - Role '${role}' lacks permission for action '${action}' in organization ${orgId}`,
    };
  }

  return { allowed: true, role };
}
