/**
 * Commercial-use provider registry — single inventory for external services.
 * Adapters must stay RED until commercial + credentials + canary proof.
 */

export type ProviderPosture = 'green' | 'yellow' | 'red' | 'not_configured';

export type ProviderRecord = {
  id: string;
  name: string;
  purpose: string;
  dataSent: string;
  dataReceived: string;
  commercialRight: 'approved' | 'pending' | 'denied' | 'n_a_first_party';
  killSwitchEnv?: string;
  credentialEnv: string[];
  owner: string;
  renewalNote: string;
  /** Runtime fail-closed when red/not_configured for money/transport paths. */
  blocksRuntimeWhenRed: boolean;
};

export const PROVIDER_REGISTRY: ProviderRecord[] = [
  {
    id: 'railway-postgres',
    name: 'Railway Postgres',
    purpose: 'Primary application database',
    dataSent: 'Application data, session digests, analytics hashes',
    dataReceived: 'Query results',
    commercialRight: 'approved',
    credentialEnv: ['DATABASE_URL'],
    owner: 'Brandon (ops)',
    renewalNote: 'Railway plan + backup drills quarterly',
    blocksRuntimeWhenRed: true,
  },
  {
    id: 'stripe',
    name: 'Stripe',
    purpose: 'Reader donations only (no paywall)',
    dataSent: 'Checkout email, amount, donation metadata',
    dataReceived: 'Webhook payment events',
    commercialRight: 'pending',
    killSwitchEnv: 'STRIPE_SECRET_KEY',
    credentialEnv: ['STRIPE_SECRET_KEY', 'STRIPE_WEBHOOK_SECRET'],
    owner: 'Brandon (ops)',
    renewalNote: 'Account verification + live canary before public charge',
    blocksRuntimeWhenRed: true,
  },
  {
    id: 'resend',
    name: 'Resend',
    purpose: 'Transactional newsletter / receipts',
    dataSent: 'Subscriber email, template content',
    dataReceived: 'Delivery status (when enabled)',
    commercialRight: 'pending',
    killSwitchEnv: 'RESEND_API_KEY',
    credentialEnv: ['RESEND_API_KEY'],
    owner: 'Brandon (ops)',
    renewalNote: 'DNS + canary before bulk send',
    blocksRuntimeWhenRed: true,
  },
  {
    id: 'xai',
    name: 'xAI / Grok',
    purpose: 'Optional media generation assist (Brad-approved)',
    dataSent: 'Approved prompts / briefs',
    dataReceived: 'Generated assets metadata',
    commercialRight: 'pending',
    killSwitchEnv: 'XAI_API_KEY',
    credentialEnv: ['XAI_API_KEY'],
    owner: 'Brad (editorial) / Brandon (ops)',
    renewalNote: 'Commercial terms + cost caps',
    blocksRuntimeWhenRed: true,
  },
  {
    id: 'live-scores',
    name: 'Live scores provider',
    purpose: 'Licensed scores (never scrape as product)',
    dataSent: 'API queries',
    dataReceived: 'Score payloads',
    commercialRight: 'pending',
    killSwitchEnv: 'BBSPORTS_APPROVED_LIVE_SCORES',
    credentialEnv: ['BBSPORTS_APPROVED_LIVE_SCORES', 'LIVE_SCORES_API_KEY'],
    owner: 'Brandon (ops)',
    renewalNote: 'License + credentials required',
    blocksRuntimeWhenRed: true,
  },
  {
    id: 'cloudflare-r2',
    name: 'Cloudflare R2',
    purpose: 'Object storage for approved media',
    dataSent: 'Binary assets, metadata',
    dataReceived: 'Object URLs',
    commercialRight: 'pending',
    killSwitchEnv: 'BBSPORTS_APPROVED_R2',
    credentialEnv: [
      'BBSPORTS_APPROVED_R2',
      'R2_ACCOUNT_ID',
      'R2_ACCESS_KEY_ID',
      'R2_SECRET_ACCESS_KEY',
      'R2_BUCKET_NAME',
    ],
    owner: 'Brandon (ops)',
    renewalNote: 'IAM least privilege + lifecycle',
    blocksRuntimeWhenRed: true,
  },
  {
    id: 'x-twitter-connector',
    name: 'X / Twitter connector',
    purpose: 'Newsroom signal intake (dark until approved)',
    dataSent: 'API queries under lease',
    dataReceived: 'Public posts',
    commercialRight: 'pending',
    killSwitchEnv: 'NEWSROOM_X_ENABLED',
    credentialEnv: ['X_BEARER_TOKEN'],
    owner: 'Brad (editorial)',
    renewalNote: 'ToS + commercial approval before transport',
    blocksRuntimeWhenRed: true,
  },
  {
    id: 'bluesky-connector',
    name: 'Bluesky connector',
    purpose: 'Newsroom signal intake (dark until approved)',
    dataSent: 'API queries under lease',
    dataReceived: 'Public posts',
    commercialRight: 'pending',
    killSwitchEnv: 'NEWSROOM_BLUESKY_ENABLED',
    credentialEnv: ['BLUESKY_HANDLE', 'BLUESKY_APP_PASSWORD'],
    owner: 'Brad (editorial)',
    renewalNote: 'ToS + commercial approval before transport',
    blocksRuntimeWhenRed: true,
  },
  {
    id: 'first-party-analytics',
    name: 'First-party analytics',
    purpose: 'Privacy-respecting event ledger',
    dataSent: 'Hashed network digests, event names',
    dataReceived: 'Aggregates for /admin/audience',
    commercialRight: 'n_a_first_party',
    credentialEnv: ['ANALYTICS_HASH_SALT'],
    owner: 'Brandon (ops)',
    renewalNote: 'Salt rotation with dual-window if needed',
    blocksRuntimeWhenRed: false,
  },
];

export function evaluateProviderPosture(
  record: ProviderRecord,
  env: NodeJS.ProcessEnv | Record<string, string | undefined> = process.env,
): ProviderPosture {
  if (record.commercialRight === 'denied') return 'red';
  if (record.commercialRight === 'pending') {
    // Pending commercial right never goes green even if env vars present.
    const hasCreds = record.credentialEnv.every((k) => String(env[k] ?? '').trim());
    return hasCreds ? 'yellow' : 'not_configured';
  }
  if (record.commercialRight === 'n_a_first_party' || record.commercialRight === 'approved') {
    const hasCreds = record.credentialEnv.every((k) => String(env[k] ?? '').trim());
    return hasCreds ? 'green' : 'not_configured';
  }
  return 'not_configured';
}

export function assertProviderMayRun(
  providerId: string,
  env: NodeJS.ProcessEnv | Record<string, string | undefined> = process.env,
): { ok: true } | { ok: false; reason: string } {
  const record = PROVIDER_REGISTRY.find((p) => p.id === providerId);
  if (!record) return { ok: false, reason: `Unknown provider ${providerId}` };
  if (!record.blocksRuntimeWhenRed) return { ok: true };
  const posture = evaluateProviderPosture(record, env);
  if (posture === 'green') return { ok: true };
  return {
    ok: false,
    reason: `${record.name} is ${posture} (commercialRight=${record.commercialRight})`,
  };
}

export function listProvidersPublic(): Array<{
  id: string;
  name: string;
  purpose: string;
  commercialRight: ProviderRecord['commercialRight'];
  posture: ProviderPosture;
}> {
  return PROVIDER_REGISTRY.map((r) => ({
    id: r.id,
    name: r.name,
    purpose: r.purpose,
    commercialRight: r.commercialRight,
    posture: evaluateProviderPosture(r),
  }));
}
