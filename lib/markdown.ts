/**
 * Single source of truth for markdown rendering. Used by both:
 *   - Public article pages (lib/articles.ts)
 *   - Admin live-preview endpoint (/api/admin/preview)
 *
 * Raw HTML is never passed through. The explicit schema below is intentionally
 * narrower than a browser's HTML surface: it admits the semantic elements that
 * remark-gfm generates, exact task-list/language classes, and safe URL
 * protocols only. Event handlers, style, form controls (apart from disabled
 * GFM checkboxes), executable elements, and DOM-clobbering attributes cannot
 * reach a dangerouslySetInnerHTML sink.
 */
import { remark } from 'remark';
import remarkGfm from 'remark-gfm';
import remarkHtml from 'remark-html';
import type { Schema } from 'hast-util-sanitize';

/**
 * This is a complete schema rather than a spread of hast-util-sanitize's
 * defaults. Keeping every top-level field explicit prevents an upstream
 * default expansion from silently widening the article HTML contract.
 */
export const ARTICLE_MARKDOWN_SANITIZE_SCHEMA: Schema = {
  allowComments: false,
  allowDoctypes: false,
  ancestors: {
    tbody: ['table'],
    td: ['table'],
    th: ['table'],
    thead: ['table'],
    tr: ['table'],
  },
  attributes: {
    '*': [],
    a: ['href', 'title'],
    blockquote: ['cite'],
    code: [['className', /^language-[a-z0-9_-]+$/i]],
    img: ['alt', 'src', 'title'],
    input: [
      ['checked', true],
      ['disabled', true],
      ['type', 'checkbox'],
    ],
    li: [['className', 'task-list-item']],
    ol: ['start', ['className', 'contains-task-list']],
    td: ['align'],
    th: ['align'],
    ul: [['className', 'contains-task-list']],
  },
  clobber: ['id', 'name'],
  clobberPrefix: 'bb-article-',
  protocols: {
    cite: ['http', 'https'],
    href: ['http', 'https', 'mailto'],
    src: ['http', 'https'],
  },
  required: {
    input: { disabled: true, type: 'checkbox' },
  },
  strip: [
    'base',
    'button',
    'embed',
    'form',
    'iframe',
    'link',
    'math',
    'meta',
    'object',
    'script',
    'select',
    'style',
    'svg',
    'template',
    'textarea',
  ],
  tagNames: [
    'a',
    'blockquote',
    'br',
    'code',
    'del',
    'em',
    'h1',
    'h2',
    'h3',
    'h4',
    'h5',
    'h6',
    'hr',
    'img',
    'input',
    'li',
    'ol',
    'p',
    'pre',
    'strong',
    'table',
    'tbody',
    'td',
    'th',
    'thead',
    'tr',
    'ul',
  ],
};

export async function renderMarkdown(md: string): Promise<string> {
  if (!md.trim()) return '';
  const file = await remark()
    .use(remarkGfm)
    .use(remarkHtml, { sanitize: ARTICLE_MARKDOWN_SANITIZE_SCHEMA })
    .process(md);
  return file.toString();
}
