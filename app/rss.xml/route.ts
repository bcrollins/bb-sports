/**
 * GET /rss.xml — public RSS 2.0 feed of published BB Sports articles.
 *
 * Standard for any opinion-driven publication. Readers can subscribe in
 * Feedly / NetNewsWire / etc.; cross-poster bots can pick up new pieces
 * the second they go live.
 *
 * Source: same getAllArticles() the public site reads (DB → filesystem
 * fallback). Sorted newest-first; latest 30 articles.
 */
import { getAllArticles, type Article } from '@/lib/articles';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const FEED_LIMIT = 30;

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function itemXml(article: Article, siteUrl: string): string {
  const link = `${siteUrl}/articles/${article.slug}`;
  const description = article.dek || article.excerpt;
  return [
    '    <item>',
    `      <title>${escapeXml(article.title)}</title>`,
    `      <link>${escapeXml(link)}</link>`,
    `      <guid isPermaLink="true">${escapeXml(link)}</guid>`,
    `      <pubDate>${new Date(article.date).toUTCString()}</pubDate>`,
    `      <description>${escapeXml(description)}</description>`,
    `      <dc:creator>${escapeXml(article.authorName ?? 'Brad Benson')}</dc:creator>`,
    `      <category>${escapeXml(article.sport.toUpperCase())}</category>`,
    '    </item>',
  ].join('\n');
}

export async function GET() {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://bbsports.fans';
  const articles = (await getAllArticles())
    .sort((a, b) => +new Date(b.date) - +new Date(a.date))
    .slice(0, FEED_LIMIT);

  const latest = articles[0]?.date ?? new Date().toISOString();
  const channel = [
    '  <channel>',
    `    <title>BB Sports</title>`,
    `    <link>${escapeXml(siteUrl)}</link>`,
    `    <atom:link href="${escapeXml(`${siteUrl}/rss.xml`)}" rel="self" type="application/rss+xml" />`,
    `    <description>Sports from the fan's view. No BS. Opinion-led NFL, MLB, NHL, NBA, college football, soccer, and MMA by Brad Benson.</description>`,
    `    <language>en-us</language>`,
    `    <copyright>Copyright ${new Date().getFullYear()} BB Sports</copyright>`,
    `    <lastBuildDate>${new Date(latest).toUTCString()}</lastBuildDate>`,
    `    <generator>bb-sports/next</generator>`,
    articles.map((a) => itemXml(a, siteUrl)).join('\n'),
    '  </channel>',
  ].join('\n');

  const body = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:dc="http://purl.org/dc/elements/1.1/">
${channel}
</rss>
`;

  return new Response(body, {
    status: 200,
    headers: {
      'content-type': 'application/rss+xml; charset=utf-8',
      'cache-control': 'public, no-cache, max-age=0, s-maxage=0, must-revalidate',
    },
  });
}
