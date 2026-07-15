'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  FACT_CHECK_CHECKLIST,
  isFactCheckComplete,
} from '@/lib/fact-check-checklist';

/**
 * Client checklist for Brad — required at publish via attestation ids;
 * never rewrites prose.
 */
export default function FactCheckChecklist({
  storageKey = 'bb-fact-check-default',
  onAttestationChange,
}: {
  storageKey?: string;
  /** Emits checked ids whenever the checklist changes (for publish attestation). */
  onAttestationChange?: (checkedIds: string[], complete: boolean) => void;
}) {
  const [checked, setChecked] = useState<Record<string, boolean>>(() => {
    if (typeof window === 'undefined') return {};
    try {
      const raw = window.sessionStorage.getItem(storageKey);
      return raw ? (JSON.parse(raw) as Record<string, boolean>) : {};
    } catch {
      return {};
    }
  });

  const checkedIds = useMemo(
    () => Object.keys(checked).filter((id) => checked[id]),
    [checked],
  );

  const complete = useMemo(() => isFactCheckComplete(checkedIds), [checkedIds]);

  useEffect(() => {
    onAttestationChange?.(checkedIds, complete);
  }, [checkedIds, complete, onAttestationChange]);

  function toggle(id: string) {
    setChecked((prev) => {
      const next = { ...prev, [id]: !prev[id] };
      try {
        window.sessionStorage.setItem(storageKey, JSON.stringify(next));
      } catch {
        // sessionStorage optional
      }
      return next;
    });
  }

  return (
    <section
      className="rounded border border-navy/15 bg-white p-4 shadow-sm"
      aria-labelledby="fact-check-heading"
    >
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <p className="font-mono text-[10px] font-black uppercase tracking-[0.2em] text-navy/45">
            Pre-publish
          </p>
          <h2 id="fact-check-heading" className="mt-1 font-serif text-xl font-bold text-navy-900">
            Fact-check checklist
          </h2>
        </div>
        <p
          className={`font-mono text-[10px] font-black uppercase tracking-[0.16em] ${
            complete ? 'text-emerald-800' : 'text-breaking'
          }`}
          role="status"
          aria-live="polite"
        >
          {complete ? 'Required items done' : 'Required items open'}
        </p>
      </div>
      <p className="mt-2 text-sm text-charcoal/75">
        Advisory only. Checking boxes does not publish, unpublish, or rewrite prose.
      </p>
      <ul className="mt-4 space-y-3">
        {FACT_CHECK_CHECKLIST.map((item) => (
          <li key={item.id}>
            <label className="flex min-h-[44px] cursor-pointer items-start gap-3 rounded border border-navy/10 px-3 py-2 hover:bg-bone-50">
              <input
                type="checkbox"
                className="mt-1 h-5 w-5 accent-navy"
                checked={Boolean(checked[item.id])}
                onChange={() => toggle(item.id)}
              />
              <span>
                <span className="block text-sm font-semibold text-navy-900">
                  {item.label}
                  {item.required ? (
                    <span className="ml-2 font-mono text-[10px] uppercase tracking-[0.14em] text-breaking">
                      Required
                    </span>
                  ) : (
                    <span className="ml-2 font-mono text-[10px] uppercase tracking-[0.14em] text-navy/40">
                      Optional
                    </span>
                  )}
                </span>
                <span className="mt-0.5 block text-xs leading-5 text-charcoal/70">{item.detail}</span>
              </span>
            </label>
          </li>
        ))}
      </ul>
    </section>
  );
}
