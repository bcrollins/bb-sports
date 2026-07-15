/**
 * BB Sports first-party sports encyclopedia types.
 *
 * This is not a licensed stats feed and not a scrape of a third-party database.
 * Records store public franchise identity facts (names, cities, conferences)
 * compiled for BB Sports with explicit source citations on every row.
 */

export const SPORTS_DATA_CONFIDENCE = ['VERIFIED', 'CROSS_REFERENCED', 'FLAGGED'] as const;
export type SportsDataConfidence = (typeof SPORTS_DATA_CONFIDENCE)[number];

export const SPORTS_LEAGUE_KEYS = ['nfl', 'mlb', 'nhl', 'nba'] as const;
export type SportsLeagueKey = (typeof SPORTS_LEAGUE_KEYS)[number];

export const SPORTS_PERSON_ROLES = [
  'player',
  'head_coach',
  'general_manager',
  'owner',
  'executive',
] as const;
export type SportsPersonRole = (typeof SPORTS_PERSON_ROLES)[number];

export type LeagueSeed = Readonly<{
  leagueKey: SportsLeagueKey;
  displayName: string;
  shortName: string;
  sport: string;
  governingBody: string;
  officialUrl: string;
  teamCount: number;
  dataSource: string;
  dataSourceUrl: string;
  dataConfidence: SportsDataConfidence;
  dataNotes?: string;
}>;

export type TeamSeed = Readonly<{
  leagueKey: SportsLeagueKey;
  teamKey: string;
  displayName: string;
  city: string;
  nickname: string;
  abbreviation: string;
  conference: string | null;
  division: string | null;
  /** Year the franchise began continuous major-league play under current identity lineage. */
  foundedYear: number | null;
  officialUrl: string;
  /** Optional link to Brad rankings id when this franchise appears in top-25 baselines. */
  rankingsId: string | null;
  dataSource: string;
  dataSourceUrl: string;
  dataConfidence: SportsDataConfidence;
  dataNotes?: string;
}>;

export type PersonSeed = Readonly<{
  personKey: string;
  fullName: string;
  commonName: string;
  role: SportsPersonRole;
  leagueKey: SportsLeagueKey;
  teamKey: string;
  positionOrTitle: string;
  /** Free-text career note written by BB Sports; not a proprietary stat line scrape. */
  summary: string;
  /** Optional official bio or club page. */
  officialUrl: string | null;
  dataSource: string;
  dataSourceUrl: string;
  dataConfidence: SportsDataConfidence;
  dataNotes?: string;
}>;
