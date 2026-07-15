/**
 * /admin/site — edit site-wide content without touching code.
 *
 * Three editors:
 *   1. Breaking ticker — list of {sport, text} bumpers shown across the top of every page.
 *   2. Hero copy      — eyebrow, headline, sub, CTAs on the homepage.
 *   3. About bio      — paragraph list rendered on /about.
 *
 * Server-renders the current values, hands them to a client component for editing.
 */
import Image from 'next/image';
import { requireAdminPage } from '@/lib/admin-auth';
import { BRADLEY_BRAND_ASSETS } from '@/lib/brandAssets';
import { getEditableSiteConfig } from '@/lib/editable-site-config';
import SiteConfigEditor from './SiteConfigEditor';

export const dynamic = 'force-dynamic';

export default async function SiteConfigPage() {
  await requireAdminPage('/admin/site');
  const config = await getEditableSiteConfig();
  return (
    <div>
      <header className="border-b border-navy/15 pb-3 mb-6">
        <p className="font-mono text-[11px] uppercase tracking-[0.3em] text-broadcast-red">── Site config</p>
        <h1 className="font-display italic text-4xl mt-1">Edit the site</h1>
        <p className="text-navy/70 text-sm mt-1">
          Changes are live the moment you save. The public site reads these values fresh on every request.
        </p>
      </header>
      <section className="mb-8 rounded-xl border border-navy/10 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-1 border-b border-navy/10 pb-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="font-mono text-[11px] uppercase tracking-[0.24em] text-broadcast-red">Brand kit</p>
            <h2 className="font-serif text-xl font-bold text-navy">Bradley image library</h2>
          </div>
          <p className="max-w-md text-xs leading-5 text-navy/55">
            Metadata-stripped production assets Brad can use across profile, launch, and article surfaces.
          </p>
        </div>
        <div className="mt-4 grid gap-4 md:grid-cols-3">
          {BRADLEY_BRAND_ASSETS.map((asset) => (
            <article key={asset.id} className="overflow-hidden rounded-lg border border-navy/10 bg-bone-50">
              <div className="relative aspect-[4/3] overflow-hidden bg-navy/5">
                <Image
                  src={asset.src}
                  alt={asset.alt}
                  width={asset.width}
                  height={asset.height}
                  sizes="(min-width: 1024px) 260px, 90vw"
                  className="h-full w-full object-cover"
                  style={{ objectPosition: asset.objectPosition }}
                />
              </div>
              <div className="space-y-2 p-3">
                <h3 className="font-serif text-base font-bold leading-tight text-navy">{asset.title}</h3>
                <p className="text-xs leading-5 text-charcoal/65">{asset.usage}</p>
                <code className="block overflow-hidden text-ellipsis whitespace-nowrap rounded bg-white px-2 py-1 font-mono text-[11px] text-navy/65">
                  {asset.src}
                </code>
              </div>
            </article>
          ))}
        </div>
      </section>
      <SiteConfigEditor initial={config} />
    </div>
  );
}
