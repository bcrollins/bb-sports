// Desk rail data. Static / site_config items are curated editorial bumpers —
// never labeled "Breaking." True breaking requires source, freshness, and
// Brad approval via the newsroom (future wire); until then the public rail
// is honest desk copy only.

export type DeskRailItem = {
  id: string;
  sport: string;
  text: string;
  href: string;
  sourceLabel?: string;
  /**
   * Only true when the item was verified as live breaking news
   * (source URL + expiry + Brad approval). Static defaults are always false.
   */
  isBreaking?: boolean;
};

/** @deprecated Use DeskRailItem — retained name for import stability. */
export type BreakingItem = DeskRailItem;

export function getDeskRailItems(): DeskRailItem[] {
  return [
    {
      id: 'launch-1',
      sport: 'BB SPORTS',
      text: 'New site launching this summer — read the founding take from Brad.',
      href: '/articles/welcome-to-bb-sports',
    },
    {
      id: 'rankings-1',
      sport: 'RANKINGS',
      text: "Top 25 in every league. When Brad trashes a team, the ranking moves.",
      href: '/rankings',
    },
    {
      id: 'mlb-1',
      sport: 'MLB',
      text: 'Yankees just dropped 8 slots on the franchise rankings — read why.',
      href: '/articles/yankees-window-just-slammed',
    },
    {
      id: 'cfb-1',
      sport: 'CFB',
      text: "Florida-Georgia preview drops next month. Yes, I'm biased.",
      href: '/articles?sport=college-football',
    },
    {
      id: 'nhl-1',
      sport: 'NHL',
      text: 'Wild-Avs Game 1 was a 9–6 firework show — was it actually good hockey?',
      href: '/articles/wild-avs-game-1-was-it-actually-good-hockey',
    },
    {
      id: 'nfl-1',
      sport: 'NFL',
      text: 'Why the Bears finally have a real shot — without writing it like a homer.',
      href: '/articles/why-the-bears-finally-have-a-real-shot',
    },
  ];
}

/** @deprecated Prefer getDeskRailItems. */
export function getBreakingItems(): DeskRailItem[] {
  return getDeskRailItems();
}
