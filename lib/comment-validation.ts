import { z } from 'zod';

const email = z
  .string()
  .trim()
  .toLowerCase()
  .email('That email does not look right.')
  .max(254, 'Email is too long.');

export const commentCreateSchema = z
  .object({
    parentId: z.string().uuid().nullable().optional(),
    authorName: z
      .string()
      .trim()
      .min(2, 'Use at least 2 characters for your name.')
      .max(80, 'Name is too long.'),
    authorEmail: email.optional(),
    body: z
      .string()
      .trim()
      .min(3, 'Comment is too short.')
      .max(1200, 'Comment is too long. Keep it tight.'),
  })
  .strict();

export const commentStatusSchema = z.enum(['approved', 'pending', 'flagged', 'spam', 'hidden']);

export const commentModerationSchema = z
  .object({
    status: commentStatusSchema,
  })
  .strict();

export type CommentCreateInput = z.infer<typeof commentCreateSchema>;
export type CommentStatus = z.infer<typeof commentStatusSchema>;
export type CommentModerationInput = z.infer<typeof commentModerationSchema>;

export function validationErrorMessage(error: z.ZodError): string {
  return error.issues[0]?.message ?? 'Invalid comment request.';
}
