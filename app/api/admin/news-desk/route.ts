import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { getNewsroomSnapshot } from '@/lib/newsroom-queries';
import { newsroomErrorResponse } from './_shared';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const snapshot = await getNewsroomSnapshot({ eventLimit: 100, activityLimit: 40 });
    return NextResponse.json({ data: snapshot }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) {
    return newsroomErrorResponse(error);
  }
}
