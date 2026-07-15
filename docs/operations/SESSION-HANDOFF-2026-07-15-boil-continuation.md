# Session handoff — 2026-07-15 BOIL continuation

## Live gold
- **Commit:** `cf40fec` (matches `main` tip at handoff)
- **Smoke:** **31/31** production smoke on https://bbsports.fans
- **OG:** PNG 1200×630 OK
- **Soft launch:** robots Disallow all, RSS empty, publicLaunch false
- **Gate:** calebwilliamsmvp (signed cookie)

## Shipped this wave (PRs)
- #130 favorites (#84)
- #131 reading list + share (#88/#89)
- #132 media honesty + nav personalize (#86/#87/#91/#92/#95)
- #133 contact receipt + support truth (#93/#94)
- #134 ops governance SBOM/providers/handbook (#76/#96–#100)
- #135 Stripe reconcile/provenance/media rights/watchlist (#38/#39/#42/#43/#85)
- #136 image/alerts/calendar/smoke (#51/#75/#80/#82/#90)
- #137 **critical** client-safe sports imports (unblocked Railway after #130 build break)

## Ledger
~93 Complete / 3 In progress / 4 Pending commercial or heavy:
- #5 newsroom desk (in progress, connectors dark)
- #20 versioned migrations
- #34 Resend live canary
- #37 Stripe live canary
- #40 publish phrase extensions (in progress)
- #45 R2 canary (fail-closed module ready)
- #47 revision UI (in progress)

## Do not
- Auto-publish
- Unlicensed live scores
- Mark commercial items Complete without canary evidence
