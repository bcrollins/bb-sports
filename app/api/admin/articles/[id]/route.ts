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
import {
  articlePatchSchema,
  articlePayloadSchema,
  validationErrorMessage,
  type ArticlePayload,
} from '@/lib/article-validation';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await params;
  const a = await getArticleById(id);
  if (!a) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json({ article: a });
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await params;
  let body: Record<string, unknown> = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }
  const allow = [
    'slug',
    'title',
    'dek',
    'body',
    'sport',
    'hero',
    'heroAlt',
    'heroCredit',
    'authorName',
    'aiAssisted',
    'bradsTake',
    'published',
  ] as const;
  const patch: Record<string, unknown> = {};
  for (const k of allow) {
    if (k in body) patch[k] = body[k];
  }
  const parsedPatch = articlePatchSchema.safeParse(patch);
  if (!parsedPatch.success) {
    return NextResponse.json({ error: validationErrorMessage(parsedPatch.error) }, { status: 400 });
  }
  try {
    const current = await getArticleById(id);
    if (!current) return NextResponse.json({ error: 'Not found' }, { status: 404 });
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
      ...parsedPatch.data,
    };
    const full = articlePayloadSchema.safeParse(merged);
    if (!full.success) {
      return NextResponse.json({ error: validationErrorMessage(full.error) }, { status: 400 });
    }
    const updated = await updateArticle(id, parsedPatch.data);
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

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await params;
  const removed = await deleteArticle(id);
  return NextResponse.json({ ok: removed });
}
