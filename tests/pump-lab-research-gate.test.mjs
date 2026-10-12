import test from 'node:test';import assert from 'node:assert/strict';import {assessCandidate,walkForwardWindows,evaluateTradeHistory} from '../lib/pump-lab-research-gate.mjs';
const strong={trades:240,sharpe:2.31,profitFactor:1.61,maxDrawdown:.12,doubleCostSharpe:.41,oosSharpe:.8};
test('negative unseen-data performance rejects otherwise strong candidate',()=>{const r=assessCandidate({...strong,oosSharpe:-.24});assert.equal(r.status,'REJECT');assert.deepEqual(r.failed,['unseenData'])});
test('missing measurements never become passes',()=>{assert.equal(assessCandidate({trades:200}).status,'INSUFFICIENT_DATA')});
test('passing research is not live-trading authorization',()=>{const r=assessCandidate(strong);assert.equal(r.status,'RESEARCH_PASS');assert.equal(r.approved,false)});
test('walk forward training and testing do not overlap',()=>{const x=walkForwardWindows(800,{train:500,test:100});assert.equal(x.length,3);for(const w of x)assert.ok(w.trainEnd<=w.testStart)});
test('invalid windows reject',()=>assert.throws(()=>walkForwardWindows(100,{train:0,test:10})));

const synthetic=(count=100)=>Array.from({length:count},(_,i)=>({
 id:'t'+i,closedAt:Date.UTC(2026,0,1+i),pnl:i%4===0?-3:4,invested:100,units:100,exit:1,
 entryExecution:{feeRate:.002,slippage:.001,fixedCost:0},exitExecution:{feeRate:.002,slippage:.001,fixedCost:0}
}));
test('closed paper ledger produces forward and doubled-cost gate calculations',()=>{
 const r=evaluateTradeHistory(synthetic());
 assert.equal(r.sample,100);assert.equal(r.missingExecution,0);assert.equal(r.windows,2);
 assert.ok(Number.isFinite(r.metrics.sharpe));assert.ok(r.metrics.netPnl>r.metrics.stressNetPnl);
 assert.equal(r.gate.status,'RESEARCH_PASS');assert.equal(r.gate.approved,false);
});
test('unverifiable trading friction rejects performance promotion',()=>{
 const t=synthetic();delete t[0].exitExecution;
 const r=evaluateTradeHistory(t);assert.equal(r.status,'INSUFFICIENT_DATA');assert.equal(r.missingExecution,1);
});
test('negative unseen paper performance overrides a promising training sample',()=>{
 const t=synthetic();
 for(let i=80;i<t.length;i++)t[i].pnl=-9;
 const r=evaluateTradeHistory(t);assert.notEqual(r.gate.status,'RESEARCH_PASS');
});
test('input trades are not mutated or reordered by evaluation',()=>{
 const t=synthetic();const first=structuredClone(t[0]);t.reverse();evaluateTradeHistory(t);
 assert.deepEqual(t.at(-1),first);
});
