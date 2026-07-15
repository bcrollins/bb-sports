/**
 * Opt-in reader alerts — default OFF, consent-first, no first-load prompt.
 * Delivery remains dark until a provider is commercially approved.
 */

export const ALERT_PREFS_STORAGE_KEY = 'bb_reader_alerts_v1';

export type AlertChannel = 'email' | 'browser';

export type ReaderAlertPrefs = {
  version: 1;
  /** Master switch — must be explicit true. */
  enabled: boolean;
  channels: AlertChannel[];
  sports: string[];
  teams: string[];
  urgencyMin: number;
  quietStart?: string;
  quietEnd?: string;
  /** ISO of consent moment. */
  consentedAt?: string;
  /** Delivery provider must still be approved server-side. */
  deliveryApproved: false;
};

export const DEFAULT_ALERT_PREFS: ReaderAlertPrefs = {
  version: 1,
  enabled: false,
  channels: [],
  sports: [],
  teams: [],
  urgencyMin: 50,
  deliveryApproved: false,
};

export function parseAlertPrefs(raw: unknown): ReaderAlertPrefs {
  if (!raw || typeof raw !== 'object') return { ...DEFAULT_ALERT_PREFS };
  const r = raw as Record<string, unknown>;
  const enabled = r.enabled === true;
  const channels = Array.isArray(r.channels)
    ? r.channels.filter((c): c is AlertChannel => c === 'email' || c === 'browser')
    : [];
  const sports = strList(r.sports, 12);
  const teams = strList(r.teams, 24);
  const urgencyMin =
    typeof r.urgencyMin === 'number' && Number.isFinite(r.urgencyMin)
      ? Math.min(100, Math.max(0, Math.round(r.urgencyMin)))
      : 50;
  return {
    version: 1,
    enabled,
    channels: enabled ? channels : [],
    sports: enabled ? sports : [],
    teams: enabled ? teams : [],
    urgencyMin,
    quietStart: timeOk(r.quietStart) ? String(r.quietStart) : undefined,
    quietEnd: timeOk(r.quietEnd) ? String(r.quietEnd) : undefined,
    consentedAt:
      enabled && typeof r.consentedAt === 'string' ? r.consentedAt : undefined,
    deliveryApproved: false,
  };
}

/** Server never sends without explicit prefs + commercial delivery approval. */
export function mayDeliverReaderAlert(input: {
  prefs: ReaderAlertPrefs;
  providerDeliveryApproved: boolean;
  publishedProvenanceOk: boolean;
}): { ok: true } | { ok: false; reason: string } {
  if (!input.prefs.enabled) return { ok: false, reason: 'not enabled' };
  if (!input.prefs.channels.length) return { ok: false, reason: 'no channel' };
  if (!input.prefs.consentedAt) return { ok: false, reason: 'no consent timestamp' };
  if (!input.providerDeliveryApproved) return { ok: false, reason: 'provider not approved' };
  if (!input.publishedProvenanceOk) return { ok: false, reason: 'no published provenance' };
  // deliveryApproved on prefs is always false by design — server flag required.
  return { ok: true };
}

function strList(v: unknown, max: number): string[] {
  if (!Array.isArray(v)) return [];
  const out: string[] = [];
  for (const item of v) {
    if (typeof item !== 'string') continue;
    const t = item.trim().slice(0, 40);
    if (t && !out.includes(t)) out.push(t);
    if (out.length >= max) break;
  }
  return out;
}

function timeOk(v: unknown): boolean {
  return typeof v === 'string' && /^\d{1,2}:\d{2}$/.test(v);
}
