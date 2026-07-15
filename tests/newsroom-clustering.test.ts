import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createExactContentHash,
  createExactUrlHash,
  isConservativeClusterCandidate,
  normalizeExactNewsUrl,
  tokenJaccardSimilarity,
} from '../lib/newsroom-clustering';

test('exact URL hashes normalize host casing and fragments but preserve query identity', () => {
  const first = createExactUrlHash('https://EXAMPLE.com/report?id=7#live');
  const sameDocument = createExactUrlHash('https://example.com/report?id=7');
  const differentQuery = createExactUrlHash('https://example.com/report?id=8');
  assert.equal(first, sameDocument);
  assert.notEqual(first, differentQuery);
  assert.equal(normalizeExactNewsUrl('https://EXAMPLE.com/report#live'), 'https://example.com/report');
});

test('content hashes are deterministic and exact rather than fuzzy', () => {
  assert.equal(createExactContentHash('Trade agreed', 'Details'), createExactContentHash('Trade agreed', 'Details'));
  assert.notEqual(createExactContentHash('Trade agreed', 'Details'), createExactContentHash('Trade agreed ', 'Details'));
  assert.notEqual(createExactContentHash('Trade agreed', 'Details'), createExactContentHash('Trade agreed', 'details'));
});

test('token Jaccard is case-insensitive, set-based, and symmetric', () => {
  const left = 'Bears agree to trade veteran pass rusher after talks';
  const right = 'After talks, BEARS agree to trade veteran pass rusher';
  assert.equal(tokenJaccardSimilarity(left, right), 1);
  assert.equal(tokenJaccardSimilarity(left, right), tokenJaccardSimilarity(right, left));
  assert.equal(tokenJaccardSimilarity('Bears roster update', 'Yankees bullpen decision'), 0);
});

test('conservative clustering refuses thin or merely related headlines', () => {
  assert.equal(isConservativeClusterCandidate('Bears make trade', 'Bears make trade'), false);
  assert.equal(
    isConservativeClusterCandidate(
      'Chicago Bears agree to trade veteran pass rusher after contract talks',
      'Chicago Bears agree to trade veteran pass rusher following contract talks',
    ),
    true,
  );
  assert.equal(
    isConservativeClusterCandidate(
      'Chicago Bears agree to trade veteran pass rusher after contract talks',
      'Chicago Bears prepare for opening game after summer roster changes',
    ),
    false,
  );
});
