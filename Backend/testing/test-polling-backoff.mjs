import test from 'node:test';
import assert from 'node:assert/strict';
import { createPollingBackoff, isMongoConnectivityError } from '../service/pollingBackoff.js';

test('polling backoff grows exponentially, caps, then resets after recovery', () => {
  const backoff = createPollingBackoff({ baseDelayMs: 2_000, maxDelayMs: 8_000 });
  const error = new Error('server monitor timeout');

  assert.equal(backoff.shouldPoll(0), true);
  assert.deepEqual(backoff.failed(error, 0), { attempt: 1, delayMs: 2_000, shouldLog: true });
  assert.equal(backoff.shouldPoll(1_999), false);
  assert.equal(backoff.shouldPoll(2_000), true);
  assert.deepEqual(backoff.failed(error, 2_000), { attempt: 2, delayMs: 4_000, shouldLog: false });
  assert.deepEqual(backoff.failed(error, 6_000), { attempt: 3, delayMs: 8_000, shouldLog: false });
  assert.deepEqual(backoff.failed(error, 14_000), { attempt: 4, delayMs: 8_000, shouldLog: false });

  backoff.succeeded();
  assert.equal(backoff.shouldPoll(14_000), true);
  assert.equal(backoff.getState().failures, 0);
  assert.deepEqual(backoff.failed(error, 14_000), { attempt: 1, delayMs: 2_000, shouldLog: true });
});

test('repeated polling errors are logged at most once per cooldown unless the error changes', () => {
  const backoff = createPollingBackoff({ baseDelayMs: 2_000, logIntervalMs: 60_000 });
  const first = new Error('same outage');
  assert.equal(backoff.failed(first, 1_000).shouldLog, true);
  assert.equal(backoff.failed(first, 20_000).shouldLog, false);
  assert.equal(backoff.failed(new Error('different outage'), 21_000).shouldLog, true);
  assert.equal(backoff.failed(first, 81_000).shouldLog, true);
});

test('recognizes Mongo transport failures without classifying business errors as connectivity failures', () => {
  assert.equal(isMongoConnectivityError({ name: 'MongoServerSelectionError', message: 'timeout' }), true);
  assert.equal(isMongoConnectivityError({ code: 'ECONNRESET', message: 'socket closed' }), true);
  assert.equal(isMongoConnectivityError(new Error('Invalid order status transition.')), false);
});
