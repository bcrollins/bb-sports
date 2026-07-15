# Secret rotation & least-privilege recovery

Owner: Brandon (ops)  
Last drill: pending (document date when run)  
Last updated: 2026-07-15

## Inventory (no values)

| Secret | Scope | Min length | Dependents | Rotation style |
|--------|-------|------------|------------|----------------|
| `GATE_SECRET` / wall password | Soft-launch wall | durable phrase | `/coming-soon`, middleware | Immediate revoke on compromise |
| `ADMIN_JWT_SECRET` | Admin sessions | ≥32 | admin cookies/sessions | Dual-key only if code supports; else redeploy cutover |
| `ANALYTICS_HASH_SALT` | Analytics digests | ≥16, ≠ JWT | `/api/analytics` | Dual-window optional; accept write downtime |
| `DATABASE_URL` | Postgres | n/a | all durable state | Railway credential rotate + app redeploy |
| `STRIPE_SECRET_KEY` / webhook | Donations | n/a | checkout + webhook | Stripe dashboard rotate; update Railway; replay-safe |
| `RESEND_API_KEY` | Email | n/a | newsletter | Provider rotate; kill switch = unset |
| `XAI_API_KEY` | Media assist | n/a | media studio | Unset kills generation |
| Provider connectors | Newsroom | n/a | worker | Kill switches stay default off |

## Safe sequence (production)

1. Snapshot Railway env var names (not values) + current `/api/health` commit.
2. Rotate **one** secret at a time.
3. Update Railway env → redeploy → wait for health `commit` + `db.reachable`.
4. Smoke: `EXPECTED_COMMIT=<sha> npm run smoke:production`.
5. Prove old credential fails (gate cookie, revoked JWT, old webhook signature).
6. Record drill: who, which secret class, duration, incidents.

## Compromise

- Issue a **new** secret; never restore a compromised value.
- Revoke sessions (`/admin/account/sessions` + JWT secret cutover).
- If `ANALYTICS_HASH_SALT` leaked: rotate; accept historical digest non-joinability.
- If DB credential leaked: rotate role password, audit connections, review `admin_audit_events`.

## Verification without leaking values

- Health endpoints never echo secrets.
- `productionEnvPublicDto` only reports presence/missing flags.
- Rotation evidence stores fingerprints (last 4 of key id / key version) only if provider supplies them — never raw secrets in git, PRs, or chat.
