import type { SportSlug } from './sports';

// Per-sport broadcast accents — used for tag pills, eyebrows, card top-rules.
// Stays inside the BB Sports brand (navy + bone + red as the network primary)
// while giving each section a recognisable cue, the way ESPN colour-codes
// NFL Live vs SportsCenter vs College GameDay.

export type SportAccent = {
  label: string;
  short: string;       // 3–4 char broadcast bug
  bg: string;          // bg color for tag
  fg: string;          // fg color for tag
  accent: string;      // accent rule color
};

const META: Record<SportSlug, SportAccent> = {
  nfl:                { label: 'NFL',              short: 'NFL', bg: '#0A1F44', fg: '#F5F2EC', accent: '#D7263D' },
  mlb:                { label: 'MLB',              short: 'MLB', bg: '#0A1F44', fg: '#F5F2EC', accent: '#1B7F3B' },
  nhl:                { label: 'NHL',              short: 'NHL', bg: '#06122A', fg: '#F5F2EC', accent: '#7BB3FF' },
  nba:                { label: 'NBA',              short: 'NBA', bg: '#C9082A', fg: '#F5F2EC', accent: '#1A5BC1' },
  'college-football': { label: 'College Football', short: 'CFB', bg: '#FF6B00', fg: '#0A1F44', accent: '#0A1F44' },
  soccer:             { label: 'Soccer',           short: 'PL',  bg: '#1B5E20', fg: '#F5F2EC', accent: '#FFC107' },
  mma:                { label: 'MMA',              short: 'MMA', bg: '#0E0E10', fg: '#F5F2EC', accent: '#D7263D' },
  general:            { label: 'BB Sports',        short: 'BB',  bg: '#0A1F44', fg: '#F5F2EC', accent: '#D7263D' }
};

export function sportMeta(s: SportSlug): SportAccent {
  return META[s] ?? META.general;
}
