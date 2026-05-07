/**
 * Single source of truth for markdown rendering. Used by both:
 *   - Public article pages (lib/articles.ts)
 *   - Admin live-preview endpoint (/api/admin/preview)
 *
 * Pipeline: remark + remark-gfm + remark-html. We deliberately keep `sanitize: false`
 * because the only authors are admins (Brad), so embedded HTML is allowed.
 */
import { remark } from 'remark';
import remarkGfm from 'remark-gfm';
import remarkHtml from 'remark-html';

export async function renderMarkdown(md: string): Promise<string> {
  if (!md.trim()) return '';
  const file = await remark().use(remarkGfm).use(remarkHtml, { sanitize: false }).process(md);
  return file.toString();
}
