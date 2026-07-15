/**
 * Editorial breaking-news watchlist rules (pure matchers).
 * Never auto-publishes; unauthorized sources never match as actionable.
 */

export type WatchlistRule = {
  id: string;
  sport?: string;
  league?: string;
  team?: string;
  player?: string;
  keywords?: string[];
  exclusions?: string[];
  /** 0–100; higher = more urgent. */
  urgencyMin?: number;
  /** HH:mm local quiet start (inclusive). */
  quietStart?: string;
  quietEnd?: string;
  /** IANA-ish label for tests; matching uses provided localMinutes. */
  enabled: boolean;
  /** Must be in authorized source registry to fire. */
  requireAuthorizedSource: boolean;
};

export type WatchlistSignal = {
  text: string;
  sport?: string;
  league?: string;
  team?: string;
  player?: string;
  urgency?: number;
  sourceAuthorized: boolean;
  /** Minutes from local midnight 0–1439. */
  localMinutes?: number;
};

export type WatchlistMatch = {
  ruleId: string;
  reasons: string[];
};

const MAX_RULES = 40;

export function parseWatchlistRules(raw: unknown): WatchlistRule[] {
  if (!Array.isArray(raw)) return [];
  const out: WatchlistRule[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const r = item as Record<string, unknown>;
    const id = typeof r.id === 'string' ? r.id.trim().slice(0, 64) : '';
    if (!id) continue;
    out.push({
      id,
      sport: str(r.sport, 40),
      league: str(r.league, 40),
      team: str(r.team, 80),
      player: str(r.player, 80),
      keywords: strList(r.keywords, 12, 40),
      exclusions: strList(r.exclusions, 12, 40),
      urgencyMin: num(r.urgencyMin, 0, 100),
      quietStart: timeStr(r.quietStart),
      quietEnd: timeStr(r.quietEnd),
      enabled: r.enabled !== false,
      requireAuthorizedSource: r.requireAuthorizedSource !== false,
    });
    if (out.length >= MAX_RULES) break;
  }
  return out;
}

export function matchWatchlist(
  rules: WatchlistRule[],
  signal: WatchlistSignal,
): WatchlistMatch[] {
  const text = signal.text.toLowerCase();
  const matches: WatchlistMatch[] = [];
  for (const rule of rules) {
    if (!rule.enabled) continue;
    if (rule.requireAuthorizedSource && !signal.sourceAuthorized) continue;
    if (inQuietHours(rule, signal.localMinutes)) continue;

    const reasons: string[] = [];
    if (rule.sport && signal.sport && rule.sport.toLowerCase() !== signal.sport.toLowerCase()) {
      continue;
    }
    if (rule.sport && signal.sport && rule.sport.toLowerCase() === signal.sport.toLowerCase()) {
      reasons.push(`sport:${rule.sport}`);
    }
    if (rule.league && signal.league) {
      if (rule.league.toLowerCase() !== signal.league.toLowerCase()) continue;
      reasons.push(`league:${rule.league}`);
    }
    if (rule.team && signal.team) {
      if (rule.team.toLowerCase() !== signal.team.toLowerCase()) continue;
      reasons.push(`team:${rule.team}`);
    }
    if (rule.player && signal.player) {
      if (rule.player.toLowerCase() !== signal.player.toLowerCase()) continue;
      reasons.push(`player:${rule.player}`);
    }
    if (typeof rule.urgencyMin === 'number') {
      const u = signal.urgency ?? 0;
      if (u < rule.urgencyMin) continue;
      reasons.push(`urgency>=${rule.urgencyMin}`);
    }
    if (rule.exclusions?.length) {
      if (rule.exclusions.some((ex) => text.includes(ex.toLowerCase()))) continue;
    }
    if (rule.keywords?.length) {
      const hit = rule.keywords.filter((k) => text.includes(k.toLowerCase()));
      if (hit.length === 0) continue;
      reasons.push(`keywords:${hit.join(',')}`);
    }
    // Require at least one positive reason beyond enabled.
    if (reasons.length === 0 && !rule.sport && !rule.keywords?.length) continue;
    if (reasons.length === 0 && rule.sport && !signal.sport) continue;
    matches.push({ ruleId: rule.id, reasons });
  }
  return matches;
}

function inQuietHours(rule: WatchlistRule, localMinutes?: number): boolean {
  if (rule.quietStart == null || rule.quietEnd == null || localMinutes == null) return false;
  const start = parseHm(rule.quietStart);
  const end = parseHm(rule.quietEnd);
  if (start == null || end == null) return false;
  if (start === end) return false;
  if (start < end) return localMinutes >= start && localMinutes < end;
  // wraps midnight
  return localMinutes >= start || localMinutes < end;
}

function parseHm(hm: string): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hm);
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 23 || min > 59) return null;
  return h * 60 + min;
}

function str(v: unknown, max: number): string | undefined {
  if (typeof v !== 'string') return undefined;
  const t = v.trim().slice(0, max);
  return t || undefined;
}

function strList(v: unknown, maxItems: number, maxLen: number): string[] | undefined {
  if (!Array.isArray(v)) return undefined;
  const out: string[] = [];
  for (const item of v) {
    if (typeof item !== 'string') continue;
    const t = item.trim().slice(0, maxLen);
    if (t) out.push(t);
    if (out.length >= maxItems) break;
  }
  return out.length ? out : undefined;
}

function num(v: unknown, min: number, max: number): number | undefined {
  if (typeof v !== 'number' || !Number.isFinite(v)) return undefined;
  return Math.min(max, Math.max(min, Math.round(v)));
}

function timeStr(v: unknown): string | undefined {
  if (typeof v !== 'string') return undefined;
  return parseHm(v) != null ? v : undefined;
}
