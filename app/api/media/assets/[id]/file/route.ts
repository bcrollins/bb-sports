import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getMediaAssetById } from '@/lib/queries';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const asset = await getMediaAssetById(id);
  if (!asset) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const session = await getSession();
  if (!asset.approved && !session) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  if (asset.dataBase64) {
    const buffer = Buffer.from(asset.dataBase64, 'base64');
    return new NextResponse(buffer, {
      headers: {
        'Content-Type': asset.contentType || 'image/jpeg',
        'Cache-Control': asset.approved ? 'public, max-age=31536000, immutable' : 'private, no-store',
      },
    });
  }

  const url = asset.assetUrl || asset.externalUrl;
  if (url) return NextResponse.redirect(url);
  return NextResponse.json({ error: 'Media bytes unavailable' }, { status: 404 });
}
