'use client';

import { useState } from 'react';
import {
  buildCanonicalArticleUrl,
  buildFacebookShareUrl,
  buildMailtoShareUrl,
  buildSharePayload,
  buildXIntentUrl,
} from '@/lib/share';

type Props = {
  title: string;
  slug: string;
};

export default function ShareActions({ title, slug }: Props) {
  const payload = buildSharePayload({ title, slug });
  const [status, setStatus] = useState<string>('');

  async function nativeShare() {
    setStatus('');
    if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
      try {
        await navigator.share({
          title: payload.title,
          text: payload.text,
          url: payload.url,
        });
        setStatus('Shared.');
        return;
      } catch (err) {
        // User cancel is not an error to shout about.
        if (err instanceof DOMException && err.name === 'AbortError') return;
      }
    }
    await copyLink();
  }

  async function copyLink() {
    setStatus('');
    const url = buildCanonicalArticleUrl(slug);
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(url);
        setStatus('Link copied.');
        return;
      }
    } catch {
      /* fall through */
    }
    // Last-resort prompt — never loads a third-party script.
    window.prompt('Copy this link:', url);
    setStatus('Copy the link from the prompt.');
  }

  return (
    <div className="mt-6">
      <div className="flex flex-wrap gap-3">
        <button type="button" onClick={nativeShare} className="bb-button-ghost min-h-[44px]">
          Share
        </button>
        <button type="button" onClick={copyLink} className="bb-button-ghost min-h-[44px]">
          Copy link
        </button>
        <a
          target="_blank"
          rel="noopener noreferrer"
          href={buildXIntentUrl(payload)}
          className="bb-button-ghost min-h-[44px]"
        >
          Share on X
        </a>
        <a
          target="_blank"
          rel="noopener noreferrer"
          href={buildFacebookShareUrl(payload.url)}
          className="bb-button-ghost min-h-[44px]"
        >
          Facebook
        </a>
        <a href={buildMailtoShareUrl(payload)} className="bb-button-ghost min-h-[44px]">
          Email
        </a>
      </div>
      <p className="mt-2 text-xs text-charcoal/60" role="status" aria-live="polite">
        {status || 'Opens your share sheet or copies the canonical URL. No auto-post to brand accounts.'}
      </p>
    </div>
  );
}
