# Reservation timing and checkout review (2026-11-15)

## Verified existing behavior

The deployed Supabase `reserve_bakery_product` function sets `hold_expires_at = collection_at + interval '25 minutes'`. The deployed `bakers-dozen-checkout` function allows a payment only while the reservation is `held` and `hold_expires_at > now()`.

This is a **25-minute window after the selected collection time**, **not** a 25-minute window from when the customer reserves. It may be intentional based on the marketplace's collection policy. Do not change it without deciding whether the 25 minutes is a collection grace period or a payment hold.

## Open questions and test cases

1. Reservation created hours before collection: should payment be possible immediately? Current implementation says yes.
2. Collection time passes: checkout remains possible for 25 minutes. Is that intended?
3. Reservation expires: which scheduled process releases reserved stock and transitions the reservation to expired? Verify.
4. A successful Paystack charge after hold expiry: webhook finalization must reconcile payment even if reservation can no longer be confirmed. Verify refund/manual-review handling.
5. Reservation canceled while payment pending: current cancellation function blocks pending/initialized payments; verify support recovery.
6. Verify test-mode subaccount and merchant fee bearer; backend sets `transaction_charge` and `bearer: 'subaccount'`.

## Operational status

As inspected, reservations table had zero rows. No production schema/function changes have been applied. No actual Paystack sandbox payment has been performed.

## Release gate

Keep live payments disabled until the timing policy is confirmed, test credentials and a test-mode subaccount are available, and a complete checkout/webhook/reconciliation test passes.
