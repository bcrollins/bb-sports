import Link from 'next/link';
import { getConfig } from '@/lib/queries';
import { getDeskRailItems, type DeskRailItem } from '@/lib/breaking';

interface DbBumper {
  sport: string;
  text: string;
  href?: string;
  isBreaking?: boolean;
}

/**
 * Public desk rail. Curated / site_config items render as "Desk" — never as
 * false "Breaking" with a live pulse. Breaking label is reserved for items
 * that explicitly carry isBreaking=true (verified newsroom path only).
 */
async function loadItems(): Promise<DeskRailItem[]> {
  const fromDb = await getConfig<DbBumper[] | null>('breaking_ticker', null);
  if (Array.isArray(fromDb) && fromDb.length > 0) {
    return fromDb.map((b, i) => ({
      id: `cfg-${i}`,
      sport: b.sport,
      text: b.text,
      href: b.href ?? '/articles',
      // DB bumpers are admin-curated editorial, not verified breaking unless flagged.
      isBreaking: b.isBreaking === true,
    }));
  }
  return getDeskRailItems();
}

export default async function BreakingNewsBar() {
  const items = await loadItems();
  if (items.length === 0) return null;

  // Static / curated rails must not claim "Breaking." Any true-breaking item
  // would require the whole rail to be in breaking mode; mixed rails stay Desk.
  const allBreaking = items.every((item) => item.isBreaking === true);
  const railLabel = allBreaking ? 'Breaking' : 'Desk';
  const ariaLabel = allBreaking ? 'Breaking sports news' : 'BB Sports desk';

  return (
    <div
      className="bg-breaking text-white border-b border-breaking/40 relative z-10"
      role="region"
      aria-label={ariaLabel}
      data-rail-mode={allBreaking ? 'breaking' : 'desk'}
    >
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-2 flex items-stretch gap-3 text-sm">
        <div className="shrink-0 inline-flex items-center px-3 -mx-2 sm:-mx-3 my-[-0.5rem] bg-white text-breaking font-black uppercase tracking-[0.18em] text-[11px]">
          {allBreaking ? (
            <span
              className="block w-2 h-2 rounded-full bg-breaking mr-2 animate-[bb-pulse_1.4s_ease-in-out_infinite]"
              aria-hidden="true"
            />
          ) : null}
          {railLabel}
        </div>
        <div className="min-w-0 flex-1 overflow-hidden flex items-center">
          <div className="flex gap-10 whitespace-nowrap animate-[bb-marquee_55s_linear_infinite] hover:[animation-play-state:paused] motion-reduce:animate-none">
            {[...items, ...items].map((item, i) => (
              <Link
                key={`${item.id}-${i}`}
                href={item.href}
                className="flex items-center gap-3 text-white hover:text-bone-50 underline-offset-4 decoration-white/30 hover:decoration-bone-50"
              >
                <span className="inline-flex items-center justify-center min-w-[40px] px-2 py-0.5 bg-white text-breaking text-[10.5px] font-black uppercase tracking-[0.18em] rounded-sm">
                  {item.sport}
                </span>
                <span className="font-medium">{item.text}</span>
              </Link>
            ))}
          </div>
        </div>
      </div>
      <style>{`
        @keyframes bb-marquee {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        @keyframes bb-pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.35; }
        }
        @media (prefers-reduced-motion: reduce) {
          .animate-\\[bb-marquee_55s_linear_infinite\\] { animation: none !important; }
          .animate-\\[bb-pulse_1\\.4s_ease-in-out_infinite\\] { animation: none !important; }
        }
      `}</style>
    </div>
  );
}
