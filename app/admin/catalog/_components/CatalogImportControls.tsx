'use client';

import { useState } from 'react';

export function CatalogImportControls({ missingSlugs }: { missingSlugs: string[] }) {
  const [busy, setBusy] = useState(false);
  const [log, setLog] = useState<string>('');

  async function run(dryRun: boolean) {
    setBusy(true);
    setLog(dryRun ? 'Running dry-run…' : 'Importing drafts…');
    try {
      const res = await fetch('/api/admin/catalog', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dryRun,
          slugs: missingSlugs.length > 0 ? missingSlugs : undefined,
        }),
      });
      const body = await res.json();
      if (!res.ok) {
        setLog(body.error || `Failed (${res.status})`);
        return;
      }
      const r = body.result;
      setLog(
        [
          body.notice,
          `considered=${r.considered.length}`,
          `imported=${r.imported.join(', ') || '—'}`,
          `skipped=${r.skippedExisting.join(', ') || '—'}`,
          `errors=${r.errors.length}`,
        ].join('\n'),
      );
      if (!dryRun && r.imported.length > 0) {
        window.location.reload();
      }
    } catch (err) {
      setLog(err instanceof Error ? err.message : 'Request failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-4 flex flex-col gap-3">
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={busy || missingSlugs.length === 0}
          onClick={() => void run(true)}
          className="bb-button-ghost min-h-[44px] disabled:opacity-40"
        >
          Dry-run import
        </button>
        <button
          type="button"
          disabled={busy || missingSlugs.length === 0}
          onClick={() => void run(false)}
          className="bb-button-primary min-h-[44px] disabled:opacity-40"
        >
          Import as drafts
        </button>
      </div>
      {log ? (
        <pre className="whitespace-pre-wrap rounded bg-navy/5 p-3 text-xs text-navy">{log}</pre>
      ) : null}
    </div>
  );
}
