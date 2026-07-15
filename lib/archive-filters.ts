/**
 * Shareable archive URL contract for /articles.
 * Invalid params fail safe to defaults; defaults omit from hrefs.
 */
import type { Article, SportSlug } from '@/lib/articles';
import { sportLabel } from '@/lib/articles';

export const ARCHIVE_SPORTS = [
  'all',
  'nfl',
  'mlb',
  'nhl',
  'nba',
  'college-football',
  'soccer',
  'mma',
] as const;

export type ArchiveSport = (typeof ARCHIVE_SPORTS)[number];
export type ArchiveSort = 'newest' | 'oldest';

export type ArchiveFilterState = {
  sport: ArchiveSport;
  q: string;
  sort: ArchiveSort;
};

const SPORT_SET = new Set<string>(ARCHIVE_SPORTS);

export function parseArchiveFilters(input: {
  sport?: string | string[] | null;
  q?: string | string[] | null;
  sort?: string | string[] | null;
}): ArchiveFilterState {
  const sportRaw = firstParam(input.sport)?.toLowerCase().trim() ?? 'all';
  const sport: ArchiveSport = SPORT_SET.has(sportRaw) ? (sportRaw as ArchiveSport) : 'all';

  const q = (firstParam(input.q) ?? '').trim().slice(0, 80);

  const sortRaw = firstParam(input.sort)?.toLowerCase().trim() ?? 'newest';
  const sort: ArchiveSort = sortRaw === 'oldest' ? 'oldest' : 'newest';

  return { sport, q, sort };
}

export function buildArchiveHref(state: Partial<ArchiveFilterState>): string {
  const full = parseArchiveFilters(state);
  const params = new URLSearchParams();
  if (full.sport !== 'all') params.set('sport', full.sport);
  if (full.q) params.set('q', full.q);
  if (full.sort !== 'newest') params.set('sort', full.sort);
  const qs = params.toString();
  return qs ? `/articles?${qs}` : '/articles';
}

export function filterArchiveArticles(
  articles: Article[],
  state: ArchiveFilterState,
): Article[] {
  const q = state.q.toLowerCase();
  const filtered = articles.filter((a) => {
    const okSport = state.sport === 'all' || a.sport === state.sport;
    if (!okSport) return false;
    if (!q) return true;
    const haystack =
      `${a.title} ${a.dek ?? ''} ${a.tags.join(' ')} ${sportLabel(a.sport)}`.toLowerCase();
    return haystack.includes(q);
  });

  filtered.sort((a, b) => {
    const da = +new Date(a.date);
    const db = +new Date(b.date);
    return state.sort === 'oldest' ? da - db : db - da;
  });

  return filtered;
}

export function archiveActiveChips(state: ArchiveFilterState): Array<{
  key: string;
  label: string;
  clearHref: string;
}> {
  const chips: Array<{ key: string; label: string; clearHref: string }> = [];
  if (state.sport !== 'all') {
    chips.push({
      key: 'sport',
      label: sportLabel(state.sport as SportSlug),
      clearHref: buildArchiveHref({ ...state, sport: 'all' }),
    });
  }
  if (state.q) {
    chips.push({
      key: 'q',
      label: `“${state.q}”`,
      clearHref: buildArchiveHref({ ...state, q: '' }),
    });
  }
  if (state.sort === 'oldest') {
    chips.push({
      key: 'sort',
      label: 'Oldest first',
      clearHref: buildArchiveHref({ ...state, sort: 'newest' }),
    });
  }
  return chips;
}

function firstParam(value: string | string[] | null | undefined): string | undefined {
  if (Array.isArray(value)) return value[0];
  return value ?? undefined;
}
