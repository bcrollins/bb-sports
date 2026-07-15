# Session handoff — 2026-07-15 BOIL (wave 3)

## Live gold
- Tip ships through **#147** (watchlist + canary runbook)
- Prior verified: **33/33** smoke on `84ab135` / `0560ed9` path
- Soft launch: wall on, robots disallow, scores not enabled

## Remaining Top-100 (only commercial / connector live proof)
| # | Item | Blocker |
|---|------|---------|
| 5 | Real-time desk connectors | Paid X/Bluesky/RSS transport + live fixture canary |
| 34 | Resend welcome | Live approved canary (runbook ready) |
| 37 | Stripe donations | Live e2e payment canary (runbook ready) |
| 45 | R2 storage | Live digest round-trip (transport not activated) |

## Operator tools
- `npm run canaries:dry`
- `GET /api/admin/canaries` (super-admin)
- `/admin/launch` dry-run panel
- `docs/operations/COMMERCIAL-CANARIES.md`

## Do not
- Auto-publish
- Mark #34/#37/#45 Complete without live canary evidence
- Enable live scores without commercial license
