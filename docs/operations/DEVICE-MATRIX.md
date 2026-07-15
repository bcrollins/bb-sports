# Device matrix certification

Owner: Brandon (ops) · Editorial spot-check: Brad  
Last updated: 2026-07-15

## Required viewports (web)

| Label | Size | Notes |
|-------|------|-------|
| iPhone SE | 375×667 | Overflow, 44px targets |
| iPhone 14 | 390×844 | Sticky nav, forms |
| iPhone 15 Pro Max | 430×932 | Safe-area |
| iPad | 820×1180 | Two-column desk |
| Laptop | 1440×900 | Full chrome |
| Desktop | 1920×1080 | Max width containers |

## Routes per release

Home, archive, article, rankings, teams, people, search, contact, support, reading-list, podcast, videos, status, legal suite, admin login (if credentials), catalog (admin).

## Automated gates today

- Responsive Tailwind + min-h 44px conventions
- Production smoke (27+ HTTP journeys)
- CWV / payload / image budgets in `lib/performance-budgets.ts` + `lib/image-optimization.ts`
- Skip-link + reduced-motion contracts

## Manual evidence (per release)

Archive screenshots or short video under private ops storage (not git). Mark PR with:

`device-matrix: <date> <operator> pass|fail`

## Fail criteria

Unintended horizontal overflow, truncated essential CTAs, focus loss, sticky header covering inputs, text <16px body on article.
