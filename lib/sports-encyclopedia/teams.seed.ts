import type { TeamSeed } from './types';

const SRC = {
  nfl: {
    dataSource: 'NFL.com team directory + club official site',
    dataSourceUrl: 'https://www.nfl.com/teams/',
  },
  mlb: {
    dataSource: 'MLB.com team directory + club official site',
    dataSourceUrl: 'https://www.mlb.com/team',
  },
  nhl: {
    dataSource: 'NHL.com teams directory + club official site',
    dataSourceUrl: 'https://www.nhl.com/info/teams',
  },
  nba: {
    dataSource: 'NBA.com teams directory + club official site',
    dataSourceUrl: 'https://www.nba.com/teams',
  },
} as const;

function team(
  partial: Omit<TeamSeed, 'dataSource' | 'dataSourceUrl' | 'dataConfidence'> & {
    dataConfidence?: TeamSeed['dataConfidence'];
  },
): TeamSeed {
  const leagueSrc = SRC[partial.leagueKey];
  return Object.freeze({
    ...partial,
    dataSource: leagueSrc.dataSource,
    dataSourceUrl: partial.officialUrl || leagueSrc.dataSourceUrl,
    dataConfidence: partial.dataConfidence ?? 'VERIFIED',
  });
}

/**
 * Complete active franchise registries for the four major North American leagues.
 *
 * Scope of facts stored here (public organizational identity only):
 * - market/city, nickname, abbreviation, conference/division, official club URL
 * - optional BB Sports rankings id when the franchise appears in Brad's top-25
 *
 * Explicitly NOT stored: proprietary box scores, paywalled advanced metrics,
 * copyrighted encyclopedia article prose, or scraped third-party stat tables.
 *
 * Verified: 2026-07-15 against official league team directories listed in SRC.
 */
export const TEAM_SEEDS: readonly TeamSeed[] = Object.freeze([
  // ---------- NFL (32) ----------
  team({ leagueKey: 'nfl', teamKey: 'arizona-cardinals', displayName: 'Arizona Cardinals', city: 'Arizona', nickname: 'Cardinals', abbreviation: 'ARI', conference: 'NFC', division: 'West', foundedYear: 1920, officialUrl: 'https://www.azcardinals.com/', rankingsId: 'cardinals' }),
  team({ leagueKey: 'nfl', teamKey: 'atlanta-falcons', displayName: 'Atlanta Falcons', city: 'Atlanta', nickname: 'Falcons', abbreviation: 'ATL', conference: 'NFC', division: 'South', foundedYear: 1966, officialUrl: 'https://www.atlantafalcons.com/', rankingsId: 'falcons' }),
  team({ leagueKey: 'nfl', teamKey: 'baltimore-ravens', displayName: 'Baltimore Ravens', city: 'Baltimore', nickname: 'Ravens', abbreviation: 'BAL', conference: 'AFC', division: 'North', foundedYear: 1996, officialUrl: 'https://www.baltimoreravens.com/', rankingsId: 'ravens' }),
  team({ leagueKey: 'nfl', teamKey: 'buffalo-bills', displayName: 'Buffalo Bills', city: 'Buffalo', nickname: 'Bills', abbreviation: 'BUF', conference: 'AFC', division: 'East', foundedYear: 1960, officialUrl: 'https://www.buffalobills.com/', rankingsId: 'bills' }),
  team({ leagueKey: 'nfl', teamKey: 'carolina-panthers', displayName: 'Carolina Panthers', city: 'Carolina', nickname: 'Panthers', abbreviation: 'CAR', conference: 'NFC', division: 'South', foundedYear: 1995, officialUrl: 'https://www.panthers.com/', rankingsId: 'panthers-nfl' }),
  team({ leagueKey: 'nfl', teamKey: 'chicago-bears', displayName: 'Chicago Bears', city: 'Chicago', nickname: 'Bears', abbreviation: 'CHI', conference: 'NFC', division: 'North', foundedYear: 1920, officialUrl: 'https://www.chicagobears.com/', rankingsId: 'bears' }),
  team({ leagueKey: 'nfl', teamKey: 'cincinnati-bengals', displayName: 'Cincinnati Bengals', city: 'Cincinnati', nickname: 'Bengals', abbreviation: 'CIN', conference: 'AFC', division: 'North', foundedYear: 1968, officialUrl: 'https://www.bengals.com/', rankingsId: 'bengals' }),
  team({ leagueKey: 'nfl', teamKey: 'cleveland-browns', displayName: 'Cleveland Browns', city: 'Cleveland', nickname: 'Browns', abbreviation: 'CLE', conference: 'AFC', division: 'North', foundedYear: 1946, officialUrl: 'https://www.clevelandbrowns.com/', rankingsId: null }),
  team({ leagueKey: 'nfl', teamKey: 'dallas-cowboys', displayName: 'Dallas Cowboys', city: 'Dallas', nickname: 'Cowboys', abbreviation: 'DAL', conference: 'NFC', division: 'East', foundedYear: 1960, officialUrl: 'https://www.dallascowboys.com/', rankingsId: 'cowboys' }),
  team({ leagueKey: 'nfl', teamKey: 'denver-broncos', displayName: 'Denver Broncos', city: 'Denver', nickname: 'Broncos', abbreviation: 'DEN', conference: 'AFC', division: 'West', foundedYear: 1960, officialUrl: 'https://www.denverbroncos.com/', rankingsId: 'broncos' }),
  team({ leagueKey: 'nfl', teamKey: 'detroit-lions', displayName: 'Detroit Lions', city: 'Detroit', nickname: 'Lions', abbreviation: 'DET', conference: 'NFC', division: 'North', foundedYear: 1930, officialUrl: 'https://www.detroitlions.com/', rankingsId: 'lions' }),
  team({ leagueKey: 'nfl', teamKey: 'green-bay-packers', displayName: 'Green Bay Packers', city: 'Green Bay', nickname: 'Packers', abbreviation: 'GB', conference: 'NFC', division: 'North', foundedYear: 1919, officialUrl: 'https://www.packers.com/', rankingsId: 'packers' }),
  team({ leagueKey: 'nfl', teamKey: 'houston-texans', displayName: 'Houston Texans', city: 'Houston', nickname: 'Texans', abbreviation: 'HOU', conference: 'AFC', division: 'South', foundedYear: 2002, officialUrl: 'https://www.houstontexans.com/', rankingsId: 'texans' }),
  team({ leagueKey: 'nfl', teamKey: 'indianapolis-colts', displayName: 'Indianapolis Colts', city: 'Indianapolis', nickname: 'Colts', abbreviation: 'IND', conference: 'AFC', division: 'South', foundedYear: 1953, officialUrl: 'https://www.colts.com/', rankingsId: 'colts' }),
  team({ leagueKey: 'nfl', teamKey: 'jacksonville-jaguars', displayName: 'Jacksonville Jaguars', city: 'Jacksonville', nickname: 'Jaguars', abbreviation: 'JAX', conference: 'AFC', division: 'South', foundedYear: 1995, officialUrl: 'https://www.jaguars.com/', rankingsId: 'jaguars' }),
  team({ leagueKey: 'nfl', teamKey: 'kansas-city-chiefs', displayName: 'Kansas City Chiefs', city: 'Kansas City', nickname: 'Chiefs', abbreviation: 'KC', conference: 'AFC', division: 'West', foundedYear: 1960, officialUrl: 'https://www.chiefs.com/', rankingsId: 'chiefs' }),
  team({ leagueKey: 'nfl', teamKey: 'las-vegas-raiders', displayName: 'Las Vegas Raiders', city: 'Las Vegas', nickname: 'Raiders', abbreviation: 'LV', conference: 'AFC', division: 'West', foundedYear: 1960, officialUrl: 'https://www.raiders.com/', rankingsId: null }),
  team({ leagueKey: 'nfl', teamKey: 'los-angeles-chargers', displayName: 'Los Angeles Chargers', city: 'Los Angeles', nickname: 'Chargers', abbreviation: 'LAC', conference: 'AFC', division: 'West', foundedYear: 1960, officialUrl: 'https://www.chargers.com/', rankingsId: 'chargers' }),
  team({ leagueKey: 'nfl', teamKey: 'los-angeles-rams', displayName: 'Los Angeles Rams', city: 'Los Angeles', nickname: 'Rams', abbreviation: 'LAR', conference: 'NFC', division: 'West', foundedYear: 1936, officialUrl: 'https://www.therams.com/', rankingsId: 'rams' }),
  team({ leagueKey: 'nfl', teamKey: 'miami-dolphins', displayName: 'Miami Dolphins', city: 'Miami', nickname: 'Dolphins', abbreviation: 'MIA', conference: 'AFC', division: 'East', foundedYear: 1966, officialUrl: 'https://www.miamidolphins.com/', rankingsId: 'dolphins' }),
  team({ leagueKey: 'nfl', teamKey: 'minnesota-vikings', displayName: 'Minnesota Vikings', city: 'Minnesota', nickname: 'Vikings', abbreviation: 'MIN', conference: 'NFC', division: 'North', foundedYear: 1961, officialUrl: 'https://www.vikings.com/', rankingsId: 'vikings' }),
  team({ leagueKey: 'nfl', teamKey: 'new-england-patriots', displayName: 'New England Patriots', city: 'New England', nickname: 'Patriots', abbreviation: 'NE', conference: 'AFC', division: 'East', foundedYear: 1960, officialUrl: 'https://www.patriots.com/', rankingsId: null }),
  team({ leagueKey: 'nfl', teamKey: 'new-orleans-saints', displayName: 'New Orleans Saints', city: 'New Orleans', nickname: 'Saints', abbreviation: 'NO', conference: 'NFC', division: 'South', foundedYear: 1967, officialUrl: 'https://www.neworleanssaints.com/', rankingsId: null }),
  team({ leagueKey: 'nfl', teamKey: 'new-york-giants', displayName: 'New York Giants', city: 'New York', nickname: 'Giants', abbreviation: 'NYG', conference: 'NFC', division: 'East', foundedYear: 1925, officialUrl: 'https://www.giants.com/', rankingsId: null }),
  team({ leagueKey: 'nfl', teamKey: 'new-york-jets', displayName: 'New York Jets', city: 'New York', nickname: 'Jets', abbreviation: 'NYJ', conference: 'AFC', division: 'East', foundedYear: 1960, officialUrl: 'https://www.newyorkjets.com/', rankingsId: 'jets' }),
  team({ leagueKey: 'nfl', teamKey: 'philadelphia-eagles', displayName: 'Philadelphia Eagles', city: 'Philadelphia', nickname: 'Eagles', abbreviation: 'PHI', conference: 'NFC', division: 'East', foundedYear: 1933, officialUrl: 'https://www.philadelphiaeagles.com/', rankingsId: 'eagles' }),
  team({ leagueKey: 'nfl', teamKey: 'pittsburgh-steelers', displayName: 'Pittsburgh Steelers', city: 'Pittsburgh', nickname: 'Steelers', abbreviation: 'PIT', conference: 'AFC', division: 'North', foundedYear: 1933, officialUrl: 'https://www.steelers.com/', rankingsId: 'steelers' }),
  team({ leagueKey: 'nfl', teamKey: 'san-francisco-49ers', displayName: 'San Francisco 49ers', city: 'San Francisco', nickname: '49ers', abbreviation: 'SF', conference: 'NFC', division: 'West', foundedYear: 1946, officialUrl: 'https://www.49ers.com/', rankingsId: '49ers' }),
  team({ leagueKey: 'nfl', teamKey: 'seattle-seahawks', displayName: 'Seattle Seahawks', city: 'Seattle', nickname: 'Seahawks', abbreviation: 'SEA', conference: 'NFC', division: 'West', foundedYear: 1976, officialUrl: 'https://www.seahawks.com/', rankingsId: 'seahawks' }),
  team({ leagueKey: 'nfl', teamKey: 'tampa-bay-buccaneers', displayName: 'Tampa Bay Buccaneers', city: 'Tampa Bay', nickname: 'Buccaneers', abbreviation: 'TB', conference: 'NFC', division: 'South', foundedYear: 1976, officialUrl: 'https://www.buccaneers.com/', rankingsId: null }),
  team({ leagueKey: 'nfl', teamKey: 'tennessee-titans', displayName: 'Tennessee Titans', city: 'Tennessee', nickname: 'Titans', abbreviation: 'TEN', conference: 'AFC', division: 'South', foundedYear: 1960, officialUrl: 'https://www.tennesseetitans.com/', rankingsId: null }),
  team({ leagueKey: 'nfl', teamKey: 'washington-commanders', displayName: 'Washington Commanders', city: 'Washington', nickname: 'Commanders', abbreviation: 'WAS', conference: 'NFC', division: 'East', foundedYear: 1932, officialUrl: 'https://www.commanders.com/', rankingsId: 'commanders' }),

  // ---------- MLB (30) ----------
  team({ leagueKey: 'mlb', teamKey: 'arizona-diamondbacks', displayName: 'Arizona Diamondbacks', city: 'Arizona', nickname: 'Diamondbacks', abbreviation: 'AZ', conference: 'NL', division: 'West', foundedYear: 1998, officialUrl: 'https://www.mlb.com/dbacks', rankingsId: 'diamondbacks' }),
  team({ leagueKey: 'mlb', teamKey: 'atlanta-braves', displayName: 'Atlanta Braves', city: 'Atlanta', nickname: 'Braves', abbreviation: 'ATL', conference: 'NL', division: 'East', foundedYear: 1871, officialUrl: 'https://www.mlb.com/braves', rankingsId: 'braves' }),
  team({ leagueKey: 'mlb', teamKey: 'baltimore-orioles', displayName: 'Baltimore Orioles', city: 'Baltimore', nickname: 'Orioles', abbreviation: 'BAL', conference: 'AL', division: 'East', foundedYear: 1901, officialUrl: 'https://www.mlb.com/orioles', rankingsId: 'orioles' }),
  team({ leagueKey: 'mlb', teamKey: 'boston-red-sox', displayName: 'Boston Red Sox', city: 'Boston', nickname: 'Red Sox', abbreviation: 'BOS', conference: 'AL', division: 'East', foundedYear: 1901, officialUrl: 'https://www.mlb.com/redsox', rankingsId: 'redsox' }),
  team({ leagueKey: 'mlb', teamKey: 'chicago-cubs', displayName: 'Chicago Cubs', city: 'Chicago', nickname: 'Cubs', abbreviation: 'CHC', conference: 'NL', division: 'Central', foundedYear: 1876, officialUrl: 'https://www.mlb.com/cubs', rankingsId: 'cubs' }),
  team({ leagueKey: 'mlb', teamKey: 'chicago-white-sox', displayName: 'Chicago White Sox', city: 'Chicago', nickname: 'White Sox', abbreviation: 'CWS', conference: 'AL', division: 'Central', foundedYear: 1901, officialUrl: 'https://www.mlb.com/whitesox', rankingsId: null }),
  team({ leagueKey: 'mlb', teamKey: 'cincinnati-reds', displayName: 'Cincinnati Reds', city: 'Cincinnati', nickname: 'Reds', abbreviation: 'CIN', conference: 'NL', division: 'Central', foundedYear: 1882, officialUrl: 'https://www.mlb.com/reds', rankingsId: 'reds' }),
  team({ leagueKey: 'mlb', teamKey: 'cleveland-guardians', displayName: 'Cleveland Guardians', city: 'Cleveland', nickname: 'Guardians', abbreviation: 'CLE', conference: 'AL', division: 'Central', foundedYear: 1901, officialUrl: 'https://www.mlb.com/guardians', rankingsId: 'guardians' }),
  team({ leagueKey: 'mlb', teamKey: 'colorado-rockies', displayName: 'Colorado Rockies', city: 'Colorado', nickname: 'Rockies', abbreviation: 'COL', conference: 'NL', division: 'West', foundedYear: 1993, officialUrl: 'https://www.mlb.com/rockies', rankingsId: null }),
  team({ leagueKey: 'mlb', teamKey: 'detroit-tigers', displayName: 'Detroit Tigers', city: 'Detroit', nickname: 'Tigers', abbreviation: 'DET', conference: 'AL', division: 'Central', foundedYear: 1901, officialUrl: 'https://www.mlb.com/tigers', rankingsId: 'tigers' }),
  team({ leagueKey: 'mlb', teamKey: 'houston-astros', displayName: 'Houston Astros', city: 'Houston', nickname: 'Astros', abbreviation: 'HOU', conference: 'AL', division: 'West', foundedYear: 1962, officialUrl: 'https://www.mlb.com/astros', rankingsId: 'astros' }),
  team({ leagueKey: 'mlb', teamKey: 'kansas-city-royals', displayName: 'Kansas City Royals', city: 'Kansas City', nickname: 'Royals', abbreviation: 'KC', conference: 'AL', division: 'Central', foundedYear: 1969, officialUrl: 'https://www.mlb.com/royals', rankingsId: 'royals' }),
  team({ leagueKey: 'mlb', teamKey: 'los-angeles-angels', displayName: 'Los Angeles Angels', city: 'Los Angeles', nickname: 'Angels', abbreviation: 'LAA', conference: 'AL', division: 'West', foundedYear: 1961, officialUrl: 'https://www.mlb.com/angels', rankingsId: 'angels' }),
  team({ leagueKey: 'mlb', teamKey: 'los-angeles-dodgers', displayName: 'Los Angeles Dodgers', city: 'Los Angeles', nickname: 'Dodgers', abbreviation: 'LAD', conference: 'NL', division: 'West', foundedYear: 1883, officialUrl: 'https://www.mlb.com/dodgers', rankingsId: 'dodgers' }),
  team({ leagueKey: 'mlb', teamKey: 'miami-marlins', displayName: 'Miami Marlins', city: 'Miami', nickname: 'Marlins', abbreviation: 'MIA', conference: 'NL', division: 'East', foundedYear: 1993, officialUrl: 'https://www.mlb.com/marlins', rankingsId: 'marlins' }),
  team({ leagueKey: 'mlb', teamKey: 'milwaukee-brewers', displayName: 'Milwaukee Brewers', city: 'Milwaukee', nickname: 'Brewers', abbreviation: 'MIL', conference: 'NL', division: 'Central', foundedYear: 1969, officialUrl: 'https://www.mlb.com/brewers', rankingsId: 'brewers' }),
  team({ leagueKey: 'mlb', teamKey: 'minnesota-twins', displayName: 'Minnesota Twins', city: 'Minnesota', nickname: 'Twins', abbreviation: 'MIN', conference: 'AL', division: 'Central', foundedYear: 1901, officialUrl: 'https://www.mlb.com/twins', rankingsId: 'twins' }),
  team({ leagueKey: 'mlb', teamKey: 'new-york-mets', displayName: 'New York Mets', city: 'New York', nickname: 'Mets', abbreviation: 'NYM', conference: 'NL', division: 'East', foundedYear: 1962, officialUrl: 'https://www.mlb.com/mets', rankingsId: 'mets' }),
  team({ leagueKey: 'mlb', teamKey: 'new-york-yankees', displayName: 'New York Yankees', city: 'New York', nickname: 'Yankees', abbreviation: 'NYY', conference: 'AL', division: 'East', foundedYear: 1903, officialUrl: 'https://www.mlb.com/yankees', rankingsId: 'yankees' }),
  team({ leagueKey: 'mlb', teamKey: 'oakland-athletics', displayName: 'Athletics', city: 'Sacramento', nickname: 'Athletics', abbreviation: 'ATH', conference: 'AL', division: 'West', foundedYear: 1901, officialUrl: 'https://www.mlb.com/athletics', rankingsId: null, dataNotes: 'Franchise listed on MLB.com as Athletics; temporary Sacramento market during relocation window. Re-verify market annually.' }),
  team({ leagueKey: 'mlb', teamKey: 'philadelphia-phillies', displayName: 'Philadelphia Phillies', city: 'Philadelphia', nickname: 'Phillies', abbreviation: 'PHI', conference: 'NL', division: 'East', foundedYear: 1883, officialUrl: 'https://www.mlb.com/phillies', rankingsId: 'phillies' }),
  team({ leagueKey: 'mlb', teamKey: 'pittsburgh-pirates', displayName: 'Pittsburgh Pirates', city: 'Pittsburgh', nickname: 'Pirates', abbreviation: 'PIT', conference: 'NL', division: 'Central', foundedYear: 1882, officialUrl: 'https://www.mlb.com/pirates', rankingsId: 'pirates' }),
  team({ leagueKey: 'mlb', teamKey: 'san-diego-padres', displayName: 'San Diego Padres', city: 'San Diego', nickname: 'Padres', abbreviation: 'SD', conference: 'NL', division: 'West', foundedYear: 1969, officialUrl: 'https://www.mlb.com/padres', rankingsId: 'padres' }),
  team({ leagueKey: 'mlb', teamKey: 'san-francisco-giants', displayName: 'San Francisco Giants', city: 'San Francisco', nickname: 'Giants', abbreviation: 'SF', conference: 'NL', division: 'West', foundedYear: 1883, officialUrl: 'https://www.mlb.com/giants', rankingsId: 'giants' }),
  team({ leagueKey: 'mlb', teamKey: 'seattle-mariners', displayName: 'Seattle Mariners', city: 'Seattle', nickname: 'Mariners', abbreviation: 'SEA', conference: 'AL', division: 'West', foundedYear: 1977, officialUrl: 'https://www.mlb.com/mariners', rankingsId: 'mariners' }),
  team({ leagueKey: 'mlb', teamKey: 'st-louis-cardinals', displayName: 'St. Louis Cardinals', city: 'St. Louis', nickname: 'Cardinals', abbreviation: 'STL', conference: 'NL', division: 'Central', foundedYear: 1882, officialUrl: 'https://www.mlb.com/cardinals', rankingsId: 'cardinals-mlb' }),
  team({ leagueKey: 'mlb', teamKey: 'tampa-bay-rays', displayName: 'Tampa Bay Rays', city: 'Tampa Bay', nickname: 'Rays', abbreviation: 'TB', conference: 'AL', division: 'East', foundedYear: 1998, officialUrl: 'https://www.mlb.com/rays', rankingsId: 'rays' }),
  team({ leagueKey: 'mlb', teamKey: 'texas-rangers', displayName: 'Texas Rangers', city: 'Texas', nickname: 'Rangers', abbreviation: 'TEX', conference: 'AL', division: 'West', foundedYear: 1961, officialUrl: 'https://www.mlb.com/rangers', rankingsId: 'rangers' }),
  team({ leagueKey: 'mlb', teamKey: 'toronto-blue-jays', displayName: 'Toronto Blue Jays', city: 'Toronto', nickname: 'Blue Jays', abbreviation: 'TOR', conference: 'AL', division: 'East', foundedYear: 1977, officialUrl: 'https://www.mlb.com/bluejays', rankingsId: null }),
  team({ leagueKey: 'mlb', teamKey: 'washington-nationals', displayName: 'Washington Nationals', city: 'Washington', nickname: 'Nationals', abbreviation: 'WSH', conference: 'NL', division: 'East', foundedYear: 1969, officialUrl: 'https://www.mlb.com/nationals', rankingsId: null }),

  // ---------- NHL (32) ----------
  team({ leagueKey: 'nhl', teamKey: 'anaheim-ducks', displayName: 'Anaheim Ducks', city: 'Anaheim', nickname: 'Ducks', abbreviation: 'ANA', conference: 'Western', division: 'Pacific', foundedYear: 1993, officialUrl: 'https://www.nhl.com/ducks', rankingsId: 'ducks' }),
  team({ leagueKey: 'nhl', teamKey: 'boston-bruins', displayName: 'Boston Bruins', city: 'Boston', nickname: 'Bruins', abbreviation: 'BOS', conference: 'Eastern', division: 'Atlantic', foundedYear: 1924, officialUrl: 'https://www.nhl.com/bruins', rankingsId: 'bruins' }),
  team({ leagueKey: 'nhl', teamKey: 'buffalo-sabres', displayName: 'Buffalo Sabres', city: 'Buffalo', nickname: 'Sabres', abbreviation: 'BUF', conference: 'Eastern', division: 'Atlantic', foundedYear: 1970, officialUrl: 'https://www.nhl.com/sabres', rankingsId: 'sabres' }),
  team({ leagueKey: 'nhl', teamKey: 'calgary-flames', displayName: 'Calgary Flames', city: 'Calgary', nickname: 'Flames', abbreviation: 'CGY', conference: 'Western', division: 'Pacific', foundedYear: 1972, officialUrl: 'https://www.nhl.com/flames', rankingsId: 'flames' }),
  team({ leagueKey: 'nhl', teamKey: 'carolina-hurricanes', displayName: 'Carolina Hurricanes', city: 'Carolina', nickname: 'Hurricanes', abbreviation: 'CAR', conference: 'Eastern', division: 'Metropolitan', foundedYear: 1979, officialUrl: 'https://www.nhl.com/hurricanes', rankingsId: 'hurricanes' }),
  team({ leagueKey: 'nhl', teamKey: 'chicago-blackhawks', displayName: 'Chicago Blackhawks', city: 'Chicago', nickname: 'Blackhawks', abbreviation: 'CHI', conference: 'Western', division: 'Central', foundedYear: 1926, officialUrl: 'https://www.nhl.com/blackhawks', rankingsId: null }),
  team({ leagueKey: 'nhl', teamKey: 'colorado-avalanche', displayName: 'Colorado Avalanche', city: 'Colorado', nickname: 'Avalanche', abbreviation: 'COL', conference: 'Western', division: 'Central', foundedYear: 1979, officialUrl: 'https://www.nhl.com/avalanche', rankingsId: 'avalanche' }),
  team({ leagueKey: 'nhl', teamKey: 'columbus-blue-jackets', displayName: 'Columbus Blue Jackets', city: 'Columbus', nickname: 'Blue Jackets', abbreviation: 'CBJ', conference: 'Eastern', division: 'Metropolitan', foundedYear: 2000, officialUrl: 'https://www.nhl.com/bluejackets', rankingsId: 'jackets' }),
  team({ leagueKey: 'nhl', teamKey: 'dallas-stars', displayName: 'Dallas Stars', city: 'Dallas', nickname: 'Stars', abbreviation: 'DAL', conference: 'Western', division: 'Central', foundedYear: 1967, officialUrl: 'https://www.nhl.com/stars', rankingsId: 'stars' }),
  team({ leagueKey: 'nhl', teamKey: 'detroit-red-wings', displayName: 'Detroit Red Wings', city: 'Detroit', nickname: 'Red Wings', abbreviation: 'DET', conference: 'Eastern', division: 'Atlantic', foundedYear: 1926, officialUrl: 'https://www.nhl.com/redwings', rankingsId: 'redwings' }),
  team({ leagueKey: 'nhl', teamKey: 'edmonton-oilers', displayName: 'Edmonton Oilers', city: 'Edmonton', nickname: 'Oilers', abbreviation: 'EDM', conference: 'Western', division: 'Pacific', foundedYear: 1972, officialUrl: 'https://www.nhl.com/oilers', rankingsId: 'oilers' }),
  team({ leagueKey: 'nhl', teamKey: 'florida-panthers', displayName: 'Florida Panthers', city: 'Florida', nickname: 'Panthers', abbreviation: 'FLA', conference: 'Eastern', division: 'Atlantic', foundedYear: 1993, officialUrl: 'https://www.nhl.com/panthers', rankingsId: 'panthers' }),
  team({ leagueKey: 'nhl', teamKey: 'los-angeles-kings', displayName: 'Los Angeles Kings', city: 'Los Angeles', nickname: 'Kings', abbreviation: 'LAK', conference: 'Western', division: 'Pacific', foundedYear: 1967, officialUrl: 'https://www.nhl.com/kings', rankingsId: 'kings' }),
  team({ leagueKey: 'nhl', teamKey: 'minnesota-wild', displayName: 'Minnesota Wild', city: 'Minnesota', nickname: 'Wild', abbreviation: 'MIN', conference: 'Western', division: 'Central', foundedYear: 2000, officialUrl: 'https://www.nhl.com/wild', rankingsId: 'wild' }),
  team({ leagueKey: 'nhl', teamKey: 'montreal-canadiens', displayName: 'Montréal Canadiens', city: 'Montréal', nickname: 'Canadiens', abbreviation: 'MTL', conference: 'Eastern', division: 'Atlantic', foundedYear: 1909, officialUrl: 'https://www.nhl.com/canadiens', rankingsId: null }),
  team({ leagueKey: 'nhl', teamKey: 'nashville-predators', displayName: 'Nashville Predators', city: 'Nashville', nickname: 'Predators', abbreviation: 'NSH', conference: 'Western', division: 'Central', foundedYear: 1998, officialUrl: 'https://www.nhl.com/predators', rankingsId: 'predators' }),
  team({ leagueKey: 'nhl', teamKey: 'new-jersey-devils', displayName: 'New Jersey Devils', city: 'New Jersey', nickname: 'Devils', abbreviation: 'NJD', conference: 'Eastern', division: 'Metropolitan', foundedYear: 1974, officialUrl: 'https://www.nhl.com/devils', rankingsId: 'devils' }),
  team({ leagueKey: 'nhl', teamKey: 'new-york-islanders', displayName: 'New York Islanders', city: 'New York', nickname: 'Islanders', abbreviation: 'NYI', conference: 'Eastern', division: 'Metropolitan', foundedYear: 1972, officialUrl: 'https://www.nhl.com/islanders', rankingsId: 'islanders' }),
  team({ leagueKey: 'nhl', teamKey: 'new-york-rangers', displayName: 'New York Rangers', city: 'New York', nickname: 'Rangers', abbreviation: 'NYR', conference: 'Eastern', division: 'Metropolitan', foundedYear: 1926, officialUrl: 'https://www.nhl.com/rangers', rankingsId: 'rangers' }),
  team({ leagueKey: 'nhl', teamKey: 'ottawa-senators', displayName: 'Ottawa Senators', city: 'Ottawa', nickname: 'Senators', abbreviation: 'OTT', conference: 'Eastern', division: 'Atlantic', foundedYear: 1992, officialUrl: 'https://www.nhl.com/senators', rankingsId: null }),
  team({ leagueKey: 'nhl', teamKey: 'philadelphia-flyers', displayName: 'Philadelphia Flyers', city: 'Philadelphia', nickname: 'Flyers', abbreviation: 'PHI', conference: 'Eastern', division: 'Metropolitan', foundedYear: 1967, officialUrl: 'https://www.nhl.com/flyers', rankingsId: 'flyers' }),
  team({ leagueKey: 'nhl', teamKey: 'pittsburgh-penguins', displayName: 'Pittsburgh Penguins', city: 'Pittsburgh', nickname: 'Penguins', abbreviation: 'PIT', conference: 'Eastern', division: 'Metropolitan', foundedYear: 1967, officialUrl: 'https://www.nhl.com/penguins', rankingsId: 'penguins' }),
  team({ leagueKey: 'nhl', teamKey: 'san-jose-sharks', displayName: 'San Jose Sharks', city: 'San Jose', nickname: 'Sharks', abbreviation: 'SJS', conference: 'Western', division: 'Pacific', foundedYear: 1991, officialUrl: 'https://www.nhl.com/sharks', rankingsId: null }),
  team({ leagueKey: 'nhl', teamKey: 'seattle-kraken', displayName: 'Seattle Kraken', city: 'Seattle', nickname: 'Kraken', abbreviation: 'SEA', conference: 'Western', division: 'Pacific', foundedYear: 2021, officialUrl: 'https://www.nhl.com/kraken', rankingsId: 'kraken' }),
  team({ leagueKey: 'nhl', teamKey: 'st-louis-blues', displayName: 'St. Louis Blues', city: 'St. Louis', nickname: 'Blues', abbreviation: 'STL', conference: 'Western', division: 'Central', foundedYear: 1967, officialUrl: 'https://www.nhl.com/blues', rankingsId: null }),
  team({ leagueKey: 'nhl', teamKey: 'tampa-bay-lightning', displayName: 'Tampa Bay Lightning', city: 'Tampa Bay', nickname: 'Lightning', abbreviation: 'TBL', conference: 'Eastern', division: 'Atlantic', foundedYear: 1992, officialUrl: 'https://www.nhl.com/lightning', rankingsId: 'lightning' }),
  team({ leagueKey: 'nhl', teamKey: 'toronto-maple-leafs', displayName: 'Toronto Maple Leafs', city: 'Toronto', nickname: 'Maple Leafs', abbreviation: 'TOR', conference: 'Eastern', division: 'Atlantic', foundedYear: 1917, officialUrl: 'https://www.nhl.com/mapleleafs', rankingsId: 'leafs' }),
  team({ leagueKey: 'nhl', teamKey: 'utah-hockey-club', displayName: 'Utah Hockey Club', city: 'Utah', nickname: 'Hockey Club', abbreviation: 'UTA', conference: 'Western', division: 'Central', foundedYear: 2024, officialUrl: 'https://www.nhl.com/utah', rankingsId: null, dataNotes: '2024–25 expansion/relocation franchise in Utah; nickname may evolve. Re-verify branding each season against NHL.com.' }),
  team({ leagueKey: 'nhl', teamKey: 'vancouver-canucks', displayName: 'Vancouver Canucks', city: 'Vancouver', nickname: 'Canucks', abbreviation: 'VAN', conference: 'Western', division: 'Pacific', foundedYear: 1970, officialUrl: 'https://www.nhl.com/canucks', rankingsId: 'canucks' }),
  team({ leagueKey: 'nhl', teamKey: 'vegas-golden-knights', displayName: 'Vegas Golden Knights', city: 'Vegas', nickname: 'Golden Knights', abbreviation: 'VGK', conference: 'Western', division: 'Pacific', foundedYear: 2017, officialUrl: 'https://www.nhl.com/goldenknights', rankingsId: null }),
  team({ leagueKey: 'nhl', teamKey: 'washington-capitals', displayName: 'Washington Capitals', city: 'Washington', nickname: 'Capitals', abbreviation: 'WSH', conference: 'Eastern', division: 'Metropolitan', foundedYear: 1974, officialUrl: 'https://www.nhl.com/capitals', rankingsId: 'capitals' }),
  team({ leagueKey: 'nhl', teamKey: 'winnipeg-jets', displayName: 'Winnipeg Jets', city: 'Winnipeg', nickname: 'Jets', abbreviation: 'WPG', conference: 'Western', division: 'Central', foundedYear: 2011, officialUrl: 'https://www.nhl.com/jets', rankingsId: 'jets' }),

  // ---------- NBA (30) ----------
  team({ leagueKey: 'nba', teamKey: 'atlanta-hawks', displayName: 'Atlanta Hawks', city: 'Atlanta', nickname: 'Hawks', abbreviation: 'ATL', conference: 'Eastern', division: 'Southeast', foundedYear: 1946, officialUrl: 'https://www.nba.com/hawks', rankingsId: 'hawks' }),
  team({ leagueKey: 'nba', teamKey: 'boston-celtics', displayName: 'Boston Celtics', city: 'Boston', nickname: 'Celtics', abbreviation: 'BOS', conference: 'Eastern', division: 'Atlantic', foundedYear: 1946, officialUrl: 'https://www.nba.com/celtics', rankingsId: 'celtics' }),
  team({ leagueKey: 'nba', teamKey: 'brooklyn-nets', displayName: 'Brooklyn Nets', city: 'Brooklyn', nickname: 'Nets', abbreviation: 'BKN', conference: 'Eastern', division: 'Atlantic', foundedYear: 1967, officialUrl: 'https://www.nba.com/nets', rankingsId: null }),
  team({ leagueKey: 'nba', teamKey: 'charlotte-hornets', displayName: 'Charlotte Hornets', city: 'Charlotte', nickname: 'Hornets', abbreviation: 'CHA', conference: 'Eastern', division: 'Southeast', foundedYear: 1988, officialUrl: 'https://www.nba.com/hornets', rankingsId: 'hornets' }),
  team({ leagueKey: 'nba', teamKey: 'chicago-bulls', displayName: 'Chicago Bulls', city: 'Chicago', nickname: 'Bulls', abbreviation: 'CHI', conference: 'Eastern', division: 'Central', foundedYear: 1966, officialUrl: 'https://www.nba.com/bulls', rankingsId: 'bulls' }),
  team({ leagueKey: 'nba', teamKey: 'cleveland-cavaliers', displayName: 'Cleveland Cavaliers', city: 'Cleveland', nickname: 'Cavaliers', abbreviation: 'CLE', conference: 'Eastern', division: 'Central', foundedYear: 1970, officialUrl: 'https://www.nba.com/cavaliers', rankingsId: 'cavs' }),
  team({ leagueKey: 'nba', teamKey: 'dallas-mavericks', displayName: 'Dallas Mavericks', city: 'Dallas', nickname: 'Mavericks', abbreviation: 'DAL', conference: 'Western', division: 'Southwest', foundedYear: 1980, officialUrl: 'https://www.nba.com/mavericks', rankingsId: 'mavericks' }),
  team({ leagueKey: 'nba', teamKey: 'denver-nuggets', displayName: 'Denver Nuggets', city: 'Denver', nickname: 'Nuggets', abbreviation: 'DEN', conference: 'Western', division: 'Northwest', foundedYear: 1967, officialUrl: 'https://www.nba.com/nuggets', rankingsId: 'nuggets' }),
  team({ leagueKey: 'nba', teamKey: 'detroit-pistons', displayName: 'Detroit Pistons', city: 'Detroit', nickname: 'Pistons', abbreviation: 'DET', conference: 'Eastern', division: 'Central', foundedYear: 1941, officialUrl: 'https://www.nba.com/pistons', rankingsId: 'pistons' }),
  team({ leagueKey: 'nba', teamKey: 'golden-state-warriors', displayName: 'Golden State Warriors', city: 'Golden State', nickname: 'Warriors', abbreviation: 'GSW', conference: 'Western', division: 'Pacific', foundedYear: 1946, officialUrl: 'https://www.nba.com/warriors', rankingsId: 'warriors' }),
  team({ leagueKey: 'nba', teamKey: 'houston-rockets', displayName: 'Houston Rockets', city: 'Houston', nickname: 'Rockets', abbreviation: 'HOU', conference: 'Western', division: 'Southwest', foundedYear: 1967, officialUrl: 'https://www.nba.com/rockets', rankingsId: 'rockets' }),
  team({ leagueKey: 'nba', teamKey: 'indiana-pacers', displayName: 'Indiana Pacers', city: 'Indiana', nickname: 'Pacers', abbreviation: 'IND', conference: 'Eastern', division: 'Central', foundedYear: 1967, officialUrl: 'https://www.nba.com/pacers', rankingsId: null }),
  team({ leagueKey: 'nba', teamKey: 'la-clippers', displayName: 'LA Clippers', city: 'Los Angeles', nickname: 'Clippers', abbreviation: 'LAC', conference: 'Western', division: 'Pacific', foundedYear: 1970, officialUrl: 'https://www.nba.com/clippers', rankingsId: null }),
  team({ leagueKey: 'nba', teamKey: 'los-angeles-lakers', displayName: 'Los Angeles Lakers', city: 'Los Angeles', nickname: 'Lakers', abbreviation: 'LAL', conference: 'Western', division: 'Pacific', foundedYear: 1947, officialUrl: 'https://www.nba.com/lakers', rankingsId: 'lakers' }),
  team({ leagueKey: 'nba', teamKey: 'memphis-grizzlies', displayName: 'Memphis Grizzlies', city: 'Memphis', nickname: 'Grizzlies', abbreviation: 'MEM', conference: 'Western', division: 'Southwest', foundedYear: 1995, officialUrl: 'https://www.nba.com/grizzlies', rankingsId: 'grizzlies' }),
  team({ leagueKey: 'nba', teamKey: 'miami-heat', displayName: 'Miami Heat', city: 'Miami', nickname: 'Heat', abbreviation: 'MIA', conference: 'Eastern', division: 'Southeast', foundedYear: 1988, officialUrl: 'https://www.nba.com/heat', rankingsId: 'heat' }),
  team({ leagueKey: 'nba', teamKey: 'milwaukee-bucks', displayName: 'Milwaukee Bucks', city: 'Milwaukee', nickname: 'Bucks', abbreviation: 'MIL', conference: 'Eastern', division: 'Central', foundedYear: 1968, officialUrl: 'https://www.nba.com/bucks', rankingsId: 'bucks' }),
  team({ leagueKey: 'nba', teamKey: 'minnesota-timberwolves', displayName: 'Minnesota Timberwolves', city: 'Minnesota', nickname: 'Timberwolves', abbreviation: 'MIN', conference: 'Western', division: 'Northwest', foundedYear: 1989, officialUrl: 'https://www.nba.com/timberwolves', rankingsId: 'wolves' }),
  team({ leagueKey: 'nba', teamKey: 'new-orleans-pelicans', displayName: 'New Orleans Pelicans', city: 'New Orleans', nickname: 'Pelicans', abbreviation: 'NOP', conference: 'Western', division: 'Southwest', foundedYear: 2002, officialUrl: 'https://www.nba.com/pelicans', rankingsId: 'pelicans' }),
  team({ leagueKey: 'nba', teamKey: 'new-york-knicks', displayName: 'New York Knicks', city: 'New York', nickname: 'Knicks', abbreviation: 'NYK', conference: 'Eastern', division: 'Atlantic', foundedYear: 1946, officialUrl: 'https://www.nba.com/knicks', rankingsId: 'knicks' }),
  team({ leagueKey: 'nba', teamKey: 'oklahoma-city-thunder', displayName: 'Oklahoma City Thunder', city: 'Oklahoma City', nickname: 'Thunder', abbreviation: 'OKC', conference: 'Western', division: 'Northwest', foundedYear: 1967, officialUrl: 'https://www.nba.com/thunder', rankingsId: 'thunder' }),
  team({ leagueKey: 'nba', teamKey: 'orlando-magic', displayName: 'Orlando Magic', city: 'Orlando', nickname: 'Magic', abbreviation: 'ORL', conference: 'Eastern', division: 'Southeast', foundedYear: 1989, officialUrl: 'https://www.nba.com/magic', rankingsId: 'magic' }),
  team({ leagueKey: 'nba', teamKey: 'philadelphia-76ers', displayName: 'Philadelphia 76ers', city: 'Philadelphia', nickname: '76ers', abbreviation: 'PHI', conference: 'Eastern', division: 'Atlantic', foundedYear: 1946, officialUrl: 'https://www.nba.com/sixers', rankingsId: 'sixers' }),
  team({ leagueKey: 'nba', teamKey: 'phoenix-suns', displayName: 'Phoenix Suns', city: 'Phoenix', nickname: 'Suns', abbreviation: 'PHX', conference: 'Western', division: 'Pacific', foundedYear: 1968, officialUrl: 'https://www.nba.com/suns', rankingsId: null }),
  team({ leagueKey: 'nba', teamKey: 'portland-trail-blazers', displayName: 'Portland Trail Blazers', city: 'Portland', nickname: 'Trail Blazers', abbreviation: 'POR', conference: 'Western', division: 'Northwest', foundedYear: 1970, officialUrl: 'https://www.nba.com/blazers', rankingsId: 'blazers' }),
  team({ leagueKey: 'nba', teamKey: 'sacramento-kings', displayName: 'Sacramento Kings', city: 'Sacramento', nickname: 'Kings', abbreviation: 'SAC', conference: 'Western', division: 'Pacific', foundedYear: 1945, officialUrl: 'https://www.nba.com/kings', rankingsId: 'kings' }),
  team({ leagueKey: 'nba', teamKey: 'san-antonio-spurs', displayName: 'San Antonio Spurs', city: 'San Antonio', nickname: 'Spurs', abbreviation: 'SAS', conference: 'Western', division: 'Southwest', foundedYear: 1967, officialUrl: 'https://www.nba.com/spurs', rankingsId: 'spurs' }),
  team({ leagueKey: 'nba', teamKey: 'toronto-raptors', displayName: 'Toronto Raptors', city: 'Toronto', nickname: 'Raptors', abbreviation: 'TOR', conference: 'Eastern', division: 'Atlantic', foundedYear: 1995, officialUrl: 'https://www.nba.com/raptors', rankingsId: 'raptors' }),
  team({ leagueKey: 'nba', teamKey: 'utah-jazz', displayName: 'Utah Jazz', city: 'Utah', nickname: 'Jazz', abbreviation: 'UTA', conference: 'Western', division: 'Northwest', foundedYear: 1974, officialUrl: 'https://www.nba.com/jazz', rankingsId: 'jazz' }),
  team({ leagueKey: 'nba', teamKey: 'washington-wizards', displayName: 'Washington Wizards', city: 'Washington', nickname: 'Wizards', abbreviation: 'WAS', conference: 'Eastern', division: 'Southeast', foundedYear: 1961, officialUrl: 'https://www.nba.com/wizards', rankingsId: null }),
]);

export function assertTeamSeedInvariants(): void {
  const byLeague = new Map<string, number>();
  const keys = new Set<string>();
  for (const team of TEAM_SEEDS) {
    const composite = `${team.leagueKey}:${team.teamKey}`;
    if (keys.has(composite)) {
      throw new Error(`Duplicate team seed ${composite}`);
    }
    keys.add(composite);
    byLeague.set(team.leagueKey, (byLeague.get(team.leagueKey) ?? 0) + 1);
  }
  const expected: Record<string, number> = { nfl: 32, mlb: 30, nhl: 32, nba: 30 };
  for (const [league, count] of Object.entries(expected)) {
    if (byLeague.get(league) !== count) {
      throw new Error(`Expected ${count} ${league} teams, found ${byLeague.get(league) ?? 0}`);
    }
  }
}
