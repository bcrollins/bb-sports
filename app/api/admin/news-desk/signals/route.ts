import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { createManualNewsSignal } from '@/lib/newsroom-queries';
import { manualNewsSignalInputSchema } from '@/lib/newsroom-validation';
import { newsroomActor, newsroomErrorResponse, readJson } from '../_shared';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const input = manualNewsSignalInputSchema.parse(await readJson(req));
    const result = await createManualNewsSignal(input, newsroomActor(user));
    return NextResponse.json(
      { data: result },
      { status: result.created ? 201 : 200, headers: { 'Cache-Control': 'private, no-store' } },
    );
  } catch (error) {
    return newsroomErrorResponse(error);
  }
}
