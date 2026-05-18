# BB Sports — Rankings Demotion Directive

> When Brad publishes a column that trashes a team on `/rankings`, the team
> drops slots and the column shows up as the reason. The mechanism is a tiny
> HTML-comment directive embedded in the article body. This document is the
> contract.

## TL;DR

Drop one of these inside any article body. The team moves on the public
rankings page and the article page renders a "this take moved the rankings"
callout above the share row.

```
<!-- bb:trash league=mlb team=yankees drop=8 reason="The roster build is broken." -->
```

- `league` — required. One of `nfl`, `mlb`, `nhl`, `nba`.
- `team` — required. A baseline team id (see `lib/rankings.ts` or `/admin/rankings`).
- `drop` — optional, integer. Slots to drop. Default `3`. Clamped to `[1, 10]`.
- `reason` — optional, free text inside double quotes. Shown verbatim on
  `/rankings` and in the article-page callout.

Multiple directives in the same article are allowed.

## Why HTML comments

The directive lives inside the article *body* (not frontmatter) because:

1. The body is the source of truth in both the filesystem fallback and the
   Postgres-backed CMS. Frontmatter doesn't survive the DB round-trip the
   same way.
2. HTML comments render as nothing on the page, so a stray directive can't
   leak through.
3. The format is easy to grep, easy to remove, and survives Markdown → HTML
   conversion.

Parser lives in `parseTrashedFromBody()` in `lib/rankings.ts`.

## Behaviour rules

- **Baseline order is owned by `lib/rankings.ts`.** Edit there to seed a new
  team or change a starting position. Anything else is calculated.
- **Drop is additive across articles.** Two articles trashing the same team
  with `drop=4` each means an 8-slot drop. Newest article appears first in
  the "Why they moved" section.
- **Drop is clamped to `[1, 10]`.** A value below 1 becomes 1; above 10
  becomes 10; non-numeric becomes the default `3`.
- **Unknown teams are silently ignored.** Typos in `team=` don't crash —
  they just produce no movement. Verify in `/admin/rankings`.
- **No team falls out of the top-25.** The list always has exactly 25 entries
  in ranks 1..25. A team with a huge cumulative drop ends up near the bottom
  of the list but stays on it.
- **Tiebreaker:** when two teams have the same `baseRank + totalDrop` score,
  the team with the smaller `baseRank` ranks higher.

## Admin workflow

1. Brad writes the column.
2. While drafting, Brad pastes the directive(s) at the top of the body
   (the cheat-sheet is on `/admin/rankings`).
3. Brad checks `/admin/rankings` to confirm the directive parsed and the
   team moved where expected.
4. Brad approves and publishes.
5. The public `/rankings` page updates on the next ISR refresh
   (`revalidate = 60` on the page).

## Examples

Single team, default drop:

```
<!-- bb:trash league=nfl team=cowboys reason="Brand is doing the lifting." -->
```

Multiple teams in one column:

```
<!-- bb:trash league=nba team=lakers drop=6 reason="Tribute act." -->
<!-- bb:trash league=nba team=warriors drop=5 reason="Front office in denial." -->
```

Reason omitted (rankings page falls back to a generic "see linked column"
message — fine for short news hits):

```
<!-- bb:trash league=nhl team=leafs drop=4 -->
```

## Surfaces

The same demotion data renders across every reader-facing surface:

| Surface | What appears |
|---|---|
| `/rankings` | The team's row drops, the demotion log inlines under the team's brad take, the "Recent movement" rail at the top surfaces the column. |
| `/rankings/[league]` | Same row drop and inline log on the dedicated league page. |
| `/rankings/[league]/[team]` | Full demotion history on the team's deep-link page (every column, newest first), sibling teams above/below in context, related sport coverage. |
| `/articles/[slug]` | The column itself renders a red "This take moved the franchise rankings" callout above the share row with each demoted team. |
| `/articles` | Each card whose article body contains a directive shows a `▼ Moved [LEAGUE] ranking` pill. |
| Homepage | "Teams Brad just moved" rail, three newest demotions across all leagues. Articles in the Latest grid also carry the pill. |
| `/search` | A query that matches a team name surfaces the franchise card with its current rank and link to the team page. |
| `/admin/rankings` | Brad-facing control room: directive log (every published article touching the rankings, newest first), live league state with movement annotations, copy-pasteable cheat-sheet. |
| `/api/rankings` | Public JSON, 5-minute cache, every team row carries `baseRank`, `currentRank`, `moved`, and the full `demotions[]` array. |
| `/rss.xml` | The column appears in the feed like any other article. |

## Disclosure

Teams flagged with `bradTeam: true` in `lib/rankings.ts` carry a
`⚑ Brad's team` pill on `/rankings` and a `⚑ Bias disclosed · Brad's
team` badge on the team page. House rule #1 (bias disclosed, not
hidden) is visible exactly where it matters — at the moment a reader
encounters a team Brad openly roots for. The `/api/rankings` JSON
exposes the same flag as a boolean on every row.

Current flagged teams: Bears (NFL), Cubs (MLB), Panthers (NHL),
Bulls (NBA). Manchester United (PL) and Florida Gators (NCAA) are
disclosed in `/editorial-standards` and `/about` — those leagues
aren't in the ranked set.

## Testing

The directive engine is covered by `tests/rankings.test.ts` and the
full corpus is checked by `tests/public-feeds.test.ts`. Every
published demotion must round-trip through `buildAllRankings()`. See:

- `tests/rankings.test.ts` — parser, clamp, compounding, unknown-team
  safety, no-drop-below-25 invariant, `getRecentMovements`,
  `searchFranchises`, the `bradTeam` flag set.
- `tests/public-feeds.test.ts` — `/api/rankings` and `/rss.xml` route
  handlers, including the bradTeam serialization contract.
- `tests/homepage.test.ts` — one integration test against the MLB
  baseline.
- `tests/sitemap.test.ts` — team + league sitemap freshness logic.
- `tests/team-pages.test.ts` — 100 team paths invariant.
- `tests/league-pages.test.ts` — 4 league paths invariant + metadata.

## See also

- `lib/rankings.ts` — baseline data + engine (`buildLeagueRanking`,
  `buildAllRankings`, `getRecentMovements`, `getDemotionImpacts`,
  `searchFranchises`, `readTrashedTeams`).
- `app/(site)/rankings/page.tsx` — public overview page.
- `app/(site)/rankings/[league]/page.tsx` — per-league page.
- `app/(site)/rankings/[league]/[team]/page.tsx` — per-team page.
- `app/admin/rankings/page.tsx` — Brad-facing control room.
- `app/(site)/articles/[slug]/page.tsx` — article-page "this take
  moved the rankings" callout.
- `app/api/rankings/route.ts` — public JSON endpoint.
- `components/RankingsImpactPill.tsx` — shared "Moved X ranking" pill.
