import type { Metadata, Viewport } from 'next';
import './globals.css';

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://bbsports.fans';

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
