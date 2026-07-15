/**
 * Admin article item.
 *  GET    /api/admin/articles/[id]   — fetch (including drafts)
 *  PUT    /api/admin/articles/[id]   — edit non-publication fields
 *  DELETE /api/admin/articles/[id]   — remove
 */
import { NextRequest, NextResponse } from 'next/server';
import { ZodError } from 'zod';
import { getCurrentUser } from '@/lib/auth';
import {
  deleteVirginArticleDraft,
  PublicationError,
  articlePublicationSnapshotFromArticle,
  isArticleSlugUniqueViolation,
  publicationActor,
} from '@/lib/article-publication-queries';
import {
  canPublishArticle,
  hashArticleEditableState,
  hashArticlePublicationSnapshot,
} from '@/lib/article-publication';
import { BoundedJsonError, readBoundedJson } from '@/lib/bounded-json';
import { getArticleById, updateArticle } from '@/lib/queries';
import {
  ARTICLE_MAX_JSON_BODY_BYTES,
  articlePatchSchema,
  articlePayloadSchema,
  type ArticlePayload,
} from '@/lib/article-validation';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const PRIVATE_HEADERS = { 'Cache-Control': 'private, no-store' } as const;

function json(body: unknown, status = 200): NextResponse {
  return NextResponse.json(body, { status, headers: PRIVATE_HEADERS });
}

function validationResponse(error: ZodError): NextResponse {
  return json(
    {
      error: 'The article request did not pass validation.',
      code: 'VALIDATION',
      issues: error.issues.map((issue) => ({
        path: issue.path.join('.'),
        message: issue.message,
      })),
    },
    400,
  );
}

function requestErrorResponse(error: unknown): NextResponse {
  if (error instanceof BoundedJsonError) {
    return json({ error: error.message, code: error.code }, error.status);
  }
  if (error instanceof ZodError) return validationResponse(error);
  if (error instanceof PublicationError) {
    return json({ error: error.message, code: error.code }, error.status);
  }
  return json(
    { error: 'The article request could not be completed.', code: 'INTERNAL' },
    500,
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function articleDraftHashes(article: Awaited<ReturnType<typeof getArticleById>>): {
  editToken: string;
  draftHash: string | null;
} | null {
  if (!article) return null;
  let draftHash: string | null = null;
  try {
    draftHash = hashArticlePublicationSnapshot(articlePublicationSnapshotFromArticle(article));
  } catch {
    // Incomplete drafts remain editable but cannot prepare a publication revision.
  }
  return { editToken: hashArticleEditableState(article), draftHash };
}

function ifMatchEditToken(request: Request): string | null {
  const value = request.headers.get('if-match');
  const match = value?.match(/^"([a-f0-9]{64})"$/);
  return match?.[1] ?? null;
}

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser();
    if (!user) return json({ error: 'Unauthorized', code: 'UNAUTHORIZED' }, 401);
    const { id } = await params;
    const article = await getArticleById(id);
    if (!article) return json({ error: 'Not found', code: 'NOT_FOUND' }, 404);
    return json({ article, ...articleDraftHashes(article) });
  } catch {
    return json(
      { error: 'The article could not be loaded.', code: 'INTERNAL' },
      500,
    );
  }
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser();
    if (!user) return json({ error: 'Unauthorized', code: 'UNAUTHORIZED' }, 401);
    const { id } = await params;
    const expectedEditToken = ifMatchEditToken(req);
    if (!expectedEditToken) {
      return json(
        {
          error: 'Reload the draft before saving; an exact If-Match edit token is required.',
          code: 'PRECONDITION_REQUIRED',
        },
        428,
      );
    }
    // Unlike req.json(), this reader enforces the limit while consuming the stream.
    const body = await readBoundedJson(req, ARTICLE_MAX_JSON_BODY_BYTES);
    if (isRecord(body) && Object.hasOwn(body, 'published')) {
      return json(
        {
          error: 'Publication state can change only through Brad’s approval flow.',
          code: 'PUBLICATION_REQUIRES_APPROVAL',
        },
        400,
      );
    }

    const patch = articlePatchSchema.parse(body);
    const current = await getArticleById(id);
    if (!current) return json({ error: 'Not found', code: 'NOT_FOUND' }, 404);

    const merged: ArticlePayload = {
      slug: current.slug,
      title: current.title,
      dek: current.dek,
      body: current.body,
      sport: current.sport,
      hero: current.hero,
      heroAlt: current.heroAlt,
      heroCredit: current.heroCredit,
      authorName: current.authorName,
      aiAssisted: current.aiAssisted,
      bradsTake: current.bradsTake,
      published: current.published,
      ...patch,
    };
    articlePayloadSchema.parse(merged);

    const updated = await updateArticle(id, patch, expectedEditToken);
    if (!updated) return json({ error: 'Not found', code: 'NOT_FOUND' }, 404);
    return json({ ok: true, article: updated, ...articleDraftHashes(updated) });
  } catch (error) {
    if (isArticleSlugUniqueViolation(error)) {
      return json({ error: 'Slug already in use.', code: 'SLUG_CONFLICT' }, 409);
    }
    return requestErrorResponse(error);
  }
}

export async function DELETE(
  _: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await getCurrentUser();
    if (!user) return json({ error: 'Unauthorized', code: 'UNAUTHORIZED' }, 401);
    if (!canPublishArticle(user.role)) {
      return json(
        {
          error: 'Only Brad can permanently delete an article draft.',
          code: 'FORBIDDEN',
        },
        403,
      );
    }
    const { id } = await params;
    await deleteVirginArticleDraft(id, publicationActor(user));
    return json({ ok: true });
  } catch (error) {
    return requestErrorResponse(error);
  }
}
