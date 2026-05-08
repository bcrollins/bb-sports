# Homepage Network Parity

Updated: 2026-05-08

## Goal

Make the BB Sports homepage behave like a real sports network front page while staying inside BB Sports branding, licensing, and editorial rules. The benchmark is ESPN-caliber information architecture: lead story, top headlines, league rails, watch/listen paths, direct search, tips, support, and a score-style board. The implementation must not copy ESPN visual property, marks, article packaging, or proprietary data.

## Shipped Surface

- `/` now opens on a content-first front page instead of a marketing-only hero.
- Lead article, top headlines, latest articles, and league desks all come from the internal article source.
- The score-style board is intentionally labeled as coverage lanes while live score data is unlicensed.
- `/support` is a named reader-support home, with `/support/terms` for donation/refund rules.
- Header and footer now expose Support and Tips directly. No hamburger, More, Other, or Misc bucket was introduced.

## Provider Boundary

Live scores are disabled until all of the following are true:

1. A commercial live-sports data provider is selected.
2. Written terms are stored in `docs/legal/`.
3. `BBSPORTS_APPROVED_LIVE_SCORES=true` is configured in the production environment.
4. Every rendered score includes source and freshness timing.

Until then, the homepage may show BB Sports editorial coverage lanes, not scores, standings, odds, betting recommendations, public-bet percentages, or scraped team data.

## Preservation Affidavit

Capabilities preserved:

- Latest article access.
- Article archive/search access.
- Newsletter signup.
- Contact/tips.
- X follow path.
- Podcast and video named homes.
- Public editorial standards and corrections links.
- Generated media rail behavior.
- Admin/CMS article source of truth.

Capabilities added:

- Scoreboard-style editorial board with provider disclosure.
- League desk rail for every priority sport.
- Reader support route backed by the first-party donation intent ledger.
- Public donation/refund terms route.

Capabilities deferred:

- Live scores and standings remain deferred behind commercial provider approval.
- Stripe checkout remains deferred until the Stripe tenant/payment link is verified.

## Path To 10.0

- Add commercial live-score provider with freshness and source display.
- Add comments from the internal comment store with moderation state.
- Add watch/listen embeds after Brad records approved clips and show audio.
- Add first-party analytics rollups for article retention and support conversion.
- Add sponsorship package pages after audience baseline exists.
