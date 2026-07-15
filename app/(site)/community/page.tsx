import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Community guidelines',
  description: 'How to comment and tip on BB Sports without turning the room into sludge.',
  alternates: { canonical: '/community' },
};

export default function CommunityPage() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-12 sm:px-6 sm:py-16">
      <p className="bb-eyebrow !text-breaking">Community</p>
      <h1 className="mt-3 font-display text-4xl italic leading-tight sm:text-5xl">
        Community guidelines
      </h1>
      <p className="mt-4 text-base leading-7 text-charcoal/80">
        BB Sports is a fan-first desk. Argue hard. Don&rsquo;t be a menace. Last updated:{' '}
        <time dateTime="2026-07-15">July 15, 2026</time>.
      </p>

      <section className="mt-10 space-y-4 text-[15px] leading-7 text-charcoal">
        <h2 className="font-serif text-2xl font-bold text-navy-900">Do</h2>
        <ul className="list-disc space-y-2 pl-5">
          <li>Disagree with takes using facts, film, or lived fandom.</li>
          <li>Disclose bias when it matters (we do).</li>
          <li>Tip real stories through{' '}
            <Link className="underline decoration-breaking underline-offset-4" href="/contact">
              /contact
            </Link>
            .
          </li>
        </ul>

        <h2 className="mt-8 font-serif text-2xl font-bold text-navy-900">Don&rsquo;t</h2>
        <ul className="list-disc space-y-2 pl-5">
          <li>Spam, brigade, or fake engagement.</li>
          <li>Promote sports betting tips or gambling offers.</li>
          <li>Harass athletes, readers, or staff — especially minors.</li>
          <li>Post personal data, doxxing, or illegal content.</li>
        </ul>

        <h2 className="mt-8 font-serif text-2xl font-bold text-navy-900">Enforcement</h2>
        <p>
          Comments may be rate-limited, flagged, or removed. Brad moderates a one-person desk —
          expect human judgment, not a corporate appeal labyrinth. See also{' '}
          <Link className="underline decoration-breaking underline-offset-4" href="/editorial-standards">
            editorial standards
          </Link>
          .
        </p>
      </section>
    </main>
  );
}
