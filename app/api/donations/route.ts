import { NextRequest, NextResponse } from 'next/server';
import { donationIntentSchema, validationErrorMessage } from '@/lib/intake-validation';
import { createDonationIntent, updateDonationIntentStripeCheckout } from '@/lib/queries';
import { requestMeta } from '@/lib/request-meta';
import { recordAnalyticsEventSafe } from '@/lib/analytics';
import {
  buildDonationCheckoutSessionParams,
  getStripeClient,
  getStripeDonationConfig,
  getStripeDonationLink,
} from '@/lib/stripe';
import { rejectIfMutationBlocked } from '@/lib/mutation-guard';

// Donations remain Stripe-only for money movement. BB Sports owns the
// first-party supporter-interest ledger even before Stripe Checkout opens.

export async function GET() {
  const config = getStripeDonationConfig();
  const link = getStripeDonationLink();
  if (config.mode === 'disabled') {
    return NextResponse.json(
      {
        ok: false,
        mode: config.mode,
        missing: config.missing,
        message: 'Donations open with the public launch.',
      },
      { status: 503 }
    );
  }
  return NextResponse.json({
    ok: true,
    mode: config.mode,
    webhookReady: config.webhookReady,
    url: config.mode === 'payment_link' ? link : undefined,
  });
}

export async function POST(req: NextRequest) {
  const blocked = rejectIfMutationBlocked(req);
  if (blocked) return blocked;

  const { ip, userAgent } = requestMeta(req);
  let body: unknown = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON.' }, { status: 400 });
  }

  const parsed = donationIntentSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: validationErrorMessage(parsed.error) }, { status: 400 });
  }

  const config = getStripeDonationConfig();
  const stripe = config.checkoutReady ? getStripeClient() : null;
  const link = getStripeDonationLink();

  if (stripe) {
    let intentId: string | null = null;
    try {
      const intent = await createDonationIntent({
        email: parsed.data.email ?? null,
        name: parsed.data.name,
        amountCents: parsed.data.amountCents ?? null,
        message: parsed.data.message,
        source: parsed.data.source,
        status: 'checkout_pending',
        ip,
        userAgent,
      });
      intentId = intent.id;
      const session = await stripe.checkout.sessions.create(buildDonationCheckoutSessionParams({
        origin: req.nextUrl.origin,
        donationIntentId: intent.id,
        amountCents: parsed.data.amountCents ?? 2500,
        email: parsed.data.email,
        name: parsed.data.name,
        message: parsed.data.message,
        source: parsed.data.source,
      }));
      if (!session.url) throw new Error('Stripe did not return a Checkout URL.');
      await updateDonationIntentStripeCheckout({
        id: intent.id,
        status: 'checkout_open',
        stripeCheckoutSessionId: session.id,
        stripePaymentLink: session.url,
      });
      await recordAnalyticsEventSafe({
        eventName: 'donation_interest_created',
        path: '/api/donations',
        source: parsed.data.source,
        properties: {
          source: parsed.data.source,
          amount_cents: parsed.data.amountCents ?? 2500,
          stripe_ready: true,
          status: 'checkout_open',
        },
      }, { ip, userAgent });
      return NextResponse.json({ ok: true, mode: 'checkout', url: session.url });
    } catch (err) {
      if (intentId) {
        await updateDonationIntentStripeCheckout({
          id: intentId,
          status: 'checkout_failed',
        }).catch(() => null);
      }
      const error = err instanceof Error ? err.message : 'Stripe Checkout unavailable.';
      return NextResponse.json({ error }, { status: 502 });
    }
  }

  if (!link && !parsed.data.email) {
    return NextResponse.json(
      { ok: false, message: 'Donations open with the public launch. Leave an email to get the link when Stripe is ready.' },
      { status: 503 },
    );
  }

  try {
    await createDonationIntent({
      email: parsed.data.email ?? null,
      name: parsed.data.name,
      amountCents: parsed.data.amountCents ?? null,
      message: parsed.data.message,
      source: parsed.data.source,
      status: link ? 'ready_to_pay' : 'waiting_for_stripe',
      stripePaymentLink: link,
      ip,
      userAgent,
    });
    await recordAnalyticsEventSafe({
      eventName: 'donation_interest_created',
      path: '/api/donations',
      source: parsed.data.source,
      properties: {
        source: parsed.data.source,
        amount_cents: parsed.data.amountCents ?? null,
        stripe_ready: Boolean(link),
        status: link ? 'ready_to_pay' : 'waiting_for_stripe',
      },
    }, { ip, userAgent });
  } catch (err) {
    const error = err instanceof Error ? err.message : 'Donation ledger unavailable.';
    return NextResponse.json({ error }, { status: 503 });
  }

  if (link) {
    return NextResponse.json({ ok: true, url: link });
  }

  return NextResponse.json(
    {
      ok: true,
      message: 'You are on the supporter list. Donations open when the Stripe account is verified for public launch.',
    },
    { status: 202 },
  );
}
