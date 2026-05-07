import type { z } from 'zod';
import type { mediaGenerationSchema } from './media-validation';

const XAI_BASE_URL = process.env.XAI_BASE_URL ?? 'https://api.x.ai/v1';
const IMAGE_MODEL = process.env.XAI_IMAGE_MODEL ?? 'grok-imagine-image';
const VIDEO_MODEL = process.env.XAI_VIDEO_MODEL ?? 'grok-imagine-video';

export interface XaiProviderState {
  hasKey: boolean;
  approved: boolean;
  ready: boolean;
  imageModel: string;
  videoModel: string;
}

export class XaiProviderError extends Error {
  constructor(message: string, readonly status = 503, readonly needs?: string[]) {
    super(message);
  }
}

export function xaiProviderState(): XaiProviderState {
  const hasKey = Boolean(process.env.XAI_API_KEY);
  const approved = process.env.BBSPORTS_APPROVED_XAI === 'true';
  return {
    hasKey,
    approved,
    ready: hasKey && approved,
    imageModel: IMAGE_MODEL,
    videoModel: VIDEO_MODEL,
  };
}

function requireXaiReady(): string {
  const state = xaiProviderState();
  const needs: string[] = [];
  if (!state.hasKey) needs.push('XAI_API_KEY');
  if (!state.approved) needs.push('BBSPORTS_APPROVED_XAI=true');
  if (needs.length > 0) {
    throw new XaiProviderError(`xAI Grok media is not configured: ${needs.join(', ')}`, 503, needs);
  }
  return process.env.XAI_API_KEY as string;
}

type MediaGenerationInput = z.infer<typeof mediaGenerationSchema>;

export function composeSportsMediaPrompt(input: MediaGenerationInput): string {
  const format =
    input.kind === 'video'
      ? `${input.durationSeconds}s ${input.resolution} ${input.aspectRatio} animated sports-media clip`
      : `${input.aspectRatio} editorial sports image`;
  return [
    `Create a ${format} for BB Sports.`,
    `Placement: ${input.placement}. Sport/context: ${input.sport || 'general sports'}.`,
    `Creative brief: ${input.brief}.`,
    'Visual style: premium modern sports desk, Apple-level polish, New York Times editorial restraint, broadcast energy, navy #0A1F44, bone #F5F2EC, breaking-news red #D7263D, crisp lighting, useful negative space for headlines.',
    'Brand guardrails: do not copy official team logos, league marks, broadcast graphics, Getty/AP watermarks, player likenesses, celebrity likenesses, or copyrighted photos. Use original abstract sports atmosphere, silhouettes, equipment, fields, arenas, textures, color, and motion.',
    'Text guardrail: no readable text inside the image or video unless explicitly requested.',
  ].join(' ');
}

export interface GeneratedImage {
  base64: string;
  externalUrl?: string;
  contentType: string;
  raw: unknown;
}

export async function generateXaiImages(input: MediaGenerationInput): Promise<GeneratedImage[]> {
  const apiKey = requireXaiReady();
  const prompt = composeSportsMediaPrompt(input);
  const response = await fetch(`${XAI_BASE_URL}/images/generations`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: IMAGE_MODEL,
      prompt,
      n: input.n,
      response_format: 'b64_json',
      aspect_ratio: input.aspectRatio,
    }),
    signal: AbortSignal.timeout(120000),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new XaiProviderError(providerMessage(data, 'xAI image generation failed'), response.status);
  }

  const rows = Array.isArray(data?.data) ? data.data : [];
  if (rows.length === 0) throw new XaiProviderError('xAI did not return any images.', 502);

  return Promise.all(rows.map(async (row: { b64_json?: string; url?: string }) => {
    let base64 = row.b64_json ?? '';
    if (!base64 && row.url) {
      base64 = await downloadAsBase64(row.url);
    }
    if (!base64) throw new XaiProviderError('xAI returned an image without usable bytes.', 502);
    return {
      base64,
      externalUrl: row.url,
      contentType: detectImageContentType(base64),
      raw: { created: data?.created, url: row.url ? 'temporary-url-present' : undefined },
    };
  }));
}

export interface StartedVideo {
  requestId: string;
  raw: unknown;
}

export async function startXaiVideo(input: MediaGenerationInput): Promise<StartedVideo> {
  const apiKey = requireXaiReady();
  const body: Record<string, unknown> = {
    model: VIDEO_MODEL,
    prompt: composeSportsMediaPrompt(input),
    duration: input.durationSeconds,
    aspect_ratio: input.aspectRatio,
    resolution: input.resolution,
  };
  if (input.referenceImageUrl) body.image = { url: input.referenceImageUrl };

  const response = await fetch(`${XAI_BASE_URL}/videos/generations`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(60000),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new XaiProviderError(providerMessage(data, 'xAI video generation failed'), response.status);
  }
  const requestId = String(data?.request_id ?? '');
  if (!requestId) throw new XaiProviderError('xAI did not return a video request_id.', 502);
  return { requestId, raw: data };
}

export async function pollXaiVideo(requestId: string): Promise<unknown> {
  const apiKey = requireXaiReady();
  const response = await fetch(`${XAI_BASE_URL}/videos/${encodeURIComponent(requestId)}`, {
    headers: { Authorization: `Bearer ${apiKey}` },
    signal: AbortSignal.timeout(30000),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new XaiProviderError(providerMessage(data, 'xAI video polling failed'), response.status);
  }
  return data;
}

async function downloadAsBase64(url: string): Promise<string> {
  const response = await fetch(url, { signal: AbortSignal.timeout(60000) });
  if (!response.ok) throw new XaiProviderError('xAI image URL could not be downloaded before it expired.', response.status);
  const buffer = Buffer.from(await response.arrayBuffer());
  return buffer.toString('base64');
}

function detectImageContentType(base64: string): string {
  const signature = Buffer.from(base64.slice(0, 24), 'base64');
  if (signature.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff]))) return 'image/jpeg';
  if (signature.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'image/png';
  if (signature.subarray(0, 4).toString('ascii') === 'RIFF') return 'image/webp';
  return 'image/jpeg';
}

function providerMessage(data: unknown, fallback: string): string {
  if (data && typeof data === 'object') {
    const maybe = data as { error?: { message?: string }; message?: string };
    return maybe.error?.message ?? maybe.message ?? fallback;
  }
  return fallback;
}
