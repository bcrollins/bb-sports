# BB Sports Provider Posture

Updated: 2026-05-08

BB Sports is a commercial media property. Production providers must be authorized for commercial use, and any non-green provider must fail closed or degrade gracefully.

| Provider / dependency | Use | Status | Notes |
| --- | --- | --- | --- |
| Railway | Hosting | GREEN | Production app runs on Railway. |
| Production smoke gate | Live deploy verification | GREEN | First-party script checks Railway health, gated search, and analytics. No external provider added. |
| PostgreSQL | Internal CMS, admin, ledgers | GREEN when `DATABASE_URL` is configured | Filesystem fallback is allowed only for local/pre-DB development. |
| First-party analytics | Page/article/search/conversion events | GREEN when `DATABASE_URL` is configured | Internal `analytics_events` ledger. No external behavior-tracking provider required. |
| First-party comments | Article discussion and moderation | GREEN when `DATABASE_URL` is configured | No external comment provider. Public UI renders approved records only. |
| Stripe | Donations | YELLOW | Payment link is optional. Donation intent is stored first-party until Stripe is configured. |
| Resend | Email transport | YELLOW | Newsletter ledger and unsubscribe suppression work without transport. Welcome/send flows stay disabled until domain/API are configured. |
| Cloudflare R2 | Object storage | YELLOW | No production upload dependency yet. Hero image URLs require alt text and credit. |
| xAI Grok | AI assistance and generated media | YELLOW | Admin media routes are built but fail closed unless `XAI_API_KEY` and `BBSPORTS_APPROVED_XAI=true` are configured. Any AI draft/media must stay approval-gated and labeled. |
| Live scores provider | Scores / standings | RED | Homepage renders editorial coverage lanes only. Do not render live scores until commercial terms are stored and `BBSPORTS_APPROVED_LIVE_SCORES=true` is configured. |
| Google Fonts via `next/font` | Font source | GREEN | Fonts are self-hosted by Next at build/runtime, not loaded from a browser CDN. |
| Lucide React | Admin icons | GREEN | ISC license. |
| Zod | API validation | GREEN | MIT license. |
| Drizzle ORM | DB query layer | GREEN | Upgraded to patched 0.45.x line for SQL identifier advisory. |
| Drizzle Kit | Local DB tooling | YELLOW | npm audit still reports moderate esbuild-related dev-tool advisories. Not shipped in Docker runtime. |
| Next.js | App framework | WATCH | Upgraded to 15.5.15 to remove high advisories. npm audit still reports a moderate nested PostCSS advisory through Next. |

## Hard Blocks Before Public Launch

- Confirm Stripe account/tenant and publish refund/donation terms on the donation surface.
- Confirm Resend sending domain and unsubscribe/suppression behavior.
- Document any non-BB article photo source before use.
- Keep live score feeds disabled until a commercial license is signed and stored here.
