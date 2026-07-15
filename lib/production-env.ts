/**
 * Production environment posture — validates required config without exposing secrets.
 */
export type EnvPosture = {
  productionLike: boolean;
  ok: boolean;
  missing: string[];
  optionalMissing: string[];
  flags: {
    resendApproved: boolean;
    xaiApproved: boolean;
    liveScoresApproved: boolean;
  };
};

function isProductionLike(env: NodeJS.ProcessEnv | Record<string, string | undefined>): boolean {
  return (
    env.NODE_ENV === 'production' ||
    Boolean(env.RAILWAY_ENVIRONMENT) ||
    Boolean(env.RAILWAY_PROJECT_ID)
  );
}

/** Required when running as production / Railway. */
const PRODUCTION_REQUIRED = [
  'DATABASE_URL',
  'JWT_SECRET',
  'GATE_COOKIE_SECRET',
  'GATE_PASSWORD',
  'NEXT_PUBLIC_SITE_URL',
] as const;

const OPTIONAL_LAUNCH = [
  'STRIPE_SECRET_KEY',
  'STRIPE_WEBHOOK_SECRET',
  'RESEND_API_KEY',
  'RESEND_FROM',
  'XAI_API_KEY',
  'ANALYTICS_HASH_SALT',
] as const;

export function evaluateProductionEnv(
  env: NodeJS.ProcessEnv | Record<string, string | undefined> = process.env,
): EnvPosture {
  const productionLike = isProductionLike(env);
  const missing: string[] = [];
  const optionalMissing: string[] = [];

  if (productionLike) {
    for (const key of PRODUCTION_REQUIRED) {
      if (!String(env[key] ?? '').trim()) missing.push(key);
    }
  }

  for (const key of OPTIONAL_LAUNCH) {
    if (!String(env[key] ?? '').trim()) optionalMissing.push(key);
  }

  return {
    productionLike,
    ok: missing.length === 0,
    missing,
    optionalMissing,
    flags: {
      resendApproved: env.BBSPORTS_APPROVED_RESEND === 'true',
      xaiApproved: env.BBSPORTS_APPROVED_XAI === 'true',
      liveScoresApproved:
        env.BBSPORTS_APPROVED_LIVE_SCORES === 'true' ||
        env.BBSPORTS_APPROVED_LIVE_SCORES_FEED === 'true',
    },
  };
}

/** Safe public DTO — never includes secret values. */
export function productionEnvPublicDto(
  env: NodeJS.ProcessEnv | Record<string, string | undefined> = process.env,
) {
  const posture = evaluateProductionEnv(env);
  return {
    productionLike: posture.productionLike,
    ok: posture.ok,
    missingCount: posture.missing.length,
    missing: posture.missing,
    optionalMissingCount: posture.optionalMissing.length,
    flags: posture.flags,
    siteUrlConfigured: Boolean(String(env.NEXT_PUBLIC_SITE_URL ?? '').trim()),
  };
}
