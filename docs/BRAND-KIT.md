# BB Sports Brand Kit

Updated: 2026-05-07

## Bradley Benson Image Library

Production assets live in `public/brand/bradley/`. These files were generated from Bradley-provided source images and stripped of location metadata before being added to the platform.

| Asset | Production path | Use | Credit |
| --- | --- | --- | --- |
| Brad Benson - NHL trophy photo | `/brand/bradley/bradley-benson-winter-classic.jpg` | Primary founder image for the About page, media kit, and Bradley profile surfaces. | BB Sports / Bradley Benson |
| Brad Benson - Manchester United photo | `/brand/bradley/bradley-benson-manchester-united.jpg` | Secondary founder image for soccer coverage, profile variants, and brand collateral. | BB Sports / Bradley Benson |
| Bradley Benson illustrated BB Sports card | `/brand/bradley/bradley-benson-illustrated-card.jpg` | Personality art for brand decks, launch graphics, and internal admin references. | BB Sports illustration supplied by Bradley Benson |

## Usage Rules

- Use the NHL trophy photo as the default public Bradley image.
- Use the Manchester United photo only where the soccer context makes sense.
- Use the illustrated card for brand energy, not as the canonical headshot.
- Keep the public credit as `BB Sports / Bradley Benson` unless Bradley supplies a photographer credit.
- Do not add source HEIC files to production. Convert, resize, and strip metadata first.
- Do not use third-party sports photos unless the license and credit are stored under `docs/legal/`.
- Use `/admin/media` for AI-generated editorial art and motion clips. Generated assets must be approved before they appear on public surfaces.

## Verification

- `mdls` returned no latitude or longitude for all production images.
- `sips -g all` confirmed the optimized JPEGs only carry basic image/color profile properties.
- The assets are surfaced in `/about` and `/admin/site`.
