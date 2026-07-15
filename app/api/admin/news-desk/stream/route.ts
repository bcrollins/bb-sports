import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { listNewsroomActivity } from '@/lib/newsroom-queries';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const POLL_MS = 2_000;
const HEARTBEAT_MS = 15_000;
const MAX_CONNECTION_MS = 45_000;

function safeSequence(value: string | null): number {
  const parsed = Number(value ?? 0);
  return Number.isSafeInteger(parsed) && parsed >= 0 ? parsed : 0;
}

export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (process.env.BBSPORTS_REALTIME_NEWSROOM_ENABLED === 'false') {
    return NextResponse.json({ error: 'Live newsroom alerts are temporarily disabled.' }, { status: 503 });
  }

  const encoder = new TextEncoder();
  let cursor = Math.max(
    safeSequence(req.nextUrl.searchParams.get('after')),
    safeSequence(req.headers.get('last-event-id')),
  );
  let interval: ReturnType<typeof setInterval> | undefined;
  let closed = false;
  let busy = false;
  let lastHeartbeat = 0;
  const openedAt = Date.now();

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const close = () => {
        if (closed) return;
        closed = true;
        if (interval) clearInterval(interval);
        try {
          controller.close();
        } catch {
          // Connection already closed by the runtime.
        }
      };

      const tick = async () => {
        if (closed || busy) return;
        if (req.signal.aborted || Date.now() - openedAt >= MAX_CONNECTION_MS) {
          close();
          return;
        }
        busy = true;
        try {
          const activity = await listNewsroomActivity(cursor, 100);
          for (const item of activity) {
            cursor = Math.max(cursor, item.sequence);
            controller.enqueue(
              encoder.encode(
                `id: ${item.sequence}\nevent: ${item.action}\ndata: ${JSON.stringify(item)}\n\n`,
              ),
            );
          }
          if (Date.now() - lastHeartbeat >= HEARTBEAT_MS) {
            lastHeartbeat = Date.now();
            controller.enqueue(encoder.encode(`: heartbeat ${lastHeartbeat}\n\n`));
          }
        } catch {
          controller.enqueue(
            encoder.encode('event: stream_error\ndata: {"retry":true}\n\n'),
          );
          close();
        } finally {
          busy = false;
        }
      };

      req.signal.addEventListener('abort', close, { once: true });
      controller.enqueue(encoder.encode('retry: 3000\n\n'));
      void tick();
      interval = setInterval(() => void tick(), POLL_MS);
    },
    cancel() {
      closed = true;
      if (interval) clearInterval(interval);
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'private, no-cache, no-store, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}
