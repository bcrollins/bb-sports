import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Privacy',
  description: 'How BB Sports handles reader data, analytics, and communications.',
  alternates: { canonical: '/privacy' },
};

export default function PrivacyPage() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-12 sm:px-6 sm:py-16">
      <p className="bb-eyebrow !text-breaking">Legal</p>
      <h1 className="mt-3 font-display text-4xl italic leading-tight sm:text-5xl">Privacy</h1>
      <p className="mt-4 text-base leading-7 text-charcoal/80">
        BB Sports is a personal sports media brand operated by Brad Benson. We keep data
        collection minimal, first-party, and reversible where possible. Last updated:{' '}
        <time dateTime="2026-07-15">July 15, 2026</time>.
      </p>

      <section className="mt-10 space-y-4 text-[15px] leading-7 text-charcoal">
        <h2 className="font-serif text-2xl font-bold text-navy-900">What we collect</h2>
        <ul className="list-disc space-y-2 pl-5">
          <li>Newsletter email and consent record when you subscribe.</li>
          <li>Contact/tip messages you send (including optional confidential flag).</li>
          <li>Donation interest or payment metadata when Stripe is enabled.</li>
          <li>First-party analytics events (paths, event names) when not opted out.</li>
          <li>Access-wall and admin authentication signals required for security.</li>
        </ul>

        <h2 className="mt-8 font-serif text-2xl font-bold text-navy-900">What we do not do</h2>
        <ul className="list-disc space-y-2 pl-5">
          <li>No paywalled articles.</li>
          <li>No gambling promotions.</li>
          <li>No sale of personal data.</li>
          <li>No unlicensed live-score scrapes that invent box scores.</li>
        </ul>

        <h2 className="mt-8 font-serif text-2xl font-bold text-navy-900">Processors</h2>
        <p>
          Infrastructure may include Railway (hosting), Postgres, Stripe (payments when
          enabled), Resend (email when approved), Cloudflare R2 (media when approved), and
          xAI (AI drafting tools — never auto-publish without Brad).
        </p>

        <h2 className="mt-8 font-serif text-2xl font-bold text-navy-900">Your choices</h2>
        <ul className="list-disc space-y-2 pl-5">
          <li>
            Unsubscribe from email via the link in any message (
            <Link className="underline decoration-breaking underline-offset-4" href="/newsletter/unsubscribe">
              unsubscribe page
            </Link>
            ).
          </li>
          <li>
            Contact us for access or deletion requests via{' '}
            <Link
              className="underline decoration-breaking underline-offset-4"
              href="/contact"
            >
              /contact
            </Link>{' '}
            (choose <strong>Data access</strong> or <strong>Data deletion</strong> on the form)
            .
          </li>
          <li>
            System posture is public at{' '}
            <Link className="underline decoration-breaking underline-offset-4" href="/status">
              /status
            </Link>
            .
          </li>
        </ul>

        <h2 className="mt-8 font-serif text-2xl font-bold text-navy-900">Contact</h2>
        <p>
          Privacy questions: use the contact form or email the address Brad publishes on{' '}
          <Link className="underline decoration-breaking underline-offset-4" href="/about">
            /about
          </Link>
          .
        </p>
      </section>
    </main>
  );
}
