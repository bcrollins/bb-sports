import { z } from 'zod';
import { getConfig } from './queries';
import { safeInternalPath } from './redirects';

export const EDITABLE_SITE_CONFIG_KEYS = [
  'breaking_ticker',
  'hero',
  'about_bio',
  'footer_tagline',
] as const;

const nonEmptyText = (max: number) => z.string().trim().min(1).max(max);
const internalHref = nonEmptyText(512).refine(
  (value) => safeInternalPath(value, '') === value,
  'CTA links must be internal paths.',
);

export const breakingTickerSchema = z
  .array(
    z
      .object({
        sport: nonEmptyText(24),
        text: nonEmptyText(240),
      })
      .strict(),
  )
  .max(12);

const ctaSchema = z
  .object({
    label: nonEmptyText(80).optional(),
    href: internalHref.optional(),
  })
  .strict();

export const heroConfigSchema = z
  .object({
    version: z.number().int().min(1).max(10).optional(),
    eyebrow: nonEmptyText(80).optional(),
    headline: nonEmptyText(240).optional(),
    sub: nonEmptyText(800).optional(),
    cta_primary: ctaSchema.optional(),
    cta_secondary: ctaSchema.optional(),
  })
  .strict();

export const aboutBioSchema = z.array(nonEmptyText(2_000)).min(1).max(12);
export const footerTaglineSchema = nonEmptyText(240);

export const editableSiteConfigUpdateSchema = z.discriminatedUnion('key', [
  z.object({ key: z.literal('breaking_ticker'), value: breakingTickerSchema }).strict(),
  z.object({ key: z.literal('hero'), value: heroConfigSchema }).strict(),
  z.object({ key: z.literal('about_bio'), value: aboutBioSchema }).strict(),
  z.object({ key: z.literal('footer_tagline'), value: footerTaglineSchema }).strict(),
]);

export type BreakingTickerItem = z.infer<typeof breakingTickerSchema>[number];
export type HeroConfig = z.infer<typeof heroConfigSchema>;
export interface EditableSiteConfig {
  breaking_ticker?: BreakingTickerItem[];
  hero?: HeroConfig;
  about_bio?: string[];
  footer_tagline?: string;
}

const schemas = {
  breaking_ticker: breakingTickerSchema,
  hero: heroConfigSchema,
  about_bio: aboutBioSchema,
  footer_tagline: footerTaglineSchema,
} as const;

/** Load only explicitly public/editable site settings and drop malformed rows. */
export async function getEditableSiteConfig(): Promise<EditableSiteConfig> {
  const output: EditableSiteConfig = {};
  for (const key of EDITABLE_SITE_CONFIG_KEYS) {
    const raw = await getConfig<unknown>(key, undefined);
    const parsed = schemas[key].safeParse(raw);
    if (parsed.success) {
      (output as Record<string, unknown>)[key] = parsed.data;
    }
  }
  return output;
}
