export type DonationStatusTone = 'navy' | 'red' | 'green' | 'yellow';

const STATUS_LABELS: Record<string, string> = {
  waiting_for_stripe: 'Waiting for Stripe',
  ready_to_pay: 'Payment link ready',
  checkout_pending: 'Checkout pending',
  checkout_open: 'Checkout open',
  checkout_failed: 'Checkout failed',
  checkout_expired: 'Checkout expired',
  payment_failed: 'Payment failed',
  paid: 'Paid',
};

export function donationStatusLabel(status: string): string {
  return STATUS_LABELS[status] ?? sentenceCase(status);
}

export function donationStatusTone(status: string): DonationStatusTone {
  if (status === 'paid') return 'green';
  if (status === 'checkout_open' || status === 'checkout_pending' || status === 'ready_to_pay') return 'yellow';
  if (status === 'checkout_failed' || status === 'checkout_expired' || status === 'payment_failed') return 'red';
  return 'navy';
}

export function formatDonationMoney(
  cents: number | null | undefined,
  currency = 'usd',
  emptyLabel = '-',
): string {
  if (typeof cents !== 'number' || !Number.isFinite(cents)) return emptyLabel;
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency.toUpperCase(),
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(cents / 100);
}

export function compactStripeId(id: string | null | undefined): string {
  if (!id) return '-';
  if (id.length <= 22) return id;
  return `${id.slice(0, 12)}...${id.slice(-6)}`;
}

export function summarizeDonationLedger(rows: Array<{
  status: string;
  stripeAmountReceivedCents?: number | null;
}>): {
  waiting: number;
  open: number;
  paid: number;
  failed: number;
  paidCents: number;
} {
  return rows.reduce((acc, row) => {
    if (row.status === 'waiting_for_stripe') acc.waiting += 1;
    if (row.status === 'ready_to_pay' || row.status === 'checkout_pending' || row.status === 'checkout_open') {
      acc.open += 1;
    }
    if (row.status === 'paid') {
      acc.paid += 1;
      acc.paidCents += row.stripeAmountReceivedCents ?? 0;
    }
    if (row.status === 'checkout_failed' || row.status === 'checkout_expired' || row.status === 'payment_failed') {
      acc.failed += 1;
    }
    return acc;
  }, { waiting: 0, open: 0, paid: 0, failed: 0, paidCents: 0 });
}

function sentenceCase(value: string): string {
  const normalized = value.replace(/[_-]+/g, ' ').trim();
  if (!normalized) return 'Unknown';
  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
}
