/**
 * BB Sports — Franchise Rankings.
 *
 * Top 25 across the four major North American leagues, ranked by Brad's
 * opinion. The base order lives in this file. When Brad publishes an
 * article that "trashes" a team (frontmatter `trashedTeams: [...]`), the
 * rankings system automatically drops that team and surfaces the article
 * as the reason. Most-recent article wins; older demotions still appear
 * in the history log so movement is visible.
 *
 * Data shape is intentionally minimal so Brad can edit the base order in
 * one place and the demotion engine writes the rest.
 */
import type { Article } from './articles';

export type RankingLeague = 'nfl' | 'mlb' | 'nhl' | 'nba';

export const LEAGUE_LABELS: Record<RankingLeague, string> = {
  nfl: 'NFL',
  mlb: 'MLB',
  nhl: 'NHL',
  nba: 'NBA',
};

export type FranchiseBase = {
  /** Stable id used by article frontmatter (`trashedTeams[].team`). */
  id: string;
  /** Display name. */
  name: string;
  /** City / market for sort/display. */
  city: string;
  /** Brad's one-line take, baseline. */
  brad: string;
};

export type Demotion = {
  reason: string;
  /** Article slug that triggered the demotion. */
  articleSlug: string;
  articleTitle: string;
  date: string;
  /** How many slots to drop (default 3). Capped so a team can't fall below 25. */
  drop: number;
};

export type RankedFranchise = FranchiseBase & {
  league: RankingLeague;
  baseRank: number;
  currentRank: number;
  demotions: Demotion[];
};

export type LeagueRanking = {
  league: RankingLeague;
  label: string;
  ranked: RankedFranchise[];
  movements: Array<RankedFranchise & { moved: number }>;
};

/**
 * Brad's baseline top-25 per league. Order = current rank #1..25.
 * "city" + "name" together give the standard market+nickname format.
 * The `brad` field is the one-line house take that lives on the rankings
 * page next to the team.
 */
const NFL_BASELINE: FranchiseBase[] = [
  { id: 'bears',       city: 'Chicago',       name: 'Bears',       brad: "Best chance the franchise has had in decades. Yes I'm a homer. Yes the case stands up." },
  { id: 'chiefs',      city: 'Kansas City',   name: 'Chiefs',      brad: 'Until somebody actually beats them in a January game where it counts, they sit here.' },
  { id: 'eagles',      city: 'Philadelphia',  name: 'Eagles',      brad: 'O-line, D-line, real quarterback. The formula nobody else has all three of.' },
  { id: 'lions',       city: 'Detroit',       name: 'Lions',       brad: 'Most fun roster in the league. Defensive injuries are the only thing keeping them out of the top 2.' },
  { id: 'ravens',      city: 'Baltimore',     name: 'Ravens',      brad: 'Best regular-season team for half a decade. The January thing has to end eventually.' },
  { id: 'bills',       city: 'Buffalo',       name: 'Bills',       brad: 'Allen is a top-3 QB. The roster around him keeps not being top-3.' },
  { id: '49ers',       city: 'San Francisco', name: '49ers',       brad: 'Shanahan offense is still the cleanest scheme in the league. Health is the only question.' },
  { id: 'packers',     city: 'Green Bay',     name: 'Packers',     brad: "Love is the real deal. Defense decides how high they actually finish." },
  { id: 'bengals',     city: 'Cincinnati',    name: 'Bengals',     brad: 'When healthy, top 5. The injury luck is the variable.' },
  { id: 'cowboys',     city: 'Dallas',        name: 'Cowboys',     brad: 'The "America\'s Team" tax means everybody else has them too high. I have them about right.' },
  { id: 'dolphins',    city: 'Miami',         name: 'Dolphins',    brad: "Fastest offense in football when the weather is on their side. November and onward is the problem." },
  { id: 'texans',      city: 'Houston',       name: 'Texans',      brad: 'Stroud is the most fun young QB in the league. Watch them climb fast.' },
  { id: 'rams',        city: 'Los Angeles',   name: 'Rams',        brad: 'Stafford-McVay-Kupp axis still works. The age column is doing a lot of work though.' },
  { id: 'steelers',    city: 'Pittsburgh',    name: 'Steelers',    brad: 'Tomlin will never have a losing season and will never sneak into the AFC title game without a QB upgrade.' },
  { id: 'broncos',     city: 'Denver',        name: 'Broncos',     brad: 'Payton plus a real defense is finally a thing again. QB tier still capped.' },
  { id: 'commanders',  city: 'Washington',    name: 'Commanders',  brad: "Daniels makes them must-watch. Roster catches up year 3." },
  { id: 'chargers',    city: 'Los Angeles',   name: 'Chargers',    brad: 'Harbaugh makes everyone two wins better. Herbert deserves it.' },
  { id: 'falcons',     city: 'Atlanta',       name: 'Falcons',     brad: "Penix decision is going to define this front office for a decade." },
  { id: 'vikings',     city: 'Minnesota',     name: 'Vikings',     brad: 'Best WR room in football. QB room is the question.' },
  { id: 'seahawks',    city: 'Seattle',       name: 'Seahawks',    brad: 'Macdonald defense + a real RB1 = January team. Just not top-10 yet.' },
  { id: 'jaguars',     city: 'Jacksonville',  name: 'Jaguars',     brad: 'Wasted Trevor years are starting to add up. Front office should be sweating.' },
  { id: 'colts',       city: 'Indianapolis',  name: 'Colts',       brad: 'Steichen is a real coach. They need to commit to a QB and stop guessing.' },
  { id: 'jets',        city: 'New York',      name: 'Jets',        brad: "Pick your reason — coaching, ownership, QB carousel. They're the easiest top-25 punchline in the league." },
  { id: 'cardinals',   city: 'Arizona',       name: 'Cardinals',   brad: 'Murray-Harrison combo is fun. Coaching staff is on a fast clock.' },
  { id: 'panthers-nfl',city: 'Carolina',      name: 'Panthers',    brad: "Hardest to watch team in the league two years running. Bryce Young year is officially the make-or-break." },
];

const MLB_BASELINE: FranchiseBase[] = [
  { id: 'dodgers',     city: 'Los Angeles',   name: 'Dodgers',     brad: "Payroll plus development. They built the modern dynasty and I'm tired of pretending otherwise." },
  { id: 'braves',      city: 'Atlanta',       name: 'Braves',      brad: 'Best front office in the sport. Locking up the core before arbitration was a generational move.' },
  { id: 'phillies',    city: 'Philadelphia',  name: 'Phillies',    brad: 'Most fun lineup in the National League. Bullpen is the only thing standing between them and the Dodgers.' },
  { id: 'yankees',     city: 'New York',      name: 'Yankees',     brad: 'Judge plus Soto plus a payroll. Yet somehow the roster construction always leaves a hole exactly where October hits hardest.' },
  { id: 'orioles',     city: 'Baltimore',     name: 'Orioles',     brad: 'Cheapest, deepest, most exciting young core in baseball. Ownership has to actually spend now.' },
  { id: 'astros',      city: 'Houston',       name: 'Astros',      brad: "Window is open until Altuve's body says it isn't. Pitching depth is the test." },
  { id: 'guardians',   city: 'Cleveland',     name: 'Guardians',   brad: 'Best development pipeline outside of Atlanta. Ownership ceiling is the asterisk.' },
  { id: 'cubs',        city: 'Chicago',       name: 'Cubs',        brad: 'Yes, full disclosure, fan. PCA changes the franchise outlook. They need one bat and one arm.' },
  { id: 'brewers',     city: 'Milwaukee',     name: 'Brewers',     brad: 'Win 92 every year, lose in the wild card every year. The pattern has to break eventually.' },
  { id: 'mariners',    city: 'Seattle',       name: 'Mariners',    brad: "Best rotation in the AL. Hitting still feels like it's stuck in 2012." },
  { id: 'mets',        city: 'New York',      name: 'Mets',        brad: 'Cohen money plus a real baseball ops department is finally producing real baseball results.' },
  { id: 'padres',      city: 'San Diego',     name: 'Padres',      brad: "Roster always looks like an All-Star team and finishes like a wild-card team. That's a coaching problem." },
  { id: 'rangers',     city: 'Texas',         name: 'Rangers',     brad: 'Title run validated the spend. The follow-up year is the actual test.' },
  { id: 'redsox',      city: 'Boston',        name: 'Red Sox',     brad: 'Trading Mookie still hangs over this franchise. The farm is real now though.' },
  { id: 'cardinals-mlb',city: 'St. Louis',    name: 'Cardinals',   brad: 'Most overrated brand in baseball for a decade. The dev system finally has to carry the load.' },
  { id: 'twins',       city: 'Minnesota',     name: 'Twins',       brad: "Always one move short. Ownership has to stop pretending Minneapolis can't support a contender." },
  { id: 'giants',      city: 'San Francisco', name: 'Giants',      brad: "Lost every big free agent target for three straight winters. There's a culture problem there." },
  { id: 'diamondbacks',city: 'Arizona',       name: 'Diamondbacks',brad: '2023 run was real. Rotation depth catches up before the lineup does.' },
  { id: 'rays',        city: 'Tampa Bay',     name: 'Rays',        brad: 'Best per-dollar team in baseball every year. Ownership ceiling is permanent.' },
  { id: 'tigers',      city: 'Detroit',       name: 'Tigers',      brad: "Skubal plus the kids equals back-on-the-map. Front office can't get cute on free agents now." },
  { id: 'royals',      city: 'Kansas City',   name: 'Royals',      brad: 'Witt Jr. is a top-5 player and nobody outside KC talks about it. The rest of the roster has to catch up.' },
  { id: 'reds',        city: 'Cincinnati',    name: 'Reds',        brad: "De La Cruz is must-watch TV. Pitching has to stop being a black hole." },
  { id: 'angels',      city: 'Los Angeles',   name: 'Angels',      brad: 'Wasted the prime of two generational players. The ownership group should be in time-out.' },
  { id: 'pirates',     city: 'Pittsburgh',    name: 'Pirates',     brad: "Skenes is the most exciting thing in the sport. Nutting's ownership is the most depressing." },
  { id: 'marlins',     city: 'Miami',         name: 'Marlins',     brad: 'Permanent fire-sale franchise. Ownership has to either spend or sell.' },
];

const NHL_BASELINE: FranchiseBase[] = [
  { id: 'panthers',    city: 'Florida',       name: 'Panthers',    brad: 'Repeat Cup champions. Until somebody knocks them off, they sit at the top. (Yes I am a fan.)' },
  { id: 'oilers',      city: 'Edmonton',      name: 'Oilers',      brad: 'McDavid + Draisaitl is the most lethal duo in the sport. Goaltending is finally not a five-alarm fire.' },
  { id: 'avalanche',   city: 'Colorado',      name: 'Avalanche',   brad: 'MacKinnon-Makar core. Defensive structure is the swing variable in any series.' },
  { id: 'stars',       city: 'Dallas',        name: 'Stars',       brad: 'Most complete roster top to bottom outside the top 2. Window stays open another two years.' },
  { id: 'rangers',     city: 'New York',      name: 'Rangers',     brad: "Goaltending and skill. Coaching has been the question every single playoff series." },
  { id: 'leafs',       city: 'Toronto',       name: 'Maple Leafs', brad: 'Reginning year 11. Either it works this spring or the core gets blown up. Pick a lane.' },
  { id: 'lightning',   city: 'Tampa Bay',     name: 'Lightning',   brad: 'Cup window cracked but Kucherov still single-handedly drags them deep.' },
  { id: 'hurricanes',  city: 'Carolina',      name: 'Hurricanes',  brad: "Best regular-season process in the league. Playoff goalie carousel is the asterisk." },
  { id: 'jets',        city: 'Winnipeg',      name: 'Jets',        brad: 'Hellebuyck plus Scheifele plus an underrated bottom-6. President\'s Trophy was earned.' },
  { id: 'kings',       city: 'Los Angeles',   name: 'Kings',       brad: "Old-team-tries-one-more-time energy. Fun while it lasts." },
  { id: 'capitals',    city: 'Washington',    name: 'Capitals',    brad: "Ovi chases the record and the rest of the roster gets to ride along. Earned." },
  { id: 'predators',   city: 'Nashville',     name: 'Predators',   brad: 'Most aggressive offseason in the cap era. Buyer beware.' },
  { id: 'wild',        city: 'Minnesota',     name: 'Wild',        brad: 'Cap hell finally over. Kaprizov gets a real supporting cast.' },
  { id: 'devils',      city: 'New Jersey',    name: 'Devils',      brad: 'Hughes brothers plus depth. Goalie has to find a level.' },
  { id: 'islanders',   city: 'New York',      name: 'Islanders',   brad: 'Defensive structure remains airtight. Top-6 forwards need a real upgrade.' },
  { id: 'bruins',      city: 'Boston',        name: 'Bruins',      brad: "Reset year. Identity is locked in even when the talent isn't top-10." },
  { id: 'penguins',    city: 'Pittsburgh',    name: 'Penguins',    brad: "Crosby will retire still playing top-line minutes. The roster around him stopped helping." },
  { id: 'flyers',      city: 'Philadelphia',  name: 'Flyers',      brad: 'Tortorella is dragging mediocrity into respectability. Trade deadline tells the truth.' },
  { id: 'redwings',    city: 'Detroit',       name: 'Red Wings',   brad: 'Yzerplan was supposed to be done by now. Year-by-year vibe is wearing thin.' },
  { id: 'jackets',     city: 'Columbus',      name: 'Blue Jackets',brad: 'Gaudreau tragedy reshaped the franchise. The kids have to grow up fast.' },
  { id: 'flames',      city: 'Calgary',       name: 'Flames',      brad: 'Stuck in the middle. The full rebuild is overdue.' },
  { id: 'sabres',      city: 'Buffalo',       name: 'Sabres',      brad: '13-year playoff drought. Either Adams produces a contender or somebody else gets the GM job.' },
  { id: 'canucks',     city: 'Vancouver',     name: 'Canucks',     brad: 'Pettersson contract is the next swing factor for the whole franchise.' },
  { id: 'ducks',       city: 'Anaheim',       name: 'Ducks',       brad: 'Most exciting young core nobody is talking about. Patience pays.' },
  { id: 'kraken',      city: 'Seattle',       name: 'Kraken',      brad: 'Expansion magic faded. The next move has to be a real one.' },
];

const NBA_BASELINE: FranchiseBase[] = [
  { id: 'celtics',     city: 'Boston',        name: 'Celtics',     brad: 'Best roster construction in the league. Hard to imagine them not being in this slot for another two years.' },
  { id: 'thunder',     city: 'Oklahoma City', name: 'Thunder',     brad: 'Youngest contender in modern memory. The draft capital alone keeps them top 3 for half a decade.' },
  { id: 'nuggets',     city: 'Denver',        name: 'Nuggets',     brad: 'Jokic-Murray two-man game is the safest thing on a halfcourt in the entire sport.' },
  { id: 'wolves',      city: 'Minnesota',     name: 'Timberwolves',brad: 'Defense is real. Offense gets stuck when Edwards is double-teamed and the ball stops.' },
  { id: 'mavericks',   city: 'Dallas',        name: 'Mavericks',   brad: 'Luka plus Kyrie is the most lethal halfcourt offense in the West. Defense decides the ceiling.' },
  { id: 'knicks',      city: 'New York',      name: 'Knicks',      brad: 'Thibs builds top-3 defenses every time. Brunson is one of the best closers in the league.' },
  { id: 'sixers',      city: 'Philadelphia',  name: '76ers',       brad: 'Embiid health is the entire franchise. There is no other story.' },
  { id: 'cavs',        city: 'Cleveland',     name: 'Cavaliers',   brad: 'Best young core in the East. Donovan extension was the right move.' },
  { id: 'bucks',       city: 'Milwaukee',     name: 'Bucks',       brad: "Giannis still gives them a top-5 ceiling. Roster around him is the cap-hell case study." },
  { id: 'magic',       city: 'Orlando',       name: 'Magic',       brad: 'Best young perimeter defense in the league. Banchero plus Wagner is the real thing.' },
  { id: 'rockets',     city: 'Houston',       name: 'Rockets',     brad: "Udoka turned a lottery roster into a defense-first team in one summer. Coaching matters." },
  { id: 'kings',       city: 'Sacramento',    name: 'Kings',       brad: 'Sabonis-Fox is the most underrated duo in the league. Defense holds them out of the top 8.' },
  { id: 'pelicans',    city: 'New Orleans',   name: 'Pelicans',    brad: "Zion availability is the entire franchise's investment thesis." },
  { id: 'lakers',      city: 'Los Angeles',   name: 'Lakers',      brad: "LeBron's farewell tour buys them attention. The actual roster is a play-in team without him." },
  { id: 'heat',        city: 'Miami',         name: 'Heat',        brad: "Spo magic only goes so far when the roster ages out and the front office won't spend." },
  { id: 'warriors',    city: 'Golden State',  name: 'Warriors',    brad: 'Curry is still the most dangerous shooter alive. Everything else is asterisk material.' },
  { id: 'pistons',     city: 'Detroit',       name: 'Pistons',     brad: 'Cunningham extension worth it. The supporting cast has to actually contribute.' },
  { id: 'spurs',       city: 'San Antonio',   name: 'Spurs',       brad: 'Wembanyama plus Pop is must-watch. Front office has to give him a guard.' },
  { id: 'hawks',       city: 'Atlanta',       name: 'Hawks',       brad: 'Trae plus Risacher is fine. The defensive identity is the real problem.' },
  { id: 'bulls',       city: 'Chicago',       name: 'Bulls',       brad: 'Yes I\'m a fan and yes I have to put them here. Half-rebuilds with no plan get you 20th.' },
  { id: 'raptors',     city: 'Toronto',       name: 'Raptors',     brad: 'Barnes extension is the bet. Everything else is a question mark.' },
  { id: 'grizzlies',   city: 'Memphis',       name: 'Grizzlies',   brad: 'Healthy Ja and Jaren is a top-6 team. Injuries decided last year.' },
  { id: 'blazers',     city: 'Portland',      name: 'Trail Blazers',brad: 'Lottery year. The kids are intriguing — kids alone do not win games.' },
  { id: 'jazz',        city: 'Utah',          name: 'Jazz',        brad: 'Tank done with intent. Markkanen is too good to be the centerpiece of a rebuild much longer.' },
  { id: 'hornets',     city: 'Charlotte',     name: 'Hornets',     brad: 'LaMelo is special. The supporting cast around him keeps being the wrong supporting cast.' },
];

const BASELINE: Record<RankingLeague, FranchiseBase[]> = {
  nfl: NFL_BASELINE,
  mlb: MLB_BASELINE,
  nhl: NHL_BASELINE,
  nba: NBA_BASELINE,
};

export type TrashedTeam = {
  league: RankingLeague;
  team: string;
  reason: string;
  drop?: number;
};

/**
 * Build the live ranking for one league. Pulls article frontmatter for any
 * article whose `trashedTeams` contains a matching league/team id, applies
 * the demotion (default 3 slots, capped at 25), and surfaces the article
 * link as the reason in the rendered list.
 */
export function buildLeagueRanking(league: RankingLeague, articles: Article[]): LeagueRanking {
  const base = BASELINE[league];
  const byId = new Map<string, RankedFranchise>(
    base.map((team, idx) => [
      team.id,
      {
        ...team,
        league,
        baseRank: idx + 1,
        currentRank: idx + 1,
        demotions: [],
      },
    ]),
  );

  // Walk articles oldest → newest so newest demotion ends up first in the
  // demotions[] list (we unshift below) and so cumulative drops compound
  // intuitively.
  const sorted = [...articles].sort((a, b) => +new Date(a.date) - +new Date(b.date));
  for (const article of sorted) {
    const trashed = readTrashedTeams(article);
    for (const entry of trashed) {
      if (entry.league !== league) continue;
      const target = byId.get(entry.team);
      if (!target) continue;
      target.demotions.unshift({
        reason: entry.reason,
        articleSlug: article.slug,
        articleTitle: article.title,
        date: article.date,
        drop: clampDrop(entry.drop ?? 3),
      });
    }
  }

  // Compute current rank: start from base order, then apply total drop per
  // team to produce a stable comparator. Ties broken by base rank.
  const ranked = Array.from(byId.values()).sort((a, b) => {
    const dropA = totalDrop(a);
    const dropB = totalDrop(b);
    return a.baseRank + dropA - (b.baseRank + dropB) || a.baseRank - b.baseRank;
  });
  ranked.forEach((team, idx) => {
    team.currentRank = idx + 1;
  });

  const movements = ranked
    .filter((t) => t.baseRank !== t.currentRank)
    .map((t) => ({ ...t, moved: t.currentRank - t.baseRank }))
    .sort((a, b) => b.moved - a.moved);

  return {
    league,
    label: LEAGUE_LABELS[league],
    ranked,
    movements,
  };
}

/** Drop is bounded so a single article can't kick a team out of the top-25 list entirely. */
function clampDrop(drop: number): number {
  if (!Number.isFinite(drop)) return 3;
  return Math.max(1, Math.min(10, Math.floor(drop)));
}

function totalDrop(t: RankedFranchise): number {
  return t.demotions.reduce((sum, d) => sum + d.drop, 0);
}

/**
 * Article frontmatter contract:
 *
 *   trashedTeams:
 *     - league: nba
 *       team: lakers
 *       reason: "The point of this column is the front office is asleep."
 *       drop: 4
 *
 * For db-backed articles, we look in the body for an opt-in HTML comment
 * block so editorial control stays in the markdown body itself:
 *
 *   <!-- bb:trash league=nba team=lakers drop=4 reason="..." -->
 */
export function readTrashedTeams(article: Article): TrashedTeam[] {
  const fromBody = parseTrashedFromBody(article.body);
  return fromBody;
}

function parseTrashedFromBody(body: string): TrashedTeam[] {
  if (!body) return [];
  const pattern = /<!--\s*bb:trash\s+([^>]+?)-->/g;
  const out: TrashedTeam[] = [];
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(body)) != null) {
    const attrs = parseAttrs(match[1]);
    const league = (attrs.league ?? '').toLowerCase();
    const team = (attrs.team ?? '').toLowerCase();
    if (!isLeague(league) || !team) continue;
    out.push({
      league,
      team,
      reason: attrs.reason ?? '',
      drop: attrs.drop ? Number(attrs.drop) : undefined,
    });
  }
  return out;
}

function parseAttrs(raw: string): Record<string, string> {
  const out: Record<string, string> = {};
  // key="value with spaces" OR key=value
  const re = /(\w+)\s*=\s*(?:"([^"]*)"|(\S+))/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(raw)) != null) {
    out[m[1].toLowerCase()] = (m[2] ?? m[3] ?? '').trim();
  }
  return out;
}

function isLeague(s: string): s is RankingLeague {
  return s === 'nfl' || s === 'mlb' || s === 'nhl' || s === 'nba';
}

export const LEAGUE_ORDER: RankingLeague[] = ['nfl', 'mlb', 'nhl', 'nba'];

export function buildAllRankings(articles: Article[]): LeagueRanking[] {
  return LEAGUE_ORDER.map((l) => buildLeagueRanking(l, articles));
}
