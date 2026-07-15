# BB Sports — Strategy Brief
**Source:** 14 voice memos from Bradley Benson (transcribed, see `/transcripts`)
**Compiled:** 2026-05-06
**Version:** v1.0
**For:** Brandon Rollins (engineer/operator) and Bradley Benson (founder)

---

## 1. Who is Bradley?

**Brad Benson** — University of Florida, class of 2027, journalism and sports media major. Born/raised Boca Raton, FL. Played hockey, soccer, ran some track in high school. No internships yet — amateur class writing only.

**Career goal (5 yr / 10 yr):** Run his own media company. Backup track: scout / front office.

**Personality on tape:** confident, opinionated, allergic to "by-the-book" journalism, comfortable swearing in the right context, fan-first, wants to be controversial on purpose. Reference voices: **Pat McAfee** (energy / say-whatever-you-want), **Adam Schefter** (breaking news authority), **Steve Goldstein** & **Kevin Burkhardt** (broadcasters who feel like they're watching with you, not at you).

---

## 2. The Brand

| Element | Decision |
|---|---|
| **Site name** | **BB Sports** (Brad considered "FanView" and "No BS" — BB Sports won; the *attitude* of "no bullshit" / "fan view" lives in the tagline and voice) |
| **Tagline** | "Sports from the fan's view. **No bullshit.**" |
| **Founder byline** | Brad Benson |
| **Aesthetic** | Classic newspaper — serif headlines, generous white space, news-grid feel — **not** sterile or corporate |
| **Primary color** | Navy `#0A1F44` |
| **Accent** | Bone/cream `#F5F2EC`, charcoal `#1A1A1A`, gray `#6B7280` |
| **Accent grey** | `#6B7280` (used sparingly — labels, CTAs, hover accents; formerly breaking-news red) |
| **Type** | Headlines: serif (Playfair Display / Source Serif). Body: Inter. Stats/scores: JetBrains Mono. |
| **Logo** | None yet. Wordmark `BB Sports` set in serif italic with a navy underline rule; favicon is a navy square with bone "BB". |
| **Vibe in three adjectives** | Free-flowing, fiery, conversational. |

---

## 3. The Voice (this is the moat)

> "I want to transition journalism into the fan view. I want it to be very detailed and specific, and I want people to be able to say whatever they want about how they're feeling in sports."

- **First-person heavy** with conversational mix.
- **Pat McAfee energy.** Take a stance. Say it like you'd say it on the couch with your buddies.
- **Controversial on purpose.** Bradley said: *"That's the whole point."*
- **Swearing allowed** when it lands — context-dependent, never gratuitous.
- **Anti-script.** Anti-"buy the book." Pro raw, fan-perspective, opinion-led writing.
- **Bias is disclosed, not hidden.** Brad's teams (Bears, Panthers, Manchester United, Gators, Bulls, Cubs) are stated up front so readers know where he's coming from.

> Brand-safe tagline guardrail: when "no bullshit" doesn't fit (e.g., investor decks, formal partnerships), substitute **"No spin. No script. Just sports."**

---

## 4. Sports Coverage (priority order from Brad)

1. **NFL**
2. **NHL**
3. **College football** (lean in early — "season coming up, easier to write about because it's always changing")
4. **Soccer**
5. **NBA**
6. **MMA**

Coverage formats Brad explicitly said yes to: **breaking news, analyst, opinion, long-form features, interviews, video, podcast, live streams / game reactions, live scores & standings.** No newsletter cadence yet — "whenever I post."

Editorial reach: solo for v1. Brad does NOT want other contributors at launch ("keep it small").

---

## 5. Pages We're Shipping (v1 = launch site)

| Page | Purpose | Priority |
|---|---|---|
| **Home** | Latest takes + featured photo of Brad in the sports world + newsletter capture + breaking-news ticker | P0 |
| **Articles** | Archive + search + filter by sport | P0 |
| **Article detail** | Long-form, comments, related (most-recent), share to socials | P0 |
| **About / Bio** | Brad's story (UF, Boca, journalism major, teams he roots for) | P0 |
| **Podcast** | Episode list (placeholder until first ep) | P1 |
| **Videos** | Vertical-clip feed (TikTok-style) + game reactions | P1 |
| **Contact / Tips** | Public contact form + secure tips form for sources | P0 |
| **Editorial Standards** | Public standards page (subsection — not main thing) | P0 |
| **Corrections** | Public log of any corrections | P0 |
| **Coming Soon (alt route)** | Pre-launch landing with email capture — toggleable | P0 |
| **Admin (auth-gated)** | Write/edit/approve drafts, schedule posts, see traffic, manage newsletter | P1 (stub at launch, real in 30 days) |

Comments are Reddit-style (open, threaded). Bradley wants a vibrant comments culture.

---

## 6. AI Layer (this is what makes BB Sports different)

Bradley spent more time on AI than any other section. The pattern is clear: **AI is the assistant, Brad is the voice.**

| AI capability | Decision |
|---|---|
| **Pull live Schefter / breaking-news headlines** | Yes — AI surfaces a breaking strip; Brad's article is the long-form take below |
| **Auto-draft articles (injury reports, power rankings, etc.)** | Yes |
| **Source signals** | Twitter/X (filter for verified + known-real accounts), give-it-a-topic mode |
| **Approval before publish** | **Yes — every AI draft must be approved by Brad** (signed off in admin) |
| **Public AI label** | Yes — clear "AI-assisted draft, edited by Brad Benson" tag on AI-touched pieces |
| **Multiple draft variants** | Yes — one cleaner, one with cursing — Brad picks |
| **Suggested social posts attached to drafts** | Yes |
| **Suggested / auto-attached images (with credit)** | Yes |
| **Length cap on AI auto-drafts** | ~300 words |
| **Voice mimic** | **No — keep AI neutral.** Brad doesn't want it sounding like him. |
| **"Bradley's Take" hook** | Yes — every AI piece has a slot at the bottom flagged for Brad's personal commentary before it ships |
| **Trending-now / follow-up suggestions** | Yes — "you missed these stories" daily digest in admin |
| **Voice memo → article draft** | Yes — Brad records, AI transcribes & drafts, Brad polishes |
| **Press conference YouTube → summary** | Yes |
| **Podcast show notes generation** | Yes |
| **Quote-graphic generation for socials** | Yes |
| **Interview question prep** | Yes |
| **Push back on Brad's opinions** | Yes — Brad explicitly wants the AI to *argue with him* in the editor (counterpoint sidebar). This is unique. |

The AI agent should be xAI Grok or comparable. **Never claim something is AI-generated when it isn't, or human-written when AI did the heavy lift.** Transparency is part of the editorial standard.

---

## 7. Bio Page — exact content from Brad

- **Display name:** Brad Benson
- **Hometown:** Boca Raton, FL
- **School:** University of Florida (graduating 2027)
- **Major:** Journalism & Sports Media
- **Teams:** Bears (NFL), Panthers (NHL), Manchester United, Florida Gators, Chicago Bulls, Chicago Cubs
- **Sports played:** Hockey, soccer, track
- **Why journalism:** "Originally going into UF I didn't know what I wanted to do — I just knew I was interested in sports. Podcasts where you could just say whatever you wanted always interested me, and when I found UF had a sports journalism program, that was instantly what I wanted to do."
- **5-year goal:** Run his own media company.
- **10-year goal:** Same. Or scout / front office.
- **Headshot:** None yet — has suit photos. **Action item:** schedule a proper headshot in the first 30 days; site uses placeholder portrait until then.

---

## 8. Social Strategy

- Has accounts on **X, Instagram, TikTok, YouTube, LinkedIn, Snapchat.**
- **Grow X most aggressively** (per Brad).
- Articles auto-post to socials on publish.
- TikTok-style short-video grid embedded on the site.
- "Follow on X" / "Subscribe on YouTube" CTAs in the header and post footer.
- **Referral system:** readers earn something for sharing — to plan in v1.1 (early-supporter badge / leaderboard).

---

## 9. Monetization Plan

| Phase | Plan |
|---|---|
| **Day 1** | Free everything. Donations tab (Stripe-powered). |
| **Year 1** | Sponsorships + display ads (tasteful, no auto-play, no popups). |
| **Year 2+** | Maybe merch. Maybe affiliate (NOT gambling promotion). Affiliate exception: jersey / gear sales. |
| **Never** | Paid premium articles. Brad: *"if people want to read what I have to say, they deserve to read what I have to say."* |
| **Entity** | No LLC yet — Brandon to advise on timing (likely after first sponsorship dollar lands). |

---

## 10. Newsletter

- **Name:** doesn't need to be different from the site — "BB Sports Newsletter" is fine.
- **Cadence:** every time Brad posts (not a fixed schedule).
- **Welcome email:** outline who Brad is, the angle ("fan view, no bullshit, opinions you won't get on ESPN") and what to expect.
- **AI drafts editions for Brad's approval** before they send.
- **Provider:** Resend (transactional + marketing) on the `bbsports` sending domain — pick the domain when registered.

---

## 11. Tech / Platform Decisions

| Question | Decision |
|---|---|
| Domain | `bbsports.fans` (registered 2026-05-06 at Namecheap; Railway custom domains live 2026-05-08). |
| Mobile-first | **Yes — non-negotiable** (Brad: "most readers will be on phones") |
| Dark mode | Not for v1. Light/newspaper as default. Add toggle later. |
| SEO | **Day 1.** Open Graph, JSON-LD, sitemap, canonical URLs, semantic HTML. |
| Analytics | Google Analytics 4 + a custom admin dashboard showing traffic / top articles / subscriber growth. |
| Admin panel | Real admin panel: write, edit, approve AI drafts, schedule, view stats, manage newsletter. |
| Multi-device session | Yes |
| Phone-friendly admin | Yes (admin works on phone, but laptop-primary) |
| Accessibility | WCAG 2.2 AA — Brad deferred ("whatever you think is best") so we ship the proper standard |
| Hosting | **Railway** (Brandon's preferred platform, parity with AeroLink stack). Next.js standalone output. |
| Source control | GitHub for v1. Match Brandon's source-control posture for AeroLink. |

---

## 12. Trust / Credibility

- Featured-in / as-seen-on logo strip on home: yes (start empty, fill in as press lands).
- Public **Editorial Standards** page (linked from footer, not pushed in nav).
- **Bylines, sources, citations** clearly shown on every article.
- **Corrections page** with a chronological log.
- **Secure contact-a-tip form** for sources.
- Every AI-assisted piece labeled.

---

## 13. Launch Plan

| Milestone | Target |
|---|---|
| **Soft-launch coming-soon page** | Now (this build) — collects emails |
| **Day-1 content** | 5–10 articles live at launch (Brad writes 2–3 anchor pieces during pre-launch; others can be AI-drafted + Brad-approved) |
| **Public launch** | Summer 2026 |
| **First newsletter** | Day-1 launch announcement |
| **First podcast episode** | Within 60 days of launch |
| **First video / live game reaction** | Within 90 days of launch |

---

## 14. The "ESPN Hiring Manager" Test

Brad's words, lightly cleaned:

> "If a hiring manager at ESPN landed on the site tomorrow — I want them to walk away thinking 'oh my god, this could be the next big thing.' Even if it's not the best writing, the volume of people reading and engaging matters. Writing from the fans' point of view, saying whatever you want to say about the sports, the athletes, what's going on — that's the bet."

**This is the bar every page on BB Sports must clear.**

---

## 15. What we DON'T do (Negative Space)

- We don't pretend to be objective when Brad is biased — bias is **disclosed**, not hidden.
- We don't gate articles behind paywalls. Donations, yes. Paywall, no.
- We don't promote gambling, even via affiliate.
- We don't republish copyrighted images without credit.
- We don't ship AI-drafted pieces without a human pass.
- We don't post to Brad's accounts without his approval.
- We don't ship without mobile passing the device matrix.

---

## 16. Brand Voice Sample (calibrated from Audio 3)

This is the bar. Brad's voice memo describing the Wild–Avalanche playoff Game 1 (Avs won 9-6):

> "How does a team in the playoffs give up nine goals — and *six goals* — in the same game? It's kind of bullshit because, yeah, it's an entertaining game, but there's no competitiveness in that sense. The defense is horrid. The goalies were non-existent. You can look at it like 'great game, fans got what they wanted' — or you can look at it and go, what the hell? Both are right. Don't let anyone tell you the entertainment makes the bad hockey good."

That's the BB Sports register. Build everything to that bar.
