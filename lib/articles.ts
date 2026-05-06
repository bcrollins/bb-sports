import fs from 'node:fs';
import path from 'node:path';
import matter from 'gray-matter';
import { remark } from 'remark';
import remarkGfm from 'remark-gfm';
import remarkHtml from 'remark-html';

export type Article = {
  slug: string;
  title: string;
  dek?: string;
  date: string;          // ISO 8601
  sport: SportSlug;
  tags: string[];
  hero?: string;
  heroAlt?: string;
  heroCredit?: string;
  aiAssisted: boolean;
  bradsTake?: string;
  readingTimeMinutes: number;
  excerpt: string;
  body: string;          // raw markdown
  bodyHtml: string;      // rendered html
};

export type SportSlug =
  | 'nfl'
  | 'nhl'
  | 'college-football'
  | 'soccer'
  | 'nba'
  | 'mma'
  | 'general';

const SPORT_LABELS: Record<SportSlug, string> = {
  nfl: 'NFL',
  nhl: 'NHL',
  'college-football': 'College Football',
  soccer: 'Soccer',
  nba: 'NBA',
  mma: 'MMA',
  general: 'General'
};

export function sportLabel(s: SportSlug): string {
  return SPORT_LABELS[s] ?? 'General';
}

const ARTICLES_DIR = path.join(process.cwd(), 'content', 'articles');

function estimateReadingTime(markdown: string): number {
  const words = markdown.trim().split(/\s+/).length;
  return Math.max(1, Math.round(words / 220));
}

function makeExcerpt(markdown: string): string {
  const stripped = markdown
    .replace(/^---[\s\S]*?---/, '')
    .replace(/[#>*_`>]/g, '')
    .replace(/\[.*?\]\(.*?\)/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (stripped.length <= 240) return stripped;
  return stripped.slice(0, 235).replace(/\s+\S*$/, '') + '…';
}

let cache: Article[] | null = null;

export async function getAllArticles(): Promise<Article[]> {
  if (cache) return cache;
  if (!fs.existsSync(ARTICLES_DIR)) {
    cache = [];
    return cache;
  }
  const files = fs.readdirSync(ARTICLES_DIR).filter((f) => f.endsWith('.md'));
  const items: Article[] = [];
  for (const file of files) {
    const full = path.join(ARTICLES_DIR, file);
    const raw = fs.readFileSync(full, 'utf-8');
    const { data, content } = matter(raw);

    const html = (
      await remark().use(remarkGfm).use(remarkHtml, { sanitize: false }).process(content)
    ).toString();

    items.push({
      slug: data.slug ?? file.replace(/\.md$/, ''),
      title: data.title ?? '(untitled)',
      dek: data.dek,
      date: data.date ?? new Date().toISOString(),
      sport: (data.sport as SportSlug) ?? 'general',
      tags: data.tags ?? [],
      hero: data.hero,
      heroAlt: data.heroAlt,
      heroCredit: data.heroCredit,
      aiAssisted: !!data.aiAssisted,
      bradsTake: data.bradsTake,
      readingTimeMinutes: estimateReadingTime(content),
      excerpt: data.excerpt ?? makeExcerpt(content),
      body: content,
      bodyHtml: html
    });
  }

  // Most recent first
  items.sort((a, b) => +new Date(b.date) - +new Date(a.date));
  cache = items;
  return cache;
}

export async function getArticleBySlug(slug: string): Promise<Article | null> {
  const all = await getAllArticles();
  return all.find((a) => a.slug === slug) ?? null;
}

export async function getRelatedArticles(article: Article, limit = 3): Promise<Article[]> {
  const all = await getAllArticles();
  return all
    .filter((a) => a.slug !== article.slug)
    .slice(0, limit);
}

export function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
}
