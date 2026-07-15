#!/usr/bin/env node

const DEFAULT_BASE_URL = 'https://web-production-c65d6.up.railway.app';
const SEARCH_QUERY = process.env.BB_SMOKE_SEARCH_QUERY || 'Bears';
const REQUIRED_SEARCH_TEXT =
  process.env.BB_SMOKE_REQUIRED_TEXT || 'Why the Bears finally have a real shot';
const ARTICLE_SLUG = process.env.BB_SMOKE_ARTICLE_SLUG || 'why-the-bears-finally-have-a-real-shot';
const ARTICLE_TITLE =
  process.env.BB_SMOKE_ARTICLE_TITLE || 'Why the Bears finally have a real shot';
let gateCookie = process.env.BB_PRODUCTION_GATE_COOKIE || '';
const GATE_PASSWORD = process.env.BB_PRODUCTION_GATE_PASSWORD || process.env.GATE_PASSWORD || '';
const TIMEOUT_MS = Number(process.env.BB_SMOKE_TIMEOUT_MS || 12_000);
const SMOKE_IP =
  process.env.BB_SMOKE_IP || `198.51.100.${Math.max(1, Math.floor(Date.now() / 1000) % 254)}`;

const config = {
  baseUrl: normalizeBaseUrl(
    argValue('--base-url') || process.env.PRODUCTION_BASE_URL || DEFAULT_BASE_URL,
  ),
  expectedCommit: argValue('--expected-commit') || process.env.EXPECTED_COMMIT || '',
};

const results = [];
let healthSnapshot = null;

async function main() {
  console.log(`BB Sports production smoke: ${config.baseUrl}`);
  if (config.expectedCommit) console.log(`Expected commit: ${config.expectedCommit}`);

  await runCheck('health endpoint', checkHealth);
  await runCheck('health live probe', checkHealthLive);
  await runCheck('health ready probe', checkHealthReady);
  await runCheck('public status page', checkStatusPage);
  await runCheck('soft-launch robots.txt', checkRobotsSoftLaunch);
  await runCheck('soft-launch RSS posture', checkRssSoftLaunch);
  await runCheck('article OG card', checkArticleOgCard);
  await runCheck('soft-launch gate redirect', checkGateRedirect);
  await runCheck('signed access-wall credential', establishGateCookie);
  await runCheck('live-newsroom auth boundary', checkNewsroomAuthBoundary);
  await runCheck('gated search page', checkGatedSearchPage);
  await runCheck('search API JSON', checkSearchApi);
  await runCheck('article page render', checkArticlePage);
  await runCheck('comments read path', checkCommentsReadPath);
  await runCheck('sitemap editorial URLs', checkSitemap);
  await runCheck('teams encyclopedia API', checkTeamsEncyclopediaApi);
  await runCheck('teams encyclopedia pages', checkTeamsEncyclopediaPages);
  await runCheck('donation readiness contract', checkDonationReadiness);
  await runCheck('Stripe webhook contract', checkStripeWebhookContract);
  await runCheck('newsletter welcome contract', checkNewsletterContract);
  await runCheck('newsletter validation guard', checkNewsletterValidationGuard);
  await runCheck('contact validation guard', checkContactValidationGuard);
  await runCheck('donation validation guard', checkDonationValidationGuard);
  await runCheck('comment validation guard', checkCommentValidationGuard);
  await runCheck('analytics contract GET', checkAnalyticsGet);
  await runCheck('analytics validation guard', checkAnalyticsValidationGuard);
  await runCheck('analytics write path', checkAnalyticsWritePath);
  await runCheck('reading list page', checkReadingListPage);
  await runCheck('podcast honesty', checkPodcastHonesty);
  await runCheck('videos honesty', checkVideosHonesty);
  await runCheck('support surface', checkSupportSurface);
  await runCheck('status page honesty', checkStatusHonesty);
  await runCheck('admin canaries auth boundary', checkAdminCanariesAuth);

  const failed = results.filter((result) => !result.ok);
  if (failed.length > 0) {
    console.error(`\nProduction smoke failed: ${failed.length}/${results.length} checks failed.`);
    process.exitCode = 1;
    return;
  }

  console.log(`\nProduction smoke passed: ${results.length}/${results.length} checks.`);
}

async function establishGateCookie() {
  if (gateCookie) return 'provided cookie accepted for downstream checks';
  invariant(GATE_PASSWORD, 'set BB_PRODUCTION_GATE_PASSWORD or BB_PRODUCTION_GATE_COOKIE');

  const response = await request('/api/gate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password: GATE_PASSWORD }),
  });
  assertStatus(response, 200, '/api/gate');
  const setCookie = response.headers.get('set-cookie') || '';
  const match = setCookie.match(/(?:^|,\s*)(bb_gate=[^;]+)/i);
  invariant(match?.[1], '/api/gate did not return the signed bb_gate cookie');
  gateCookie = match[1];
  invariant(gateCookie !== 'bb_gate=1', 'access wall returned the retired boolean cookie');
  return 'signed cookie issued';
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
  healthSnapshot = body;
  invariant(body.status === 'ok', `expected status ok, received ${JSON.stringify(body.status)}`);
  invariant(body.service === 'bb-sports', `expected service bb-sports, received ${body.service}`);
  if (config.expectedCommit) {
    invariant(
      commitsMatch(config.expectedCommit, body.commit || ''),
      `expected commit ${config.expectedCommit}, received ${body.commit || 'unknown'}`,
    );
  }
  // release manifest is required on builds that ship it; older deploys may omit.
  if (body.release) {
    invariant(body.release.service === 'bb-sports', 'release.service must be bb-sports');
    invariant(typeof body.release.publicLaunch === 'boolean', 'release.publicLaunch required');
    invariant(body.release.commit, 'release.commit required when release present');
  }
  if (body.db?.configured === true) {
    invariant(body.db.reachable === true, 'database is configured but not reachable');
  }
  return `commit ${body.commit || 'unknown'}, db ${body.db?.reachable ? 'reachable' : 'not configured'}`;
}

function commitsMatch(expected, actual) {
  const e = String(expected || '')
    .trim()
    .toLowerCase();
  const a = String(actual || '')
    .trim()
    .toLowerCase();
  if (!e) return true;
  if (!a || a === 'local') return false;
  if (e === a) return true;
  return a.startsWith(e) || e.startsWith(a);
}

async function checkHealthLive() {
  const response = await request('/api/health/live');
  assertStatus(response, 200, '/api/health/live');
  const body = await parseJson(response, '/api/health/live');
  invariant(body.check === 'live', 'live probe missing check=live');
  invariant(body.status === 'ok', 'live probe not ok');
  return 'process live';
}

async function checkHealthReady() {
  const response = await request('/api/health/ready');
  assertStatus(response, 200, '/api/health/ready');
  const body = await parseJson(response, '/api/health/ready');
  invariant(body.check === 'ready', 'ready probe missing check=ready');
  invariant(body.status === 'ready', `expected ready, got ${body.status}`);
  return `ready db latency ${body.db?.latencyMs ?? 'n/a'}ms`;
}

async function checkStatusPage() {
  const response = await request('/status');
  assertStatus(response, 200, '/status');
  const html = await response.text();
  invariant(html.includes('BB Sports status'), 'status page heading missing');
  invariant(html.includes('Live scores'), 'status page missing live scores posture');
  invariant(html.includes('Release SHA') || html.includes('data-release-commit'), 'status missing release SHA');
  invariant(!html.includes('Application error'), 'status page application error');
  return 'public status page';
}

async function checkRobotsSoftLaunch() {
  const response = await request('/robots.txt');
  assertStatus(response, 200, '/robots.txt');
  const text = await response.text();
  // Soft launch default: disallow all. Public launch allows / but still blocks /admin.
  if (healthSnapshot?.release?.publicLaunch === true) {
    invariant(/Allow:\s*\//i.test(text) || /allow:\s*\//i.test(text), 'public launch robots should allow /');
    invariant(/Disallow:\s*\/admin/i.test(text), 'public launch robots must disallow /admin');
    return 'public launch robots allow + admin disallow';
  }
  invariant(/Disallow:\s*\//i.test(text), 'soft launch robots must Disallow: /');
  return 'soft launch robots Disallow: /';
}

async function checkRssSoftLaunch() {
  const response = await request('/rss.xml');
  assertStatus(response, 200, '/rss.xml');
  const body = await response.text();
  invariant(/<rss version="2\.0"/.test(body), 'RSS missing version 2.0 root');
  if (healthSnapshot?.release?.publicLaunch === true) {
    invariant(body.includes('<item>'), 'public launch RSS should include items when articles exist');
    return 'public launch RSS has items';
  }
  invariant(!body.includes('<item>'), 'soft launch RSS must not syndicate article items');
  return 'soft launch RSS channel without items';
}

async function checkArticleOgCard() {
  const qs = new URLSearchParams({
    title: ARTICLE_TITLE,
    sport: 'NFL',
    by: 'Brad Benson',
  });
  const response = await request(`/api/og/article?${qs.toString()}`);
  assertStatus(response, 200, '/api/og/article');
  const type = response.headers.get('content-type') || '';
  invariant(/image\/(png|jpeg)/i.test(type), `expected image content-type, got ${type}`);
  const buf = Buffer.from(await response.arrayBuffer());
  invariant(buf.length > 1000, `OG image too small (${buf.length} bytes)`);
  return `og card ${buf.length} bytes`;
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
    headers: { Cookie: gateCookie },
  });
  assertStatus(response, 200, '/search');
  const html = await response.text();
  invariant(html.includes('Find the take.'), 'search page heading missing');
  invariant(html.includes(REQUIRED_SEARCH_TEXT), `required result text missing: ${REQUIRED_SEARCH_TEXT}`);
  invariant(!html.includes('Application error'), 'application error rendered');
  return `${SEARCH_QUERY} result rendered`;
}

async function checkNewsroomAuthBoundary() {
  const api = await request('/api/admin/news-desk', {
    headers: { Cookie: gateCookie },
    redirect: 'manual',
  });
  assertStatus(api, 401, '/api/admin/news-desk');

  const page = await request('/admin/news-desk', {
    headers: { Cookie: gateCookie },
    redirect: 'manual',
  });
  invariant(
    [302, 303, 307, 308].includes(page.status),
    `expected newsroom page redirect, received ${page.status}`,
  );
  const location = page.headers.get('location') || '';
  invariant(location.includes('/admin/login'), `expected admin login redirect, received ${location}`);
  return 'API 401, page redirected to newsroom login';
}

async function checkSearchApi() {
  const response = await request(`/api/search?q=${encodeURIComponent(SEARCH_QUERY)}`, {
    headers: { Cookie: gateCookie },
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
    headers: { Cookie: gateCookie },
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
    headers: { Cookie: gateCookie },
  });
  if (response.status === 503 && healthSnapshot?.db?.configured === false) {
    const body = await parseJson(response, `/api/articles/${ARTICLE_SLUG}/comments`);
    invariant(body.ok === false, 'comments no-DB fallback did not return a controlled response');
    return 'database not configured locally';
  }
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
  // Soft launch: empty inventory is intentional (crawl-policy).
  if (healthSnapshot?.release?.publicLaunch !== true) {
    const hasArticleUrls = /\/articles\/[a-z0-9-]+/i.test(xml);
    invariant(!hasArticleUrls, 'soft launch sitemap must not list article URLs');
    return 'soft launch empty sitemap';
  }
  invariant(xml.includes(`/articles/${ARTICLE_SLUG}`), `sitemap missing article ${ARTICLE_SLUG}`);
  invariant(xml.includes('/search'), 'sitemap missing search route');
  invariant(xml.includes('/teams'), 'sitemap missing teams encyclopedia route');
  return 'article, search, and teams URLs present';
}

async function checkTeamsEncyclopediaApi() {
  const response = await request('/api/teams', {
    headers: { Cookie: gateCookie },
  });
  assertStatus(response, 200, '/api/teams');
  const body = await parseJson(response, '/api/teams');
  invariant(body.data?.stats?.teams >= 124, `expected >=124 teams, got ${body.data?.stats?.teams}`);
  invariant(body.data?.stats?.leagues === 4, `expected 4 leagues, got ${body.data?.stats?.leagues}`);
  invariant(
    (body.data?.stats?.people ?? 0) >= 100,
    `expected >=100 people, got ${body.data?.stats?.people}`,
  );
  invariant(Array.isArray(body.data?.teams), 'teams array missing');
  invariant(body.data.teams.length >= 124, 'teams payload incomplete');
  const search = await request('/api/teams?q=Bears', {
    headers: { Cookie: gateCookie },
  });
  assertStatus(search, 200, '/api/teams?q=Bears');
  const searchBody = await parseJson(search, '/api/teams?q=Bears');
  invariant(
    searchBody.data?.teams?.some((team) => String(team.displayName || '').includes('Bears')),
    'teams search did not return Bears',
  );
  return `${body.data.stats.teams} teams, ${body.data.stats.people || 0} people`;
}

async function checkTeamsEncyclopediaPages() {
  const index = await request('/teams', { headers: { Cookie: gateCookie } });
  assertStatus(index, 200, '/teams');
  const indexHtml = await index.text();
  invariant(indexHtml.includes('Every franchise'), 'teams index heading missing');
  invariant(!indexHtml.includes('Application error'), 'teams index application error');

  const bears = await request('/teams/nfl/chicago-bears', {
    headers: { Cookie: gateCookie },
  });
  assertStatus(bears, 200, '/teams/nfl/chicago-bears');
  const bearsHtml = await bears.text();
  invariant(bearsHtml.includes('Chicago Bears'), 'Bears franchise page missing title');
  invariant(bearsHtml.includes('Source citation'), 'Bears source citation missing');

  const people = await request('/people', { headers: { Cookie: gateCookie } });
  assertStatus(people, 200, '/people');
  const peopleHtml = await people.text();
  invariant(peopleHtml.includes('People on the BB Sports radar'), 'people index heading missing');
  return 'teams + bears + people pages';
}

async function checkDonationReadiness() {
  const response = await request('/api/donations', {
    headers: { Cookie: gateCookie },
  });
  invariant([200, 503].includes(response.status), `/api/donations returned ${response.status}`);
  const payload = await parseJson(response, '/api/donations');
  invariant(typeof payload.mode === 'string', 'donation readiness did not return mode');
  invariant(['checkout', 'payment_link', 'disabled'].includes(payload.mode), `unexpected mode ${payload.mode}`);
  return payload.mode;
}

async function checkStripeWebhookContract() {
  const response = await request('/api/stripe/webhook');
  assertStatus(response, 200, '/api/stripe/webhook');
  const payload = await parseJson(response, '/api/stripe/webhook');
  invariant(payload.route === '/api/stripe/webhook', 'Stripe webhook route metadata missing');
  invariant(Array.isArray(payload.handledEvents), 'Stripe webhook handledEvents missing');
  invariant(
    payload.handledEvents.includes('checkout.session.completed'),
    'Stripe webhook does not advertise checkout.session.completed',
  );
  return payload.webhookReady ? 'webhook configured' : 'webhook disabled';
}

async function checkNewsletterContract() {
  const response = await request('/api/newsletter');
  assertStatus(response, 200, '/api/newsletter');
  const payload = await parseJson(response, '/api/newsletter');
  invariant(payload.route === '/api/newsletter', 'newsletter route metadata missing');
  invariant(Array.isArray(payload.welcomeMissing), 'newsletter welcomeMissing missing');
  invariant(typeof payload.welcomeReady === 'boolean', 'newsletter welcomeReady missing');
  return payload.welcomeReady ? 'welcome enabled' : 'welcome disabled';
}

async function checkNewsletterValidationGuard() {
  return await expectRejectedPost('/api/newsletter', {
    email: 'not-an-email',
    source: 'production-smoke',
  });
}

async function checkContactValidationGuard() {
  return await expectRejectedPost('/api/contact', {
    mode: 'tip',
    email: 'smoke@example.com',
    message: 'short',
    secure: true,
  });
}

async function checkDonationValidationGuard() {
  return await expectRejectedPost('/api/donations', {
    amountCents: 50,
    source: 'production-smoke',
  });
}

async function checkCommentValidationGuard() {
  return await expectRejectedPost(`/api/articles/${ARTICLE_SLUG}/comments`, {
    authorName: 'B',
    body: 'ok',
  });
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

async function expectRejectedPost(path, body) {
  const response = await request(path, {
    method: 'POST',
    redirect: 'manual',
    headers: {
      'Content-Type': 'application/json',
      Cookie: gateCookie,
      'X-Forwarded-For': SMOKE_IP,
    },
    body: JSON.stringify(body),
  });
  invariant(response.status === 400, `${path} returned ${response.status}, expected 400`);
  const payload = await parseJson(response, path);
  invariant(typeof payload.error === 'string' && payload.error.length > 0, `${path} did not return an error`);
  return 'invalid payload rejected';
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

async function checkReadingListPage() {
  const response = await request('/reading-list', { headers: { Cookie: gateCookie } });
  assertStatus(response, 200, '/reading-list');
  const html = await response.text();
  invariant(/Reading list|reading list/i.test(html), 'reading list copy missing');
  return 'reading list reachable';
}

async function checkPodcastHonesty() {
  const response = await request('/podcast', { headers: { Cookie: gateCookie } });
  assertStatus(response, 200, '/podcast');
  const html = await response.text();
  invariant(/coming soon|not live|No player/i.test(html), 'podcast must stay honest pre-launch');
  invariant(!/<audio\b/i.test(html), 'podcast must not ship a fake audio player');
  return 'podcast honest';
}

async function checkVideosHonesty() {
  const response = await request('/videos', { headers: { Cookie: gateCookie } });
  assertStatus(response, 200, '/videos');
  const html = await response.text();
  invariant(/coming soon|No clips|not live/i.test(html), 'videos must stay honest pre-launch');
  invariant(!/<video\b/i.test(html), 'videos must not ship a fake video player');
  return 'videos honest';
}

async function checkSupportSurface() {
  const response = await request('/support', { headers: { Cookie: gateCookie } });
  assertStatus(response, 200, '/support');
  const html = await response.text();
  invariant(/Payment status|support|Stripe|interest/i.test(html), 'support surface missing');
  return 'support reachable';
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
