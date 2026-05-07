/**
 * Admin article item.
 *  GET    /api/admin/articles/[id]   — fetch (incl. drafts)
 *  PUT    /api/admin/articles/[id]   — patch (any subset of fields)
 *  DELETE /api/admin/articles/[id]   — remove
 */
import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import {
  deleteArticle,
  getArticleById,
  updateArticle,
} from '@/lib/queries';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(_: NextRequest, { params }: { params: { id: string } }) {
  const a = await getArticleById(params.id);
  if (!a) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json({ article: a });
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  let body: Record<string, unknown> = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }
  const allow = ['slug', 'title', 'dek', 'body', 'sport', 'hero', 'authorName', 'published'] as const;
  const patch: Record<string, unknown> = {};
  for (const k of allow) {
    if (k in body) patch[k] = body[k];
  }
  try {
    const updated = await updateArticle(params.id, patch as never);
    if (!updated) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json({ ok: true, article: updated });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Update failed';
    if (msg.includes('duplicate key')) {
      return NextResponse.json({ error: 'Slug already in use' }, { status: 409 });
    }
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function DELETE(_: NextRequest, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const removed = await deleteArticle(params.id);
  return NextResponse.json({ ok: removed });
}
