#!/usr/bin/env node

import { access, cp, mkdir, rm } from 'node:fs/promises';
import { join } from 'node:path';

const root = process.cwd();
const standaloneDir = join(root, '.next', 'standalone');
const standaloneServer = join(standaloneDir, 'server.js');

await requirePath(standaloneServer, 'Run `npm run build` before `npm run start`.');
await copyFresh(join(root, '.next', 'static'), join(standaloneDir, '.next', 'static'));
await copyIfPresent(join(root, 'public'), join(standaloneDir, 'public'));
await copyIfPresent(join(root, 'content'), join(standaloneDir, 'content'));

async function requirePath(path, message) {
  try {
    await access(path);
  } catch {
    console.error(message);
    process.exitCode = 1;
    throw new Error(message);
  }
}

async function copyFresh(from, to) {
  await requirePath(from, `Missing required standalone asset source: ${from}`);
  await rm(to, { recursive: true, force: true });
  await mkdir(join(to, '..'), { recursive: true });
  await cp(from, to, { recursive: true });
}

async function copyIfPresent(from, to) {
  try {
    await access(from);
  } catch {
    return;
  }
  await rm(to, { recursive: true, force: true });
  await mkdir(join(to, '..'), { recursive: true });
  await cp(from, to, { recursive: true });
}
