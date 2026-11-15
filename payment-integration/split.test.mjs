import test from 'node:test';
import assert from 'node:assert/strict';
import {calculateSplit,verifyPaymentRecord} from './split.mjs';
test('R100 splits R10 platform and R90 baker',()=>assert.deepEqual(calculateSplit(10000),{currency:'ZAR',totalCents:10000,platformCents:1000,bakerCents:9000}));
test('rounding retains every cent',()=>{const s=calculateSplit(999);assert.equal(s.platformCents+s.bakerCents,999)});
test('invalid amounts rejected',()=>assert.throws(()=>calculateSplit(-100)));
test('verified status and amount match',()=>assert.equal(verifyPaymentRecord({amountCents:10000,reference:'order-1'},{amount:10000,currency:'ZAR',reference:'order-1',status:'success'}),true));
test('mismatch rejected',()=>assert.equal(verifyPaymentRecord({amountCents:10000,reference:'order-1'},{amount:9000,currency:'ZAR',reference:'order-1',status:'success'}),false));
