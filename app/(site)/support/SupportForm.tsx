'use client';

import { useEffect, useState } from 'react';
import { SUPPORT_AMOUNTS, type SupportSurfaceMode } from '@/lib/support';

type Status = 'idle' | 'submitting' | 'success' | 'error';

type Props = {
  surface: SupportSurfaceMode;
  headline: string;
  detail: string;
  primaryCta: string;
  acceptsMoneyNow: boolean;
};

export default function SupportForm({
  surface,
  headline,
  detail,
  primaryCta,
  acceptsMoneyNow,
}: Props) {
  const [amountCents, setAmountCents] = useState<number>(SUPPORT_AMOUNTS[1].amountCents);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [status, setStatus] = useState<Status>('idle');
  const [feedback, setFeedback] = useState(detail);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const checkoutStatus = params.get('status');
    if (checkoutStatus === 'success') {
      setStatus('success');
      setFeedback(
        acceptsMoneyNow
          ? 'Stripe returned you here. BB Sports only marks a donation paid after the verified webhook — check email/receipt from Stripe for the charge.'
          : 'Returned from checkout, but payments are not open on this site. No BB Sports charge was completed here.',
      );
    } else if (checkoutStatus === 'cancelled') {
      setStatus('idle');
      setFeedback('Stripe checkout was cancelled. No payment moved.');
    }
  }, [acceptsMoneyNow]);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!email || status === 'submitting' || status === 'success') return;
    setStatus('submitting');
    setFeedback(acceptsMoneyNow ? 'Opening Stripe…' : 'Recording supporter interest (no charge)…');

    try {
      const res = await fetch('/api/donations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          email,
          amountCents,
          message,
          source: 'support-page',
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || json.message || 'Could not record supporter interest.');

      if (typeof json.url === 'string' && json.url.startsWith('https://')) {
        setStatus('success');
        setFeedback('Redirecting to Stripe. You have not paid BB Sports yet.');
        window.location.assign(json.url);
        return;
      }

      setStatus('success');
      setFeedback(
        json.message ||
          'You are on the supporter list. No payment was taken. BB Sports will send a link when Stripe is live.',
      );
      setName('');
      setEmail('');
      setMessage('');
    } catch (error) {
      setStatus('error');
      setFeedback(error instanceof Error ? error.message : 'Something went sideways. Try again.');
    }
  }

  return (
    <div className="space-y-4">
      <div
        className="border-l-4 border-breaking bg-white p-4"
        data-support-surface={surface}
        role="status"
      >
        <p className="bb-eyebrow !text-breaking">Payment status</p>
        <h2 className="mt-1 font-serif text-xl font-bold text-navy-900">{headline}</h2>
        <p className="mt-2 text-sm leading-relaxed text-charcoal/80">{detail}</p>
        {!acceptsMoneyNow ? (
          <p className="mt-2 text-xs font-bold uppercase tracking-[0.14em] text-navy/55">
            Outcome: interest recorded · charge: none
          </p>
        ) : (
          <p className="mt-2 text-xs font-bold uppercase tracking-[0.14em] text-navy/55">
            Outcome: Stripe handoff · paid only after webhook
          </p>
        )}
      </div>

      <form onSubmit={onSubmit} className="border border-navy/15 bg-white p-5 sm:p-6">
        <fieldset disabled={status === 'submitting' || status === 'success'}>
          <legend className="bb-eyebrow">
            {acceptsMoneyNow ? 'Pick a support amount' : 'Intended support amount (not charged)'}
          </legend>
          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {SUPPORT_AMOUNTS.map((amount) => (
              <button
                key={amount.amountCents}
                type="button"
                onClick={() => setAmountCents(amount.amountCents)}
                className={[
                  'min-h-[64px] border px-3 py-2 text-left transition-colors',
                  amountCents === amount.amountCents
                    ? 'border-breaking bg-breaking text-white'
                    : 'border-navy/20 bg-bone-50 text-navy hover:border-breaking',
                ].join(' ')}
                aria-pressed={amountCents === amount.amountCents}
              >
                <span className="block text-lg font-black">{amount.label}</span>
                <span className="mt-1 block text-[11px] font-bold uppercase tracking-[0.12em] opacity-75">
                  {amount.note}
                </span>
              </button>
            ))}
          </div>

          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="support-name" className="block text-sm font-semibold text-navy-900">
                Name <span className="font-normal text-charcoal/50">(optional)</span>
              </label>
              <input
                id="support-name"
                name="name"
                autoComplete="name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                className="mt-1 min-h-[44px] w-full border border-navy/20 bg-bone-50 px-3 py-2 text-base focus:outline-none focus:ring-2 focus:ring-navy"
                placeholder="Your name"
              />
            </div>
            <div>
              <label htmlFor="support-email" className="block text-sm font-semibold text-navy-900">
                Email <span className="text-breaking">*</span>
              </label>
              <input
                id="support-email"
                name="email"
                type="email"
                required
                inputMode="email"
                autoComplete="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="mt-1 min-h-[44px] w-full border border-navy/20 bg-bone-50 px-3 py-2 text-base focus:outline-none focus:ring-2 focus:ring-navy"
                placeholder="you@yourteam.com"
              />
            </div>
          </div>

          <div className="mt-4">
            <label htmlFor="support-message" className="block text-sm font-semibold text-navy-900">
              Message <span className="font-normal text-charcoal/50">(optional)</span>
            </label>
            <textarea
              id="support-message"
              name="message"
              rows={4}
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              className="mt-1 w-full border border-navy/20 bg-bone-50 px-3 py-2 text-base focus:outline-none focus:ring-2 focus:ring-navy"
              placeholder="Tell Brad what you want more of."
            />
          </div>
        </fieldset>

        <button
          type="submit"
          disabled={status === 'submitting' || status === 'success' || !email}
          className="mt-5 inline-flex min-h-[44px] w-full items-center justify-center bg-navy px-4 text-sm font-bold text-bone transition-colors hover:bg-breaking disabled:cursor-not-allowed disabled:bg-navy/40 sm:w-auto"
        >
          {status === 'submitting'
            ? 'Working…'
            : status === 'success'
              ? acceptsMoneyNow
                ? 'Handed off'
                : 'Interest recorded'
              : primaryCta}
        </button>

        <p
          className={`mt-3 text-sm ${status === 'error' ? 'text-breaking' : 'text-charcoal/70'}`}
          role="status"
          aria-live="polite"
        >
          {feedback}
        </p>
      </form>
    </div>
  );
}
