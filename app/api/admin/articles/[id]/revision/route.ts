import { NextRequest, NextResponse } from 'next/server';
import { ZodError } from 'zod';
import { getCurrentUser } from '@/lib/auth';
import {
  PublicationError,
  createArticleRevision,
  getArticlePublicationStatus,
  publicationActor,
} from '@/lib/article-publication-queries';
import { articleRevisionPrepareRequestSchema } from '@/lib/article-publication';
import { BoundedJsonError, readBoundedJson } from '@/lib/bounded-json';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const PRIVATE_HEADERS = { 'Cache-Control': 'private, no-store' } as const;

function json(body: unknown, status = 200): NextResponse {
  return NextResponse.json(body, { status, headers: PRIVATE_HEADERS });
}

function publicationErrorResponse(error: unknown): NextResponse {
  if (error instanceof BoundedJsonError) {
    return json({ error: error.message, code: error.code }, error.status);
  }
  if (error instanceof ZodError) {
    return json(
      {
        error: 'The revision request did not pass validation.',
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
    { error: 'The article revision request could not be completed.', code: 'INTERNAL' },
    500,
  );
}

export async function GET(
  _: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await getCurrentUser();
    if (!user) return json({ error: 'Unauthorized', code: 'UNAUTHORIZED' }, 401);
    const { id } = await params;
    const status = await getArticlePublicationStatus(id);
    return json({ status });
  } catch (error) {
    return publicationErrorResponse(error);
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await getCurrentUser();
    if (!user) return json({ error: 'Unauthorized', code: 'UNAUTHORIZED' }, 401);
    const { id } = await params;
    const input = articleRevisionPrepareRequestSchema.parse(await readBoundedJson(req));
    const prepared = await createArticleRevision(
      id,
      publicationActor(user),
      input.expectedDraftHash,
    );
    const status = await getArticlePublicationStatus(id);
    // The exact immutable revision may already exist, so this idempotent prepare
    // endpoint returns 200 rather than claiming every request created a row.
    return json({ revision: prepared.revision, status });
  } catch (error) {
    return publicationErrorResponse(error);
  }
}
