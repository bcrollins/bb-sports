import Link from 'next/link';
import NewsletterSignup from '@/components/NewsletterSignup';

export const metadata = {
  title: 'Podcast',
  description: 'The BB Sports podcast — coming this summer. Long-form fan-perspective takes, in audio.'
};

export default function PodcastPage() {
  return (
    <div className="bg-bone">
      <header className="bg-navy-deep text-bone relative overflow-hidden">
        <div className="h-1 bg-breaking" aria-hidden="true" />
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-12 sm:py-16">
          <p className="bb-eyebrow !text-breaking !tracking-[0.32em]">Audio</p>
          <h1
            className="mt-3 font-display uppercase italic text-bone leading-[0.92] tracking-[-0.025em]"
            style={{ fontSize: 'clamp(2.25rem, 8vw, 6rem)' }}
          >
            The BB Sports<br/>Podcast.
          </h1>
          <p className="mt-4 text-lg text-bone/85">
            Same voice as the columns. Longer. Louder. Coming this summer — first episode within 60 days of public launch.
          </p>
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-10">
        <section className="bg-white border border-navy/15 rounded p-6">
          <h2 className="font-serif text-2xl font-bold text-navy-900">What you’ll get</h2>
          <ul className="mt-4 list-disc pl-5 space-y-2 text-charcoal/85">
            <li>Solo episodes from Brad — opinion, breaking news reactions, college football season-week roundups.</li>
            <li>Game reactions during games when the schedule allows (live or near-live).</li>
            <li>Occasional guests once the show settles — players, coaches, other writers willing to argue.</li>
            <li>Show notes are AI-drafted from the audio and Brad-edited — every episode page links the receipts.</li>
          </ul>

          <h3 className="font-serif text-xl font-bold text-navy-900 mt-8">Where you’ll find it</h3>
          <p className="mt-2 text-charcoal/85">
            On launch the show ships to Apple Podcasts, Spotify, YouTube, and the BB Sports site directly. Subscribe to the newsletter and you’ll be the first to hear when the feed goes live.
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
