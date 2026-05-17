/**
 * BB Sports — public article API (used by all reader-facing pages).
 *
 * Source of truth: Postgres `articles` table. The first reader request after a
 * cold start triggers DB bootstrap (which seeds /content/articles markdown into
 * the table on first boot, then never touches the filesystem again).
 *
 * If DATABASE_URL is missing (e.g. local dev with no Postgres), this falls back
 * to reading the filesystem directly so the site still renders end-to-end.
 */
import fs from 'node:fs';
import path from 'node:path';
import matter from 'gray-matter';
import { renderMarkdown } from './markdown';
import {
  getPublishedArticles as dbGetPublished,
  getPublishedArticleBySlug as dbGetBySlug,
  getRelatedArticlesBySport as dbGetRelatedBySport,
} from './queries';
import { dbAvailable } from './db/client';
import type { Article as DbArticle } from './db/schema';

export type Article = {
  id?: string;
  slug: string;
  title: string;
  dek?: string;
  date: string; // ISO 8601
  sport: SportSlug;
  tags: string[];
  hero?: string;
  heroAlt?: string;
  heroCredit?: string;
  aiAssisted: boolean;
  bradsTake?: string;
  readingTimeMinutes: number;
  excerpt: string;
  body: string;
  bodyHtml: string;
  authorName?: string;
};

export type SportSlug =
  | 'nfl'
  | 'mlb'
  | 'nhl'
  | 'nba'
  | 'college-football'
  | 'soccer'
  | 'mma'
  | 'general';

const SPORT_LABELS: Record<SportSlug, string> = {
  nfl: 'NFL',
  mlb: 'MLB',
  nhl: 'NHL',
  nba: 'NBA',
  'college-football': 'College Football',
  soccer: 'Soccer',
  mma: 'MMA',
  general: 'General',
};

export function sportLabel(s: SportSlug): string {
  return SPORT_LABELS[s] ?? 'General';
}

/** Map an admin-tag (NFL, CFB, Op-Ed…) to a public sport slug. */
function toSportSlug(input: string | null | undefined): SportSlug {
  const s = String(input ?? '').toLowerCase().trim();
  if (s === 'nfl') return 'nfl';
  if (s === 'mlb' || s === 'baseball') return 'mlb';
  if (s === 'nhl') return 'nhl';
  if (s === 'nba') return 'nba';
  if (s === 'cfb' || s === 'college football' || s === 'college-football') return 'college-football';
  if (s === 'soccer' || s === 'pl' || s === 'football') return 'soccer';
  if (s === 'mma' || s === 'ufc') return 'mma';
  return 'general';
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

async function fromDb(row: DbArticle): Promise<Article> {
  const html = await renderMarkdown(row.body);
  const date = (row.publishedAt ?? row.updatedAt).toISOString();
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    dek: row.dek || undefined,
    date,
    sport: toSportSlug(row.sport),
    tags: [],
    hero: row.hero || undefined,
    heroAlt: row.heroAlt || undefined,
    heroCredit: row.heroCredit || undefined,
    aiAssisted: row.aiAssisted,
    bradsTake: row.bradsTake || undefined,
    readingTimeMinutes: estimateReadingTime(row.body),
    excerpt: makeExcerpt(row.body),
    body: row.body,
    bodyHtml: html,
    authorName: row.authorName,
  };
}

async function fromFilesystem(): Promise<Article[]> {
  if (!fs.existsSync(ARTICLES_DIR)) return [];
  const files = fs.readdirSync(ARTICLES_DIR).filter((f) => f.endsWith('.md'));
  const items: Article[] = [];
  for (const file of files) {
    const full = path.join(ARTICLES_DIR, file);
    const raw = fs.readFileSync(full, 'utf-8');
    const { data, content } = matter(raw);
    const html = await renderMarkdown(content);
    items.push({
      slug: data.slug ?? file.replace(/\.md$/, ''),
      title: data.title ?? '(untitled)',
      dek: data.dek,
      date: data.date ?? new Date().toISOString(),
      sport: toSportSlug(data.sport),
      tags: data.tags ?? [],
      hero: data.hero,
      heroAlt: data.heroAlt,
      heroCredit: data.heroCredit,
      aiAssisted: !!data.aiAssisted,
      bradsTake: data.bradsTake,
      readingTimeMinutes: estimateReadingTime(content),
      excerpt: data.excerpt ?? makeExcerpt(content),
      body: content,
      bodyHtml: html,
      authorName: data.author ?? 'Brad Benson',
    });
  }
  items.sort((a, b) => +new Date(b.date) - +new Date(a.date));
  return items;
}

export async function getAllArticles(): Promise<Article[]> {
  if (dbAvailable) {
    try {
      const rows = await dbGetPublished();
      const out = await Promise.all(rows.map(fromDb));
      // If DB is empty (e.g., bootstrap hadn't seeded yet), fall back to filesystem so
      // public pages aren't blank.
      if (out.length > 0) return out;
    } catch {
      // fall through to filesystem
    }
  }
  return fromFilesystem();
}

export async function getArticleBySlug(slug: string): Promise<Article | null> {
  if (dbAvailable) {
    try {
      const row = await dbGetBySlug(slug);
      if (row) return await fromDb(row);
    } catch {
      // fall through
    }
  }
  const fs = await fromFilesystem();
  return fs.find((a) => a.slug === slug) ?? null;
}

/**
 * Related articles: prefer same-sport pieces; fall back to most-recent
 * across all sports if there aren't enough same-sport entries.
 *
 * When DATABASE_URL is set, the same-sport pull is one indexed query
 * instead of a full table scan + JS filter (see lib/queries.ts).
 */
export async function getRelatedArticles(article: Article, limit = 3): Promise<Article[]> {
  if (dbAvailable && article.id) {
    try {
      const sameSport = await dbGetRelatedBySport(article.id, mapSportSlugToTag(article.sport), limit);
      if (sameSport.length >= limit) {
        return Promise.all(sameSport.map(fromDb));
      }
      // Top up with most-recent across all sports if same-sport is thin.
      const recent = await dbGetPublished();
      const need = limit - sameSport.length;
      const sameIds = new Set(sameSport.map((a) => a.id));
      const filler = recent
        .filter((a) => a.id !== article.id && !sameIds.has(a.id))
        .slice(0, need);
      const out = [...sameSport, ...filler];
      return Promise.all(out.map(fromDb));
    } catch {
      // fall through to filesystem
    }
  }
  const all = await getAllArticles();
  const same = all.filter((a) => a.slug !== article.slug && a.sport === article.sport);
  if (same.length >= limit) return same.slice(0, limit);
  const others = all.filter((a) => a.slug !== article.slug && a.sport !== article.sport);
  return [...same, ...others].slice(0, limit);
}

/** Reverse of toSportSlug — maps a public slug back to the admin tag stored
 *  in the DB. The DB sport column uses the admin-tag form (NFL, CFB, …). */
function mapSportSlugToTag(slug: SportSlug): string {
  switch (slug) {
    case 'nfl': return 'NFL';
    case 'mlb': return 'MLB';
    case 'nhl': return 'NHL';
    case 'nba': return 'NBA';
    case 'college-football': return 'CFB';
    case 'soccer': return 'Soccer';
    case 'mma': return 'MMA';
    default: return 'Op-Ed';
  }
}

export function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}
