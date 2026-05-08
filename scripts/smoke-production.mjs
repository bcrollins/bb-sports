#!/usr/bin/env node

const DEFAULT_BASE_URL = 'https://web-production-c65d6.up.railway.app';
const SEARCH_QUERY = process.env.BB_SMOKE_SEARCH_QUERY || 'Bears';
const REQUIRED_SEARCH_TEXT =
  process.env.BB_SMOKE_REQUIRED_TEXT || 'Why the Bears finally have a real shot';
const ARTICLE_SLUG = process.env.BB_SMOKE_ARTICLE_SLUG || 'why-the-bears-finally-have-a-real-shot';
const ARTICLE_TITLE =
  process.env.BB_SMOKE_ARTICLE_TITLE || 'Why the Bears finally have a real shot';
const GATE_COOKIE = process.env.BB_PRODUCTION_GATE_COOKIE || 'bb_gate=1';
const TIMEOUT_MS = Number(process.env.BB_SMOKE_TIMEOUT_MS || 12_000);

const config = {
  baseUrl: normalizeBaseUrl(
    argValue('--base-url') || process.env.PRODUCTION_BASE_URL || DEFAULT_BASE_URL,
  ),
  expectedCommit: argValue('--expected-commit') || process.env.EXPECTED_COMMIT || '',
};

const results = [];

async function main() {
  console.log(`BB Sports production smoke: ${config.baseUrl}`);
  if (config.expectedCommit) console.log(`Expected commit: ${config.expectedCommit}`);

  await runCheck('health endpoint', checkHealth);
  await runCheck('soft-launch gate redirect', checkGateRedirect);
  await runCheck('gated search page', checkGatedSearchPage);
  await runCheck('search API JSON', checkSearchApi);
  await runCheck('article page render', checkArticlePage);
  await runCheck('comments read path', checkCommentsReadPath);
  await runCheck('sitemap editorial URLs', checkSitemap);
  await runCheck('analytics contract GET', checkAnalyticsGet);
  await runCheck('analytics validation guard', checkAnalyticsValidationGuard);
  await runCheck('analytics write path', checkAnalyticsWritePath);

  const failed = results.filter((result) => !result.ok);
  if (failed.length > 0) {
    console.error(`\nProduction smoke failed: ${failed.length}/${results.length} checks failed.`);
    process.exitCode = 1;
    return;
  }

  console.log(`\nProduction smoke passed: ${results.length}/${results.length} checks.`);
}

async function runCheck(name, fn) {
  try {
    const detail = await fn();
    results.push({ name, ok: true });
    console.log(`PASS ${name}${detail ? ` - ${detail}` : ''}`);
  } catch (error) {
    results.push({ name, ok: false });
    console.error(`FAIL ${name} - ${error instanceof Error ? error.message : String(error)}`);
  }
}

async function checkHealth() {
  const response = await request('/api/health');
  assertStatus(response, 200, '/api/health');
  const body = await parseJson(response, '/api/health');
  invariant(body.status === 'ok', `expected status ok, received ${JSON.stringify(body.status)}`);
  invariant(body.service === 'bb-sports', `expected service bb-sports, received ${body.service}`);
  if (config.expectedCommit) {
    invariant(
      body.commit === config.expectedCommit,
      `expected commit ${config.expectedCommit}, received ${body.commit || 'unknown'}`,
    );
  }
  if (body.db?.configured === true) {
    invariant(body.db.reachable === true, 'database is configured but not reachable');
  }
  return `commit ${body.commit || 'unknown'}, db ${body.db?.reachable ? 'reachable' : 'not configured'}`;
}

async function checkGateRedirect() {
  const response = await request(`/search?q=${encodeURIComponent(SEARCH_QUERY)}`, {
    redirect: 'manual',
  });
  invariant(
    [302, 303, 307, 308].includes(response.status),
    `expected redirect status, received ${response.status}`,
  );
  const location = response.headers.get('location') || '';
  invariant(location.includes('/coming-soon'), `expected /coming-soon redirect, received ${location}`);
  invariant(location.includes('next='), `expected next param on redirect, received ${location}`);
  return response.status.toString();
}

async function checkGatedSearchPage() {
  const response = await request(`/search?q=${encodeURIComponent(SEARCH_QUERY)}`, {
    headers: { Cookie: GATE_COOKIE },
  });
  assertStatus(response, 200, '/search');
  const html = await response.text();
  invariant(html.includes('Find the take.'), 'search page heading missing');
  invariant(html.includes(REQUIRED_SEARCH_TEXT), `required result text missing: ${REQUIRED_SEARCH_TEXT}`);
  invariant(!html.includes('Application error'), 'application error rendered');
  return `${SEARCH_QUERY} result rendered`;
}

async function checkSearchApi() {
  const response = await request(`/api/search?q=${encodeURIComponent(SEARCH_QUERY)}`, {
    headers: { Cookie: GATE_COOKIE },
  });
  assertStatus(response, 200, '/api/search');
  const body = await parseJson(response, '/api/search');
  invariant(body.ok === true, 'search API did not return ok');
  invariant(Array.isArray(body.results), 'search API did not return a results array');
  invariant(
    body.results.some((result) => result.article?.slug === ARTICLE_SLUG),
    `search API did not include ${ARTICLE_SLUG}`,
  );
  return `${body.results.length} results`;
}

async function checkArticlePage() {
  const response = await request(`/articles/${ARTICLE_SLUG}`, {
    headers: { Cookie: GATE_COOKIE },
  });
  assertStatus(response, 200, `/articles/${ARTICLE_SLUG}`);
  const html = await response.text();
  invariant(html.includes(ARTICLE_TITLE), `article title missing: ${ARTICLE_TITLE}`);
  invariant(html.includes('By Brad Benson'), 'article byline missing');
  invariant(html.includes('Editorial note:'), 'article editorial note missing');
  invariant(!html.includes('Application error'), 'application error rendered');
  return ARTICLE_SLUG;
}

async function checkCommentsReadPath() {
  const response = await request(`/api/articles/${ARTICLE_SLUG}/comments`, {
    headers: { Cookie: GATE_COOKIE },
  });
  assertStatus(response, 200, `/api/articles/${ARTICLE_SLUG}/comments`);
  const body = await parseJson(response, `/api/articles/${ARTICLE_SLUG}/comments`);
  invariant(body.ok === true, 'comments read path did not return ok');
  invariant(Array.isArray(body.comments), 'comments read path did not return comments array');
  return `${body.comments.length} public comments`;
}

async function checkSitemap() {
  const response = await request('/sitemap.xml');
  assertStatus(response, 200, '/sitemap.xml');
  const xml = await response.text();
  invariant(xml.includes(`/articles/${ARTICLE_SLUG}`), `sitemap missing article ${ARTICLE_SLUG}`);
  invariant(xml.includes('/search'), 'sitemap missing search route');
  return 'article and search URLs present';
}

async function checkAnalyticsGet() {
  const response = await request('/api/analytics');
  assertStatus(response, 200, '/api/analytics');
  const body = await parseJson(response, '/api/analytics');
  invariant(body.ok === true, 'analytics GET did not return ok');
  invariant(body.method === 'POST', 'analytics GET did not advertise POST contract');
  return 'contract advertised';
}

async function checkAnalyticsValidationGuard() {
  const response = await request('/api/analytics', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ eventName: 'production_smoke', path: '/production-smoke' }),
  });
  invariant(response.status === 400, `expected invalid event to return 400, received ${response.status}`);
  const body = await parseJson(response, '/api/analytics invalid event');
  invariant(body.error === 'Invalid analytics event.', `unexpected validation body ${JSON.stringify(body)}`);
  return 'invalid event rejected';
}

async function checkAnalyticsWritePath() {
  const response = await request('/api/analytics', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      eventName: 'page_view',
      path: '/production-smoke',
      source: 'production-smoke',
      properties: {
        smoke: true,
        target: 'railway',
      },
    }),
  });
  assertStatus(response, 200, '/api/analytics');
  const body = await parseJson(response, '/api/analytics');
  invariant(body.ok === true, 'analytics POST did not return ok');
  return 'page_view recorded';
}

async function request(path, init = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    return await fetch(new URL(path, config.baseUrl), {
      ...init,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
  }
}

async function parseJson(response, label) {
  try {
    return await response.json();
  } catch {
    throw new Error(`${label} did not return JSON`);
  }
}

function assertStatus(response, expected, label) {
  invariant(response.status === expected, `${label} returned ${response.status}, expected ${expected}`);
}

function invariant(condition, message) {
  if (!condition) throw new Error(message);
}

function normalizeBaseUrl(value) {
  const url = new URL(value);
  url.pathname = '';
  url.search = '';
  url.hash = '';
  return url.toString();
}

function argValue(name) {
  const index = process.argv.indexOf(name);
  if (index === -1) return '';
  return process.argv[index + 1] || '';
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack || error.message : String(error));
  process.exitCode = 1;
});
