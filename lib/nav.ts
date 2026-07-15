/**
 * Primary navigation contract — core destinations cannot be hidden.
 * Optional destinations may be reordered / soft-hidden locally (#86).
 */

export type NavItem = {
  href: string;
  label: string;
  /** Honest pre-launch status shown next to label when set. */
  status?: 'soon';
  /** Cannot be hidden or removed by reader personalization. */
  core?: boolean;
};

export const DEFAULT_NAV: NavItem[] = [
  { href: '/articles', label: 'Articles', core: true },
  { href: '/rankings', label: 'Rankings', core: true },
  { href: '/teams', label: 'Teams' },
  { href: '/people', label: 'People' },
  { href: '/search', label: 'Search', core: true },
  { href: '/reading-list', label: 'Saved' },
  { href: '/podcast', label: 'Podcast', status: 'soon' },
  { href: '/videos', label: 'Videos', status: 'soon' },
  { href: '/support', label: 'Support' },
  { href: '/contact', label: 'Tips' },
  { href: '/about', label: 'About' },
];

export const NAV_STORAGE_KEY = 'bb_primary_nav_v1';

const ALLOWED = new Map(DEFAULT_NAV.map((n) => [n.href, n]));

export type NavPreference = {
  /** Ordered href list (subset or full). */
  order: string[];
  /** Optional destinations the reader soft-hid (core ignored). */
  hidden: string[];
};

export function parseNavPreference(raw: unknown): NavPreference {
  const order: string[] = [];
  const hidden: string[] = [];
  if (raw && typeof raw === 'object') {
    const rec = raw as Record<string, unknown>;
    if (Array.isArray(rec.order)) {
      for (const h of rec.order) {
        if (typeof h === 'string' && ALLOWED.has(h) && !order.includes(h)) order.push(h);
      }
    }
    if (Array.isArray(rec.hidden)) {
      for (const h of rec.hidden) {
        if (typeof h !== 'string' || !ALLOWED.has(h)) continue;
        const item = ALLOWED.get(h)!;
        if (item.core) continue;
        if (!hidden.includes(h)) hidden.push(h);
      }
    }
  }
  // Always append any missing defaults after custom order.
  for (const item of DEFAULT_NAV) {
    if (!order.includes(item.href)) order.push(item.href);
  }
  return { order, hidden };
}

export function resolveNavItems(pref: NavPreference = { order: [], hidden: [] }): NavItem[] {
  const parsed = parseNavPreference(pref);
  const items: NavItem[] = [];
  for (const href of parsed.order) {
    const item = ALLOWED.get(href);
    if (!item) continue;
    if (parsed.hidden.includes(href) && !item.core) continue;
    items.push(item);
  }
  // Guarantee at least core destinations if something went sideways.
  if (items.length === 0) return DEFAULT_NAV.filter((n) => n.core);
  return items;
}

export function isNavActive(pathname: string, href: string): boolean {
  if (href === '/') return pathname === '/';
  if (pathname === href) return true;
  // Section roots: /articles matches /articles/foo, not /articles-extra
  return pathname.startsWith(`${href}/`);
}
