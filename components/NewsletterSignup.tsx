'use client';
import { useState } from 'react';

export default function NewsletterSignup({
  variant = 'inline'
}: {
  variant?: 'inline' | 'block';
}) {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'submitting' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState('');

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email) return;
    setStatus('submitting');
    try {
      const res = await fetch('/api/newsletter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || 'Could not subscribe');
      setStatus('success');
      setMessage(json.message || 'You’re on the list. Welcome.');
      setEmail('');
    } catch (err) {
      setStatus('error');
      setMessage(err instanceof Error ? err.message : 'Something went sideways. Try again.');
    }
  }

  const isBlock = variant === 'block';

  return (
    <div
      className={
        isBlock
          ? 'bg-navy text-bone p-6 sm:p-10 rounded'
          : 'border border-navy/15 rounded p-5 bg-bone-50'
      }
    >
      <div className="bb-eyebrow !text-bone/80 mb-2" style={isBlock ? undefined : { color: 'var(--bb-navy)', opacity: 0.85 }}>
        BB SPORTS NEWSLETTER
      </div>
      <h3
        className={`font-serif font-bold leading-tight ${
          isBlock ? 'text-bone text-2xl sm:text-3xl' : 'text-navy-900 text-xl sm:text-2xl'
        }`}
      >
        Takes you can actually argue with — in your inbox, when I publish.
      </h3>
      <p className={`mt-2 text-sm ${isBlock ? 'text-bone/80' : 'text-charcoal/80'}`}>
        No spin. No script. No daily filler. You hear from me when I have something to say.
      </p>

      <form onSubmit={onSubmit} className="mt-4 flex flex-col sm:flex-row gap-2">
        <label htmlFor={`email-${variant}`} className="sr-only">
          Email address
        </label>
        <input
          id={`email-${variant}`}
          type="email"
          required
          inputMode="email"
          autoComplete="email"
          placeholder="you@yourteam.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          disabled={status === 'submitting' || status === 'success'}
          className={`flex-1 min-h-[44px] px-3 py-2 rounded text-base ${
            isBlock
              ? 'bg-bone/10 text-bone placeholder:text-bone/50 border border-bone/30 focus:bg-bone/15 focus:outline-none focus:ring-2 focus:ring-bone/40'
              : 'bg-white text-charcoal placeholder:text-charcoal/40 border border-navy/20 focus:outline-none focus:ring-2 focus:ring-navy'
          }`}
        />
        <button
          type="submit"
          disabled={status === 'submitting' || status === 'success'}
          className={
            isBlock
              ? 'bb-button-primary !bg-breaking hover:!bg-breaking/90'
              : 'bb-button-primary'
          }
        >
          {status === 'submitting' ? 'Sending…' : status === 'success' ? 'Subscribed' : 'Subscribe'}
        </button>
      </form>

      <p
        className={`mt-3 text-xs ${
          isBlock ? 'text-bone/60' : 'text-charcoal/60'
        }`}
        role="status"
        aria-live="polite"
      >
        {status === 'success' && message}
        {status === 'error' && message}
        {status === 'idle' && 'No spam. Unsubscribe in one click.'}
      </p>
    </div>
  );
}
