/**
 * /admin layout — broadcast-grade newsroom shell shared by every admin page.
 *
 * Server-rendered. Requires an authenticated session (middleware enforces this
 * before this code runs, so we can safely call getSession here without redirects).
 *
 * The /admin/login page has its own bare layout via app/admin/login/layout.tsx.
 */
import Link from 'next/link';
import type { ReactNode } from 'react';
import { getSession } from '@/lib/auth';
import { LogoutButton } from './_components/LogoutButton';

export const metadata = {
  title: 'Newsroom · BB Sports',
  robots: { index: false, follow: false },
};

const NAV: { href: string; label: string }[] = [
  { href: '/admin', label: 'Overview' },
  { href: '/admin/articles', label: 'Articles' },
  { href: '/admin/articles/new', label: 'New article' },
  { href: '/admin/site', label: 'Site config' },
];

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const session = await getSession();
  return (
    <div className="min-h-screen bg-bone text-navy">
      <header className="bg-navy text-bone border-b-4 border-broadcast-red">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-3 flex items-center gap-4">
          <Link href="/" className="font-display italic text-xl tracking-wider hover:opacity-80">
            BB SPORTS
          </Link>
          <span className="font-mono text-[10px] uppercase tracking-[0.3em] text-bone/60">
            Newsroom
          </span>
          <nav className="ml-6 hidden sm:flex items-center gap-5 text-sm">
            {NAV.map((n) => (
              <Link key={n.href} href={n.href} className="hover:text-broadcast-red transition-colors">
                {n.label}
              </Link>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-4">
            <span className="hidden md:inline font-mono text-[10px] uppercase tracking-[0.3em] text-bone/60">
              {session?.name ?? '—'} · {session?.role ?? '—'}
            </span>
            <Link href="/" className="text-xs text-bone/70 hover:text-bone underline-offset-2 hover:underline">
              View site
            </Link>
            <LogoutButton />
          </div>
        </div>
        <nav className="sm:hidden px-4 py-2 flex gap-4 text-xs overflow-x-auto">
          {NAV.map((n) => (
            <Link key={n.href} href={n.href} className="whitespace-nowrap hover:text-broadcast-red">
              {n.label}
            </Link>
          ))}
        </nav>
      </header>
      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8">{children}</main>
    </div>
  );
}
