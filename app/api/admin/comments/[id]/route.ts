import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { assertCapability } from '@/lib/admin-roles';
import { commentModerationSchema, validationErrorMessage } from '@/lib/comment-validation';
import { updateCommentStatus } from '@/lib/queries';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Context = { params: Promise<{ id: string }> };

export async function PUT(req: NextRequest, { params }: Context) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const allowed = assertCapability(user.role, 'moderate_comments');
  if (!allowed.ok) return NextResponse.json({ error: allowed.error }, { status: 403 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON.' }, { status: 400 });
  }

  const parsed = commentModerationSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: validationErrorMessage(parsed.error) }, { status: 400 });
  }

  const { id } = await params;
  try {
    const comment = await updateCommentStatus(id, parsed.data.status);
    if (!comment) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json({ ok: true, comment });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Comment moderation failed.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
