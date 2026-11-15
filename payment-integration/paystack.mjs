import { createHmac, timingSafeEqual } from 'node:crypto';

export function calculateSplit(amountCents) {
  if (!Number.isSafeInteger(amountCents) || amountCents <= 0) throw new Error('Invalid amount');
  const platformCents = Math.round(amountCents * 0.10);
  return { amountCents, platformCents, bakerCents: amountCents - platformCents, currency: 'ZAR' };
}

export function verifyWebhookSignature(rawBody, signature, secret) {
  if (!secret || typeof signature !== 'string' || !/^[a-f0-9]{128}$/i.test(signature)) return false;
  const digest = createHmac('sha512', secret).update(rawBody).digest();
  return timingSafeEqual(digest, Buffer.from(signature, 'hex'));
}

export function matchesOrder(order, transaction) {
  return Boolean(order && transaction && transaction.status === 'success' &&
    transaction.currency === 'ZAR' && transaction.reference === order.reference &&
    transaction.amount === order.amountCents && Number.isSafeInteger(order.amountCents) &&
    order.amountCents > 0);
}

export function makeInitializePayload({ order, seller, customerEmail }) {
  if (!order?.reference || !seller?.testSubaccountCode?.startsWith('ACCT_')) throw new Error('Missing test seller subaccount');
  if (order.sellerId !== seller.id) throw new Error('Seller mismatch');
  if (!/^\S+@\S+\.\S+$/.test(customerEmail)) throw new Error('Invalid customer email');
  const split = calculateSplit(order.amountCents);
  return {
    email: customerEmail, amount: split.amountCents, currency: 'ZAR', reference: order.reference,
    subaccount: seller.testSubaccountCode,
    // Paystack subaccount percentage is configured at subaccount creation (90% to baker).
    // Confirm fee bearer with Paystack before live rollout.
    metadata: { order_id: String(order.id), seller_id: String(seller.id) }
  };
}

export async function initializeTestPayment(payload, { secretKey, fetchImpl = fetch } = {}) {
  if (!secretKey?.startsWith('sk_test_')) throw new Error('Test secret key required');
  const response = await fetchImpl('https://api.paystack.co/transaction/initialize', {
    method: 'POST', headers: { Authorization: `Bearer ${secretKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  if (!response.ok) throw new Error(`Paystack initialize failed (${response.status})`);
  const result = await response.json();
  if (result.status !== true || !result.data?.authorization_url || !result.data?.reference) throw new Error('Invalid Paystack response');
  return { authorizationUrl: result.data.authorization_url, reference: result.data.reference };
}
