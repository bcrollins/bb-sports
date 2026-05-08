import { NextRequest, NextResponse } from 'next/server';
import { donationIntentSchema, validationErrorMessage } from '@/lib/intake-validation';
import { createDonationIntent } from '@/lib/queries';
import { requestMeta } from '@/lib/request-meta';
import { recordAnalyticsEventSafe } from '@/lib/analytics';

// Donations remain Stripe-only for money movement. BB Sports owns the
// first-party supporter-interest ledger even before Stripe Checkout opens.

export async function GET() {
  const link = process.env.STRIPE_DONATION_LINK ?? null;
  if (!link) {
    return NextResponse.json(
      { ok: false, message: 'Donations open with the public launch.' },
      { status: 503 }
    );
  }
  return NextResponse.json({ ok: true, url: link });
}

export async function POST(req: NextRequest) {
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

  const link = process.env.STRIPE_DONATION_LINK ?? null;
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
