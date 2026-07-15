# News Source Provider Posture

Status: activation gate
Property: BB Sports, a commercial media product
Facts and terms checked: 2026-07-15
Next review: immediately before enabling any connector

This document records the commercial, technical, and editorial posture for
sources proposed for the BB Sports real-time news desk. It is an engineering and
operations control, not legal advice. A public feed, unauthenticated endpoint,
API key, or successful test request is not permission for commercial use.

## Status meanings

| Status | Meaning |
| --- | --- |
| GREEN | Approved for the exact listed production use, with evidence and owner recorded. |
| YELLOW | Technically viable, but commercial approval, account configuration, budget, or compliance work is incomplete. Must fail closed. |
| RED | Not approved for the proposed production use. Do not connect, scrape, store, display, or republish. |
| ENTERPRISE | Capability is documented but requires an enterprise agreement not currently evidenced here. |

## Current decision

Only the first-party manual newsroom foundation is GREEN. No external news
connector is activated by this document. All connector gates default false, and
Brad approval remains mandatory after any signal is verified.

| Provider/source | Intended role | Posture | Decision and constraints |
| --- | --- | --- | --- |
| First-party manual newsroom | Capture links, evidence, reviews, state transitions, and audit history. | GREEN | Zero-credential foundation. A manually seeded `unverified` item cannot verify itself. No publish function exists in the signal domain. |
| X Filtered Stream | Persistent near-real-time watch of curated official and reporter accounts/terms. | YELLOW | X documents a paid persistent stream, approximately 6–7 seconds P99, pay-per-use access, one standard connection, and current rate/rule limits. Requires approved X developer use case, account/credits, spend ceiling, policy/display compliance, deletion handling, and all X gates. |
| X Filtered Stream webhooks | Webhook delivery instead of a persistent connection. | ENTERPRISE | X documents ordinary Filtered Stream webhooks as Enterprise-only. Do not design the baseline around webhook availability. |
| xAI X Search | On-demand source discovery and corroboration with returned citations. | YELLOW | Not a stream and not an independent source. Current docs list at most 20 `allowed_x_handles`, $5/1,000 X Search calls, plus model token charges. Requires xAI approval/key/gates, citation retention, budgets, and evaluation against underlying sources. |
| Bluesky Jetstream | Low-latency WSS events from a curated official/reporter DID list. | YELLOW | Official public instances and keyless WSS examples make a pilot technically possible. Availability does not prove commercial approval or SLA. Require terms review, curated DIDs, cursor/replay, dedupe, delete/update/account/takedown handling, and all Bluesky gates. |
| NCAA RSS | Alert metadata for NCAA stories. | YELLOW | NCAA publishes an RSS directory, but feed availability alone does not establish BB Sports' commercial storage/redistribution rights. Require written terms analysis/approval per feed. Never copy bodies. |
| NBA modular/RSS content | Alert metadata for NBA stories. | RED | NBA terms impose conditions on modular/RSS content and other linking/display uses. No BB Sports commercial approval is recorded. Do not activate without written review/permission for the exact use. |
| MLB site/feed content | Alert metadata for MLB stories. | RED | MLB terms describe personal, non-commercial use, restrict automated scripts, and restrict reproduction/redistribution, including third-party material. Do not scrape or activate without an express commercial license. |
| NFL site/feed content | Alert metadata for NFL stories. | RED | NFL terms limit use to individual non-commercial/informational purposes and prohibit systematic retrieval absent prior written consent. Do not scrape or activate without express commercial permission. |
| NHL site/feed content | Alert metadata for NHL stories. | RED | NHL terms limit content/services to non-commercial personal/informational use and restrict database entry, publication, transmission, and commercial embedding without written approval. Do not scrape or activate without express commercial permission. |
| Unreviewed team, league, reporter, blog, podcast, or news RSS | Candidate discovery. | RED | Each source needs a distinct owner, terms URL, commercial-use decision, rate policy, retention/deletion policy, and approval record. A generic RSS approval is insufficient. |

## Exact activation gates

The manual desk has no provider credential dependency. An explicit
`BBSPORTS_REALTIME_NEWSROOM_ENABLED=false` disables automated/SSE alerting while
leaving manual capture and review available. When unset, the automated/SSE
foundation may default enabled; every connector still defaults disabled.

| Connector | All required gates |
| --- | --- |
| X | `BBSPORTS_NEWSROOM_X_ENABLED=true`; `BBSPORTS_APPROVED_X_API=true`; nonblank `X_BEARER_TOKEN`; current approved-use/commercial record; configured spend ceiling. |
| xAI | `BBSPORTS_NEWSROOM_XAI_ENABLED=true`; `BBSPORTS_APPROVED_XAI=true`; nonblank `XAI_API_KEY`; configured model/tool budget. |
| Bluesky | `BBSPORTS_NEWSROOM_BLUESKY_ENABLED=true`; `BBSPORTS_APPROVED_BLUESKY_JETSTREAM=true`; nonempty curated `BBSPORTS_BLUESKY_WANTED_DIDS`. |
| RSS | `BBSPORTS_NEWSROOM_RSS_ENABLED=true`; `BBSPORTS_APPROVED_NEWS_RSS=true`; a GREEN, schema-enforced per-feed record for the exact URL and use. The manual foundation does not yet implement the complete record, so the connector remains disabled. |

Approval and enablement are separate on purpose. An operator must not be able to
activate a connector merely by adding a credential. A missing, invalid, stale,
or ambiguous gate fails closed.

## Required per-source approval record

Before a feed, account set, endpoint, or provider becomes GREEN, record:

- provider and exact endpoint/feed URL;
- legal publisher and normalized editorial `owner_key`;
- intended use (alerting, internal display, public display, quotation, or none);
- authoritative terms/policy URLs and version/review date;
- evidence that commercial use is permitted for this exact product;
- allowed fields, display/attribution rules, and body-copy prohibition;
- storage, edit, deletion, takedown, and retention obligations;
- rate limits, connection limits, quotas, billing unit, and monthly hard ceiling;
- approved BB Sports account/project/application identifiers (never secret
  values);
- approval owner and date;
- incident contact, kill switch, and next review date.

The foundation `news_sources` row is not this complete approval record. It can
classify a first-party/manual source, but external activation still requires a
future schema and UI that enforce every field above.

An approval for headlines does not approve photographs, video, logos, article
bodies, statistics databases, or public embeds. Review those rights separately.

## Provider-specific controls

### X

- Use the official API, not browser scraping.
- Register the BB Sports use case accurately and re-approve substantive changes.
- Filter narrowly; current pricing is per resource/call and can change.
- Treat reposts, quotes, and stories derived from one post as the same provenance
  chain unless independent reporting is documented.
- Follow X display requirements for any X content shown to an operator or the
  public.
- Keep stored X content current. Process edits, privacy changes, suspensions,
  withholding, and deletion as soon as reasonably possible and within the
  applicable policy deadline.
- Store IDs/URLs and minimum provenance wherever full content is unnecessary.
- Never use X data for off-platform ad targeting, profile enrichment, or
  prohibited benchmarking.
- Never post to X through this ingestion credential. Social publishing requires
  a separate, consented, Brad-approved workflow.

### xAI X Search

- Use for bounded questions such as “find the original official post” or “locate
  owner-independent reporting,” not continuous ingestion.
- Pass a curated handle allowlist when possible; the current maximum is 20.
- Persist xAI citations and inspect the cited underlying pages/posts.
- Count source owners after unwrapping citations. Two model citations to the
  same reporting chain are one owner.
- A model answer, confidence statement, or summary is never evidence.
- Enforce per-request tool-call limits, daily/monthly spend ceilings, timeout,
  and a global kill switch.
- Pricing is currently $5 per 1,000 X Search calls plus the selected model's
  token charges; recheck immediately before use.

### Bluesky Jetstream

- Connect only to documented official instances or a reviewed self-hosted
  instance.
- Request only `app.bsky.feed.post` and curated `wantedDids`; never consume the
  global stream for speculative “maybe useful” storage.
- Persist `time_us`; reconnect with a small rewind and idempotent dedupe.
- Handle `create`, `update`, and `delete` commits plus identity, deactivation,
  and takedown events.
- Jetstream omits repository signatures and Merkle proof. Treat every event as
  an unverified lead, never as proof of authorship or an independent evidence
  item; re-fetch through a reviewed authenticity-preserving path.
- A keyless public endpoint is not a contractual uptime guarantee, commercial
  license conclusion, or permission to ignore account deletions.
- Re-review Bluesky terms and the Jetstream project before every production
  activation because the service and policies can evolve independently.

### RSS and league sites

- An RSS directory or XML response proves technical availability only.
- Never store, reproduce, translate, summarize-by-copying, or republish a feed or
  article body. Parse transiently, retain approved metadata only, and write
  original BB Sports copy from verified facts.
- Do not route around a publisher's restrictions by using a third-party RSS
  proxy, reader, cache, mirror, search result, or social repost.
- Do not treat an article headline from a syndication partner as independent of
  its originating wire/outlet.
- Respect source-specific rate instructions and stop on authorization, terms,
  robots, or repeated policy failures.
- Public attribution and links do not cure an otherwise unlicensed use.

## Content and provenance rules

Facts may be independently reported; another publisher's expression is not the
BB Sports draft. The desk stores only the minimum material necessary to identify,
verify, attribute, and revisit a claim.

- Prefer provider IDs, canonical URLs, timestamps, authors/accounts, owner keys,
  classifications, and cryptographic hashes over copied bodies.
- Brief quotations require editorial necessity, exact transcription, context,
  attribution, and Brad's approval.
- Never copy an article/feed body into a prompt, database, draft, or public page
  merely because it was accessible to the connector.
- Do not ingest paywalled, authenticated, protected, private, deleted, or
  access-controlled content through circumvention.
- AI-generated paraphrase does not erase the original source's rights or remove
  the duty to verify facts.
- Source links belong in the article at the claim they support, not hidden only
  in an internal evidence record.

## Spend and reliability controls

- Prepaid or metered providers require a hard monthly ceiling, 50/75/90-percent
  alerts, and a zero-credit state that degrades to manual without data loss.
- Log counts and cost estimates, never bearer tokens, API keys, full provider
  payloads, or sensitive query strings.
- No provider outage may change the verification rule or silently substitute AI
  output for evidence.
- The Railway worker, not cron, owns persistent connections. Railway cron is
  limited to five minutes minimum and is suitable only for bounded reconciliation
  or backfill.
- Provider lag and disconnect states must be visible in the protected desk. If
  neither SSE nor snapshot polling is current, the UI says Degraded rather than
  Live.

## Re-review checklist

- [ ] Open every official source below; confirm the page and effective terms are
      current.
- [ ] Confirm the intended commercial use is described accurately in the
      provider account/application.
- [ ] Confirm price, billing unit, quota, rate, stream connection count, and
      webhook access.
- [ ] Confirm storage, display, attribution, edit, deletion, and takedown duties.
- [ ] Confirm the proposed watchlist and owner-key map.
- [ ] Confirm the connector's kill switch defaults false and fails closed.
- [ ] Confirm test/staging credentials cannot create production spend or access.
- [ ] Confirm secrets are present only in Railway and are absent from logs,
      client bundles, database rows, docs, and repository history.
- [ ] Confirm body-copy, SSRF, redirect, entity-expansion, response-size, timeout,
      replay, duplicate, and delete-event tests pass.
- [ ] Record the approver/date and schedule the next review.

## Official sources

These links are primary research inputs, not blanket approval:

- [X Filtered Stream](https://docs.x.com/x-api/posts/filtered-stream/introduction)
- [X API rate limits](https://docs.x.com/x-api/fundamentals/rate-limits)
- [X API pricing](https://docs.x.com/x-api/getting-started/pricing)
- [X Filtered Stream webhooks](https://docs.x.com/x-api/webhooks/stream/introduction)
- [X Developer Policy](https://docs.x.com/developer-terms/policy)
- [X display requirements](https://docs.x.com/developer-terms/display-requirements)
- [xAI X Search](https://docs.x.ai/developers/tools/x-search)
- [xAI citations](https://docs.x.ai/developers/tools/citations)
- [xAI pricing](https://docs.x.ai/developers/pricing)
- [Railway cron jobs](https://docs.railway.com/cron-jobs)
- [Railway cron, workers, and queues](https://docs.railway.com/guides/cron-workers-queues)
- [Bluesky Jetstream introduction](https://docs.bsky.app/blog/jetstream)
- [Bluesky Jetstream reference implementation](https://github.com/bluesky-social/jetstream)
- [Bluesky terms of service](https://bsky.social/about/support/tos)
- [NCAA RSS directory](https://www.ncaa.com/rss)
- [NBA terms of use](https://www.nba.com/termsofuse)
- [MLB terms of use](https://www.mlb.com/official-information/terms-of-use)
- [NFL terms and conditions](https://www.nfl.com/legal/terms/)
- [NHL terms of service](https://www.nhl.com/info/terms-of-service)
