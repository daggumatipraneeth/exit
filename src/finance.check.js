// Run: node src/finance.check.js
import assert from 'node:assert';
import { sipValue, lumpValue, inr } from './finance.js';

assert.equal(Math.round(sipValue(10000, 10, 12)), 2323391);
assert.equal(sipValue(1000, 1, 0), 12000);
assert.equal(Math.round(lumpValue(100000, 10, 12)), 310585);
assert.equal(inr(2323391), '₹23.23 L');
assert.equal(inr(12345678), '₹1.23 Cr');
assert.equal(inr(12000), '₹12,000');
console.log('finance ok');
