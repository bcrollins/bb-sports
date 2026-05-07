import Link from 'next/link';
import { CheckCircle2, CircleAlert, CircleDashed } from 'lucide-react';
import { getAllArticles, getAudienceSnapshot } from '@/lib/queries';

export const dynamic = 'force-dynamic';

const PROVIDERS = [
  { name: 'Postgres', env: 'DATABASE_URL', owner: 'Internal data source' },
  { name: 'Admin JWT', env: 'JWT_SECRET', owner: 'Admin auth' },
  { name: 'Stripe donations', env: 'STRIPE_DONATION_LINK', owner: 'Donation rails' },
  { name: 'Resend', env: 'RESEND_API_KEY', owner: 'Email transport' },
  { name: 'xAI Grok key', env: 'XAI_API_KEY', owner: 'AI draft/media assistance' },
  { name: 'xAI commercial gate', env: 'BBSPORTS_APPROVED_XAI', owner: 'Commercial-use approval flag' },
  { name: 'Cloudflare R2', env: 'R2_BUCKET_NAME', owner: 'Media storage' },
];

export default async function LaunchPage() {
  const [articles, audience] = await Promise.all([getAllArticles(), getAudienceSnapshot()]);
  const published = articles.length;
  const aiLabelOk = articles.every((a) => !a.aiAssisted || Boolean(a.bradsTake));

  const checks = [
    {
      label: 'Anchor article inventory',
      ok: published >= 5,
      detail: `${published}/5 published anchor pieces.`,
      href: '/admin/articles',
    },
    {
      label: 'Newsletter ledger',
      ok: audience.counts.subscribers > 0,
      detail: `${audience.counts.subscribers} subscriber records in Postgres.`,
      href: '/admin/audience',
    },
    {
      label: 'AI label discipline',
      ok: aiLabelOk,
      detail: aiLabelOk ? 'AI-assisted public pieces have Brad take slots.' : 'An AI-assisted piece is missing Brad’s Take.',
      href: '/admin/articles',
    },
    {
      label: 'White access wall',
      ok: true,
      detail: 'Site wall is active before public launch.',
      href: '/admin/access-wall',
    },
  ];

  return (
    <div className="space-y-8">
      <header className="border-b border-navy/15 pb-3">
        <p className="font-mono text-[11px] uppercase tracking-[0.3em] text-broadcast-red">
          -- Launch control
        </p>
        <h1 className="font-display italic text-4xl mt-1">Launch readiness</h1>
        <p className="mt-1 max-w-2xl text-sm text-navy/70">
          A live operating checklist for the site Brad will open on his phone. Green here does not mean
          public launch; it means this repo can tell the truth about its launch posture.
        </p>
      </header>

      <section className="grid gap-4 lg:grid-cols-2">
        {checks.map((check) => (
          <Link key={check.label} href={check.href} className="rounded-xl border border-navy/10 bg-white p-5 shadow-sm transition-colors hover:border-broadcast-red">
            <div className="flex items-start gap-3">
              {check.ok ? (
                <CheckCircle2 className="mt-0.5 text-emerald-600" size={22} />
              ) : (
                <CircleAlert className="mt-0.5 text-broadcast-red" size={22} />
              )}
              <div>
                <h2 className="font-serif text-xl font-bold text-navy">{check.label}</h2>
                <p className="mt-1 text-sm text-charcoal/75">{check.detail}</p>
              </div>
            </div>
          </Link>
        ))}
      </section>

      <section className="rounded-xl border border-navy/10 bg-white shadow-sm">
        <div className="border-b border-navy/10 px-5 py-4">
          <h2 className="font-serif text-xl font-bold text-navy">Provider posture</h2>
          <p className="text-sm text-navy/55">GREEN means configured in this runtime; YELLOW means intentionally degraded or queued.</p>
        </div>
        <div className="divide-y divide-navy/10">
          {PROVIDERS.map((provider) => {
            const configured = provider.env === 'BBSPORTS_APPROVED_XAI'
              ? process.env[provider.env] === 'true'
              : Boolean(process.env[provider.env]);
            return (
              <div key={provider.env} className="grid gap-3 px-5 py-4 sm:grid-cols-[minmax(0,1fr)_160px_120px] sm:items-center">
                <div>
                  <div className="font-serif font-bold text-navy">{provider.name}</div>
                  <div className="text-sm text-navy/55">{provider.owner}</div>
                </div>
                <code className="font-mono text-xs text-navy/60">{provider.env}</code>
                <span className={`inline-flex w-fit items-center gap-2 rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-[0.16em] ${
                  configured ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'
                }`}>
                  {configured ? <CheckCircle2 size={13} /> : <CircleDashed size={13} />}
                  {configured ? 'Green' : 'Yellow'}
                </span>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
