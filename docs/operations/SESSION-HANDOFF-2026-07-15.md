# Session handoff — 2026-07-15 (continued)

## Live

```bash
curl -sS https://bbsports.fans/api/health
curl -sS https://bbsports.fans/api/health/ready
BB_PRODUCTION_GATE_PASSWORD='calebwilliamsmvp' npm run smoke:production -- \
  --base-url https://bbsports.fans --expected-commit "$(curl -sS https://bbsports.fans/api/health | python3 -c 'import sys,json;print(json.load(sys.stdin)["commit"])')"
```

Gate password: `calebwilliamsmvp`  
Repo: `/Users/brandonrollins/Code/bb-sports-production`  
Ledger: `docs/operations/top100/TOP100-2026-07-15-bb-sports-value-engine.md`

## Shipped (#86–#93)

| PR | Summary |
| --- | --- |
| #86–#91 | Rate limits, Fan desk, health/status, rankings methodology, privacy/terms, Article JSON-LD |
| #92 | Mutation origin guard, canonical 308, /cookies /dmca /community |
| #93 | Publish source gate, findings queue, env readiness, confidential tip redaction |

## Next

1. #6 Brad-approved draft import for filesystem-only articles  
2. #5/#40 remaining newsroom/provider commercial gates (keep dark)  
3. #32 comment abuse durable controls  
4. #28 admin audit events  
5. #36 soft-launch acquisition boundary decision  

## Non-negotiables

- No auto-publish · No unlicensed scores · Ship intervals · Smoke after each deploy  
