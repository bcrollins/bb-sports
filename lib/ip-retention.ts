/**
 * Network metadata retention policy — dry-run first, never silent wipe.
 * Analytics already stores hashes only; other tables may still hold raw IP/UA.
 */

export type RetentionTablePolicy = {
  table: string;
  ipColumn: string | null;
  uaColumn: string | null;
  /** Days to retain raw network metadata for abuse investigation */
  retainDays: number;
  purpose: string;
  anonymizeTo: string;
};

export const NETWORK_METADATA_RETENTION: readonly RetentionTablePolicy[] = Object.freeze([
  {
    table: 'sessions',
    ipColumn: 'ip_address',
    uaColumn: 'user_agent',
    retainDays: 30,
    purpose: 'session audit / revoke UI (masked display only)',
    anonymizeTo: 'null',
  },
  {
    table: 'newsletter_subscribers',
    ipColumn: 'last_ip_address',
    uaColumn: 'last_user_agent',
    retainDays: 30,
    purpose: 'abuse rate context on signup',
    anonymizeTo: 'null',
  },
  {
    table: 'contact_messages',
    ipColumn: 'ip_address',
    uaColumn: 'user_agent',
    retainDays: 90,
    purpose: 'tip abuse / legal holds',
    anonymizeTo: 'null',
  },
  {
    table: 'donation_intents',
    ipColumn: 'ip_address',
    uaColumn: 'user_agent',
    retainDays: 90,
    purpose: 'payment fraud investigation',
    anonymizeTo: 'null',
  },
  {
    table: 'comments',
    ipColumn: 'ip_address',
    uaColumn: 'user_agent',
    retainDays: 60,
    purpose: 'comment abuse rate limits',
    anonymizeTo: 'null',
  },
  {
    table: 'analytics_events',
    ipColumn: 'ip_hash',
    uaColumn: 'user_agent_hash',
    retainDays: 365,
    purpose: 'already hashed — purge old events, never store raw IP',
    anonymizeTo: 'delete_row_after_retention',
  },
]);

export type RetentionDryRunRow = {
  table: string;
  retainDays: number;
  /** SQL that counts rows eligible for anonymization (read-only) */
  countSql: string;
  /** SQL that would anonymize (never auto-run) */
  applySql: string;
};

export function buildRetentionDryRunSql(
  nowIso = new Date().toISOString(),
): RetentionDryRunRow[] {
  return NETWORK_METADATA_RETENTION.map((policy) => {
    const cutoff = `now() - interval '${policy.retainDays} days'`;
    if (policy.table === 'analytics_events') {
      return {
        table: policy.table,
        retainDays: policy.retainDays,
        countSql: `SELECT count(*) FROM analytics_events WHERE created_at < ${cutoff}; -- dry-run as of ${nowIso}`,
        applySql: `DELETE FROM analytics_events WHERE created_at < ${cutoff}; -- operator only`,
      };
    }
    const sets: string[] = [];
    if (policy.ipColumn) sets.push(`${policy.ipColumn} = NULL`);
    if (policy.uaColumn) sets.push(`${policy.uaColumn} = NULL`);
    return {
      table: policy.table,
      retainDays: policy.retainDays,
      countSql: `SELECT count(*) FROM ${policy.table} WHERE updated_at < ${cutoff} AND (${policy.ipColumn} IS NOT NULL OR ${policy.uaColumn} IS NOT NULL); -- dry-run as of ${nowIso}`,
      applySql: `UPDATE ${policy.table} SET ${sets.join(', ')}, updated_at = now() WHERE updated_at < ${cutoff}; -- operator only`,
    };
  });
}
