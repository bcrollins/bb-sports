/**
 * Live scores / standings policy for BB Sports.
 *
 * Commercial-use rule (Perfection Engine Component 22): no production
 * scoreboard, standings widget, or box-score scrape ships without a signed
 * commercial license, terms in /docs/legal/, and BBSPORTS_APPROVED_LIVE_SCORES=true.
 *
 * Default: impossible. Fail closed.
 */

export type LiveScoresPosture = {
  allowed: boolean;
  reason: string;
  commercialApproved: boolean;
  credentialsPresent: boolean;
};

/**
 * Pure policy evaluation — no I/O. Safe for unit tests and UI gating.
 */
export function evaluateLiveScoresPosture(
  env: NodeJS.ProcessEnv | Record<string, string | undefined> = process.env,
): LiveScoresPosture {
  // Canonical flag is BBSPORTS_APPROVED_LIVE_SCORES. Accept the historical
  // *_FEED alias so older Railway variables do not silently fail open or closed wrong.
  const commercialApproved =
    env.BBSPORTS_APPROVED_LIVE_SCORES === 'true' ||
    env.BBSPORTS_APPROVED_LIVE_SCORES_FEED === 'true';
  const credentialsPresent = Boolean(
    env.LIVE_SCORES_API_KEY || env.SPORTRADAR_API_KEY || env.SPORTSDATAIO_API_KEY,
  );

  if (!commercialApproved) {
    return {
      allowed: false,
      reason: 'commercial_approval_required',
      commercialApproved: false,
      credentialsPresent,
    };
  }
  if (!credentialsPresent) {
    return {
      allowed: false,
      reason: 'credentials_missing',
      commercialApproved: true,
      credentialsPresent: false,
    };
  }
  return {
    allowed: true,
    reason: 'approved_and_credentialed',
    commercialApproved: true,
    credentialsPresent: true,
  };
}

/**
 * Public copy when scores cannot render. Never invents a line or box score.
 */
export function liveScoresUnavailableMessage(posture: LiveScoresPosture = evaluateLiveScoresPosture()): string {
  if (posture.allowed) {
    return 'Live scores are available from the licensed feed.';
  }
  return 'Live scores are not enabled. BB Sports does not scrape proprietary box scores or ship unlicensed feeds.';
}

/** Assert at call sites that would otherwise fetch scores. */
export function assertLiveScoresAllowed(
  env: NodeJS.ProcessEnv | Record<string, string | undefined> = process.env,
): void {
  const posture = evaluateLiveScoresPosture(env);
  if (!posture.allowed) {
    throw new Error(`Live scores blocked: ${posture.reason}`);
  }
}
