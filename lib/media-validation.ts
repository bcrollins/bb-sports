import { z } from 'zod';

export const MEDIA_KINDS = ['image', 'video'] as const;
export const MEDIA_PLACEMENTS = [
  'homepage',
  'article-hero',
  'social-card',
  'vertical-short',
  'brand',
  'newsletter',
] as const;
export const MEDIA_ASPECT_RATIOS = ['1:1', '16:9', '9:16', '4:3', '3:4', '3:2', '2:3', '2:1', '1:2'] as const;
export const MEDIA_RESOLUTIONS = ['480p', '720p', '1080p'] as const;

export const mediaGenerationSchema = z.object({
  kind: z.enum(MEDIA_KINDS).default('image'),
  placement: z.enum(MEDIA_PLACEMENTS).default('homepage'),
  sport: z.string().trim().max(40).optional().default('general'),
  title: z.string().trim().max(160).optional().default(''),
  brief: z.string().trim().min(8, 'Add a real creative brief.').max(1200),
  aspectRatio: z.enum(MEDIA_ASPECT_RATIOS).default('16:9'),
  resolution: z.enum(MEDIA_RESOLUTIONS).optional().default('720p'),
  durationSeconds: z.coerce.number().int().min(1).max(15).optional().default(8),
  n: z.coerce.number().int().min(1).max(4).optional().default(1),
  referenceImageUrl: z.string().trim().url().optional().or(z.literal('')).default(''),
});

export const mediaPatchSchema = z.object({
  approved: z.boolean().optional(),
  title: z.string().trim().max(160).optional(),
  altText: z.string().trim().max(500).optional(),
  credit: z.string().trim().max(500).optional(),
  license: z
    .enum([
      'all-rights-reserved',
      'bb-sports-original',
      'ai-generated-xai-approved',
      'licensed-editorial',
      'public-domain',
      'cc0',
      'cc-by',
    ])
    .optional(),
  placement: z.enum(MEDIA_PLACEMENTS).optional(),
  sport: z.string().trim().max(40).optional(),
});

export function validationErrorMessage(error: z.ZodError): string {
  return error.issues.map((i) => i.message).join(' ');
}
