import Link from 'next/link';
import type { Metadata } from 'next';
import SupportForm from './SupportForm';
import { resolveSupportSurfaceMode } from '@/lib/support';

export const metadata: Metadata = {
  title: 'Support',
  description:
    'Support BB Sports without creating a paywall. Donations keep Brad Benson articles free and are processed only through verified Stripe rails.',
};

export default function SupportPage() {
  const surface = resolveSupportSurfaceMode();

  return (
    <div className="bg-bone">
      <header className="bg-navy-deep text-bone">
        <div className="h-1 bg-breaking" aria-hidden="true" />
        <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-14">
          <p className="bb-eyebrow !text-breaking !tracking-[0.32em]">Support BB Sports</p>
          <h1
            className="mt-3 max-w-4xl break-words font-display italic uppercase leading-[0.92] text-bone sm:text-7xl"
            style={{ fontSize: 'clamp(2.15rem, 9vw, 4.5rem)' }}
          >
            Free articles.<br />Real opinions.<br />No gambling<br />money.
          </h1>
          <p className="mt-5 max-w-[32ch] break-words text-base leading-relaxed text-bone/85 sm:max-w-2xl sm:text-lg">
            BB Sports will not sell premium columns or hide Brad&apos;s best work behind a paywall.
            Supporter interest is recorded first-party, and payments only move through verified Stripe rails.
          </p>
        </div>
      </header>

      <main className="mx-auto grid max-w-6xl gap-8 px-4 py-10 sm:px-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <section>
          <div className="mb-5 border-l-4 border-breaking bg-white p-5">
            <h2 className="font-serif text-2xl font-bold text-navy-900">What support buys</h2>
            <p className="mt-2 text-charcoal/78">
              Time for better sourcing, sharper edits, more original clips, and fewer low-value growth hacks.
              It does not buy coverage, placement, silence, or a gambling pick.
            </p>
          </div>
          <SupportForm
            surface={surface.surface}
            headline={surface.headline}
            detail={surface.detail}
            primaryCta={surface.primaryCta}
            acceptsMoneyNow={surface.acceptsMoneyNow}
          />
        </section>

        <aside className="grid gap-4 content-start">
          <section className="border border-navy/15 bg-white p-5">
            <h2 className="bb-eyebrow">House rules</h2>
            <ul className="mt-3 space-y-3 text-sm leading-relaxed text-charcoal/78">
              <li>No paywalled article content.</li>
              <li>No gambling promotion or tip-betting packages.</li>
              <li>Support does not influence editorial coverage.</li>
              <li>Refunds and donation terms are public before Stripe opens.</li>
            </ul>
          </section>

          <section className="border border-navy/15 bg-white p-5">
            <h2 className="bb-eyebrow">Need a sponsorship?</h2>
            <p className="mt-2 text-sm leading-relaxed text-charcoal/78">
              Sponsorship is separate from reader support and must be disclosed.
            </p>
            <Link href="/contact" className="mt-4 inline-flex min-h-[44px] items-center border border-navy px-4 text-sm font-bold text-navy transition-colors hover:border-breaking hover:text-breaking">
              Contact sponsorship desk
            </Link>
          </section>

          <section className="border border-navy/15 bg-white p-5">
            <h2 className="bb-eyebrow">Terms</h2>
            <p className="mt-2 text-sm leading-relaxed text-charcoal/78">
              Payments remain disabled until the Stripe account is verified and terms are reviewed.
            </p>
            <Link href="/support/terms" className="mt-3 inline-block text-sm bb-link">
              Donation and refund terms
            </Link>
          </section>
        </aside>
      </main>
    </div>
  );
}
