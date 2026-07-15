import type { PersonSeed } from './types';

/**
 * First-party people registry for figures material to BB Sports coverage.
 *
 * These rows are NOT a scraped career-stats encyclopedia. Each record stores:
 * - identity (name)
 * - primary role and current/most-relevant team association
 * - a short BB Sports written summary
 * - source citation for the association fact
 *
 * Full historical box-score tables and proprietary advanced metrics are
 * intentionally omitted. Expand only with first-party research notes and
 * official club/league bio pages.
 *
 * Verified: 2026-07-15 against club official sites linked below.
 */
export const PERSON_SEEDS: readonly PersonSeed[] = Object.freeze([
  // NFL — Bears / coverage core
  Object.freeze({
    personKey: 'caleb-williams',
    fullName: 'Caleb Williams',
    commonName: 'Caleb Williams',
    role: 'player',
    leagueKey: 'nfl',
    teamKey: 'chicago-bears',
    positionOrTitle: 'Quarterback',
    summary:
      'Chicago Bears quarterback and the central figure of Brad’s Bears franchise thesis.',
    officialUrl: 'https://www.chicagobears.com/',
    dataSource: 'Chicago Bears official site roster context',
    dataSourceUrl: 'https://www.chicagobears.com/',
    dataConfidence: 'CROSS_REFERENCED',
    dataNotes: 'Identity/role only. No proprietary season stats table stored.',
  }),
  Object.freeze({
    personKey: 'ben-johnson-bears',
    fullName: 'Ben Johnson',
    commonName: 'Ben Johnson',
    role: 'head_coach',
    leagueKey: 'nfl',
    teamKey: 'chicago-bears',
    positionOrTitle: 'Head coach',
    summary:
      'Bears head-coaching hire material to BB Sports Bears coverage; re-verify title each offseason.',
    officialUrl: 'https://www.chicagobears.com/',
    dataSource: 'Chicago Bears official site',
    dataSourceUrl: 'https://www.chicagobears.com/',
    dataConfidence: 'FLAGGED',
    dataNotes:
      'Coaching tenures change. Confirm active title on Bears.com before treating as current in UI copy.',
  }),

  // MLB
  Object.freeze({
    personKey: 'aaron-judge',
    fullName: 'Aaron Judge',
    commonName: 'Aaron Judge',
    role: 'player',
    leagueKey: 'mlb',
    teamKey: 'new-york-yankees',
    positionOrTitle: 'Outfielder',
    summary: 'Yankees star regularly referenced in BB Sports Yankees franchise criticism.',
    officialUrl: 'https://www.mlb.com/yankees',
    dataSource: 'MLB.com / Yankees club page',
    dataSourceUrl: 'https://www.mlb.com/yankees',
    dataConfidence: 'CROSS_REFERENCED',
  }),
  Object.freeze({
    personKey: 'shohei-ohtani',
    fullName: 'Shohei Ohtani',
    commonName: 'Shohei Ohtani',
    role: 'player',
    leagueKey: 'mlb',
    teamKey: 'los-angeles-dodgers',
    positionOrTitle: 'Two-way player',
    summary: 'Dodgers franchise centerpiece in BB Sports baseball coverage.',
    officialUrl: 'https://www.mlb.com/dodgers',
    dataSource: 'MLB.com / Dodgers club page',
    dataSourceUrl: 'https://www.mlb.com/dodgers',
    dataConfidence: 'CROSS_REFERENCED',
  }),

  // NHL
  Object.freeze({
    personKey: 'connor-mcdavid',
    fullName: 'Connor McDavid',
    commonName: 'Connor McDavid',
    role: 'player',
    leagueKey: 'nhl',
    teamKey: 'edmonton-oilers',
    positionOrTitle: 'Center',
    summary: 'Oilers captain and primary elite-skill reference in NHL rankings copy.',
    officialUrl: 'https://www.nhl.com/oilers',
    dataSource: 'NHL.com / Oilers club page',
    dataSourceUrl: 'https://www.nhl.com/oilers',
    dataConfidence: 'CROSS_REFERENCED',
  }),
  Object.freeze({
    personKey: 'aleksander-barkov',
    fullName: 'Aleksander Barkov',
    commonName: 'Aleksander Barkov',
    role: 'player',
    leagueKey: 'nhl',
    teamKey: 'florida-panthers',
    positionOrTitle: 'Center',
    summary: 'Florida Panthers captain; central to Brad’s disclosed Panthers bias coverage.',
    officialUrl: 'https://www.nhl.com/panthers',
    dataSource: 'NHL.com / Panthers club page',
    dataSourceUrl: 'https://www.nhl.com/panthers',
    dataConfidence: 'CROSS_REFERENCED',
  }),
  Object.freeze({
    personKey: 'auston-matthews',
    fullName: 'Auston Matthews',
    commonName: 'Auston Matthews',
    role: 'player',
    leagueKey: 'nhl',
    teamKey: 'toronto-maple-leafs',
    positionOrTitle: 'Center',
    summary: 'Maple Leafs star referenced in BB Sports Leafs window columns.',
    officialUrl: 'https://www.nhl.com/mapleleafs',
    dataSource: 'NHL.com / Maple Leafs club page',
    dataSourceUrl: 'https://www.nhl.com/mapleleafs',
    dataConfidence: 'CROSS_REFERENCED',
  }),

  // NBA
  Object.freeze({
    personKey: 'lebron-james',
    fullName: 'LeBron James',
    commonName: 'LeBron James',
    role: 'player',
    leagueKey: 'nba',
    teamKey: 'los-angeles-lakers',
    positionOrTitle: 'Forward',
    summary: 'Lakers franchise figure referenced in BB Sports Lakers criticism.',
    officialUrl: 'https://www.nba.com/lakers',
    dataSource: 'NBA.com / Lakers club page',
    dataSourceUrl: 'https://www.nba.com/lakers',
    dataConfidence: 'CROSS_REFERENCED',
  }),
  Object.freeze({
    personKey: 'stephen-curry',
    fullName: 'Stephen Curry',
    commonName: 'Stephen Curry',
    role: 'player',
    leagueKey: 'nba',
    teamKey: 'golden-state-warriors',
    positionOrTitle: 'Guard',
    summary: 'Warriors franchise figure central to BB Sports dynasty-era columns.',
    officialUrl: 'https://www.nba.com/warriors',
    dataSource: 'NBA.com / Warriors club page',
    dataSourceUrl: 'https://www.nba.com/warriors',
    dataConfidence: 'CROSS_REFERENCED',
  }),
  Object.freeze({
    personKey: 'nikola-jokic',
    fullName: 'Nikola Jokić',
    commonName: 'Nikola Jokić',
    role: 'player',
    leagueKey: 'nba',
    teamKey: 'denver-nuggets',
    positionOrTitle: 'Center',
    summary: 'Nuggets franchise centerpiece in BB Sports NBA rankings framing.',
    officialUrl: 'https://www.nba.com/nuggets',
    dataSource: 'NBA.com / Nuggets club page',
    dataSourceUrl: 'https://www.nba.com/nuggets',
    dataConfidence: 'CROSS_REFERENCED',
  }),
  Object.freeze({
    personKey: 'erik-spoelstra',
    fullName: 'Erik Spoelstra',
    commonName: 'Erik Spoelstra',
    role: 'head_coach',
    leagueKey: 'nba',
    teamKey: 'miami-heat',
    positionOrTitle: 'Head coach',
    summary: 'Long-tenured Heat head coach referenced in BB Sports Heat franchise notes.',
    officialUrl: 'https://www.nba.com/heat',
    dataSource: 'NBA.com / Heat club page',
    dataSourceUrl: 'https://www.nba.com/heat',
    dataConfidence: 'CROSS_REFERENCED',
  }),
]);
