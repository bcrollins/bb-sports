'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import {
  loadShortcutIds,
  resolveShortcuts,
  saveShortcutIds,
  SHORTCUT_CATALOG,
  SHORTCUTS_MAX,
  type ShortcutDef,
} from '@/lib/reader-shortcuts';

export default function QuickAccessRail() {
  const [ids, setIds] = useState<string[]>([]);
  const [ready, setReady] = useState(false);
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    setIds(loadShortcutIds());
    setReady(true);
  }, []);

  const shortcuts: ShortcutDef[] = resolveShortcuts(ids);

  function toggle(id: string) {
    setIds((prev) => {
      const next = prev.includes(id)
        ? prev.filter((x) => x !== id)
        : prev.length >= SHORTCUTS_MAX
          ? prev
          : [...prev, id];
      saveShortcutIds(next);
      return next;
    });
  }

  if (!ready) return null;

  return (
    <section
      className="border-b border-navy/15 bg-white px-4 py-6 sm:px-6"
      aria-labelledby="quick-access-heading"
    >
      <div className="mx-auto max-w-7xl">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="bb-eyebrow !text-breaking">Your shortcuts</p>
            <h2 id="quick-access-heading" className="mt-1 font-serif text-2xl font-bold text-navy-900">
              One-tap destinations
            </h2>
            <p className="mt-1 max-w-xl text-sm text-charcoal/70">
              Local only — pick up to {SHORTCUTS_MAX} safe internal links. Default homepage stays
              chronological for everyone.
            </p>
          </div>
          <button
            type="button"
            className="bb-button-ghost min-h-[44px]"
            aria-expanded={editing}
            onClick={() => setEditing((v) => !v)}
          >
            {editing ? 'Done' : shortcuts.length ? 'Edit shortcuts' : 'Add shortcuts'}
          </button>
        </div>

        {shortcuts.length > 0 ? (
          <ul className="mt-4 flex flex-wrap gap-2">
            {shortcuts.map((s) => (
              <li key={s.id}>
                <Link
                  href={s.href}
                  className="inline-flex min-h-[44px] items-center rounded border border-navy/20 bg-bone-50 px-4 text-sm font-bold text-navy transition-colors hover:border-breaking hover:text-breaking"
                >
                  {s.label}
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-4 text-sm text-navy/55">No shortcuts yet — add a few for faster desk hops.</p>
        )}

        {editing ? (
          <ul className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {SHORTCUT_CATALOG.map((s) => {
              const on = ids.includes(s.id);
              return (
                <li key={s.id}>
                  <button
                    type="button"
                    aria-pressed={on}
                    disabled={!on && ids.length >= SHORTCUTS_MAX}
                    onClick={() => toggle(s.id)}
                    className={`flex min-h-[48px] w-full items-center justify-between rounded border px-3 text-left text-sm ${
                      on
                        ? 'border-navy bg-navy text-bone'
                        : 'border-navy/15 bg-white text-navy hover:border-navy/40 disabled:opacity-40'
                    }`}
                  >
                    <span className="font-semibold">{s.label}</span>
                    <span className="font-mono text-[10px] opacity-70">{s.href}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        ) : null}
      </div>
    </section>
  );
}
