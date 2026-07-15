'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import {
  exportReadingListJson,
  importReadingListJson,
  loadReadingList,
  saveReadingList,
  type ReadingListItem,
} from '@/lib/reading-list';

export default function ReadingListManager() {
  const [items, setItems] = useState<ReadingListItem[]>([]);
  const [ready, setReady] = useState(false);
  const [status, setStatus] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setItems(loadReadingList());
    setReady(true);
  }, []);

  function remove(slug: string) {
    const next = items.filter((i) => i.slug !== slug);
    saveReadingList(next);
    setItems(next);
    setStatus('Removed.');
  }

  function clearAll() {
    saveReadingList([]);
    setItems([]);
    setStatus('Reading list cleared.');
  }

  function downloadExport() {
    const blob = new Blob([exportReadingListJson(items)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `bb-sports-reading-list-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setStatus('Exported JSON.');
  }

  function onImportFile(file: File | null) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const text = typeof reader.result === 'string' ? reader.result : '';
      const next = importReadingListJson(text);
      setItems(next);
      setStatus(`Imported. ${next.length} item(s) on list.`);
    };
    reader.readAsText(file);
  }

  if (!ready) {
    return <p className="text-sm text-navy/50">Loading local reading list…</p>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-3">
        <button type="button" className="bb-button-ghost min-h-[44px]" onClick={downloadExport}>
          Export JSON
        </button>
        <button
          type="button"
          className="bb-button-ghost min-h-[44px]"
          onClick={() => fileRef.current?.click()}
        >
          Import JSON
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          className="sr-only"
          onChange={(e) => onImportFile(e.target.files?.[0] ?? null)}
        />
        {items.length > 0 ? (
          <button type="button" className="bb-button-ghost min-h-[44px]" onClick={clearAll}>
            Clear all
          </button>
        ) : null}
      </div>
      <p className="text-xs text-charcoal/60" role="status" aria-live="polite">
        {status || 'Stored only in this browser. No server sync.'}
      </p>

      {items.length === 0 ? (
        <div className="rounded border border-navy/15 bg-white p-6">
          <h2 className="font-serif text-xl font-bold text-navy-900">Nothing saved yet</h2>
          <p className="mt-2 text-sm text-charcoal/75">
            Open any take and tap <strong>Save for later</strong>. Your list stays on this device.
          </p>
          <Link href="/articles" className="mt-4 inline-flex min-h-[44px] items-center text-sm font-bold text-breaking">
            Browse the archive →
          </Link>
        </div>
      ) : (
        <ul className="divide-y divide-navy/10 rounded border border-navy/15 bg-white">
          {items.map((item) => (
            <li key={item.slug} className="flex flex-wrap items-start justify-between gap-3 p-4">
              <div className="min-w-0 flex-1">
                {item.sport ? (
                  <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-navy/45">
                    {item.sport}
                  </p>
                ) : null}
                <Link
                  href={`/articles/${item.slug}`}
                  className="block font-serif text-lg font-bold text-navy-900 hover:text-breaking"
                >
                  {item.title}
                </Link>
                <p className="mt-1 text-xs text-charcoal/55">
                  Saved {new Date(item.savedAt).toLocaleString()}
                </p>
              </div>
              <button
                type="button"
                className="bb-button-ghost min-h-[44px] shrink-0"
                onClick={() => remove(item.slug)}
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
