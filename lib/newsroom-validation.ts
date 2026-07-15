import { z } from 'zod';
import { NEWS_EVENT_STATES, NEWS_URGENCIES } from './newsroom-state';

export { NEWS_EVENT_STATES, NEWS_URGENCIES } from './newsroom-state';

export const MANUAL_NEWSROOM_SOURCE_KEY = 'manual-newsroom' as const;
export const NEWS_SOURCE_TIERS = ['primary', 'official', 'tier_1', 'tier_2', 'unverified'] as const;
export const NEWS_EVIDENCE_STANCES = ['supporting', 'contradicting', 'context'] as const;
export const NEWS_EVIDENCE_CLASSES = ['primary', 'official', 'reporting', 'context'] as const;

const httpsUrlSchema = z
  .string()
  .trim()
  .url()
  .max(2_048)
  .refine((value) => new URL(value).protocol === 'https:', 'Only HTTPS source URLs are accepted');

export const manualNewsSignalInputSchema = z.object({
  headline: z.string().trim().min(5).max(320),
  summary: z.string().trim().max(6_000).default(''),
  canonicalUrl: httpsUrlSchema.optional(),
  sport: z.string().trim().min(1).max(40).default('General'),
  urgency: z.enum(NEWS_URGENCIES).default('routine'),
  sourcePublishedAt: z.coerce.date().optional(),
});

export type ManualNewsSignalInput = z.infer<typeof manualNewsSignalInputSchema>;

export const newsEvidenceInputSchema = z
  .object({
    eventId: z.string().uuid(),
    sourceId: z.string().uuid().optional(),
    signalId: z.string().uuid().optional(),
    supersedesEvidenceId: z.string().uuid().optional(),
    stance: z.enum(NEWS_EVIDENCE_STANCES),
    evidenceClass: z.enum(NEWS_EVIDENCE_CLASSES),
    ownerKey: z
      .string()
      .trim()
      .min(2)
      .max(160)
      .transform((value) => value.toLocaleLowerCase('en-US')),
    sourceTier: z.enum(NEWS_SOURCE_TIERS),
    credible: z.boolean(),
    label: z.string().trim().min(3).max(500),
    url: httpsUrlSchema.optional(),
    excerpt: z.string().trim().max(8_000).default(''),
    notes: z.string().trim().max(4_000).default(''),
    capturedAt: z.coerce.date().optional(),
  })
  .superRefine((value, context) => {
    const hasSubstantiveOfflineRecord =
      value.excerpt.trim().length >= 20 || value.notes.trim().length >= 20;
    if (!value.url && !value.sourceId && !value.signalId && !hasSubstantiveOfflineRecord) {
      context.addIssue({
        code: 'custom',
        path: ['excerpt'],
        message: 'Evidence requires a URL, registered source/signal, or at least 20 characters of offline notes',
      });
    }
    if (value.evidenceClass === 'primary' && value.sourceTier !== 'primary') {
      context.addIssue({
        code: 'custom',
        path: ['sourceTier'],
        message: 'Primary evidence must be attributed to a primary source tier',
      });
    }
    if (value.evidenceClass === 'official' && value.sourceTier !== 'official') {
      context.addIssue({
        code: 'custom',
        path: ['sourceTier'],
        message: 'Official evidence must be attributed to an official source tier',
      });
    }
    if (value.credible && value.sourceTier === 'unverified') {
      context.addIssue({
        code: 'custom',
        path: ['credible'],
        message: 'An unverified source cannot be marked credible',
      });
    }
  });

export type NewsEvidenceInput = z.infer<typeof newsEvidenceInputSchema>;

export const verifyNewsEventInputSchema = z.object({
  eventId: z.string().uuid(),
  expectedVersion: z.number().int().positive(),
  rationale: z.string().trim().min(20).max(4_000),
});

export type VerifyNewsEventInput = z.infer<typeof verifyNewsEventInputSchema>;

export const updateNewsEventInputSchema = z
  .object({
    eventId: z.string().uuid(),
    expectedVersion: z.number().int().positive(),
    headline: z.string().trim().min(5).max(320).optional(),
    summary: z.string().trim().max(6_000).optional(),
    sport: z.string().trim().min(1).max(40).optional(),
    urgency: z.enum(NEWS_URGENCIES).optional(),
    targetState: z.enum(NEWS_EVENT_STATES).optional(),
  })
  .superRefine((value, context) => {
    if (
      value.headline === undefined &&
      value.summary === undefined &&
      value.sport === undefined &&
      value.urgency === undefined &&
      value.targetState === undefined
    ) {
      context.addIssue({ code: 'custom', message: 'At least one event change is required' });
    }
    if (value.targetState === 'verified') {
      context.addIssue({
        code: 'custom',
        path: ['targetState'],
        message: 'Use the verification workflow to enter the verified state',
      });
    }
  });

export type UpdateNewsEventInput = z.infer<typeof updateNewsEventInputSchema>;

export const dismissNewsEventInputSchema = z.object({
  eventId: z.string().uuid(),
  expectedVersion: z.number().int().positive(),
  rationale: z.string().trim().min(10).max(4_000),
});

export type DismissNewsEventInput = z.infer<typeof dismissNewsEventInputSchema>;
