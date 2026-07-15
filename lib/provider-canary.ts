/**
 * Provider canary harness — dry-run proofs without activating commercial transport.
 * Real canaries still require Brad/ops approval + live credentials.
 */

import { getResendEmailConfig, sendNewsletterWelcomeEmail } from '@/lib/resend';
import { getStripeDonationConfig } from '@/lib/stripe';
import { assertR2UploadAllowed, getR2StorageConfig, putR2Object } from '@/lib/r2-storage';
import { evaluateLiveScoresPosture } from '@/lib/live-scores';

export type CanaryResult = {
  provider: string;
  mode: 'dry_run' | 'live';
  ok: boolean;
  detail: string;
  blockers: string[];
};

export async function runResendCanary(input: {
  env?: NodeJS.ProcessEnv | Record<string, string | undefined>;
  /** When true, will attempt a real send if config.enabled. Default false. */
  live?: boolean;
  to?: string;
  origin?: string;
  fetcher?: typeof fetch;
}): Promise<CanaryResult> {
  const env = input.env ?? process.env;
  const config = getResendEmailConfig(env);
  if (!config.enabled) {
    return {
      provider: 'resend',
      mode: 'dry_run',
      ok: true,
      detail: 'Fail-closed correctly — welcome transport disabled until approval + credentials.',
      blockers: config.missing,
    };
  }
  if (!input.live) {
    return {
      provider: 'resend',
      mode: 'dry_run',
      ok: true,
      detail: 'Config ready; live canary not requested (set live:true with Brad approval).',
      blockers: [],
    };
  }
  const result = await sendNewsletterWelcomeEmail(
    {
      to: input.to || 'canary@bbsports.fans',
      unsubscribeToken: 'canary-token-not-for-prod',
      origin: input.origin || 'https://bbsports.fans',
    },
    env,
    input.fetcher ?? fetch,
  );
  return {
    provider: 'resend',
    mode: 'live',
    ok: result.status === 'sent',
    detail:
      result.status === 'sent'
        ? `sent ${result.providerId}`
        : `${result.status}: ${'reason' in result ? result.reason : ''}`,
    blockers: result.status === 'disabled' ? result.missing : [],
  };
}

export function runStripeCanary(input: {
  env?: NodeJS.ProcessEnv | Record<string, string | undefined>;
}): CanaryResult {
  const config = getStripeDonationConfig(input.env);
  if (config.mode === 'disabled') {
    return {
      provider: 'stripe',
      mode: 'dry_run',
      ok: true,
      detail: 'Fail-closed — checkout disabled until secret + webhook configured.',
      blockers: config.missing,
    };
  }
  return {
    provider: 'stripe',
    mode: 'dry_run',
    ok: true,
    detail: `Mode ${config.mode} ready for approved live canary (not charged here).`,
    blockers: [],
  };
}

export async function runR2Canary(input: {
  env?: NodeJS.ProcessEnv | Record<string, string | undefined>;
}): Promise<CanaryResult> {
  const env = input.env ?? process.env;
  const config = getR2StorageConfig(env);
  const gate = assertR2UploadAllowed(env);
  if (!gate.ok) {
    return {
      provider: 'r2',
      mode: 'dry_run',
      ok: true,
      detail: gate.reason,
      blockers: gate.missing,
    };
  }
  const put = await putR2Object({ key: 'canary/probe.bin', body: 'canary', env });
  return {
    provider: 'r2',
    mode: 'dry_run',
    // Transport not activated is the expected dry-run success.
    ok: put.ok === false,
    detail: put.ok ? 'unexpected upload' : put.reason,
    blockers: config.missing,
  };
}

export function runLiveScoresCanary(input: {
  env?: NodeJS.ProcessEnv | Record<string, string | undefined>;
}): CanaryResult {
  const posture = evaluateLiveScoresPosture(input.env);
  return {
    provider: 'live-scores',
    mode: 'dry_run',
    ok: !posture.allowed,
    detail: posture.allowed
      ? 'Live scores unexpectedly enabled'
      : posture.reason || 'Live scores fail closed',
    blockers: posture.allowed ? [] : ['BBSPORTS_APPROVED_LIVE_SCORES'],
  };
}

export async function runAllProviderCanaries(input?: {
  env?: NodeJS.ProcessEnv | Record<string, string | undefined>;
  liveResend?: boolean;
}): Promise<CanaryResult[]> {
  const env = input?.env;
  return [
    await runResendCanary({ env, live: input?.liveResend }),
    runStripeCanary({ env }),
    await runR2Canary({ env }),
    runLiveScoresCanary({ env }),
  ];
}
