/**
 * /admin layout — BB Sports newsroom operating system.
 *
 * The access wall is global. This shell is the second layer: authenticated
 * admin-only operations for publishing, audience, launch, and site control.
 */
import Link from 'next/link';
import type { ReactNode } from 'react';
import {
  BarChart3,
  FileText,
  Home,
  ImageIcon,
  ListOrdered,
  LockKeyhole,
  MessageSquare,
  Newspaper,
  PenLine,
  Radio,
  Rocket,
  Settings,
  Shield,
  Users,
} from 'lucide-react';
import { getCurrentUser } from '@/lib/auth';
import { LogoutButton } from './_components/LogoutButton';

export const metadata = {
  title: 'Newsroom · BB Sports',
  robots: { index: false, follow: false },
};

const NAV = [
  { href: '/admin', label: 'Command', icon: Home },
  { href: '/admin/news-desk', label: 'Live desk', icon: Radio },
  { href: '/admin/articles', label: 'Articles', icon: FileText },
  { href: '/admin/articles/new', label: 'Write', icon: PenLine },
  { href: '/admin/media', label: 'Media', icon: ImageIcon },
  { href: '/admin/comments', label: 'Comments', icon: MessageSquare },
  { href: '/admin/audience', label: 'Audience', icon: Users },
  { href: '/admin/findings', label: 'Findings', icon: FileText },
  { href: '/admin/catalog', label: 'Catalog', icon: ListOrdered },
  { href: '/admin/rankings', label: 'Rankings', icon: ListOrdered },
  { href: '/admin/site', label: 'Site', icon: Settings },
  { href: '/admin/account/sessions', label: 'Sessions', icon: Shield },
  { href: '/admin/access-wall', label: 'Access wall', icon: LockKeyhole },
  { href: '/admin/audit', label: 'Audit', icon: LockKeyhole },
  { href: '/admin/launch', label: 'Launch', icon: Rocket },
];

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const user = await getCurrentUser();

  if (!user) {
    return (
      <div className="fixed inset-0 z-[9998] overflow-y-auto bg-bone text-navy">
        {children}
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[9998] overflow-y-auto bg-[#f6f7f9] text-navy">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-2 focus:top-2 focus:z-[10000] focus:rounded focus:bg-navy focus:px-3 focus:py-2 focus:text-sm focus:font-bold focus:text-bone"
      >
        Skip to main content
      </a>
      <div className="lg:grid lg:min-h-screen lg:grid-cols-[276px_minmax(0,1fr)]">
        <aside className="border-b border-navy/10 bg-white lg:sticky lg:top-0 lg:h-screen lg:border-b-0 lg:border-r">
          <div className="flex h-full flex-col">
            <div className="border-b border-navy/10 px-5 py-5">
              <Link href="/admin" className="flex items-center gap-3">
                <span className="grid h-11 w-11 place-items-center rounded-lg bg-navy text-bone">
                  <Newspaper size={22} strokeWidth={2.4} />
                </span>
                <span>
                  <span className="block font-display text-2xl italic tracking-wide text-navy">BB SPORTS</span>
                  <span className="block text-[10px] font-bold uppercase tracking-[0.26em] text-navy/50">Newsroom OS</span>
                </span>
              </Link>
            </div>

            <nav aria-label="Admin" className="grid grid-cols-3 gap-2 px-4 py-3 sm:grid-cols-5 lg:flex lg:flex-1 lg:flex-col lg:overflow-visible lg:py-5">
              {NAV.map((item) => {
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className="inline-flex min-h-[54px] items-center justify-center gap-1.5 rounded-lg px-2 py-2 text-center text-[11px] font-semibold leading-tight text-navy/72 transition-colors hover:bg-navy hover:text-bone sm:min-h-[44px] sm:flex-row sm:gap-2 sm:text-xs lg:justify-start lg:gap-3 lg:px-3 lg:py-2.5 lg:text-sm"
                  >
                    <Icon size={17} strokeWidth={2.2} aria-hidden="true" />
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </nav>

            <div className="hidden border-t border-navy/10 p-4 lg:block">
              <div className="rounded-lg bg-bone-50 p-3">
                <div className="text-[10px] font-bold uppercase tracking-[0.22em] text-navy/50">Signed in</div>
                <div className="mt-1 truncate font-serif font-bold text-navy">{user.name}</div>
                <div className="mt-0.5 truncate text-xs text-navy/55">{user.role}</div>
              </div>
            </div>
          </div>
        </aside>

        <div className="min-w-0">
          <header className="sticky top-0 z-30 border-b border-navy/10 bg-white/92 px-4 py-3 backdrop-blur sm:px-6">
            <div className="mx-auto flex max-w-7xl items-center gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.24em] text-navy/50">
                  <BarChart3 size={14} aria-hidden="true" />
                  Bradley Benson control room
                </div>
              </div>
              <Link
                href="/"
                className="hidden min-h-[36px] items-center rounded border border-navy/15 px-3 text-xs font-bold uppercase tracking-[0.16em] text-navy/70 hover:border-navy hover:text-navy sm:inline-flex"
              >
                View site
              </Link>
              <LogoutButton />
            </div>
          </header>

          <main id="main" className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:py-8">{children}</main>
        </div>
      </div>
    </div>
  );
}
