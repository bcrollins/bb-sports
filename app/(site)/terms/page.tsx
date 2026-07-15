import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Terms of use',
  description: 'Terms for using BB Sports — the personal media brand of Brad Benson.',
  alternates: { canonical: '/terms' },
};

export default function TermsPage() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-12 sm:px-6 sm:py-16">
      <p className="bb-eyebrow !text-breaking">Legal</p>
      <h1 className="mt-3 font-display text-4xl italic leading-tight sm:text-5xl">Terms of use</h1>
      <p className="mt-4 text-base leading-7 text-charcoal/80">
        By using bbsports.fans you agree to these terms. Last updated:{' '}
        <time dateTime="2026-07-15">July 15, 2026</time>.
      </p>

      <section className="mt-10 space-y-4 text-[15px] leading-7 text-charcoal">
        <h2 className="font-serif text-2xl font-bold text-navy-900">The product</h2>
        <p>
          BB Sports publishes opinion-led sports journalism and related tools for readers.
          Editorial content reflects Brad Benson&rsquo;s views unless marked otherwise.
          Rankings are editorial opinion, not licensed league standings.
        </p>

        <h2 className="mt-8 font-serif text-2xl font-bold text-navy-900">Acceptable use</h2>
        <ul className="list-disc space-y-2 pl-5">
          <li>No scraping that violates robots rules or commercial data licenses.</li>
          <li>No spam, coordinated abuse, or illegal content in comments or tips.</li>
          <li>No attempt to bypass authentication or the soft-launch access wall.</li>
        </ul>

        <h2 className="mt-8 font-serif text-2xl font-bold text-navy-900">AI-assisted content</h2>
        <p>
          Pieces may be AI-assisted. When they are, BB Sports labels them and requires
          Brad&rsquo;s approval before publication. See{' '}
          <Link className="underline decoration-breaking underline-offset-4" href="/editorial-standards">
            editorial standards
          </Link>
          .
        </p>

        <h2 className="mt-8 font-serif text-2xl font-bold text-navy-900">Donations</h2>
        <p>
          Donations, when enabled, are optional support — not a purchase of article access.
          See{' '}
          <Link className="underline decoration-breaking underline-offset-4" href="/support/terms">
            donation terms
          </Link>
          .
        </p>

        <h2 className="mt-8 font-serif text-2xl font-bold text-navy-900">Contact</h2>
        <p>
          Questions:{' '}
          <Link className="underline decoration-breaking underline-offset-4" href="/contact">
            /contact
          </Link>
          .
        </p>
      </section>
    </main>
  );
}
