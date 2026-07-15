import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { canPublishArticle } from '@/lib/article-publication';
import { runAllProviderCanaries } from '@/lib/provider-canary';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const PRIVATE = { 'Cache-Control': 'private, no-store' } as const;

/**
 * Dry-run provider canaries for operators.
 * Never charges Stripe, never sends email, never uploads to R2 unless a future
 * explicit live flag is added with Brad approval.
 */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: PRIVATE });
  }
  // Super-admin only — commercial posture is ops-sensitive.
  if (!canPublishArticle(user.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403, headers: PRIVATE });
  }

  const results = await runAllProviderCanaries({ liveResend: false });
  return NextResponse.json(
    {
      mode: 'dry_run',
      ok: results.every((r) => r.ok),
      results,
      note: 'Dry-run only. Live commercial canaries require explicit approval and credentials.',
    },
    { headers: PRIVATE },
  );
}
