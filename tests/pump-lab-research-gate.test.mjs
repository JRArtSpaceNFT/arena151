import test from 'node:test';import assert from 'node:assert/strict';import {assessCandidate,walkForwardWindows} from '../lib/pump-lab-research-gate.mjs';
const strong={trades:240,sharpe:2.31,profitFactor:1.61,maxDrawdown:.12,doubleCostSharpe:.41,oosSharpe:.8};
test('negative unseen-data performance rejects otherwise strong candidate',()=>{const r=assessCandidate({...strong,oosSharpe:-.24});assert.equal(r.status,'REJECT');assert.deepEqual(r.failed,['unseenData'])});
test('missing measurements never become passes',()=>{assert.equal(assessCandidate({trades:200}).status,'INSUFFICIENT_DATA')});
test('passing research is not live-trading authorization',()=>{const r=assessCandidate(strong);assert.equal(r.status,'RESEARCH_PASS');assert.equal(r.approved,false)});
test('walk forward training and testing do not overlap',()=>{const x=walkForwardWindows(800,{train:500,test:100});assert.equal(x.length,3);for(const w of x)assert.ok(w.trainEnd<=w.testStart)});
test('invalid windows reject',()=>assert.throws(()=>walkForwardWindows(100,{train:0,test:10})));
