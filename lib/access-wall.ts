import bcrypt from 'bcryptjs';
import { getConfig, setConfig } from './queries';

export const ACCESS_WALL_CONFIG_KEY = 'access_wall';
export const DEFAULT_ACCESS_WALL_PASSWORD = 'calebwilliamsMVP';

export interface AccessWallConfig {
  passwordHash?: string;
  updatedAt?: string;
  updatedBy?: string | null;
}

export async function verifyAccessWallPassword(password: string): Promise<boolean> {
  const configured = await getConfig<AccessWallConfig | null>(ACCESS_WALL_CONFIG_KEY, null);
  if (configured?.passwordHash) {
    return bcrypt.compare(password, configured.passwordHash);
  }

  const expected = process.env.GATE_PASSWORD ?? DEFAULT_ACCESS_WALL_PASSWORD;
  return password === expected;
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
