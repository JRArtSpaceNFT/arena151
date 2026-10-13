import test from 'node:test';import assert from 'node:assert/strict';
import {ACTIVE_CORE_MIN_MARKET_CAP_USD,shouldEvaluateCoreToken,shouldProcessStrategy} from '../lib/pump-lab-core-admission.mjs';
test('low-market-cap launches do not consume full active core decision loop',()=>{
 assert.equal(ACTIVE_CORE_MIN_MARKET_CAP_USD,40000);
 assert.equal(shouldEvaluateCoreToken({marketCap:3000,hasOpenPosition:false}),false);
 assert.equal(shouldEvaluateCoreToken({marketCap:39999,hasOpenPosition:false}),false);
 assert.equal(shouldEvaluateCoreToken({marketCap:40000,hasOpenPosition:false}),true);
 assert.equal(shouldEvaluateCoreToken({marketCap:50000,hasOpenPosition:false}),true);
});
test('open positions must always be evaluated for exits regardless of market capitalization',()=>{
 for(const cap of [0,100,3000,39999,50000])assert.equal(shouldEvaluateCoreToken({marketCap:cap,hasOpenPosition:true}),true);
});
test('unknown or untrusted market-cap data is passed to existing fail-closed guards',()=>{
 assert.equal(shouldEvaluateCoreToken({marketCap:null}),true);
 assert.equal(shouldEvaluateCoreToken({marketCap:NaN}),true);
});
test('inactive strategies preserve open-position processing',()=>{
 assert.equal(shouldProcessStrategy({enabled:false,hasOpenPosition:false}),false);
 assert.equal(shouldProcessStrategy({enabled:true,hasOpenPosition:false}),true);
 assert.equal(shouldProcessStrategy({enabled:false,hasOpenPosition:true}),true);
});
