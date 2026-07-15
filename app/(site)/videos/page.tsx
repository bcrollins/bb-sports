import Link from 'next/link';
import type { Metadata } from 'next';
import { getVideoStatus } from '@/lib/media-status';

export const metadata: Metadata = {
  title: 'Videos — coming soon',
  description:
    'BB Sports video clips are not live yet. No embeddable players or rights-cleared clips on this page.',
};

export default function VideosPage() {
  const status = getVideoStatus();

  return (
    <div className="bg-bone">
      <header className="relative overflow-hidden bg-navy-deep text-bone">
        <div className="h-1 bg-breaking" aria-hidden="true" />
        <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6 sm:py-16">
          <p className="bb-eyebrow !tracking-[0.32em] !text-breaking">Video · not live</p>
          <h1
            className="mt-3 font-display uppercase italic leading-[0.92] tracking-[-0.025em] text-bone"
            style={{ fontSize: 'clamp(2.25rem, 7vw, 5.5rem)' }}
          >
            Vertical clips.
            <br />
            Live reactions.
          </h1>
          <p
            className="mt-4 inline-flex min-h-[40px] items-center rounded border border-breaking/50 bg-breaking/15 px-3 text-sm font-bold uppercase tracking-[0.14em] text-breaking"
            role="status"
          >
            {status.statusLabel}
          </p>
          <p className="mt-4 max-w-2xl text-lg text-bone/85">
            Short vertical video and game reactions will live here after rights-cleared, captioned,
            Brad-approved assets exist. This page does not show pretend playable tiles.
          </p>
        </div>
      </header>

      <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
        <section
          className="rounded border border-dashed border-navy/25 bg-white p-6"
          data-media-state={status.state}
          aria-label="No video library"
        >
          <h2 className="font-serif text-2xl font-bold text-navy-900">No clips published</h2>
          <p className="mt-2 text-charcoal/85">
            Placeholder thumbnails that look like a library were removed. When video launches, every
            item will carry provenance, captions/transcript, poster/alt, and a takedown path — and
            nothing autoplays audio.
          </p>
          <ul className="mt-4 list-disc space-y-2 pl-5 text-sm text-charcoal/80">
            <li>Storage and CDN only after commercial provider approval.</li>
            <li>Cross-post targets (TikTok, Instagram, YouTube Shorts) remain marketing intent until assets ship.</li>
            <li>Live reactions stream only when an approved broadcast exists.</li>
          </ul>
          <p className="mt-4 text-sm text-charcoal/70">
            Want a specific clip when we open the desk?{' '}
            <Link href="/contact" className="bb-link">
              Pitch it.
            </Link>
          </p>
        </section>

        <div className="mt-8 text-center">
          <Link href="/articles" className="bb-link">
            Read the written desk →
          </Link>
        </div>
      </div>
    </div>
  );
}
