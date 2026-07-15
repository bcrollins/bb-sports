import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import {
  deriveDisposableDatabaseUrl,
  isDisposablePublicationDatabaseName,
  PUBLICATION_VERIFY_DATABASE_PREFIX,
} from '../scripts/verify-publication-postgres';

const parent = readFileSync(
  new URL('../scripts/verify-publication-postgres.ts', import.meta.url),
  'utf8',
);
const child = readFileSync(
  new URL('../scripts/verify-publication-postgres-child.ts', import.meta.url),
  'utf8',
);
const dockerfile = readFileSync(new URL('../Dockerfile', import.meta.url), 'utf8');
const gitignore = readFileSync(new URL('../.gitignore', import.meta.url), 'utf8');
const packageJson = JSON.parse(
  readFileSync(new URL('../package.json', import.meta.url), 'utf8'),
) as {
  scripts?: Record<string, string>;
  devDependencies?: Record<string, string>;
};

test('temporary database URL derivation changes only database identity and adds an ops label', () => {
  const name = `${PUBLICATION_VERIFY_DATABASE_PREFIX}unit_123`;
  assert.equal(isDisposablePublicationDatabaseName(name), true);
  assert.equal(isDisposablePublicationDatabaseName('railway'), false);
  assert.equal(isDisposablePublicationDatabaseName(`${name}-unsafe`), false);

  const derived = new URL(
    deriveDisposableDatabaseUrl(
      'postgresql://operator:secret@postgres.example.test:5432/production?sslmode=require',
      name,
    ),
  );
  assert.equal(derived.protocol, 'postgresql:');
  assert.equal(derived.username, 'operator');
  assert.equal(derived.password, 'secret');
  assert.equal(derived.host, 'postgres.example.test:5432');
  assert.equal(derived.pathname, `/${name}`);
  assert.equal(derived.searchParams.get('sslmode'), 'require');
  assert.equal(derived.searchParams.get('application_name'), 'bbsports-publication-verify');
});

test('parent verifier owns database lifecycle and cannot initialize the application client', () => {
  assert.doesNotMatch(parent, /from ['"]\.\.\/lib\//);
  assert.match(parent, /CREATE DATABASE \$\{admin\(databaseName\)\}/);
  assert.match(parent, /pg_terminate_backend\(pid\)/);
  assert.match(parent, /ALTER DATABASE \$\{admin\(databaseName\)\} ALLOW_CONNECTIONS false/);
  assert.match(parent, /DROP DATABASE IF EXISTS \$\{admin\(databaseName\)\} WITH \(FORCE\)/);
  assert.match(parent, /if \(!isDisposablePublicationDatabaseName\(databaseName\)\)/);
  assert.match(parent, /finally \{[\s\S]*await cleanup\(\)/);
  assert.match(parent, /process\.once\('SIGINT'/);
  assert.match(parent, /process\.once\('SIGTERM'/);
  assert.match(
    parent,
    /await runChild\('bootstrap'\)[\s\S]*await runRollingMigrationWriteProof\(\)/,
  );
  assert.match(parent, /const \{ completion \} = startChild\('verify'\)/);
  assert.match(parent, /old-style publish blocked during migration/);
  assert.match(parent, /old-style unpublish blocked during migration/);
  assert.match(parent, /writer waiting before atomic guard commit is rejected/);
  assert.match(parent, /AccessExclusiveLock/);
  assert.match(parent, /Pre-existing writer did not wait behind the atomic article lock/);
  assert.match(parent, /constraintRows\[0\]\?\.convalidated === false/);
  assert.match(parent, /TEMPLATE template0/);
  assert.match(parent, /mkdtemp\(/);
  assert.match(parent, /mkdir\(path\.join\(workerCwd, 'content', 'articles'\)/);
  assert.match(parent, /import \{[\s\S]*writeFile[\s\S]*\} from 'node:fs\/promises'/);
  assert.match(
    parent,
    /rolling-legacy-live-\$\{suffix\}[\s\S]*hero_alt[\s\S]*hero_credit[\s\S]*await writeFile\(/,
  );
  assert.match(
    parent,
    /await writeFile\([\s\S]*slug: \$\{legacySlug\}[\s\S]*hero: \$\{legacyHero\}[\s\S]*heroAlt:[\s\S]*heroCredit:[\s\S]*startChild\('verify'\)/,
  );
  assert.doesNotMatch(parent, /\.\.\.process\.env/);
  assert.doesNotMatch(parent, /console\.(?:log|info|error)\([^\n]*(?:DATABASE_URL|disposableUrl)/);
});

test('child verifier runs actual bootstrap and publication persistence boundaries', () => {
  assert.match(child, /from ['"]\.\.\/lib\/db\/bootstrap['"]/);
  assert.match(child, /from ['"]\.\.\/lib\/article-publication-queries['"]/);
  assert.match(child, /from ['"]\.\.\/lib\/queries['"]/);
  assert.match(child, /databaseName\.startsWith\(PUBLICATION_VERIFY_DATABASE_PREFIX\)/);
  assert.match(child, /BBS_PUBLICATION_VERIFY_TOKEN/);
  assert.match(child, /await ensureBootstrapped\(\)/);
  for (const operation of [
    'createArticleRevision',
    'publishArticleRevision',
    'updateArticle',
    'unpublishArticle',
    'deleteVirginArticleDraft',
  ]) {
    assert.match(child, new RegExp(`${operation}\\(`));
  }
  assert.match(child, /stale article edit CAS is rejected/);
  assert.match(child, /published working-copy edit is blocked before activation/);
  assert.match(child, /'RELEASE_CONVERGENCE'/);
  assert.match(child, /blockedEditToken[\s\S]*publication_activation_contract[\s\S]*freshEditToken/);
  assert.match(child, /set_config\([\s\S]*'bbsports\.publication_activation_contract'[\s\S]*'v1'/);
  assert.match(child, /\.update\(publicationRuntimeControls\)/);
  assert.doesNotMatch(child, /publication-working-copy-control/);
  assert.match(child, /current super-admin role revocation/);
  assert.match(child, /article revision UPDATE trigger/);
  assert.match(child, /publication event DELETE trigger/);
  assert.match(child, /news-event article UPDATE trigger/);
  assert.match(child, /article_publication_events_revision_integrity/);
  assert.match(child, /articles_published_snapshot_complete/);
  assert.match(child, /articles_published_revision_same_article/);
  assert.match(child, /action, 'legacy_backfill'/);
  assert.match(child, /Pointerless legacy live article/);
  assert.match(child, /An old replica must not unpublish this row before backfill finishes\./);
  assert.match(child, /publication-verifier-legacy-hero\.png/);
  assert.match(child, /Legacy backfill changed reader-visible fields beyond hero metadata\./);
  assert.match(child, /PASS legacy metadata completion preserves and immutably snapshots the live story/);
  assert.match(child, /finally \{[\s\S]*await closeDatabaseClient\(\)/);
});

test('Docker runtime contains the self-contained verifier bundle and package commands', () => {
  assert.equal(packageJson.devDependencies?.esbuild, '0.28.1');
  assert.match(packageJson.scripts?.['ops:bundle:publication-db'] ?? '', /--bundle/);
  assert.match(packageJson.scripts?.['ops:bundle:publication-db'] ?? '', /--platform=node/);
  assert.match(packageJson.scripts?.['ops:bundle:publication-db'] ?? '', /createRequire/);
  assert.match(
    packageJson.scripts?.['ops:bundle:publication-db'] ?? '',
    /publication-working-copy-control\.ts/,
  );
  assert.match(
    packageJson.scripts?.['ops:publication-control'] ?? '',
    /publication-working-copy-control\.mjs/,
  );
  assert.match(
    packageJson.scripts?.['verify:publication-postgres'] ?? '',
    /node \.ops\/verify-publication-postgres\.mjs/,
  );
  assert.match(dockerfile, /RUN npm run ops:bundle:publication-db/);
  assert.match(dockerfile, /COPY --from=builder[^\n]*\/app\/\.ops \.\/ops/);
  assert.match(gitignore, /^\.ops\/$/m);
});
