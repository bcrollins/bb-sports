/**
 * /admin/audience — first-party intake ledger.
 *
 * This is the operating screen for pre-launch growth: newsletter subscribers,
 * tips / sponsor messages, and donation-interest rows live in BB Sports' own
 * database before any external transport is wired in.
 */
import type { ReactNode } from 'react';
import { getAnalyticsSnapshot } from '@/lib/analytics';
import {
  compactStripeId,
  donationStatusLabel,
  donationStatusTone,
  formatDonationMoney,
} from '@/lib/donation-ledger';
import { getAudienceSnapshot } from '@/lib/queries';

export const dynamic = 'force-dynamic';

export default async function AudiencePage() {
  const [snapshot, analytics] = await Promise.all([
    getAudienceSnapshot(),
    getAnalyticsSnapshot(),
  ]);

  return (
    <div>
      <header className="border-b border-navy/15 pb-3 mb-8">
        <p className="font-mono text-[11px] uppercase tracking-[0.3em] text-broadcast-red">
          -- Audience ops
        </p>
        <h1 className="font-display italic text-4xl mt-1">Audience ledger</h1>
        <p className="text-navy/70 text-sm mt-1">
          Newsletter, tips, sponsor interest, and donation intent. First-party records, no spreadsheet drift.
        </p>
      </header>

      <div className="mb-10 grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <Stat label="Subscribers" value={snapshot.counts.subscribers} />
        <Stat label="New messages" value={snapshot.counts.contactNew} />
        <Stat label="Donation waits" value={snapshot.counts.donationWaiting} />
        <Stat label="Checkout open" value={snapshot.counts.donationOpen} />
        <Stat label="Support gross" value={formatDonationMoney(snapshot.counts.donationPaidCents, 'usd', '$0.00')} />
      </div>

      <div className="grid sm:grid-cols-3 lg:grid-cols-6 gap-4 mb-10">
        <Stat label="Events 7d" value={analytics.counts.events7d} />
        <Stat label="Page views" value={analytics.counts.pageViews7d} />
        <Stat label="Article views" value={analytics.counts.articleViews7d} />
        <Stat label="Searches" value={analytics.counts.searches7d} />
        <Stat label="Support intent" value={analytics.counts.donationInterest7d} />
        <Stat label="NL signups" value={analytics.counts.newsletterSignups7d} />
      </div>

      <section className="grid gap-8">
        <LedgerSection title="First-party analytics">
          {analytics.recentEvents.length === 0 ? (
            <Empty text="No analytics events recorded yet." />
          ) : (
            <div className="grid gap-4 lg:grid-cols-2">
              <div className="overflow-x-auto bg-white border border-navy/10 rounded">
                <table className="w-full text-sm">
                  <thead className="bg-bone-50 border-b border-navy/10 text-left">
                    <tr className="font-mono uppercase text-[10px] tracking-[0.18em] text-navy/60">
                      <th className="px-4 py-2.5">Event</th>
                      <th className="px-4 py-2.5">Path</th>
                      <th className="px-4 py-2.5">When</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-navy/10">
                    {analytics.recentEvents.map((event) => (
                      <tr key={event.id}>
                        <td className="px-4 py-2.5 font-mono text-xs">{event.eventName}</td>
                        <td className="px-4 py-2.5">{event.path}</td>
                        <td className="px-4 py-2.5 text-navy/55">{event.createdAt.toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="grid gap-3">
                <MiniRank title="Top events" rows={analytics.topEvents.map((row) => [row.eventName, row.count])} />
                <MiniRank title="Top paths" rows={analytics.topPaths.map((row) => [row.path, row.count])} />
              </div>
            </div>
          )}
        </LedgerSection>

        <LedgerSection title="Recent subscribers">
          {snapshot.recentSubscribers.length === 0 ? (
            <Empty text="No newsletter subscribers recorded yet." />
          ) : (
            <div className="overflow-x-auto bg-white border border-navy/10 rounded">
              <table className="w-full text-sm">
                <thead className="bg-bone-50 border-b border-navy/10 text-left">
                  <tr className="font-mono uppercase text-[10px] tracking-[0.18em] text-navy/60">
                    <th className="px-4 py-2.5">Email</th>
                    <th className="px-4 py-2.5">Status</th>
                    <th className="px-4 py-2.5">Source</th>
                    <th className="px-4 py-2.5">Signups</th>
                    <th className="px-4 py-2.5">Welcome</th>
                    <th className="px-4 py-2.5">Updated</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-navy/10">
                  {snapshot.recentSubscribers.map((s) => (
                    <tr key={s.id}>
                      <td className="px-4 py-2.5 font-mono text-xs">{s.email}</td>
                      <td className="px-4 py-2.5">{s.status}</td>
                      <td className="px-4 py-2.5">{s.source}</td>
                      <td className="px-4 py-2.5">{s.signupCount}</td>
                      <td className="px-4 py-2.5">
                        {s.welcomeSentAt ? (
                          <span className="text-emerald-700">Sent {s.welcomeSentAt.toLocaleDateString()}</span>
                        ) : s.welcomeError ? (
                          <span className="text-broadcast-red">Failed</span>
                        ) : (
                          <span className="text-navy/45">Not sent</span>
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-navy/55">{s.updatedAt.toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </LedgerSection>

        <LedgerSection title="Inbox">
          {snapshot.recentMessages.length === 0 ? (
            <Empty text="No contact messages recorded yet." />
          ) : (
            <div className="grid gap-3">
              {snapshot.recentMessages.map((m) => (
                <article key={m.id} className="bg-white border border-navy/10 rounded p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge>{m.mode}</Badge>
                    {m.confidential ? <Badge tone="red">Confidential</Badge> : null}
                    <span className="text-xs text-navy/50 ml-auto">{m.createdAt.toLocaleString()}</span>
                  </div>
                  <div className="mt-2 font-serif font-bold text-navy">
                    {m.name || 'Unnamed'} · <a className="bb-link" href={`mailto:${m.email}`}>{m.email}</a>
                  </div>
                  <p className="mt-2 text-sm leading-relaxed text-charcoal/85 whitespace-pre-wrap">{m.message}</p>
                </article>
              ))}
            </div>
          )}
        </LedgerSection>

        <LedgerSection title="Donation interest">
          {snapshot.recentDonationIntents.length === 0 ? (
            <Empty text="No supporter interest recorded yet." />
          ) : (
            <div className="grid gap-3">
              {snapshot.recentDonationIntents.map((d) => (
                <article key={d.id} className="bg-white border border-navy/10 rounded p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone={donationStatusTone(d.status)}>{donationStatusLabel(d.status)}</Badge>
                    <Badge>{d.source}</Badge>
                    <span className="text-xs text-navy/50 ml-auto">{d.createdAt.toLocaleString()}</span>
                  </div>
                  <div className="mt-2 text-sm text-charcoal/85">
                    {d.email ? <a className="bb-link" href={`mailto:${d.email}`}>{d.email}</a> : 'No email'}
                    {d.name ? ` · ${d.name}` : ''}
                  </div>
                  <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
                    <LedgerMetric label="Pledged" value={formatDonationMoney(d.amountCents, 'usd')} />
                    <LedgerMetric
                      label="Received"
                      value={formatDonationMoney(d.stripeAmountReceivedCents, d.stripeCurrency || 'usd')}
                    />
                    <LedgerMetric label="Paid at" value={d.paidAt ? d.paidAt.toLocaleString() : '-'} />
                    <LedgerMetric label="Stripe session" value={compactStripeId(d.stripeCheckoutSessionId)} mono />
                    <LedgerMetric label="Payment intent" value={compactStripeId(d.stripePaymentIntentId)} mono />
                    <LedgerMetric label="Customer" value={compactStripeId(d.stripeCustomerId)} mono />
                    <LedgerMetric label="Source" value={d.source} />
                    <LedgerMetric label="Updated" value={d.updatedAt.toLocaleString()} />
                  </div>
                  {d.stripePaymentLink ? (
                    <a
                      href={d.stripePaymentLink}
                      className="mt-3 inline-flex text-xs font-semibold text-broadcast-red underline-offset-2 hover:underline"
                    >
                      Open Stripe checkout
                    </a>
                  ) : null}
                  {d.message ? <p className="mt-2 text-sm text-charcoal/80">{d.message}</p> : null}
                </article>
              ))}
            </div>
          )}
        </LedgerSection>
      </section>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="bg-white border border-navy/10 rounded p-5">
      <p className="font-mono text-[11px] uppercase tracking-[0.25em] text-navy/60">{label}</p>
      <p className="font-display italic text-5xl mt-1">{value}</p>
    </div>
  );
}

function LedgerSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <h2 className="font-display italic text-2xl border-b border-navy/15 pb-2 mb-4">{title}</h2>
      {children}
    </section>
  );
}

function LedgerMetric({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="rounded border border-navy/10 bg-bone-50 px-3 py-2">
      <p className="font-mono text-[9px] uppercase tracking-[0.18em] text-navy/45">{label}</p>
      <p className={`mt-1 truncate text-xs text-navy ${mono ? 'font-mono' : 'font-semibold'}`} title={value}>
        {value}
      </p>
    </div>
  );
}

function Badge({ children, tone = 'navy' }: { children: ReactNode; tone?: 'navy' | 'red' | 'green' | 'yellow' }) {
  const toneClass = {
    navy: 'bg-navy/10 text-navy/70',
    red: 'bg-broadcast-red/10 text-broadcast-red',
    green: 'bg-emerald-100 text-emerald-800',
    yellow: 'bg-amber-100 text-amber-800',
  }[tone];
  return (
    <span
      className={`font-mono text-[10px] uppercase tracking-[0.18em] px-2 py-1 rounded ${toneClass}`}
    >
      {children}
    </span>
  );
}

function Empty({ text }: { text: string }) {
  return <div className="bg-white border border-navy/10 rounded p-6 text-sm text-navy/70">{text}</div>;
}

function MiniRank({ title, rows }: { title: string; rows: Array<[string, number]> }) {
  return (
    <div className="bg-white border border-navy/10 rounded p-4">
      <h3 className="font-mono text-[10px] uppercase tracking-[0.2em] text-navy/60">{title}</h3>
      {rows.length === 0 ? (
        <p className="mt-2 text-sm text-navy/60">No rows yet.</p>
      ) : (
        <ul className="mt-3 space-y-2 text-sm">
          {rows.map(([label, count]) => (
            <li key={label} className="flex items-center justify-between gap-3">
              <span className="truncate">{label}</span>
              <span className="font-mono text-xs text-navy/55">{count}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
