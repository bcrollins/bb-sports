import { NextRequest, NextResponse } from 'next/server';

// v1 stub: returns the configured Stripe payment-link URL.
// v1.1: full Stripe Checkout creation + webhook reconciliation into the donation ledger.

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
  return NextResponse.json(
    { ok: false, message: 'Donations open with the public launch.' },
    { status: 503 }
  );
}
