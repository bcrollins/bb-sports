/**
 * Local-only reading list — no account, no server PII, no tracking.
 */

export const READING_LIST_STORAGE_KEY = 'bb_reading_list_v1';
export const READING_LIST_MAX = 100;

export type ReadingListItem = {
  slug: string;
  title: string;
  sport?: string;
  savedAt: string; // ISO
};

function isIsoDate(value: unknown): value is string {
  return typeof value === 'string' && !Number.isNaN(Date.parse(value));
}

export function parseReadingList(raw: unknown): ReadingListItem[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const out: ReadingListItem[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const rec = item as Record<string, unknown>;
    if (typeof rec.slug !== 'string') continue;
    const rawSlug = rec.slug.trim().toLowerCase();
    // Reject path-ish values before strip so ../evil never becomes a fake local id.
    if (!rawSlug || /[./\\]/.test(rawSlug) || !/^[a-z0-9-]+$/.test(rawSlug)) continue;
    const slug = rawSlug;
    if (seen.has(slug)) continue;
    const title = typeof rec.title === 'string' ? rec.title.trim().slice(0, 500) : slug;
    if (!title) continue;
    const sport = typeof rec.sport === 'string' ? rec.sport.trim().slice(0, 40) : undefined;
    const savedAt = isIsoDate(rec.savedAt) ? rec.savedAt : new Date(0).toISOString();
    seen.add(slug);
    out.push({ slug, title, sport, savedAt });
    if (out.length >= READING_LIST_MAX) break;
  }
  return out.sort((a, b) => Date.parse(b.savedAt) - Date.parse(a.savedAt));
}

export function loadReadingList(): ReadingListItem[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(READING_LIST_STORAGE_KEY);
    if (!raw) return [];
    return parseReadingList(JSON.parse(raw));
  } catch {
    return [];
  }
}

export function saveReadingList(items: ReadingListItem[]): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(
      READING_LIST_STORAGE_KEY,
      JSON.stringify(parseReadingList(items)),
    );
  } catch {
    // private mode / quota
  }
}

export function isOnReadingList(slug: string, items: ReadingListItem[] = loadReadingList()): boolean {
  const clean = String(slug ?? '')
    .trim()
    .toLowerCase();
  return items.some((i) => i.slug === clean);
}

export function toggleReadingListItem(item: {
  slug: string;
  title: string;
  sport?: string;
}): ReadingListItem[] {
  const list = loadReadingList();
  const clean = String(item.slug ?? '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '');
  if (!clean) return list;
  if (list.some((i) => i.slug === clean)) {
    const next = list.filter((i) => i.slug !== clean);
    saveReadingList(next);
    return next;
  }
  const next = parseReadingList([
    {
      slug: clean,
      title: item.title,
      sport: item.sport,
      savedAt: new Date().toISOString(),
    },
    ...list,
  ]);
  saveReadingList(next);
  return next;
}

export function exportReadingListJson(items: ReadingListItem[] = loadReadingList()): string {
  return JSON.stringify(
    {
      version: 1,
      exportedAt: new Date().toISOString(),
      items: parseReadingList(items),
    },
    null,
    2,
  );
}

export function importReadingListJson(raw: string): ReadingListItem[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return loadReadingList();
  }
  const bag = parsed as { items?: unknown };
  const incoming = parseReadingList(Array.isArray(parsed) ? parsed : bag.items);
  const merged = parseReadingList([...incoming, ...loadReadingList()]);
  saveReadingList(merged);
  return merged;
}
