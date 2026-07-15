/**
 * Soft-launch acquisition boundary — single source of product posture.
 * Keep donations and paid acquisition closed until providers are proven.
 */
export type SoftLaunchPosture = {
  mode: 'soft_launch' | 'public';
  wallEnabled: boolean;
  newsletterCollect: boolean;
  donationsOpen: boolean;
  searchIndexable: boolean;
  summary: string;
};

export function evaluateSoftLaunchPosture(
  env: NodeJS.ProcessEnv | Record<string, string | undefined> = process.env,
): SoftLaunchPosture {
  // Explicit public mode only when wall is disabled via env (future).
  const wallDisabled = env.BBSPORTS_PUBLIC_LAUNCH === 'true';
  const donationsOpen =
    env.BBSPORTS_APPROVED_STRIPE === 'true' &&
    Boolean(env.STRIPE_SECRET_KEY || env.STRIPE_DONATION_LINK);

  if (wallDisabled) {
    return {
      mode: 'public',
      wallEnabled: false,
      newsletterCollect: true,
      donationsOpen,
      searchIndexable: true,
      summary: 'Public launch mode. Indexing allowed; donations follow Stripe approval.',
    };
  }

  return {
    mode: 'soft_launch',
    wallEnabled: true,
    newsletterCollect: true,
    donationsOpen: false,
    searchIndexable: false,
    summary:
      'Soft launch: signed access wall on, robots noindex preference, newsletter collect ok after gate, donations closed until Stripe e2e proof.',
  };
}
