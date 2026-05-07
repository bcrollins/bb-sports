import type { MediaAsset } from './db/schema';
import { publicMediaUrl } from './queries';

export function serializeMediaAsset(asset: MediaAsset) {
  return {
    id: asset.id,
    kind: asset.kind,
    status: asset.status,
    title: asset.title,
    sport: asset.sport,
    placement: asset.placement,
    prompt: asset.prompt,
    provider: asset.provider,
    model: asset.model,
    assetUrl: publicMediaUrl(asset),
    externalUrl: asset.externalUrl,
    contentType: asset.contentType,
    altText: asset.altText,
    credit: asset.credit,
    aspectRatio: asset.aspectRatio,
    resolution: asset.resolution,
    durationSeconds: asset.durationSeconds,
    animated: asset.animated,
    approved: asset.approved,
    requestId: asset.requestId,
    createdAt: asset.createdAt.toISOString(),
    updatedAt: asset.updatedAt.toISOString(),
  };
}

export type SerializedMediaAsset = ReturnType<typeof serializeMediaAsset>;
