import type { MetadataRoute } from 'next';
import { getAllArticles } from '@/lib/articles';
import { LEAGUE_ORDER, buildLeagueRanking } from '@/lib/rankings';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://bbsports.fans';
  const articles = await getAllArticles();

  // /coming-soon is the soft-launch gate — not a public destination, omitted
  // from the sitemap. /admin is already disallowed in robots.txt.
  const staticRoutes: MetadataRoute.Sitemap = [
    '',
    '/articles',
    '/rankings',
    '/search',
    '/podcast',
    '/videos',
    '/about',
    '/support',
    '/support/terms',
    '/contact',
    '/editorial-standards',
    '/corrections',
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

  // 100 franchise pages — every team in every league.
  const teamRoutes: MetadataRoute.Sitemap = LEAGUE_ORDER.flatMap((league) =>
    buildLeagueRanking(league, []).ranked.map((team) => ({
      url: `${baseUrl}/rankings/${league}/${team.id}`,
      lastModified: new Date(),
      changeFrequency: 'weekly' as const,
      priority: 0.6,
    })),
  );

  return [...staticRoutes, ...articleRoutes, ...teamRoutes];
}
