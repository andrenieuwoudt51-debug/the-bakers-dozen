import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateSplit, verifyWebhookSignature, matchesOrder, makeInitializePayload, initializeTestPayment } from './paystack.mjs';
import { createHmac } from 'node:crypto';

test('10/90 split preserves total', () => assert.deepEqual(calculateSplit(10000), {amountCents:10000,platformCents:1000,bakerCents:9000,currency:'ZAR'}));
test('webhook signature validates raw payload', () => { const body='{"event":"charge.success"}', key='test-only'; const sig=createHmac('sha512',key).update(body).digest('hex'); assert.equal(verifyWebhookSignature(body,sig,key),true); assert.equal(verifyWebhookSignature(body+' ',sig,key),false); });
test('payment must match order', () => { const o={reference:'a',amountCents:500}; assert.equal(matchesOrder(o,{reference:'a',amount:500,currency:'ZAR',status:'success'}),true); assert.equal(matchesOrder(o,{reference:'a',amount:501,currency:'ZAR',status:'success'}),false); });
test('seller mismatch rejected',()=>assert.throws(()=>makeInitializePayload({order:{id:1,sellerId:2,amountCents:1000,reference:'r'},seller:{id:3,testSubaccountCode:'ACCT_test'},customerEmail:'a@b.co'})));
test('initialization uses test key only and mock API',async()=>{ const payload=makeInitializePayload({order:{id:1,sellerId:2,amountCents:1000,reference:'r'},seller:{id:2,testSubaccountCode:'ACCT_test'},customerEmail:'a@b.co'}); assert.equal(payload.amount,1000); assert.equal(payload.subaccount,'ACCT_test'); await assert.rejects(initializeTestPayment(payload,{secretKey:'sk_live_example'})); const x=await initializeTestPayment(payload,{secretKey:'sk_test_example',fetchImpl:async()=>({ok:true,json:async()=>({status:true,data:{authorization_url:'https://checkout.paystack.com/test',reference:'r'}})})});assert.equal(x.reference,'r');});
