# BB Sports First-Party Search

Built: 2026-05-08

## Purpose

Readers need a named, direct way to find a take without guessing which sport rail or archive filter contains it. Search is now a first-party BB Sports surface, not an external engine.

## Surfaces

- Page: `/search`
- API: `/api/search?q=...`
- Header nav: `Search`
- Footer read links: `Search`
- Sitemap: `/search`

## Ranking

The first-pass ranker lives in `lib/search.ts`.

Weights:

- Title: highest.
- Dek: high.
- Tags and sport: medium.
- Excerpt: medium-low.
- Author: low.
- Recent articles get a small tiebreaker boost.

The system returns only published articles because `getAllArticles()` is the public article loader.

## Provider Posture

GREEN. No external search provider. The implementation uses the internal article source. Postgres full-text search can replace the in-process ranker once volume warrants it, without changing the public route.

## Path To 10.0

- Promote to Postgres FTS once the article count reaches real archive size.
- Add typo tolerance and synonyms for team nicknames.
- Add analytics on zero-result queries after first-party analytics lands.
