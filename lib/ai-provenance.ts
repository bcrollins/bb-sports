/**
 * AI-generation provenance without secrets or raw PII.
 */

import { createHash } from 'node:crypto';

export type AiProvenanceRecord = {
  provider: string;
  model: string;
  kind: 'image' | 'video' | 'text' | 'other';
  /** SHA-256 of normalized prompt/brief — never the raw secret-bearing payload. */
  promptDigest: string;
  placement?: string;
  sport?: string;
  /** ISO timestamp of generation request. */
  generatedAt: string;
  /** Operator / actor id if known (uuid only). */
  actorId?: string;
  requestId?: string;
  /** Explicit flag — secrets must never appear in this object. */
  secretsExcluded: true;
};

// Word-boundary patterns — avoid matching field names like secretsExcluded.
const SECRETISH =
  /(?:\bapi[_-]?key\b|\bpassword\b|\bbearer\s+[a-z0-9._-]+|\bsk-[a-z0-9]{10,}|\bwhsec_[a-z0-9]+)/i;

export function digestPrompt(input: string): string {
  const normalized = String(input ?? '')
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase();
  return createHash('sha256').update(normalized).digest('hex');
}

export function assertNoSecretsInProvenanceFields(values: string[]): void {
  for (const v of values) {
    if (SECRETISH.test(v)) {
      throw new Error('Provenance fields must not contain secret-like material');
    }
  }
}

export function buildAiProvenance(input: {
  provider: string;
  model: string;
  kind: AiProvenanceRecord['kind'];
  promptOrBrief: string;
  placement?: string;
  sport?: string;
  actorId?: string;
  requestId?: string;
  generatedAt?: string;
}): AiProvenanceRecord {
  const provider = String(input.provider ?? '').trim().slice(0, 40) || 'unknown';
  const model = String(input.model ?? '').trim().slice(0, 80) || 'unknown';
  assertNoSecretsInProvenanceFields([provider, model, input.promptOrBrief]);
  return {
    provider,
    model,
    kind: input.kind,
    promptDigest: digestPrompt(input.promptOrBrief),
    placement: input.placement?.trim().slice(0, 40),
    sport: input.sport?.trim().slice(0, 40),
    generatedAt: input.generatedAt ?? new Date().toISOString(),
    actorId: input.actorId?.trim().slice(0, 64),
    requestId: input.requestId?.trim().slice(0, 160),
    secretsExcluded: true,
  };
}

export function provenanceIsSafe(record: unknown): boolean {
  if (!record || typeof record !== 'object') return false;
  const r = record as Record<string, unknown>;
  if (r.secretsExcluded !== true) return false;
  if (typeof r.promptDigest !== 'string' || !/^[a-f0-9]{64}$/.test(r.promptDigest)) return false;
  const blob = JSON.stringify(r);
  return !SECRETISH.test(blob);
}
