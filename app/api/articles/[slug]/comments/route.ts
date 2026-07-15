import { NextRequest, NextResponse } from 'next/server';
import { requestMeta } from '@/lib/request-meta';
import { commentCreateSchema, validationErrorMessage } from '@/lib/comment-validation';
import {
  createCommentForArticleSlug,
  dbAvailable,
  getPublishedArticleIdBySlug,
  getPublicCommentsByArticleSlug,
} from '@/lib/queries';
import { recordAnalyticsEventSafe } from '@/lib/analytics';
import { rejectIfMutationBlocked } from '@/lib/mutation-guard';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Context = { params: Promise<{ slug: string }> };

export async function GET(_: NextRequest, { params }: Context) {
  if (!dbAvailable) {
    return NextResponse.json(
      {
        ok: false,
        available: false,
        error: 'Comments require the BB Sports database.',
        comments: [],
      },
      { status: 503 },
    );
  }
  const { slug } = await params;
  try {
    // Canonical catalog only — unpublished / filesystem-only slugs are unavailable.
    const articleId = await getPublishedArticleIdBySlug(slug);
    if (!articleId) {
      return NextResponse.json(
        {
          ok: false,
          available: false,
          error: 'Comments open only on published catalog articles.',
          comments: [],
        },
        { status: 404 },
      );
    }
    const comments = await getPublicCommentsByArticleSlug(slug);
    return NextResponse.json({ ok: true, available: true, comments });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Comments unavailable.';
    return NextResponse.json(
      { ok: false, available: false, error: message, comments: [] },
      { status: 503 },
    );
  }
}

export async function POST(req: NextRequest, { params }: Context) {
  const blocked = rejectIfMutationBlocked(req);
  if (blocked) return blocked;

  const { slug } = await params;
  const { ip, userAgent } = requestMeta(req);

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON.' }, { status: 400 });
  }

  const parsed = commentCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: validationErrorMessage(parsed.error) }, { status: 400 });
  }

  try {
    const result = await createCommentForArticleSlug({
      slug,
      comment: parsed.data,
      ip,
      userAgent,
    });
    await recordAnalyticsEventSafe({
      eventName: 'comment_submitted',
      path: `/articles/${slug}`,
      source: 'article-comments',
      properties: {
        slug,
        status: result.status,
        parent_reply: Boolean(parsed.data.parentId),
      },
    }, { ip, userAgent });
    const publicNow = result.status === 'approved';
    return NextResponse.json({
      ok: true,
      status: result.status,
      reason: result.reason,
      comment: result.comment,
      message: publicNow
        ? 'Comment posted.'
        : 'Comment received and held for moderation before it appears.',
    }, { status: publicNow ? 201 : 202 });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Comment could not be saved.';
    const status = message.includes('Too many comments') ? 429 : message.includes('not found') ? 404 : 503;
    return NextResponse.json({ error: message }, { status });
  }
}
