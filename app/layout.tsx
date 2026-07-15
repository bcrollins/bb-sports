import type { Metadata, Viewport } from 'next';
import { evaluateSoftLaunchPosture } from '@/lib/soft-launch';
import './globals.css';

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://bbsports.fans';
const searchIndexable = evaluateSoftLaunchPosture().searchIndexable;

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: 'BB Sports — Sports from the fan’s view. No BS.',
    template: '%s — BB Sports'
  },
  description:
    'Sports from the fan’s view. No BS. The most recent sports news, written with the bias turned all the way up. By Brad Benson.',
  keywords: [
    'BB Sports',
    'Brad Benson',
    'sports journalism',
    'franchise rankings',
    'NFL rankings',
    'MLB rankings',
    'NHL rankings',
    'NBA rankings',
    'NFL opinion',
    'MLB opinion',
    'NHL opinion',
    'NBA opinion',
    'college football',
    'soccer takes',
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
    title: 'BB Sports — Sports from the fan’s view. No BS.',
    description:
      'Opinion-led sports journalism by Brad Benson. Most recent sports news, written like a fan, sourced like a reporter, bias turned all the way up.',
    images: [{ url: '/og.png', width: 1200, height: 630, alt: 'BB Sports' }]
  },
  twitter: {
    card: 'summary_large_image',
    creator: '@bbsports',
    site: '@bbsports',
    title: 'BB Sports — No BS sports.',
    description:
      'Opinion-led sports journalism by Brad Benson. Fan view. No script. No spin.',
    images: ['/og.png']
  },
  // Soft launch: noindex until BBSPORTS_PUBLIC_LAUNCH=true (matches robots/sitemap/RSS).
  robots: searchIndexable
    ? {
        index: true,
        follow: true,
        googleBot: { index: true, follow: true, 'max-image-preview': 'large' },
      }
    : {
        index: false,
        follow: false,
        googleBot: { index: false, follow: false },
      },
  alternates: {
    canonical: siteUrl,
    types: { 'application/rss+xml': `${siteUrl}/rss.xml` },
  },
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

export default function RootLayout({
  children
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
