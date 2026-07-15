/**
 * BB Sports newsroom worker entrypoint.
 *
 * Always-on process for lease ownership, health, and (later) provider
 * transports. Does not serve the public site and does not open provider
 * connections while static preflight keeps connectionAllowed=false.
 *
 * Start (production image):
 *   node ops/newsroom-worker.mjs
 *
 * Environment:
 *   DATABASE_URL (required)
 *   WORKER_HEALTH_PORT (default 3101)
 *   BBSPORTS_NEWSROOM_WORKER_ENABLED=true to run the control loop
 *     (otherwise the process serves health only and stays idle)
 */

import http from 'node:http';
import { createNewsroomWorker } from '../lib/newsroom-worker/loop';
import { buildWorkerOwnerId } from '../lib/newsroom-worker/runtime';

const healthPort = Number(process.env.WORKER_HEALTH_PORT || 3101);
const workerEnabled = process.env.BBSPORTS_NEWSROOM_WORKER_ENABLED === 'true';
const ownerId = buildWorkerOwnerId(process.env);

const worker = createNewsroomWorker({
  ownerId,
  onStatus: (snapshot) => {
    if (snapshot.tick % 15 === 0 || snapshot.mode !== 'idle') {
      console.log(
        JSON.stringify({
          msg: 'newsroom_worker_status',
          mode: snapshot.mode,
          ready: snapshot.ready,
          activelyIngesting: snapshot.activelyIngesting,
          providers: snapshot.providers.length,
          tick: snapshot.tick,
        }),
      );
    }
  },
});

const server = http.createServer((req, res) => {
  const url = req.url ?? '/';
  const health = worker.getHealth();
  if (url.startsWith('/health') || url.startsWith('/ready') || url === '/') {
    const body = JSON.stringify(health);
    const code = health.ready || health.status === 'draining' ? 200 : 503;
    res.writeHead(code, {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
    });
    res.end(body);
    return;
  }
  res.writeHead(404, { 'content-type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify({ error: 'not_found' }));
});

async function shutdown(signal: string): Promise<void> {
  console.log(JSON.stringify({ msg: 'newsroom_worker_shutdown', signal }));
  await worker.stop();
  await new Promise<void>((resolve) => server.close(() => resolve()));
  process.exit(0);
}

process.on('SIGTERM', () => {
  void shutdown('SIGTERM');
});
process.on('SIGINT', () => {
  void shutdown('SIGINT');
});

server.listen(healthPort, '0.0.0.0', () => {
  console.log(
    JSON.stringify({
      msg: 'newsroom_worker_listen',
      healthPort,
      ownerId,
      workerEnabled,
      activelyIngesting: false,
      note: 'Provider transports remain default-off; this process does not claim live monitoring.',
    }),
  );
});

if (workerEnabled) {
  worker.start().catch((error) => {
    console.error(
      JSON.stringify({
        msg: 'newsroom_worker_fatal',
        error: error instanceof Error ? error.message : 'unknown',
      }),
    );
    process.exitCode = 1;
  });
} else {
  console.log(
    JSON.stringify({
      msg: 'newsroom_worker_idle_health_only',
      reason: 'BBSPORTS_NEWSROOM_WORKER_ENABLED is not true',
    }),
  );
}
