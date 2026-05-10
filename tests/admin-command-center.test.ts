import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildAdminCommandCenter,
  buildProviderChecks,
  summarizeProviderPosture,
  type AdminAnalyticsCounts,
  type AdminArticleCounts,
  type AdminAudienceCounts,
} from '../lib/admin-command-center';
import type { CommentStatus } from '../lib/comment-validation';

const baseArticles: AdminArticleCounts = {
  total: 6,
  published: 5,
  drafts: 1,
  aiAssisted: 0,
};

const baseAudience: AdminAudienceCounts = {
  subscribers: 12,
  contactNew: 0,
  donationWaiting: 0,
  donationOpen: 0,
  donationPaid: 1,
  donationFailed: 0,
  donationPaidCents: 2500,
};

const baseComments: Record<CommentStatus, number> = {
  approved: 4,
  pending: 0,
  flagged: 0,
  spam: 1,
  hidden: 0,
};

const baseAnalytics: AdminAnalyticsCounts = {
  events7d: 24,
  pageViews7d: 14,
  articleViews7d: 8,
  searches7d: 2,
  donationInterest7d: 1,
  newsletterSignups7d: 3,
};

const launchEnv = {
  DATABASE_URL: 'postgres://bb-sports',
  JWT_SECRET: 'local-secret',
  STRIPE_SECRET_KEY: 'sk_test_123',
  STRIPE_WEBHOOK_SECRET: 'whsec_123',
  RESEND_API_KEY: 're_123',
  BBSPORTS_APPROVED_RESEND: 'true',
  XAI_API_KEY: 'xai_123',
  BBSPORTS_APPROVED_XAI: 'true',
  R2_BUCKET_NAME: 'bb-sports',
};

test('admin command center ships when launch-critical gates are green', () => {
  const command = buildAdminCommandCenter({
    articles: baseArticles,
    audience: baseAudience,
    comments: baseComments,
    analytics: baseAnalytics,
    env: launchEnv,
  });

  assert.equal(command.verdict, 'Ship');
  assert.equal(command.readinessScore, 100);
  assert.equal(command.providerSummary, '9 green / 0 yellow / 0 red');
  assert.equal(command.actions[0]?.label, 'Convert draft inventory');
  assert.equal(command.lanes.find((lane) => lane.label === 'Revenue')?.status, 'green');
});

test('admin command center prioritizes editorial inventory and critical provider blockers', () => {
  const command = buildAdminCommandCenter({
    articles: { ...baseArticles, published: 2, drafts: 0 },
    audience: { ...baseAudience, subscribers: 0, donationWaiting: 3 },
    comments: { ...baseComments, pending: 2, flagged: 1 },
    analytics: { ...baseAnalytics, events7d: 0 },
    env: { DATABASE_URL: 'postgres://bb-sports' },
  });

  assert.equal(command.verdict, 'Block');
  assert.ok(command.readinessScore < 65);
  assert.deepEqual(
    command.actions.slice(0, 3).map((action) => [action.priority, action.label]),
    [
      ['P0', 'Ship the next anchor article'],
      ['P0', 'Clear the moderation queue'],
      ['P0', 'Clear critical provider gates'],
    ],
  );
  assert.equal(command.standingP0P1, 5);
  assert.equal(command.lanes.find((lane) => lane.label === 'Community')?.status, 'red');
});

test('provider posture distinguishes commercial gates from ordinary env vars', () => {
  const providers = buildProviderChecks({
    DATABASE_URL: 'postgres://bb-sports',
    JWT_SECRET: 'secret',
    BBSPORTS_APPROVED_RESEND: 'false',
    BBSPORTS_APPROVED_XAI: 'true',
  });

  assert.equal(providers.find((provider) => provider.env === 'DATABASE_URL')?.status, 'green');
  assert.equal(providers.find((provider) => provider.env === 'STRIPE_SECRET_KEY')?.status, 'red');
  assert.equal(providers.find((provider) => provider.env === 'BBSPORTS_APPROVED_RESEND')?.status, 'yellow');
  assert.equal(providers.find((provider) => provider.env === 'BBSPORTS_APPROVED_XAI')?.status, 'green');
  assert.equal(summarizeProviderPosture(providers), '3 green / 4 yellow / 2 red');
});
