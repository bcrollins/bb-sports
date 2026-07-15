/**
 * Admin articles collection.
 *  GET  /api/admin/articles   — list everything (including drafts)
 *  POST /api/admin/articles   — create a draft only
 */
import { NextRequest, NextResponse } from 'next/server';
import { ZodError } from 'zod';
import { getCurrentUser } from '@/lib/auth';
import { BoundedJsonError, readBoundedJson } from '@/lib/bounded-json';
import { createArticle, getAllArticles } from '@/lib/queries';
import {
  articlePublicationSnapshotFromArticle,
  isArticleSlugUniqueViolation,
} from '@/lib/article-publication-queries';
import {
  hashArticleEditableState,
  hashArticlePublicationSnapshot,
} from '@/lib/article-publication';
import {
  ARTICLE_MAX_JSON_BODY_BYTES,
  articlePayloadSchema,
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
  return json(
    { error: 'The article request could not be completed.', code: 'INTERNAL' },
    500,
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) return json({ error: 'Unauthorized', code: 'UNAUTHORIZED' }, 401);
    const all = await getAllArticles();
    return json({ articles: all });
  } catch {
    return json(
      { error: 'The article list is temporarily unavailable.', code: 'INTERNAL' },
      500,
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return json({ error: 'Unauthorized', code: 'UNAUTHORIZED' }, 401);
    // Unlike req.json(), this reader enforces the limit while consuming the stream.
    const body = await readBoundedJson(req, ARTICLE_MAX_JSON_BODY_BYTES);
    if (isRecord(body) && body.published === true) {
      return json(
        {
          error: 'New articles must begin as drafts and use Brad’s approval flow.',
          code: 'PUBLICATION_REQUIRES_APPROVAL',
        },
        400,
      );
    }

    const input = articlePayloadSchema.parse(body);
    const article = await createArticle({
      slug: input.slug,
      title: input.title,
      dek: input.dek,
      body: input.body,
      sport: input.sport,
      hero: input.hero,
      heroAlt: input.heroAlt,
      heroCredit: input.heroCredit,
      authorId: user.id,
      authorName: input.authorName || user.name,
      aiAssisted: input.aiAssisted,
      bradsTake: input.bradsTake,
      published: false,
    });
    let draftHash: string | null = null;
    try {
      draftHash = hashArticlePublicationSnapshot(
        articlePublicationSnapshotFromArticle(article),
      );
    } catch {
      // A draft can be saved before every publication-only requirement is met.
    }
    return json(
      {
        ok: true,
        article,
        editToken: hashArticleEditableState(article),
        draftHash,
      },
      201,
    );
  } catch (error) {
    if (isArticleSlugUniqueViolation(error)) {
      return json({ error: 'Slug already in use.', code: 'SLUG_CONFLICT' }, 409);
    }
    return requestErrorResponse(error);
  }
}
