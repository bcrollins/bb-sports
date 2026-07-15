/**
 * Client-safe sport taxonomy — no Node/fs/db imports.
 * Import from here in client components; lib/articles re-exports for server code.
 */

export type SportSlug =
  | 'nfl'
  | 'mlb'
  | 'nhl'
  | 'nba'
  | 'college-football'
  | 'soccer'
  | 'mma'
  | 'general';

export const SPORT_LABELS: Record<SportSlug, string> = {
  nfl: 'NFL',
  mlb: 'MLB',
  nhl: 'NHL',
  nba: 'NBA',
  'college-football': 'College Football',
  soccer: 'Soccer',
  mma: 'MMA',
  general: 'General',
};

export function sportLabel(s: SportSlug): string {
  return SPORT_LABELS[s] ?? 'General';
}

export const ALL_SPORT_SLUGS = Object.keys(SPORT_LABELS) as SportSlug[];
