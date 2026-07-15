import type { LeagueSeed } from './types';

/**
 * League registry.
 *
 * Primary identity sources (public organizational facts):
 * - NFL: https://www.nfl.com/teams/ (accessed 2026-07-15)
 * - MLB: https://www.mlb.com/team (accessed 2026-07-15)
 * - NHL: https://www.nhl.com/info/teams (accessed 2026-07-15)
 * - NBA: https://www.nba.com/teams (accessed 2026-07-15)
 *
 * Team counts are the number of active franchises in the 2025–26 / 2026
 * competitive seasons as listed on those official team directories.
 */
export const LEAGUE_SEEDS: readonly LeagueSeed[] = Object.freeze([
  Object.freeze({
    leagueKey: 'nfl',
    displayName: 'National Football League',
    shortName: 'NFL',
    sport: 'American football',
    governingBody: 'National Football League',
    officialUrl: 'https://www.nfl.com/',
    teamCount: 32,
    dataSource: 'NFL official site — Teams directory',
    dataSourceUrl: 'https://www.nfl.com/teams/',
    dataConfidence: 'VERIFIED',
    dataNotes: 'Active franchise count for the 2025 NFL season as published by NFL.com.',
  }),
  Object.freeze({
    leagueKey: 'mlb',
    displayName: 'Major League Baseball',
    shortName: 'MLB',
    sport: 'Baseball',
    governingBody: 'Major League Baseball',
    officialUrl: 'https://www.mlb.com/',
    teamCount: 30,
    dataSource: 'MLB official site — Team directory',
    dataSourceUrl: 'https://www.mlb.com/team',
    dataConfidence: 'VERIFIED',
    dataNotes: 'Active club count for the 2026 MLB season as published by MLB.com.',
  }),
  Object.freeze({
    leagueKey: 'nhl',
    displayName: 'National Hockey League',
    shortName: 'NHL',
    sport: 'Ice hockey',
    governingBody: 'National Hockey League',
    officialUrl: 'https://www.nhl.com/',
    teamCount: 32,
    dataSource: 'NHL official site — Teams',
    dataSourceUrl: 'https://www.nhl.com/info/teams',
    dataConfidence: 'VERIFIED',
    dataNotes: 'Active franchise count for the 2025–26 NHL season as published by NHL.com.',
  }),
  Object.freeze({
    leagueKey: 'nba',
    displayName: 'National Basketball Association',
    shortName: 'NBA',
    sport: 'Basketball',
    governingBody: 'National Basketball Association',
    officialUrl: 'https://www.nba.com/',
    teamCount: 30,
    dataSource: 'NBA official site — Teams',
    dataSourceUrl: 'https://www.nba.com/teams',
    dataConfidence: 'VERIFIED',
    dataNotes: 'Active franchise count for the 2025–26 NBA season as published by NBA.com.',
  }),
]);
