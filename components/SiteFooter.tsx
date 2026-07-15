import Link from 'next/link';
import Logo from './Logo';
import { getConfig } from '@/lib/queries';

const DEFAULT_TAGLINE = "Sports from the fan's view. No BS.";

export default async function SiteFooter() {
  const year = new Date().getFullYear();
  const taglineRaw = await getConfig<string | null>('footer_tagline', null);
  const tagline =
    typeof taglineRaw === 'string' && taglineRaw.trim().length > 0
      ? taglineRaw.trim()
      : DEFAULT_TAGLINE;

  return (
    <footer className="mt-24 bg-navy-deep text-bone">
      {/* Network top spine */}
      <div className="h-1 bg-breaking" aria-hidden="true" />

      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-14 grid gap-10 md:grid-cols-12">
        <div className="md:col-span-5">
          <Logo variant="lockup" scheme="bone-on-navy" />
          <p className="mt-3 text-bone/95 max-w-md text-base font-serif italic">
            {tagline}
          </p>
          <p className="mt-4 text-bone/80 max-w-md leading-relaxed text-[15px]">
            Opinion-led sports journalism by{' '}
            <Link href="/about" className="underline underline-offset-4 decoration-bone/40 hover:decoration-breaking hover:text-breaking">
              Brad Benson
            </Link>
            . University of Florida journalism &amp; sports media (2027).
          </p>

          <div className="mt-6">
            <div className="text-[10.5px] uppercase tracking-[0.22em] font-bold text-bone/60">Follow the brand</div>
            <div className="mt-3 flex flex-wrap gap-2">
              {[
                { label: 'X', href: 'https://x.com/bbsports' },
                { label: 'Instagram', href: 'https://instagram.com/bbsports' },
                { label: 'TikTok', href: 'https://tiktok.com/@bbsports' },
                { label: 'YouTube', href: 'https://youtube.com/@bbsports' },
                { label: 'LinkedIn', href: 'https://linkedin.com/in/bbsports' }
              ].map((s) => (
                <a
                  key={s.label}
                  href={s.href}
                  target="_blank"
                  rel="noopener"
                  className="inline-flex items-center min-h-[36px] px-3 rounded-sm bg-bone/10 hover:bg-breaking text-bone uppercase font-bold text-[11px] tracking-[0.16em] transition-colors"
                >
                  {s.label}
                </a>
              ))}
            </div>
          </div>
        </div>

        <div className="md:col-span-3">
          <h3 className="text-bone uppercase text-[10.5px] tracking-[0.22em] font-bold mb-3">Read</h3>
          <ul className="space-y-2 text-bone/85 text-[15px]">
            <li>
              <Link href="/teams" className="hover:text-breaking">
                Teams encyclopedia
              </Link>
            </li>
            <li>
              <Link href="/people" className="hover:text-breaking">
                People
              </Link>
            </li>
            <li><Link href="/articles" className="hover:text-breaking">All articles</Link></li>
            <li><Link href="/search" className="hover:text-breaking">Search</Link></li>
            <li><Link href="/podcast" className="hover:text-breaking">Podcast</Link></li>
            <li><Link href="/videos" className="hover:text-breaking">Videos</Link></li>
            <li><Link href="/support" className="hover:text-breaking">Support</Link></li>
          </ul>
          <h3 className="mt-6 text-bone uppercase text-[10.5px] tracking-[0.22em] font-bold mb-3">Franchise rankings</h3>
          <ul className="space-y-2 text-bone/85 text-[15px]">
            <li><Link href="/rankings" className="hover:text-breaking">All four leagues</Link></li>
            <li><Link href="/rankings/nfl" className="hover:text-breaking">NFL top 25</Link></li>
            <li><Link href="/rankings/mlb" className="hover:text-breaking">MLB top 25</Link></li>
            <li><Link href="/rankings/nhl" className="hover:text-breaking">NHL top 25</Link></li>
            <li><Link href="/rankings/nba" className="hover:text-breaking">NBA top 25</Link></li>
          </ul>
        </div>

        <div className="md:col-span-4">
          <h3 className="text-bone uppercase text-[10.5px] tracking-[0.22em] font-bold mb-3">Site</h3>
          <ul className="space-y-2 text-bone/85 text-[15px]">
            <li><Link href="/about" className="hover:text-breaking">About Brad</Link></li>
            <li><Link href="/support/terms" className="hover:text-breaking">Donation terms</Link></li>
            <li><Link href="/contact" className="hover:text-breaking">Contact &amp; tips</Link></li>
            <li><Link href="/editorial-standards" className="hover:text-breaking">Editorial standards</Link></li>
            <li><Link href="/corrections" className="hover:text-breaking">Corrections</Link></li>
            <li><Link href="/coming-soon" className="hover:text-breaking">Newsletter</Link></li>
          </ul>
        </div>
      </div>

      <div className="border-t border-bone/15">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-3 text-[10.5px] uppercase tracking-[0.22em] text-bone/60">
          <div>© {year} BB Sports. Founded &amp; edited by Brad Benson.</div>
          <div className="flex flex-wrap gap-3">
            <span>Bias disclosed · Sources cited · Corrections public</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
