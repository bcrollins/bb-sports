#!/usr/bin/env node
/**
 * Generate a minimal CycloneDX-ish SBOM from package-lock.json + license policy.
 * Usage: node scripts/generate-sbom.mjs [--check]
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const lock = JSON.parse(readFileSync(join(root, 'package-lock.json'), 'utf8'));
const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));

const ALLOWED = new Set([
  'MIT',
  'ISC',
  'BSD-2-Clause',
  'BSD-3-Clause',
  '0BSD',
  'Apache-2.0',
  'BlueOak-1.0.0',
  'CC0-1.0',
  'CC-BY-4.0',
  'Unlicense',
  'Python-2.0',
  'MPL-2.0',
  'LGPL-3.0-or-later',
]);

function tokens(license) {
  if (!license) return [];
  if (typeof license === 'string') {
    return license.split(/\s+AND\s+|\s+OR\s+|\//i).map((s) => s.trim()).filter(Boolean);
  }
  return [];
}

const components = [];
const failures = [];
for (const [key, meta] of Object.entries(lock.packages || {})) {
  if (!key) continue; // root
  const name = key.replace(/^node_modules\//, '').split('/node_modules/').pop();
  const version = meta.version || '0.0.0';
  const license = meta.license || 'UNKNOWN';
  const toks = tokens(license);
  const ok = toks.length > 0 && toks.every((t) => ALLOWED.has(t));
  if (!ok) failures.push({ name, version, license });
  components.push({
    type: 'library',
    name,
    version,
    licenses: toks.map((t) => ({ license: { id: t } })),
    purl: `pkg:npm/${name}@${version}`,
  });
}

const bom = {
  bomFormat: 'CycloneDX',
  specVersion: '1.5',
  version: 1,
  metadata: {
    timestamp: new Date().toISOString(),
    component: {
      type: 'application',
      name: pkg.name,
      version: pkg.version,
    },
  },
  components,
};

const json = JSON.stringify(bom, null, 2);
const digest = createHash('sha256').update(json).digest('hex');
const outDir = join(root, 'docs/operations/sbom');
mkdirSync(outDir, { recursive: true });
const outPath = join(outDir, 'sbom-npm.json');
const checkOnly = process.argv.includes('--check');

if (checkOnly) {
  if (failures.length) {
    console.error(`License policy failed for ${failures.length} package(s):`);
    for (const f of failures.slice(0, 20)) {
      console.error(` - ${f.name}@${f.version}: ${f.license}`);
    }
    process.exit(1);
  }
  console.log(`SBOM license policy OK (${components.length} components)`);
  process.exit(0);
}

writeFileSync(outPath, json);
writeFileSync(join(outDir, 'sbom-npm.sha256'), `${digest}  sbom-npm.json\n`);
console.log(`Wrote ${outPath} (${components.length} components)`);
console.log(`sha256 ${digest}`);
if (failures.length) {
  console.error(`WARNING: ${failures.length} license policy failure(s)`);
  process.exit(1);
}
