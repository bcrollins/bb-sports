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

## Testing

The directive engine is covered by `tests/rankings.test.ts` and tested
against the live `/content/articles` set in CI builds (every published
demotion must round-trip through `buildAllRankings()`). See:

- `tests/rankings.test.ts` — unit tests for the parser, clamp, compounding,
  unknown-team safety, no-drop-below-25 invariant.
- `tests/homepage.test.ts` — has one integration test that exercises the
  demotion against the MLB baseline.

## See also

- `lib/rankings.ts` — baseline data + engine.
- `app/(site)/rankings/page.tsx` — public page.
- `app/admin/rankings/page.tsx` — Brad-facing control room.
- `app/(site)/articles/[slug]/page.tsx` — article-page "this take moved
  the rankings" callout.
