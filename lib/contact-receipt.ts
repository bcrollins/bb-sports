/** Non-sensitive public receipt token derived from the durable row id. */
export function formatContactReceiptId(id: string): string {
  const clean = String(id ?? '')
    .trim()
    .replace(/[^a-f0-9-]/gi, '');
  if (!clean) return 'BB-UNKNOWN';
  const compact = clean.replace(/-/g, '').slice(0, 12).toUpperCase();
  return `BB-${compact}`;
}
