import Link from 'next/link';

export const metadata = {
  title: 'Admin · BB Sports',
  description: 'Internal admin dashboard for BB Sports — auth required.',
  robots: { index: false, follow: false }
};

// v1 admin shell — placeholder UI showing the editorial pipeline that will
// be wired up post-launch. Auth gate added in v1.1 (NextAuth or magic-link
// via Resend, internal-first per the BB Sports Perfection Engine).

const AI_DRAFT_QUEUE = [
  { id: 1, title: 'Auto-summary: Schefter — QB transaction roundup', sport: 'NFL', words: 287, voiceFidelity: 6.5 },
  { id: 2, title: 'Auto-power-rankings: NHL playoff teams left standing', sport: 'NHL', words: 312, voiceFidelity: 7.2 },
  { id: 3, title: 'Auto-reaction: Florida–Georgia line move overnight', sport: 'CFB', words: 198, voiceFidelity: 6.8 }
];

const TODAY_STATS = {
  unique: 0,
  pageviews: 0,
  topArticle: '—',
  newsletterSignups: 0,
  donations: 0,
  donationDollars: 0
};

export default function AdminPage() {
  return (
    <div className="bg-bone min-h-screen">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
        <header className="flex items-baseline justify-between bb-thin-rule pb-3">
          <div>
            <p className="bb-eyebrow">BB Sports — internal</p>
            <h1 className="font-serif font-extrabold text-navy-900 text-3xl">Admin dashboard</h1>
          </div>
          <Link href="/" className="bb-link text-sm">
            Back to site →
          </Link>
        </header>

        <div className="mt-8 grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: 'Unique visitors today', value: TODAY_STATS.unique },
            { label: 'Pageviews today', value: TODAY_STATS.pageviews },
            { label: 'New newsletter signups', value: TODAY_STATS.newsletterSignups },
            { label: 'Donations today', value: `${TODAY_STATS.donations} · $${TODAY_STATS.donationDollars}` }
          ].map((s) => (
            <div key={s.label} className="bg-white border border-navy/15 rounded p-4">
              <div className="bb-eyebrow">{s.label}</div>
              <div className="mt-2 text-2xl font-serif font-bold text-navy-900">{s.value}</div>
            </div>
          ))}
        </div>

        <div className="mt-10 grid lg:grid-cols-3 gap-6">
          <section className="lg:col-span-2 bg-white border border-navy/15 rounded p-5">
            <header className="flex items-baseline justify-between bb-thin-rule pb-2 mb-4">
              <h2 className="font-serif text-xl font-bold text-navy-900">AI draft queue</h2>
              <span className="text-xs text-charcoal/60">Awaiting your approval</span>
            </header>
            <ul className="divide-y divide-navy/10">
              {AI_DRAFT_QUEUE.map((d) => (
                <li key={d.id} className="py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2 text-xs">
                      <span className="bb-tag">{d.sport}</span>
                      <span className="bb-ai-badge">AI draft</span>
                      <span className="text-charcoal/60">{d.words} words</span>
                      <span className={`px-1.5 py-0.5 rounded text-[10px] uppercase font-semibold ${d.voiceFidelity >= 7 ? 'bg-navy/10 text-navy' : 'bg-breaking/10 text-breaking'}`}>
                        Voice fidelity {d.voiceFidelity.toFixed(1)}
                      </span>
                    </div>
                    <h3 className="mt-1 font-serif font-bold text-navy-900 text-base">{d.title}</h3>
                  </div>
                  <div className="flex gap-2">
                    <button className="bb-button-ghost !min-h-[36px] !py-1.5 !px-3 text-xs">Open</button>
                    <button className="bb-button-primary !min-h-[36px] !py-1.5 !px-3 text-xs">Approve</button>
                  </div>
                </li>
              ))}
            </ul>
            <p className="mt-3 text-xs text-charcoal/60">
              Pieces below voice-fidelity 7.0 cannot ship without a Brad rewrite — the system enforces this.
            </p>
          </section>

          <section className="bg-white border border-navy/15 rounded p-5">
            <header className="bb-thin-rule pb-2 mb-4">
              <h2 className="font-serif text-xl font-bold text-navy-900">Today’s queue</h2>
            </header>
            <ul className="space-y-3 text-sm">
              <li className="flex justify-between border-b border-navy/10 pb-2"><span>Drafts in progress</span><strong>0</strong></li>
              <li className="flex justify-between border-b border-navy/10 pb-2"><span>Scheduled for today</span><strong>0</strong></li>
              <li className="flex justify-between border-b border-navy/10 pb-2"><span>Comments pending review</span><strong>0</strong></li>
              <li className="flex justify-between border-b border-navy/10 pb-2"><span>Tips to triage</span><strong>0</strong></li>
              <li className="flex justify-between"><span>Corrections to review</span><strong>0</strong></li>
            </ul>
          </section>
        </div>

        <div className="mt-8 bg-bone-50 border border-navy/20 rounded p-5 text-sm text-charcoal/85">
          <strong>v1 admin note:</strong> this dashboard is a stub. Real auth (magic-link via Resend), the AI draft pipeline, comment moderation, and donation ledger ship in v1.1 within the first 30 days post-launch. Internal-first — no external CMS / ESP / CRM dependencies.
        </div>
      </div>
    </div>
  );
}
