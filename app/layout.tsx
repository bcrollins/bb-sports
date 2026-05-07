import type { Metadata, Viewport } from 'next';
import {
  Inter,
  Anton,
  Oswald,
  Playfair_Display,
  Source_Serif_4,
  JetBrains_Mono,
} from 'next/font/google';
import './globals.css';
import SiteHeader from '@/components/SiteHeader';
import SiteFooter from '@/components/SiteFooter';
import BreakingNewsBar from '@/components/BreakingNewsBar';

// Self-hosted via next/font — eliminates the render-blocking Google Fonts CSS
// link, removes the third-party CDN dependency, and lets Next preload the
// critical font subsets. Each family exposes a CSS variable that Tailwind
// maps to a fontFamily token (see tailwind.config.ts).
const inter = Inter({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800', '900'],
  variable: '--font-inter',
  display: 'swap',
});
const anton = Anton({
  subsets: ['latin'],
  weight: '400',
  variable: '--font-anton',
  display: 'swap',
});
const oswald = Oswald({
  subsets: ['latin'],
  weight: ['500', '600', '700'],
  variable: '--font-oswald',
  display: 'swap',
});
const playfair = Playfair_Display({
  subsets: ['latin'],
  weight: ['400', '600', '700', '800', '900'],
  style: ['normal', 'italic'],
  variable: '--font-playfair',
  display: 'swap',
});
const sourceSerif = Source_Serif_4({
  subsets: ['latin'],
  weight: ['400', '600'],
  style: ['normal', 'italic'],
  variable: '--font-source-serif',
  display: 'swap',
});
const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--font-jetbrains',
  display: 'swap',
});

const fontVars = [
  inter.variable,
  anton.variable,
  oswald.variable,
  playfair.variable,
  sourceSerif.variable,
  jetbrainsMono.variable,
].join(' ');

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
    <html lang="en" className={fontVars}>
      <head>
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
