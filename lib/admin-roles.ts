/**
 * Least-privilege newsroom capabilities.
 * super_admin = Brad / operator break-glass
 * admin = trusted desk ops without publish
 * editor = draft + moderate only
 */
import type { AdminRole } from '@/lib/admin-session-contract';
import { isAdminRole } from '@/lib/admin-session-contract';

export type NewsroomCapability =
  | 'publish'
  | 'unpublish'
  | 'catalog_import'
  | 'manage_site_config'
  | 'manage_access_wall'
  | 'view_audit'
  | 'view_audience_pii'
  | 'moderate_comments'
  | 'manage_sessions'
  | 'probe_citations'
  | 'write_drafts'
  | 'view_findings';

const CAPS: Record<AdminRole, readonly NewsroomCapability[]> = {
  super_admin: [
    'publish',
    'unpublish',
    'catalog_import',
    'manage_site_config',
    'manage_access_wall',
    'view_audit',
    'view_audience_pii',
    'moderate_comments',
    'manage_sessions',
    'probe_citations',
    'write_drafts',
    'view_findings',
  ],
  admin: [
    'catalog_import',
    'manage_site_config',
    'view_audit',
    'view_audience_pii',
    'moderate_comments',
    'manage_sessions',
    'probe_citations',
    'write_drafts',
    'view_findings',
  ],
  editor: [
    'moderate_comments',
    'probe_citations',
    'write_drafts',
    'view_findings',
  ],
};

export function roleHasCapability(role: unknown, capability: NewsroomCapability): boolean {
  if (!isAdminRole(role)) return false;
  return CAPS[role].includes(capability);
}

export function assertCapability(
  role: unknown,
  capability: NewsroomCapability,
): { ok: true } | { ok: false; error: string } {
  if (roleHasCapability(role, capability)) return { ok: true };
  return {
    ok: false,
    error: `Role lacks capability: ${capability}`,
  };
}
