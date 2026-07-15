import { NextResponse } from 'next/server';
import { z, ZodError } from 'zod';
import { getCurrentUser } from '@/lib/auth';
import {
  PublicationError,
  createVerifiedEventArticleDraft,
  publicationActor,
} from '@/lib/article-publication-queries';
import { BoundedJsonError, readBoundedJson } from '@/lib/bounded-json';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const PRIVATE_HEADERS = { 'Cache-Control': 'private, no-store' } as const;
const requestSchema = z.object({}).strict();

function json(body: unknown, status = 200): NextResponse {
  return NextResponse.json(body, { status, headers: PRIVATE_HEADERS });
}

function errorResponse(error: unknown): NextResponse {
  if (error instanceof BoundedJsonError) {
    return json({ error: error.message, code: error.code }, error.status);
  }
  if (error instanceof ZodError) {
    return json(
      {
        error: 'The article-draft request did not pass validation.',
        code: 'VALIDATION',
        issues: error.issues.map((issue) => ({
          path: issue.path.join('.'),
          message: issue.message,
        })),
      },
      400,
    );
  }
  if (error instanceof PublicationError) {
    return json({ error: error.message, code: error.code }, error.status);
  }
  return json(
    { error: 'The verified event could not create an article draft.', code: 'INTERNAL' },
    500,
  );
}

/**
 * Convert one human-verified event into an immutable, cited article revision.
 * This endpoint creates a working draft only; it has no publication action.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    // Authenticate before resolving route parameters or consuming a request
    // body so anonymous callers cannot probe ids or force parsing work.
    const user = await getCurrentUser();
    if (!user) return json({ error: 'Unauthorized', code: 'UNAUTHORIZED' }, 401);

    const { id } = await params;
    requestSchema.parse(await readBoundedJson(request, 1_024));
    const result = await createVerifiedEventArticleDraft(id, publicationActor(user));
    return json({
      data: {
        created: result.created,
        articleId: result.article.id,
        articleTitle: result.article.title,
        articleSlug: result.article.slug,
        revisionId: result.revision.id,
        contentHash: result.revision.contentHash,
      },
    });
  } catch (error) {
    return errorResponse(error);
  }
}
