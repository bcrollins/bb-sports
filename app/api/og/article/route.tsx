import { ImageResponse } from 'next/og';
import { NextRequest } from 'next/server';

export const runtime = 'nodejs';

/**
 * Deterministic 1200×630 social card for articles.
 * Brand-safe: no remote hero pixels (rights-safe text-only card).
 * Satori requires multi-child nodes to use display:flex|none.
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
          backgroundColor: '#06122A',
          color: '#F5F2EC',
          padding: '56px 64px',
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div
            style={{
              display: 'flex',
              fontSize: 22,
              letterSpacing: 4,
              textTransform: 'uppercase',
              color: '#D7263D',
              fontWeight: 700,
              marginBottom: 20,
            }}
          >
            {`BB Sports · ${sport}`}
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
            width: '100%',
            justifyContent: 'space-between',
            alignItems: 'flex-end',
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', fontSize: 24, fontWeight: 700, marginBottom: 8 }}>
              {`By ${byline}`}
            </div>
            <div style={{ display: 'flex', fontSize: 18, opacity: 0.75 }}>
              {"Sports from the fan's view. No BS."}
            </div>
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
