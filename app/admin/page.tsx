/**
 * /admin — BB Sports command center.
 *
 * One screen for Brad to understand what is live, what needs attention, and
 * where to act without touching code.
 */
import Link from 'next/link';
import type { ReactNode } from 'react';
import { sql } from 'drizzle-orm';
import {
  ArrowUpRight,
  CheckCircle2,
  CircleAlert,
  CircleDashed,
  FileText,
  Gauge,
  ImageIcon,
  LockKeyhole,
  MessageSquare,
  PenLine,
  Settings,
  Users,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { getAnalyticsSnapshot } from '@/lib/analytics';
import {
  buildAdminCommandCenter,
  type AdminPriority,
  type AdminStatus,
  type OperatorAction,
  type ProviderCheck,
  type ReadinessGate,
} from '@/lib/admin-command-center';
import { db } from '@/lib/db/client';
import { ensureBootstrapped } from '@/lib/db/bootstrap';
import { requireAdminPage } from '@/lib/admin-auth';
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
  const user = await requireAdminPage('/admin');
  const [counts, articles, audience, commentCounts, analytics] = await Promise.all([
    loadCounts(),
    getAllArticles(),
    getAudienceSnapshot(),
    getCommentModerationCounts(),
    getAnalyticsSnapshot(),
  ]);
  const recent = articles.slice(0, 7);
  const command = buildAdminCommandCenter({
    articles: counts,
    audience: audience.counts,
    comments: commentCounts,
    analytics: analytics.counts,
    env: process.env,
  });
  const providerBlockers = command.providerChecks.filter((provider) => provider.status !== 'green').slice(0, 5);

  return (
    <div className="space-y-8">
      <header className="overflow-hidden rounded-xl border border-navy/10 bg-white shadow-sm">
        <div className="grid gap-0 xl:grid-cols-[minmax(0,1fr)_430px]">
          <div className="p-5 sm:p-7">
            <div className="flex flex-wrap items-center gap-2">
              <Pill tone={command.verdict === 'Ship' ? 'green' : command.verdict === 'Watch' ? 'yellow' : 'red'}>
                {command.verdict}
              </Pill>
              <Pill>{command.standingP0P1} standing P0/P1</Pill>
              <Pill>{command.providerSummary}</Pill>
            </div>
            <p className="mt-5 font-mono text-[11px] uppercase tracking-[0.3em] text-broadcast-red">
              Command center
            </p>
            <h1 className="mt-2 max-w-3xl font-display text-4xl italic leading-tight text-navy sm:text-5xl">
              {user.name.split(' ')[0] ?? 'Brad'}, this is the board.
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-charcoal/75">
              Editorial, audience, comments, provider gates, and launch risk in one operator view. The top
              action is always the next highest-value move Brad or Brandon can verify without reading code.
            </p>
            <div className="mt-6 flex flex-wrap gap-2">
              <CommandButton href="/admin/articles/new" label="Write" icon={PenLine} primary />
              <CommandButton href="/admin/articles" label="Articles" icon={FileText} />
              <CommandButton href="/admin/media" label="Media" icon={ImageIcon} />
              <CommandButton href="/admin/comments" label="Comments" icon={MessageSquare} />
              <CommandButton href="/admin/audience" label="Audience" icon={Users} />
              <CommandButton href="/admin/site" label="Site" icon={Settings} />
              <CommandButton href="/admin/access-wall" label="Access wall" icon={LockKeyhole} />
            </div>
          </div>
          <aside className="border-t border-navy/10 bg-navy p-5 text-bone sm:p-7 xl:border-l xl:border-t-0">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.24em] text-bone/60">
                <Gauge size={15} /> Readiness
              </div>
              <span className="rounded-full bg-bone/10 px-3 py-1 font-mono text-[10px] uppercase tracking-[0.18em] text-bone/70">
                Live runtime
              </span>
            </div>
            <div className="mt-5 flex items-end gap-3">
              <span className="font-display text-7xl italic leading-none text-bone">{command.readinessScore}</span>
              <span className="mb-3 text-sm uppercase tracking-[0.18em] text-bone/60">/ 100</span>
            </div>
            <div className="mt-5 h-3 overflow-hidden rounded-full bg-bone/15">
              <div
                className={`h-full rounded-full ${command.verdict === 'Ship' ? 'bg-emerald-300' : command.verdict === 'Watch' ? 'bg-amber-300' : 'bg-broadcast-red'}`}
                style={{ width: `${command.readinessScore}%` }}
              />
            </div>
            <div className="mt-5 grid gap-2 text-sm">
              {command.readinessGates.slice(0, 5).map((gate) => (
                <ReadinessLine key={gate.key} gate={gate} />
              ))}
            </div>
          </aside>
        </div>
      </header>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        {command.lanes.map((lane) => (
          <LaneCard key={lane.label} lane={lane} />
        ))}
      </section>

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_430px]">
        <div className="rounded-xl border border-navy/10 bg-white shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-navy/10 px-5 py-4">
            <div>
              <h2 className="font-serif text-xl font-bold text-navy">Operator queue</h2>
              <p className="text-sm text-navy/55">Ranked by launch risk, editorial value, and verification cost.</p>
            </div>
            <Link href="/admin/launch" className="inline-flex min-h-[40px] items-center gap-1 rounded border border-navy/15 px-3 text-xs font-bold uppercase tracking-[0.14em] text-navy/70 hover:border-broadcast-red hover:text-broadcast-red">
              Launch <ArrowUpRight size={14} />
            </Link>
          </div>
          <div className="divide-y divide-navy/10">
            {command.actions.map((action) => (
              <ActionRow key={`${action.priority}-${action.label}`} action={action} />
            ))}
          </div>
        </div>

        <aside className="rounded-xl border border-navy/10 bg-white shadow-sm">
          <div className="border-b border-navy/10 px-5 py-4">
            <h2 className="font-serif text-xl font-bold text-navy">Launch gates</h2>
            <p className="text-sm text-navy/55">Weighted checks that feed the readiness score.</p>
          </div>
          <div className="divide-y divide-navy/10">
            {command.readinessGates.map((gate) => (
              <GateRow key={gate.key} gate={gate} />
            ))}
          </div>
        </aside>
      </section>

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_430px]">
        <div className="rounded-xl border border-navy/10 bg-white shadow-sm">
          <div className="flex items-center justify-between gap-4 border-b border-navy/10 px-5 py-4">
            <div>
              <h2 className="font-serif text-xl font-bold text-navy">Story desk</h2>
              <p className="text-sm text-navy/55">Recent live articles and drafts with editorial risk cues.</p>
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
                <li key={a.id} className="grid gap-3 px-5 py-4 lg:grid-cols-[minmax(0,1fr)_220px] lg:items-center">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <Pill tone={a.published ? 'red' : 'navy'}>{a.published ? 'Live' : 'Draft'}</Pill>
                      <Pill>{a.sport}</Pill>
                      {a.aiAssisted ? <Pill tone={a.bradsTake ? 'green' : 'red'}>AI-assisted</Pill> : null}
                      {a.hero ? <Pill tone={a.heroAlt && a.heroCredit ? 'green' : 'yellow'}>Hero</Pill> : null}
                    </div>
                    <Link href={`/admin/articles/${a.id}/edit`} className="mt-2 block min-w-0 font-serif text-lg font-bold leading-snug text-navy hover:text-broadcast-red">
                      {a.title}
                    </Link>
                    <p className="mt-1 line-clamp-2 text-sm leading-5 text-navy/58">{a.dek || 'No dek written yet.'}</p>
                  </div>
                  <div className="grid gap-2 text-xs text-navy/55 sm:grid-cols-3 lg:grid-cols-1 lg:text-right">
                    <span>Updated {formatDate(a.updatedAt)}</span>
                    <span>{a.publishedAt ? `Published ${formatDate(a.publishedAt)}` : 'Not published'}</span>
                    <span>{a.authorName}</span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <aside className="space-y-6">
          <Panel
            title="Provider posture"
            action={<Link href="/admin/launch" className="text-xs font-bold uppercase tracking-[0.14em] text-broadcast-red">Open</Link>}
          >
            <div className="space-y-3">
              {providerBlockers.length === 0 ? (
                <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
                  All provider checks are green in this runtime.
                </div>
              ) : (
                providerBlockers.map((provider) => <ProviderRow key={provider.key} provider={provider} />)
              )}
            </div>
          </Panel>
          <Panel
            title="Audience pulse"
            action={<Link href="/admin/audience" className="text-xs font-bold uppercase tracking-[0.14em] text-broadcast-red">Ledger</Link>}
          >
            <div className="space-y-3 text-sm">
              <div className="grid grid-cols-3 gap-2">
                <MiniStat label="7d views" value={analytics.counts.pageViews7d} />
                <MiniStat label="Searches" value={analytics.counts.searches7d} />
                <MiniStat label="NL signups" value={analytics.counts.newsletterSignups7d} />
              </div>
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

function LaneCard({ lane }: { lane: { label: string; status: AdminStatus; href: string; metric: string; detail: string } }) {
  return (
    <Link href={lane.href} className="rounded-xl border border-navy/10 bg-white p-5 shadow-sm transition-colors hover:border-broadcast-red">
      <div className="flex items-start justify-between gap-3">
        <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-navy/55">{lane.label}</p>
        <StatusIcon status={lane.status} />
      </div>
      <p className="mt-3 font-serif text-2xl font-bold leading-tight text-navy">{lane.metric}</p>
      <p className="mt-2 text-sm leading-5 text-navy/58">{lane.detail}</p>
    </Link>
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
      className={`inline-flex min-h-[44px] items-center gap-2 rounded-lg px-4 text-sm font-bold transition-colors ${
        primary ? 'bg-broadcast-red text-bone' : 'border border-navy/15 bg-white text-navy hover:border-navy'
      }`}
    >
      <Icon size={16} aria-hidden="true" />
      {label}
    </Link>
  );
}

function ActionRow({ action }: { action: OperatorAction }) {
  return (
    <article className="grid gap-3 px-5 py-4 md:grid-cols-[88px_minmax(0,1fr)_120px] md:items-center">
      <span className={`inline-flex w-fit min-w-[56px] justify-center rounded-full px-3 py-1 font-mono text-[11px] font-black uppercase tracking-[0.16em] ${priorityClass(action.priority)}`}>
        {action.priority}
      </span>
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="font-serif text-lg font-bold leading-tight text-navy">{action.label}</h3>
          <Pill>{action.owner}</Pill>
        </div>
        <p className="mt-1 text-sm leading-5 text-navy/62">{action.detail}</p>
      </div>
      <Link href={action.href} className="inline-flex min-h-[40px] items-center justify-center rounded bg-navy px-3 text-xs font-black uppercase tracking-[0.14em] text-bone hover:bg-broadcast-red">
        {action.cta}
      </Link>
    </article>
  );
}

function GateRow({ gate }: { gate: ReadinessGate }) {
  return (
    <Link href={gate.href} className="grid gap-3 px-5 py-4 transition-colors hover:bg-bone-50 sm:grid-cols-[minmax(0,1fr)_72px] sm:items-center">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <StatusIcon status={gate.status} />
          <h3 className="font-serif text-base font-bold text-navy">{gate.label}</h3>
          <Pill>{gate.weight} pts</Pill>
        </div>
        <p className="mt-1 text-sm leading-5 text-navy/58">{gate.detail}</p>
      </div>
      <div className="font-mono text-sm font-bold uppercase tracking-[0.14em] text-navy/60 sm:text-right">{gate.metric}</div>
    </Link>
  );
}

function ReadinessLine({ gate }: { gate: ReadinessGate }) {
  return (
    <div className="flex items-center gap-2">
      <span
        className={`h-2.5 w-2.5 rounded-full ${gate.status === 'green' ? 'bg-emerald-300' : gate.status === 'yellow' ? 'bg-amber-300' : 'bg-broadcast-red'}`}
        aria-hidden="true"
      />
      <span className={gate.status === 'green' ? 'text-bone' : 'text-bone/62'}>{gate.label}</span>
      <span className="ml-auto font-mono text-xs text-bone/55">{gate.metric}</span>
    </div>
  );
}

function ProviderRow({ provider }: { provider: ProviderCheck }) {
  return (
    <div className="rounded-lg border border-navy/10 bg-bone-50 p-3">
      <div className="flex items-start gap-2">
        <StatusIcon status={provider.status} />
        <div className="min-w-0">
          <div className="font-serif font-bold text-navy">{provider.label}</div>
          <code className="text-[11px] text-navy/50">{provider.env}</code>
          <p className="mt-1 text-xs leading-5 text-navy/58">{provider.detail}</p>
        </div>
      </div>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-navy/10 bg-white p-3">
      <p className="font-mono text-[9px] uppercase tracking-[0.18em] text-navy/45">{label}</p>
      <p className="mt-1 font-display text-3xl italic text-navy">{value}</p>
    </div>
  );
}

function Panel({ title, action, children }: { title: string; action?: ReactNode; children: ReactNode }) {
  return (
    <section className="rounded-xl border border-navy/10 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-serif text-xl font-bold text-navy">{title}</h2>
        {action}
      </div>
      <div className="mt-3">{children}</div>
    </section>
  );
}

function StatusIcon({ status }: { status: AdminStatus }) {
  if (status === 'green') return <CheckCircle2 size={17} className="shrink-0 text-emerald-600" aria-hidden="true" />;
  if (status === 'yellow') return <CircleDashed size={17} className="shrink-0 text-amber-600" aria-hidden="true" />;
  return <CircleAlert size={17} className="shrink-0 text-broadcast-red" aria-hidden="true" />;
}

function Pill({ tone = 'navy', children }: { tone?: 'navy' | 'red' | 'green' | 'yellow'; children: ReactNode }) {
  const toneClass = {
    navy: 'bg-navy/10 text-navy/70',
    red: 'bg-broadcast-red/10 text-broadcast-red',
    green: 'bg-emerald-100 text-emerald-800',
    yellow: 'bg-amber-100 text-amber-800',
  }[tone];
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 font-mono text-[10px] font-black uppercase tracking-[0.16em] ${toneClass}`}>
      {children}
    </span>
  );
}

function priorityClass(priority: AdminPriority): string {
  if (priority === 'P0') return 'bg-broadcast-red text-bone';
  if (priority === 'P1') return 'bg-amber-100 text-amber-800';
  return 'bg-navy/10 text-navy/68';
}

function formatDate(date: Date | string | null): string {
  if (!date) return '-';
  return new Date(date).toLocaleDateString();
}
