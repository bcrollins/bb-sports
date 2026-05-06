# BB Sports

> **Sports from the fan's view. No bullshit.**
>
> Opinion-led NFL, NHL, college football, soccer, NBA, and MMA — written like a fan, sourced like a reporter. Founded and edited by **Brad Benson** (University of Florida journalism &amp; sports media, class of 2027).

A production-ready Next.js 14 site for Brad Benson's personal sports-media brand, built to broadcast-network polish (ESPN / Sky Sports / Fox Sports caliber) on a one-person operation.

| | |
|---|---|
| **Live** | <https://web-production-c65d6.up.railway.app> |
| **Repo** | <https://github.com/bcrollins/bb-sports> |
| **Health** | <https://web-production-c65d6.up.railway.app/api/health> |
| **Sitemap** | <https://web-production-c65d6.up.railway.app/sitemap.xml> |
| **Hosting** | Railway · project `bb-sports` (auto-deploys on push to `main`) |

---

## Stack

| Layer | Tech |
|---|---|
| Framework | Next.js 14 (App Router, RSC) |
| Language | TypeScript (strict) |
| Styling | Tailwind CSS, custom broadcast type system (Anton + Inter + Playfair Display + Source Serif Pro) |
| Content | Markdown via `gray-matter` + `remark` |
| Hosting | Railway (Docker, standalone Next output) |
| Email | Resend (queued for v1.1) |
| Payments | Stripe (donations only — no paywalled articles, ever) |
| Storage | Cloudflare R2 (queued for v1.1) |
| AI | xAI Grok (queued for v1.1 — drafting, transcription, counterpoint sidebar) |

## Pages shipped at v1

```
/                       Landing — hero, latest 4 takes, mission slab, newsletter, trust strip
/articles               Archive — search + filter by sport
/articles/[slug]        Article detail — broadcast slug, body, share, comments stub, related
/about                  Brad's bio
/podcast                Audio show — coming-soon
/videos                 Vertical clips grid + live reactions — coming-soon
/contact                General + tip + press + sponsorship form
/editorial-standards    Public editorial standards
/corrections            Public corrections log
/coming-soon            Pre-launch landing with email capture
/admin                  Internal dashboard stub (auth-gated in v1.1)
/api/health             Health probe (Railway healthcheck)
/api/newsletter         Email capture endpoint (rate-limited)
/api/contact            Tips / general contact endpoint (rate-limited)
/api/donations          Stripe payment-link proxy (stub until donations open)
/sitemap.xml            Auto-generated
/robots.txt             Disallows /admin and /api
```

## Brand system

- **Mark:** square BB monogram bug — Anton italic, navy-on-bone (or red bug for accent).
- **Wordmark:** "BB SPORTS" set in Anton italic, all caps, with a horizontal red rule under — same grammar as ESPN's red bar under the shield, Sky Sports' condensed italic.
- **Sport tag system:** every sport gets a broadcast bug (NFL navy, NHL deep navy with sky-blue accent, CFB orange, Soccer green, NBA red, MMA black).
- **Type:** Anton + Oswald for display headlines, Playfair Display for editorial serif, Inter for UI, Source Serif Pro for body copy, JetBrains Mono for stats.
- **Color tokens:** navy `#0A1F44`, navy deep `#06122A`, breaking red `#D7263D`, bone `#F5F2EC`, charcoal `#1A1A1A`.

See `/docs/00-BRADLEY-STRATEGY-BRIEF.md` for the full strategy synthesis from Brad's voice memos and `/docs/BB-SPORTS-PERFECTION-ENGINE-v1.0.md` for the master operating directive.

## House rules

1. **Bias is disclosed, not hidden.** Brad's teams (Bears · Panthers · Manchester United · Florida Gators · Bulls · Cubs) are listed in his bio and re-disclosed on any column where they're material.
2. **Sources are cited inline.** Stats link, quotes attribute, eyeball estimates are flagged.
3. **AI is labeled.** Anything AI touched carries the "AI · Brad-edited" badge. AI never publishes without Brad's approval click. AI never mimics Brad's voice.
4. **Corrections are public.** Logged on `/corrections` with date, article, what changed.
5. **No paywalls. No gambling promotion. No fabricated quotes. No silent edits.**

## Local development

```bash
npm install
npm run dev          # http://localhost:3000
npm run build        # production build (standalone output)
npm run start        # run the built app
npm run typecheck    # tsc --noEmit
```

Copy `.env.example` to `.env.local` for local environment.

## Deployment

Railway picks up `Dockerfile` + `railway.json`. Multi-stage Docker build → Next.js standalone server → healthcheck on `/api/health`. Push to `main` triggers a deploy.

## Repository structure

```
.
├── app/                       Next.js App Router routes
│   ├── api/                   Route handlers (newsletter, contact, donations, health)
│   ├── articles/              Archive + dynamic [slug] detail
│   ├── about/                 Bio
│   ├── podcast/               Coming-soon
│   ├── videos/                Coming-soon
│   ├── contact/               Contact + tips form
│   ├── editorial-standards/   Public standards
│   ├── corrections/           Public log
│   ├── coming-soon/           Pre-launch capture
│   ├── admin/                 Internal dashboard stub
│   ├── icon.svg               Mark
│   ├── layout.tsx             Root + metadata + JSON-LD org
│   ├── page.tsx               Home
│   ├── error.tsx              Error boundary
│   ├── not-found.tsx          404
│   ├── robots.ts              robots.txt
│   ├── sitemap.ts             sitemap.xml
│   └── globals.css            Tokens + components + article-body styles
├── components/                Reusable UI (Logo, header, footer, cards, breaking bar, sport tags, newsletter)
├── content/articles/          Anchor articles in Markdown w/ frontmatter
├── docs/                      Strategy brief + Perfection Engine prompt
├── lib/                       Article loader, breaking-news data, sport meta
├── public/                    Static assets (og, favicons, hero illustrations)
├── transcripts/               Brad's original voice-memo transcripts (the raw source of truth)
├── Dockerfile                 Multi-stage production image
├── railway.json               Railway build/deploy config
├── tailwind.config.ts         Brand tokens
├── tsconfig.json              Strict TS
├── next.config.mjs            Standalone output, security headers
└── package.json               Deps + scripts
```

## Roadmap (post-v1)

| Phase | Ship |
|---|---|
| **v1.1 (within 30 days post-launch)** | Real auth on `/admin`, AI draft pipeline (xAI Grok) with approval gate, Postgres-backed CMS migration, comment moderation, donation ledger, newsletter via Resend, photo headshot replacing placeholder. |
| **v1.2** | Live scores feed (commercial-licensed), share-to-X auto-post on publish, podcast feed + first episode, vertical-clip ingestion. |
| **v2.0** | Reader referral / leaderboard, sponsorship intake portal, internal analytics dashboard, custom recommendation feed. |

---

Built for Brad by Brandon Rollins (engineer/operator). 2026.
