import Link from 'next/link';
import type { Metadata } from 'next';
import NewsletterSignup from '@/components/NewsletterSignup';
import { getPodcastStatus } from '@/lib/media-status';

export const metadata: Metadata = {
  title: 'Podcast — coming soon',
  description:
    'The BB Sports podcast is not live yet. No episodes published. Newsletter first when the feed launches.',
};

export default function PodcastPage() {
  const status = getPodcastStatus();

  return (
    <div className="bg-bone">
      <header className="relative overflow-hidden bg-navy-deep text-bone">
        <div className="h-1 bg-breaking" aria-hidden="true" />
        <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6 sm:py-16">
          <p className="bb-eyebrow !tracking-[0.32em] !text-breaking">Audio · not live</p>
          <h1
            className="mt-3 font-display uppercase italic leading-[0.92] tracking-[-0.025em] text-bone"
            style={{ fontSize: 'clamp(2.25rem, 8vw, 6rem)' }}
          >
            The BB Sports
            <br />
            Podcast.
          </h1>
          <p
            className="mt-4 inline-flex min-h-[40px] items-center rounded border border-breaking/50 bg-breaking/15 px-3 text-sm font-bold uppercase tracking-[0.14em] text-breaking"
            role="status"
          >
            {status.statusLabel}
          </p>
          <p className="mt-4 text-lg text-bone/85">
            Same voice as the columns. Longer. Louder. There is no episode player and no RSS feed on
            this page yet — we will not invent one.
          </p>
        </div>
      </header>

      <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
        <section className="rounded border border-navy/15 bg-white p-6">
          <h2 className="font-serif text-2xl font-bold text-navy-900">What will ship when ready</h2>
          <ul className="mt-4 list-disc space-y-2 pl-5 text-charcoal/85">
            <li>Solo episodes from Brad — opinion, reactions, college football week roundups.</li>
            <li>Optional guests once the show settles.</li>
            <li>Show notes AI-drafted from audio and Brad-edited — receipts linked per episode.</li>
            <li>Real platform distribution (Apple, Spotify, YouTube) only after a published feed exists.</li>
          </ul>

          <div
            className="mt-8 rounded border border-dashed border-navy/25 bg-bone-50 p-5"
            data-media-state={status.state}
            aria-label="No podcast player"
          >
            <p className="font-serif text-lg font-bold text-navy-900">No player. No fake episodes.</p>
            <p className="mt-2 text-sm text-charcoal/75">
              When the first Brad-approved episode is live, this block becomes the real player and
              feed. Until then, the honest surface is this notice.
            </p>
          </div>

          <h3 className="mt-8 font-serif text-xl font-bold text-navy-900">Get notified</h3>
          <p className="mt-2 text-charcoal/85">
            Subscribe to the newsletter — you will hear when the feed actually goes live.
          </p>
          <div className="mt-6">
            <NewsletterSignup variant="inline" />
          </div>
        </section>

        <div className="mt-8 text-center">
          <Link href="/articles" className="bb-link">
            Read the takes while you wait →
          </Link>
        </div>
      </div>
    </div>
  );
}
