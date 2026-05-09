import { NextRequest, NextResponse } from 'next/server';
import type Stripe from 'stripe';
import { recordAnalyticsEventSafe } from '@/lib/analytics';
import { updateDonationIntentStripeStatus } from '@/lib/queries';
import { getStripeClient, getStripeDonationConfig, getStripeWebhookSecret, stripeObjectId } from '@/lib/stripe';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const HANDLED_EVENTS = [
  'checkout.session.completed',
  'checkout.session.expired',
  'payment_intent.payment_failed',
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
      await handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session);
      return;
    case 'checkout.session.expired':
      await handleCheckoutExpired(event.data.object as Stripe.Checkout.Session);
      return;
    case 'payment_intent.payment_failed':
      await handlePaymentIntentFailed(event.data.object as Stripe.PaymentIntent);
      return;
    default:
      return;
  }
}

async function handleCheckoutCompleted(session: Stripe.Checkout.Session): Promise<void> {
  const donationIntentId = session.metadata?.donation_intent_id ?? null;
  await updateDonationIntentStripeStatus({
    id: donationIntentId,
    stripeCheckoutSessionId: session.id,
    status: 'paid',
    stripePaymentIntentId: stripeObjectId(session.payment_intent),
    stripeCustomerId: stripeObjectId(session.customer),
    stripeCurrency: session.currency ?? null,
    stripeAmountReceivedCents: session.amount_total ?? null,
    paidAt: new Date(),
  });
  await recordAnalyticsEventSafe({
    eventName: 'donation_interest_created',
    path: '/api/stripe/webhook',
    source: 'stripe-webhook',
    properties: {
      status: 'paid',
      amount_cents: session.amount_total ?? null,
      stripe_ready: true,
    },
  });
}

async function handleCheckoutExpired(session: Stripe.Checkout.Session): Promise<void> {
  await updateDonationIntentStripeStatus({
    id: session.metadata?.donation_intent_id ?? null,
    stripeCheckoutSessionId: session.id,
    status: 'checkout_expired',
    stripePaymentIntentId: stripeObjectId(session.payment_intent),
  });
}

async function handlePaymentIntentFailed(paymentIntent: Stripe.PaymentIntent): Promise<void> {
  await updateDonationIntentStripeStatus({
    id: paymentIntent.metadata?.donation_intent_id ?? null,
    status: 'payment_failed',
    stripePaymentIntentId: paymentIntent.id,
    stripeCurrency: paymentIntent.currency,
    stripeAmountReceivedCents: paymentIntent.amount_received || null,
  });
}
