/**
 * Admin articles collection.
 *  GET  /api/admin/articles   — list everything (incl. drafts)
 *  POST /api/admin/articles   — create
 */
import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { createArticle, getAllArticles } from '@/lib/queries';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const all = await getAllArticles();
  return NextResponse.json({ articles: all });
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  let body: Record<string, unknown> = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }
  const slug = String(body.slug ?? '').trim();
  const title = String(body.title ?? '').trim();
  if (!slug || !title) {
    return NextResponse.json({ error: 'slug + title required' }, { status: 400 });
  }
  try {
    const article = await createArticle({
      slug,
      title,
      dek: typeof body.dek === 'string' ? body.dek : '',
      body: typeof body.body === 'string' ? body.body : '',
      sport: typeof body.sport === 'string' ? body.sport : 'Op-Ed',
      hero: typeof body.hero === 'string' ? body.hero : '',
      authorId: user.id,
      authorName: typeof body.authorName === 'string' ? body.authorName : user.name,
      published: Boolean(body.published),
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
