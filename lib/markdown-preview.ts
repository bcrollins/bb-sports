import { z } from 'zod';
import { readBoundedJson } from './bounded-json';

// The editor accepts 100k UTF-16 code units. One MiB safely accommodates the
// worst-case JSON escaping of that string while still enforcing a hard stream
// ceiling even when Content-Length is absent or dishonest.
export const MARKDOWN_PREVIEW_MAX_JSON_BODY_BYTES = 1024 * 1024;

export const markdownPreviewRequestSchema = z
  .object({
    body: z.string().max(100_000, 'Markdown body cannot exceed 100,000 characters.'),
  })
  .strict();

export const MARKDOWN_PREVIEW_PRIVATE_HEADERS = {
  'Cache-Control': 'private, no-store, max-age=0, must-revalidate',
  Expires: '0',
  Pragma: 'no-cache',
} as const;

export function markdownPreviewJson(body: unknown, status = 200): Response {
  return Response.json(body, {
    status,
    headers: MARKDOWN_PREVIEW_PRIVATE_HEADERS,
  });
}

export async function parseMarkdownPreviewRequest(request: Request): Promise<{ body: string }> {
  const payload = await readBoundedJson(request, MARKDOWN_PREVIEW_MAX_JSON_BODY_BYTES);
  return markdownPreviewRequestSchema.parse(payload);
}
