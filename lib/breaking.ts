// Breaking-news strip data. In v1 these are curated headlines; v1.1 wires this
// to a server-authoritative Breaking model populated by an AI feed of verified
// X accounts + a Brad-approved publish step.

export type BreakingItem = {
  id: string;
  sport: string;
  text: string;
  href: string;
  sourceLabel?: string;
};

export function getBreakingItems(): BreakingItem[] {
  return [
    {
      id: 'launch-1',
      sport: 'BB SPORTS',
      text: 'New site launching this summer — read the founding take from Brad.',
      href: '/articles/welcome-to-bb-sports'
    },
    {
      id: 'cfb-1',
      sport: 'CFB',
      text: 'Florida-Georgia preview drops next month. Yes, I’m biased.',
      href: '/articles?sport=college-football'
    },
    {
      id: 'nhl-1',
      sport: 'NHL',
      text: 'Wild-Avs Game 1 was a 9–6 firework show — was it actually good hockey?',
      href: '/articles/wild-avs-game-1-was-it-actually-good-hockey'
    },
    {
      id: 'nfl-1',
      sport: 'NFL',
      text: 'Why the Bears finally have a real shot — without writing it like a homer.',
      href: '/articles/why-the-bears-finally-have-a-real-shot'
    }
  ];
}
