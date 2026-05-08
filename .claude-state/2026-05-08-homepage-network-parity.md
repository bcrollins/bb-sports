# 2026-05-08 Homepage Network Parity + Support Slice

Status: code complete locally on `codex/bb-sports-front-page-parity`; tests and browser screenshots pass locally. Deployment remains pending until the branch is pushed/merged and Railway auto-deploys the resulting `main` commit.

## Shipped Locally

- Rebuilt `/` into a content-first sports network front page: lead story, top headlines, two-tap desk, game-board coverage lanes, latest articles, league desks, watch/listen routes, newsletter, and support CTA.
- Added `/support` as a named reader-support home backed by the existing `/api/donations` first-party donation intent route.
- Added `/support/terms` and `docs/legal/DONATIONS-REFUND-POLICY.md` for public donation/refund/editorial-independence terms.
- Added `lib/homepage.ts` for front-page story/league/provider assembly and `lib/support.ts` for client-safe support amount constants.
- Added tests for story ordering, sport rail preservation, live-score fail-closed posture, no bucket navigation, and support amount bounds.
- Added `docs/HOMEPAGE-NETWORK-PARITY.md` as the preservation affidavit and provider-boundary record.
- Updated provider posture to mark live scores RED until commercial terms are stored and `BBSPORTS_APPROVED_LIVE_SCORES=true` is configured.
- Updated the sitemap, header, footer, README, and homepage hero asset so Support and Tips are named homes with no hamburger/More/Other bucket.

## Verified Locally

- `npm run check`: lint, typecheck, 14 node tests, and production build pass.
- Local health: `GET /api/health` returned `status=ok`, `commit=local`, DB unconfigured and filesystem fallback healthy.
- Local support terms: `GET /support/terms` returned 200 behind `bb_gate=1`.
- Donation guard: `POST /api/donations` without email returned 503 with "Donations open with the public launch..." before Stripe/DB writes.
- Rendered via temporary gate-injecting proxy at `http://127.0.0.1:3010` because the in-app Browser pane was unavailable.
- Chrome screenshots captured:
  - `/tmp/bb-home-375g.png` at 375x667
  - `/tmp/bb-home-393d.png` at 393x852
  - `/tmp/bb-home-440e.png` at 440x956
  - `/tmp/bb-home-820e.png` at 820x1180
  - `/tmp/bb-home-1440e.png` at 1440x1000
  - `/tmp/bb-home-1920e.png` at 1920x1080
  - `/tmp/bb-support-393e.png` at 393x852
- Browser artifact caveat: Chrome headless emitted GPU/updater noise unrelated to the app; screenshots and DOM showed the pages rendered, not a framework error overlay.

## Provider Posture

- Live scores are not implemented and not rendered.
- The homepage game-board surface is editorial coverage only until a commercial live-score provider is approved.
- Stripe checkout remains gated by `STRIPE_DONATION_LINK`; support interest uses the first-party donation intent ledger when DB is configured.

## Resume Pointer

Next: push `codex/bb-sports-front-page-parity`, merge to `main`, wait for Railway to serve the new commit on `https://web-production-c65d6.up.railway.app/api/health`, then repeat live gate checks and public screenshots.
