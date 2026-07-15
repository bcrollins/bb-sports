# BB Sports — one-person newsroom handbook

Version: 1.0 · Owner: Brad Benson (editorial) / Brandon (ops)  
Last updated: 2026-07-15

## Daily desk (Brad)

1. Open `/admin` (newsroom sign-in).
2. **Catalog** — freshness advisory; never auto-rewrites prose.
3. **Findings** — fact-check checklist (advisory) before publish.
4. **Articles** — edit draft → save → **publish only** with phrase + super-admin role.
5. **Comments** — moderate; confidential tips stay redacted for non-super-admin.
6. **Audience** — aggregates only; no raw IP/UA.
7. Public check: soft-launch wall still on until `BBSPORTS_PUBLIC_LAUNCH=true`.

## Breaking / real-time desk

- Live Desk is protected and **never auto-publishes**.
- Connectors stay dark without commercial approval + credentials + canary.
- If unsure: pause providers, leave reader site on last good publish.

## Publish / rollback

| Action | How |
|--------|-----|
| Publish | Admin article publish transaction + exact revision hash |
| Unpublish | Admin unpublish (immutable snapshot retained) |
| Code rollback | `docs/operations/ROLLBACK.md` + Railway redeploy prior deploy |
| Live verify | `EXPECTED_COMMIT=<sha> npm run smoke:production` |

## Corrections

- Log on `/admin/findings`; public surface `/corrections` when status allows.
- Never silent rewrite of published history without correction note.

## Tips & contact

- Inbox: contact ledger; reader gets **public receipt ID** only.
- Confidential tips redacted for non-super-admin in audience views.

## Newsletter & donations

- Newsletter: first-party list; Resend off until approved.
- Support: **interest only** until Stripe mode is live; paid only after webhook.

## Provider RED/GREEN

See `lib/provider-registry.ts` and `docs/legal/PROVIDER-POSTURE.md`.  
RED/pending commercial right ⇒ adapter must not transport.

## Incidents

1. Confirm blast radius (public vs admin).
2. Kill switch env unset / feature off.
3. Rollback runbook if bad deploy.
4. Preserve audit logs; no secret paste into tickets.

## Backup / restore

`docs/operations/BACKUP-RESTORE.md` — clone-first, never restore over live without drill evidence.

## Launch mode

| Soft launch | Public |
|-------------|--------|
| Wall on | Wall off when Brad approves |
| robots disallow all | crawl-policy public |
| RSS empty items | RSS full catalog |
| Donations interest | Stripe when verified |

## Stop / escalate conditions

- Unlicensed scores or scrape paths.
- Auto-publish of AI or newsroom drafts.
- Payment success without webhook ledger.
- Secret values in git or screenshots.
