import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import {
  listArticleRevisions,
  PublicationError,
} from '@/lib/article-publication-queries';
import {
  changedRevisionFields,
  summarizeRevisionDiff,
} from '@/lib/article-revision-history';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const PRIVATE_HEADERS = { 'Cache-Control': 'private, no-store' } as const;

function json(body: unknown, status = 200): NextResponse {
  return NextResponse.json(body, { status, headers: PRIVATE_HEADERS });
}

/**
 * GET — list immutable revisions newest-first with adjacent-field summaries.
 * Never mutates history; restore is a client apply of snapshot into the draft form.
 */
export async function GET(
  _: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await getCurrentUser();
    if (!user) return json({ error: 'Unauthorized', code: 'UNAUTHORIZED' }, 401);
    const { id } = await params;
    const revisions = await listArticleRevisions(id);
    const withDiff = revisions.map((rev, index) => {
      const older = revisions[index + 1];
      const changes = changedRevisionFields(older?.snapshot, rev.snapshot);
      return {
        id: rev.id,
        revisionNumber: rev.revisionNumber,
        contentHash: rev.contentHash,
        createdAt: rev.createdAt,
        changedFields: changes.map((c) => c.field),
        summary: summarizeRevisionDiff(older?.snapshot, rev.snapshot),
        // Snapshot included so Brad can restore into the working draft (new save/revision).
        snapshot: rev.snapshot,
      };
    });
    return json({ revisions: withDiff });
  } catch (error) {
    if (error instanceof PublicationError) {
      return json({ error: error.message, code: error.code }, error.status);
    }
    return json({ error: 'Could not load revision history.', code: 'INTERNAL' }, 500);
  }
}
