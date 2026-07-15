import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getCurrentUser } from '@/lib/auth';
import { canPublishArticle } from '@/lib/article-publication';
import {
  getCatalogReconcileSnapshot,
  importFilesystemArticlesAsDrafts,
} from '@/lib/catalog-import';
import { recordAdminAuditEvent } from '@/lib/admin-audit';
import { requestMeta } from '@/lib/request-meta';
import { rejectIfMutationBlocked } from '@/lib/mutation-guard';
import { readBoundedJson } from '@/lib/bounded-json';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const importSchema = z
  .object({
    dryRun: z.boolean().optional().default(true),
    slugs: z.array(z.string().min(1).max(200)).max(50).optional(),
  })
  .strict();

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const snapshot = await getCatalogReconcileSnapshot();
    return NextResponse.json({ ok: true, snapshot });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Catalog snapshot failed.';
    return NextResponse.json({ error: message }, { status: 503 });
  }
}

export async function POST(req: NextRequest) {
  const blocked = rejectIfMutationBlocked(req);
  if (blocked) return blocked;

  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!canPublishArticle(user.role)) {
    return NextResponse.json(
      { error: 'Only super-admin can import catalog drafts.' },
      { status: 403 },
    );
  }

  const { ip } = requestMeta(req);
  try {
    const body = importSchema.parse(await readBoundedJson(req));
    const result = await importFilesystemArticlesAsDrafts({
      dryRun: body.dryRun,
      slugs: body.slugs,
      authorName: user.name,
    });
    await recordAdminAuditEvent({
      actorUserId: user.id,
      actorEmail: user.email,
      action: body.dryRun ? 'catalog_import_dry_run' : 'catalog_import_drafts',
      targetType: 'catalog',
      summary: body.dryRun
        ? `Dry-run import of ${result.imported.length} draft candidate(s).`
        : `Imported ${result.imported.length} draft article(s); never published.`,
      metadata: {
        dryRun: body.dryRun,
        imported: result.imported,
        skipped: result.skippedExisting,
        errors: result.errors,
      },
      ip,
    });
    return NextResponse.json({
      ok: true,
      result,
      notice:
        'Imports are drafts only. Brad must approve each piece through the publish gate. External signals never publish.',
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Catalog import failed.';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
