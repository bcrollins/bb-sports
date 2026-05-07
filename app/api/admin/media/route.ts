import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { createMediaAsset, getMediaAssets } from '@/lib/queries';
import { mediaGenerationSchema, validationErrorMessage } from '@/lib/media-validation';
import { serializeMediaAsset } from '@/lib/media-assets';
import {
  composeSportsMediaPrompt,
  generateXaiImages,
  startXaiVideo,
  XaiProviderError,
  xaiProviderState,
} from '@/lib/xai-media';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const assets = await getMediaAssets({ limit: 48 });
  return NextResponse.json({
    assets: assets.map(serializeMediaAsset),
    provider: xaiProviderState(),
  });
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body: unknown = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const parsed = mediaGenerationSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: validationErrorMessage(parsed.error) }, { status: 400 });
  }

  const input = parsed.data;
  const prompt = composeSportsMediaPrompt(input);
  const title = input.title || `${input.sport || 'BB Sports'} ${input.kind} concept`;
  const altText = `${title} - AI-generated BB Sports ${input.kind} concept.`;

  try {
    if (input.kind === 'video') {
      const video = await startXaiVideo(input);
      const asset = await createMediaAsset({
        kind: 'video',
        status: 'pending',
        title,
        sport: input.sport,
        placement: input.placement,
        prompt,
        provider: 'xai',
        model: xaiProviderState().videoModel,
        altText,
        credit: 'AI-generated motion via xAI Grok; approved by BB Sports before public use.',
        aspectRatio: input.aspectRatio,
        resolution: input.resolution,
        durationSeconds: input.durationSeconds,
        animated: true,
        approved: false,
        requestId: video.requestId,
        rawResponse: video.raw,
        createdBy: user.id,
      });
      return NextResponse.json({ ok: true, assets: [serializeMediaAsset(asset)], provider: xaiProviderState() }, { status: 202 });
    }

    const images = await generateXaiImages(input);
    const assets = await Promise.all(images.map((image, index) =>
      createMediaAsset({
        kind: 'image',
        status: 'ready',
        title: images.length > 1 ? `${title} ${index + 1}` : title,
        sport: input.sport,
        placement: input.placement,
        prompt,
        provider: 'xai',
        model: xaiProviderState().imageModel,
        externalUrl: image.externalUrl ?? '',
        contentType: image.contentType,
        dataBase64: image.base64,
        altText,
        credit: 'AI-generated image via xAI Grok; approved by BB Sports before public use.',
        aspectRatio: input.aspectRatio,
        animated: false,
        approved: false,
        rawResponse: image.raw,
        createdBy: user.id,
      }),
    ));
    return NextResponse.json({ ok: true, assets: assets.map(serializeMediaAsset), provider: xaiProviderState() }, { status: 201 });
  } catch (err) {
    if (err instanceof XaiProviderError) {
      return NextResponse.json({ error: err.message, needs: err.needs ?? [], provider: xaiProviderState() }, { status: err.status });
    }
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Media generation failed' }, { status: 500 });
  }
}
