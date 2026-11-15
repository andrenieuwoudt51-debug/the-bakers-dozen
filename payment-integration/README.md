# The Baker's Dozen — Paystack integration (not live)

Status: planning only. No payment flow has been connected or deployed.

## Required implementation

- Associate each verified baker with its own Paystack subaccount code in a server-controlled seller record.
- For each checkout, compute price and seller allocation server-side from trusted order items; do not trust browser-supplied totals or subaccount IDs.
- Use Paystack **test-mode** credentials and test-mode subaccounts for integration testing; do not reuse live subaccount codes in test mode.
- Initialize Paystack transactions only from a secure backend, with server-side test secret and a unique idempotent order reference.
- Verify transaction amount, currency, status, reference and seller on the server after payment and when processing signed webhooks.
- Update the order to paid only after verified payment; handle duplicate callbacks and refunds safely.
- Confirm Paystack fee-bearer settings, seller settlement, dispute handling and net 10% platform economics.
- Require written Paystack approval for use of Menu Matrix's merchant account for The Baker's Dozen before enabling live payments.

## Release gates

1. Recover and back up the full currently deployed application source before connecting Git-based automatic deployment.
2. Identify the existing database schema and payment webhook implementation.
3. Configure secrets privately in Vercel; never commit them to GitHub.
4. Run test orders and verify seller attribution, order status, commission and reconciliation.
5. Keep production bakery payments disabled until Paystack authorizes marketplace activity.

This repository file is not the deployed application and does not change Menu Matrix.
