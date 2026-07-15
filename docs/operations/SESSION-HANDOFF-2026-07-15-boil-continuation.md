# Session handoff — 2026-07-15 BOIL continuation (wave 2)

## Live gold (verified)
- Prior tip `f355965`: **31/31** smoke
- Main tip advancing through PRs #139–#141 (publish checklist, type fixes, canary harness)
- Soft launch: wall on, robots disallow, publicLaunch false

## Shipped this wave
| PR | Value |
|----|--------|
| #139 | Publish fact-check attestation + revision history panel + versioned migrations |
| #140 | Type fixes for checklist + DB verifier |
| #141 | Provider dry-run canary harness |

## Ledger remaining (commercial / newsroom)
- **#5** Live desk — connectors dark; manual desk works; commercial connectors pending
- **#34** Resend live canary (dry harness pass; needs BBSPORTS_APPROVED_RESEND + domain)
- **#37** Stripe live canary (dry harness pass; needs live account proof)
- **#45** R2 transport canary (fail-closed + dry harness; transport not activated)

## Do not
- Auto-publish
- Mark commercial Complete without live canary evidence
- Edit applied migration SQL files
