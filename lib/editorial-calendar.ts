/**
 * Conflict-safe editorial calendar helpers (pure) — no auto-publish.
 */

export type CalendarSlot = {
  id: string;
  /** ISO scheduled publish instant (UTC). */
  scheduledAt: string;
  articleId: string;
  timezone: string;
  /** Brad-approved for this exact revision hash. */
  approvedRevisionHash: string;
  status: 'draft' | 'scheduled' | 'published' | 'cancelled';
};

export type CalendarConflict =
  | { type: 'overlap'; a: string; b: string }
  | { type: 'missing_approval'; id: string }
  | { type: 'invalid_time'; id: string }
  | { type: 'duplicate_article'; articleId: string; slots: string[] };

const MIN_GAP_MS = 5 * 60 * 1000;

export function parseCalendarSlots(raw: unknown): CalendarSlot[] {
  if (!Array.isArray(raw)) return [];
  const out: CalendarSlot[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const r = item as Record<string, unknown>;
    const id = typeof r.id === 'string' ? r.id.trim() : '';
    const scheduledAt = typeof r.scheduledAt === 'string' ? r.scheduledAt : '';
    const articleId = typeof r.articleId === 'string' ? r.articleId.trim() : '';
    const timezone = typeof r.timezone === 'string' ? r.timezone.trim() : 'America/Chicago';
    const approvedRevisionHash =
      typeof r.approvedRevisionHash === 'string' ? r.approvedRevisionHash.trim() : '';
    const status = r.status;
    if (!id || !articleId) continue;
    if (!['draft', 'scheduled', 'published', 'cancelled'].includes(String(status))) continue;
    out.push({
      id,
      scheduledAt,
      articleId,
      timezone: timezone || 'America/Chicago',
      approvedRevisionHash,
      status: status as CalendarSlot['status'],
    });
  }
  return out;
}

export function findCalendarConflicts(slots: CalendarSlot[]): CalendarConflict[] {
  const conflicts: CalendarConflict[] = [];
  const active = slots.filter((s) => s.status === 'scheduled');

  for (const s of active) {
    if (!Number.isFinite(Date.parse(s.scheduledAt))) {
      conflicts.push({ type: 'invalid_time', id: s.id });
    }
    if (!s.approvedRevisionHash || s.approvedRevisionHash.length < 16) {
      conflicts.push({ type: 'missing_approval', id: s.id });
    }
  }

  const byArticle = new Map<string, CalendarSlot[]>();
  for (const s of active) {
    const list = byArticle.get(s.articleId) ?? [];
    list.push(s);
    byArticle.set(s.articleId, list);
  }
  for (const [articleId, list] of byArticle) {
    if (list.length > 1) {
      conflicts.push({ type: 'duplicate_article', articleId, slots: list.map((x) => x.id) });
    }
  }

  const timed = active
    .map((s) => ({ s, t: Date.parse(s.scheduledAt) }))
    .filter((x) => Number.isFinite(x.t))
    .sort((a, b) => a.t - b.t);
  for (let i = 0; i < timed.length - 1; i++) {
    const a = timed[i]!;
    const b = timed[i + 1]!;
    if (Math.abs(b.t - a.t) < MIN_GAP_MS) {
      conflicts.push({ type: 'overlap', a: a.s.id, b: b.s.id });
    }
  }
  return conflicts;
}

/**
 * Only the exact approved revision may publish at the scheduled instant.
 * Retries with a different hash fail closed.
 */
export function mayPublishScheduled(input: {
  slot: CalendarSlot;
  nowIso: string;
  workingRevisionHash: string;
}): { ok: true } | { ok: false; reason: string } {
  if (input.slot.status !== 'scheduled') return { ok: false, reason: 'not scheduled' };
  if (input.slot.approvedRevisionHash !== input.workingRevisionHash) {
    return { ok: false, reason: 'revision mismatch' };
  }
  const scheduled = Date.parse(input.slot.scheduledAt);
  const now = Date.parse(input.nowIso);
  if (!Number.isFinite(scheduled) || !Number.isFinite(now)) {
    return { ok: false, reason: 'invalid time' };
  }
  if (now + 1000 < scheduled) return { ok: false, reason: 'too early' };
  // 15m late window for worker restart
  if (now - scheduled > 15 * 60 * 1000) return { ok: false, reason: 'too late' };
  return { ok: true };
}
