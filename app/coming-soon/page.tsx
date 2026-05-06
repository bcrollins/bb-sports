import Link from 'next/link';
import NewsletterSignup from '@/components/NewsletterSignup';

export const metadata = {
  title: 'Coming soon',
  description:
    'BB Sports is launching this summer. Drop your email — you’ll be the first to read.'
};

export default function ComingSoonPage() {
  return (
    <div className="bg-bone min-h-[70vh]">
      <section className="bg-navy-deep text-bone relative overflow-hidden">
        <div className="h-1 bg-breaking" aria-hidden="true" />
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-14 sm:py-20 text-center">
          <p className="bb-eyebrow !text-breaking !tracking-[0.32em]">Soft launch</p>
          <h1
            className="mt-3 font-display uppercase italic text-bone leading-[0.9] tracking-[-0.025em]"
            style={{ fontSize: 'clamp(2.5rem, 9vw, 7rem)' }}
          >
            Be there<br/>day one.
          </h1>
          <p className="mt-5 text-lg sm:text-xl text-bone/85 max-w-2xl mx-auto">
            BB Sports is in soft launch and going wide this summer. Drop your email and you'll be the first to get the takes — straight from Brad, the moment they ship.
          </p>
        </div>
      </section>

      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-10 space-y-6">
        <NewsletterSignup variant="block" />

        <div className="bg-white border border-navy/15 rounded p-6">
          <h2 className="font-serif font-bold text-navy-900 text-2xl">In the meantime</h2>
          <ul className="mt-3 space-y-2 text-charcoal/85">
            <li>
              Read the founding take:{' '}
              <Link href="/articles/welcome-to-bb-sports" className="bb-link">
                Welcome to BB Sports
              </Link>
              .
            </li>
            <li>
              See where Brad stands on the Wild–Avs Game 1:{' '}
              <Link href="/articles/wild-avs-game-1-was-it-actually-good-hockey" className="bb-link">
                Read the take
              </Link>
              .
            </li>
            <li>
              Follow{' '}
              <a href="https://x.com/bbsports" target="_blank" rel="noopener" className="bb-link">
                @bbsports on X
              </a>{' '}
              — that’s where the daily noise lives.
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}
