import type { MetadataRoute } from 'next';
import { getAllArticles } from '@/lib/articles';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://bbsports.media';
  const articles = await getAllArticles();

  const staticRoutes: MetadataRoute.Sitemap = [
    '',
    '/articles',
    '/podcast',
    '/videos',
    '/about',
    '/contact',
    '/editorial-standards',
    '/corrections',
    '/coming-soon'
  ].map((path) => ({
    url: `${baseUrl}${path}`,
    lastModified: new Date(),
    changeFrequency: 'weekly',
    priority: path === '' ? 1.0 : 0.7
  }));

  const articleRoutes: MetadataRoute.Sitemap = articles.map((a) => ({
    url: `${baseUrl}/articles/${a.slug}`,
    lastModified: new Date(a.date),
    changeFrequency: 'weekly',
    priority: 0.8
  }));

  return [...staticRoutes, ...articleRoutes];
}
