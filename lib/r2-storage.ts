/**
 * Cloudflare R2 object storage — fail closed until commercial approval + IAM.
 * No uploads occur without BBSPORTS_APPROVED_R2=true and full credentials.
 */

type EnvLike = Record<string, string | undefined>;

export type R2StorageConfig = {
  approved: boolean;
  ready: boolean;
  missing: string[];
  bucket: string;
  accountId: string;
};

export function getR2StorageConfig(env: EnvLike = process.env): R2StorageConfig {
  const approved = clean(env.BBSPORTS_APPROVED_R2).toLowerCase() === 'true';
  const accountId = clean(env.R2_ACCOUNT_ID);
  const accessKeyId = clean(env.R2_ACCESS_KEY_ID);
  const secretAccessKey = clean(env.R2_SECRET_ACCESS_KEY);
  const bucket = clean(env.R2_BUCKET_NAME) || clean(env.R2_BUCKET);
  const missing: string[] = [];
  if (!approved) missing.push('BBSPORTS_APPROVED_R2');
  if (!accountId) missing.push('R2_ACCOUNT_ID');
  if (!accessKeyId) missing.push('R2_ACCESS_KEY_ID');
  if (!secretAccessKey) missing.push('R2_SECRET_ACCESS_KEY');
  if (!bucket) missing.push('R2_BUCKET_NAME');
  return {
    approved,
    ready: missing.length === 0,
    missing,
    bucket,
    accountId,
  };
}

export function assertR2UploadAllowed(
  env: EnvLike = process.env,
): { ok: true; config: R2StorageConfig } | { ok: false; reason: string; missing: string[] } {
  const config = getR2StorageConfig(env);
  if (!config.ready) {
    return {
      ok: false,
      reason: 'R2 uploads disabled until commercial approval and credentials',
      missing: config.missing,
    };
  }
  return { ok: true, config };
}

/** Placeholder — never performs network I/O when not ready. */
export async function putR2Object(input: {
  key: string;
  body: Uint8Array | string;
  contentType?: string;
  env?: EnvLike;
}): Promise<{ ok: true; key: string } | { ok: false; reason: string }> {
  const gate = assertR2UploadAllowed(input.env);
  if (!gate.ok) return { ok: false, reason: gate.reason };
  // Transport intentionally not wired until approved canary + signed SDK client.
  return {
    ok: false,
    reason: 'R2 transport not activated — configuration ready but canary not completed',
  };
}

function clean(value: string | undefined): string {
  return String(value ?? '').trim();
}
