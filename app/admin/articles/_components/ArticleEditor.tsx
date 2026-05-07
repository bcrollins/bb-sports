/**
 * Shared article editor — used for both /admin/articles/new and /admin/articles/[id]/edit.
 *
 * Markdown body editor with live preview (preview rendered server-side via /api/admin/preview).
 * Auto-derives slug from title when creating a new article. Brad can override.
 */
'use client';

import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

const SPORTS = ['NFL', 'NHL', 'CFB', 'Soccer', 'NBA', 'MMA', 'Op-Ed'];

function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 90);
}

export interface ArticleFormValues {
  id?: string;
  slug: string;
  title: string;
  dek: string;
  body: string;
  sport: string;
  hero: string;
  authorName: string;
  published: boolean;
}

const EMPTY: ArticleFormValues = {
  slug: '',
  title: '',
  dek: '',
  body: '',
  sport: 'Op-Ed',
  hero: '',
  authorName: 'Brad Benson',
  published: false,
};

export function ArticleEditor({ initial, mode }: { initial?: ArticleFormValues; mode: 'new' | 'edit' }) {
  const router = useRouter();
  const [v, setV] = useState<ArticleFormValues>(initial ?? EMPTY);
  const [autoSlug, setAutoSlug] = useState(mode === 'new');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [previewHtml, setPreviewHtml] = useState<string>('');
  const [previewing, setPreviewing] = useState(false);
  const previewTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Auto-derive slug from title in create mode unless Brad has typed in slug manually.
  useEffect(() => {
    if (autoSlug) {
      setV((cur) => ({ ...cur, slug: slugify(cur.title) }));
    }
  }, [v.title, autoSlug]);

  // Debounced server-side markdown preview.
  useEffect(() => {
    if (previewTimer.current) clearTimeout(previewTimer.current);
    previewTimer.current = setTimeout(async () => {
      setPreviewing(true);
      try {
        const res = await fetch('/api/admin/preview', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ body: v.body }),
        });
        const data = await res.json().catch(() => ({}));
        setPreviewHtml(data?.html ?? '');
      } finally {
        setPreviewing(false);
      }
    }, 400);
    return () => {
      if (previewTimer.current) clearTimeout(previewTimer.current);
    };
  }, [v.body]);

  const wordCount = useMemo(() => v.body.trim().split(/\s+/).filter(Boolean).length, [v.body]);

  function field<K extends keyof ArticleFormValues>(key: K, value: ArticleFormValues[K]) {
    setV((cur) => ({ ...cur, [key]: value }));
  }

  async function onSubmit(e: FormEvent, publishOverride?: boolean) {
    e.preventDefault();
    setError(null);
    if (!v.title.trim() || !v.slug.trim()) {
      setError('Title and slug are required.');
      return;
    }
    setSubmitting(true);
    try {
      const payload = { ...v, published: publishOverride ?? v.published };
      const url = mode === 'new' ? '/api/admin/articles' : `/api/admin/articles/${v.id}`;
      const res = await fetch(url, {
        method: mode === 'new' ? 'POST' : 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.error ?? 'Save failed');
        return;
      }
      const newId = data?.article?.id ?? v.id;
      if (mode === 'new' && newId) {
        router.push(`/admin/articles/${newId}/edit`);
      } else {
        router.refresh();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Network error');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={(e) => onSubmit(e)} className="space-y-6">
      <header className="border-b border-navy/15 pb-3 flex items-baseline gap-3">
        <div className="flex-1">
          <p className="font-mono text-[11px] uppercase tracking-[0.3em] text-broadcast-red">
            ── {mode === 'new' ? 'New article' : 'Edit article'}
          </p>
          <h1 className="font-display italic text-3xl mt-1">
            {mode === 'new' ? 'Write a new piece' : v.title || 'Untitled'}
          </h1>
        </div>
        <Link href="/admin/articles" className="text-sm text-navy/70 underline-offset-2 hover:underline">
          ← Back
        </Link>
      </header>

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          <Field label="Title">
            <input
              type="text"
              value={v.title}
              onChange={(e) => field('title', e.target.value)}
              className="w-full border border-navy/20 rounded px-3 py-2.5 font-serif text-lg focus:outline-none focus:ring-2 focus:ring-broadcast-red/50"
              placeholder="The headline a fan would say out loud"
              required
            />
          </Field>

          <Field
            label="Slug"
            hint="URL fragment. Auto-generated from title until you edit it."
          >
            <input
              type="text"
              value={v.slug}
              onChange={(e) => {
                setAutoSlug(false);
                field('slug', slugify(e.target.value));
              }}
              className="w-full border border-navy/20 rounded px-3 py-2.5 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-broadcast-red/50"
              required
            />
          </Field>

          <Field label="Dek (sub-headline)">
            <input
              type="text"
              value={v.dek}
              onChange={(e) => field('dek', e.target.value)}
              className="w-full border border-navy/20 rounded px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-broadcast-red/50"
              placeholder="One sentence that says what the take is."
            />
          </Field>

          <Field label="Body (markdown)" hint={`${wordCount} words`}>
            <textarea
              value={v.body}
              onChange={(e) => field('body', e.target.value)}
              className="w-full border border-navy/20 rounded px-3 py-2.5 font-mono text-sm leading-6 min-h-[420px] focus:outline-none focus:ring-2 focus:ring-broadcast-red/50"
              placeholder="Write the take. Markdown welcome — # ## **bold** *italic* [link](url) - lists, > quotes."
            />
          </Field>

          <details className="bg-white border border-navy/10 rounded">
            <summary className="cursor-pointer px-4 py-2.5 text-sm font-mono uppercase tracking-[0.18em] text-navy/70 hover:bg-bone-50">
              Live preview {previewing ? '· refreshing…' : ''}
            </summary>
            <div className="p-5 prose prose-navy max-w-none prose-headings:font-serif prose-headings:font-bold" dangerouslySetInnerHTML={{ __html: previewHtml }} />
          </details>
        </div>

        <aside className="space-y-4">
          <div className="bg-white border border-navy/10 rounded p-4 space-y-4">
            <Field label="Sport">
              <select
                value={v.sport}
                onChange={(e) => field('sport', e.target.value)}
                className="w-full border border-navy/20 rounded px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-broadcast-red/50"
              >
                {SPORTS.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </Field>
            <Field label="Hero image URL" hint="Optional. Full image URL (https://…).">
              <input
                type="url"
                value={v.hero}
                onChange={(e) => field('hero', e.target.value)}
                className="w-full border border-navy/20 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-broadcast-red/50"
              />
            </Field>
            <Field label="Author">
              <input
                type="text"
                value={v.authorName}
                onChange={(e) => field('authorName', e.target.value)}
                className="w-full border border-navy/20 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-broadcast-red/50"
              />
            </Field>
            <Field label="Status">
              <label className="inline-flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={v.published}
                  onChange={(e) => field('published', e.target.checked)}
                />
                Published (live on bbsports.com)
              </label>
            </Field>
          </div>

          {error ? (
            <div className="text-sm text-broadcast-red bg-broadcast-red/5 border border-broadcast-red/30 rounded px-3 py-2">
              {error}
            </div>
          ) : null}

          <div className="flex flex-col gap-2">
            <button
              type="submit"
              disabled={submitting}
              className="inline-flex items-center justify-center bg-navy text-bone uppercase tracking-[0.18em] text-sm font-bold py-3 rounded hover:bg-navy/90 disabled:opacity-60"
            >
              {submitting ? 'Saving…' : v.published ? 'Save changes' : 'Save draft'}
            </button>
            {!v.published ? (
              <button
                type="button"
                onClick={(e) => onSubmit(e, true)}
                disabled={submitting}
                className="inline-flex items-center justify-center bg-broadcast-red text-bone uppercase tracking-[0.18em] text-sm font-bold py-3 rounded hover:bg-broadcast-red/90 disabled:opacity-60"
              >
                Publish now
              </button>
            ) : (
              <button
                type="button"
                onClick={(e) => onSubmit(e, false)}
                disabled={submitting}
                className="inline-flex items-center justify-center border border-broadcast-red text-broadcast-red uppercase tracking-[0.18em] text-sm font-bold py-3 rounded hover:bg-broadcast-red/5 disabled:opacity-60"
              >
                Unpublish
              </button>
            )}
            {mode === 'edit' && v.id ? (
              <Link
                href={`/articles/${v.slug}`}
                target="_blank"
                rel="noreferrer"
                className="text-center text-sm text-navy/70 underline-offset-2 hover:underline"
              >
                Open public URL →
              </Link>
            ) : null}
          </div>
        </aside>
      </div>
    </form>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="flex items-baseline justify-between mb-1.5">
        <label className="text-xs font-mono uppercase tracking-[0.2em] text-navy/70">{label}</label>
        {hint ? <span className="text-[11px] text-navy/40">{hint}</span> : null}
      </div>
      {children}
    </div>
  );
}
