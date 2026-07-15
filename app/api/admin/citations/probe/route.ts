import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getCurrentUser } from '@/lib/auth';
import { assertCapability } from '@/lib/admin-roles';
import { extractCitationLinks, probeCitationUrl } from '@/lib/citation-monitor';
import { rejectIfMutationBlocked } from '@/lib/mutation-guard';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const bodySchema = z.object({
  body: z.string().max(200_000),
  probe: z.boolean().optional().default(false),
});

/**
 * POST — extract citation links from markdown; optional live probe (admin only).
 * Never returns source page bodies.
 */
export async function POST(req: NextRequest) {
  const blocked = rejectIfMutationBlocked(req);
  if (blocked) return blocked;

  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const allowed = assertCapability(user.role, 'probe_citations');
  if (!allowed.ok) {
    return NextResponse.json({ error: allowed.error }, { status: 403 });
  }

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 });
  }

  const links = extractCitationLinks(parsed.data.body).slice(0, 40);
  if (!parsed.data.probe) {
    return NextResponse.json({ ok: true, links, probes: [] });
  }

  // Cap concurrent probes
  const probes = [];
  for (const link of links.slice(0, 12)) {
    probes.push(await probeCitationUrl(link.url));
  }
  return NextResponse.json({ ok: true, links, probes });
}
