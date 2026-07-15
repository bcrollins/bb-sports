import assert from 'node:assert/strict';
import test from 'node:test';
import { z } from 'zod';
import {
  newsroomErrorResponse,
  readJson,
} from '../app/api/admin/news-desk/_shared';
import { NewsroomError } from '../lib/newsroom-queries';

test('newsroom JSON reader accepts a bounded application/json request', async () => {
  const request = new Request('https://example.test/api/admin/news-desk/signals', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify({ headline: 'A verified roster move' }),
  });

  assert.deepEqual(await readJson(request), { headline: 'A verified roster move' });
});

test('newsroom JSON reader rejects wrong media types, invalid JSON, and oversized bodies', async () => {
  const wrongType = new Request('https://example.test', {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain' },
    body: '{}',
  });
  await assert.rejects(
    () => readJson(wrongType),
    (error: unknown) => error instanceof NewsroomError && error.status === 415,
  );

  const invalid = new Request('https://example.test', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: '{',
  });
  await assert.rejects(
    () => readJson(invalid),
    (error: unknown) => error instanceof NewsroomError && error.status === 400,
  );

  const oversized = new Request('https://example.test', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ value: 'x'.repeat(70 * 1024) }),
  });
  await assert.rejects(
    () => readJson(oversized),
    (error: unknown) => error instanceof NewsroomError && error.status === 413,
  );
});

test('newsroom validation errors are safe structured 400 responses', async () => {
  const schema = z.object({ expectedVersion: z.number().int().positive() });
  const parsed = schema.safeParse({ expectedVersion: 0 });
  assert.equal(parsed.success, false);
  if (parsed.success) return;

  const response = newsroomErrorResponse(parsed.error);
  assert.equal(response.status, 400);
  const body = await response.json() as {
    error: string;
    code: string;
    issues: Array<{ path: string; message: string }>;
  };
  assert.equal(body.error, 'The newsroom request did not pass validation.');
  assert.equal(body.code, 'VALIDATION');
  assert.equal(body.issues.length, 1);
  assert.equal(body.issues[0]?.path, 'expectedVersion');
  assert.ok(body.issues[0]?.message);
});
