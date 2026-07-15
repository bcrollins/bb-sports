import type { NextRequest } from 'next/server';
import { createRequestId, REQUEST_ID_HEADER } from '@/lib/request-id';

export function requestMeta(req: NextRequest): {
  ip: string;
  userAgent: string | null;
  requestId: string;
} {
  return {
    ip:
      req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      req.headers.get('x-real-ip') ||
      'unknown',
    userAgent: req.headers.get('user-agent'),
    requestId: createRequestId(req.headers.get(REQUEST_ID_HEADER) || req.headers.get('x-correlation-id')),
  };
}
