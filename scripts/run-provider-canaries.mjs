#!/usr/bin/env node
/**
 * CLI dry-run canaries (no network commercial transport).
 * Usage: node scripts/run-provider-canaries.mjs
 */
import { createRequire } from 'node:module';

// Prefer compiled-free path: dynamic import of TS via tsx when available.
async function main() {
  let runAll;
  try {
    ({ runAllProviderCanaries: runAll } = await import('../lib/provider-canary.ts'));
  } catch {
    console.error('Run with: npx tsx scripts/run-provider-canaries.mjs');
    process.exit(1);
  }
  const results = await runAll({ liveResend: false });
  for (const r of results) {
    const mark = r.ok ? 'PASS' : 'FAIL';
    console.log(`${mark} ${r.provider} [${r.mode}] ${r.detail}`);
    if (r.blockers.length) console.log(`     blockers: ${r.blockers.join(', ')}`);
  }
  const ok = results.every((r) => r.ok);
  process.exit(ok ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

void createRequire;
