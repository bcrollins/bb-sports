/**
 * Admin markdown preview endpoint.
 *
 * POST /api/admin/preview
 * Body: { body: string }
 * Returns: { html: string }
 *
 * Uses the same remark pipeline the public article pages use, so what Brad sees
 * in the editor preview matches what readers see when published.
 */
import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { renderMarkdown } from '@/lib/markdown';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  let body: { body?: string } = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }
  const html = await renderMarkdown(String(body.body ?? ''));
  return NextResponse.json({ html });
}
