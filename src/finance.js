// Future value of a monthly SIP (payment at start of each month).
export function sipValue(monthly, years, ratePct) {
  const i = ratePct / 100 / 12;
  const n = Math.round(years * 12);
  if (i === 0) return monthly * n;
  return monthly * ((Math.pow(1 + i, n) - 1) / i) * (1 + i);
}

export function lumpValue(amount, years, ratePct) {
  return amount * Math.pow(1 + ratePct / 100, years);
}

export function inr(v) {
  if (v >= 1e7) return `₹${(v / 1e7).toFixed(2)} Cr`;
  if (v >= 1e5) return `₹${(v / 1e5).toFixed(2)} L`;
  return `₹${Math.round(v).toLocaleString('en-IN')}`;
}

// Exact rupee amount for ledgers, e.g. ₹3,045.99. signed: '+₹5,000.00' / '-₹1,000.00'.
const rupees = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' });
const signedRupees = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', signDisplay: 'exceptZero' });
export const money = (v, signed = false) => (signed ? signedRupees : rupees).format(Number(v) || 0);

// Splits `total` rupees by weight (each partner's capital), to the paisa, so the parts always add up exactly.
// Leftover paise go to the largest remainders. Returns amounts in rupees, in the same order as `weights`.
export function splitByWeight(total, weights) {
  const sum = weights.reduce((a, w) => a + w, 0);
  if (!sum) return weights.map(() => 0);
  const paise = Math.round(total * 100);
  const sign = Math.sign(paise);
  const exact = weights.map((w) => (Math.abs(paise) * w) / sum);
  const parts = exact.map(Math.floor);
  let left = Math.abs(paise) - parts.reduce((a, p) => a + p, 0);
  for (const i of exact.map((x, i) => i).sort((a, b) => exact[b] - parts[b] - (exact[a] - parts[a]) || a - b)) {
    if (left-- <= 0) break;
    parts[i] += 1;
  }
  return parts.map((p) => (sign * p) / 100);
}
