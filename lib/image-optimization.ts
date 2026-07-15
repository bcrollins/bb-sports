/**
 * Image optimization contracts — rights-safe, budget-aware.
 */

import { ROUTE_PAYLOAD_BUDGETS } from '@/lib/performance-budgets';

export const IMAGE_OPTIMIZATION = {
  maxHeroWidthPx: 1600,
  maxHeroBytes: 350_000,
  maxCardBytes: 120_000,
  maxViewportImageKb: ROUTE_PAYLOAD_BUDGETS.totalImageKbPerViewport,
  requireWidthHeightOrFill: true,
  requireAlt: true,
  disallowAutoplayAudio: true,
} as const;

export type ImageAssetCheck = {
  src: string;
  alt?: string | null;
  width?: number | null;
  height?: number | null;
  fill?: boolean;
  byteLength?: number | null;
  role: 'hero' | 'card' | 'icon' | 'og' | 'other';
};

export function validateImageDelivery(asset: ImageAssetCheck): {
  ok: boolean;
  reasons: string[];
} {
  const reasons: string[] = [];
  const src = String(asset.src ?? '').trim();
  if (!src) reasons.push('missing src');
  if (IMAGE_OPTIMIZATION.requireAlt && !String(asset.alt ?? '').trim()) {
    reasons.push('missing alt');
  }
  if (IMAGE_OPTIMIZATION.requireWidthHeightOrFill) {
    const hasDims =
      asset.fill === true ||
      (typeof asset.width === 'number' &&
        asset.width > 0 &&
        typeof asset.height === 'number' &&
        asset.height > 0);
    if (!hasDims) reasons.push('missing dimensions or fill');
  }
  if (typeof asset.byteLength === 'number' && asset.byteLength > 0) {
    const max =
      asset.role === 'hero'
        ? IMAGE_OPTIMIZATION.maxHeroBytes
        : asset.role === 'card'
          ? IMAGE_OPTIMIZATION.maxCardBytes
          : IMAGE_OPTIMIZATION.maxHeroBytes;
    if (asset.byteLength > max) {
      reasons.push(`bytes ${asset.byteLength} exceed ${max} for ${asset.role}`);
    }
  }
  if (typeof asset.width === 'number' && asset.width > IMAGE_OPTIMIZATION.maxHeroWidthPx) {
    reasons.push(`width ${asset.width} exceeds ${IMAGE_OPTIMIZATION.maxHeroWidthPx}`);
  }
  // Data-saver path: never require remote tracking pixels.
  if (/^https?:\/\/.*\.(doubleclick|facebook|googlesyndication)/i.test(src)) {
    reasons.push('tracking host not allowed');
  }
  return { ok: reasons.length === 0, reasons };
}

export function estimateViewportImageKb(bytes: number[]): number {
  return Math.ceil(bytes.reduce((a, b) => a + Math.max(0, b), 0) / 1024);
}

export function viewportWithinBudget(bytes: number[]): boolean {
  return estimateViewportImageKb(bytes) <= IMAGE_OPTIMIZATION.maxViewportImageKb;
}
