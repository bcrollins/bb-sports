# BB Sports Real-Time Newsroom

Status: manual desk, immutable publication gate, and provider governance persistence implemented; external connectors still gated off with no live transport
Owner: Brad Benson (editorial approval) / Brandon Rollins (platform)
Last reviewed: 2026-07-15

## Decision

BB Sports will compete on **time to a correct, attributed, Brad-approved
report**, not on unverified speed. The real-time system is an alerting,
corroboration, and evidence-preservation desk. It does not auto-publish and it
does not impersonate independent reporting.

Every public article still requires Brad's explicit approval. This remains true
when a source is official, when two sources agree, when an AI draft is excellent,
and when another outlet appears seconds away from publishing.

The first shipped interval is deliberately zero-credential and manual. It gives
the desk a durable state machine, source-independence rules, evidence history,
review history, and activity history before any paid or third-party connector is
allowed to create signals. The future streaming layer must use the same domain
rules; providers do not get a second, weaker path to verification.

A later interval added **provider governance persistence** without activating
any connector: registered provider rows, commercial/retention/attribution
posture, credential *presence* (never secret values), durable
cursor/checkpoints, leases with fencing tokens, ingest-attempt and dead-letter
ledgers, and pure activation evaluation that always keeps `transportAllowed`
false until a separate worker proves live ingest. Configuration crumbs and
parser modules must never be labeled “live monitoring.”

The **authoritative provider ingest transaction**
(`ingestProviderCandidate`) is also present. It normalizes a bounded candidate,
fail-closed gates on provider commercial approval + config enablement + intake
source state, exact-deduplicates by external id / content hash / URL hash, and
atomically writes signal + event link + activity + ingest attempt. It never
verifies, never publishes, and never stores secret-bearing provenance or full
restricted provider bodies. Provider intake sources seed disabled.

## What “real time” means

- A source event can become a newsroom signal within seconds when an approved
  streaming connector is enabled.
- Brad sees new or changed signals without refreshing while the protected
  server-sent-events (SSE) channel is healthy.
- The desk ranks urgency and verification readiness. It never treats virality,
  follower count, a blue check, or AI confidence as proof.
- A verified signal is **eligible for editorial action**, not approved for
  publication.
- Drafting, editing, source linking, Brad's approval, publication, social
  posting, and corrections remain explicit downstream actions with their own
  audit trail.

The system cannot guarantee that BB Sports will always be first. It can make the
controllable part fast: narrow watchlists, immediate ingestion, deterministic
deduplication, owner-independent corroboration, a terse decision surface, and a
single Brad approval step.

## Non-negotiable editorial boundary

1. No signal, connector, worker, model, score, or scheduled task may publish an
   article or social post.
2. No AI result counts as a source. AI may locate and summarize evidence, but
   verification is computed from the underlying cited sources.
3. No source body may be copied into a BB Sports article. Report facts in
   original language; use only brief, necessary, attributed quotations after
   human review.
4. A single manual submission cannot verify itself.
5. A repost, syndication copy, affiliate, same-owner outlet, or article quoting
   the first report is not independent corroboration.
6. Any unresolved contradictory evidence blocks verification. A mistaken,
   retracted, or superseded item is resolved only by appending replacement
   evidence with `supersedesEvidenceId`; the original row remains auditable.
7. “BB Sports confirmed” is reserved for BB Sports' own direct confirmation.
   Meeting the system's evidence threshold does not create that claim.
8. Brad approval is always required. There is no pre-approved auto-publish
   category in this system.

## Shipped manual foundation

The manual desk is the safe baseline and remains available even when every
automated connector is disabled.

### Immutable Brad approval gate

The article boundary is separate from newsroom verification and is enforced in
the API, transaction layer, and Postgres constraints:

1. Every new article and repository import begins as a draft. Normal create and
   edit routes reject direct publication-state changes.
2. Draft saves require an exact `If-Match` edit token. A concurrent editor gets
   a conflict instead of silently overwriting newer work.
3. Preparing approval requires the SHA-256 hash of the exact saved draft. The
   server locks the article, re-canonicalizes all reader-visible fields, and
   creates or reuses one immutable revision for that exact hash.
4. The editor renders every field from that returned immutable revision,
   including the complete markdown body and full hash. Any local or server-side
   draft change invalidates the prepared approval.
5. Publication requires the current database-backed `super_admin`, the exact
   article/revision/hash tuple, a meaningful rationale, and the literal phrase
   `BRAD APPROVES THIS EXACT ARTICLE FOR PUBLICATION`. The role and article are
   rechecked under database locks in the publishing transaction.
6. If an article came from a newsroom event, every linked event, active source,
   commercial approval, independence threshold, and contradiction is rechecked
   at publication time. Verification going stale blocks publication.
7. Public readers receive only the canonical snapshot joined to its immutable
   revision and matching content hash. Mutable draft columns never fill gaps in
   a corrupt or incomplete live pointer.
8. Unpublishing clears every live pointer atomically and appends a retained
   audit event. Immutable revisions and publication history cannot be edited or
   deleted. Only Brad can permanently delete a database-proven virgin draft.

Postgres additionally enforces a same-article revision/hash foreign key, strict
all-null draft versus all-present live pointers, unique live slugs, and
append-only revision/publication/newsroom ledgers. Routine status responses are
metadata-only and bounded; the one exact prepared revision is the prose payload
Brad reviews. A verified-event draft includes at most 25 tier-prioritized source
links while the complete evidence set remains in the internal ledger.

This gate never changes a verified signal into a public article by itself. It
only makes an explicitly initiated Brad approval precise, auditable, and safe
under concurrent edits.

Publication heroes are part of the approved reader-visible revision. A draft
may retain a safe repository or allowlisted remote URL while it is being
assembled, but prepare/publish requires an approved BB Sports media-library
asset with durable JPEG, PNG, or WebP bytes. Postgres prevents those bytes,
readiness, approval, type, or asset identity from changing while a live snapshot
references them.

A verified newsroom event can create or reopen one deterministic cited article
draft. The action rechecks the event, active evidence, independent ownership,
source enablement, and commercial approval under locks, then links the event,
revision, and at most 25 prioritized source URLs. It never publishes. A
substantive event edit reopens the event to `investigating`, so stale
verification cannot remain a publication prerequisite.

### Rolling release activation

The migration installs its state constraint, publication/edit/delete triggers,
runtime control, and live-media guard atomically behind an exclusive table lock.
Published working-copy edits remain disabled by default while older mutable-row
readers may still exist; drafts, public immutable reads, prepare, publish, and
unpublish remain available.

After the exact deployment SHA is healthy and every old replica has drained:

```bash
node ops/verify-publication-postgres.mjs
node ops/publication-working-copy-control.mjs status
node ops/publication-working-copy-control.mjs enable \
  --actor="Brandon Rollins" \
  --capability=publication-runtime-controls-v1 \
  --confirm="ENABLE ONLY AFTER ALL OLD ARTICLE READERS ARE DRAINED" \
  --deploy-sha=<exact-40-character-sha>
```

Before rollback, run the same command with `disable`, the disable confirmation
phrase `DISABLE BEFORE OLD ARTICLE READERS RETURN`, and the current SHA. The
database refuses disable if any live working copy differs from its approved
snapshot; publish, unpublish, or intentionally reconcile that draft first. This
prevents an old reader from exposing already-divergent mutable copy after a
rollback.

### Signal states

| State | Meaning |
| --- | --- |
| `new` | Captured but not yet assigned an editorial conclusion. |
| `investigating` | A reviewer is gathering, classifying, or challenging evidence. |
| `verification_ready` | The evidence shape appears to meet the deterministic threshold and awaits an explicit review decision. |
| `verified` | A reviewer recorded a nonblank rationale and the evidence threshold passed with no unresolved contradiction. Still not publish approval. |
| `dismissed` | Duplicate, stale, irrelevant, false, unsupported, or otherwise closed with a reason. |

Urgency is separate from truth: `routine`, `watch`, or `breaking`. Raising
urgency changes ordering and alerts; it never lowers the verification threshold.

Allowed transitions include reopen paths. New evidence can move a dismissed or
verified item back to investigation. A contradiction discovered after
verification must reopen the item; history is appended rather than rewritten.
There is intentionally no `published` state or publish function in the newsroom
signal domain.

### Append-only accountability

- Evidence captures who/what was observed and when it was captured.
- Reviews record the reviewer, decision, rationale, and timestamp.
- Activity records state changes and operator actions.
- Existing evidence, review, and activity rows are not silently edited or hard
  deleted through the newsroom workflow.
- A correction to evidence is a new row whose `supersedesEvidenceId` points to
  the older row on the same event. Verification evaluates only the latest,
  non-superseded evidence chain, so a mistaken item does not become an
  irreversible blocker and its history does not disappear.
- This zero-credential foundation stores only first-party manual provenance.
  External connectors must not copy provider-restricted text into these
  append-only rows. A provider-specific deletion/redaction boundary is a
  prerequisite for connector activation; it is specified under “Retention and
  deletion,” but is not claimed as implemented by the manual foundation.

## Source tiers and independence

Source tier measures proximity and editorial reliability. `owner_key` measures
independence. They solve different problems.

| Tier | Definition | Examples | Can support verification? |
| --- | --- | --- | --- |
| `primary` | A direct participant, authorized representative, public record, filing, recording, or BB Sports' own documented interview. | Player/agent statement; court filing; Brad's recorded interview. | Eligible only when the reviewer explicitly marks it credible and records substantive provenance. One qualifying item can satisfy the threshold. |
| `official` | The organization with authority over the event. | League transaction wire; team release; conference discipline notice. | Eligible only when the reviewer explicitly marks it credible and records substantive provenance. One qualifying item can satisfy the threshold. |
| `tier_1` | A named, accountable reporter or desk with direct beat access and a strong correction record. | Credentialed national insider or established beat reporter. | Yes, but needs a second independent credible owner unless paired with primary/official evidence. |
| `tier_2` | A reputable named local or specialist outlet that reports original work but has less direct or consistent access. | Established local sports desk or specialist publication. | Yes, but needs a second independent credible owner unless paired with primary/official evidence. |
| `unverified` | Anonymous claims, aggregators, fan accounts, engagement bait, unsourced summaries, or an initial manual newsroom note. | “League source” screenshot with no provenance; rumor account; copied post. | No. Useful as a lead only. |

For the deterministic rule, `primary`, `official`, `tier_1`, and `tier_2` are
eligible tiers. Eligibility alone never counts: each supporting item must also
be explicitly marked `credible=true` and carry a URL, registered source/signal,
or substantive offline notes.

Every evidence item has a normalized `owner_key`. The key represents the entity
that controls the reporting, not merely the domain, byline, app, or account that
displayed it. Examples:

- Two local stations owned by the same group and carrying the same report: one
  owner.
- An ESPN article quoting an Adam Schefter post: one underlying reporting owner,
  not two.
- A team release repeated by the league transaction page: inspect provenance;
  if one copied the other, it is one source chain.
- Two reporters citing the same press release: one official fact source, even if
  their analysis is independently written.
- A primary filing plus an independently reported team response: two owners and
  two provenance chains.

Owner normalization is conservative. When ownership or provenance is unclear,
assume the sources are not independent until a reviewer resolves it.

## Verification threshold

A signal may enter `verified` only when all of the following are true:

1. There is no unresolved contradictory evidence. Credibility affects whether
   support can qualify; it does not allow a contradiction to be ignored.
2. Supporting evidence includes either:
   - at least one credible, substantive `primary` or `official` item; or
   - credible, substantive supporting evidence from at least two distinct normalized
     `owner_key` values.
3. A human reviewer records a specific, nonblank rationale describing what was
   checked and why the evidence is sufficient.

The threshold is necessary, not sufficient, for publication. Brad can wait for
more evidence, narrow the claim, attribute the report, or decline the story.

### Attribution language

| Evidence shape | Safe public framing after Brad approval |
| --- | --- |
| One official/primary announcement | “The team announced…” or “According to the filing…” with a direct source link. |
| One reporter plus no independent corroboration | Not `verified`; “Reporter X reports…” only if Brad deliberately publishes an attributed developing item. Do not say BB Sports verified it. |
| Two owner-independent credible reports | Attribute both where material. “Multiple outlets report…” is allowed; “BB Sports independently confirmed” is not. |
| BB Sports direct interview/document confirmation | “BB Sports confirmed…” only when the evidence record contains that direct work and Brad approves the wording. |

## Contradictions and developing stories

A contradiction is substantive when evidence disagrees about a fact that would
change the headline, lede, timing, identity, injury status, transaction,
discipline, score, quote, or legal meaning. Every unresolved item marked
`contradicting` blocks verification, including an unverified item; reviewers
must investigate it or explicitly supersede it rather than quietly discount it.

When a contradiction arrives:

1. Append a `contradicting` evidence item. The verifier derives the unresolved
   contradiction from active evidence; there is no mutable contradiction flag.
   Any evidence added after verification atomically reopens the event to
   `investigating`.
2. Preserve both evidence chains and their capture timestamps.
3. Stop draft-generation nudges and all “ready” alerts.
4. Identify whether the disagreement is a correction, update, timing mismatch,
   definition mismatch, or genuinely unresolved conflict.
5. Seek a primary/official clarification or another owner-independent source.
6. If an item was mistaken, retracted, or misclassified, append corrected
   evidence with `supersedesEvidenceId` pointing to it. Never edit or delete the
   older row.
7. Record a new review rationale; never overwrite the earlier decision.
8. If an article is already public, use the correction runbook immediately.

Silence is not contradiction. A deleted post, account takedown, source edit, or
material headline change is a high-priority integrity event and must be reviewed
as a possible contradiction or retraction.

## Target architecture

```text
approved connector(s)          manual submission
        |                            |
        +----------> normalize <-----+
                         |
                  dedupe + owner key
                         |
                  newsroom signal DB
                  /       |         \
             evidence   reviews   activity
                  \       |         /
                 deterministic verifier
                         |
          protected admin snapshot + SSE
                         |
                Brad investigates/reviews
                         |
         separate article draft/edit/approval flow
                         |
                  Brad-approved publish
```

Connectors only append normalized candidates and provider lifecycle events. They
cannot mark an item verified, create a publish approval, or call an article
publication endpoint.

## Provider governance tables

These tables are present and seeded dark. They do not open connections.

| Table | Role |
| --- | --- |
| `news_providers` | Catalog row per provider: commercial status, allowed use, retention/attribution posture, credential env *names*, presence metadata, config enablement (default false). |
| `news_provider_leases` | Singleton mutable lease per provider with monotonic `fence_token`. |
| `news_provider_checkpoints` | Durable cursor; writers must present a live matching fence. |
| `news_provider_ingest_attempts` | Append-only latency/rate-limit/failure/success ledger. |
| `news_provider_dead_letters` | Append-only dead letters; one-shot resolve only. |

Seeded provider keys: `x_filtered_stream`, `bluesky_jetstream`, `rss`,
`xai_x_search`. All start `commercial_status=review_required` and
`config_enabled=false`. Pure evaluation in `lib/newsroom-providers.ts` and
durable operations in `lib/newsroom-provider-queries.ts` never publish articles
or mark events verified.

## Railway service topology

When the first connector is approved, deploy a separate always-on Railway
worker from the same repository and exact commit as the web service.

### Web service

- Serves protected `/admin/news-desk` operations.
- Serves the authenticated stream at
  `GET /api/admin/news-desk/stream?after=<seq>`.
- Provides snapshots and manual mutations through protected admin handlers.
- Does not hold a provider streaming connection.

### Newsroom worker

- Has no public domain.
- Owns X/Bluesky persistent connections and RSS polling **only after** transport
  activation; the shipped skeleton never dials providers.
- Normalizes and idempotently writes into Postgres via `ingestProviderCandidate`
  once a transport is approved.
- Uses a database lease with fencing tokens so only one active consumer owns each
  singleton provider connection during deploy overlap.
- Persists cursors/checkpoints only after the associated normalized event is
  committed.
- Reconnects with bounded exponential backoff and jitter.
- Emits heartbeat, lag, reconnect, rate-limit, spend, and dead-letter metrics.
- Shuts down gracefully on Railway deploy signals and resumes from the stored
  cursor.

#### Worker skeleton (shipped, default-off)

| Item | Value |
| --- | --- |
| Entrypoint | `node ops/newsroom-worker.mjs` (bundled from `worker/newsroom-worker.ts`) |
| Local/dev | `npm run worker:newsroom` |
| Health | `GET /health` and `GET /ready` on `WORKER_HEALTH_PORT` (default `3101`) |
| Enable loop | `BBSPORTS_NEWSROOM_WORKER_ENABLED=true` (health-only when unset/false) |
| Ingest claim | `activelyIngesting` is always `false` in this skeleton |
| Web service | Continues to start with `node server.js` only |

Deploy a **separate** Railway service from the same image/commit when ready.
Do not set the web service start command to the worker. Do not enable the worker
loop or provider gates without commercial approval and transport tests.

### Cron is recovery, not real time

Railway cron has a five-minute minimum interval and does not guarantee exact
minute execution. It may run a reconciliation/backfill job every five minutes or
slower, but it cannot be the primary alert path. Railway's own guidance assigns
long-running stream processing to a background worker.

Backfill must be idempotent, bounded, source-rate-aware, and unable to move a
signal to `verified` by itself.

## Latency service levels

These are BB Sports internal objectives, not provider guarantees. Measure from
provider publication time when the provider supplies it and from receipt time
otherwise.

| Segment | Objective | Alert condition |
| --- | --- | --- |
| Manual signal save | p95 <= 1 second | p95 > 2 seconds for 10 minutes. |
| X publication to normalized DB row | p95 <= 12 seconds; p99 <= 20 seconds | p99 > 30 seconds for 5 minutes, excluding a declared X incident. X publishes approximately 6–7 seconds P99 for Filtered Stream itself. |
| Bluesky Jetstream receipt to normalized DB row | p95 <= 2 seconds | p95 > 5 seconds for 5 minutes. No upstream delivery guarantee is assumed. |
| RSS poll interval | <= 60 seconds per approved feed unless its terms/rate policy requires slower | No successful poll for 2 expected intervals. Feed publication latency is outside BB Sports' control. |
| Normalized row to admin event | p95 <= 3 seconds | p95 > 8 seconds for 5 minutes. |
| Verification-rule recompute | p95 <= 250 ms | p95 > 1 second. |
| Worker reconnect | first retry <= 1 second; bounded backoff <= 60 seconds | Disconnected > 2 minutes without an active provider incident. |
| Cursor/backfill recovery | no permanent gaps; duplicate-safe replay | Any unexplained sequence gap or stale checkpoint. |

Editorial targets start after a signal is visible:

- breaking signal acknowledged by an operator: 2 minutes;
- first evidence classification: 3 minutes;
- verification decision after threshold is met: 2 minutes;
- Brad-approved short attributed alert, once editorially ready: 3 minutes.

Speed metrics must never reward premature verification or publication. The
primary quality metric is “first accurate timestamp,” not raw first timestamp.

## SSE delivery and fallback

The SSE channel is a convenience layer over Postgres truth, not a queue.

- Endpoint: `GET /api/admin/news-desk/stream?after=<seq>`.
- Authentication: active, non-revoked newsroom session required for the entire
  connection; the public access-wall cookie is insufficient.
- Resume: honor both the `after` query and `Last-Event-ID`; use the newer valid
  sequence and return ordered events after it.
- Server read loop: poll the activity ledger every 2 seconds.
- Heartbeat: emit an SSE comment every 15 seconds.
- Rotation: force a clean reconnect around 45 seconds so deployments and session
  changes converge quickly.
- Backpressure: bound every batch and require snapshot refresh if the requested
  sequence is outside the replay window.
- Client fallback: if SSE cannot connect or repeatedly drops, fetch an
  authenticated snapshot every 5 seconds, visibly label the desk “Polling,” and
  retry SSE with jitter.
- Degraded state: the desk must show the last successful event time and must not
  imply that monitoring is live while both SSE and polling are failing.

SSE events contain normalized newsroom IDs and changed fields, not full
third-party bodies or credentials. Browser notifications, email, SMS, and social
posting are separate opt-in projects and are not implied by this stream.

## Connector activation and kill switches

The manual desk requires no new environment variables. Automated/SSE alerting is
controlled by `BBSPORTS_REALTIME_NEWSROOM_ENABLED`; it may default to enabled
when unset, and an explicit `false` is the global incident kill switch. Manual
capture and review remain available when it is false.

Every connector gate defaults to false and requires all listed conditions. A
missing, malformed, or ambiguous value means disabled.

| Connector | Required activation contract |
| --- | --- |
| X Filtered Stream | `BBSPORTS_NEWSROOM_X_ENABLED=true` **and** `BBSPORTS_APPROVED_X_API=true` **and** a nonblank `X_BEARER_TOKEN`, plus a current approved-use record and spend ceiling. |
| xAI X Search | `BBSPORTS_NEWSROOM_XAI_ENABLED=true` **and** `BBSPORTS_APPROVED_XAI=true` **and** a nonblank `XAI_API_KEY`. xAI is corroboration/search assistance only. |
| Bluesky Jetstream | `BBSPORTS_NEWSROOM_BLUESKY_ENABLED=true` **and** `BBSPORTS_APPROVED_BLUESKY_JETSTREAM=true` **and** a nonempty `BBSPORTS_BLUESKY_WANTED_DIDS` allowlist. |
| RSS | `BBSPORTS_NEWSROOM_RSS_ENABLED=true` **and** `BBSPORTS_APPROVED_NEWS_RSS=true` **and** a schema-enforced per-feed approval with source-specific commercial terms, owner, review date, and feed URL. That complete approval schema is not part of the manual foundation, so RSS remains off. |

Operational rules:

- Set the connector-specific `..._ENABLED=false` to stop one connector without
  disabling manual work or other providers.
- Set `BBSPORTS_REALTIME_NEWSROOM_ENABLED=false` during a cross-provider,
  database-integrity, or alert-delivery incident.
- Approval flags are not feature flags. Never temporarily set an approval flag
  true to test unapproved production terms.
- Secrets live in Railway variables, never the database, browser, logs, source,
  or admin response.
- Web and worker services must agree on gate values; a config-digest mismatch is
  an operational alert.
- Re-review all provider terms, pricing, quotas, and allowed use immediately
  before activation. The research snapshot in the legal posture is dated
  2026-07-15 and can change without notice.

## Provider roles

### X Filtered Stream

The ordinary Filtered Stream is the preferred X ingestion path: a paid,
persistent HTTP connection with approximately 6–7 seconds published P99 latency.
X's webhook variant is Enterprise-only and is not the default plan. Apply narrow
rules to official sources and a curated reporter watchlist, observe provider
limits and prepaid spend, and process edits/deletions.

### xAI X Search

xAI X Search is a query-time corroboration aid, not a stream and not an
independent second owner. Its `allowed_x_handles` filter accepts at most 20
handles. Tool calls are currently listed at $5 per 1,000 calls plus model token
charges. Store returned citations and evaluate their underlying sources; never
store a model summary as evidence by itself.

### Bluesky Jetstream

Bluesky operates public WSS Jetstream instances that can be consumed without an
API key in the documented examples. Use only curated DIDs and the
`app.bsky.feed.post` collection. Persist `time_us` cursors, replay with a small
negative buffer, deduplicate idempotently, and process create, update, delete,
identity, deactivation, and takedown events. Public availability is not a
commercial approval or an uptime guarantee. Jetstream events do not carry the
repository signatures/Merkle proof needed to authenticate who said what, so
every Jetstream item is an unverified lead. Re-fetch the record through a
reviewed authenticity-preserving path before it can count as evidence.

### RSS

RSS availability is not a license to copy or commercially republish. Every feed
requires its own terms record and approval. Fetch only metadata needed to alert
the desk. Never persist or republish feed bodies. Link to the original source and
write BB Sports' own report from verified facts.

## URL fetching and SSRF defense

Any evidence-preview or RSS fetcher is a server-side request surface and must:

1. Accept only absolute `https:` URLs; reject userinfo, fragments used as
   routing tricks, nonstandard ports, IP literals, and malformed IDNs.
2. Resolve DNS before connecting and reject loopback, private, carrier-grade
   NAT, link-local, multicast, reserved, documentation, and cloud-metadata
   addresses in IPv4, IPv6, and IPv4-mapped IPv6 forms.
3. Re-resolve and revalidate every redirect; allow at most three redirects.
4. Prefer a reviewed hostname allowlist for automated feeds and provider APIs.
5. Use a five-second connect timeout, ten-second total timeout, two-megabyte
   response cap, and bounded decompression ratio.
6. Accept expected content types only. Parse XML with DTDs, external entities,
   and network entity resolution disabled. Never execute page JavaScript.
7. Strip credentials and sensitive query values from logs. Never forward BB
   Sports cookies, authorization headers, or internal headers to a source.
8. Rate-limit by source and globally, honor `Retry-After`, identify the BB Sports
   fetcher where terms require it, and stop on repeated policy/robots failures.
9. Store the final canonical URL and redirect chain for provenance, without
   treating URL similarity as owner independence.

## Retention, edits, and deletion

The policies below are activation requirements for future external connectors,
not a claim that the manual foundation already stores or redacts provider
content. Until a connector implements and tests its provider-specific deletion
boundary, it remains disabled and must not write provider-restricted fields.

| Data | Default posture |
| --- | --- |
| RSS article body/feed body | Never store. Parse transiently and discard. |
| Raw provider payload | Do not store by default. If temporarily required for debugging under provider terms, encrypt and purge within 24 hours. |
| Permitted source excerpt/display fields | Keep only while the signal is active, then purge after 30 days unless attached to an active correction/legal hold. Provider edits/deletes override the schedule. |
| Source ID, canonical URL, owner key, tier, timestamps, hashes, and lifecycle state | Retain as the minimal provenance/audit record. Review closed, unpublished signal tombstones after 24 months. |
| Evidence/review/activity history for a published article | Retain for the life of the article and the documented editorial/legal retention period, subject to provider deletion rules and legal hold. |
| Connector cursors, leases, and operational logs | Cursor until superseded; structured logs 30 days; security/audit logs 90 days unless incident preservation is required. Never log secrets or full source bodies. |

Any future X content stored offline must be kept current. If it is edited, deleted, made
private, suspended, or withheld, modify or remove the stored/displayed X content
as soon as reasonably possible and no later than the applicable X policy window
(currently 24 hours after a qualifying request). Preserve only the allowed
tombstone/audit metadata.

Any future Jetstream worker must process record deletes, identity changes, deactivation, and
takedown events immediately. Clear source text/display material, reopen any
dependent verified signal, and retain the DID/record key/cursor tombstone needed
to prevent replay resurrection.

An append-only audit trail does not authorize immutable retention of copyrighted
or personal content. Before external activation, the connector design must keep
restricted payload outside the append-only ledgers, clear mutable provider
material on removal, and append only the minimum permitted removal fact, actor,
reason, and timestamp.

## Operator flow

1. Open the protected news desk. Confirm the status banner says whether the desk
   is Live, Polling, Manual only, or Degraded.
2. Capture a manual lead or open an automatically created `new` signal.
3. Set urgency based on impact/time sensitivity, not confidence.
4. Normalize the claim to one falsifiable sentence: who did what, when, and what
   remains unknown.
5. Add direct evidence links. Classify each tier and `owner_key`; mark support,
   contradiction, or context.
6. Move to `investigating`. Check timestamps, edits, source chain, names,
   numbers, quotes, time zones, and whether two items actually share one owner.
   Supersede a mistaken evidence row with a new linked row; never overwrite it.
7. If the deterministic threshold is met without contradiction, move to
   `verification_ready`.
8. Review the underlying sources, write a detailed rationale, and either verify,
   return to investigation, or dismiss.
9. Only after verification, start a separate article draft. Use original BB
   Sports language, direct citations, exact attribution, uncertainty labels, and
   an explicit “what we know / what we do not know” check for developing news.
10. Brad edits and explicitly approves publication. The article system records
    that approval; the signal's `verified` state does not substitute for it.
11. After publish, watch the signal and cited sources for edits, retractions, or
    contradictions. Correct publicly when needed.

## Incident runbook

### Bad-source flood or false-positive storm

1. Disable the affected connector-specific `..._ENABLED` flag.
2. Keep the manual desk available; do not delete the evidence trail.
3. Mark affected signals investigating/dismissed in bounded batches with a shared
   incident reference.
4. Identify the rule, DID, feed, owner normalization, or parser defect.
5. Add a regression fixture, replay a bounded sample, and require human review
   before re-enabling.

### Provider disconnect, quota, or spend incident

1. Show Degraded/Manual only; never display a false Live state.
2. Stop reconnect loops on authentication/approval failures. Back off on 429/5xx
   according to provider instructions.
3. Check cursor age and prepaid spend without logging credentials.
4. Use the five-minute Railway reconciliation job only for bounded recovery.
5. Re-enable after gap analysis and idempotent replay proof.

### Suspected credential exposure

1. Disable the connector and rotate/revoke the credential at the provider.
2. Rotate Railway variables without printing the replacement.
3. Audit provider usage, application logs, and repository history.
4. Purge captured secret material and preserve a redacted incident record.
5. Re-enable only after least-privilege and no-leak tests pass.

### Database/SSE integrity incident

1. Set `BBSPORTS_REALTIME_NEWSROOM_ENABLED=false`.
2. Keep the admin desk read-only/manual as safely possible and label it Degraded.
3. Compare activity sequence, snapshots, worker checkpoint, and database rows.
4. Repair from Postgres truth; never reconstruct verification from browser events.
5. Run duplicate, gap, transition, auth, and revocation tests before restoring
   automated alerting.

## Correction and retraction runbook

1. Reopen the signal to `investigating`; flag the contradictory/retraction event.
2. Capture the changed/deleted source and timestamps without retaining prohibited
   body content.
3. Notify Brad with the exact published claims at risk.
4. If materially false, update or unpublish promptly; do not wait for a prettier
   rewrite.
5. Add a visible correction note stating what changed and when. Do not silently
   replace the headline, lede, quote, score, or identity.
6. Update social posts/newsletter corrections through their separately approved
   workflows. Never auto-post the correction.
7. Update structured data, RSS, sitemap, caches, and search indexes.
8. Append the final review rationale and prevention action. Preserve the public
   corrections log.

## Activation checklist

- [ ] Provider posture is GREEN for the exact commercial use and was re-reviewed
      after 2026-07-15.
- [ ] Brad and Brandon approve the provider account, intended use, monthly spend
      ceiling, and kill-switch owner.
- [ ] Connector-specific environment gates are set only in Railway and remain
      false in unapproved environments.
- [ ] Curated accounts/DIDs/feeds and normalized owner keys are reviewed.
- [ ] Edits, deletes, takedowns, cursor replay, duplicate delivery, rate limits,
      and provider outage tests pass.
- [ ] SSRF, XML entity, decompression, redirect, timeout, and credential-leak
      tests pass for fetch-based connectors.
- [ ] The worker and web service deploy the same commit and schema-compatible
      release.
- [ ] Protected SSE auth, active-session revocation, heartbeat, reconnect,
      sequence resume, and 5-second polling fallback pass.
- [ ] No connector code path can create a publish approval or call publish/social
      mutations.
- [ ] Manual-only and fully degraded states are honest, usable, and tested.
- [ ] Brad completes a live rehearsal: lead → evidence → contradiction → verify →
      draft → approve → publish → correction.

## Official references

Provider facts and terms below were checked on 2026-07-15 and must be rechecked
before activation:

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
