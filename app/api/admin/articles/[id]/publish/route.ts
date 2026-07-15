import { NextRequest, NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { ZodError } from 'zod';
import { getCurrentUser } from '@/lib/auth';
import {
  PublicationError,
  getArticlePublicationStatus,
  publicationActor,
  publishArticleRevision,
  unpublishArticle,
} from '@/lib/article-publication-queries';
import { articlePublishRequestSchema, canPublishArticle } from '@/lib/article-publication';
import { articleUnpublishRequestSchema } from '@/lib/article-validation';
import { BoundedJsonError, readBoundedJson } from '@/lib/bounded-json';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const PRIVATE_HEADERS = { 'Cache-Control': 'private, no-store' } as const;

function json(body: unknown, status = 200): NextResponse {
  return NextResponse.json(body, { status, headers: PRIVATE_HEADERS });
}

function validationResponse(error: ZodError): NextResponse {
  return json(
    {
      error: 'The publication request did not pass validation.',
      code: 'VALIDATION',
      issues: error.issues.map((issue) => ({
        path: issue.path.join('.'),
        message: issue.message,
      })),
    },
    400,
  );
}

function publicationErrorResponse(error: unknown): NextResponse {
  if (error instanceof BoundedJsonError) {
    return json({ error: error.message, code: error.code }, error.status);
  }
  if (error instanceof ZodError) return validationResponse(error);
  if (error instanceof PublicationError) {
    return json({ error: error.message, code: error.code }, error.status);
  }
  return json(
    { error: 'The publication request could not be completed.', code: 'INTERNAL' },
    500,
  );
}

function liveSlug(status: Awaited<ReturnType<typeof getArticlePublicationStatus>>): string | null {
  return status.published ? status.publishedSlug : null;
}

function invalidatePublicationSurfaces(previousSlug: string | null, nextSlug: string | null) {
  const exactPaths = new Set([
    '/',
    '/articles',
    '/search',
    '/rss.xml',
    '/sitemap.xml',
    ...(previousSlug ? [`/articles/${previousSlug}`] : []),
    ...(nextSlug ? [`/articles/${nextSlug}`] : []),
  ]);
  for (const path of exactPaths) revalidatePath(path);
  revalidatePath('/rankings', 'layout');
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await getCurrentUser();
    if (!user) return json({ error: 'Unauthorized', code: 'UNAUTHORIZED' }, 401);
    if (!canPublishArticle(user.role)) {
      return json(
        { error: 'Only Brad’s super-admin account can publish.', code: 'FORBIDDEN' },
        403,
      );
    }
    const { id } = await params;
    const input = articlePublishRequestSchema.parse(await readBoundedJson(req));
    if (input.articleId !== id) {
      return json(
        {
          error: 'The approved article ID must match the requested article.',
          code: 'ARTICLE_ID_MISMATCH',
          issues: [
            {
              path: 'articleId',
              message: 'articleId must exactly match the article ID in the URL.',
            },
          ],
        },
        400,
      );
    }

    const before = await getArticlePublicationStatus(id);
    await publishArticleRevision(input, publicationActor(user));
    const status = await getArticlePublicationStatus(id);
    invalidatePublicationSurfaces(liveSlug(before), liveSlug(status));
    return json({ status });
  } catch (error) {
    return publicationErrorResponse(error);
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await getCurrentUser();
    if (!user) return json({ error: 'Unauthorized', code: 'UNAUTHORIZED' }, 401);
    if (!canPublishArticle(user.role)) {
      return json(
        { error: 'Only Brad’s super-admin account can unpublish.', code: 'FORBIDDEN' },
        403,
      );
    }
    const { id } = await params;
    const input = articleUnpublishRequestSchema.parse(await readBoundedJson(req));
    const before = await getArticlePublicationStatus(id);
    await unpublishArticle(id, input.rationale, publicationActor(user));
    const status = await getArticlePublicationStatus(id);
    invalidatePublicationSurfaces(liveSlug(before), liveSlug(status));
    return json({ status });
  } catch (error) {
    return publicationErrorResponse(error);
  }
}
