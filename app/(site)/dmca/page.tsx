import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'DMCA / Copyright',
  description: 'Copyright notice and DMCA takedown process for BB Sports.',
  alternates: { canonical: '/dmca' },
};

export default function DmcaPage() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-12 sm:px-6 sm:py-16">
      <p className="bb-eyebrow !text-breaking">Legal</p>
      <h1 className="mt-3 font-display text-4xl italic leading-tight sm:text-5xl">
        Copyright &amp; DMCA
      </h1>
      <p className="mt-4 text-base leading-7 text-charcoal/80">
        Last updated: <time dateTime="2026-07-15">July 15, 2026</time>.
      </p>

      <section className="mt-10 space-y-4 text-[15px] leading-7 text-charcoal">
        <p>
          BB Sports content is owned by Brad Benson / BB Sports unless otherwise credited.
          Images require license + credit. We do not republish copyrighted photos without
          permission.
        </p>

        <h2 className="mt-8 font-serif text-2xl font-bold text-navy-900">Report infringement</h2>
        <p>
          Send a DMCA-style notice via{' '}
          <Link className="underline decoration-breaking underline-offset-4" href="/contact">
            /contact
          </Link>{' '}
          with:
        </p>
        <ul className="list-disc space-y-2 pl-5">
          <li>Your contact information</li>
          <li>Description of the copyrighted work</li>
          <li>URL of the allegedly infringing material on bbsports.fans</li>
          <li>A statement of good-faith belief and accuracy under penalty of perjury</li>
          <li>Physical or electronic signature</li>
        </ul>

        <h2 className="mt-8 font-serif text-2xl font-bold text-navy-900">Counter-notice</h2>
        <p>
          If your material was removed and you believe it was a mistake, contact us with a
          counter-notice including the removed URL, your contact details, and consent to jurisdiction
          of the appropriate court.
        </p>
      </section>
    </main>
  );
}
