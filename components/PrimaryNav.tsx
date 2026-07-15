'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import {
  DEFAULT_NAV,
  isNavActive,
  NAV_STORAGE_KEY,
  parseNavPreference,
  resolveNavItems,
  type NavPreference,
} from '@/lib/nav';

function loadPref(): NavPreference {
  if (typeof window === 'undefined') return { order: [], hidden: [] };
  try {
    const raw = window.localStorage.getItem(NAV_STORAGE_KEY);
    if (!raw) return { order: [], hidden: [] };
    return parseNavPreference(JSON.parse(raw));
  } catch {
    return { order: [], hidden: [] };
  }
}

function persist(pref: NavPreference) {
  try {
    window.localStorage.setItem(NAV_STORAGE_KEY, JSON.stringify(parseNavPreference(pref)));
  } catch {
    /* private mode */
  }
}

export default function PrimaryNav() {
  const pathname = usePathname() || '/';
  const [pref, setPref] = useState<NavPreference>({ order: [], hidden: [] });
  const [ready, setReady] = useState(false);
  const [customize, setCustomize] = useState(false);

  useEffect(() => {
    setPref(loadPref());
    setReady(true);
  }, []);

  const items = ready ? resolveNavItems(pref) : DEFAULT_NAV;

  function move(href: string, dir: -1 | 1) {
    const order =
      pref.order.length > 0 ? [...pref.order] : DEFAULT_NAV.map((n) => n.href);
    const idx = order.indexOf(href);
    if (idx < 0) return;
    const nextIdx = idx + dir;
    if (nextIdx < 0 || nextIdx >= order.length) return;
    const swap = order[nextIdx]!;
    order[nextIdx] = href;
    order[idx] = swap;
    const next = parseNavPreference({ order, hidden: pref.hidden });
    setPref(next);
    persist(next);
  }

  function toggleHidden(href: string) {
    const item = DEFAULT_NAV.find((n) => n.href === href);
    if (!item || item.core) return;
    const hidden = pref.hidden.includes(href)
      ? pref.hidden.filter((h) => h !== href)
      : [...pref.hidden, href];
    const next = parseNavPreference({ order: pref.order, hidden });
    setPref(next);
    persist(next);
  }

  function reset() {
    const next = { order: DEFAULT_NAV.map((n) => n.href), hidden: [] as string[] };
    setPref(next);
    persist(next);
  }

  return (
    <div>
      <nav id="primary-nav" aria-label="Primary" className="bg-navy text-bone">
        <ul className="flex scroll-smooth overflow-x-auto md:flex-wrap md:justify-center md:overflow-visible [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
          {items.map((item, i) => {
            const active = isNavActive(pathname, item.href);
            return (
              <li key={item.href} className="shrink-0">
                <Link
                  href={item.href}
                  aria-current={active ? 'page' : undefined}
                  className={[
                    'inline-flex min-h-[48px] min-w-[64px] items-center justify-center gap-1.5',
                    'px-4 py-3 text-[12px] font-bold uppercase tracking-[0.18em] sm:px-5 md:py-3.5',
                    'whitespace-nowrap transition-colors',
                    active
                      ? 'bg-breaking text-bone'
                      : 'text-bone hover:bg-breaking hover:text-bone',
                    'border-r border-bone/15',
                    i === items.length - 1 ? 'border-r-0' : '',
                  ].join(' ')}
                >
                  {item.label}
                  {item.status === 'soon' ? (
                    <span className="rounded bg-bone/15 px-1.5 py-0.5 text-[9px] font-black tracking-[0.12em] text-bone/90">
                      Soon
                    </span>
                  ) : null}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="border-b border-navy/10 bg-bone-50 px-4 py-1.5 sm:px-6">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-end gap-3">
          <button
            type="button"
            className="inline-flex min-h-[40px] items-center text-[11px] font-bold uppercase tracking-[0.16em] text-navy/70 underline-offset-4 hover:text-breaking hover:underline"
            aria-expanded={customize}
            onClick={() => setCustomize((v) => !v)}
          >
            {customize ? 'Done customizing nav' : 'Customize nav'}
          </button>
        </div>
        {customize ? (
          <div className="mx-auto mt-2 max-w-7xl rounded border border-navy/15 bg-white p-4">
            <p className="text-sm text-charcoal/75">
              Local only — reorder or hide optional destinations. Articles, Rankings, and Search
              always stay. Reset anytime.
            </p>
            <ul className="mt-3 space-y-2">
              {DEFAULT_NAV.map((item) => {
                const hidden = pref.hidden.includes(item.href);
                return (
                  <li
                    key={item.href}
                    className="flex flex-wrap items-center justify-between gap-2 border-b border-navy/5 py-2 last:border-0"
                  >
                    <span className="text-sm font-semibold text-navy-900">
                      {item.label}
                      {item.core ? (
                        <span className="ml-2 text-[10px] font-bold uppercase tracking-wider text-navy/40">
                          core
                        </span>
                      ) : null}
                      {hidden ? (
                        <span className="ml-2 text-[10px] font-bold uppercase tracking-wider text-breaking">
                          hidden
                        </span>
                      ) : null}
                    </span>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        className="bb-button-ghost !min-h-[40px] !px-3 !text-[11px]"
                        onClick={() => move(item.href, -1)}
                        aria-label={`Move ${item.label} earlier`}
                      >
                        ←
                      </button>
                      <button
                        type="button"
                        className="bb-button-ghost !min-h-[40px] !px-3 !text-[11px]"
                        onClick={() => move(item.href, 1)}
                        aria-label={`Move ${item.label} later`}
                      >
                        →
                      </button>
                      {!item.core ? (
                        <button
                          type="button"
                          className="bb-button-ghost !min-h-[40px] !px-3 !text-[11px]"
                          onClick={() => toggleHidden(item.href)}
                          aria-pressed={hidden}
                        >
                          {hidden ? 'Show' : 'Hide'}
                        </button>
                      ) : null}
                    </div>
                  </li>
                );
              })}
            </ul>
            <button
              type="button"
              className="mt-3 inline-flex min-h-[44px] text-xs font-bold uppercase tracking-[0.16em] text-breaking underline-offset-4 hover:underline"
              onClick={reset}
            >
              Reset navigation
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
