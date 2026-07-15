import { Suspense } from 'react';
import BreakingNewsBar from '@/components/BreakingNewsBar';
import SiteHeader from '@/components/SiteHeader';
import SiteFooter from '@/components/SiteFooter';
import AnalyticsTracker from '@/components/AnalyticsTracker';
import OfflineBanner from '@/components/OfflineBanner';
import { serializeJsonLd } from '@/lib/json-ld';

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://bbsports.fans';

const orgJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'NewsMediaOrganization',
  name: 'BB Sports',
  url: siteUrl,
  logo: `${siteUrl}/icon.svg`,
  founder: {
    '@type': 'Person',
    name: 'Brad Benson',
    description:
      'Founder of BB Sports. University of Florida journalism and sports media (2027).',
  },
  sameAs: [
    'https://x.com/bbsports',
    'https://instagram.com/bbsports',
    'https://tiktok.com/@bbsports',
    'https://youtube.com/@bbsports',
  ],
  publishingPrinciples: `${siteUrl}/editorial-standards`,
  correctionsPolicy: `${siteUrl}/corrections`,
};

const websiteJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'WebSite',
  name: 'BB Sports',
  url: siteUrl,
  description: "Sports from the fan's view. No BS.",
  publisher: { '@type': 'NewsMediaOrganization', name: 'BB Sports', url: siteUrl },
  potentialAction: {
    '@type': 'SearchAction',
    target: `${siteUrl}/search?q={search_term_string}`,
    'query-input': 'required name=search_term_string',
  },
};

export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(orgJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(websiteJsonLd) }}
      />
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-2 focus:top-2 focus:z-50 focus:rounded focus:bg-navy focus:px-3 focus:py-2 focus:text-bone"
      >
        Skip to main content
      </a>
      <BreakingNewsBar />
      <SiteHeader />
      <main id="main">{children}</main>
      <SiteFooter />
      <OfflineBanner />
      <Suspense fallback={null}>
        <AnalyticsTracker />
      </Suspense>
    </>
  );
}
