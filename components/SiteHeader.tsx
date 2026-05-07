import Link from 'next/link';
import Logo from './Logo';

// Every link is a named, discoverable home — no hamburger / "More" bucket.
// On mobile the nav scrolls horizontally (same broadcast-strip pattern the
// homepage score ticker uses); on desktop it justifies center.
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
  { href: '/about', label: 'About' },
];

export default function SiteHeader() {
  const today = new Date().toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  return (
    <header className="bg-bone-50 border-b-[3px] border-navy-700 relative">
      {/* Network top rule — broadcast bug */}
      <div className="bb-masthead-rule" aria-hidden="true" />

      {/* Network bar — ESPN-style top strip with the date + brand CTAs */}
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
      <div className="px-4 sm:px-6 py-7 sm:py-9 text-center">
        <Logo asLink variant="masthead" scheme="navy-on-bone" className="mx-auto" />
        <div className="mt-3 text-[10.5px] sm:text-xs uppercase tracking-[0.32em] text-navy/80 font-semibold">
          Sports from the fan&rsquo;s view <span className="mx-1 text-navy/30">·</span>{' '}
          <span className="text-breaking font-extrabold">No bullshit.</span>
        </div>
      </div>

      {/* Primary nav — broadcast pill strip.
          Mobile: horizontally scrollable, every link visible (no "Menu" toggle).
          Desktop: justify-center, wraps if needed. */}
      <nav id="primary-nav" aria-label="Primary" className="bg-navy text-bone">
        <ul
          className="flex md:justify-center md:flex-wrap overflow-x-auto md:overflow-visible scroll-smooth [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
        >
          {NAV.map((item, i) => (
            <li key={item.href} className="shrink-0">
              <Link
                href={item.href}
                className={[
                  'inline-flex items-center justify-center',
                  'px-4 sm:px-5 py-3 md:py-3.5',
                  'text-[12px] font-bold uppercase tracking-[0.18em] whitespace-nowrap',
                  'text-bone hover:text-bone hover:bg-breaking transition-colors',
                  'min-h-[48px] min-w-[64px]',
                  'border-r border-bone/15',
                  i === NAV.length - 1 ? 'border-r-0' : '',
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
