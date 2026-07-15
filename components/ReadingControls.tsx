'use client';

import { useEffect, useState } from 'react';

const STORAGE_KEY = 'bb_reading_prefs_v1';

export type ReadingPrefs = {
  size: 'sm' | 'md' | 'lg';
  width: 'narrow' | 'standard' | 'wide';
};

const DEFAULTS: ReadingPrefs = { size: 'md', width: 'standard' };

function loadPrefs(): ReadingPrefs {
  if (typeof window === 'undefined') return DEFAULTS;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULTS;
    const parsed = JSON.parse(raw) as Partial<ReadingPrefs>;
    const size = parsed.size === 'sm' || parsed.size === 'lg' ? parsed.size : 'md';
    const width =
      parsed.width === 'narrow' || parsed.width === 'wide' ? parsed.width : 'standard';
    return { size, width };
  } catch {
    return DEFAULTS;
  }
}

function applyPrefs(prefs: ReadingPrefs) {
  if (typeof document === 'undefined') return;
  document.documentElement.dataset.readingSize = prefs.size;
  document.documentElement.dataset.readingWidth = prefs.width;
}

/**
 * First-class reading controls for article body — size + measure.
 * Preferences persist in localStorage; no network calls.
 */
export default function ReadingControls() {
  const [prefs, setPrefs] = useState<ReadingPrefs>(DEFAULTS);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const next = loadPrefs();
    setPrefs(next);
    applyPrefs(next);
    setReady(true);
  }, []);

  function update(partial: Partial<ReadingPrefs>) {
    setPrefs((prev) => {
      const next = { ...prev, ...partial };
      applyPrefs(next);
      try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {
        // storage optional
      }
      return next;
    });
  }

  if (!ready) {
    return (
      <div
        className="mb-6 rounded border border-navy/10 bg-white px-3 py-2 text-xs text-navy/50"
        aria-hidden="true"
      >
        Reading controls
      </div>
    );
  }

  return (
    <div
      className="mb-6 flex flex-wrap items-center gap-3 rounded border border-navy/15 bg-white px-3 py-2"
      role="group"
      aria-label="Reading controls"
    >
      <span className="font-mono text-[10px] font-black uppercase tracking-[0.18em] text-navy/45">
        Reading
      </span>
      <div className="flex flex-wrap items-center gap-1" role="group" aria-label="Text size">
        {(
          [
            { id: 'sm', label: 'A−' },
            { id: 'md', label: 'A' },
            { id: 'lg', label: 'A+' },
          ] as const
        ).map((opt) => (
          <button
            key={opt.id}
            type="button"
            onClick={() => update({ size: opt.id })}
            aria-pressed={prefs.size === opt.id}
            className={`inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded border px-2 text-sm font-bold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-breaking ${
              prefs.size === opt.id
                ? 'border-navy bg-navy text-bone'
                : 'border-navy/20 bg-bone-50 text-navy hover:border-navy/40'
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-1" role="group" aria-label="Column width">
        {(
          [
            { id: 'narrow', label: 'Narrow' },
            { id: 'standard', label: 'Standard' },
            { id: 'wide', label: 'Wide' },
          ] as const
        ).map((opt) => (
          <button
            key={opt.id}
            type="button"
            onClick={() => update({ width: opt.id })}
            aria-pressed={prefs.width === opt.id}
            className={`inline-flex min-h-[44px] items-center justify-center rounded border px-3 text-[11px] font-black uppercase tracking-[0.14em] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-breaking ${
              prefs.width === opt.id
                ? 'border-navy bg-navy text-bone'
                : 'border-navy/20 bg-bone-50 text-navy hover:border-navy/40'
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );
}
