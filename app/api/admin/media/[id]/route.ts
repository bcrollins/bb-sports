import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import {
  getMediaAssetById,
  MediaAssetConflictError,
  updateMediaAsset,
} from '@/lib/queries';
import { mediaPatchSchema, validationErrorMessage } from '@/lib/media-validation';
import { serializeMediaAsset } from '@/lib/media-assets';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await params;
  let body: unknown = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }
  const parsed = mediaPatchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: validationErrorMessage(parsed.error) }, { status: 400 });
  }
  const current = await getMediaAssetById(id);
  if (!current) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  try {
    const updated = await updateMediaAsset(id, parsed.data);
    if (!updated) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json({ ok: true, asset: serializeMediaAsset(updated) });
  } catch (error) {
    if (error instanceof MediaAssetConflictError) {
      return NextResponse.json({ error: error.message, code: 'MEDIA_IN_USE' }, { status: 409 });
    }
    return NextResponse.json({ error: 'Media update failed.' }, { status: 500 });
  }
}
