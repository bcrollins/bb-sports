/**
 * Immutable admin security / editorial audit events.
 * Never stores passwords, tokens, or full confidential tip bodies.
 */
import { sql } from 'drizzle-orm';
import { db, dbAvailable } from './db/client';
import { ensureBootstrapped } from './db/bootstrap';

export type AdminAuditAction =
  | 'catalog_import_dry_run'
  | 'catalog_import_drafts'
  | 'publish_attempt'
  | 'login_success'
  | 'login_failure'
  | 'comment_moderation'
  | 'settings_change'
  | 'other';

export async function recordAdminAuditEvent(input: {
  actorUserId?: string | null;
  actorEmail?: string | null;
  action: AdminAuditAction | string;
  targetType?: string;
  targetId?: string;
  summary: string;
  metadata?: Record<string, unknown>;
  ip?: string | null;
}): Promise<void> {
  if (!dbAvailable || !db) return;
  try {
    await ensureBootstrapped();
    const meta = JSON.stringify(input.metadata ?? {});
    await db.execute(sql`
      INSERT INTO admin_audit_events (
        actor_user_id, actor_email, action, target_type, target_id, summary, metadata, ip_address
      ) VALUES (
        ${input.actorUserId ?? null},
        ${input.actorEmail ?? null},
        ${input.action},
        ${input.targetType ?? ''},
        ${input.targetId ?? ''},
        ${input.summary.slice(0, 500)},
        ${meta}::jsonb,
        ${input.ip ?? null}
      )
    `);
  } catch {
    // Audit must never break the primary write path.
  }
}

export async function listAdminAuditEvents(limit = 50): Promise<
  Array<{
    id: string;
    actorEmail: string | null;
    action: string;
    targetType: string;
    targetId: string;
    summary: string;
    createdAt: string;
  }>
> {
  if (!dbAvailable || !db) return [];
  await ensureBootstrapped();
  const rows = await db.execute(sql`
    SELECT id, actor_email, action, target_type, target_id, summary, created_at
    FROM admin_audit_events
    ORDER BY created_at DESC
    LIMIT ${Math.min(Math.max(limit, 1), 200)}
  `);
  return (rows as unknown as Array<{
    id: string;
    actor_email: string | null;
    action: string;
    target_type: string;
    target_id: string;
    summary: string;
    created_at: Date | string;
  }>).map((r) => ({
    id: r.id,
    actorEmail: r.actor_email,
    action: r.action,
    targetType: r.target_type,
    targetId: r.target_id,
    summary: r.summary,
    createdAt: new Date(r.created_at).toISOString(),
  }));
}
