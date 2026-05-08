# BB Sports Domain DNS

Updated: 2026-05-08

Railway project: `bb-sports`
Railway service: `web`
Railway environment: `production`
Domain: `bbsports.fans`
Registrar: Namecheap (BasicDNS, NS `dns1.registrar-servers.com` / `dns2.registrar-servers.com`)
Registration: 2026-05-06 → 2027-05-06

## Current state (2026-05-08 cutover)

| Host | Type  | Value                                                     | TTL  | Status |
|------|-------|-----------------------------------------------------------|------|--------|
| `@`   | CNAME | `u3h1fy50.up.railway.app`                                 | Auto | LIVE — DNS propagated globally (Cloudflare 1.1.1.1, Google 8.8.8.8 confirm) |
| `www` | CNAME | `85zv15tu.up.railway.app`                                 | 30m  | LIVE   |
| `@`   | TXT   | `v=spf1 include:spf.efwd.registrar-servers.com ~all`      | Auto | Namecheap default forwarding SPF — to be replaced when Resend sending domain ships |

### Removed at cutover
- A `162.255.119.205` (Namecheap parking) on `@`
- CNAME `parkingpage.namecheap.com.` on `www`
- URL Redirect Record `@` → `http://www.bbsports.fans/` (Namecheap auto-redirect — created when domain was first registered)

### If Railway prompts for ownership verification

Some Railway custom-domain flows require a TXT record at `_railway-verify` to confirm ownership. The exact required value is shown in the Railway dashboard at **Project → Service `web` → Settings → Networking → bbsports.fans / www.bbsports.fans → DNS Records**. If the dashboard lists a `_railway-verify` TXT record under "REQUIRES_UPDATE", add it at Namecheap exactly as shown:

| Host                      | Type | Value (copy from Railway)                            |
|---------------------------|------|------------------------------------------------------|
| `_railway-verify`          | TXT  | `railway-verify=<unique-token-shown-by-railway>`     |
| `_railway-verify.www`      | TXT  | `railway-verify=<unique-token-shown-by-railway>`     |

These tokens are unique per (domain, project) pair and rotate when a domain is removed and re-added; do not copy historical values from older revisions of this doc.

## Verification commands

```sh
# Authoritative — should NOT show parkingpage.namecheap.com
dig +short bbsports.fans CNAME @dns1.registrar-servers.com
dig +short www.bbsports.fans CNAME @dns1.registrar-servers.com

# Public resolver
dig +short bbsports.fans @1.1.1.1
dig +short www.bbsports.fans @1.1.1.1

# Optional — only if Railway requires verification TXT
dig +short _railway-verify.bbsports.fans TXT
dig +short _railway-verify.www.bbsports.fans TXT

# HTTPS smoke (200 from /api/health once Railway issues bbsports.fans cert)
curl -sI https://bbsports.fans/api/health
curl -sI https://www.bbsports.fans/api/health

# Cert subject — should be 'bbsports.fans' (or include it in SANs), NOT '*.up.railway.app'
echo | openssl s_client -servername bbsports.fans -connect bbsports.fans:443 2>/dev/null | openssl x509 -noout -subject -ext subjectAltName
```

## Post-cutover plan

| Subdomain                | Target / Provider             | Records                                             | When                                                          |
|--------------------------|-------------------------------|-----------------------------------------------------|---------------------------------------------------------------|
| `mail.bbsports.fans`     | Resend sending domain         | DKIM `resend._domainkey`, MX, SPF (replace registrar default), DMARC | When `RESEND_API_KEY` is configured                       |
| `cdn.bbsports.fans`      | Cloudflare R2 custom domain   | CNAME → R2 public hostname                          | When R2 bucket public host is configured                      |
| `status.bbsports.fans`   | Internal status page          | CNAME → Railway service                             | Phase II of Component 21                                      |

## Operational notes

- Authoritative DNS at Namecheap can take 1–10 minutes after a UI save before the records appear at `dns1.registrar-servers.com`. The dashboard's `async-success` indicator confirms queued, not propagated.
- Railway's custom-domain verifier polls every ~60s. After DNS becomes valid, SSL provisioning via Let's Encrypt typically completes within 5–15 minutes. If after 30 minutes the served cert is still `*.up.railway.app`, manually click Verify on the domain in Railway → Service → Settings → Networking.
- **Never** restore the parking-page CNAME on `www` or the URL Redirect Record on `@` — they override Railway routing.
- **Never** add a CAA record without Let's Encrypt allowed — Railway's certs come from Let's Encrypt (`issuer=R12`).

## History

- 2026-05-06 — domain `bbsports.fans` registered at Namecheap
- 2026-05-07 — Railway custom domains `bbsports.fans` and `www.bbsports.fans` attached (DNS still parked)
- 2026-05-08 — Namecheap DNS cut over to Railway CNAMEs; parking CNAME and URL Redirect removed; production codebase canonical URL changed `bbsports.media` → `bbsports.fans`
