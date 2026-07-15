import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Cookies',
  description: 'How BB Sports uses cookies and similar storage.',
  alternates: { canonical: '/cookies' },
};

export default function CookiesPage() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-12 sm:px-6 sm:py-16">
      <p className="bb-eyebrow !text-breaking">Legal</p>
      <h1 className="mt-3 font-display text-4xl italic leading-tight sm:text-5xl">Cookies</h1>
      <p className="mt-4 text-base leading-7 text-charcoal/80">
        Last updated: <time dateTime="2026-07-15">July 15, 2026</time>.
      </p>

      <section className="mt-10 space-y-4 text-[15px] leading-7 text-charcoal">
        <h2 className="font-serif text-2xl font-bold text-navy-900">Essential cookies</h2>
        <ul className="list-disc space-y-2 pl-5">
          <li>
            <strong>bb_gate</strong> — signed soft-launch access cookie so you are not asked for the
            wall password every page load.
          </li>
          <li>
            <strong>bb_session</strong> — signed admin session for Brad&rsquo;s newsroom only.
          </li>
        </ul>

        <h2 className="mt-8 font-serif text-2xl font-bold text-navy-900">Analytics</h2>
        <p>
          Optional first-party analytics events may be recorded in BB Sports&rsquo; own database only
          when an independent <code className="font-mono text-sm">ANALYTICS_HASH_SALT</code> is
          configured (never reused from admin auth secrets). We do not require a third-party ad-tech
          cookie wall for core reading. See{' '}
          <Link className="underline decoration-breaking underline-offset-4" href="/privacy">
            Privacy
          </Link>
          .
        </p>

        <h2 className="mt-8 font-serif text-2xl font-bold text-navy-900">Controls</h2>
        <p>
          Clearing site cookies will re-prompt the soft-launch wall and sign Brad out of the
          newsroom. Optional analytics is suppressed when the browser sends{' '}
          <strong>Global Privacy Control</strong> (<code className="font-mono text-sm">Sec-GPC: 1</code>
          ), <strong>Do Not Track</strong> (<code className="font-mono text-sm">DNT: 1</code>), or the
          explicit opt-out cookie <code className="font-mono text-sm">bb_analytics=0</code>. Essential
          access-wall and admin session cookies are separate security controls and are not analytics.
        </p>
      </section>
    </main>
  );
}
