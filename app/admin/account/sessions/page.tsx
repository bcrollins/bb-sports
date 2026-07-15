import Link from 'next/link';
import { requireAdminPage } from '@/lib/admin-auth';
import { getSession } from '@/lib/auth';
import { listSafeSessionsForUser } from '@/lib/admin-sessions';
import { SessionRevokeControls } from './SessionRevokeControls';

export const dynamic = 'force-dynamic';

export default async function AdminSessionsPage() {
  const user = await requireAdminPage('/admin/account/sessions');
  const session = await getSession();
  const rows = await listSafeSessionsForUser({
    userId: user.id,
    currentJti: session?.jti ?? null,
  });
  const activeCount = rows.filter((r) => r.active).length;

  return (
    <div>
      <header className="mb-8 border-b border-navy/15 pb-3">
        <p className="text-[10px] font-black uppercase tracking-[0.22em] text-navy/45">Account</p>
        <h1 className="mt-1 font-display text-3xl italic text-navy">Sessions</h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-charcoal/80">
          Recognize devices signed into the newsroom and revoke anything that is not yours. Raw IP
          addresses and session tokens are never shown. Signed in as{' '}
          <strong>{user.email}</strong>.
        </p>
        <p className="mt-2 font-mono text-[11px] uppercase tracking-[0.16em] text-navy/50">
          {activeCount} active · {rows.length} recent
        </p>
      </header>

      {rows.length === 0 ? (
        <p className="text-sm text-navy/60">No session rows yet for this account.</p>
      ) : (
        <div className="space-y-3">
          {rows.map((row) => (
            <article
              key={row.id}
              className={`rounded border bg-white p-4 shadow-sm ${
                row.isCurrent ? 'border-breaking/40' : 'border-navy/10'
              }`}
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="font-serif text-lg font-bold text-navy-900">
                    {row.deviceSummary}
                    {row.isCurrent ? (
                      <span className="ml-2 align-middle text-[10px] font-black uppercase tracking-[0.16em] text-breaking">
                        This device
                      </span>
                    ) : null}
                  </h2>
                  <p className="mt-1 font-mono text-xs text-navy/55">{row.sessionLabel}</p>
                  <p className="mt-2 text-sm text-charcoal/80">{row.networkSummary}</p>
                  <dl className="mt-3 grid gap-1 text-xs text-navy/60 sm:grid-cols-2">
                    <div>
                      <dt className="font-mono uppercase tracking-[0.14em] text-navy/40">Started</dt>
                      <dd>{new Date(row.createdAt).toLocaleString()}</dd>
                    </div>
                    <div>
                      <dt className="font-mono uppercase tracking-[0.14em] text-navy/40">Expires</dt>
                      <dd>{new Date(row.expiresAt).toLocaleString()}</dd>
                    </div>
                    <div>
                      <dt className="font-mono uppercase tracking-[0.14em] text-navy/40">Status</dt>
                      <dd>
                        {row.revokedAt
                          ? `Revoked ${new Date(row.revokedAt).toLocaleString()}`
                          : row.active
                            ? 'Active'
                            : 'Expired'}
                      </dd>
                    </div>
                  </dl>
                </div>
                {row.active ? (
                  <SessionRevokeControls
                    sessionId={row.id}
                    isCurrent={row.isCurrent}
                    label={row.sessionLabel}
                  />
                ) : null}
              </div>
            </article>
          ))}
        </div>
      )}

      <div className="mt-8 rounded border border-navy/10 bg-white p-4">
        <h2 className="font-serif text-xl font-bold text-navy-900">Sign out other devices</h2>
        <p className="mt-2 text-sm text-charcoal/80">
          Keeps this browser signed in and revokes every other active newsroom session.
        </p>
        <SessionRevokeControls mode="others" />
      </div>

      <p className="mt-6 text-sm text-navy/55">
        <Link className="underline decoration-breaking underline-offset-4" href="/admin">
          ← Command
        </Link>
      </p>
    </div>
  );
}
