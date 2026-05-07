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
import { sql } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import { ensureBootstrapped } from '@/lib/db/bootstrap';
import SiteConfigEditor from './SiteConfigEditor';

export const dynamic = 'force-dynamic';

interface ConfigShape {
  breaking_ticker?: { sport: string; text: string }[];
  hero?: {
    version?: number;
    eyebrow?: string;
    headline?: string;
    sub?: string;
    cta_primary?: { label?: string; href?: string };
    cta_secondary?: { label?: string; href?: string };
  };
  about_bio?: string[];
  footer_tagline?: string;
}

async function loadConfig(): Promise<ConfigShape> {
  if (!db) return {};
  await ensureBootstrapped();
  const rows = (await db.execute(sql`SELECT key, value FROM site_config`)) as unknown as { key: string; value: ConfigShape[keyof ConfigShape] }[];
  const out: ConfigShape = {};
  for (const r of rows) (out as Record<string, unknown>)[r.key] = r.value;
  return out;
}

export default async function SiteConfigPage() {
  const config = await loadConfig();
  return (
    <div>
      <header className="border-b border-navy/15 pb-3 mb-6">
        <p className="font-mono text-[11px] uppercase tracking-[0.3em] text-broadcast-red">── Site config</p>
        <h1 className="font-display italic text-4xl mt-1">Edit the site</h1>
        <p className="text-navy/70 text-sm mt-1">
          Changes are live the moment you save. The public site reads these values fresh on every request.
        </p>
      </header>
      <SiteConfigEditor initial={config} />
    </div>
  );
}
