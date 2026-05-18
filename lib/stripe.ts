import Stripe from 'stripe';

export const STRIPE_API_VERSION = '2026-04-22.dahlia' as const;
export const STRIPE_DONATION_CURRENCY = 'usd';

type EnvLike = Record<string, string | undefined>;

export type StripeDonationMode = 'checkout' | 'payment_link' | 'disabled';

export function getStripeDonationConfig(env: EnvLike = process.env): {
  mode: StripeDonationMode;
  checkoutReady: boolean;
  paymentLinkReady: boolean;
  webhookReady: boolean;
  secretReady: boolean;
  missing: string[];
} {
  const secretKey = clean(env.STRIPE_SECRET_KEY);
  const paymentLink = clean(env.STRIPE_DONATION_LINK);
  const webhookSecret = clean(env.STRIPE_WEBHOOK_SECRET);
  const secretReady = Boolean(secretKey);
  const paymentLinkReady = isHttpsUrl(paymentLink);
  const webhookReady = Boolean(webhookSecret);
  const checkoutReady = secretReady && webhookReady;
  const missing = [];
  if (!secretReady) missing.push('STRIPE_SECRET_KEY');
  if (!webhookReady) missing.push('STRIPE_WEBHOOK_SECRET');

  return {
    mode: checkoutReady ? 'checkout' : paymentLinkReady ? 'payment_link' : 'disabled',
    checkoutReady,
    paymentLinkReady,
    webhookReady,
    secretReady,
    missing,
  };
}

export function getStripeClient(env: EnvLike = process.env): Stripe | null {
  const secretKey = clean(env.STRIPE_SECRET_KEY);
  if (!secretKey) return null;
  return new Stripe(secretKey, {
    apiVersion: STRIPE_API_VERSION,
    appInfo: {
      name: 'BB Sports',
      version: process.env.npm_package_version ?? '0.3.0',
      url: process.env.NEXT_PUBLIC_SITE_URL ?? 'https://bbsports.fans',
    },
  });
}

export function getStripeWebhookSecret(env: EnvLike = process.env): string {
  return clean(env.STRIPE_WEBHOOK_SECRET);
}

export function getStripeDonationLink(env: EnvLike = process.env): string {
  const link = clean(env.STRIPE_DONATION_LINK);
  return isHttpsUrl(link) ? link : '';
}

export function buildDonationCheckoutSessionParams(input: {
  origin: string;
  donationIntentId: string;
  amountCents: number;
  email?: string | null;
  name?: string;
  message?: string;
  source?: string;
}): Stripe.Checkout.SessionCreateParams {
  const urls = donationReturnUrls(input.origin);
  const metadata = buildDonationMetadata(input);
  return {
    mode: 'payment',
    submit_type: 'donate',
    customer_email: input.email || undefined,
    success_url: urls.successUrl,
    cancel_url: urls.cancelUrl,
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: STRIPE_DONATION_CURRENCY,
          unit_amount: input.amountCents,
          product_data: {
            name: 'BB Sports reader support',
            description: 'Reader support for free BB Sports articles. No coverage, placement, or gambling picks.',
          },
        },
      },
    ],
    metadata,
    payment_intent_data: { metadata },
  };
}

export function donationReturnUrls(origin: string): { successUrl: string; cancelUrl: string } {
  const success = new URL('/support', origin);
  success.searchParams.set('status', 'success');
  success.searchParams.set('session_id', '{CHECKOUT_SESSION_ID}');
  const cancel = new URL('/support', origin);
  cancel.searchParams.set('status', 'cancelled');
  return {
    successUrl: success.toString().replace('%7BCHECKOUT_SESSION_ID%7D', '{CHECKOUT_SESSION_ID}'),
    cancelUrl: cancel.toString(),
  };
}

export function buildDonationMetadata(input: {
  donationIntentId: string;
  amountCents: number;
  source?: string;
}): Record<string, string> {
  return {
    donation_intent_id: input.donationIntentId,
    source: input.source || 'support-page',
    amount_cents: String(input.amountCents),
    editorial_independence: 'true',
  };
}

export function stripeObjectId(value: unknown): string | null {
  if (!value) return null;
  if (typeof value === 'string') return value;
  if (typeof value === 'object' && 'id' in value && typeof value.id === 'string') return value.id;
  return null;
}

function clean(value: string | undefined): string {
  return value?.trim() ?? '';
}

function isHttpsUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === 'https:';
  } catch {
    return false;
  }
}
