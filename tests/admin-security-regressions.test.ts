import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const ROOT = process.cwd();

function source(relativePath: string): string {
  return fs.readFileSync(path.join(ROOT, relativePath), 'utf8');
}

function compact(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function versionAtLeast(installed: number[], floor: number[]): boolean {
  for (let index = 0; index < Math.max(installed.length, floor.length); index += 1) {
    const actual = installed[index] ?? 0;
    const required = floor[index] ?? 0;
    if (actual !== required) return actual > required;
  }
  return true;
}

function handlerSource(relativePath: string, method: string): string {
  const contents = source(relativePath);
  const marker = `export async function ${method}`;
  const start = contents.indexOf(marker);
  assert.notEqual(start, -1, `${relativePath} must export ${method}`);

  const nextHandler = contents.indexOf('export async function ', start + marker.length);
  return contents.slice(start, nextHandler === -1 ? undefined : nextHandler);
}

test('bootstrap removes or normalizes malformed legacy access_wall config rows', () => {
  const bootstrap = compact(source('lib/db/bootstrap.ts'));

  assert.match(
    bootstrap,
    /ACCESS_WALL_CONFIG_KEY|['"]access_wall['"]/,
    'bootstrap must identify the access_wall site_config row explicitly',
  );
  assert.match(
    bootstrap,
    /jsonb_typeof\s*\(\s*value\s*\)/i,
    'bootstrap must inspect the JSON type instead of casting a legacy string row as an object',
  );
  assert.match(
    bootstrap,
    /(?:DELETE\s+FROM|UPDATE)\s+site_config/i,
    'bootstrap must remove or normalize malformed access_wall rows before they are consumed',
  );
  assert.match(
    bootstrap,
    /jsonb_typeof\s*\(\s*value\s*\)[^;]{0,160}(?:object|string)/i,
    'the cleanup must distinguish object-shaped configuration from legacy string values',
  );
});

test('admin site configuration reads use an explicit allowlist and cannot serialize secrets', () => {
  const files = ['app/admin/site/page.tsx', 'app/api/admin/site/route.ts'];
  const allowlistContract =
    /(?:ALLOWED|PUBLIC|EDITABLE|ADMIN)_?SITE_?CONFIG_?KEYS|SITE_CONFIG_ALLOWLIST|allowedKeys|get(?:Public|Editable|Admin)SiteConfig/i;

  for (const file of files) {
    const contents = source(file);
    const normalized = compact(contents);

    assert.match(
      contents,
      allowlistContract,
      `${file} must use a named site_config allowlist contract`,
    );
    assert.doesNotMatch(
      contents,
      /passwordHash|password_hash|access_wall/i,
      `${file} must not select or serialize access-wall password material`,
    );

    for (const match of contents.matchAll(/sql`([^`]*)`/gs)) {
      const query = compact(match[1] ?? '');
      if (!/\bFROM\s+site_config\b/i.test(query)) continue;
      assert.match(
        query,
        /\bWHERE\b[\s\S]*\bkey\b/i,
        `${file} must never run an unrestricted site_config query`,
      );
    }

    assert.doesNotMatch(
      normalized,
      /\.select\s*\(\s*\)\s*\.from\s*\(\s*siteConfig\s*\)(?![^;]{0,180}\.where\s*\()/i,
      `${file} must not select every site_config row through Drizzle`,
    );
  }
});

test('every protected admin page invokes the centralized active-session guard', () => {
  const adminRoot = path.join(ROOT, 'app', 'admin');
  const pages: string[] = [];

  fs.readdirSync(adminRoot, { recursive: true, withFileTypes: true }).forEach((entry) => {
    if (!entry.isFile() || entry.name !== 'page.tsx') return;
    const relativeParent = entry.parentPath.slice(ROOT.length + 1);
    const relativePath = path.join(relativeParent, entry.name);
    if (relativePath === path.join('app', 'admin', 'login', 'page.tsx')) return;
    pages.push(relativePath);
  });

  assert.ok(pages.length > 0, 'expected protected admin pages to audit');
  for (const page of pages.sort()) {
    assert.match(
      source(page),
      /\brequireAdminPage\s*\(/,
      `${page} must enforce active auth itself instead of relying on middleware or layout rendering`,
    );
  }
});

test('every sensitive admin API handler authenticates before reading request or protected data', () => {
  const contracts: Array<{
    file: string;
    method: string;
    firstSensitiveOperation: RegExp;
  }> = [
    { file: 'app/api/admin/access-wall/route.ts', method: 'GET', firstSensitiveOperation: /getConfig\s*</ },
    { file: 'app/api/admin/access-wall/route.ts', method: 'PUT', firstSensitiveOperation: /req\.json\s*\(/ },
    { file: 'app/api/admin/articles/route.ts', method: 'GET', firstSensitiveOperation: /getAllArticles\s*\(/ },
    { file: 'app/api/admin/articles/route.ts', method: 'POST', firstSensitiveOperation: /readBoundedJson\s*\(/ },
    { file: 'app/api/admin/articles/[id]/route.ts', method: 'GET', firstSensitiveOperation: /getArticleById\s*\(/ },
    { file: 'app/api/admin/articles/[id]/route.ts', method: 'PUT', firstSensitiveOperation: /readBoundedJson\s*\(/ },
    { file: 'app/api/admin/articles/[id]/route.ts', method: 'DELETE', firstSensitiveOperation: /deleteVirginArticleDraft\s*\(/ },
    { file: 'app/api/admin/comments/[id]/route.ts', method: 'PUT', firstSensitiveOperation: /req\.json\s*\(/ },
    { file: 'app/api/admin/media/route.ts', method: 'GET', firstSensitiveOperation: /getMediaAssets\s*\(/ },
    { file: 'app/api/admin/media/route.ts', method: 'POST', firstSensitiveOperation: /req\.json\s*\(/ },
    { file: 'app/api/admin/media/[id]/route.ts', method: 'PUT', firstSensitiveOperation: /req\.json\s*\(/ },
    { file: 'app/api/admin/media/[id]/poll/route.ts', method: 'POST', firstSensitiveOperation: /getMediaAssetById\s*\(/ },
    {
      file: 'app/api/admin/preview/route.ts',
      method: 'POST',
      firstSensitiveOperation: /parseMarkdownPreviewRequest\s*\(/,
    },
    { file: 'app/api/admin/site/route.ts', method: 'GET', firstSensitiveOperation: /getEditableSiteConfig\s*\(/ },
    { file: 'app/api/admin/site/route.ts', method: 'PUT', firstSensitiveOperation: /req\.json\s*\(/ },
    { file: 'app/api/admin/sessions/revoke/route.ts', method: 'POST', firstSensitiveOperation: /req\.json\s*\(/ },
    { file: 'app/api/admin/citations/probe/route.ts', method: 'POST', firstSensitiveOperation: /req\.json\s*\(/ },
  ];

  for (const contract of contracts) {
    const handler = handlerSource(contract.file, contract.method);
    const authAt = handler.search(/\bgetCurrentUser\s*\(/);
    const unauthorizedAt = handler.search(/\bUnauthorized\b/);
    const sensitiveAt = handler.search(contract.firstSensitiveOperation);
    const label = `${contract.method} ${contract.file}`;

    assert.notEqual(authAt, -1, `${label} must call the DB-authoritative active-session helper`);
    assert.notEqual(unauthorizedAt, -1, `${label} must reject missing or revoked sessions`);
    assert.notEqual(sensitiveAt, -1, `${label} sensitive operation contract is stale`);
    assert.ok(authAt < sensitiveAt, `${label} must authenticate before reading request or protected data`);
    assert.ok(unauthorizedAt < sensitiveAt, `${label} must return 401 before reading request or protected data`);
  }
});

test('getCurrentUser treats the database session and current admin role as authoritative', () => {
  const auth = source('lib/auth.ts');
  const currentUser = auth.slice(
    auth.indexOf('export async function getCurrentUser'),
    auth.indexOf('/** Verify a password', auth.indexOf('export async function getCurrentUser')),
  );

  assert.match(currentUser, /\bsessions\b/, 'getCurrentUser must query the sessions table');
  assert.match(currentUser, /sessions\.jwtId[\s\S]*session\.jti|session\.jti[\s\S]*sessions\.jwtId/);
  assert.match(currentUser, /sessions\.userId[\s\S]*session\.sub|session\.sub[\s\S]*sessions\.userId/);
  assert.match(currentUser, /sessions\.revokedAt/);
  assert.match(currentUser, /sessions\.expiresAt/);
  assert.match(currentUser, /(?:isNull\s*\(\s*sessions\.revokedAt|revokedAt[\s\S]*null)/);
  assert.match(currentUser, /(?:gt\s*\(\s*sessions\.expiresAt|expiresAt[\s\S]*(?:Date|now\s*\())/);
  assert.match(currentUser, /\brole\b/, 'getCurrentUser must authorize using the current DB user role');
  assert.match(
    auth,
    /(?:super_admin[\s\S]*admin|admin[\s\S]*super_admin)/,
    'auth must define the accepted newsroom roles explicitly',
  );
});

test('unapproved media file access uses active DB-backed authentication', () => {
  const mediaFile = source('app/api/media/assets/[id]/file/route.ts');

  assert.match(mediaFile, /\bgetCurrentUser\b/);
  assert.match(mediaFile, /\bgetCurrentUser\s*\(/);
  assert.doesNotMatch(
    mediaFile,
    /\bgetSession\b/,
    'signature-only JWT verification must not reveal unapproved media after session revocation',
  );
});

test('the patched Next.js floor and an npm audit release gate are enforced', () => {
  const pkg = JSON.parse(source('package.json')) as {
    dependencies?: Record<string, string>;
    scripts?: Record<string, string>;
  };
  const nextSpec = pkg.dependencies?.next ?? '';
  const match = nextSpec.match(/(\d+)\.(\d+)\.(\d+)/);
  assert.ok(match, 'Next.js must be pinned to a parseable patched version');
  const installed = match.slice(1).map(Number);
  const floor = [15, 5, 18];
  assert.equal(
    versionAtLeast(installed, floor),
    true,
    `Next.js ${nextSpec} is below the patched 15.5.18 floor`,
  );

  const scripts = pkg.scripts ?? {};
  const auditScript = Object.entries(scripts).find(
    ([name, command]) => /audit|security/i.test(name) && /\bnpm audit\b/.test(command),
  );
  assert.ok(auditScript, 'package scripts must expose an npm audit security gate');

  const check = scripts.check ?? '';
  const [auditName] = auditScript;
  assert.ok(
    check.includes('npm audit') || check.includes(`npm run ${auditName}`),
    `npm run check must execute the ${auditName} security gate`,
  );
});
