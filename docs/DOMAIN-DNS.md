# BB Sports Domain DNS

Updated: 2026-05-07

Railway project: `bb-sports`
Railway service: `web`
Railway environment: `production`
Domain: `bbsports.fans`

## Current Status

Railway has both custom domains attached:

- `bbsports.fans`
- `www.bbsports.fans`

Railway status is still `verified: false` for both domains because Namecheap DNS currently points to Namecheap parking/forwarding instead of Railway.

Observed current DNS on 2026-05-07:

- `bbsports.fans` A -> `162.255.119.205`
- `bbsports.fans` CNAME/forwarding target -> `parkingpage.namecheap.com`
- `www.bbsports.fans` CNAME -> `parkingpage.namecheap.com`
- `www.bbsports.fans` A -> `91.195.240.19`

## Required Namecheap Records

Remove conflicting `A`, `AAAA`, `CNAME`, and URL Redirect records for the same host before adding these.

| Purpose | Namecheap type | Host | Value | TTL |
| --- | --- | --- | --- | --- |
| Apex traffic route | ALIAS | `@` | `u3h1fy50.up.railway.app` | Automatic or 5 min |
| Apex Railway ownership verification | TXT | `_railway-verify` | `railway-verify=743f1b6640ad5efac5d5ce6b51ea62823be367c55bdc14e8020ed5c65400af3f` | Automatic |
| WWW traffic route | CNAME | `www` | `85zv15tu.up.railway.app` | Automatic |
| WWW Railway ownership verification | TXT | `_railway-verify.www` | `railway-verify=d262c4b426bc7ff72a18f8e8baa7ef3a587c3c5c12f6aae23918ae3cdeca2abc` | Automatic |

Railway reports the apex traffic route as a CNAME-style target, but Namecheap uses `ALIAS` for the root host because a normal CNAME at `@` is not valid on the zone apex.

## Post-Change Verification

Run these after Namecheap saves the records and propagation starts:

```sh
dig +short bbsports.fans CNAME
dig +short bbsports.fans TXT
dig +short www.bbsports.fans CNAME
dig +short _railway-verify.bbsports.fans TXT
dig +short _railway-verify.www.bbsports.fans TXT
curl -I https://bbsports.fans/api/health
curl -I https://www.bbsports.fans/api/health
```

Expected result: Railway marks both domains verified, certificates issue, and `/api/health` returns `200`.
