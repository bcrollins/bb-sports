import assert from 'node:assert/strict';
import test from 'node:test';
import {
  NEWS_EVENT_STATES,
  allowedNewsEventTransitions,
  assertNewsEventTransition,
  canTransitionNewsEventState,
  newsEventStateAfterEvidenceAdded,
} from '../lib/newsroom-state';

test('newsroom states deliberately exclude publication', () => {
  assert.deepEqual(NEWS_EVENT_STATES, [
    'new',
    'investigating',
    'verification_ready',
    'verified',
    'dismissed',
  ]);
  assert.equal((NEWS_EVENT_STATES as readonly string[]).includes('published'), false);
});

test('new evidence atomically reopens a verified event for investigation', () => {
  assert.equal(newsEventStateAfterEvidenceAdded('verified'), 'investigating');
  assert.equal(newsEventStateAfterEvidenceAdded('verification_ready'), 'verification_ready');
  assert.equal(canTransitionNewsEventState('verified', newsEventStateAfterEvidenceAdded('verified')), true);
});

test('workflow transition map is explicit and supports auditable reopening', () => {
  assert.deepEqual(allowedNewsEventTransitions('new'), ['investigating', 'verification_ready', 'dismissed']);
  assert.deepEqual(allowedNewsEventTransitions('verification_ready'), [
    'investigating',
    'verified',
    'dismissed',
  ]);
  assert.deepEqual(allowedNewsEventTransitions('verified'), ['investigating', 'dismissed']);
  assert.deepEqual(allowedNewsEventTransitions('dismissed'), ['investigating']);
});

test('same-state edits are legal while workflow shortcuts are rejected', () => {
  assert.equal(canTransitionNewsEventState('investigating', 'investigating'), true);
  assert.equal(canTransitionNewsEventState('new', 'verified'), false);
  assert.equal(canTransitionNewsEventState('dismissed', 'verified'), false);
  assert.throws(
    () => assertNewsEventTransition('new', 'verified'),
    /Illegal newsroom event transition: new -> verified/,
  );
});
