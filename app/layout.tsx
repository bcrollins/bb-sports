import type { Metadata, Viewport } from 'next';
import './globals.css';
import SiteHeader from '@/components/SiteHeader';
import SiteFooter from '@/components/SiteFooter';
import BreakingNewsBar from '@/components/BreakingNewsBar';

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://bbsports.media';

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: 'BB Sports — Sports from the fan’s view. No bullshit.',
    template: '%s — BB Sports'
  },
  description:
    'Sports from the fan’s view. No bullshit. Opinion-led NFL, NHL, college football, soccer, NBA and MMA coverage by Brad Benson.',
  keywords: [
    'BB Sports',
    'Brad Benson',
    'sports journalism',
    'NFL opinion',
    'NHL opinion',
    'college football',
    'soccer takes',
    'NBA',
    'MMA',
    'fan-perspective sports'
  ],
  authors: [{ name: 'Brad Benson', url: `${siteUrl}/about` }],
  creator: 'Brad Benson',
  publisher: 'BB Sports',
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: siteUrl,
    siteName: 'BB Sports',
    title: 'BB Sports — Sports from the fan’s view. No bullshit.',
    description:
      'Opinion-led sports journalism by Brad Benson. NFL, NHL, college football, soccer, NBA, MMA — written like a fan, sourced like a reporter.',
    images: [{ url: '/og.png', width: 1200, height: 630, alt: 'BB Sports' }]
  },
  twitter: {
    card: 'summary_large_image',
    creator: '@bbsports',
    site: '@bbsports',
    title: 'BB Sports — No bullshit sports.',
    description:
      'Opinion-led sports journalism by Brad Benson. Fan view. No script. No spin.',
    images: ['/og.png']
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, 'max-image-preview': 'large' }
  },
  alternates: { canonical: siteUrl },
  icons: {
    icon: [
      { url: '/favicon.ico' },
      { url: '/icon.svg', type: 'image/svg+xml' }
    ],
    apple: [{ url: '/apple-icon.png', sizes: '180x180' }]
  }
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#F5F2EC' },
    { media: '(prefers-color-scheme: dark)', color: '#0A1F44' }
  ]
};

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
      'Founder of BB Sports. University of Florida journalism and sports media (‧2027).'
  },
  sameAs: [
    'https://x.com/bbsports',
    'https://instagram.com/bbsports',
    'https://tiktok.com/@bbsports',
    'https://youtube.com/@bbsports'
  ],
  publishingPrinciples: `${siteUrl}/editorial-standards`,
  correctionsPolicy: `${siteUrl}/corrections`
};

export default function RootLayout({
  children
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <link
          rel="preconnect"
          href="https://fonts.googleapis.com"
          crossOrigin="anonymous"
        />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&family=Anton&family=Oswald:wght@500;600;700&family=Playfair+Display:ital,wght@0,400;0,600;0,700;0,800;0,900;1,400;1,600;1,700;1,800;1,900&family=Source+Serif+Pro:ital,wght@0,400;0,600;1,400&family=JetBrains+Mono:wght@400;500;600&display=swap"
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(orgJsonLd) }}
        />
      </head>
      <body>
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:bg-navy focus:text-bone focus:px-3 focus:py-2 focus:rounded"
        >
          Skip to main content
        </a>
        <BreakingNewsBar />
        <SiteHeader />
        <main id="main">{children}</main>
        <SiteFooter />
      </body>
    </html>
  );
}
