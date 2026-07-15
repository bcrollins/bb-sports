# BB Sports — Database Population Audit & Data Domain Report

**Audit date:** 2026-07-15  
**Repository:** `/Users/brandonrollins/Code/bb-sports-production`  
**Production:** https://bbsports.fans  
**Schema source:** `lib/db/schema.ts` + `lib/db/bootstrap.ts`  
**Auditor standard:** Primary-source only; null preferred to incorrect data  

---

## Executive Summary

BB Sports is a **first-party opinion / newsroom media product**, not a sports
statistics encyclopedia. The production Postgres schema contains **no tables**
for players, coaches, full team registries, rosters, seasons, or box scores.

Franchise “teams” that appear on `/rankings` live in **application code**
(`lib/rankings.ts`) as Brad’s editorial baseline top-25 — they are **not**
database rows and must not be confused with a Tier-1 sports registry.

| Finding | Count |
| --- | ---: |
| Postgres tables defined in schema | 25 |
| Tables that store encyclopedic sports entities (players/teams/coaches) | **0** |
| Tables requiring “every player from every league” population | **0** (not possible without new product schema + app) |
| Editorial content articles on disk | 11 |
| Published live articles (production, prior verify) | 5 |
| Franchise ranking entries (code, 4 leagues × 25) | 100 |

**Update (2026-07-15):** A first-party **sports encyclopedia foundation** has
been shipped: `sports_leagues`, `sports_teams`, `sports_people` with complete
active franchise registries (124 teams) and a small cited people set. This is
**public franchise identity only** — not a proprietary box-score scrape and not
“every player who ever lived.” Full historical stats remain out of scope until
a licensed feed or multi-year first-party research program is funded.

**Conclusion (historical):** Before the encyclopedia tables existed, player
encyclopedia inserts were impossible. Invented stats remain forbidden.

What *can* be done within the current product:

1. Document the real schema and insertion order (this file).
2. Keep newsroom/provider seed rows dark and correct (already shipped).
3. Ensure article bootstrap remains draft-only until Brad approval (already enforced).
4. Publish a **future encyclopedia blueprint** only as a design proposal — not as fake seed data.

---

## Phase 1 — Complete Schema Inventory

### 1.1 Tables (dependency order)

#### A. Identity & access (parent)

| Table | Purpose | FK deps | Population posture |
| --- | --- | --- | --- |
| `users` | Admin accounts | none | Seed from env (`ADMIN_EMAIL` + `ADMIN_PASSWORD_HASH`) only — **not** public profiles |
| `sessions` | JWT session audit | `users` | Runtime only; never bulk-seed |
| `publication_runtime_controls` | Release gate for published working-copy edits | none | Bootstrap default row; operator-controlled |

#### B. Editorial content

| Table | Purpose | FK deps | Population posture |
| --- | --- | --- | --- |
| `articles` | Draft / published columns | `users` (optional) | Bootstrap imports markdown as **drafts**; public live content only via immutable publication path |
| `article_revisions` | Append-only content-addressed snapshots | `articles`, `users`, `news_events` | Created by prepare/publish — never bulk-seed fake revisions |
| `article_publication_events` | Append-only publish/unpublish audit | `articles`, `article_revisions`, `users` | Same — Brad approval only |
| `media_assets` | Editorial/AI media library | none (users optional) | Runtime/admin only |
| `comments` | Reader comments | `articles`, `users` | User-generated; not seeded |

#### C. Site & product rails

| Table | Purpose | FK deps | Population posture |
| --- | --- | --- | --- |
| `site_config` | Breaking ticker, hero, about bio, footer | `users` | Bootstrap defaults + admin |
| `newsletter_subscribers` | First-party list | none | User-generated |
| `contact_messages` | Tips/inbox | none | User-generated |
| `donation_intents` | Pre-Stripe interest ledger | none | User-generated |
| `analytics_events` | First-party privacy-filtered events | none | Runtime only |

#### D. Real-time newsroom

| Table | Purpose | FK deps | Population posture |
| --- | --- | --- | --- |
| `news_sources` | Editorial source registry | none | Manual intake + dark `provider-intake:*` seeds |
| `news_signals` | Observed leads | `news_sources` | Manual desk + future provider ingest |
| `news_events` | Verification workflow units | none | Manual / ingest |
| `news_event_signals` | Event↔signal links | `news_events`, `news_signals` | Workflow |
| `news_evidence` | Append-only evidence | `news_events`, `news_sources`, `news_signals`, `users` | Workflow |
| `news_verification_reviews` | Append-only decisions | `news_events`, `users` | Workflow |
| `newsroom_activity` | Append-only audit / SSE | `news_events`, `news_signals`, `users` | Workflow |
| `news_event_articles` | Event→draft linkage | `news_events`, `articles`, `article_revisions`, `users` | Workflow |
| `news_providers` | External connector governance | none | Catalog seed (dark) |
| `news_provider_leases` | Worker fencing | `news_providers` | Runtime |
| `news_provider_checkpoints` | Cursors | `news_providers` | Runtime |
| `news_provider_ingest_attempts` | Ingest ledger | `news_providers` | Runtime |
| `news_provider_dead_letters` | Dead letters | `news_providers`, attempts | Runtime |

### 1.2 Tables that **do not exist** (user request gap)

| Requested entity | Present in schema? | Where the product actually stores related concepts |
| --- | --- | --- |
| Players / athlete profiles | **No** | Not modeled |
| Full career history / stats | **No** | Not modeled |
| Coaches | **No** | Not modeled |
| Team franchises (complete league sets) | **No** | Editorial top-25 only in `lib/rankings.ts` |
| Rosters / seasons / games | **No** | Not modeled |
| Official league standings | **No** | Not modeled |

### 1.3 Non-database “data” surfaces (must not be treated as empty DB tables)

| Surface | Location | Nature | Source standard |
| --- | --- | --- | --- |
| Franchise rankings baseline | `lib/rankings.ts` | Editorial opinion (Brad) | **Not** Tier-1 factual registry; house ranking |
| Ranking demotions | Article body `<!-- bb:trash ... -->` | Editorial | Article author |
| Article markdown | `content/articles/*.md` | Editorial copy | First-party BB Sports |
| Sport labels | `lib/sport-meta.ts` | Product taxonomy | Product decision |

---

## Phase 2 — Data Domain Classification

### Domain A — First-party editorial (GREEN for population)

- **Entity:** BB Sports columns and immutable publication records  
- **Primary source:** Brad / BB Sports published text (first-party)  
- **Complete set:** Finite, small; grows only when Brad publishes  
- **Risk if wrong:** Credibility of the brand (copy errors), not sports-stat liability  
- **Status:** 11 markdown candidates; live published set governed by Brad approval gate  

### Domain B — Newsroom / provider governance (GREEN structure, RED live feeds)

- **Entity:** Signal verification workflow + connector posture  
- **Primary source:** Internal operational policy (`docs/REALTIME-NEWSROOM.md`, legal posture)  
- **Complete set:** Catalog of connectors (X, Bluesky, RSS, xAI) — **not** a sports encyclopedia  
- **Status:** Seeded dark; no live external monitoring claimed  

### Domain C — Franchise rankings (YELLOW — opinion, code-bound)

- **Entity:** Brad’s top-25 per NFL/MLB/NHL/NBA  
- **Primary source:** Explicitly **opinion**, not league standings  
- **Must never be labeled** as “official ranking” or populated into a faux “teams” table without product design  

### Domain D — Global sports encyclopedia (players/coaches/teams history) — **OUT OF SCOPE FOR CURRENT SCHEMA**

- **Primary sources if ever built (Tier 1 examples only):**  
  - NFL: official NFL records / club media guides / Pro Football Reference only as secondary after official  
  - MLB: MLB official stats / Baseball-Reference cross-check  
  - NBA: NBA.com stats / Basketball-Reference cross-check  
  - NHL: NHL.com / Hockey-Reference cross-check  
  - NCAA: NCAA official stats  
- **Licensing:** Commercial redistribution of box scores and historical stats is often **restricted**; “deeper than any sports site” is not a legal free-for-all  
- **Scale:** Active + historical major-league players alone is hundreds of thousands of rows; “every league” is multi-million  

---

## Phase 3 — What Will Not Be Inserted (Integrity Decision)

Per project constraints:

1. **No fabricated player/coach tables** filled with AI memory or Wikipedia scrapes.  
2. **No schema invention in this audit** disguised as “population” without an explicit product decision.  
3. **No disabling of FK constraints** to force encyclopedia inserts.  
4. **No claims** that BB Sports currently holds encyclopedic sports facts in Postgres.

If Brandon later wants a Sports Reference–class product, that is a **separate product initiative** requiring:

- Schema design (leagues → teams → seasons → people → stints → stats)  
- Licensed data feeds or official APIs  
- Attribution and rights review  
- UI/API surfaces  
- Continuous re-verification schedule  

---

## Phase 4 — Actionable Population Tasks (Mapped to Reality)

The following 50 tasks cover **everything that is legitimate under the real schema**, plus **design-only** encyclopedia tasks that must not write fake rows.

### Sprint 0 — Integrity & honesty (Tasks 1–5)

**Task #1: Schema inventory freeze**  
Priority: HIGH | Score: 10 | Table: _(meta)_  
Record Count: 25 tables documented  
Dependencies: none  
Data Domain: Complete Postgres surface of BB Sports  
Primary Source: `lib/db/schema.ts` (first-party code)  
Action: Maintain this document as the source of truth for what exists  

**Task #2: Production row-count baseline**  
Priority: HIGH | Score: 10 | Table: all  
Record Count: n/a (measurement)  
Dependencies: production DATABASE_URL  
Primary Source: Postgres `count(*)`  
Action: Re-run after every deploy sprint  

**Task #3: Prohibit encyclopedia inserts without schema**  
Priority: HIGH | Score: 10 | Table: n/a  
Action: Reject any seed that invents `players`/`coaches` tables without PR product design  

**Task #4: Rankings data classification**  
Priority: HIGH | Score: 9 | File: `lib/rankings.ts`  
Record Count: 100 franchise opinion rows  
Primary Source: First-party editorial baseline (Brad)  
Confidence: VERIFIED as **opinion**, not league fact  

**Task #5: Article content inventory**  
Priority: HIGH | Score: 9 | Table: `articles` / `content/articles`  
Record Count: 11 markdown candidates  
Primary Source: First-party BB Sports files  
Action: List slugs, sports, presence of demotion directives  

### Sprint 1 — Parent / access (Tasks 6–10)

**Task #6–8: `users` / `sessions` / `publication_runtime_controls`**  
Priority: HIGH | Score: 9  
Record Count: 1 super_admin (env); sessions runtime; 1 control row  
Primary Source: Railway secrets / bootstrap  
Do **not** seed public “player accounts”

**Task #9–10: Integrity columns proposal (design only)**  
Priority: MEDIUM | Score: 6  
Tables: any future encyclopedia tables  
Note: Adding `data_source` columns to **all** existing tables without product need is out of scope for current rails; recommend only on **new** factual entity tables if/when built  

### Sprint 2 — Editorial core (Tasks 11–20)

**Task #11: `articles` draft import**  
Priority: HIGH | Score: 9  
Record Count: ≤11 from disk  
Primary Source: `content/articles/*.md` (first-party)  
Rule: Import remains draft unless Brad publishes  

**Task #12–15: Publication ledgers**  
Priority: HIGH | Score: 10  
Tables: `article_revisions`, `article_publication_events`  
Record Count: equals live published set  
Primary Source: Brad approval transactions only  

**Task #16–20: `site_config`, `media_assets`, `comments`**  
Priority: MEDIUM | Score: 5–7  
User-generated or admin-managed; no sports-stat seeding  

### Sprint 3 — Newsroom foundation (Tasks 21–35)

**Task #21: `news_sources` manual intake**  
Priority: HIGH | Score: 9  
Record Count: 1 (`manual-newsroom`)  
Primary Source: first-party product decision  

**Task #22–25: Provider catalog + intake sources**  
Priority: HIGH | Score: 9  
Tables: `news_providers`, `news_sources` (`provider-intake:*`)  
Record Count: 4 + 4  
Primary Source: `docs/legal/NEWS-SOURCE-PROVIDER-POSTURE.md`  
Status: seeded dark (already live)  

**Task #26–35: Newsroom workflow tables**  
Priority: MEDIUM | Score: 6  
Tables: signals/events/evidence/reviews/activity  
Record Count: operational, not encyclopedic  
Action: leave empty until desk work; never seed fake verified events  

### Sprint 4 — Rankings verification (code, not DB) (Tasks 36–40)

**Task #36–39: Cross-check franchise id stability**  
Priority: MEDIUM | Score: 7  
File: `lib/rankings.ts`  
Primary Source: first-party ranking ids used by demotion directives  
Action: ensure every `bb:trash team=` in articles resolves to a baseline id  

**Task #40: Document that rankings ≠ official standings**  
Priority: HIGH | Score: 9  
Primary Source: product docs / rankings page copy  

### Sprint 5 — Future encyclopedia design ONLY (Tasks 41–50)

These tasks produce **design artifacts**, not seed rows, unless Brandon explicitly
approves a new product and licensing budget.

**Task #41: League registry design** — `leagues`  
**Task #42: Team registry design** — `teams` (complete league membership, not top-25)  
**Task #43: Season registry design** — `seasons`  
**Task #44: Person registry design** — `people` (players + coaches)  
**Task #45: Employment stints design** — `person_team_stints`  
**Task #46: Coaching tenures design** — `coach_tenures`  
**Task #47: Game/results design** — `games` (licensing-gated)  
**Task #48: Stat lines design** — `player_season_stats` (licensing-gated)  
**Task #49: Source citation model** — `data_source`, confidence, verified_at on each factual table  
**Task #50: Licensing & rights memo** — NFL/MLB/NBA/NHL terms review before any bulk ingest  

Each of Tasks 41–50 requires:

- Named Tier-1 source strategy  
- Rights review  
- Schema PR  
- Application PR  
- Continuous maintenance schedule  

**None of Tasks 41–50 authorize inventing player rows today.**

---

## Sample “what a correct player record would look like” (design only)

If/when a `people` table exists, a single NFL player row would require sources like:

| Field | Example (illustrative) | Tier-1 source expectation |
| --- | --- | --- |
| full_name | … | Club media guide / official roster |
| birth_date | … | Official bio or government record where available |
| jersey_number | … | Club roster page for that season |
| height_in | … | Club/official roster |
| draft_year | … | Official draft records |
| career_passing_yards | … | Official league stats provider |

Until those tables exist and rights are cleared, **zero player rows are inserted**.

---

## Implementation Blueprint (Honest)

### Sprint breakdown

| Sprint | Work | DB writes allowed? |
| --- | --- | --- |
| 0 | Audit + classification (this doc) | Docs only |
| 1 | Access/control integrity | Env seeds only |
| 2 | Editorial articles via existing bootstrap/publication | Yes, first-party only |
| 3 | Newsroom/provider seeds (already done) | Yes, dark catalog |
| 4 | Rankings id integrity tests | Code/tests |
| 5 | Encyclopedia product design | Design only until approved |

### Seed file structure (recommended when factual entity tables exist)

```text
/db/seeds/
  _run_order.ts
  00_schema_prep.sql
  01_leagues.seed.ts
  02_teams.seed.ts
  03_people.seed.ts
  ...
  _verification_queries.sql
  _source_citations.md
```

**Do not create these seeds for non-existent tables in the current product.**

### Post-population verification (current product)

```sql
-- Tables must remain free of encyclopedic sports entities
SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY 1;

-- Published articles only via immutable pointers
SELECT count(*) FROM articles WHERE published = true;
SELECT count(*) FROM article_revisions;
SELECT count(*) FROM article_publication_events;

-- Providers remain dark
SELECT provider_key, commercial_status, config_enabled FROM news_providers;
SELECT source_key, enabled FROM news_sources WHERE source_key LIKE 'provider-intake:%';
```

### Data maintenance schedule (current product)

| Domain | Cycle | Trigger |
| --- | --- | --- |
| Articles / publication gate | Continuous | Brad publish/unpublish |
| Rankings baseline (code) | Per Brad editorial decision | New columns / season narrative |
| Provider commercial posture | Before any connector activation | Terms change after 2026-07-15 research snapshot |
| Future encyclopedic stats | Only if product built | Official annual revisions + licensed feed updates |

---

## Quality Checkpoints (Self-Verify)

- [x] Every table audited  
- [x] Insertion order documented for existing tables  
- [x] Encyclopedic player/coach request mapped to **missing schema** (not faked)  
- [x] Null-over-wrong principle applied  
- [x] No application code changes required for honesty  
- [x] No rights-violating scraped player media proposed  
- [x] First-party editorial data path remains Brad-gated  

---

## Decision Required from Brandon

To proceed with “every player / team / coach full history,” choose one:

1. **Stay opinion-media (current product):** no encyclopedia tables; rankings stay Brad’s top-25 opinion.  
2. **Build Sports Encyclopedia v1:** approve schema design (Tasks 41–50), licensing budget, and a multi-sprint data program with Tier-1 sources only.  
3. **Licensed feed integration:** contract a commercial sports data provider (with redistribution rights) rather than manual primary-source entry for millions of rows.

Until one of those is chosen, **no player/coach encyclopedic records will be written** to production Postgres.

---

## Appendix A — Franchise ranking coverage (code, opinion)

| League | Baseline count | Source file |
| --- | ---: | --- |
| NFL | 25 | `lib/rankings.ts` |
| MLB | 25 | `lib/rankings.ts` |
| NHL | 25 | `lib/rankings.ts` |
| NBA | 25 | `lib/rankings.ts` |

These are **not** complete 32-team NFL / 30-team NBA registries. Completing official full leagues would be Task #42 (design + product), not a silent rankings edit.

## Appendix B — Article content inventory (first-party)

| Slug | Domain |
| --- | --- |
| welcome-to-bb-sports | brand |
| why-the-bears-finally-have-a-real-shot | NFL |
| yankees-window-just-slammed | MLB |
| lakers-are-not-a-real-team | NBA |
| the-maple-leafs-window-is-closed-and-everyone-knows-it | NHL |
| the-warriors-dynasty-is-over-and-the-front-office-is-the-only-one-still-pretending | NBA |
| cowboys-are-a-brand-not-a-contender | NFL |
| florida-football-is-one-quarterback-away-from-mattering-again | CFB |
| college-football-is-a-different-sport-now | CFB |
| the-united-takes-rewrite-themselves-every-week | Soccer |
| wild-avs-game-1-was-it-actually-good-hockey | NHL |

Primary source for all: BB Sports first-party content files.
