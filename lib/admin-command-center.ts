import type { CommentStatus } from './comment-validation';

export type AdminStatus = 'green' | 'yellow' | 'red';
export type AdminPriority = 'P0' | 'P1' | 'P2';

export type AdminArticleCounts = {
  total: number;
  published: number;
  drafts: number;
  aiAssisted: number;
};

export type AdminAudienceCounts = {
  subscribers: number;
  contactNew: number;
  donationWaiting: number;
  donationOpen: number;
  donationPaid: number;
  donationFailed: number;
  donationPaidCents: number;
};

export type AdminAnalyticsCounts = {
  events7d: number;
  pageViews7d: number;
  articleViews7d: number;
  searches7d: number;
  donationInterest7d: number;
  newsletterSignups7d: number;
};

export type ProviderCheck = {
  key: string;
  label: string;
  env: string;
  status: AdminStatus;
  configured: boolean;
  launchCritical: boolean;
  detail: string;
};

export type ReadinessGate = {
  key: string;
  label: string;
  status: AdminStatus;
  href: string;
  metric: string;
  detail: string;
  weight: number;
};

export type OperatorAction = {
  priority: AdminPriority;
  label: string;
  detail: string;
  href: string;
  cta: string;
  owner: 'Editorial' | 'Audience' | 'Community' | 'Revenue' | 'Provider' | 'Launch';
};

export type OperatingLane = {
  label: string;
  status: AdminStatus;
  href: string;
  metric: string;
  detail: string;
};

export type AdminCommandCenter = {
  readinessScore: number;
  verdict: 'Ship' | 'Watch' | 'Block';
  standingP0P1: number;
  providerSummary: string;
  providerChecks: ProviderCheck[];
  readinessGates: ReadinessGate[];
  actions: OperatorAction[];
  lanes: OperatingLane[];
};

const PROVIDER_DEFS: Array<{
  key: string;
  label: string;
  env: string;
  launchCritical: boolean;
  approvedFlag?: boolean;
  detail: string;
}> = [
  {
    key: 'postgres',
    label: 'Postgres',
    env: 'DATABASE_URL',
    launchCritical: true,
    detail: 'Internal CMS, comments, newsletter, donations, and analytics source of truth.',
  },
  {
    key: 'admin-jwt',
    label: 'Admin JWT',
    env: 'JWT_SECRET',
    launchCritical: true,
    detail: 'Signed newsroom sessions and route protection.',
  },
  {
    key: 'stripe-secret',
    label: 'Stripe checkout',
    env: 'STRIPE_SECRET_KEY',
    launchCritical: true,
    detail: 'Donation checkout session creation.',
  },
  {
    key: 'stripe-webhook',
    label: 'Stripe webhook',
    env: 'STRIPE_WEBHOOK_SECRET',
    launchCritical: true,
    detail: 'Donation reconciliation and receipt ledger integrity.',
  },
  {
    key: 'resend-api',
    label: 'Resend',
    env: 'RESEND_API_KEY',
    launchCritical: false,
    detail: 'Newsletter welcome and future editorial email transport.',
  },
  {
    key: 'resend-approval',
    label: 'Resend commercial gate',
    env: 'BBSPORTS_APPROVED_RESEND',
    launchCritical: false,
    approvedFlag: true,
    detail: 'Commercial-use gate for email transport.',
  },
  {
    key: 'xai-api',
    label: 'xAI Grok',
    env: 'XAI_API_KEY',
    launchCritical: false,
    detail: 'AI media and draft-assist provider. Public publishing remains Brad-approved only.',
  },
  {
    key: 'xai-approval',
    label: 'xAI commercial gate',
    env: 'BBSPORTS_APPROVED_XAI',
    launchCritical: false,
    approvedFlag: true,
    detail: 'Commercial-use gate for AI generation.',
  },
  {
    key: 'r2-bucket',
    label: 'Cloudflare R2',
    env: 'R2_BUCKET_NAME',
    launchCritical: false,
    detail: 'Durable object storage for approved media assets.',
  },
];

const EMPTY_ANALYTICS: AdminAnalyticsCounts = {
  events7d: 0,
  pageViews7d: 0,
  articleViews7d: 0,
  searches7d: 0,
  donationInterest7d: 0,
  newsletterSignups7d: 0,
};

export function buildProviderChecks(env: Record<string, string | undefined>): ProviderCheck[] {
  return PROVIDER_DEFS.map((provider) => {
    const configured = provider.approvedFlag ? env[provider.env] === 'true' : Boolean(env[provider.env]);
    return {
      key: provider.key,
      label: provider.label,
      env: provider.env,
      status: configured ? 'green' : provider.launchCritical ? 'red' : 'yellow',
      configured,
      launchCritical: provider.launchCritical,
      detail: provider.detail,
    };
  });
}

export function summarizeProviderPosture(providerChecks: ProviderCheck[]): string {
  const green = providerChecks.filter((provider) => provider.status === 'green').length;
  const red = providerChecks.filter((provider) => provider.status === 'red').length;
  const yellow = providerChecks.length - green - red;
  return `${green} green / ${yellow} yellow / ${red} red`;
}

export function buildAdminCommandCenter(input: {
  articles: AdminArticleCounts;
  audience: AdminAudienceCounts;
  comments: Record<CommentStatus, number>;
  analytics?: AdminAnalyticsCounts;
  env: Record<string, string | undefined>;
}): AdminCommandCenter {
  const analytics = input.analytics ?? EMPTY_ANALYTICS;
  const providerChecks = buildProviderChecks(input.env);
  const criticalProviderBlockers = providerChecks.filter(
    (provider) => provider.launchCritical && provider.status !== 'green',
  );
  const commentsNeedingReview = input.comments.pending + input.comments.flagged;
  const stripeConfigured = providerChecks
    .filter((provider) => provider.key === 'stripe-secret' || provider.key === 'stripe-webhook')
    .every((provider) => provider.status === 'green');
  const emailConfigured = providerChecks
    .filter((provider) => provider.key === 'resend-api' || provider.key === 'resend-approval')
    .every((provider) => provider.status === 'green');

  const readinessGates: ReadinessGate[] = [
    {
      key: 'anchor-articles',
      label: 'Anchor article inventory',
      status: input.articles.published >= 5 ? 'green' : 'red',
      href: '/admin/articles',
      metric: `${input.articles.published}/5`,
      detail: 'Five live pieces give readers a real archive before public launch.',
      weight: 18,
    },
    {
      key: 'draft-queue',
      label: 'Draft queue',
      status: input.articles.drafts > 0 ? 'green' : 'yellow',
      href: '/admin/articles/new',
      metric: `${input.articles.drafts}`,
      detail: 'At least one Brad-owned draft keeps the publishing loop warm.',
      weight: 8,
    },
    {
      key: 'newsletter-ledger',
      label: 'Newsletter ledger',
      status: input.audience.subscribers > 0 ? 'green' : 'red',
      href: '/admin/audience',
      metric: `${input.audience.subscribers}`,
      detail: 'Launch capture must write to BB Sports before any external transport matters.',
      weight: 15,
    },
    {
      key: 'community-queue',
      label: 'Comment queue',
      status: commentsNeedingReview === 0 ? 'green' : input.comments.flagged > 0 ? 'red' : 'yellow',
      href: '/admin/comments',
      metric: `${commentsNeedingReview}`,
      detail: 'Pending and flagged comments need a newsroom decision before the public room grows.',
      weight: 10,
    },
    {
      key: 'donation-rail',
      label: 'Donation rail',
      status: stripeConfigured ? 'green' : 'red',
      href: '/admin/launch',
      metric: stripeConfigured ? 'ready' : 'blocked',
      detail: 'Stripe checkout and webhook secrets are required before reader support goes live.',
      weight: 16,
    },
    {
      key: 'welcome-email',
      label: 'Welcome email',
      status: emailConfigured ? 'green' : 'yellow',
      href: '/admin/launch',
      metric: emailConfigured ? 'ready' : 'degraded',
      detail: 'Newsletter can collect first-party rows without Resend; welcome delivery stays degraded.',
      weight: 8,
    },
    {
      key: 'first-party-analytics',
      label: 'First-party analytics',
      status: analytics.events7d > 0 ? 'green' : 'yellow',
      href: '/admin/audience',
      metric: `${analytics.events7d}`,
      detail: 'Recent page, article, search, newsletter, and support events should be visible here.',
      weight: 8,
    },
    {
      key: 'admin-auth',
      label: 'Admin auth',
      status: input.env.JWT_SECRET ? 'green' : 'red',
      href: '/admin/launch',
      metric: input.env.JWT_SECRET ? 'locked' : 'missing',
      detail: 'The newsroom shell must remain behind signed sessions.',
      weight: 17,
    },
  ];

  const readyWeight = readinessGates.reduce((sum, gate) => {
    if (gate.status === 'green') return sum + gate.weight;
    if (gate.status === 'yellow') return sum + gate.weight * 0.5;
    return sum;
  }, 0);
  const totalWeight = readinessGates.reduce((sum, gate) => sum + gate.weight, 0);
  const readinessScore = Math.round((readyWeight / totalWeight) * 100);
  const redGates = readinessGates.filter((gate) => gate.status === 'red').length;
  const verdict = redGates === 0 && criticalProviderBlockers.length === 0 && readinessScore >= 85
    ? 'Ship'
    : redGates <= 1 && readinessScore >= 65
      ? 'Watch'
      : 'Block';
  const actions = buildOperatorActions({
    articles: input.articles,
    audience: input.audience,
    analytics,
    commentsNeedingReview,
    flaggedComments: input.comments.flagged,
    criticalProviderBlockers,
    stripeConfigured,
    emailConfigured,
  });

  return {
    readinessScore,
    verdict,
    standingP0P1: actions.filter((action) => action.priority !== 'P2').length,
    providerSummary: summarizeProviderPosture(providerChecks),
    providerChecks,
    readinessGates,
    actions,
    lanes: [
      {
        label: 'Editorial',
        status: input.articles.published >= 5 ? 'green' : 'red',
        href: '/admin/articles',
        metric: `${input.articles.published} live / ${input.articles.drafts} drafts`,
        detail: input.articles.aiAssisted > 0
          ? `${input.articles.aiAssisted} AI-assisted pieces require visible labels and Brad take slots.`
          : 'All current article work is Brad-authored or manually controlled.',
      },
      {
        label: 'Community',
        status: commentsNeedingReview === 0 ? 'green' : input.comments.flagged > 0 ? 'red' : 'yellow',
        href: '/admin/comments',
        metric: `${commentsNeedingReview} to review`,
        detail: `${input.comments.approved} approved public comments; spam and hidden rows stay internal.`,
      },
      {
        label: 'Audience',
        status: input.audience.subscribers > 0 || input.audience.contactNew > 0 ? 'green' : 'yellow',
        href: '/admin/audience',
        metric: `${input.audience.subscribers} subscribers`,
        detail: `${analytics.pageViews7d} page views and ${analytics.searches7d} searches in the last 7 days.`,
      },
      {
        label: 'Revenue',
        status: stripeConfigured ? 'green' : input.audience.donationWaiting > 0 ? 'red' : 'yellow',
        href: '/admin/launch',
        metric: stripeConfigured ? 'checkout ready' : `${input.audience.donationWaiting} waits`,
        detail: `${input.audience.donationPaid} paid records, ${input.audience.donationFailed} failed records.`,
      },
      {
        label: 'Providers',
        status: criticalProviderBlockers.length === 0 ? 'green' : 'red',
        href: '/admin/launch',
        metric: summarizeProviderPosture(providerChecks),
        detail: criticalProviderBlockers.length === 0
          ? 'Critical providers are configured in this runtime.'
          : `${criticalProviderBlockers.length} critical provider gate${criticalProviderBlockers.length === 1 ? '' : 's'} need attention.`,
      },
    ],
  };
}

function buildOperatorActions(input: {
  articles: AdminArticleCounts;
  audience: AdminAudienceCounts;
  analytics: AdminAnalyticsCounts;
  commentsNeedingReview: number;
  flaggedComments: number;
  criticalProviderBlockers: ProviderCheck[];
  stripeConfigured: boolean;
  emailConfigured: boolean;
}): OperatorAction[] {
  const actions: OperatorAction[] = [];

  if (input.articles.published < 5) {
    actions.push({
      priority: 'P0',
      label: 'Ship the next anchor article',
      detail: `${5 - input.articles.published} more live piece${5 - input.articles.published === 1 ? '' : 's'} needed before the archive feels real.`,
      href: '/admin/articles/new',
      cta: 'Write',
      owner: 'Editorial',
    });
  }

  if (input.commentsNeedingReview > 0) {
    actions.push({
      priority: input.flaggedComments > 0 ? 'P0' : 'P1',
      label: 'Clear the moderation queue',
      detail: `${input.commentsNeedingReview} comment${input.commentsNeedingReview === 1 ? '' : 's'} need approve, flag, hide, or spam treatment.`,
      href: '/admin/comments',
      cta: 'Review',
      owner: 'Community',
    });
  }

  if (input.criticalProviderBlockers.length > 0) {
    actions.push({
      priority: 'P0',
      label: 'Clear critical provider gates',
      detail: `${input.criticalProviderBlockers.map((provider) => provider.label).join(', ')} blocking launch-grade operation.`,
      href: '/admin/launch',
      cta: 'Open launch',
      owner: 'Provider',
    });
  }

  if (!input.stripeConfigured && input.audience.donationWaiting > 0) {
    actions.push({
      priority: 'P1',
      label: 'Open the donation checkout rail',
      detail: `${input.audience.donationWaiting} supporter intent row${input.audience.donationWaiting === 1 ? '' : 's'} waiting for Stripe checkout and webhook readiness.`,
      href: '/admin/launch',
      cta: 'Wire Stripe',
      owner: 'Revenue',
    });
  }

  if (input.audience.contactNew > 0) {
    actions.push({
      priority: 'P1',
      label: 'Answer the inbound inbox',
      detail: `${input.audience.contactNew} new tip, contact, or sponsor message${input.audience.contactNew === 1 ? '' : 's'} in the first-party ledger.`,
      href: '/admin/audience',
      cta: 'Open inbox',
      owner: 'Audience',
    });
  }

  if (input.audience.subscribers === 0) {
    actions.push({
      priority: 'P1',
      label: 'Prove newsletter capture',
      detail: 'The newsletter rail is live only after the ledger has at least one real subscriber row.',
      href: '/admin/audience',
      cta: 'Inspect ledger',
      owner: 'Audience',
    });
  }

  if (!input.emailConfigured) {
    actions.push({
      priority: 'P2',
      label: 'Promote welcome email from degraded to live',
      detail: 'First-party capture works without Resend, but welcome delivery should be configured before launch.',
      href: '/admin/launch',
      cta: 'Check Resend',
      owner: 'Provider',
    });
  }

  if (input.analytics.events7d === 0) {
    actions.push({
      priority: 'P2',
      label: 'Seed first-party analytics proof',
      detail: 'Run public route smoke and reader interactions so the audience page shows live behavior.',
      href: '/admin/audience',
      cta: 'Open audience',
      owner: 'Launch',
    });
  }

  if (input.articles.drafts > 0) {
    actions.push({
      priority: 'P2',
      label: 'Convert draft inventory',
      detail: `${input.articles.drafts} draft${input.articles.drafts === 1 ? '' : 's'} can become the next publish interval after Brad reviews voice and sources.`,
      href: '/admin/articles',
      cta: 'Edit drafts',
      owner: 'Editorial',
    });
  }

  if (actions.length === 0) {
    actions.push({
      priority: 'P2',
      label: 'Run final launch proof',
      detail: 'The queue is clear. Verify public routes, protected admin, donation, newsletter, comments, and device matrix.',
      href: '/admin/launch',
      cta: 'Verify',
      owner: 'Launch',
    });
  }

  return actions.sort((a, b) => priorityRank(a.priority) - priorityRank(b.priority)).slice(0, 6);
}

function priorityRank(priority: AdminPriority): number {
  return priority === 'P0' ? 0 : priority === 'P1' ? 1 : 2;
}
