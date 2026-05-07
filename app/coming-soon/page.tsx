/**
 * /coming-soon — soft-launch site gate.
 *
 * Public visitors land here when the bb_gate cookie is missing. Two paths in:
 *   (a) Have the password? Enter it → POST /api/gate → cookie set → router pushes
 *       to ?next= (or /).
 *   (b) Don't have it? Drop email into the newsletter signup; you'll get the URL +
 *       password when Brad goes wide.
 *
 * Once authenticated to the gate, every other route is open. Admin login is a
 * separate door at /admin/login.
 */
import { Suspense } from 'react';
import Link from 'next/link';
import NewsletterSignup from '@/components/NewsletterSignup';
import GateForm from './GateForm';

export const metadata = {
  title: 'Coming soon · BB Sports',
  description:
    'BB Sports is in soft launch. Got the password? Step inside. Need it? Drop your email and we’ll send it when we go wide.',
  robots: { index: false, follow: false },
};

export default function ComingSoonPage() {
  return (
    <div className="bg-bone min-h-[80vh]">
      <section className="bg-navy-deep text-bone relative overflow-hidden">
        <div className="h-1 bg-breaking" aria-hidden="true" />
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-14 sm:py-20 text-center">
          <p className="bb-eyebrow !text-breaking !tracking-[0.32em]">Soft launch · invite only</p>
          <h1
            className="mt-3 font-display uppercase italic text-bone leading-[0.9] tracking-[-0.025em]"
            style={{ fontSize: 'clamp(2.5rem, 9vw, 7rem)' }}
          >
            Members<br />only.
          </h1>
          <p className="mt-5 text-lg sm:text-xl text-bone/85 max-w-2xl mx-auto">
            BB Sports is in soft launch. If you have the password, step in. If you don&rsquo;t,
            drop your email — you&rsquo;ll be the first to get the takes when we go wide.
          </p>
        </div>
      </section>

      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-10 space-y-6">
        <div className="bg-white border border-navy/15 rounded p-6">
          <h2 className="font-serif font-bold text-navy-900 text-2xl">Got the password?</h2>
          <p className="mt-1 text-charcoal/85 text-sm">Brad shared a soft-launch password with you.</p>
          <Suspense fallback={<div className="mt-4 text-sm text-charcoal/60">Loading…</div>}>
            <GateForm />
          </Suspense>
        </div>

        <NewsletterSignup variant="block" />

        <div className="bg-bone-50 border border-navy/15 rounded p-6 text-sm text-charcoal/85">
          <p>
            Brad&rsquo;s here too. Editor sign-in:{' '}
            <Link href="/admin/login" className="bb-link">
              /admin/login
            </Link>
            .
          </p>
        </div>
      </div>
    </div>
  );
}
