import type { MetadataRoute } from 'next';
import { buildRobotsDecision } from '@/lib/crawl-policy';

export default function robots(): MetadataRoute.Robots {
  return buildRobotsDecision().robots;
}
