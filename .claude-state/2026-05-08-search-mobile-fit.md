# 2026-05-08 — Search Mobile Fit

Branch: `codex/bb-sports-search-mobile-fit`

## Scope

Fix the live mobile visual regression caught after first-party search deployed.

## Root Cause

The search form grid and its native input/select/button children lacked explicit `min-w-0` / `w-full` constraints. On 393px mobile, the search input placeholder and controls could force the grid wider than the viewport.

## Implementation

- Added `w-full min-w-0` to the `/search` form and each primary search control.
- Added a source guard test so the mobile fit constraint does not get removed silently.

## Verification Target

- `npm run check`
- Live production screenshot at 393x852 after deploy.
- Live `/api/search?q=Bears` still returns the Bears article.

## Resume Pointer

Continue internal-first launch readiness with first-party analytics rollups after the search surface is visually verified live.
