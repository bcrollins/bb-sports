/**
 * /admin/login — admin sign-in page.
 *
 * Server-rendered shell plus a small client form. Admin redirects are restricted
 * to /admin paths so a forged next= value cannot become an external redirect.
 *
 * This page is gate-bypassed: Brad does not need the soft-launch wall password
 * to reach the newsroom. The newsroom email/password is the real lock.
 */
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { safeAdminPath } from '@/lib/redirects';
import LoginForm from './LoginForm';

type Props = {
  searchParams: Promise<{ next?: string }>;
};

export default async function LoginPage({ searchParams }: Props) {
  const params = await searchParams;
  const next = safeAdminPath(params.next);

  // Already signed in — skip the form and go straight to the desk.
  const existing = await getCurrentUser();
  if (existing) {
    redirect(next);
  }

  return (
    <main id="main" className="min-h-screen bg-bone text-navy flex flex-col">
      <div className="border-b-4 border-broadcast-red bg-navy text-bone px-6 py-3 flex items-center gap-3">
        <Link href="/admin" className="font-display italic text-2xl tracking-wider hover:opacity-80">
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
          <p className="text-navy/70 mb-4">
            Sign in to write, edit, publish, manage rankings, comments, and the whole site. Bradley only.
          </p>
          <p className="mb-8 rounded border border-navy/10 bg-white px-3 py-2 text-xs leading-relaxed text-navy/65">
            This is the <strong className="font-semibold text-navy">newsroom</strong> password (email +
            password), not the white soft-launch wall password readers use. No public registrations.
          </p>

          <LoginForm nextPath={next} />

          <p className="text-xs text-navy/50 mt-6">
            Trouble signing in? Contact Brandon — he can rotate the Railway admin password hash and
            redeploy. You will never see a developer stack trace here; wrong credentials just show a
            plain error on the form.
          </p>
        </div>
      </section>
    </main>
  );
}
