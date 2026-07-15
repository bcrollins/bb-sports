import type { Metadata } from 'next';
import ReadingListManager from '@/components/ReadingListManager';

export const metadata: Metadata = {
  title: 'Reading list',
  description:
    'Your local BB Sports reading list — saved on this device only, no account required.',
  robots: { index: false, follow: false },
};

export default function ReadingListPage() {
  return (
    <div className="bg-bone">
      <header className="relative overflow-hidden bg-navy-deep text-bone">
        <div className="h-1 bg-breaking" aria-hidden="true" />
        <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6 sm:py-16">
          <p className="bb-eyebrow !tracking-[0.32em] !text-breaking">Local utility</p>
          <h1
            className="mt-3 font-display uppercase italic leading-[0.92] tracking-[-0.025em] text-bone"
            style={{ fontSize: 'clamp(2.25rem, 8vw, 5rem)' }}
          >
            Reading list.
          </h1>
          <p className="mt-4 max-w-2xl text-lg text-bone/85">
            Save takes for later without an account. Everything stays in this browser — export
            anytime if you switch devices.
          </p>
        </div>
      </header>
      <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
        <ReadingListManager />
      </div>
    </div>
  );
}
