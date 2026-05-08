# BB Sports Provider Posture

Updated: 2026-05-07

BB Sports is a commercial media property. Production providers must be authorized for commercial use, and any non-green provider must fail closed or degrade gracefully.

| Provider / dependency | Use | Status | Notes |
| --- | --- | --- | --- |
| Railway | Hosting | GREEN | Production app runs on Railway. |
| PostgreSQL | Internal CMS, admin, ledgers | GREEN when `DATABASE_URL` is configured | Filesystem fallback is allowed only for local/pre-DB development. |
| Stripe | Donations | YELLOW | Payment link is optional. Donation intent is stored first-party until Stripe is configured. |
| Resend | Email transport | YELLOW | Newsletter ledger works without transport. Welcome/send flows stay disabled until domain/API are configured. |
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
