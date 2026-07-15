import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { getNewsEventSnapshot, updateNewsEvent } from '@/lib/newsroom-queries';
import { updateNewsEventInputSchema } from '@/lib/newsroom-validation';
import { newsroomActor, newsroomErrorResponse, readJson } from '../../_shared';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const { id } = await params;
    const snapshot = await getNewsEventSnapshot(id);
    return NextResponse.json({ data: snapshot }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) {
    return newsroomErrorResponse(error);
  }
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const { id } = await params;
    const body = await readJson(req);
    const input = updateNewsEventInputSchema.parse({
      ...(body && typeof body === 'object' ? body : {}),
      eventId: id,
    });
    const result = await updateNewsEvent(input, newsroomActor(user));
    return NextResponse.json(
      { data: result },
      { headers: { 'Cache-Control': 'private, no-store' } },
    );
  } catch (error) {
    return newsroomErrorResponse(error);
  }
}
