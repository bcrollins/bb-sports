/**
 * /admin — BB Sports command center.
 *
 * One screen for Brad to understand what is live, what needs attention, and
 * where to act without touching code.
 */
import Link from 'next/link';
import type { ReactNode } from 'react';
import { sql } from 'drizzle-orm';
import { Activity, ArrowUpRight, FileText, ImageIcon, LockKeyhole, MessageSquare, PenLine, Settings, Users } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { db } from '@/lib/db/client';
import { ensureBootstrapped } from '@/lib/db/bootstrap';
import { getSession } from '@/lib/auth';
import { getAllArticles, getAudienceSnapshot, getCommentModerationCounts } from '@/lib/queries';

export const dynamic = 'force-dynamic';

interface Counts {
  total: number;
  published: number;
  drafts: number;
  aiAssisted: number;
}

async function loadCounts(): Promise<Counts> {
  if (!db) return { total: 0, published: 0, drafts: 0, aiAssisted: 0 };
  await ensureBootstrapped();
  const r = (await db.execute(sql`
    SELECT
      COUNT(*)::int AS total,
      COUNT(*) FILTER (WHERE published)::int AS published,
      COUNT(*) FILTER (WHERE NOT published)::int AS drafts,
      COUNT(*) FILTER (WHERE ai_assisted)::int AS "aiAssisted"
    FROM articles
  `)) as unknown as Counts[];
  return r[0] ?? { total: 0, published: 0, drafts: 0, aiAssisted: 0 };
}

export default async function AdminOverview() {
  const [session, counts, articles, audience, commentCounts] = await Promise.all([
    getSession(),
    loadCounts(),
    getAllArticles(),
    getAudienceSnapshot(),
    getCommentModerationCounts(),
  ]);
  const recent = articles.slice(0, 7);
  const commentReview = commentCounts.pending + commentCounts.flagged;
  const launchScore = [
    counts.published >= 5,
    audience.counts.subscribers >= 1,
    process.env.DATABASE_URL,
    process.env.JWT_SECRET,
  ].filter(Boolean).length;

  return (
    <div className="space-y-8">
      <header className="overflow-hidden rounded-xl border border-navy/10 bg-white shadow-sm">
        <div className="grid gap-0 lg:grid-cols-[minmax(0,1fr)_360px]">
          <div className="p-5 sm:p-7">
            <p className="font-mono text-[11px] uppercase tracking-[0.3em] text-broadcast-red">
              Command center
            </p>
            <h1 className="mt-2 font-display text-4xl italic leading-tight text-navy sm:text-5xl">
              Welcome back, {session?.name?.split(' ')[0] ?? 'Brad'}.
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-charcoal/75">
              Publish, edit, gate the site, review audience intake, and track launch readiness from one room.
              Nothing here requires code.
            </p>
            <div className="mt-6 flex flex-wrap gap-2">
              <CommandButton href="/admin/articles/new" label="Write" icon={PenLine} primary />
              <CommandButton href="/admin/articles" label="Articles" icon={FileText} />
              <CommandButton href="/admin/media" label="Media" icon={ImageIcon} />
              <CommandButton href="/admin/comments" label="Comments" icon={MessageSquare} />
              <CommandButton href="/admin/audience" label="Audience" icon={Users} />
              <CommandButton href="/admin/site" label="Site" icon={Settings} />
              <CommandButton href="/admin/access-wall" label="Wall" icon={LockKeyhole} />
            </div>
          </div>
          <aside className="border-t border-navy/10 bg-navy p-5 text-bone sm:p-7 lg:border-l lg:border-t-0">
            <div className="flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.24em] text-bone/60">
              <Activity size={15} /> Launch meter
            </div>
            <div className="mt-5 flex items-end gap-2">
              <span className="font-display text-6xl italic text-bone">{launchScore}</span>
              <span className="mb-3 text-sm uppercase tracking-[0.18em] text-bone/60">/ 4 green</span>
            </div>
            <div className="mt-5 grid gap-2 text-sm">
              <LaunchLine ok={counts.published >= 5} text="5+ published anchor articles" />
              <LaunchLine ok={audience.counts.subscribers >= 1} text="newsletter ledger receiving signups" />
              <LaunchLine ok={Boolean(process.env.DATABASE_URL)} text="Postgres configured" />
              <LaunchLine ok={Boolean(process.env.JWT_SECRET)} text="admin JWT secret configured" />
            </div>
          </aside>
        </div>
      </header>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <Stat label="Published" value={counts.published} note={`${counts.total} total articles`} />
        <Stat label="Drafts" value={counts.drafts} note="Brad-controlled queue" />
        <Stat label="Review" value={commentReview} note="comments pending/flagged" />
        <Stat label="Subscribers" value={audience.counts.subscribers} note="first-party list" />
        <Stat label="New inbox" value={audience.counts.contactNew} note={`${audience.counts.donationWaiting} donation waits`} />
      </section>

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_390px]">
        <div className="rounded-xl border border-navy/10 bg-white shadow-sm">
          <div className="flex items-center justify-between gap-4 border-b border-navy/10 px-5 py-4">
            <div>
              <h2 className="font-serif text-xl font-bold text-navy">Recently updated</h2>
              <p className="text-sm text-navy/55">Live articles and drafts Brad touched most recently.</p>
            </div>
            <Link href="/admin/articles" className="inline-flex items-center gap-1 text-sm font-semibold text-broadcast-red">
              Manage <ArrowUpRight size={14} />
            </Link>
          </div>
          {recent.length === 0 ? (
            <div className="p-6 text-sm text-navy/70">
              No articles yet. <Link href="/admin/articles/new" className="bb-link">Write the first one.</Link>
            </div>
          ) : (
            <ul className="divide-y divide-navy/10">
              {recent.map((a) => (
                <li key={a.id} className="grid gap-3 px-5 py-4 sm:grid-cols-[92px_minmax(0,1fr)_120px] sm:items-center">
                  <span className={`w-fit rounded-full px-3 py-1 font-mono text-[10px] uppercase tracking-[0.18em] ${
                    a.published ? 'bg-broadcast-red/10 text-broadcast-red' : 'bg-navy/10 text-navy/70'
                  }`}>
                    {a.published ? 'Live' : 'Draft'}
                  </span>
                  <Link href={`/admin/articles/${a.id}/edit`} className="min-w-0 font-serif text-lg font-bold text-navy hover:text-broadcast-red">
                    <span className="block truncate">{a.title}</span>
                    <span className="mt-0.5 block truncate text-xs font-normal text-navy/45">{a.dek}</span>
                  </Link>
                  <span className="text-xs text-navy/50 sm:text-right">{new Date(a.updatedAt).toLocaleDateString()}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <aside className="space-y-6">
          <Panel title="Next action">
            <div className="space-y-3 text-sm text-charcoal/80">
              <p>
                Highest-leverage move: keep article publishing and audience intake in the same loop.
                Draft, approve, publish, then check inbox reactions here.
              </p>
              <Link href="/admin/articles/new" className="inline-flex min-h-[42px] items-center rounded bg-broadcast-red px-4 text-xs font-black uppercase tracking-[0.18em] text-bone">
                Write next piece
              </Link>
            </div>
          </Panel>
          <Panel title="Audience pulse">
            <div className="space-y-3 text-sm">
              {audience.recentMessages.slice(0, 3).map((m) => (
                <div key={m.id} className="rounded-lg border border-navy/10 bg-bone-50 p-3">
                  <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-broadcast-red">{m.mode}</div>
                  <div className="mt-1 truncate font-semibold text-navy">{m.name || m.email}</div>
                  <p className="mt-1 line-clamp-2 text-charcoal/70">{m.message}</p>
                </div>
              ))}
              {audience.recentMessages.length === 0 ? <p className="text-navy/55">No inbound messages yet.</p> : null}
            </div>
          </Panel>
        </aside>
      </section>
    </div>
  );
}

function Stat({ label, value, note }: { label: string; value: number; note: string }) {
  return (
    <div className="rounded-xl border border-navy/10 bg-white p-5 shadow-sm">
      <p className="font-mono text-[11px] uppercase tracking-[0.25em] text-navy/55">{label}</p>
      <p className="mt-2 font-display text-5xl italic text-navy">{value}</p>
      <p className="mt-1 text-sm text-navy/55">{note}</p>
    </div>
  );
}

function CommandButton({
  href,
  label,
  icon: Icon,
  primary,
}: {
  href: string;
  label: string;
  icon: LucideIcon;
  primary?: boolean;
}) {
  return (
    <Link
      href={href}
      className={`inline-flex min-h-[44px] items-center gap-2 rounded-lg px-4 text-sm font-bold ${
        primary ? 'bg-broadcast-red text-bone' : 'border border-navy/15 bg-white text-navy hover:border-navy'
      }`}
    >
      <Icon size={16} aria-hidden="true" />
      {label}
    </Link>
  );
}

function LaunchLine({ ok, text }: { ok: boolean; text: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className={`h-2.5 w-2.5 rounded-full ${ok ? 'bg-emerald-300' : 'bg-bone/25'}`} aria-hidden="true" />
      <span className={ok ? 'text-bone' : 'text-bone/58'}>{text}</span>
    </div>
  );
}

function Panel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-xl border border-navy/10 bg-white p-5 shadow-sm">
      <h2 className="font-serif text-xl font-bold text-navy">{title}</h2>
      <div className="mt-3">{children}</div>
    </section>
  );
}
