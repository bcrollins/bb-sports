/**
 * Immutable revision history helpers — list/diff/restore never mutates past rows.
 */

export type RevisionSnapshotFields = {
  slug?: string;
  title?: string;
  dek?: string;
  body?: string;
  sport?: string;
  hero?: string;
  heroAlt?: string;
  heroCredit?: string;
  authorName?: string;
  aiAssisted?: boolean;
  bradsTake?: string;
};

export type RevisionFieldDiff = {
  field: string;
  before: string;
  after: string;
  changed: boolean;
};

const DIFF_FIELDS = [
  'slug',
  'title',
  'dek',
  'body',
  'sport',
  'hero',
  'heroAlt',
  'heroCredit',
  'authorName',
  'aiAssisted',
  'bradsTake',
] as const;

export function normalizeSnapshotField(value: unknown): string {
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  if (value == null) return '';
  return String(value);
}

export function diffRevisionSnapshots(
  before: RevisionSnapshotFields | null | undefined,
  after: RevisionSnapshotFields | null | undefined,
): RevisionFieldDiff[] {
  const a = before ?? {};
  const b = after ?? {};
  return DIFF_FIELDS.map((field) => {
    const left = normalizeSnapshotField((a as Record<string, unknown>)[field]);
    const right = normalizeSnapshotField((b as Record<string, unknown>)[field]);
    return {
      field,
      before: left,
      after: right,
      changed: left !== right,
    };
  });
}

export function changedRevisionFields(
  before: RevisionSnapshotFields | null | undefined,
  after: RevisionSnapshotFields | null | undefined,
): RevisionFieldDiff[] {
  return diffRevisionSnapshots(before, after).filter((d) => d.changed);
}

/** Summarize for admin list rows. */
export function summarizeRevisionDiff(
  before: RevisionSnapshotFields | null | undefined,
  after: RevisionSnapshotFields | null | undefined,
): string {
  const changed = changedRevisionFields(before, after).map((d) => d.field);
  if (changed.length === 0) return 'no field changes';
  return changed.join(', ');
}
