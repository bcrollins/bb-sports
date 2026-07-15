import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { addNewsEvidence } from '@/lib/newsroom-queries';
import { newsEvidenceInputSchema } from '@/lib/newsroom-validation';
import { newsroomActor, newsroomErrorResponse, readJson } from '../../../_shared';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const { id } = await params;
    const body = await readJson(req);
    const input = newsEvidenceInputSchema.parse({
      ...(body && typeof body === 'object' ? body : {}),
      eventId: id,
    });
    const result = await addNewsEvidence(input, newsroomActor(user));
    return NextResponse.json(
      { data: result },
      { status: 201, headers: { 'Cache-Control': 'private, no-store' } },
    );
  } catch (error) {
    return newsroomErrorResponse(error);
  }
}
