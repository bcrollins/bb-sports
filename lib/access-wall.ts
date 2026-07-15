import bcrypt from 'bcryptjs';
import { timingSafeEqual } from 'node:crypto';
import { getConfig, setConfig } from './queries';

export const ACCESS_WALL_CONFIG_KEY = 'access_wall';

export interface AccessWallConfig {
  passwordHash?: string;
  updatedAt?: string;
  updatedBy?: string | null;
}

/**
 * The Railway-managed password is the operator recovery credential. It stays
 * valid even when Brad adds an admin-managed wall password, so an accidental
 * DB/config change cannot lock the operator out of the public site.
 */
export function matchesOperatorAccessWallPassword(
  password: string,
  expected = process.env.GATE_PASSWORD,
): boolean {
  if (!expected) return false;
  const submittedBytes = Buffer.from(password);
  const expectedBytes = Buffer.from(expected);
  return submittedBytes.length === expectedBytes.length && timingSafeEqual(submittedBytes, expectedBytes);
}

export async function verifyAccessWallPassword(password: string): Promise<boolean> {
  if (matchesOperatorAccessWallPassword(password)) return true;

  const configured = await getConfig<AccessWallConfig | null>(ACCESS_WALL_CONFIG_KEY, null);
  if (configured?.passwordHash) {
    return bcrypt.compare(password, configured.passwordHash);
  }
  return false;
}

export async function updateAccessWallPassword(password: string, updatedBy?: string | null): Promise<void> {
  const passwordHash = await bcrypt.hash(password, 10);
  await setConfig(
    ACCESS_WALL_CONFIG_KEY,
    {
      passwordHash,
      updatedAt: new Date().toISOString(),
      updatedBy: updatedBy ?? null,
    } satisfies AccessWallConfig,
    updatedBy,
  );
}
