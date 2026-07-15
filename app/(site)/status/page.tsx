import type { Metadata } from 'next';
import Link from 'next/link';
import { sql } from 'drizzle-orm';
import { db, dbAvailable } from '@/lib/db/client';
import { evaluateLiveScoresPosture } from '@/lib/live-scores';
import { getPublicReleaseManifest } from '@/lib/release-manifest';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = {
  title: 'Status',
  description: 'BB Sports public system status — no secrets, honest posture.',
  robots: { index: false, follow: false },
};

type ComponentState = 'operational' | 'degraded' | 'outage' | 'not_enabled';

async function probeDb(): Promise<{ state: ComponentState; detail: string; latencyMs: number | null }> {
  if (!dbAvailable || !db) {
    return { state: 'degraded', detail: 'Database not configured for this process.', latencyMs: null };
  }
  const start = Date.now();
  try {
    await db.execute(sql`SELECT 1`);
    const latencyMs = Date.now() - start;
    return {
      state: latencyMs > 800 ? 'degraded' : 'operational',
      detail: latencyMs > 800 ? `Database reachable but slow (${latencyMs} ms).` : 'Database reachable.',
      latencyMs,
    };
  } catch {
    return { state: 'outage', detail: 'Database unreachable.', latencyMs: null };
  }
}

function badgeClass(state: ComponentState): string {
  switch (state) {
    case 'operational':
      return 'bg-emerald-100 text-emerald-900 border-emerald-300';
    case 'degraded':
      return 'bg-amber-100 text-amber-950 border-amber-300';
    case 'outage':
      return 'bg-red-100 text-red-900 border-red-300';
    default:
      return 'bg-navy/5 text-navy/70 border-navy/15';
  }
}

export default async function StatusPage() {
  const checkedAt = new Date();
  const release = getPublicReleaseManifest();
  const web: { state: ComponentState; detail: string } = {
    state: 'operational',
    detail: 'Web process is serving this page.',
  };
  const database = await probeDb();
  const scores = evaluateLiveScoresPosture();
  const scoresState: ComponentState = scores.allowed ? 'operational' : 'not_enabled';
  const editorial: { state: ComponentState; detail: string } = {
    state: 'operational',
    detail: 'Publication requires Brad’s explicit approval. External connectors remain dark until commercial approval.',
  };

  const overall: ComponentState =
    database.state === 'outage'
      ? 'outage'
      : database.state === 'degraded'
        ? 'degraded'
        : 'operational';

  const rows: Array<{ name: string; state: ComponentState; detail: string }> = [
    { name: 'Web', state: web.state, detail: web.detail },
    {
      name: 'Database',
      state: database.state,
      detail:
        database.latencyMs != null
          ? `${database.detail} Latency ${database.latencyMs} ms.`
          : database.detail,
    },
    {
      name: 'Editorial delivery',
      state: editorial.state,
      detail: editorial.detail,
    },
    {
      name: 'Live scores',
      state: scoresState,
      detail: scores.allowed
        ? 'Licensed feed enabled.'
        : 'Not enabled — no unlicensed scrapes or invented box scores.',
    },
  ];

  return (
    <main className="min-h-screen bg-bone px-4 py-10 text-navy sm:px-6">
      <div className="mx-auto max-w-3xl">
        <p className="font-mono text-[11px] uppercase tracking-[0.3em] text-broadcast-red">
          Public status
        </p>
        <h1 className="mt-3 font-display text-4xl italic leading-tight sm:text-5xl">
          BB Sports status
        </h1>
        <p className="mt-3 max-w-2xl text-base leading-7 text-charcoal/80">
          Honest system posture. No secrets. No fake green lights. Checked at{' '}
          <time dateTime={checkedAt.toISOString()}>{checkedAt.toUTCString()}</time>.
        </p>

        <div
          className={`mt-6 inline-flex items-center gap-2 rounded-sm border px-3 py-2 text-[11px] font-black uppercase tracking-[0.18em] ${badgeClass(overall)}`}
        >
          Overall · {overall.replace('_', ' ')}
        </div>

        <ul className="mt-8 space-y-3">
          {rows.map((row) => (
            <li
              key={row.name}
              className="rounded-sm border border-navy/15 bg-white p-4 shadow-sm"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="font-serif text-xl font-bold text-navy-900">{row.name}</h2>
                <span
                  className={`inline-flex rounded-sm border px-2 py-1 text-[10px] font-black uppercase tracking-[0.16em] ${badgeClass(row.state)}`}
                >
                  {row.state.replace('_', ' ')}
                </span>
              </div>
              <p className="mt-2 text-sm leading-6 text-charcoal/80">{row.detail}</p>
            </li>
          ))}
        </ul>

        <dl className="mt-8 grid gap-3 border border-navy/10 bg-white p-4 text-sm sm:grid-cols-2">
          <div>
            <dt className="font-mono text-[10px] uppercase tracking-[0.2em] text-navy/50">Version</dt>
            <dd className="mt-1 font-semibold">{release.version}</dd>
          </div>
          <div>
            <dt className="font-mono text-[10px] uppercase tracking-[0.2em] text-navy/50">Release SHA</dt>
            <dd className="mt-1 break-all font-mono text-xs font-semibold" data-release-commit={release.commit}>
              {release.commit}
            </dd>
          </div>
          <div>
            <dt className="font-mono text-[10px] uppercase tracking-[0.2em] text-navy/50">Launch mode</dt>
            <dd className="mt-1 font-semibold">
              {release.publicLaunch ? 'Public launch' : 'Soft launch (gated)'}
            </dd>
          </div>
          <div>
            <dt className="font-mono text-[10px] uppercase tracking-[0.2em] text-navy/50">Machine probes</dt>
            <dd className="mt-1 font-semibold">
              <Link className="underline decoration-breaking underline-offset-4" href="/api/health/live">
                live
              </Link>
              {' · '}
              <Link className="underline decoration-breaking underline-offset-4" href="/api/health/ready">
                ready
              </Link>
              {' · '}
              <Link className="underline decoration-breaking underline-offset-4" href="/api/health">
                combined
              </Link>
            </dd>
          </div>
          <div>
            <dt className="font-mono text-[10px] uppercase tracking-[0.2em] text-navy/50">Home</dt>
            <dd className="mt-1 font-semibold">
              <Link className="underline decoration-breaking underline-offset-4" href="/">
                bbsports.fans
              </Link>
            </dd>
          </div>
        </dl>
      </div>
    </main>
  );
}
