import { z } from 'zod';
import { articleHeroSchema } from './article-publication';

// Zod caps article strings in UTF-16 code units, while the stream reader caps
// encoded bytes. One MiB safely admits the worst-case JSON escaping of every
// schema-valid string (including a 100k-code-unit body) while remaining a hard
// transport ceiling. Publication commands stay on the smaller default limit.
export const ARTICLE_MAX_JSON_BODY_BYTES = 1024 * 1024;

const slug = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Slug must use lowercase words separated by hyphens.')
  .max(200);

export const articlePayloadSchema = z
  .object({
    slug,
    title: z.string().trim().min(1, 'Title is required.').max(240),
    dek: z.string().trim().max(500).optional().default(''),
    body: z.string().trim().max(100_000).optional().default(''),
    sport: z.string().trim().min(1).max(24).optional().default('Op-Ed'),
    hero: articleHeroSchema.optional().default(''),
    heroAlt: z.string().trim().max(500).optional().default(''),
    heroCredit: z.string().trim().max(500).optional().default(''),
    authorName: z.string().trim().min(1).max(120).optional().default('Brad Benson'),
    aiAssisted: z.boolean().optional().default(false),
    bradsTake: z.string().trim().max(5000).optional().default(''),
    published: z.boolean().optional().default(false),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (value.hero && !value.heroAlt) {
      ctx.addIssue({
        code: 'custom',
        path: ['heroAlt'],
        message: 'Hero alt text is required when a hero image is set.',
      });
    }
    if (value.hero && !value.heroCredit) {
      ctx.addIssue({
        code: 'custom',
        path: ['heroCredit'],
        message: 'Hero credit is required when a hero image is set.',
      });
    }
    if (value.published && value.aiAssisted && !value.bradsTake) {
      ctx.addIssue({
        code: 'custom',
        path: ['bradsTake'],
        message: 'AI-assisted pieces cannot publish without Brad’s Take.',
      });
    }
  });

export const articlePatchSchema = z
  .object({
    slug: slug.optional(),
    title: z.string().trim().min(1, 'Title is required.').max(240).optional(),
    dek: z.string().trim().max(500).optional(),
    body: z.string().trim().max(100_000).optional(),
    sport: z.string().trim().min(1).max(24).optional(),
    hero: articleHeroSchema.optional(),
    heroAlt: z.string().trim().max(500).optional(),
    heroCredit: z.string().trim().max(500).optional(),
    authorName: z.string().trim().min(1).max(120).optional(),
    aiAssisted: z.boolean().optional(),
    bradsTake: z.string().trim().max(5000).optional(),
    published: z.boolean().optional(),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (value.hero && value.heroAlt === '') {
      ctx.addIssue({
        code: 'custom',
        path: ['heroAlt'],
        message: 'Hero alt text is required when a hero image is set.',
      });
    }
    if (value.hero && value.heroCredit === '') {
      ctx.addIssue({
        code: 'custom',
        path: ['heroCredit'],
        message: 'Hero credit is required when a hero image is set.',
      });
    }
    if (value.published === true && value.aiAssisted === true && !value.bradsTake) {
      ctx.addIssue({
        code: 'custom',
        path: ['bradsTake'],
        message: 'AI-assisted pieces cannot publish without Brad’s Take.',
      });
    }
  });

export const articleUnpublishRequestSchema = z
  .object({
    rationale: z
      .string()
      .trim()
      .min(20, 'Unpublishing requires a rationale of at least 20 characters.')
      .max(4_000, 'Unpublishing rationale cannot exceed 4,000 characters.'),
  })
  .strict();

export function validationErrorMessage(error: z.ZodError): string {
  return error.issues[0]?.message ?? 'Invalid article payload.';
}

export type ArticlePayload = z.infer<typeof articlePayloadSchema>;
export type ArticlePatch = z.infer<typeof articlePatchSchema>;
export type ArticleUnpublishRequest = z.infer<typeof articleUnpublishRequestSchema>;
