/**
 * Admin site_config endpoint.
 * Reads and writes only the four explicitly editable, non-secret keys.
 */
import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { assertCapability } from '@/lib/admin-roles';
import {
  editableSiteConfigUpdateSchema,
  getEditableSiteConfig,
} from '@/lib/editable-site-config';
import { validationErrorMessage } from '@/lib/intake-validation';
import { setConfig } from '@/lib/queries';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const allowed = assertCapability(user.role, 'manage_site_config');
  if (!allowed.ok) return NextResponse.json({ error: allowed.error }, { status: 403 });
  const config = await getEditableSiteConfig();
  return NextResponse.json({ config });
}

export async function PUT(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const allowed = assertCapability(user.role, 'manage_site_config');
  if (!allowed.ok) return NextResponse.json({ error: allowed.error }, { status: 403 });
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }
  const parsed = editableSiteConfigUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: validationErrorMessage(parsed.error) }, { status: 400 });
  }
  await setConfig(parsed.data.key, parsed.data.value, user.id);
  return NextResponse.json({ ok: true });
}
