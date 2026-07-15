import { requireAdminPage } from '@/lib/admin-auth';
import { listAdminAuditEvents } from '@/lib/admin-audit';

export const dynamic = 'force-dynamic';

export default async function AdminAuditPage() {
  await requireAdminPage('/admin/audit');
  const events = await listAdminAuditEvents(80);

  return (
    <div>
      <header className="mb-8 border-b border-navy/15 pb-3">
        <p className="text-[10px] font-black uppercase tracking-[0.22em] text-navy/45">Security</p>
        <h1 className="mt-1 font-display text-3xl italic text-navy">Audit log</h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-charcoal/80">
          Append-only admin actions. No passwords, tokens, or confidential tip bodies are stored.
        </p>
      </header>

      {events.length === 0 ? (
        <p className="text-sm text-navy/60">No audit events yet.</p>
      ) : (
        <div className="overflow-x-auto rounded border border-navy/10 bg-white">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-navy/10 text-[10px] font-black uppercase tracking-[0.16em] text-navy/50">
              <tr>
                <th className="px-3 py-2">When</th>
                <th className="px-3 py-2">Actor</th>
                <th className="px-3 py-2">Action</th>
                <th className="px-3 py-2">Summary</th>
              </tr>
            </thead>
            <tbody>
              {events.map((e) => (
                <tr key={e.id} className="border-b border-navy/5">
                  <td className="whitespace-nowrap px-3 py-2 font-mono text-xs text-navy/60">
                    {new Date(e.createdAt).toLocaleString()}
                  </td>
                  <td className="px-3 py-2 text-xs">{e.actorEmail || '—'}</td>
                  <td className="px-3 py-2 font-mono text-xs">{e.action}</td>
                  <td className="px-3 py-2 text-charcoal/85">{e.summary}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
