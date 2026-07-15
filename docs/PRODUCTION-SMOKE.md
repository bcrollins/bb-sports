# BB Sports Production Smoke Gate

Built: 2026-05-08 · Updated: 2026-07-15

## Purpose

Every shipped interval needs a repeatable live check. `npm run smoke:production` verifies the production Railway app, soft-launch gate, public surfaces, and write-path guards from outside the process.

## Command

```sh
EXPECTED_COMMIT=$(git rev-parse HEAD) \
BB_PRODUCTION_GATE_PASSWORD=… \
PRODUCTION_BASE_URL=https://bbsports.fans \
npm run smoke:production
```

Optional controls:

- `PRODUCTION_BASE_URL` (default may still reference Railway hostname)
- `EXPECTED_COMMIT=<git-sha>` — full or short SHA match against health release
- `BB_PRODUCTION_GATE_PASSWORD` (preferred; obtains signed `bb_gate` cookie)
- `BB_PRODUCTION_GATE_COOKIE` (optional pre-issued cookie)
- `BB_SMOKE_SEARCH_QUERY`, `BB_SMOKE_REQUIRED_TEXT`, `BB_SMOKE_ARTICLE_SLUG`, `BB_SMOKE_ARTICLE_TITLE`
- `BB_SMOKE_IP` for validation-guard rate-limit isolation

## Checks (33)

1. Health combined (`/api/health`) + commit pin
2. Health live (`/api/health/live`)
3. Health ready (`/api/health/ready`)
4. Public `/status` page
5. Soft-launch `robots.txt` disallow all
6. Soft-launch RSS empty of items
7. Article OG card PNG (`/api/og/article`)
8. Soft-launch gate redirect (307)
9. Signed access-wall credential
10. Live-newsroom auth boundary (401 / login redirect)
11. Gated search page
12. Search API JSON
13. Article page render
14. Comments read path
15. Sitemap editorial URLs (empty under soft launch)
16. Teams encyclopedia API
17. Teams encyclopedia pages
18. Donation readiness contract
19. Stripe webhook contract
20. Newsletter welcome contract
21–25. Validation guards (newsletter, contact, donation, comment, analytics)
26. Analytics contract GET
27. Analytics write path
28. Reading list page
29. Podcast honesty (no fake player)
30. Videos honesty (no fake clips)
31. Support surface
32. Status page honesty (live scores not enabled)
33. Admin canaries auth boundary (401 without newsroom session)

## Related

- `docs/operations/COMMERCIAL-CANARIES.md` — live Resend/Stripe/R2 proofs
- `npm run canaries:dry` — local fail-closed provider matrix
