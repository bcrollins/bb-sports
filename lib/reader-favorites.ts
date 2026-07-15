/**
 * Local-first favorite sports — no account, no server PII.
 */
import type { SportSlug } from '@/lib/sports';

export const FAVORITE_SPORT_OPTIONS: Array<{ id: SportSlug; label: string }> = [
  { id: 'nfl', label: 'NFL' },
  { id: 'mlb', label: 'MLB' },
  { id: 'nhl', label: 'NHL' },
  { id: 'nba', label: 'NBA' },
  { id: 'college-football', label: 'CFB' },
  { id: 'soccer', label: 'Soccer' },
  { id: 'mma', label: 'MMA' },
];

export const FAVORITES_STORAGE_KEY = 'bb_favorite_sports_v1';

const ALLOWED = new Set(FAVORITE_SPORT_OPTIONS.map((o) => o.id));

export function parseFavoriteSports(raw: unknown): SportSlug[] {
  if (!Array.isArray(raw)) return [];
  const out: SportSlug[] = [];
  for (const item of raw) {
    if (typeof item === 'string' && ALLOWED.has(item as SportSlug) && !out.includes(item as SportSlug)) {
      out.push(item as SportSlug);
    }
  }
  return out;
}

export function loadFavoriteSports(): SportSlug[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(FAVORITES_STORAGE_KEY);
    if (!raw) return [];
    return parseFavoriteSports(JSON.parse(raw));
  } catch {
    return [];
  }
}

export function saveFavoriteSports(sports: SportSlug[]): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(FAVORITES_STORAGE_KEY, JSON.stringify(parseFavoriteSports(sports)));
  } catch {
    // private mode
  }
}
