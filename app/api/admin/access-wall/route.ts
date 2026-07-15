/**
 * Admin access-wall endpoint.
 *  GET — returns non-secret wall posture.
 *  PUT — updates the wall password hash stored in site_config.access_wall.
 */
import { NextRequest, NextResponse } from 'next/server';
import { ACCESS_WALL_CONFIG_KEY, type AccessWallConfig, updateAccessWallPassword } from '@/lib/access-wall';
import { accessWallUpdateSchema, validationErrorMessage } from '@/lib/intake-validation';
import { getCurrentUser } from '@/lib/auth';
import { assertCapability } from '@/lib/admin-roles';
import { getConfig } from '@/lib/queries';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const allowed = assertCapability(user.role, 'manage_access_wall');
  if (!allowed.ok) return NextResponse.json({ error: allowed.error }, { status: 403 });
  const config = await getConfig<AccessWallConfig | null>(ACCESS_WALL_CONFIG_KEY, null);
  return NextResponse.json({
    wall: {
      mode: config?.passwordHash ? 'admin-managed' : 'default',
      updatedAt: config?.updatedAt ?? null,
      updatedBy: config?.updatedBy ?? null,
    },
  });
}

export async function PUT(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const allowed = assertCapability(user.role, 'manage_access_wall');
  if (!allowed.ok) return NextResponse.json({ error: allowed.error }, { status: 403 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON.' }, { status: 400 });
  }

  const parsed = accessWallUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: validationErrorMessage(parsed.error) }, { status: 400 });
  }

  await updateAccessWallPassword(parsed.data.password, user.id);
  return NextResponse.json({ ok: true });
}
