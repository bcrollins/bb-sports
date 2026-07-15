'use client';

import { useEffect, useState } from 'react';
import {
  isOnReadingList,
  loadReadingList,
  toggleReadingListItem,
} from '@/lib/reading-list';

type Props = {
  slug: string;
  title: string;
  sport?: string;
};

export default function SaveToReadingList({ slug, title, sport }: Props) {
  const [saved, setSaved] = useState(false);
  const [ready, setReady] = useState(false);
  const [status, setStatus] = useState('');

  useEffect(() => {
    setSaved(isOnReadingList(slug, loadReadingList()));
    setReady(true);
  }, [slug]);

  function onToggle() {
    const next = toggleReadingListItem({ slug, title, sport });
    const on = next.some((i) => i.slug === slug);
    setSaved(on);
    setStatus(on ? 'Saved to reading list.' : 'Removed from reading list.');
  }

  if (!ready) {
    return (
      <button type="button" className="bb-button-ghost min-h-[44px]" disabled aria-hidden>
        Save for later
      </button>
    );
  }

  return (
    <div>
      <button
        type="button"
        onClick={onToggle}
        aria-pressed={saved}
        className="bb-button-ghost min-h-[44px]"
      >
        {saved ? 'Saved · remove' : 'Save for later'}
      </button>
      <p className="mt-1 text-xs text-charcoal/60" role="status" aria-live="polite">
        {status || 'Local only — no account. Manage on the reading list page.'}
      </p>
    </div>
  );
}
