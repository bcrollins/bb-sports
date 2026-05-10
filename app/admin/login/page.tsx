/**
 * /admin/login — admin sign-in page.
 *
 * Server-rendered shell plus a small client form. Admin redirects are restricted
 * to /admin paths so a forged next= value cannot become an external redirect.
 */
import Link from 'next/link';
import { safeAdminPath } from '@/lib/redirects';
import LoginForm from './LoginForm';

type Props = {
  searchParams: Promise<{ next?: string }>;
};

export default async function LoginPage({ searchParams }: Props) {
  const params = await searchParams;
  const next = safeAdminPath(params.next);

  return (
    <main id="main" className="min-h-screen bg-bone text-navy flex flex-col">
      <div className="border-b-4 border-broadcast-red bg-navy text-bone px-6 py-3 flex items-center gap-3">
        <Link href="/" className="font-display italic text-2xl tracking-wider hover:opacity-80">
          BB SPORTS
        </Link>
        <span className="text-xs uppercase tracking-[0.3em] text-bone/70 ml-auto">Newsroom</span>
      </div>

      <section className="flex-1 grid place-items-center px-6 py-16">
        <div className="w-full max-w-md">
          <p className="font-mono text-xs uppercase tracking-[0.3em] text-broadcast-red mb-3">
            -- Editorial sign-in
          </p>
          <h1 className="font-display italic text-4xl sm:text-5xl mb-2">Newsroom</h1>
          <p className="text-navy/70 mb-8">
            Sign in to publish, edit, or update the site. Bradley only.
          </p>

          <LoginForm nextPath={next} />

          <p className="text-xs text-navy/50 mt-6">
            Trouble signing in? Contact Brandon. No public registrations.
          </p>
        </div>
      </section>
    </main>
  );
}
