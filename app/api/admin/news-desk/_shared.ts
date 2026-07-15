import { NextResponse } from 'next/server';
import { ZodError } from 'zod';
import type { User } from '@/lib/db/schema';
import { NewsroomError, type NewsroomActor } from '@/lib/newsroom-queries';

const MAX_JSON_BODY_BYTES = 64 * 1024;

export function newsroomActor(user: User): NewsroomActor {
  return { userId: user.id, label: user.name || user.email };
}

export function newsroomErrorResponse(error: unknown): NextResponse {
  if (error instanceof ZodError) {
    return NextResponse.json(
      {
        error: 'The newsroom request did not pass validation.',
        code: 'VALIDATION',
        issues: error.issues.map((issue) => ({
          path: issue.path.join('.'),
          message: issue.message,
        })),
      },
      { status: 400 },
    );
  }
  if (error instanceof NewsroomError) {
    return NextResponse.json(
      { error: error.message, code: error.code },
      { status: error.status },
    );
  }
  return NextResponse.json(
    { error: 'The live desk could not complete that request.', code: 'INTERNAL' },
    { status: 500 },
  );
}

export async function readJson(req: Request): Promise<unknown> {
  const contentType = req.headers.get('content-type')?.split(';', 1)[0]?.trim().toLowerCase();
  if (contentType !== 'application/json') {
    throw new NewsroomError('VALIDATION', 415, 'Content-Type must be application/json.');
  }

  const declaredLength = Number(req.headers.get('content-length') ?? 0);
  if (Number.isFinite(declaredLength) && declaredLength > MAX_JSON_BODY_BYTES) {
    throw new NewsroomError('VALIDATION', 413, 'JSON body exceeds the 64 KiB limit.');
  }

  const reader = req.body?.getReader();
  if (!reader) throw new NewsroomError('VALIDATION', 400, 'JSON body is required.');

  const chunks: Uint8Array[] = [];
  let received = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      received += value.byteLength;
      if (received > MAX_JSON_BODY_BYTES) {
        await reader.cancel();
        throw new NewsroomError('VALIDATION', 413, 'JSON body exceeds the 64 KiB limit.');
      }
      chunks.push(value);
    }

    const bytes = new Uint8Array(received);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.byteLength;
    }
    return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
  } catch (error) {
    if (error instanceof NewsroomError) throw error;
    throw new NewsroomError('VALIDATION', 400, 'Invalid JSON body.');
  }
}
