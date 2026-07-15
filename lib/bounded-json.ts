/**
 * Reads an application/json request without allowing an unbounded body to be
 * buffered by the framework. The stream limit remains authoritative when a
 * caller omits or lies about Content-Length.
 */

export const DEFAULT_MAX_JSON_BODY_BYTES = 64 * 1024;

export type BoundedJsonErrorCode =
  | 'INVALID_CONTENT_TYPE'
  | 'INVALID_JSON'
  | 'JSON_BODY_REQUIRED'
  | 'JSON_BODY_TOO_LARGE';

export class BoundedJsonError extends Error {
  constructor(
    readonly code: BoundedJsonErrorCode,
    readonly status: 400 | 413 | 415,
    message: string,
  ) {
    super(message);
    this.name = 'BoundedJsonError';
  }
}

function contentLength(request: Request): number | null {
  const raw = request.headers.get('content-length');
  if (raw === null) return null;
  if (!/^\d+$/.test(raw.trim())) return null;
  const parsed = Number(raw);
  return Number.isSafeInteger(parsed) ? parsed : null;
}

export async function readBoundedJson(
  request: Request,
  maximumBytes = DEFAULT_MAX_JSON_BODY_BYTES,
): Promise<unknown> {
  if (!Number.isSafeInteger(maximumBytes) || maximumBytes < 1) {
    throw new TypeError('maximumBytes must be a positive safe integer.');
  }

  const mediaType = request.headers
    .get('content-type')
    ?.split(';', 1)[0]
    ?.trim()
    .toLowerCase();
  if (mediaType !== 'application/json') {
    throw new BoundedJsonError(
      'INVALID_CONTENT_TYPE',
      415,
      'Content-Type must be application/json.',
    );
  }

  const declaredBytes = contentLength(request);
  if (declaredBytes !== null && declaredBytes > maximumBytes) {
    throw new BoundedJsonError(
      'JSON_BODY_TOO_LARGE',
      413,
      `JSON body exceeds the ${maximumBytes}-byte limit.`,
    );
  }

  const reader = request.body?.getReader();
  if (!reader) {
    throw new BoundedJsonError('JSON_BODY_REQUIRED', 400, 'JSON body is required.');
  }

  const chunks: Uint8Array[] = [];
  let receivedBytes = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      receivedBytes += value.byteLength;
      if (receivedBytes > maximumBytes) {
        await reader.cancel();
        throw new BoundedJsonError(
          'JSON_BODY_TOO_LARGE',
          413,
          `JSON body exceeds the ${maximumBytes}-byte limit.`,
        );
      }
      chunks.push(value);
    }

    if (receivedBytes === 0) {
      throw new BoundedJsonError('JSON_BODY_REQUIRED', 400, 'JSON body is required.');
    }

    const bytes = new Uint8Array(receivedBytes);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.byteLength;
    }

    const text = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
    return JSON.parse(text) as unknown;
  } catch (error) {
    if (error instanceof BoundedJsonError) throw error;
    throw new BoundedJsonError('INVALID_JSON', 400, 'Invalid JSON body.');
  } finally {
    reader.releaseLock();
  }
}
