// Run: node src/finance.check.js
import assert from 'node:assert';
import { sipValue, lumpValue, inr, money, splitByWeight } from './finance.js';

assert.equal(Math.round(sipValue(10000, 10, 12)), 2323391);
assert.equal(sipValue(1000, 1, 0), 12000);
assert.equal(Math.round(lumpValue(100000, 10, 12)), 310585);
assert.equal(inr(2323391), '₹23.23 L');
assert.equal(inr(12345678), '₹1.23 Cr');
assert.equal(inr(12000), '₹12,000');
assert.equal(money(3045.99), '₹3,045.99');
assert.equal(money(-1000, true), '-₹1,000.00');
assert.equal(money('0.00', true), '₹0.00');
assert.deepEqual(splitByWeight(100000, [1300000, 1750000]), [42622.95, 57377.05]);
assert.deepEqual(splitByWeight(-100, [1, 1, 1]), [-33.34, -33.33, -33.33]); // losses split too; parts sum exactly
assert.deepEqual(splitByWeight(0.01, [1, 1]), [0.01, 0]);
assert.deepEqual(splitByWeight(500, [0, 0]), [0, 0]);
const parts = splitByWeight(123456.78, [3, 7, 11, 13]);
assert.equal(Math.round(parts.reduce((a, p) => a + p, 0) * 100), 12345678);
console.log('finance ok');
