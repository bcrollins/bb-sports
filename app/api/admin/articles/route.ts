/**
 * Admin articles collection.
 *  GET  /api/admin/articles   — list everything (incl. drafts)
 *  POST /api/admin/articles   — create
 */
import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { createArticle, getAllArticles } from '@/lib/queries';
import { articlePayloadSchema, validationErrorMessage } from '@/lib/article-validation';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const all = await getAllArticles();
  return NextResponse.json({ articles: all });
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  let body: unknown = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }
  const parsed = articlePayloadSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: validationErrorMessage(parsed.error) }, { status: 400 });
  }
  const input = parsed.data;
  try {
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
      published: input.published,
    });
    return NextResponse.json({ ok: true, article }, { status: 201 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Create failed';
    if (msg.includes('duplicate key')) {
      return NextResponse.json({ error: 'Slug already in use' }, { status: 409 });
    }
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
