/**
 * Structural parser for the Top-100 executable ledger.
 */

export type LedgerStatusKind =
  | 'Pending'
  | 'In progress'
  | 'Complete'
  | 'Implemented'
  | 'Absorbed'
  | 'Blocked';

export type LedgerItem = {
  rank: number;
  title: string;
  statusLine: string;
  statusKind: LedgerStatusKind | 'Unknown';
};

const ITEM_RE = /^#(\d+)\s+—\s+(.+)$/gm;
const STATUS_RE = /^Status:\s*(.+)$/m;

export function parseTop100Ledger(markdown: string): LedgerItem[] {
  const lines = markdown.split(/\r?\n/);
  const items: LedgerItem[] = [];
  let current: { rank: number; title: string; body: string[] } | null = null;

  function flush() {
    if (!current) return;
    const body = current.body.join('\n');
    const sm = body.match(STATUS_RE);
    const statusLine = sm?.[1]?.trim() ?? '';
    items.push({
      rank: current.rank,
      title: current.title,
      statusLine,
      statusKind: classifyStatus(statusLine),
    });
    current = null;
  }

  for (const line of lines) {
    const m = /^#(\d+)\s+—\s+(.+)$/.exec(line);
    if (m) {
      flush();
      current = { rank: Number(m[1]), title: m[2].trim(), body: [] };
      continue;
    }
    if (current) current.body.push(line);
  }
  flush();
  return items;
}

export function classifyStatus(statusLine: string): LedgerStatusKind | 'Unknown' {
  const s = statusLine.trim();
  if (/^Pending\b/i.test(s)) return 'Pending';
  if (/^In progress\b/i.test(s)) return 'In progress';
  if (/^Complete\b/i.test(s)) return 'Complete';
  if (/^Implemented\b/i.test(s)) return 'Implemented';
  if (/^Absorbed\b/i.test(s)) return 'Absorbed';
  if (/^Blocked\b/i.test(s)) return 'Blocked';
  return 'Unknown';
}

export function auditTop100Ledger(markdown: string): {
  ok: boolean;
  count: number;
  ranks: number[];
  missingRanks: number[];
  duplicateRanks: number[];
  unknownStatus: number[];
  items: LedgerItem[];
} {
  const items = parseTop100Ledger(markdown);
  const ranks = items.map((i) => i.rank);
  const seen = new Set<number>();
  const duplicateRanks: number[] = [];
  for (const r of ranks) {
    if (seen.has(r)) duplicateRanks.push(r);
    seen.add(r);
  }
  const missingRanks: number[] = [];
  for (let i = 1; i <= 100; i++) {
    if (!seen.has(i)) missingRanks.push(i);
  }
  const unknownStatus = items.filter((i) => i.statusKind === 'Unknown').map((i) => i.rank);
  const ok =
    items.length === 100 &&
    missingRanks.length === 0 &&
    duplicateRanks.length === 0 &&
    unknownStatus.length === 0;
  return {
    ok,
    count: items.length,
    ranks,
    missingRanks,
    duplicateRanks,
    unknownStatus,
    items,
  };
}

// keep re for potential tooling
void ITEM_RE;
