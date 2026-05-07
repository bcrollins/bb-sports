/**
 * /admin — Bradley's newsroom overview.
 *
 * Server-rendered. Pulls live counts from Postgres so what Brad sees here is
 * the same source of truth the public site reads from.
 */
import Link from 'next/link';
import { sql } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import { ensureBootstrapped } from '@/lib/db/bootstrap';
import { getSession } from '@/lib/auth';
import { getAllArticles } from '@/lib/queries';

export const dynamic = 'force-dynamic';

interface Counts { total: number; published: number; drafts: number; }

async function loadCounts(): Promise<Counts> {
  if (!db) return { total: 0, published: 0, drafts: 0 };
  await ensureBootstrapped();
  const r = (await db.execute(sql`
    SELECT
      COUNT(*)::int AS total,
      COUNT(*) FILTER (WHERE published)::int AS published,
      COUNT(*) FILTER (WHERE NOT published)::int AS drafts
    FROM articles
  `)) as unknown as Counts[];
  return r[0] ?? { total: 0, published: 0, drafts: 0 };
}

export default async function AdminOverview() {
  const session = await getSession();
  const counts = await loadCounts();
  const recent = (await getAllArticles()).slice(0, 6);

  return (
    <div>
      <header className="border-b border-navy/15 pb-3 mb-8">
        <p className="font-mono text-[11px] uppercase tracking-[0.3em] text-broadcast-red">
          ── Newsroom · {session?.role}
        </p>
        <h1 className="font-display italic text-4xl mt-1">Welcome back, {session?.name?.split(' ')[0] ?? 'Brad'}.</h1>
        <p className="text-navy/70 text-sm mt-1">
          You&rsquo;re the only person with the keys. Everything you publish here goes live on{' '}
          <Link href="/" className="underline hover:text-broadcast-red">
            bbsports
          </Link>{' '}
          immediately.
        </p>
      </header>

      <div className="grid sm:grid-cols-3 gap-4 mb-10">
        <Stat label="Total articles" value={counts.total} />
        <Stat label="Published" value={counts.published} />
        <Stat label="Drafts" value={counts.drafts} />
      </div>

      <section className="mb-10 grid md:grid-cols-2 gap-4">
        <ActionCard
          href="/admin/articles/new"
          title="Write a new article"
          body="Markdown editor, hero image URL, sport tag, publish toggle. Goes live instantly."
        />
        <ActionCard
          href="/admin/site"
          title="Edit the site"
          body="Breaking-news ticker, hero copy, about page bio. No code required."
        />
        <ActionCard
          href="/admin/articles"
          title="Manage all articles"
          body="Edit, unpublish, delete. Sort by sport or status."
        />
        <ActionCard
          href="/"
          title="Open the live site"
          body="See what readers see right now."
          external
        />
      </section>

      <section>
        <header className="flex items-baseline justify-between border-b border-navy/15 pb-2 mb-4">
          <h2 className="font-display italic text-2xl">Recently updated</h2>
          <Link href="/admin/articles" className="text-sm text-broadcast-red underline-offset-2 hover:underline">
            All articles →
          </Link>
        </header>
        {recent.length === 0 ? (
          <div className="bg-white border border-navy/10 rounded p-6 text-sm text-navy/70">
            No articles yet. <Link href="/admin/articles/new" className="text-broadcast-red underline">Write the first one.</Link>
          </div>
        ) : (
          <ul className="divide-y divide-navy/10 bg-white border border-navy/10 rounded">
            {recent.map((a) => (
              <li key={a.id} className="px-4 py-3 flex items-center gap-4">
                <span className={`font-mono text-[10px] uppercase tracking-[0.2em] px-2 py-1 rounded ${
                  a.published ? 'bg-broadcast-red/10 text-broadcast-red' : 'bg-navy/10 text-navy/70'
                }`}>
                  {a.published ? 'LIVE' : 'DRAFT'}
                </span>
                <Link href={`/admin/articles/${a.id}/edit`} className="font-serif font-bold text-navy hover:text-broadcast-red flex-1 truncate">
                  {a.title}
                </Link>
                <span className="text-xs text-navy/50 hidden sm:inline">{a.sport}</span>
                <span className="text-xs text-navy/40 hidden md:inline">
                  {new Date(a.updatedAt).toLocaleDateString()}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="bg-white border border-navy/10 rounded p-5">
      <p className="font-mono text-[11px] uppercase tracking-[0.25em] text-navy/60">{label}</p>
      <p className="font-display italic text-5xl mt-1">{value}</p>
    </div>
  );
}

function ActionCard({ href, title, body, external }: { href: string; title: string; body: string; external?: boolean }) {
  const Wrapper = external ? 'a' : Link;
  const props: { href: string; target?: string; rel?: string } = { href };
  if (external) {
    props.target = '_blank';
    props.rel = 'noreferrer';
  }
  return (
    <Wrapper
      {...props}
      className="block bg-white border border-navy/10 rounded p-5 hover:border-broadcast-red transition-colors"
    >
      <h3 className="font-serif font-bold text-navy text-lg">{title}</h3>
      <p className="text-sm text-navy/70 mt-1">{body}</p>
    </Wrapper>
  );
}
