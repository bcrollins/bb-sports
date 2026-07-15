import { ACCESS_WALL_CONFIG_KEY, type AccessWallConfig } from '@/lib/access-wall';
import { requireAdminPage } from '@/lib/admin-auth';
import { getConfig } from '@/lib/queries';
import AccessWallForm from './AccessWallForm';

export const dynamic = 'force-dynamic';

export default async function AccessWallPage() {
  await requireAdminPage('/admin/access-wall');
  const config = await getConfig<AccessWallConfig | null>(ACCESS_WALL_CONFIG_KEY, null);
  const mode = config?.passwordHash ? 'admin + operator managed' : 'operator managed';

  return (
    <div>
      <header className="border-b border-navy/15 pb-3 mb-8">
        <p className="font-mono text-[11px] uppercase tracking-[0.3em] text-broadcast-red">
          -- Launch access
        </p>
        <h1 className="font-display italic text-4xl mt-1">Access wall</h1>
        <p className="mt-1 max-w-2xl text-sm text-navy/70">
          Controls the plain white screen in front of the site. The wall opens public site access only;
          admin publishing still requires the newsroom login.
        </p>
      </header>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <AccessWallForm mode={mode} updatedAt={config?.updatedAt ?? null} />

        <aside className="rounded-lg border border-navy/10 bg-white p-5 shadow-sm">
          <h2 className="font-serif text-xl font-bold text-navy">Current behavior</h2>
          <ul className="mt-4 space-y-3 text-sm text-charcoal/80">
            <li>Visitors without the wall cookie see only a white password screen.</li>
            <li>Entering the wall password sets a signed, httpOnly cookie.</li>
            <li>Rotating the Railway cookie secret revokes every existing wall cookie.</li>
            <li>Admin login remains protected by the separate Bradley newsroom account.</li>
            <li>The operator recovery password lives in Railway and is never shown in source or this dashboard.</li>
          </ul>
        </aside>
      </div>
    </div>
  );
}
