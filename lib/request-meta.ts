import type { NextRequest } from 'next/server';

export function requestMeta(req: NextRequest): { ip: string; userAgent: string | null } {
  return {
    ip:
      req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      req.headers.get('x-real-ip') ||
      'unknown',
    userAgent: req.headers.get('user-agent'),
  };
}
