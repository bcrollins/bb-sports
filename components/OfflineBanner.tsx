'use client';

import { useEffect, useState } from 'react';

/**
 * Honest connectivity banner for readers and the newsroom shell.
 * Does not cache PII or invent success for failed writes.
 */
export default function OfflineBanner() {
  const [online, setOnline] = useState(true);
  const [wasOffline, setWasOffline] = useState(false);

  useEffect(() => {
    function sync() {
      const next = typeof navigator === 'undefined' ? true : navigator.onLine;
      setOnline((prev) => {
        if (!next) setWasOffline(true);
        return next;
      });
    }
    sync();
    window.addEventListener('online', sync);
    window.addEventListener('offline', sync);
    return () => {
      window.removeEventListener('online', sync);
      window.removeEventListener('offline', sync);
    };
  }, []);

  if (online && !wasOffline) return null;

  if (!online) {
    return (
      <div
        role="status"
        aria-live="polite"
        className="fixed inset-x-0 bottom-0 z-[60] border-t-2 border-breaking bg-navy-deep px-4 py-3 text-center text-sm text-bone shadow-lg"
      >
        <strong className="font-bold">You&rsquo;re offline.</strong>{' '}
        Reading may work from cache; comments, tips, newsletter, and admin saves need a connection.
      </div>
    );
  }

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed inset-x-0 bottom-0 z-[60] border-t-2 border-emerald-500 bg-emerald-950 px-4 py-3 text-center text-sm text-emerald-50 shadow-lg"
    >
      <strong className="font-bold">Back online.</strong> Retry any failed sends if needed — we do
      not invent success for lost requests.
      <button
        type="button"
        className="ml-3 inline-flex min-h-[44px] items-center underline"
        onClick={() => setWasOffline(false)}
      >
        Dismiss
      </button>
    </div>
  );
}
