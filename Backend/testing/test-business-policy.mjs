import test from 'node:test';
import assert from 'node:assert/strict';
import { assertCodEligible, COD_ORDER_LIMIT, isCodEligible, RETURN_EXCHANGE_WINDOW_DAYS } from '../service/businessPolicy.js';

test('Cash on Delivery is available through ₹2,000 and blocked above the limit', () => {
  assert.equal(COD_ORDER_LIMIT, 2000);
  assert.equal(isCodEligible(2000), true);
  assert.equal(isCodEligible(1999.99), true);
  assert.equal(isCodEligible(2000.01), false);
  assert.doesNotThrow(() => assertCodEligible(2000));
  assert.throws(() => assertCodEligible(2000.01), (error) => error.statusCode === 400);
  assert.equal(isCodEligible(Number.NaN), false);
});

test('return and exchange request windows match the published seven-day policy', () => {
  assert.equal(RETURN_EXCHANGE_WINDOW_DAYS, 7);
});
