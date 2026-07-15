import Link from 'next/link';
import { newsletterUnsubscribeSchema, validationErrorMessage } from '@/lib/intake-validation';
import { getNewsletterSubscriberByToken } from '@/lib/queries';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Unsubscribe',
  robots: { index: false, follow: false },
};

type Props = { searchParams: Promise<{ token?: string; done?: string }> };

/**
 * Human unsubscribe surface. GET never mutates consent (link scanners safe).
 * Explicit form POST to /api/newsletter/unsubscribe performs suppression.
 */
export default async function NewsletterUnsubscribePage({ searchParams }: Props) {
  const params = await searchParams;
  const done = params.done === '1';
  const parsed = newsletterUnsubscribeSchema.safeParse({ token: params.token ?? '' });

  let state: 'confirm' | 'already' | 'done' | 'error' = 'error';
  let message = parsed.success ? 'Unsubscribe link not found.' : validationErrorMessage(parsed.error);
  let token = '';

  if (parsed.success) {
    token = parsed.data.token;
    try {
      const subscriber = await getNewsletterSubscriberByToken(token);
      if (!subscriber) {
        state = 'error';
        message = 'Unsubscribe link not found.';
      } else if (done || subscriber.status === 'unsubscribed') {
        state = done ? 'done' : 'already';
        message =
          subscriber.status === 'unsubscribed' || done
            ? 'You are unsubscribed from BB Sports email.'
            : 'You are unsubscribed from BB Sports email.';
      } else {
        state = 'confirm';
        message = 'Click the button below to stop BB Sports email. This will not unsubscribe you until you confirm.';
      }
    } catch (err) {
      state = 'error';
      message = err instanceof Error ? err.message : 'Newsletter ledger unavailable.';
    }
  }

  const heading =
    state === 'done' || state === 'already'
      ? 'You are off the list.'
      : state === 'confirm'
        ? 'Confirm unsubscribe'
        : 'Link needs a check.';

  return (
    <main className="min-h-screen bg-bone px-4 py-10 text-navy sm:px-6">
      <section className="mx-auto max-w-xl rounded-sm border border-navy/15 bg-white p-6 shadow-sm sm:p-8">
        <p className="font-mono text-[11px] uppercase tracking-[0.3em] text-broadcast-red">
          BB Sports email
        </p>
        <h1 className="mt-3 font-display text-4xl italic leading-tight">{heading}</h1>
        <p className="mt-4 text-base leading-7 text-charcoal/80">{message}</p>

        {state === 'confirm' ? (
          <form
            method="POST"
            action="/api/newsletter/unsubscribe"
            className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center"
          >
            <input type="hidden" name="token" value={token} />
            <button type="submit" className="bb-button-primary min-h-[48px]">
              Yes, unsubscribe me
            </button>
            <Link href="/" className="bb-button-ghost min-h-[48px] inline-flex items-center justify-center">
              Keep me on the list
            </Link>
          </form>
        ) : (
          <div className="mt-6 flex flex-wrap gap-3">
            <Link href="/" className="bb-button-primary">
              Back to BB Sports
            </Link>
            <Link href="/contact" className="bb-button-ghost">
              Contact Brad
            </Link>
          </div>
        )}
      </section>
    </main>
  );
}
