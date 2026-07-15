/**
 * Local one-tap shortcuts — internal routes only, hard cap.
 */

export const SHORTCUTS_STORAGE_KEY = 'bb_reader_shortcuts_v1';
export const SHORTCUTS_MAX = 6;

export type ShortcutDef = {
  id: string;
  label: string;
  href: string;
};

/** Allowlisted destinations readers may pin. */
export const SHORTCUT_CATALOG: ShortcutDef[] = [
  { id: 'latest', label: 'Latest takes', href: '/#latest' },
  { id: 'articles', label: 'Archive', href: '/articles' },
  { id: 'rankings', label: 'Rankings', href: '/rankings' },
  { id: 'teams-nfl', label: 'NFL teams', href: '/teams/nfl' },
  { id: 'teams-mlb', label: 'MLB teams', href: '/teams/mlb' },
  { id: 'teams-nba', label: 'NBA teams', href: '/teams/nba' },
  { id: 'teams-nhl', label: 'NHL teams', href: '/teams/nhl' },
  { id: 'search', label: 'Search', href: '/search' },
  { id: 'newsletter', label: 'Newsletter', href: '/#newsletter' },
  { id: 'support', label: 'Support', href: '/support' },
  { id: 'tips', label: 'Tips', href: '/contact' },
  { id: 'saved', label: 'Reading list', href: '/reading-list' },
  { id: 'corrections', label: 'Corrections', href: '/corrections' },
  { id: 'about', label: 'About', href: '/about' },
];

const BY_ID = new Map(SHORTCUT_CATALOG.map((s) => [s.id, s]));

export function isSafeShortcutHref(href: string): boolean {
  if (typeof href !== 'string') return false;
  if (href.startsWith('//') || href.includes('://') || href.includes('\\')) return false;
  if (href.startsWith('javascript:') || href.startsWith('data:')) return false;
  if (!(href.startsWith('/') || href.startsWith('/#'))) return false;
  // Must match a catalog entry exactly.
  return SHORTCUT_CATALOG.some((s) => s.href === href);
}

export function parseShortcutIds(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const out: string[] = [];
  for (const id of raw) {
    if (typeof id !== 'string') continue;
    const def = BY_ID.get(id);
    if (!def || !isSafeShortcutHref(def.href) || out.includes(id)) continue;
    out.push(id);
    if (out.length >= SHORTCUTS_MAX) break;
  }
  return out;
}

export function resolveShortcuts(ids: string[]): ShortcutDef[] {
  return parseShortcutIds(ids)
    .map((id) => BY_ID.get(id))
    .filter((s): s is ShortcutDef => Boolean(s));
}

export function loadShortcutIds(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(SHORTCUTS_STORAGE_KEY);
    if (!raw) return [];
    return parseShortcutIds(JSON.parse(raw));
  } catch {
    return [];
  }
}

export function saveShortcutIds(ids: string[]): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(SHORTCUTS_STORAGE_KEY, JSON.stringify(parseShortcutIds(ids)));
  } catch {
    /* private mode */
  }
}
