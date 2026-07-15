# Session handoff — 2026-07-15 (ESPN-path continuation)

## Production truth (verify live)

```bash
curl -sS https://bbsports.fans/api/health
curl -sS https://bbsports.fans/api/health/live
curl -sS https://bbsports.fans/api/health/ready
```

| Item | Value |
| --- | --- |
| Repo | `/Users/brandonrollins/Code/bb-sports-production` |
| Production | https://bbsports.fans |
| Gate password | `calebwilliamsmvp` |
| Top-100 ledger | `docs/operations/top100/TOP100-2026-07-15-bb-sports-value-engine.md` |

### Shipped this arc (newest last)

| PR | What |
| --- | --- |
| #81–#85 | People 130, CSP/HSTS, Desk rail, newsletter GET-safe, handoff |
| #86 | Durable auth rate limits + rankings editorial copy |
| #87 | Masthead Fan desk (no LIVE) |
| #88 | Health live/ready, /status, scores fail-closed, catalog reconcile |
| #89 | Rankings methodology, WebSite JSON-LD, /privacy, /terms |

### Smoke

Expect **24/24** after #88 (added live, ready, status checks).

```bash
BB_PRODUCTION_GATE_PASSWORD='calebwilliamsmvp' npm run smoke:production -- \
  --base-url https://bbsports.fans --expected-commit "$(curl -sS https://bbsports.fans/api/health | python3 -c 'import sys,json;print(json.load(sys.stdin)["commit"])')"
```

## Next priorities (Top-100)

1. #6 — Brad-approved catalog import for filesystem-only articles  
2. #11 — CSRF/origin wrapper across mutations  
3. #14–#15 — sources + corrections workflow  
4. #25 — cookies/DMCA/community policy pages  
5. #58 — Article JSON-LD completeness  
6. Do **not** enable live scores or newsroom transports without commercial approval  

## Non-negotiables

- External signals never auto-publish  
- Null/FLAGGED > inventing stats  
- No proprietary box-score scrapes  
- Ship: check → PR → merge → Railway SHA → smoke  
