/**
 * Request correlation IDs + log redaction for ops without leaking secrets/PII.
 */
import { randomUUID } from 'node:crypto';

export const REQUEST_ID_HEADER = 'x-request-id';

const SENSITIVE_KEY =
  /(password|secret|token|authorization|cookie|email|e-mail|phone|ssn|jwt|api[_-]?key|gate)/i;

export function createRequestId(incoming?: string | null): string {
  const raw = String(incoming ?? '').trim();
  if (/^[a-zA-Z0-9_-]{8,64}$/.test(raw)) return raw;
  return randomUUID();
}

export function redactForLog(value: unknown, depth = 0): unknown {
  if (depth > 4) return '[truncated]';
  if (value == null) return value;
  if (typeof value === 'string') {
    if (value.length > 240) return `${value.slice(0, 240)}…`;
    // Never echo bearer-looking material
    if (/^bearer\s+/i.test(value)) return '[redacted]';
    return value;
  }
  if (typeof value === 'number' || typeof value === 'boolean') return value;
  if (Array.isArray(value)) return value.slice(0, 20).map((v) => redactForLog(v, depth + 1));
  if (typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>).slice(0, 40)) {
      if (SENSITIVE_KEY.test(k)) {
        out[k] = '[redacted]';
      } else {
        out[k] = redactForLog(v, depth + 1);
      }
    }
    return out;
  }
  return String(value);
}

export type SafeLogEvent = {
  level: 'info' | 'warn' | 'error';
  requestId: string;
  route?: string;
  code?: string;
  message: string;
  meta?: Record<string, unknown>;
};

/** Structured log line with redaction — never throw. */
export function logSafe(event: SafeLogEvent): void {
  try {
    const line = {
      ts: new Date().toISOString(),
      level: event.level,
      requestId: event.requestId,
      route: event.route,
      code: event.code,
      message: event.message.slice(0, 500),
      meta: event.meta ? redactForLog(event.meta) : undefined,
    };
    const payload = JSON.stringify(line);
    if (event.level === 'error') console.error(payload);
    else if (event.level === 'warn') console.warn(payload);
    else console.info(payload);
  } catch {
    // Logging must never break request handling.
  }
}
