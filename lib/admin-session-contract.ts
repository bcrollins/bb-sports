/**
 * Edge-safe constants shared by middleware and the Node.js auth layer.
 * Keep this module dependency-free so middleware never pulls database code.
 */
export const ADMIN_SESSION_ISSUER = 'bb-sports-newsroom';
export const ADMIN_SESSION_AUDIENCE = 'bb-sports-admin';
export const ADMIN_SESSION_PURPOSE = 'admin-session';

export const ADMIN_ROLES = ['super_admin', 'admin', 'editor'] as const;
export type AdminRole = (typeof ADMIN_ROLES)[number];

export function isAdminRole(value: unknown): value is AdminRole {
  return typeof value === 'string' && (ADMIN_ROLES as readonly string[]).includes(value);
}
