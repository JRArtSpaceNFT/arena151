import test from 'node:test';
import assert from 'node:assert/strict';
import {hypotheticalFomoEconomics,buildDeskIntegrityReport} from '../lib/pump-lab-desk-integrity.mjs';
test('hypothetical FOMO fee floor implies over 1.9% round trip at $100 before slippage',()=>{
 const c=hypotheticalFomoEconomics(100);assert.equal(c.buyFee,.95);assert.equal(c.flatExitFee,.95);
 assert.ok(c.breakEvenMovePct>1.89&&c.breakEvenMovePct<1.91);assert.equal(c.model,'HYPOTHETICAL_FOMO_ONLY');
});
test('fee floor yields a lower percentage at $250 but no misleading exact execution fill',()=>{
 const c=hypotheticalFomoEconomics(250);assert.equal(c.buyFee,1.125);assert.equal(c.flatFeePct,.9);
 assert.ok(c.breakEvenMovePct>.9&&c.breakEvenMovePct<1);
 assert.match(c.excludes,/slippage/);
});
test('unknown capital or fee assumptions cannot generate a confident cost estimate',()=>{
 assert.equal(hypotheticalFomoEconomics(0),null);assert.equal(hypotheticalFomoEconomics(NaN),null);
 assert.equal(hypotheticalFomoEconomics(50,{feeRate:2,minimumFeeUsd:0}),null);
});
test('no live market feed or canonical storage never reports READY',()=>{
 const s=buildDeskIntegrityReport({at:1000000,runtime:{ready:true,durable:true,dbConnected:true,phase:'READY'},providers:[]});
 assert.equal(s.health,'DEGRADED_OR_UNVERIFIED');assert.equal(s.checks.marketFeedFresh,false);
 assert.equal(s.macroDial.value,null);assert.equal(s.macroDial.appliedToTrading,false);
});
test('fresh market feed plus canonical storage can report observed runtime readiness',()=>{
 const s=buildDeskIntegrityReport({at:1000000,runtime:{ready:true,durable:true,dbConnected:true,phase:'READY'},
 providers:[{component:'pump.fun',status:'ok',ts:990000}],tradeCount:44});
 assert.equal(s.health,'READY_OBSERVED');assert.equal(s.ledgerClosedTrades,44);
});
test('insufficient holdout can never be described as validated, even when return is high',()=>{
 const s=buildDeskIntegrityReport({at:1000000,bots:[{id:'banker',name:'Sentinel',n:5,fiveBrain:true}],
 decisions:[{ts:999900,strategy:'banker',action:'REJECT',why:'no price history'}],
 evidenceGrades:[{id:'banker',sample:5,forwardWindows:0,status:'PASS',stressedNetPnl:10000,oosSharpe:5}]});
 assert.equal(s.auditBots[0].verdict,'INSUFFICIENT_EVIDENCE');
 assert.equal(s.auditBots[0].topReasons[0].reason,'no price history');
});
test('stale decisions are not counted as current trading activity',()=>{
 const s=buildDeskIntegrityReport({at:100000000,bots:[{id:'momentum',name:'Surge',n:10,fiveBrain:true}],
 decisions:[{ts:100000000-7*3600000,strategy:'momentum',action:'BUY'}]});
 assert.equal(s.auditBots[0].checked,0);assert.equal(s.auditBots[0].buys,0);
});
