/**
 * Soft-launch crawl / discoverability policy.
 *
 * During soft launch (BBSPORTS_PUBLIC_LAUNCH !== 'true') the access wall is on
 * and we must not invite crawlers into a gated site or leak a full editorial
 * catalog via robots, sitemap, or RSS.
 *
 * When public launch is enabled, robots allow public routes (still disallowing
 * /admin and /api/), sitemap lists canonical published URLs, and RSS mirrors
 * the published catalog.
 */
import type { MetadataRoute } from 'next';
import { evaluateSoftLaunchPosture } from '@/lib/soft-launch';

export type CrawlRobotsDecision = {
  searchIndexable: boolean;
  mode: 'soft_launch' | 'public';
  robots: MetadataRoute.Robots;
};

export function buildRobotsDecision(
  env: NodeJS.ProcessEnv | Record<string, string | undefined> = process.env,
  baseUrl = env.NEXT_PUBLIC_SITE_URL || 'https://bbsports.fans',
): CrawlRobotsDecision {
  const soft = evaluateSoftLaunchPosture(env);

  if (!soft.searchIndexable) {
    return {
      searchIndexable: false,
      mode: soft.mode,
      robots: {
        rules: [{ userAgent: '*', disallow: '/' }],
        host: baseUrl,
      },
    };
  }

  return {
    searchIndexable: true,
    mode: soft.mode,
    robots: {
      rules: [{ userAgent: '*', allow: '/', disallow: ['/admin', '/api/'] }],
      sitemap: `${baseUrl}/sitemap.xml`,
      host: baseUrl,
    },
  };
}

/** Soft launch: empty sitemap (no URL inventory for crawlers). */
export function shouldEmitSitemapEntries(
  env: NodeJS.ProcessEnv | Record<string, string | undefined> = process.env,
): boolean {
  return evaluateSoftLaunchPosture(env).searchIndexable;
}

/** Soft launch: RSS channel may exist but must not list article items. */
export function shouldEmitRssItems(
  env: NodeJS.ProcessEnv | Record<string, string | undefined> = process.env,
): boolean {
  return evaluateSoftLaunchPosture(env).searchIndexable;
}
