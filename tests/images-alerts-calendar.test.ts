import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';
import {
  estimateViewportImageKb,
  validateImageDelivery,
  viewportWithinBudget,
} from '../lib/image-optimization';
import {
  DEFAULT_ALERT_PREFS,
  mayDeliverReaderAlert,
  parseAlertPrefs,
} from '../lib/reader-alerts';
import {
  findCalendarConflicts,
  mayPublishScheduled,
  parseCalendarSlots,
} from '../lib/editorial-calendar';

test('image delivery requires alt + dimensions and enforces byte budgets', () => {
  assert.equal(
    validateImageDelivery({
      src: '/images/hero-marquee.svg',
      alt: 'Players',
      width: 1200,
      height: 630,
      byteLength: 80_000,
      role: 'hero',
    }).ok,
    true,
  );
  assert.equal(
    validateImageDelivery({
      src: '/x.jpg',
      alt: '',
      fill: true,
      role: 'card',
    }).ok,
    false,
  );
  assert.equal(viewportWithinBudget([100_000, 100_000, 100_000]), true);
  assert.ok(estimateViewportImageKb([1024 * 500]) >= 500);
  assert.equal(viewportWithinBudget([1024 * 500]), false);
});

test('reader alerts default off and never deliver without provider + consent', () => {
  assert.equal(DEFAULT_ALERT_PREFS.enabled, false);
  assert.equal(DEFAULT_ALERT_PREFS.deliveryApproved, false);
  const prefs = parseAlertPrefs({
    enabled: true,
    channels: ['email'],
    sports: ['nfl'],
    consentedAt: new Date().toISOString(),
  });
  assert.equal(prefs.enabled, true);
  assert.equal(prefs.deliveryApproved, false);
  assert.equal(
    mayDeliverReaderAlert({
      prefs,
      providerDeliveryApproved: false,
      publishedProvenanceOk: true,
    }).ok,
    false,
  );
  assert.equal(
    mayDeliverReaderAlert({
      prefs,
      providerDeliveryApproved: true,
      publishedProvenanceOk: true,
    }).ok,
    true,
  );
  assert.equal(
    mayDeliverReaderAlert({
      prefs: DEFAULT_ALERT_PREFS,
      providerDeliveryApproved: true,
      publishedProvenanceOk: true,
    }).ok,
    false,
  );
});

test('editorial calendar detects conflicts and revision mismatches', () => {
  const slots = parseCalendarSlots([
    {
      id: 'a',
      scheduledAt: '2026-08-01T15:00:00.000Z',
      articleId: 'art-1',
      timezone: 'America/Chicago',
      approvedRevisionHash: 'aaaaaaaaaaaaaaaa',
      status: 'scheduled',
    },
    {
      id: 'b',
      scheduledAt: '2026-08-01T15:02:00.000Z',
      articleId: 'art-2',
      timezone: 'America/Chicago',
      approvedRevisionHash: 'bbbbbbbbbbbbbbbb',
      status: 'scheduled',
    },
  ]);
  const conflicts = findCalendarConflicts(slots);
  assert.ok(conflicts.some((c) => c.type === 'overlap'));
  assert.equal(
    mayPublishScheduled({
      slot: slots[0]!,
      nowIso: '2026-08-01T15:00:30.000Z',
      workingRevisionHash: 'aaaaaaaaaaaaaaaa',
    }).ok,
    true,
  );
  assert.equal(
    mayPublishScheduled({
      slot: slots[0]!,
      nowIso: '2026-08-01T15:00:30.000Z',
      workingRevisionHash: 'wrong',
    }).ok,
    false,
  );
});

test('device matrix doc and homepage use next/image for hero', () => {
  const root = new URL('..', import.meta.url).pathname;
  assert.ok(existsSync(join(root, 'docs/operations/DEVICE-MATRIX.md')));
  const page = readFileSync(new URL('../app/(site)/page.tsx', import.meta.url), 'utf8');
  assert.match(page, /next\/image|from 'next\/image'/);
  assert.match(page, /priority/);
});
