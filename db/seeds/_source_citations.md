# Sports Encyclopedia — Source Citations

**Product:** BB Sports first-party franchise / people registry  
**Verified:** 2026-07-15  
**Posture:** Public organizational identity facts only. Not a licensed stats feed. Not a third-party encyclopedia scrape.

## sports_leagues

| League | Primary source | URL |
| --- | --- | --- |
| NFL | NFL.com teams directory | https://www.nfl.com/teams/ |
| MLB | MLB.com team directory | https://www.mlb.com/team |
| NHL | NHL.com teams | https://www.nhl.com/info/teams |
| NBA | NBA.com teams | https://www.nba.com/teams |

## sports_teams

- **Coverage:** All active franchises (NFL 32, MLB 30, NHL 32, NBA 30) as of verification date.
- **Fields:** city/market, nickname, abbreviation, conference/division, founded year, official club URL, optional Brad rankings id.
- **Primary source:** Official league team directories + club official sites.
- **Explicitly excluded:** Box scores, advanced metrics tables, copyrighted encyclopedia prose, scraped third-party stat pages.
- **Flags:** Athletics market (temporary Sacramento), Utah Hockey Club branding — re-verify annually.

## sports_people

- **Coverage:** Small first-party set material to BB Sports columns (not full league rosters).
- **Primary source:** Official club pages linked per row.
- **Confidence:** Mostly `CROSS_REFERENCED`; coaching titles may be `FLAGGED` for offseason churn.
- **Excluded:** Full career stat lines, proprietary WAR/DVOA/etc. tables.

## Maintenance

| Domain | Cycle | Action |
| --- | --- | --- |
| Franchise identity | Annually + relocation events | Diff against league team directories |
| Coaching/person roles | Each offseason | Re-open FLAGGED rows |
| Rankings linkage | When Brad baseline ids change | Keep `rankings_id` in sync with `lib/rankings.ts` |

## Next review date

2026-10-01 (or earlier on franchise relocation / rebrand).
