import { and, asc, eq, sql } from 'drizzle-orm';
import { db } from '../db/client';
import { ensureBootstrapped } from '../db/bootstrap';
import {
  sportsLeagues,
  sportsPeople,
  sportsTeams,
  type SportsLeague,
  type SportsPerson,
  type SportsTeam,
} from '../db/schema';
import { SPORTS_LEAGUE_KEYS, type SportsLeagueKey } from './types';

export function isSportsLeagueKey(value: string): value is SportsLeagueKey {
  return (SPORTS_LEAGUE_KEYS as readonly string[]).includes(value);
}

function requireDb() {
  if (!db) throw new Error('DATABASE_URL is not configured.');
  return db;
}

export async function listSportsLeagues(): Promise<SportsLeague[]> {
  await ensureBootstrapped();
  const database = requireDb();
  return database.select().from(sportsLeagues).orderBy(asc(sportsLeagues.shortName));
}

export async function getSportsLeague(leagueKey: string): Promise<SportsLeague | null> {
  if (!isSportsLeagueKey(leagueKey)) return null;
  await ensureBootstrapped();
  const database = requireDb();
  const rows = await database
    .select()
    .from(sportsLeagues)
    .where(eq(sportsLeagues.leagueKey, leagueKey))
    .limit(1);
  return rows[0] ?? null;
}

export async function listSportsTeams(options: {
  leagueKey?: string;
  limit?: number;
} = {}): Promise<SportsTeam[]> {
  await ensureBootstrapped();
  const database = requireDb();
  const limit = Math.min(Math.max(options.limit ?? 200, 1), 200);
  if (options.leagueKey) {
    if (!isSportsLeagueKey(options.leagueKey)) return [];
    return database
      .select()
      .from(sportsTeams)
      .where(eq(sportsTeams.leagueKey, options.leagueKey))
      .orderBy(asc(sportsTeams.city), asc(sportsTeams.nickname))
      .limit(limit);
  }
  return database
    .select()
    .from(sportsTeams)
    .orderBy(asc(sportsTeams.leagueKey), asc(sportsTeams.city), asc(sportsTeams.nickname))
    .limit(limit);
}

export async function getSportsTeam(
  leagueKey: string,
  teamKey: string,
): Promise<SportsTeam | null> {
  if (!isSportsLeagueKey(leagueKey) || !teamKey) return null;
  await ensureBootstrapped();
  const database = requireDb();
  const rows = await database
    .select()
    .from(sportsTeams)
    .where(and(eq(sportsTeams.leagueKey, leagueKey), eq(sportsTeams.teamKey, teamKey)))
    .limit(1);
  return rows[0] ?? null;
}

export async function listPeopleForTeam(
  leagueKey: string,
  teamKey: string,
): Promise<SportsPerson[]> {
  if (!isSportsLeagueKey(leagueKey) || !teamKey) return [];
  await ensureBootstrapped();
  const database = requireDb();
  return database
    .select()
    .from(sportsPeople)
    .where(and(eq(sportsPeople.leagueKey, leagueKey), eq(sportsPeople.teamKey, teamKey)))
    .orderBy(asc(sportsPeople.role), asc(sportsPeople.commonName))
    .limit(100);
}

export async function getSportsEncyclopediaStats(): Promise<{
  leagues: number;
  teams: number;
  people: number;
  teamsByLeague: Record<string, number>;
}> {
  await ensureBootstrapped();
  const database = requireDb();
  const [leagueCount] = await database
    .select({ n: sql<number>`count(*)::int` })
    .from(sportsLeagues);
  const [teamCount] = await database.select({ n: sql<number>`count(*)::int` }).from(sportsTeams);
  const [peopleCount] = await database
    .select({ n: sql<number>`count(*)::int` })
    .from(sportsPeople);
  const byLeague = await database
    .select({
      leagueKey: sportsTeams.leagueKey,
      n: sql<number>`count(*)::int`,
    })
    .from(sportsTeams)
    .groupBy(sportsTeams.leagueKey);
  const teamsByLeague: Record<string, number> = {};
  for (const row of byLeague) teamsByLeague[row.leagueKey] = row.n;
  return {
    leagues: leagueCount?.n ?? 0,
    teams: teamCount?.n ?? 0,
    people: peopleCount?.n ?? 0,
    teamsByLeague,
  };
}
