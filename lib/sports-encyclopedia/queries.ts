import { and, asc, eq, ilike, or, sql } from 'drizzle-orm';
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

export async function listSportsPeople(options: {
  leagueKey?: string;
  limit?: number;
} = {}): Promise<SportsPerson[]> {
  await ensureBootstrapped();
  const database = requireDb();
  const limit = Math.min(Math.max(options.limit ?? 100, 1), 200);
  if (options.leagueKey) {
    if (!isSportsLeagueKey(options.leagueKey)) return [];
    return database
      .select()
      .from(sportsPeople)
      .where(eq(sportsPeople.leagueKey, options.leagueKey))
      .orderBy(asc(sportsPeople.commonName))
      .limit(limit);
  }
  return database
    .select()
    .from(sportsPeople)
    .orderBy(asc(sportsPeople.leagueKey), asc(sportsPeople.commonName))
    .limit(limit);
}

export async function getSportsPerson(personKey: string): Promise<SportsPerson | null> {
  if (!personKey || personKey.length > 120) return null;
  await ensureBootstrapped();
  const database = requireDb();
  const rows = await database
    .select()
    .from(sportsPeople)
    .where(eq(sportsPeople.personKey, personKey))
    .limit(1);
  return rows[0] ?? null;
}

export async function searchSportsTeams(
  rawQuery: string,
  limit = 20,
): Promise<SportsTeam[]> {
  const query = rawQuery.trim().replace(/\s+/g, ' ').slice(0, 80);
  if (query.length < 2) return [];
  await ensureBootstrapped();
  const database = requireDb();
  const pattern = `%${query.replace(/[%_]/g, '')}%`;
  return database
    .select()
    .from(sportsTeams)
    .where(
      or(
        ilike(sportsTeams.displayName, pattern),
        ilike(sportsTeams.city, pattern),
        ilike(sportsTeams.nickname, pattern),
        ilike(sportsTeams.abbreviation, pattern),
        ilike(sportsTeams.teamKey, pattern),
      ),
    )
    .orderBy(asc(sportsTeams.displayName))
    .limit(Math.min(Math.max(limit, 1), 50));
}

export async function searchSportsPeople(
  rawQuery: string,
  limit = 20,
): Promise<SportsPerson[]> {
  const query = rawQuery.trim().replace(/\s+/g, ' ').slice(0, 80);
  if (query.length < 2) return [];
  await ensureBootstrapped();
  const database = requireDb();
  const pattern = `%${query.replace(/[%_]/g, '')}%`;
  return database
    .select()
    .from(sportsPeople)
    .where(
      or(
        ilike(sportsPeople.commonName, pattern),
        ilike(sportsPeople.fullName, pattern),
        ilike(sportsPeople.personKey, pattern),
        ilike(sportsPeople.positionOrTitle, pattern),
      ),
    )
    .orderBy(asc(sportsPeople.commonName))
    .limit(Math.min(Math.max(limit, 1), 50));
}

export async function getSportsEncyclopediaStats(): Promise<{
  leagues: number;
  teams: number;
  people: number;
  teamsByLeague: Record<string, number>;
  peopleByLeague: Record<string, number>;
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
  const peopleBy = await database
    .select({
      leagueKey: sportsPeople.leagueKey,
      n: sql<number>`count(*)::int`,
    })
    .from(sportsPeople)
    .groupBy(sportsPeople.leagueKey);
  const teamsByLeague: Record<string, number> = {};
  for (const row of byLeague) teamsByLeague[row.leagueKey] = row.n;
  const peopleByLeague: Record<string, number> = {};
  for (const row of peopleBy) peopleByLeague[row.leagueKey] = row.n;
  return {
    leagues: leagueCount?.n ?? 0,
    teams: teamCount?.n ?? 0,
    people: peopleCount?.n ?? 0,
    teamsByLeague,
    peopleByLeague,
  };
}
