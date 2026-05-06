'use client';
import Link from 'next/link';
import { useState } from 'react';
import Logo from './Logo';

const NAV = [
  { href: '/articles', label: 'Articles' },
  { href: '/articles?sport=nfl', label: 'NFL' },
  { href: '/articles?sport=nhl', label: 'NHL' },
  { href: '/articles?sport=college-football', label: 'College' },
  { href: '/articles?sport=soccer', label: 'Soccer' },
  { href: '/articles?sport=nba', label: 'NBA' },
  { href: '/articles?sport=mma', label: 'MMA' },
  { href: '/podcast', label: 'Podcast' },
  { href: '/videos', label: 'Videos' },
  { href: '/about', label: 'About' }
];

export default function SiteHeader() {
  const [open, setOpen] = useState(false);

  const today = new Date().toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });

  return (
    <header className="bg-bone-50 border-b-[3px] border-navy-700 relative">
      {/* Network top rule — broadcast bug */}
      <div className="bb-masthead-rule" aria-hidden="true" />

      {/* Network bar — like the ESPN top bar with the date + score ticker */}
      <div className="hidden md:flex items-center justify-between px-6 py-1.5 text-[10.5px] uppercase tracking-[0.22em] text-bone bg-navy-deep border-b border-navy-700">
        <div className="flex items-center gap-4">
          <span className="font-semibold text-bone">BB · LIVE</span>
          <span className="opacity-70">{today}</span>
        </div>
        <div className="flex items-center gap-5">
          <a className="hover:text-breaking transition-colors" href="https://x.com/bbsports" rel="noopener" target="_blank">
            Follow @bbsports
          </a>
          <span className="opacity-30">|</span>
          <Link className="hover:text-breaking transition-colors" href="/coming-soon">
            Newsletter
          </Link>
          <span className="opacity-30">|</span>
          <Link className="hover:text-breaking transition-colors" href="/contact">
            Tips
          </Link>
        </div>
      </div>

      {/* Masthead — broadcast lockup */}
      <div className="px-4 sm:px-6 py-7 sm:py-9 text-center relative">
        <Logo asLink variant="masthead" scheme="navy-on-bone" className="mx-auto" />
        <div className="mt-3 text-[10.5px] sm:text-xs uppercase tracking-[0.32em] text-navy/80 font-semibold">
          Sports from the fan's view <span className="mx-1 text-navy/30">·</span>{' '}
          <span className="text-breaking font-extrabold">No bullshit.</span>
        </div>

        {/* Mobile menu — every nav item has a discoverable, named home below; this is the toggle, not a hamburger bucket */}
        <button
          onClick={() => setOpen(!open)}
          aria-expanded={open}
          aria-controls="primary-nav"
          aria-label={open ? 'Close navigation' : 'Open navigation'}
          className="md:hidden absolute right-4 top-7 inline-flex items-center justify-center min-w-[64px] min-h-[44px] rounded-sm border-2 border-navy text-navy bg-bone-50 font-bold uppercase tracking-[0.18em] text-[11px]"
        >
          {open ? 'Close' : 'Menu'}
        </button>
      </div>

      {/* Primary nav — broadcast pill bar */}
      <nav
        id="primary-nav"
        aria-label="Primary"
        className={`${open ? 'block' : 'hidden'} md:block bg-navy text-bone`}
      >
        <ul className="flex flex-col md:flex-row md:items-stretch md:justify-center md:flex-wrap">
          {NAV.map((item, i) => (
            <li key={item.href} className="md:contents">
              <Link
                href={item.href}
                onClick={() => setOpen(false)}
                className={[
                  'block md:inline-flex md:items-center md:justify-center',
                  'px-5 md:px-5 py-3 md:py-3.5',
                  'text-[12.5px] md:text-[12px] font-bold uppercase tracking-[0.18em]',
                  'text-bone hover:text-bone hover:bg-breaking transition-colors',
                  'min-h-[48px]',
                  'border-b md:border-b-0 md:border-r border-bone/15',
                  i === NAV.length - 1 ? 'md:border-r-0' : ''
                ].join(' ')}
              >
                {item.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      {/* Network red rule under the nav — broadcast spine */}
      <div className="h-1 bg-breaking" aria-hidden="true" />
    </header>
  );
}
