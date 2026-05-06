'use client';
import { useState } from 'react';
import Link from 'next/link';

type Mode = 'general' | 'tip' | 'press' | 'sponsorship';

export default function ContactPage() {
  const [mode, setMode] = useState<Mode>('general');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [secure, setSecure] = useState(false);
  const [status, setStatus] = useState<'idle' | 'submitting' | 'success' | 'error'>('idle');
  const [feedback, setFeedback] = useState('');

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email || !message) return;
    setStatus('submitting');
    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode, name, email, message, secure })
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || 'Could not send message.');
      setStatus('success');
      setFeedback(json.message || 'Got it. Brad will see this.');
      setName('');
      setEmail('');
      setMessage('');
    } catch (err) {
      setStatus('error');
      setFeedback(err instanceof Error ? err.message : 'Something went wrong.');
    }
  }

  return (
    <div className="bg-bone">
      <header className="bg-navy-deep text-bone relative overflow-hidden">
        <div className="h-1 bg-breaking" aria-hidden="true" />
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-12 sm:py-16">
          <p className="bb-eyebrow !text-breaking !tracking-[0.32em]">Reach out</p>
          <h1
            className="mt-3 font-display uppercase italic text-bone leading-[0.9] tracking-[-0.025em]"
            style={{ fontSize: 'clamp(2.5rem, 8vw, 6rem)' }}
          >
            Tips. Pitches.<br/>Yelling welcome.
          </h1>
          <p className="mt-4 text-lg text-bone/85">
            Got something Brad should see? Use the form. Sources: there's a secure-tip toggle below — use it.
          </p>
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-10 grid md:grid-cols-3 gap-8">
        <aside className="md:col-span-1">
          <h2 className="font-serif text-xl font-bold text-navy-900">Other ways</h2>
          <ul className="mt-3 space-y-3 text-sm text-charcoal/85">
            <li><a className="bb-link" href="https://x.com/bbsports" target="_blank" rel="noopener">@bbsports on X</a> — fastest for non-confidential.</li>
            <li><a className="bb-link" href="mailto:tips@bbsports.media">tips@bbsports.media</a> — anything serious.</li>
            <li><Link className="bb-link" href="/editorial-standards">Editorial standards</Link> — what we do with what you send us.</li>
            <li><Link className="bb-link" href="/corrections">Corrections</Link> — see something wrong on a piece? Tell us.</li>
          </ul>
        </aside>

        <form onSubmit={onSubmit} className="md:col-span-2 bg-white border border-navy/15 rounded p-5 sm:p-6 space-y-5">
          <fieldset>
            <legend className="bb-eyebrow">What is this?</legend>
            <div className="mt-2 grid grid-cols-2 gap-2">
              {(['general','tip','press','sponsorship'] as Mode[]).map((m) => (
                <label key={m} className={`cursor-pointer text-sm font-semibold uppercase tracking-[0.12em] text-center py-3 border rounded ${mode === m ? 'bg-navy text-bone border-navy' : 'bg-bone-50 border-navy/20 text-navy hover:bg-navy/5'}`}>
                  <input
                    type="radio"
                    name="mode"
                    value={m}
                    checked={mode === m}
                    onChange={() => setMode(m)}
                    className="sr-only"
                  />
                  {m === 'general' ? 'General' : m === 'tip' ? 'News tip' : m === 'press' ? 'Press / media' : 'Sponsor / partner'}
                </label>
              ))}
            </div>
          </fieldset>

          <div>
            <label htmlFor="name" className="block text-sm font-semibold text-navy-900">Name <span className="text-charcoal/50 font-normal">(optional for tips)</span></label>
            <input
              id="name"
              name="name"
              autoComplete="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1 w-full min-h-[44px] px-3 py-2 rounded border border-navy/20 bg-bone-50 focus:outline-none focus:ring-2 focus:ring-navy"
              placeholder={mode === 'tip' ? 'Optional — leave blank to stay anonymous' : 'Your name'}
            />
          </div>

          <div>
            <label htmlFor="email" className="block text-sm font-semibold text-navy-900">Email <span className="text-breaking">*</span></label>
            <input
              id="email"
              name="email"
              type="email"
              required
              inputMode="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 w-full min-h-[44px] px-3 py-2 rounded border border-navy/20 bg-bone-50 focus:outline-none focus:ring-2 focus:ring-navy"
              placeholder="you@yourteam.com"
            />
          </div>

          <div>
            <label htmlFor="message" className="block text-sm font-semibold text-navy-900">Message <span className="text-breaking">*</span></label>
            <textarea
              id="message"
              name="message"
              required
              minLength={10}
              rows={6}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              className="mt-1 w-full px-3 py-2 rounded border border-navy/20 bg-bone-50 focus:outline-none focus:ring-2 focus:ring-navy"
              placeholder={mode === 'tip' ? 'What did you see? When? Where? Any documents you can share?' : 'What’s up?'}
            />
          </div>

          {mode === 'tip' && (
            <label className="flex items-start gap-3 p-3 bg-bone-50 border border-navy/15 rounded">
              <input
                type="checkbox"
                checked={secure}
                onChange={(e) => setSecure(e.target.checked)}
                className="mt-1 h-5 w-5 accent-navy"
              />
              <span className="text-sm text-charcoal/85">
                <strong>Treat as confidential.</strong> Brad will not name you in the story without your written consent. If you need a more secure channel, email <a className="bb-link" href="mailto:tips@bbsports.media">tips@bbsports.media</a>.
              </span>
            </label>
          )}

          <button type="submit" disabled={status === 'submitting' || status === 'success'} className="bb-button-primary w-full sm:w-auto">
            {status === 'submitting' ? 'Sending…' : status === 'success' ? 'Sent' : 'Send message'}
          </button>

          {status !== 'idle' && (
            <p role="status" aria-live="polite" className={`text-sm ${status === 'error' ? 'text-breaking' : 'text-navy'}`}>
              {feedback}
            </p>
          )}
        </form>
      </div>
    </div>
  );
}
