/**
 * Public, non-secret release provenance for health/status/smoke.
 * Never includes lock digests of private packages, env secrets, or build paths.
 */
import pkg from '@/package.json';

export type PublicReleaseManifest = {
  service: 'bb-sports';
  version: string;
  /** Full commit when available (Railway injects RAILWAY_GIT_COMMIT_SHA). */
  commit: string;
  commitShort: string;
  /** ISO timestamp when process started (runtime), not secret. */
  processStartedAt: string;
  /** Optional deploy-time stamp from host if present. */
  deploymentIdPresent: boolean;
  environment: 'production' | 'development' | 'test' | 'unknown';
  /** Soft-launch vs public — mirrors crawl/wall posture without secrets. */
  publicLaunch: boolean;
};

const PROCESS_STARTED_AT = new Date().toISOString();

export function getPublicReleaseManifest(
  env: NodeJS.ProcessEnv | Record<string, string | undefined> = process.env,
): PublicReleaseManifest {
  const raw =
    env.RAILWAY_GIT_COMMIT_SHA ||
    env.VERCEL_GIT_COMMIT_SHA ||
    env.GIT_COMMIT ||
    env.COMMIT_SHA ||
    'local';
  const commit = String(raw).trim() || 'local';
  const commitShort = commit === 'local' ? 'local' : commit.slice(0, 7);

  let environment: PublicReleaseManifest['environment'] = 'unknown';
  if (env.NODE_ENV === 'production') environment = 'production';
  else if (env.NODE_ENV === 'development') environment = 'development';
  else if (env.NODE_ENV === 'test') environment = 'test';

  return {
    service: 'bb-sports',
    version: pkg.version,
    commit,
    commitShort,
    processStartedAt: PROCESS_STARTED_AT,
    deploymentIdPresent: Boolean(env.RAILWAY_DEPLOYMENT_ID || env.RAILWAY_SNAPSHOT_ID),
    environment,
    publicLaunch: env.BBSPORTS_PUBLIC_LAUNCH === 'true',
  };
}

/**
 * Smoke/ops: accept exact match or either side as a prefix (short vs full SHA).
 * Reject empty expected only when caller requires a pin (caller gates empty).
 */
export function commitsMatch(expected: string, actual: string): boolean {
  const e = String(expected || '').trim().toLowerCase();
  const a = String(actual || '').trim().toLowerCase();
  if (!e) return true;
  if (!a || a === 'local') return false;
  if (e === a) return true;
  if (a.startsWith(e) || e.startsWith(a)) return true;
  return false;
}
