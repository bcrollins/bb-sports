# Commercial provider canaries

Owner: Brandon (ops) · Editorial: Brad  
Last updated: 2026-07-15

Dry-run harness (always safe):

```bash
# In app (super-admin session cookie)
curl -sS -H "Cookie: bb_session=…" https://bbsports.fans/api/admin/canaries | jq .

# Or unit-level dry runs
node -e "import('./lib/provider-canary.ts').then(m=>m.runAllProviderCanaries({}).then(console.log))"
```

Fail-closed is **success**. Live canaries below require Brad/ops approval and must never run unattended.

---

## #34 Resend welcome canary

**Preconditions**

1. `BBSPORTS_APPROVED_RESEND=true`
2. `RESEND_API_KEY` + `RESEND_FROM` (verified domain)
3. DNS: SPF, DKIM, DMARC for the from-domain
4. Sandbox recipient under Brad’s control

**Steps**

1. Confirm dry canary reports config ready or fail-closed intentionally.
2. Create a test subscriber OR use one existing with `welcome_sent_at` null.
3. Trigger welcome path once (admin/tooling) with **one** address.
4. Verify:
   - Exactly one Resend message ID stored
   - Message headers include `List-Unsubscribe` + One-Click
   - Unsubscribe link works without login
5. Re-trigger same recipient → **no second send** (idempotent)
6. Disable: unset `BBSPORTS_APPROVED_RESEND` → sends nothing

**Pass criteria:** approved canary delivers once; duplicates no-op; disabled config sends nothing.

---

## #37 Stripe donation canary

**Preconditions**

1. Stripe test mode first: `STRIPE_SECRET_KEY=sk_test_…`, `STRIPE_WEBHOOK_SECRET=whsec_…`
2. Webhook endpoint `https://bbsports.fans/api/stripe/webhook` registered
3. Support page terms reviewed

**Steps**

1. Dry canary: mode `checkout` or `payment_link` vs `disabled`.
2. Submit support form with **test card** → one Checkout session.
3. Complete payment → webhook marks ledger `paid` with exact amount/currency.
4. Replay webhook delivery → **idempotent** (no double paid).
5. Refund in Stripe Dashboard → ledger net updates (`refunded` / `partially_refunded`).
6. Unset secrets → form interest-only, no charge.

**Pass criteria:** one paid row per successful Checkout; never paid without verified webhook; refunds correct.

Live mode only after test-mode pass and Brad approval.

---

## #45 R2 media canary

**Preconditions**

1. `BBSPORTS_APPROVED_R2=true`
2. `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME`
3. Bucket private; least-privilege IAM; lifecycle rules drafted

**Steps**

1. Dry canary: uploads fail closed without approval/transport.
2. After transport is wired (not only config ready): upload a canary object by digest.
3. Fetch public/transformed URL only via approved delivery path.
4. Delete canary object; confirm gone.
5. Unauthorized key → list/write fails.
6. Unset `BBSPORTS_APPROVED_R2` → no uploads.

**Pass criteria:** disabled mode uploads nothing; approved canary round-trips by digest; delete works.

---

## Kill switches (all providers)

| Provider | Kill |
|----------|------|
| Resend | unset `BBSPORTS_APPROVED_RESEND` or `RESEND_API_KEY` |
| Stripe | unset secrets / `BBSPORTS_APPROVED_STRIPE` |
| R2 | unset `BBSPORTS_APPROVED_R2` |
| Live scores | unset `BBSPORTS_APPROVED_LIVE_SCORES` |
| Newsroom connectors | leave `config_enabled=false` / commercial not approved |

## Evidence to store (no secrets)

- Date, operator, canary id
- Provider message/session/object ids (not keys)
- Pass/fail checklist
- Commit SHA of the build under test
