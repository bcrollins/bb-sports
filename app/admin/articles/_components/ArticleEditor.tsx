/**
 * Shared article editor — used for both /admin/articles/new and
 * /admin/articles/[id]/edit.
 *
 * Editing is deliberately draft-only. Reader-visible content changes only
 * after a server-created immutable revision is explicitly approved by Brad.
 */
'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from 'react';

const SPORTS = ['NFL', 'MLB', 'NHL', 'NBA', 'CFB', 'Soccer', 'MMA', 'Op-Ed'];

// Keep this literal in the client bundle. The canonical server contract lives
// in lib/article-publication.ts, which intentionally imports node:crypto and
// therefore must never be pulled into this client component.
const ARTICLE_APPROVAL_CONFIRMATION =
  'BRAD APPROVES THIS EXACT ARTICLE FOR PUBLICATION' as const;
const MIN_RATIONALE_LENGTH = 20;

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
  heroAlt: string;
  heroCredit: string;
  authorName: string;
  aiAssisted: boolean;
  bradsTake: string;
}

type ArticleDraftSnapshot = Omit<ArticleFormValues, 'id'>;

type PublicationRevision = {
  id: string;
  articleId: string | null;
  contentHash: string;
  revisionNumber: number | null;
  createdAt: string | null;
  snapshot: ArticleDraftSnapshot;
};

type PublicationStatus = {
  published: boolean;
  draftHash: string | null;
  draftValidationError: string | null;
  currentPublishedHash: string | null;
  currentPublishedRevisionId: string | null;
  hasUnpublishedChanges: boolean;
  publishedSlug: string | null;
  publishedRevisionNumber: number | null;
};

type PublicationOperation = 'prepare' | 'publish' | 'unpublish' | null;

const EMPTY: ArticleFormValues = {
  slug: '',
  title: '',
  dek: '',
  body: '',
  sport: 'Op-Ed',
  hero: '',
  heroAlt: '',
  heroCredit: '',
  authorName: 'Brad Benson',
  aiAssisted: false,
  bradsTake: '',
};

function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function nullableText(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function parseDraftSnapshot(value: unknown): ArticleDraftSnapshot | null {
  const snapshot = asRecord(value);
  if (!snapshot || typeof snapshot.aiAssisted !== 'boolean') return null;
  const textFields = [
    'slug',
    'title',
    'dek',
    'body',
    'sport',
    'hero',
    'heroAlt',
    'heroCredit',
    'authorName',
    'bradsTake',
  ] as const;
  if (textFields.some((fieldName) => typeof snapshot[fieldName] !== 'string')) return null;

  return {
    slug: snapshot.slug as string,
    title: snapshot.title as string,
    dek: snapshot.dek as string,
    body: snapshot.body as string,
    sport: snapshot.sport as string,
    hero: snapshot.hero as string,
    heroAlt: snapshot.heroAlt as string,
    heroCredit: snapshot.heroCredit as string,
    authorName: snapshot.authorName as string,
    aiAssisted: snapshot.aiAssisted,
    bradsTake: snapshot.bradsTake as string,
  };
}

function canonicalText(value: string): string {
  return value.normalize('NFC').replace(/\r\n?/g, '\n').trim();
}

function reviewedSnapshot(values: ArticleFormValues): ArticleDraftSnapshot {
  return {
    slug: canonicalText(values.slug).toLocaleLowerCase('en-US'),
    title: canonicalText(values.title),
    dek: canonicalText(values.dek),
    body: canonicalText(values.body),
    sport: canonicalText(values.sport),
    hero: canonicalText(values.hero),
    heroAlt: canonicalText(values.heroAlt),
    heroCredit: canonicalText(values.heroCredit),
    authorName: canonicalText(values.authorName),
    aiAssisted: values.aiAssisted,
    bradsTake: canonicalText(values.bradsTake),
  };
}

function snapshotFingerprint(snapshot: ArticleDraftSnapshot): string {
  return JSON.stringify(snapshot);
}

function parseRevision(value: unknown): PublicationRevision | null {
  const revision = asRecord(value);
  if (!revision) return null;
  const id = nullableText(revision.id);
  const contentHash = nullableText(revision.contentHash);
  const snapshot = parseDraftSnapshot(revision.snapshot);
  if (!id || !contentHash || !snapshot) return null;
  return {
    id,
    articleId: nullableText(revision.articleId),
    contentHash,
    revisionNumber:
      typeof revision.revisionNumber === 'number' ? revision.revisionNumber : null,
    createdAt: nullableText(revision.createdAt),
    snapshot,
  };
}

function parsePublicationStatus(value: unknown): PublicationStatus | null {
  const status = asRecord(value);
  if (!status) return null;
  const draftHash = nullableText(status.draftHash);
  const currentPublishedHash = nullableText(status.currentPublishedHash);
  const published = status.published === true;

  return {
    published,
    draftHash,
    draftValidationError: nullableText(status.draftValidationError),
    currentPublishedHash,
    currentPublishedRevisionId: nullableText(status.currentPublishedRevisionId),
    hasUnpublishedChanges:
      typeof status.hasUnpublishedChanges === 'boolean'
        ? status.hasUnpublishedChanges
        : published
          ? draftHash !== currentPublishedHash
          : Boolean(draftHash),
    publishedSlug: nullableText(status.publishedSlug),
    publishedRevisionNumber:
      typeof status.publishedRevisionNumber === 'number'
        ? status.publishedRevisionNumber
        : null,
  };
}

function apiError(payload: unknown, fallback: string): string {
  const record = asRecord(payload);
  return nullableText(record?.error) ?? fallback;
}

function savePayload(values: ArticleFormValues) {
  // This explicit allowlist is the critical draft-only boundary. Neither an
  // article id nor workflow/publication state can enter the normal save API.
  return {
    slug: values.slug,
    title: values.title,
    dek: values.dek,
    body: values.body,
    sport: values.sport,
    hero: values.hero,
    heroAlt: values.heroAlt,
    heroCredit: values.heroCredit,
    authorName: values.authorName,
    aiAssisted: values.aiAssisted,
    bradsTake: values.bradsTake,
  };
}

function fingerprint(values: ArticleFormValues): string {
  return JSON.stringify(savePayload(values));
}

function mergeSavedArticle(value: unknown, fallback: ArticleFormValues): ArticleFormValues {
  const article = asRecord(value);
  if (!article) return fallback;
  const text = (key: keyof ArticleFormValues): string =>
    typeof article[key] === 'string' ? article[key] : String(fallback[key] ?? '');

  return {
    id: nullableText(article.id) ?? fallback.id,
    slug: text('slug'),
    title: text('title'),
    dek: text('dek'),
    body: text('body'),
    sport: text('sport'),
    hero: text('hero'),
    heroAlt: text('heroAlt'),
    heroCredit: text('heroCredit'),
    authorName: text('authorName'),
    aiAssisted:
      typeof article.aiAssisted === 'boolean' ? article.aiAssisted : fallback.aiAssisted,
    bradsTake: text('bradsTake'),
  };
}

export function ArticleEditor({
  initial,
  mode,
  userRole,
  initialDraftHash = null,
  initialEditToken = null,
}: {
  initial?: ArticleFormValues;
  mode: 'new' | 'edit';
  userRole: string;
  initialDraftHash?: string | null;
  initialEditToken?: string | null;
}) {
  const router = useRouter();
  const [v, setV] = useState<ArticleFormValues>(initial ?? EMPTY);
  const [savedFingerprint, setSavedFingerprint] = useState(() =>
    fingerprint(initial ?? EMPTY),
  );
  const [reviewedDraftHash, setReviewedDraftHash] = useState<string | null>(
    initialDraftHash,
  );
  const [editToken, setEditToken] = useState<string | null>(initialEditToken);
  const [autoSlug, setAutoSlug] = useState(mode === 'new');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [previewHtml, setPreviewHtml] = useState<string>('');
  const [previewing, setPreviewing] = useState(false);
  const previewTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [publicationStatus, setPublicationStatus] = useState<PublicationStatus | null>(null);
  const [statusLoading, setStatusLoading] = useState(mode === 'edit');
  const [statusError, setStatusError] = useState<string | null>(null);
  const [statusOffline, setStatusOffline] = useState(false);
  const [preparedRevision, setPreparedRevision] = useState<PublicationRevision | null>(null);
  const [publicationOperation, setPublicationOperation] =
    useState<PublicationOperation>(null);
  const [publicationError, setPublicationError] = useState<string | null>(null);
  const [publicationMessage, setPublicationMessage] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState('');
  const [approvalRationale, setApprovalRationale] = useState('');
  const [unpublishRationale, setUnpublishRationale] = useState('');

  const isSuperAdmin = userRole === 'super_admin';
  const hasUnsavedChanges = fingerprint(v) !== savedFingerprint;
  const serverDraftChanged = Boolean(
    publicationStatus && publicationStatus.draftHash !== reviewedDraftHash,
  );

  // Auto-derive slug from title in create mode unless Brad has typed in slug manually.
  useEffect(() => {
    if (autoSlug) {
      setV((current) => ({ ...current, slug: slugify(current.title) }));
    }
  }, [v.title, autoSlug]);

  // Debounced server-side markdown preview.
  useEffect(() => {
    if (previewTimer.current) clearTimeout(previewTimer.current);
    previewTimer.current = setTimeout(async () => {
      setPreviewing(true);
      try {
        const response = await fetch('/api/admin/preview', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ body: v.body }),
        });
        const data: unknown = await response.json().catch(() => ({}));
        const preview = asRecord(data);
        setPreviewHtml(typeof preview?.html === 'string' ? preview.html : '');
      } finally {
        setPreviewing(false);
      }
    }, 400);
    return () => {
      if (previewTimer.current) clearTimeout(previewTimer.current);
    };
  }, [v.body]);

  const refreshPublicationStatus = useCallback(
    async (signal?: AbortSignal) => {
      if (mode !== 'edit' || !v.id) return;
      setStatusLoading(true);
      setStatusError(null);
      setStatusOffline(false);
      try {
        const response = await fetch(`/api/admin/articles/${v.id}/revision`, {
          method: 'GET',
          cache: 'no-store',
          signal,
        });
        const data: unknown = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(apiError(data, 'Could not load publication status.'));
        const parsed = parsePublicationStatus(asRecord(data)?.status);
        if (!parsed) throw new Error('Publication status returned an invalid response.');
        setPublicationStatus(parsed);
      } catch (caught) {
        if (caught instanceof DOMException && caught.name === 'AbortError') return;
        setStatusOffline(typeof navigator !== 'undefined' && navigator.onLine === false);
        setStatusError(
          caught instanceof Error ? caught.message : 'Could not load publication status.',
        );
      } finally {
        if (!signal?.aborted) setStatusLoading(false);
      }
    },
    [mode, v.id],
  );

  useEffect(() => {
    if (mode !== 'edit' || !v.id) return;
    const controller = new AbortController();
    void refreshPublicationStatus(controller.signal);
    return () => controller.abort();
  }, [mode, refreshPublicationStatus, v.id]);

  const wordCount = useMemo(
    () => v.body.trim().split(/\s+/).filter(Boolean).length,
    [v.body],
  );

  function field<K extends keyof ArticleFormValues>(key: K, value: ArticleFormValues[K]) {
    setV((current) => ({ ...current, [key]: value }));
    setPreparedRevision(null);
    setConfirmation('');
    setPublicationError(null);
    setPublicationMessage(null);
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    if (!v.title.trim() || !v.slug.trim()) {
      setError('Title and slug are required.');
      return;
    }
    if (v.hero.trim() && !v.heroAlt.trim()) {
      setError('Hero alt text is required when a hero image is set.');
      return;
    }
    if (v.hero.trim() && !v.heroCredit.trim()) {
      setError('Hero credit is required when a hero image is set.');
      return;
    }

    setSubmitting(true);
    try {
      if (mode === 'edit' && !editToken) {
        setError('Reload this draft before saving; its edit precondition is missing.');
        return;
      }
      const payload = savePayload(v);
      const url = mode === 'new' ? '/api/admin/articles' : `/api/admin/articles/${v.id}`;
      const response = await fetch(url, {
        method: mode === 'new' ? 'POST' : 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...(mode === 'edit' && editToken ? { 'If-Match': `"${editToken}"` } : {}),
        },
        body: JSON.stringify(payload),
      });
      const data: unknown = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(apiError(data, 'Save failed.'));
        return;
      }

      const saved = mergeSavedArticle(asRecord(data)?.article, v);
      const nextEditToken = nullableText(asRecord(data)?.editToken);
      const nextDraftHash = nullableText(asRecord(data)?.draftHash);
      if (!nextEditToken) {
        setError('The server did not return a safe edit precondition. Reload before continuing.');
        return;
      }
      const newId = saved.id ?? v.id;
      setV(saved);
      setSavedFingerprint(fingerprint(saved));
      setEditToken(nextEditToken);
      setReviewedDraftHash(nextDraftHash);
      setPreparedRevision(null);
      setConfirmation('');
      setPublicationMessage(
        mode === 'edit'
          ? 'Draft saved. Live readers still see the last approved snapshot.'
          : null,
      );
      if (mode === 'new' && newId) {
        router.push(`/admin/articles/${newId}/edit`);
      } else {
        await refreshPublicationStatus();
        router.refresh();
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Network error');
    } finally {
      setSubmitting(false);
    }
  }

  async function prepareRevision() {
    if (!v.id || mode !== 'edit') return;
    setPublicationError(null);
    setPublicationMessage(null);
    if (hasUnsavedChanges) {
      setPublicationError('Save the draft before preparing its exact approval revision.');
      return;
    }
    if (!publicationStatus?.draftHash) {
      setPublicationError(
        publicationStatus?.draftValidationError ??
          'Resolve the draft validation error before preparing a revision.',
      );
      return;
    }
    if (!reviewedDraftHash || publicationStatus.draftHash !== reviewedDraftHash) {
      setPublicationError(
        'The draft changed on the server. Reload and review it before preparing approval.',
      );
      return;
    }

    const expectedDraftHash = reviewedDraftHash;
    const locallyReviewedSnapshot = reviewedSnapshot(v);
    setPublicationOperation('prepare');
    try {
      const response = await fetch(`/api/admin/articles/${v.id}/revision`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ expectedDraftHash }),
      });
      const data: unknown = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(apiError(data, 'Could not prepare the revision.'));
      const record = asRecord(data);
      const revision = parseRevision(record?.revision);
      const nextStatus = parsePublicationStatus(record?.status);
      if (!revision) throw new Error('The server did not return a valid immutable revision.');
      if (revision.articleId !== v.id) {
        throw new Error('The prepared revision belongs to a different article.');
      }
      if (
        revision.contentHash !== expectedDraftHash ||
        !nextStatus?.draftHash ||
        revision.contentHash !== nextStatus.draftHash
      ) {
        throw new Error('The prepared revision did not match the current draft hash.');
      }
      if (
        snapshotFingerprint(revision.snapshot) !==
        snapshotFingerprint(locallyReviewedSnapshot)
      ) {
        setPublicationStatus(nextStatus);
        void refreshPublicationStatus();
        router.refresh();
        throw new Error(
          'The draft changed on the server. Reload and review the exact content before preparing approval.',
        );
      }
      setPreparedRevision(revision);
      setConfirmation('');
      if (nextStatus) setPublicationStatus(nextStatus);
      setPublicationMessage(
        `Revision${revision.revisionNumber ? ` ${revision.revisionNumber}` : ''} prepared. Review the exact hash before approval.`,
      );
    } catch (caught) {
      setPreparedRevision(null);
      setPublicationError(
        caught instanceof Error ? caught.message : 'Could not prepare the revision.',
      );
    } finally {
      setPublicationOperation(null);
    }
  }

  const preparedRevisionIsFresh = Boolean(
    preparedRevision &&
      !hasUnsavedChanges &&
      !serverDraftChanged &&
      publicationStatus?.draftHash &&
      preparedRevision.contentHash === publicationStatus.draftHash &&
      preparedRevision.contentHash === reviewedDraftHash,
  );

  async function publishRevision() {
    if (!v.id || !isSuperAdmin) return;
    setPublicationError(null);
    setPublicationMessage(null);
    if (!preparedRevision || !preparedRevisionIsFresh) {
      setPublicationError('Prepare a fresh exact revision after the last saved change.');
      return;
    }
    if (confirmation !== ARTICLE_APPROVAL_CONFIRMATION) {
      setPublicationError('Type the exact Brad approval phrase shown below.');
      return;
    }
    if (approvalRationale.trim().length < MIN_RATIONALE_LENGTH) {
      setPublicationError('Add an approval rationale of at least 20 characters.');
      return;
    }

    setPublicationOperation('publish');
    try {
      const response = await fetch(`/api/admin/articles/${v.id}/publish`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          articleId: v.id,
          expectedRevisionId: preparedRevision.id,
          expectedContentHash: preparedRevision.contentHash,
          confirmation,
          rationale: approvalRationale.trim(),
        }),
      });
      const data: unknown = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(apiError(data, 'Publication failed.'));
      const nextStatus = parsePublicationStatus(asRecord(data)?.status);
      if (nextStatus) setPublicationStatus(nextStatus);
      else await refreshPublicationStatus();
      setPreparedRevision(null);
      setConfirmation('');
      setApprovalRationale('');
      setPublicationMessage('Brad approved this exact revision. The immutable snapshot is live.');
      router.refresh();
    } catch (caught) {
      setPublicationError(caught instanceof Error ? caught.message : 'Publication failed.');
    } finally {
      setPublicationOperation(null);
    }
  }

  async function unpublishArticle() {
    if (!v.id || !isSuperAdmin || !publicationStatus?.published) return;
    setPublicationError(null);
    setPublicationMessage(null);
    if (unpublishRationale.trim().length < MIN_RATIONALE_LENGTH) {
      setPublicationError('Add an unpublishing rationale of at least 20 characters.');
      return;
    }
    if (
      !window.confirm(
        'Take this article off the public site? Its approved revision and audit history will be retained.',
      )
    ) {
      return;
    }

    setPublicationOperation('unpublish');
    try {
      const response = await fetch(`/api/admin/articles/${v.id}/publish`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rationale: unpublishRationale.trim() }),
      });
      const data: unknown = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(apiError(data, 'Unpublishing failed.'));
      const nextStatus = parsePublicationStatus(asRecord(data)?.status);
      if (nextStatus) setPublicationStatus(nextStatus);
      else await refreshPublicationStatus();
      setPreparedRevision(null);
      setConfirmation('');
      setUnpublishRationale('');
      setPublicationMessage('The article is no longer public. Its approval history was retained.');
      router.refresh();
    } catch (caught) {
      setPublicationError(caught instanceof Error ? caught.message : 'Unpublishing failed.');
    } finally {
      setPublicationOperation(null);
    }
  }

  const needsPublicationApproval = Boolean(
    publicationStatus &&
      (!publicationStatus.published || publicationStatus.hasUnpublishedChanges),
  );
  const canSubmitApproval = Boolean(
    preparedRevisionIsFresh &&
      confirmation === ARTICLE_APPROVAL_CONFIRMATION &&
      approvalRationale.trim().length >= MIN_RATIONALE_LENGTH &&
      publicationOperation === null,
  );
  const publicSlug = publicationStatus?.publishedSlug;

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      <header className="flex items-baseline gap-3 border-b border-navy/15 pb-3">
        <div className="flex-1">
          <p className="font-mono text-[11px] uppercase tracking-[0.3em] text-broadcast-red">
            ── {mode === 'new' ? 'New article' : 'Edit article'}
          </p>
          <h1 className="mt-1 font-display text-3xl italic">
            {mode === 'new' ? 'Write a new piece' : v.title || 'Untitled'}
          </h1>
        </div>
        <Link
          href="/admin/articles"
          className="inline-flex min-h-11 items-center text-sm text-navy/70 underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-broadcast-red/50"
        >
          ← Back
        </Link>
      </header>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Field id="article-title" label="Title">
            <input
              id="article-title"
              type="text"
              value={v.title}
              onChange={(event) => field('title', event.target.value)}
              className="min-h-11 w-full rounded border border-navy/20 px-3 py-2.5 font-serif text-lg focus:outline-none focus:ring-2 focus:ring-broadcast-red/50"
              placeholder="The headline a fan would say out loud"
              required
            />
          </Field>

          <Field
            id="article-slug"
            label="Slug"
            hint="URL fragment. Auto-generated from title until you edit it."
          >
            <input
              id="article-slug"
              type="text"
              value={v.slug}
              onChange={(event) => {
                setAutoSlug(false);
                field('slug', slugify(event.target.value));
              }}
              className="min-h-11 w-full rounded border border-navy/20 px-3 py-2.5 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-broadcast-red/50"
              required
            />
          </Field>

          <Field id="article-dek" label="Dek (sub-headline)">
            <input
              id="article-dek"
              type="text"
              value={v.dek}
              onChange={(event) => field('dek', event.target.value)}
              className="min-h-11 w-full rounded border border-navy/20 px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-broadcast-red/50"
              placeholder="One sentence that says what the take is."
            />
          </Field>

          <Field id="article-body" label="Body (markdown)" hint={`${wordCount} words`}>
            <textarea
              id="article-body"
              value={v.body}
              onChange={(event) => field('body', event.target.value)}
              className="min-h-[420px] w-full rounded border border-navy/20 px-3 py-2.5 font-mono text-sm leading-6 focus:outline-none focus:ring-2 focus:ring-broadcast-red/50"
              placeholder="Write the take. Markdown welcome — # ## **bold** *italic* [link](url) - lists, > quotes."
            />
          </Field>

          <details className="rounded border border-navy/10 bg-white">
            <summary className="flex min-h-11 cursor-pointer items-center px-4 py-2.5 font-mono text-sm uppercase tracking-[0.18em] text-navy/70 hover:bg-bone-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-broadcast-red/50">
              Live preview {previewing ? '· refreshing…' : ''}
            </summary>
            <div
              className="prose prose-navy max-w-none p-5 prose-headings:font-serif prose-headings:font-bold"
              dangerouslySetInnerHTML={{ __html: previewHtml }}
            />
          </details>
        </div>

        <aside className="space-y-4">
          <div className="space-y-4 rounded border border-navy/10 bg-white p-4">
            <Field id="article-sport" label="Sport">
              <select
                id="article-sport"
                value={v.sport}
                onChange={(event) => field('sport', event.target.value)}
                className="min-h-11 w-full rounded border border-navy/20 px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-broadcast-red/50"
              >
                {SPORTS.map((sport) => (
                  <option key={sport} value={sport}>
                    {sport}
                  </option>
                ))}
              </select>
            </Field>
            <Field
              id="article-hero"
              label="Hero image URL"
              hint="Optional for drafts. Publication requires an approved /api/media/assets/{uuid}/file path from the BB Sports media library."
            >
              <input
                id="article-hero"
                type="text"
                value={v.hero}
                onChange={(event) => field('hero', event.target.value)}
                className="min-h-11 w-full rounded border border-navy/20 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-broadcast-red/50"
              />
              <Link
                href="/admin/media"
                className="mt-2 inline-flex min-h-11 items-center text-xs font-semibold text-broadcast-red underline-offset-2 hover:underline"
              >
                Generate or copy a Grok media asset
              </Link>
            </Field>
            <Field
              id="article-hero-alt"
              label="Hero alt text"
              hint="Required when a hero is set — describes the image for screen readers."
            >
              <input
                id="article-hero-alt"
                type="text"
                value={v.heroAlt}
                onChange={(event) => field('heroAlt', event.target.value)}
                className="min-h-11 w-full rounded border border-navy/20 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-broadcast-red/50"
              />
            </Field>
            <Field id="article-hero-credit" label="Hero credit" hint="Photo credit line.">
              <input
                id="article-hero-credit"
                type="text"
                value={v.heroCredit}
                onChange={(event) => field('heroCredit', event.target.value)}
                className="min-h-11 w-full rounded border border-navy/20 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-broadcast-red/50"
              />
            </Field>
            <Field id="article-author" label="Author">
              <input
                id="article-author"
                type="text"
                value={v.authorName}
                onChange={(event) => field('authorName', event.target.value)}
                className="min-h-11 w-full rounded border border-navy/20 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-broadcast-red/50"
              />
            </Field>
            <fieldset>
              <legend className="mb-1.5 font-mono text-xs uppercase tracking-[0.2em] text-navy/70">
                AI-assisted
              </legend>
              <p id="ai-assisted-hint" className="mb-2 text-[11px] text-navy/50">
                Required label when AI did the heavy lift on the draft.
              </p>
              <label className="inline-flex min-h-11 items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={v.aiAssisted}
                  onChange={(event) => field('aiAssisted', event.target.checked)}
                  aria-describedby="ai-assisted-hint"
                  className="size-4"
                />
                Mark as AI-assisted (AI · Brad-edited)
              </label>
            </fieldset>
            {v.aiAssisted ? (
              <Field
                id="article-brads-take"
                label="Brad’s Take"
                hint="Required before an AI-assisted draft can be approved."
              >
                <textarea
                  id="article-brads-take"
                  value={v.bradsTake}
                  onChange={(event) => field('bradsTake', event.target.value)}
                  rows={4}
                  className="min-h-24 w-full rounded border border-navy/20 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-broadcast-red/50"
                  placeholder="What Brad actually thinks. AI never writes this."
                />
              </Field>
            ) : null}

            <div className="rounded border border-navy/10 bg-bone-50 p-3">
              <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-navy/60">
                Draft-only editing
              </p>
              <p className="mt-1 text-sm leading-5 text-navy/75">
                Saving never publishes. If this story is live, readers keep seeing its last
                approved immutable snapshot.
              </p>
            </div>
          </div>

          {error ? (
            <div
              role="alert"
              className="rounded border border-broadcast-red/30 bg-broadcast-red/5 px-3 py-2 text-sm text-broadcast-red"
            >
              {error}
            </div>
          ) : null}

          <button
            type="submit"
            disabled={submitting}
            className="inline-flex min-h-11 w-full items-center justify-center rounded bg-navy px-4 py-3 text-sm font-bold uppercase tracking-[0.18em] text-bone hover:bg-navy/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-broadcast-red/50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting ? 'Saving draft…' : mode === 'new' ? 'Create draft' : 'Save draft changes'}
          </button>

          {mode === 'edit' && v.id ? (
            <PublicationApprovalPanel
              isSuperAdmin={isSuperAdmin}
              status={publicationStatus}
              statusLoading={statusLoading}
              statusError={statusError}
              statusOffline={statusOffline}
              hasUnsavedChanges={hasUnsavedChanges}
              serverDraftChanged={serverDraftChanged}
              preparedRevision={preparedRevision}
              preparedRevisionIsFresh={preparedRevisionIsFresh}
              operation={publicationOperation}
              error={publicationError}
              message={publicationMessage}
              confirmation={confirmation}
              approvalRationale={approvalRationale}
              unpublishRationale={unpublishRationale}
              needsPublicationApproval={needsPublicationApproval}
              canSubmitApproval={canSubmitApproval}
              onRetry={() => void refreshPublicationStatus()}
              onPrepare={() => void prepareRevision()}
              onConfirmationChange={setConfirmation}
              onApprovalRationaleChange={setApprovalRationale}
              onUnpublishRationaleChange={setUnpublishRationale}
              onPublish={() => void publishRevision()}
              onUnpublish={() => void unpublishArticle()}
            />
          ) : (
            <div className="rounded border border-navy/10 bg-white p-4 text-sm leading-5 text-navy/70">
              Save this draft first. Exact revision preparation and Brad-only publication
              controls appear on the edit screen.
            </div>
          )}

          {publicationStatus?.published && publicSlug ? (
            <Link
              href={`/articles/${publicSlug}`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex min-h-11 w-full items-center justify-center text-center text-sm text-navy/70 underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-broadcast-red/50"
            >
              Open approved public snapshot →
            </Link>
          ) : null}
        </aside>
      </div>
    </form>
  );
}

function PublicationApprovalPanel({
  isSuperAdmin,
  status,
  statusLoading,
  statusError,
  statusOffline,
  hasUnsavedChanges,
  serverDraftChanged,
  preparedRevision,
  preparedRevisionIsFresh,
  operation,
  error,
  message,
  confirmation,
  approvalRationale,
  unpublishRationale,
  needsPublicationApproval,
  canSubmitApproval,
  onRetry,
  onPrepare,
  onConfirmationChange,
  onApprovalRationaleChange,
  onUnpublishRationaleChange,
  onPublish,
  onUnpublish,
}: {
  isSuperAdmin: boolean;
  status: PublicationStatus | null;
  statusLoading: boolean;
  statusError: string | null;
  statusOffline: boolean;
  hasUnsavedChanges: boolean;
  serverDraftChanged: boolean;
  preparedRevision: PublicationRevision | null;
  preparedRevisionIsFresh: boolean;
  operation: PublicationOperation;
  error: string | null;
  message: string | null;
  confirmation: string;
  approvalRationale: string;
  unpublishRationale: string;
  needsPublicationApproval: boolean;
  canSubmitApproval: boolean;
  onRetry: () => void;
  onPrepare: () => void;
  onConfirmationChange: (value: string) => void;
  onApprovalRationaleChange: (value: string) => void;
  onUnpublishRationaleChange: (value: string) => void;
  onPublish: () => void;
  onUnpublish: () => void;
}) {
  return (
    <section
      aria-labelledby="publication-approval-heading"
      aria-busy={statusLoading || operation !== null}
      className="space-y-4 rounded border-2 border-navy/15 bg-white p-4 shadow-sm"
    >
      <div>
        <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-broadcast-red">
          Immutable publication gate
        </p>
        <h2 id="publication-approval-heading" className="mt-1 font-serif text-xl font-bold">
          Brad approves the exact revision
        </h2>
        <p className="mt-1 text-sm leading-5 text-navy/70">
          Draft edits never leak live. Publication binds one content hash to Brad’s explicit
          approval and an append-only audit event.
        </p>
      </div>

      {statusLoading ? (
        <div role="status" className="space-y-2" aria-label="Loading publication status">
          <div className="h-11 animate-pulse rounded bg-navy/10 motion-reduce:animate-none" />
          <div className="h-16 animate-pulse rounded bg-navy/10 motion-reduce:animate-none" />
        </div>
      ) : statusError ? (
        <div className="rounded border border-amber-500/40 bg-amber-50 p-3">
          <p role="alert" className="text-sm font-semibold text-navy">
            {statusOffline ? 'Offline — publication status is unavailable.' : statusError}
          </p>
          <p className="mt-1 text-xs text-navy/60">No publication action is available until status reloads.</p>
          <button
            type="button"
            onClick={onRetry}
            className="mt-2 inline-flex min-h-11 items-center justify-center rounded border border-navy/20 px-4 text-sm font-semibold hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-broadcast-red/50"
          >
            Retry status
          </button>
        </div>
      ) : status ? (
        <>
          <dl className="grid gap-2 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
            <StatusCard
              label="Public state"
              value={status.published ? 'LIVE SNAPSHOT' : 'NOT LIVE'}
              detail={
                status.published
                  ? `Approved revision${status.publishedRevisionNumber ? ` ${status.publishedRevisionNumber}` : ''}`
                  : 'No article snapshot is public'
              }
              critical={status.published}
            />
            <StatusCard
              label="Working draft"
              value={
                serverDraftChanged
                  ? 'SERVER DRAFT CHANGED'
                  : hasUnsavedChanges
                  ? 'UNSAVED CHANGES'
                  : status.draftValidationError
                    ? 'NEEDS ATTENTION'
                    : status.hasUnpublishedChanges
                      ? 'UNPUBLISHED CHANGES'
                      : status.published
                        ? 'MATCHES LIVE'
                        : 'DRAFT READY'
              }
              detail={
                serverDraftChanged
                  ? 'Reload before saving or preparing approval; another session changed this draft'
                  : hasUnsavedChanges
                  ? 'Save before preparing a revision'
                  : status.draftValidationError ?? 'Draft status is current'
              }
            />
          </dl>

          <div className="space-y-2 rounded bg-bone-50 p-3 text-xs">
            <HashRow label="Current draft hash" value={status.draftHash} />
            <HashRow label="Live snapshot hash" value={status.currentPublishedHash} />
            {status.currentPublishedRevisionId ? (
              <HashRow label="Live revision ID" value={status.currentPublishedRevisionId} />
            ) : null}
          </div>

          {needsPublicationApproval ? (
            <div className="space-y-3 border-t border-navy/10 pt-4">
              <button
                type="button"
                onClick={onPrepare}
                disabled={
                  operation !== null ||
                  serverDraftChanged ||
                  hasUnsavedChanges ||
                  !status.draftHash ||
                  Boolean(status.draftValidationError)
                }
                className="inline-flex min-h-11 w-full items-center justify-center rounded border border-navy/25 px-4 text-sm font-bold text-navy hover:bg-bone-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-broadcast-red/50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {operation === 'prepare' ? 'Preparing exact revision…' : 'Prepare exact revision'}
              </button>

              {preparedRevision ? (
                <div
                  className={`rounded border p-3 ${
                    preparedRevisionIsFresh
                      ? 'border-emerald-600/30 bg-emerald-50'
                      : 'border-amber-500/40 bg-amber-50'
                  }`}
                >
                  <p className="text-sm font-bold text-navy">
                    {preparedRevisionIsFresh ? '✓ Exact revision prepared' : '⚠ Revision is stale'}
                  </p>
                  <div className="mt-2 space-y-1 text-xs text-navy/70">
                    {preparedRevision.revisionNumber ? (
                      <p>Revision {preparedRevision.revisionNumber}</p>
                    ) : null}
                    <HashRow label="Approval hash" value={preparedRevision.contentHash} />
                  </div>
                  {preparedRevisionIsFresh ? (
                    <details className="mt-3 rounded border border-emerald-700/20 bg-white">
                      <summary className="flex min-h-11 cursor-pointer items-center px-3 py-2 text-sm font-semibold text-navy focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-broadcast-red/50">
                        Review every field in this exact revision
                      </summary>
                      <div className="space-y-3 border-t border-emerald-700/15 p-3 text-xs text-navy/75">
                        <dl className="grid gap-2 sm:grid-cols-2">
                          <SnapshotField label="Title" value={preparedRevision.snapshot.title} />
                          <SnapshotField label="Slug" value={preparedRevision.snapshot.slug} mono />
                          <SnapshotField label="Sport" value={preparedRevision.snapshot.sport} />
                          <SnapshotField label="Author" value={preparedRevision.snapshot.authorName} />
                          <SnapshotField
                            label="AI assistance"
                            value={preparedRevision.snapshot.aiAssisted ? 'AI-assisted' : 'Not AI-assisted'}
                          />
                          <SnapshotField label="Hero URL" value={preparedRevision.snapshot.hero || 'None'} mono />
                          <SnapshotField label="Hero alt" value={preparedRevision.snapshot.heroAlt || 'None'} />
                          <SnapshotField label="Hero credit" value={preparedRevision.snapshot.heroCredit || 'None'} />
                        </dl>
                        <SnapshotField label="Dek" value={preparedRevision.snapshot.dek || 'None'} />
                        <SnapshotField
                          label="Brad’s Take"
                          value={preparedRevision.snapshot.bradsTake || 'None'}
                        />
                        <div>
                          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-navy/55">
                            Exact markdown body
                          </p>
                          <pre className="mt-1 max-h-80 overflow-auto whitespace-pre-wrap break-words rounded bg-bone-50 p-3 font-mono text-xs leading-5 text-navy">
                            {preparedRevision.snapshot.body || '(empty)'}
                          </pre>
                        </div>
                      </div>
                    </details>
                  ) : null}
                </div>
              ) : (
                <p className="text-xs leading-5 text-navy/60">
                  No revision is prepared in this review session. Any edit or save invalidates a
                  prepared approval.
                </p>
              )}

              {isSuperAdmin ? (
                <div className="space-y-3 rounded border border-broadcast-red/20 bg-broadcast-red/[0.03] p-3">
                  <Field
                    id="article-publication-confirmation"
                    label="Exact approval phrase"
                    hint="Type it exactly; paste/autofill is not provided."
                  >
                    <p className="mb-2 select-all break-words rounded bg-white p-2 font-mono text-xs leading-5 text-navy">
                      {ARTICLE_APPROVAL_CONFIRMATION}
                    </p>
                    <input
                      id="article-publication-confirmation"
                      type="text"
                      value={confirmation}
                      onChange={(event) => onConfirmationChange(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter') event.preventDefault();
                      }}
                      autoComplete="off"
                      spellCheck={false}
                      className="min-h-11 w-full rounded border border-navy/25 px-3 font-mono text-xs focus:outline-none focus:ring-2 focus:ring-broadcast-red/50"
                    />
                  </Field>
                  <Field
                    id="article-publication-rationale"
                    label="Approval rationale"
                    hint={`${approvalRationale.trim().length}/${MIN_RATIONALE_LENGTH} minimum characters`}
                  >
                    <textarea
                      id="article-publication-rationale"
                      value={approvalRationale}
                      onChange={(event) => onApprovalRationaleChange(event.target.value)}
                      rows={3}
                      maxLength={4000}
                      className="min-h-24 w-full rounded border border-navy/25 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-broadcast-red/50"
                      placeholder="Why this exact revision is verified and ready for readers."
                    />
                  </Field>
                  <button
                    type="button"
                    onClick={onPublish}
                    disabled={!canSubmitApproval}
                    className="inline-flex min-h-11 w-full items-center justify-center rounded bg-broadcast-red px-4 text-sm font-bold uppercase tracking-[0.14em] text-bone hover:bg-broadcast-red/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-broadcast-red/50 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {operation === 'publish' ? 'Publishing exact revision…' : 'Approve & publish exact revision'}
                  </button>
                </div>
              ) : (
                <div className="rounded border border-navy/10 bg-bone-50 p-3 text-sm leading-5 text-navy/70">
                  You can edit and prepare an exact revision. Publish and unpublish controls are
                  visible only to the current super-admin account.
                </div>
              )}
            </div>
          ) : (
            <div className="rounded border border-emerald-600/25 bg-emerald-50 p-3 text-sm leading-5 text-navy">
              ✓ The working draft matches the live approved snapshot. No new publication approval
              is needed.
            </div>
          )}

          {isSuperAdmin && status.published ? (
            <div className="space-y-3 border-t border-broadcast-red/20 pt-4">
              <Field
                id="article-unpublish-rationale"
                label="Unpublishing rationale"
                hint={`${unpublishRationale.trim().length}/${MIN_RATIONALE_LENGTH} minimum characters`}
              >
                <textarea
                  id="article-unpublish-rationale"
                  value={unpublishRationale}
                  onChange={(event) => onUnpublishRationaleChange(event.target.value)}
                  rows={3}
                  maxLength={4000}
                  className="min-h-24 w-full rounded border border-broadcast-red/30 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-broadcast-red/50"
                  placeholder="Why this story must be removed from public view."
                />
              </Field>
              <button
                type="button"
                onClick={onUnpublish}
                disabled={
                  operation !== null ||
                  unpublishRationale.trim().length < MIN_RATIONALE_LENGTH
                }
                className="inline-flex min-h-11 w-full items-center justify-center rounded border border-broadcast-red px-4 text-sm font-bold text-broadcast-red hover:bg-broadcast-red/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-broadcast-red/50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {operation === 'unpublish' ? 'Removing from public view…' : 'Unpublish with audit record'}
              </button>
            </div>
          ) : null}
        </>
      ) : (
        <div className="rounded border border-navy/10 bg-bone-50 p-3 text-sm text-navy/70">
          Publication status is not available. Retry before taking any release action.
        </div>
      )}

      <div aria-live="polite" aria-atomic="true">
        {error ? (
          <p role="alert" className="rounded border border-broadcast-red/30 bg-broadcast-red/5 p-3 text-sm text-broadcast-red">
            {error}
          </p>
        ) : message ? (
          <p className="rounded border border-emerald-600/25 bg-emerald-50 p-3 text-sm text-navy">
            {message}
          </p>
        ) : null}
      </div>
    </section>
  );
}

function StatusCard({
  label,
  value,
  detail,
  critical = false,
}: {
  label: string;
  value: string;
  detail: string;
  critical?: boolean;
}) {
  return (
    <div className="rounded border border-navy/10 bg-bone-50 p-3">
      <dt className="font-mono text-[10px] uppercase tracking-[0.2em] text-navy/55">{label}</dt>
      <dd className={`mt-1 text-sm font-bold ${critical ? 'text-broadcast-red' : 'text-navy'}`}>
        {value}
      </dd>
      <dd className="mt-1 text-xs leading-4 text-navy/60">{detail}</dd>
    </div>
  );
}

function HashRow({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="grid gap-1 sm:grid-cols-[8.5rem_1fr] lg:grid-cols-1 xl:grid-cols-[8.5rem_1fr]">
      <span className="text-navy/60">{label}</span>
      <code
        className="min-w-0 break-all font-mono text-navy"
        aria-label={`${label}: ${value ?? 'none'}`}
        title={value ?? undefined}
      >
        {value ?? 'None'}
      </code>
    </div>
  );
}

function SnapshotField({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="min-w-0">
      <dt className="font-mono text-[10px] uppercase tracking-[0.18em] text-navy/55">
        {label}
      </dt>
      <dd className={`mt-1 break-words text-navy ${mono ? 'font-mono' : ''}`}>{value}</dd>
    </div>
  );
}

function Field({
  id,
  label,
  hint,
  children,
}: {
  id: string;
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div>
      <div className="mb-1.5 flex flex-wrap items-baseline justify-between gap-1">
        <label htmlFor={id} className="font-mono text-xs uppercase tracking-[0.2em] text-navy/70">
          {label}
        </label>
        {hint ? <span className="text-[11px] text-navy/50">{hint}</span> : null}
      </div>
      {children}
    </div>
  );
}
