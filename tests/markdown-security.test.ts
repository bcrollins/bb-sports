import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { ZodError } from 'zod';
import type { Article } from '../lib/articles';
import { BoundedJsonError } from '../lib/bounded-json';
import { serializeJsonLd } from '../lib/json-ld';
import { ARTICLE_MARKDOWN_SANITIZE_SCHEMA, renderMarkdown } from '../lib/markdown';
import {
  MARKDOWN_PREVIEW_MAX_JSON_BODY_BYTES,
  markdownPreviewJson,
  parseMarkdownPreviewRequest,
} from '../lib/markdown-preview';
import { readTrashedTeams } from '../lib/rankings';

const ROOT = process.cwd();

function source(relativePath: string): string {
  return fs.readFileSync(path.join(ROOT, relativePath), 'utf8');
}

function jsonRequest(value: unknown, headers?: HeadersInit): Request {
  return new Request('https://example.com/api/admin/preview', {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body: JSON.stringify(value),
  });
}

test('article Markdown renderer removes executable HTML and unsafe URL protocols', async () => {
  const markdown = [
    '<img src=x onerror="globalThis.pwned=1">',
    '<script>globalThis.pwned=2</script>',
    '<form action="https://attacker.invalid"><input autofocus onfocus="globalThis.pwned=3"></form>',
    '<style>body{display:none}</style>',
    '<svg onload="globalThis.pwned=4"><script>globalThis.pwned=5</script></svg>',
    '<iframe srcdoc="<script>globalThis.pwned=6</script>"></iframe>',
    '[bad-one](javascript:globalThis.pwned=7)',
    '[bad-two](JaVaScRiPt:globalThis.pwned=8)',
    '[bad-three](vbscript:globalThis.pwned=9)',
    '[bad-four](data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==)',
    '![bad-image](data:image/svg+xml;base64,PHN2ZyBvbmxvYWQ9YWxlcnQoMSk+)',
    '![safe-image](https://cdn.example.com/photo.jpg "Photo")',
  ].join('\n\n');

  const html = await renderMarkdown(markdown);

  for (const forbidden of [
    /<script\b/i,
    /<style\b/i,
    /<form\b/i,
    /<iframe\b/i,
    /<svg\b/i,
    /\bon\w+\s*=/i,
    /\bjavascript\s*:/i,
    /\bvbscript\s*:/i,
    /\bdata\s*:/i,
  ]) {
    assert.doesNotMatch(html, forbidden);
  }

  assert.match(html, /<a>bad-one<\/a>/);
  assert.match(html, /<a>bad-two<\/a>/);
  assert.match(html, /<img alt="bad-image">/);
  assert.match(
    html,
    /<img src="https:\/\/cdn\.example\.com\/photo\.jpg" alt="safe-image" title="Photo">/,
  );
});

test('strict schema preserves the safe GFM features used by article preview and public pages', async () => {
  const markdown = [
    '# Headline',
    '',
    '**bold** and ~~struck~~ and https://example.com/news.',
    '',
    '> sourced quote',
    '',
    '- [x] verified',
    '- [ ] follow-up',
    '',
    '| Team | Score |',
    '| :--- | ---: |',
    '| Bears | 24 |',
    '',
    '```ts',
    'const score = 24;',
    '```',
  ].join('\n');

  const html = await renderMarkdown(markdown);

  assert.match(html, /<h1>Headline<\/h1>/);
  assert.match(html, /<strong>bold<\/strong>/);
  assert.match(html, /<del>struck<\/del>/);
  assert.match(html, /<a href="https:\/\/example\.com\/news">https:\/\/example\.com\/news<\/a>/);
  assert.match(html, /<blockquote>/);
  assert.match(html, /<ul class="contains-task-list">/);
  assert.match(
    html,
    /<li class="task-list-item"><input type="checkbox" checked disabled> verified/,
  );
  assert.match(html, /<table>/);
  assert.match(html, /<th align="left">Team<\/th>/);
  assert.match(html, /<th align="right">Score<\/th>/);
  assert.match(html, /<code class="language-ts">/);
  assert.doesNotMatch(html, /style=/i);
});

test('schema is an explicit deny-by-default contract rather than sanitization disabled', () => {
  assert.equal(ARTICLE_MARKDOWN_SANITIZE_SCHEMA.allowComments, false);
  assert.equal(ARTICLE_MARKDOWN_SANITIZE_SCHEMA.allowDoctypes, false);
  assert.deepEqual(ARTICLE_MARKDOWN_SANITIZE_SCHEMA.attributes?.['*'], []);
  assert.deepEqual(ARTICLE_MARKDOWN_SANITIZE_SCHEMA.protocols?.href, [
    'http',
    'https',
    'mailto',
  ]);
  assert.ok(ARTICLE_MARKDOWN_SANITIZE_SCHEMA.strip?.includes('script'));
  assert.ok(ARTICLE_MARKDOWN_SANITIZE_SCHEMA.strip?.includes('style'));
  assert.ok(ARTICLE_MARKDOWN_SANITIZE_SCHEMA.strip?.includes('form'));
  assert.ok(!ARTICLE_MARKDOWN_SANITIZE_SCHEMA.tagNames?.includes('form'));
  assert.doesNotMatch(source('lib/markdown.ts'), /sanitize:\s*false/);
});

test('ranking HTML-comment directives remain in raw Markdown but never reach rendered HTML', async () => {
  const markdown = [
    '<!-- bb:trash league=nba team=lakers drop=4 reason="No defensive answers." -->',
    '',
    'The ranking moves, but the control directive stays invisible.',
  ].join('\n');

  const html = await renderMarkdown(markdown);
  const article = {
    body: markdown,
    slug: 'ranking-move',
    title: 'Ranking move',
    date: '2026-07-15T00:00:00.000Z',
  } as Article;

  assert.deepEqual(readTrashedTeams(article), [
    {
      league: 'nba',
      team: 'lakers',
      drop: 4,
      reason: 'No defensive answers.',
    },
  ]);
  assert.match(article.body, /<!--\s*bb:trash/);
  assert.doesNotMatch(html, /bb:trash|<!--/);
  assert.match(html, /The ranking moves/);
});

test('preview parser enforces exact JSON shape, Markdown length, content type, and byte ceiling', async () => {
  assert.deepEqual(await parseMarkdownPreviewRequest(jsonRequest({ body: '**safe**' })), {
    body: '**safe**',
  });

  await assert.rejects(
    parseMarkdownPreviewRequest(jsonRequest({ body: 'safe', publish: true })),
    ZodError,
  );
  await assert.rejects(parseMarkdownPreviewRequest(jsonRequest({})), ZodError);
  await assert.rejects(
    parseMarkdownPreviewRequest(jsonRequest({ body: 'x'.repeat(100_001) })),
    ZodError,
  );

  await assert.rejects(
    parseMarkdownPreviewRequest(
      new Request('https://example.com/api/admin/preview', {
        method: 'POST',
        headers: { 'content-type': 'text/plain' },
        body: '{"body":"safe"}',
      }),
    ),
    (error: unknown) =>
      error instanceof BoundedJsonError && error.code === 'INVALID_CONTENT_TYPE',
  );

  await assert.rejects(
    parseMarkdownPreviewRequest(
      jsonRequest(
        { body: 'safe' },
        { 'content-length': String(MARKDOWN_PREVIEW_MAX_JSON_BODY_BYTES + 1) },
      ),
    ),
    (error: unknown) =>
      error instanceof BoundedJsonError && error.code === 'JSON_BODY_TOO_LARGE',
  );
});

test('every preview response is private and non-cacheable', async () => {
  for (const response of [
    markdownPreviewJson({ html: '<p>safe</p>' }),
    markdownPreviewJson({ error: 'Unauthorized' }, 401),
    markdownPreviewJson({ error: 'Invalid' }, 400),
  ]) {
    assert.match(response.headers.get('cache-control') ?? '', /\bprivate\b/);
    assert.match(response.headers.get('cache-control') ?? '', /\bno-store\b/);
    assert.equal(response.headers.get('pragma'), 'no-cache');
    assert.equal(response.headers.get('expires'), '0');
  }

  const route = source('app/api/admin/preview/route.ts');
  assert.doesNotMatch(route, /NextResponse\.json|Response\.json/);
  assert.match(route, /markdownPreviewJson/);
  assert.match(route, /parseMarkdownPreviewRequest/);
});

test('preview authenticates before consuming a bounded request body', () => {
  const route = source('app/api/admin/preview/route.ts');
  const handler = route.slice(route.indexOf('export async function POST'));
  const authentication = handler.indexOf('getCurrentUser()');
  const unauthorized = handler.indexOf('Unauthorized');
  const bodyRead = handler.indexOf('parseMarkdownPreviewRequest(req)');

  assert.ok(authentication >= 0);
  assert.ok(unauthorized > authentication);
  assert.ok(bodyRead > unauthorized);
  assert.doesNotMatch(handler, /req\.json\s*\(/);
});

test('JSON-LD serialization cannot close its script element with stored editorial text', () => {
  const payload = {
    headline: '</script><img src=x onerror="globalThis.pwned=1">',
    description: 'line\u2028separator\u2029and & markup >',
  };
  const serialized = serializeJsonLd(payload);

  assert.doesNotMatch(serialized, /[<>&\u2028\u2029]/u);
  assert.match(serialized, /\\u003c\/script\\u003e/);
  assert.deepEqual(JSON.parse(serialized), payload);

  const articlePage = source('app/(site)/articles/[slug]/page.tsx');
  assert.match(articlePage, /serializeJsonLd\(articleJsonLd\)/);
  assert.doesNotMatch(articlePage, /__html:\s*JSON\.stringify\(articleJsonLd\)/);

  const siteFiles = [
    'app/(site)/layout.tsx',
    'app/(site)/rankings/page.tsx',
    'app/(site)/rankings/[league]/page.tsx',
    'app/(site)/rankings/[league]/[team]/page.tsx',
    'app/(site)/articles/[slug]/page.tsx',
  ];
  for (const file of siteFiles) {
    const contents = source(file);
    assert.doesNotMatch(
      contents,
      /dangerouslySetInnerHTML=\{\{\s*__html:\s*JSON\.stringify/,
      `${file} must use the inline-script-safe JSON serializer`,
    );
  }
});

test('database-backed about copy uses the same strict Markdown renderer', () => {
  const aboutPage = source('app/(site)/about/page.tsx');
  assert.match(aboutPage, /renderMarkdown\(bioParagraphs\.join\(['"]\\n\\n['"]\)\)/);
  assert.match(aboutPage, /__html:\s*bioHtml/);
  assert.doesNotMatch(aboutPage, /__html:\s*p\b/);
});
