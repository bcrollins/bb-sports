import { ImageResponse } from 'next/og';
import { NextRequest } from 'next/server';

export const runtime = 'edge';

/**
 * Deterministic 1200×630 social card for articles.
 * Brand-safe: no remote hero pixels (rights-safe text-only card).
 */
export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const title = (searchParams.get('title') || 'BB Sports').slice(0, 120);
  const sport = (searchParams.get('sport') || 'Sports').slice(0, 40);
  const byline = (searchParams.get('by') || 'Brad Benson').slice(0, 60);

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          background: '#06122A',
          color: '#F5F2EC',
          padding: '56px 64px',
          fontFamily: 'Georgia, Times New Roman, serif',
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div
            style={{
              display: 'flex',
              fontSize: 22,
              letterSpacing: 4,
              textTransform: 'uppercase',
              color: '#D7263D',
              fontWeight: 700,
              fontFamily: 'system-ui, sans-serif',
            }}
          >
            BB Sports · {sport}
          </div>
          <div
            style={{
              display: 'flex',
              fontSize: title.length > 70 ? 48 : 56,
              lineHeight: 1.05,
              fontWeight: 700,
              maxWidth: 1000,
            }}
          >
            {title}
          </div>
        </div>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-end',
            fontFamily: 'system-ui, sans-serif',
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div style={{ fontSize: 24, fontWeight: 700 }}>By {byline}</div>
            <div style={{ fontSize: 18, opacity: 0.75 }}>Sports from the fan&apos;s view. No BS.</div>
          </div>
          <div
            style={{
              display: 'flex',
              fontSize: 18,
              letterSpacing: 2,
              textTransform: 'uppercase',
              opacity: 0.8,
            }}
          >
            bbsports.fans
          </div>
        </div>
      </div>
    ),
    { width: 1200, height: 630 },
  );
}
