import { NextRequest, NextResponse } from 'next/server';
import type Stripe from 'stripe';
import { recordAnalyticsEventSafe } from '@/lib/analytics';
import { emptyDonationLedgerState, reconcileDonationEvent } from '@/lib/donation-reconcile';
import { updateDonationIntentStripeStatus } from '@/lib/queries';
import { getStripeClient, getStripeDonationConfig, getStripeWebhookSecret, stripeObjectId } from '@/lib/stripe';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const HANDLED_EVENTS = [
  'checkout.session.completed',
  'checkout.session.expired',
  'payment_intent.payment_failed',
  'charge.refunded',
  'charge.dispute.created',
  'charge.dispute.closed',
] as const;

export async function GET() {
  const config = getStripeDonationConfig();
  return NextResponse.json({
    ok: true,
    route: '/api/stripe/webhook',
    method: 'POST',
    checkoutReady: config.checkoutReady,
    webhookReady: config.webhookReady,
    handledEvents: HANDLED_EVENTS,
  });
}

export async function POST(req: NextRequest) {
  const stripe = getStripeClient();
  const webhookSecret = getStripeWebhookSecret();
  if (!stripe || !webhookSecret) {
    return NextResponse.json({ error: 'Stripe webhook is not configured.' }, { status: 503 });
  }

  const signature = req.headers.get('stripe-signature');
  if (!signature) {
    return NextResponse.json({ error: 'Missing Stripe signature.' }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    const rawBody = await req.text();
    event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
  } catch {
    return NextResponse.json({ error: 'Invalid Stripe signature.' }, { status: 400 });
  }

  try {
    await handleStripeEvent(event);
  } catch {
    return NextResponse.json({ error: 'Stripe event could not be reconciled.' }, { status: 503 });
  }

  return NextResponse.json({ received: true });
}

async function handleStripeEvent(event: Stripe.Event): Promise<void> {
  switch (event.type) {
    case 'checkout.session.completed':
      await handleCheckoutCompleted(event.id, event.data.object as Stripe.Checkout.Session);
      return;
    case 'checkout.session.expired':
      await handleCheckoutExpired(event.id, event.data.object as Stripe.Checkout.Session);
      return;
    case 'payment_intent.payment_failed':
      await handlePaymentIntentFailed(event.id, event.data.object as Stripe.PaymentIntent);
      return;
    case 'charge.refunded':
      await handleChargeRefunded(event.id, event.data.object as Stripe.Charge);
      return;
    case 'charge.dispute.created':
      await handleDispute(event.id, event.data.object as Stripe.Dispute, 'created');
      return;
    case 'charge.dispute.closed':
      await handleDispute(event.id, event.data.object as Stripe.Dispute, 'closed');
      return;
    default:
      return;
  }
}

async function handleCheckoutCompleted(
  eventId: string,
  session: Stripe.Checkout.Session,
): Promise<void> {
  const donationIntentId = session.metadata?.donation_intent_id ?? null;
  const next = reconcileDonationEvent(emptyDonationLedgerState(), {
    type: 'checkout.session.completed',
    eventId,
    checkoutSessionId: session.id,
    paymentIntentId: stripeObjectId(session.payment_intent),
    currency: session.currency ?? null,
    amountTotalCents: session.amount_total ?? 0,
  });
  await updateDonationIntentStripeStatus({
    id: donationIntentId,
    stripeCheckoutSessionId: session.id,
    status: next.status,
    stripePaymentIntentId: next.stripePaymentIntentId,
    stripeCustomerId: stripeObjectId(session.customer),
    stripeCurrency: next.stripeCurrency,
    stripeAmountReceivedCents: next.grossPaidCents || null,
    paidAt: new Date(),
  });
  await recordAnalyticsEventSafe({
    eventName: 'donation_interest_created',
    path: '/api/stripe/webhook',
    source: 'stripe-webhook',
    properties: {
      status: next.status,
      amount_cents: session.amount_total ?? null,
      stripe_ready: true,
      event_id: eventId,
    },
  });
}

async function handleCheckoutExpired(
  eventId: string,
  session: Stripe.Checkout.Session,
): Promise<void> {
  // Pure reconcile: paid is sticky if already paid (DB layer still applies status write).
  const next = reconcileDonationEvent(emptyDonationLedgerState(), {
    type: 'checkout.session.expired',
    eventId,
    checkoutSessionId: session.id,
  });
  // Only write expired when reconcile yields expired (not when sticky paid from empty state).
  if (next.status !== 'checkout_expired') return;
  await updateDonationIntentStripeStatus({
    id: session.metadata?.donation_intent_id ?? null,
    stripeCheckoutSessionId: session.id,
    status: 'checkout_expired',
    stripePaymentIntentId: stripeObjectId(session.payment_intent),
  });
}

async function handlePaymentIntentFailed(
  eventId: string,
  paymentIntent: Stripe.PaymentIntent,
): Promise<void> {
  const next = reconcileDonationEvent(emptyDonationLedgerState(), {
    type: 'payment_intent.payment_failed',
    eventId,
    paymentIntentId: paymentIntent.id,
    amountReceivedCents: paymentIntent.amount_received || null,
    currency: paymentIntent.currency,
  });
  if (next.status !== 'payment_failed') return;
  await updateDonationIntentStripeStatus({
    id: paymentIntent.metadata?.donation_intent_id ?? null,
    status: 'payment_failed',
    stripePaymentIntentId: paymentIntent.id,
    stripeCurrency: paymentIntent.currency,
    stripeAmountReceivedCents: paymentIntent.amount_received || null,
  });
}

async function handleChargeRefunded(eventId: string, charge: Stripe.Charge): Promise<void> {
  const amountRefunded = charge.amount_refunded ?? 0;
  const next = reconcileDonationEvent(
    {
      ...emptyDonationLedgerState(),
      status: 'paid',
      grossPaidCents: charge.amount ?? amountRefunded,
      stripePaymentIntentId: stripeObjectId(charge.payment_intent),
    },
    {
      type: 'charge.refunded',
      eventId,
      paymentIntentId: stripeObjectId(charge.payment_intent),
      refundAmountCents: amountRefunded,
    },
  );
  await updateDonationIntentStripeStatus({
    id: charge.metadata?.donation_intent_id ?? null,
    status: next.status,
    stripePaymentIntentId: next.stripePaymentIntentId,
    stripeAmountReceivedCents: Math.max(0, next.grossPaidCents - next.refundedCents),
  });
}

async function handleDispute(
  eventId: string,
  dispute: Stripe.Dispute,
  phase: 'created' | 'closed',
): Promise<void> {
  const amount = dispute.amount ?? 0;
  const base = {
    ...emptyDonationLedgerState(),
    status: 'paid' as const,
    grossPaidCents: amount,
    stripePaymentIntentId: stripeObjectId(dispute.payment_intent),
  };
  const next =
    phase === 'created'
      ? reconcileDonationEvent(base, {
          type: 'charge.dispute.created',
          eventId,
          paymentIntentId: stripeObjectId(dispute.payment_intent),
          disputedAmountCents: amount,
        })
      : reconcileDonationEvent(base, {
          type: 'charge.dispute.closed',
          eventId,
          paymentIntentId: stripeObjectId(dispute.payment_intent),
          won: dispute.status === 'won',
          disputedAmountCents: amount,
        });
  await updateDonationIntentStripeStatus({
    id: (dispute.metadata?.donation_intent_id as string | undefined) ?? null,
    status: next.status,
    stripePaymentIntentId: next.stripePaymentIntentId,
    stripeAmountReceivedCents: Math.max(0, next.grossPaidCents - next.refundedCents),
  });
}
