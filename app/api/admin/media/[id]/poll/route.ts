import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { getMediaAssetById, updateMediaAsset } from '@/lib/queries';
import { serializeMediaAsset } from '@/lib/media-assets';
import { pollXaiVideo, XaiProviderError, xaiProviderState } from '@/lib/xai-media';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await params;
  const asset = await getMediaAssetById(id);
  if (!asset) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (!asset.requestId) return NextResponse.json({ error: 'Media asset has no xAI request id.' }, { status: 400 });

  try {
    const result = await pollXaiVideo(asset.requestId);
    const data = result as { status?: string; video?: { url?: string; duration?: number }; model?: string };
    const status = data.status === 'done' ? 'ready' : data.status === 'failed' || data.status === 'expired' ? data.status : 'pending';
    const updated = await updateMediaAsset(id, {
      status,
      assetUrl: data.video?.url ?? asset.assetUrl,
      externalUrl: data.video?.url ?? asset.externalUrl,
      contentType: data.video?.url ? 'video/mp4' : asset.contentType,
      rawResponse: result,
    });
    if (!updated) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json({ ok: true, asset: serializeMediaAsset(updated), provider: xaiProviderState() });
  } catch (err) {
    if (err instanceof XaiProviderError) {
      return NextResponse.json({ error: err.message, needs: err.needs ?? [], provider: xaiProviderState() }, { status: err.status });
    }
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Video poll failed' }, { status: 500 });
  }
}
