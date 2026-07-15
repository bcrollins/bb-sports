import Link from 'next/link';
import { UserCircle } from 'lucide-react';
import Logo from './Logo';
import PrimaryNav from './PrimaryNav';

export default function SiteHeader() {
  const today = new Date().toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  return (
    <header className="relative border-b-[3px] border-navy-700 bg-bone-50">
      {/* Network top rule — broadcast bug */}
      <div className="bb-masthead-rule" aria-hidden="true" />

      {/* Network bar — ESPN-style top strip with the date + brand CTAs */}
      <div className="hidden items-center justify-between border-b border-navy-700 bg-navy-deep px-6 py-1.5 text-[10.5px] uppercase tracking-[0.22em] text-bone md:flex">
        <div className="flex items-center gap-4">
          <span className="font-semibold text-bone">BB Sports · Fan desk</span>
          <time className="opacity-70" dateTime={new Date().toISOString().slice(0, 10)}>
            {today}
          </time>
        </div>
        <div className="flex items-center gap-5">
          <a
            className="transition-colors hover:text-breaking"
            href="https://x.com/bbsports"
            rel="noopener noreferrer"
            target="_blank"
          >
            Follow @bbsports
          </a>
          <span className="opacity-30">|</span>
          <Link className="transition-colors hover:text-breaking" href="/#newsletter">
            Newsletter
          </Link>
          <span className="opacity-30">|</span>
          <Link className="transition-colors hover:text-breaking" href="/contact">
            Tips
          </Link>
        </div>
      </div>

      {/* Masthead — broadcast lockup */}
      <div className="relative px-4 py-7 text-center sm:px-6 sm:py-9">
        <Link
          href="/admin"
          aria-label="Sign in to the newsroom"
          title="Sign in to the newsroom"
          className="absolute right-3 top-3 inline-flex h-11 w-11 items-center justify-center rounded-full border border-navy/15 bg-white text-navy shadow-sm transition-colors hover:border-breaking hover:text-breaking focus:outline-none focus-visible:ring-2 focus-visible:ring-breaking"
        >
          <UserCircle size={24} strokeWidth={2.2} aria-hidden="true" />
          <span className="sr-only">Sign in to the newsroom</span>
        </Link>
        <Logo asLink variant="masthead" scheme="navy-on-bone" className="mx-auto" />
        <div className="mx-auto mt-3 flex max-w-[calc(100vw-2rem)] flex-wrap justify-center gap-x-2 gap-y-1 text-[9.5px] font-semibold uppercase leading-relaxed tracking-[0.18em] text-navy/80 sm:text-xs sm:tracking-[0.28em]">
          <span>Sports from the fan&rsquo;s view</span>
          <span className="text-navy/30">·</span>
          <span className="basis-full font-extrabold text-breaking sm:basis-auto">No BS.</span>
        </div>
      </div>

      {/* Primary nav — client-personalized strip (no hamburger). */}
      <PrimaryNav />

      {/* Network red rule under the nav — broadcast spine */}
      <div className="h-1 bg-breaking" aria-hidden="true" />
    </header>
  );
}
