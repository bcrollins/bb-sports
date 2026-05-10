import Link from 'next/link';
import { newsletterUnsubscribeSchema, validationErrorMessage } from '@/lib/intake-validation';
import { unsubscribeNewsletterSubscriber } from '@/lib/queries';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Unsubscribe',
  robots: { index: false, follow: false },
};

type Props = { searchParams: Promise<{ token?: string }> };

export default async function NewsletterUnsubscribePage({ searchParams }: Props) {
  const params = await searchParams;
  const parsed = newsletterUnsubscribeSchema.safeParse({ token: params.token ?? '' });

  let state: 'success' | 'error' = 'error';
  let message = parsed.success ? 'Unsubscribe link not found.' : validationErrorMessage(parsed.error);

  if (parsed.success) {
    try {
      const subscriber = await unsubscribeNewsletterSubscriber(parsed.data.token);
      if (subscriber) {
        state = 'success';
        message = 'You are unsubscribed from BB Sports email.';
      }
    } catch (err) {
      message = err instanceof Error ? err.message : 'Newsletter ledger unavailable.';
    }
  }

  return (
    <main className="min-h-screen bg-bone px-4 py-10 text-navy sm:px-6">
      <section className="mx-auto max-w-xl rounded-sm border border-navy/15 bg-white p-6 shadow-sm sm:p-8">
        <p className="font-mono text-[11px] uppercase tracking-[0.3em] text-broadcast-red">
          BB Sports email
        </p>
        <h1 className="mt-3 font-display text-4xl italic leading-tight">
          {state === 'success' ? 'You are off the list.' : 'Link needs a check.'}
        </h1>
        <p className="mt-4 text-base leading-7 text-charcoal/80">{message}</p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link href="/" className="bb-button-primary">
            Back to BB Sports
          </Link>
          <Link href="/contact" className="bb-button-ghost">
            Contact Brad
          </Link>
        </div>
      </section>
    </main>
  );
}
