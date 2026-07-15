import { z } from 'zod';

const email = z
  .string()
  .trim()
  .toLowerCase()
  .email('That email does not look right.')
  .max(254, 'Email is too long.');

const safeText = (max: number) => z.string().trim().max(max);

export const newsletterSignupSchema = z
  .object({
    email,
    source: safeText(80).optional().default('site'),
  })
  .strict();

export const newsletterUnsubscribeSchema = z
  .object({
    token: z
      .string()
      .trim()
      .regex(/^[a-f0-9]{48}$/i, 'Unsubscribe token is invalid.'),
  })
  .strict();

export const contactSubmissionSchema = z
  .object({
    mode: z
      .enum(['general', 'tip', 'press', 'sponsorship', 'privacy_access', 'privacy_deletion'])
      .default('general'),
    email,
    name: safeText(100).optional().default(''),
    message: z
      .string()
      .trim()
      .min(10, 'Message is too short.')
      .max(8000, 'Message is too long. Try splitting it.'),
    secure: z.boolean().optional().default(false),
  })
  .strict();

export const donationIntentSchema = z
  .object({
    email: email.optional(),
    name: safeText(100).optional().default(''),
    amountCents: z.coerce.number().int().min(100).max(100_000).optional(),
    message: safeText(1000).optional().default(''),
    source: safeText(80).optional().default('site'),
  })
  .strict();

export const accessWallUpdateSchema = z
  .object({
    password: z
      .string()
      .min(12, 'Use at least 12 characters.')
      .max(128, 'Password is too long.'),
  })
  .strict();

export type NewsletterSignupInput = z.infer<typeof newsletterSignupSchema>;
export type NewsletterUnsubscribeInput = z.infer<typeof newsletterUnsubscribeSchema>;
export type ContactSubmissionInput = z.infer<typeof contactSubmissionSchema>;
export type DonationIntentInput = z.infer<typeof donationIntentSchema>;
export type AccessWallUpdateInput = z.infer<typeof accessWallUpdateSchema>;

export function validationErrorMessage(error: z.ZodError): string {
  return error.issues[0]?.message ?? 'Invalid request.';
}
