import { getStripeDonationConfig, type StripeDonationMode } from '@/lib/stripe';

export const SUPPORT_AMOUNTS = [
  { label: '$5', amountCents: 500, note: 'Tip jar' },
  { label: '$10', amountCents: 1000, note: 'Group chat fuel' },
  { label: '$25', amountCents: 2500, note: 'Founding supporter' },
  { label: '$50', amountCents: 5000, note: 'Sponsor the rant' },
] as const;

export type SupportSurfaceMode = 'interest_only' | 'payments_unavailable' | 'stripe_live';

/**
 * Reader-facing support truth — one unambiguous outcome per mode.
 * Money never claims success before Stripe webhook/ledger confirmation.
 */
export function resolveSupportSurfaceMode(
  env: NodeJS.ProcessEnv | Record<string, string | undefined> = process.env,
): {
  surface: SupportSurfaceMode;
  stripeMode: StripeDonationMode;
  headline: string;
  detail: string;
  primaryCta: string;
  acceptsMoneyNow: boolean;
} {
  const stripe = getStripeDonationConfig(env);
  if (stripe.mode === 'checkout' || stripe.mode === 'payment_link') {
    return {
      surface: 'stripe_live',
      stripeMode: stripe.mode,
      headline: 'Stripe checkout is available',
      detail:
        'You will leave this page for Stripe. BB Sports only records a paid donation after a verified webhook — success on this page alone is not a charge.',
      primaryCta:
        stripe.mode === 'checkout' ? 'Continue to Stripe checkout' : 'Open Stripe payment link',
      acceptsMoneyNow: true,
    };
  }
  // Soft-launch / missing secrets: interest ledger only, never pretend charge.
  return {
    surface: 'interest_only',
    stripeMode: 'disabled',
    headline: 'Payments are not open yet',
    detail:
      'This form records supporter interest only. No card is charged on bbsports.fans until Stripe is verified and enabled. You will get a link later — nothing is paid right now.',
    primaryCta: 'Join the supporter list (no charge)',
    acceptsMoneyNow: false,
  };
}
