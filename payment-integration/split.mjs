// Pure calculations for checkout preparation; no payment is initiated here.
// Amounts are integer South African cents, before Paystack transaction fees.
export function calculateSplit(totalCents, platformPercent = 10) {
  if (!Number.isSafeInteger(totalCents) || totalCents <= 0) throw new TypeError('Invalid amount in cents');
  if (!Number.isInteger(platformPercent) || platformPercent < 0 || platformPercent > 100) throw new TypeError('Invalid percentage');
  const platformCents = Math.round(totalCents * platformPercent / 100);
  return Object.freeze({currency:'ZAR', totalCents, platformCents, bakerCents:totalCents-platformCents});
}
export function verifyPaymentRecord(expected, actual) {
  // This is a local consistency check, NOT Paystack API verification or webhook authentication.
  if (!expected || !actual) return false;
  return actual.status === 'success' &&
    actual.currency === 'ZAR' &&
    Number.isSafeInteger(expected.amountCents) && expected.amountCents > 0 &&
    actual.amount === expected.amountCents &&
    typeof expected.reference === 'string' && expected.reference.length > 0 &&
    actual.reference === expected.reference;
}
