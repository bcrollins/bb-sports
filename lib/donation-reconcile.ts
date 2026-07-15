/**
 * Idempotent donation ledger reconciliation (pure).
 * Paid is sticky unless a verified refund/dispute reduces net; gross provider IDs stay.
 */

export type DonationLedgerStatus =
  | 'waiting_for_stripe'
  | 'ready_to_pay'
  | 'checkout_pending'
  | 'checkout_open'
  | 'checkout_failed'
  | 'checkout_expired'
  | 'payment_failed'
  | 'paid'
  | 'refunded'
  | 'partially_refunded'
  | 'disputed'
  | 'dispute_lost'
  | 'dispute_won';

export type DonationLedgerState = {
  status: DonationLedgerStatus | string;
  stripeCheckoutSessionId?: string | null;
  stripePaymentIntentId?: string | null;
  stripeCurrency?: string | null;
  /** Gross amount ever marked paid (immutable once set). */
  grossPaidCents: number;
  /** Cumulative refunds/disputes applied. */
  refundedCents: number;
  /** Processed Stripe event ids for idempotency. */
  seenEventIds: string[];
};

export type DonationReconcileEvent =
  | {
      type: 'checkout.session.completed';
      eventId: string;
      checkoutSessionId: string;
      paymentIntentId?: string | null;
      currency?: string | null;
      amountTotalCents: number;
    }
  | {
      type: 'checkout.session.expired';
      eventId: string;
      checkoutSessionId: string;
    }
  | {
      type: 'payment_intent.payment_failed';
      eventId: string;
      paymentIntentId: string;
      amountReceivedCents?: number | null;
      currency?: string | null;
    }
  | {
      type: 'charge.refunded';
      eventId: string;
      paymentIntentId?: string | null;
      refundAmountCents: number;
    }
  | {
      type: 'charge.dispute.created';
      eventId: string;
      paymentIntentId?: string | null;
      disputedAmountCents: number;
    }
  | {
      type: 'charge.dispute.closed';
      eventId: string;
      paymentIntentId?: string | null;
      won: boolean;
      disputedAmountCents: number;
    };

export function netDonationCents(state: DonationLedgerState): number {
  return Math.max(0, state.grossPaidCents - state.refundedCents);
}

/**
 * Apply one Stripe-shaped event. Duplicate eventId is a no-op.
 * Never reports paid without a completed checkout event.
 */
export function reconcileDonationEvent(
  prev: DonationLedgerState,
  event: DonationReconcileEvent,
): DonationLedgerState {
  if (prev.seenEventIds.includes(event.eventId)) {
    return prev;
  }
  const seenEventIds = [...prev.seenEventIds, event.eventId].slice(-50);
  const base = { ...prev, seenEventIds };

  switch (event.type) {
    case 'checkout.session.completed': {
      const gross = Math.max(base.grossPaidCents, Math.max(0, event.amountTotalCents));
      return {
        ...base,
        status: 'paid',
        stripeCheckoutSessionId: event.checkoutSessionId,
        stripePaymentIntentId: event.paymentIntentId ?? base.stripePaymentIntentId,
        stripeCurrency: event.currency ?? base.stripeCurrency,
        grossPaidCents: gross,
      };
    }
    case 'checkout.session.expired': {
      // Paid is sticky — expired after paid must not un-pay.
      if (base.status === 'paid' || base.grossPaidCents > 0) return base;
      return {
        ...base,
        status: 'checkout_expired',
        stripeCheckoutSessionId: event.checkoutSessionId,
      };
    }
    case 'payment_intent.payment_failed': {
      if (base.status === 'paid' || base.grossPaidCents > 0) return base;
      return {
        ...base,
        status: 'payment_failed',
        stripePaymentIntentId: event.paymentIntentId,
        stripeCurrency: event.currency ?? base.stripeCurrency,
      };
    }
    case 'charge.refunded': {
      if (base.grossPaidCents <= 0) return base;
      const refundedCents = Math.min(
        base.grossPaidCents,
        base.refundedCents + Math.max(0, event.refundAmountCents),
      );
      const fully = refundedCents >= base.grossPaidCents;
      return {
        ...base,
        refundedCents,
        status: fully ? 'refunded' : 'partially_refunded',
        stripePaymentIntentId: event.paymentIntentId ?? base.stripePaymentIntentId,
      };
    }
    case 'charge.dispute.created': {
      if (base.grossPaidCents <= 0) return base;
      return {
        ...base,
        status: 'disputed',
        stripePaymentIntentId: event.paymentIntentId ?? base.stripePaymentIntentId,
      };
    }
    case 'charge.dispute.closed': {
      if (base.grossPaidCents <= 0) return base;
      if (event.won) {
        return { ...base, status: 'dispute_won' };
      }
      const refundedCents = Math.min(
        base.grossPaidCents,
        base.refundedCents + Math.max(0, event.disputedAmountCents),
      );
      return {
        ...base,
        refundedCents,
        status: 'dispute_lost',
        stripePaymentIntentId: event.paymentIntentId ?? base.stripePaymentIntentId,
      };
    }
    default:
      return base;
  }
}

export function emptyDonationLedgerState(): DonationLedgerState {
  return {
    status: 'waiting_for_stripe',
    grossPaidCents: 0,
    refundedCents: 0,
    seenEventIds: [],
  };
}
