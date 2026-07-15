# Accessibility gates (WCAG 2.2 AA)

Owner: Brandon (ops) · Editorial spot-check: Brad  
Last updated: 2026-07-15

## Automated (CI)

| Gate | How | Blocking? |
|------|-----|-----------|
| Focus-visible rings | `tests/a11y-motion-focus.test.ts` | Yes |
| Prefers-reduced-motion | same | Yes |
| Skip link → `#main` | site layout contract | Yes |
| 44px touch targets on primary CTAs | component conventions + spot tests | Progressive |
| Route inventory landmarks | `tests/a11y-route-inventory.test.ts` | Yes |

Full browser axe/Playwright matrix is the next hardening step (`#76` completion requires zero serious/critical axe on wall, login, home, archive, article, rankings, forms, legal, status, admin templates). Until Playwright is added, the inventory + source contracts above are mandatory on every PR.

## Manual per release

1. Keyboard-only: home → article → comments → contact → support (Tab order logical, no traps).
2. 200% and 400% zoom on article + archive at 375px width.
3. VoiceOver/Safari spot check on homepage lead + article share/save controls.
4. High contrast: focus still visible on navy/breaking.

## Exceptions

Document any temporary exception with owner + expiry date in the PR body. Never blanket-disable rules.
