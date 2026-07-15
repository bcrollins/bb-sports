/**
 * Admin markdown preview endpoint.
 *
 * POST /api/admin/preview
 * Body: { body: string }
 * Returns: { html: string }
 *
 * Uses the same remark pipeline the public article pages use, so what Brad sees
 * in the editor preview matches what readers see when published.
 */
import { NextRequest } from 'next/server';
import { ZodError } from 'zod';
import { getCurrentUser } from '@/lib/auth';
import { BoundedJsonError } from '@/lib/bounded-json';
import { renderMarkdown } from '@/lib/markdown';
import {
  markdownPreviewJson,
  parseMarkdownPreviewRequest,
} from '@/lib/markdown-preview';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    // Authentication is deliberately completed before the request stream is
    // consumed so an anonymous caller cannot make the server buffer Markdown.
    const user = await getCurrentUser();
    if (!user) {
      return markdownPreviewJson({ error: 'Unauthorized', code: 'UNAUTHORIZED' }, 401);
    }

    const input = await parseMarkdownPreviewRequest(req);
    const html = await renderMarkdown(input.body);
    return markdownPreviewJson({ html });
  } catch (error) {
    if (error instanceof BoundedJsonError) {
      return markdownPreviewJson({ error: error.message, code: error.code }, error.status);
    }
    if (error instanceof ZodError) {
      return markdownPreviewJson(
        {
          error: 'The preview request did not pass validation.',
          code: 'VALIDATION',
          issues: error.issues.map((issue) => ({
            path: issue.path.join('.'),
            message: issue.message,
          })),
        },
        400,
      );
    }
    return markdownPreviewJson(
      { error: 'The preview is temporarily unavailable.', code: 'INTERNAL' },
      500,
    );
  }
}
