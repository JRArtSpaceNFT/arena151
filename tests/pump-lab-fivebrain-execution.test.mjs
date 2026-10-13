import test from 'node:test';
import assert from 'node:assert/strict';
import {calibrateFiveBrainEntry,evaluateFiveBrainExit} from '../lib/pump-lab-fivebrain-execution.mjs';
const input={strategyId:'momentum',baseMin:49,p75:40,p90:46,closedTrades:12,flowFresh:true,quality:83,marketRisk:37,
 funnel:{status:'CANDIDATE',stage:'PICK'}};
test('five paper brains use relative scores with a bounded minimum',()=>{
 const z=calibrateFiveBrainEntry(input);assert.equal(z.enabled,true);assert.equal(z.min,39);assert.equal(z.reason,'funnel_verified_rank');
 assert.ok(z.min>=38);
});
test('missing or low-confidence funnel still calibrates only a bounded relative threshold',()=>{
 const z=calibrateFiveBrainEntry({...input,funnel:null});assert.equal(z.min,42);assert.equal(z.reason,'percentile_calibration');
 const w=calibrateFiveBrainEntry({...input,marketRisk:80});assert.equal(w.min,42);
});
test('never modifies thresholds for other strategies',()=>assert.equal(calibrateFiveBrainEntry({...input,strategyId:'gauntlet'}).enabled,false));
test('missing verified executable prices cannot trigger a paper exit',()=>{
 const x=evaluateFiveBrainExit({strategyId:'momentum',holdMinutes:4,pnlPct:-8,peakPnlPct:1,acceleration:30,momentum:38,buyRatio:.35,flowFresh:true,quoteVerified:false});
 assert.equal(x.exit,false);assert.equal(x.reason,'unverified_price_hold');
});
test('failed momentum after actual holding period exits on observed evidence',()=>{
 const x=evaluateFiveBrainExit({strategyId:'momentum',holdMinutes:3.5,pnlPct:-3,peakPnlPct:2,acceleration:40,momentum:44,buyRatio:.42,flowFresh:true,quoteVerified:true});
 assert.equal(x.exit,true);assert.equal(x.reason,'no_proof_flow_failed');
});
test('flat but positive trade does not force early loss exit',()=>{
 const x=evaluateFiveBrainExit({strategyId:'momentum',holdMinutes:4,pnlPct:2,peakPnlPct:3,acceleration:40,momentum:44,buyRatio:.42,flowFresh:true,quoteVerified:true});
 assert.equal(x.exit,false);
});
test('strong winner trailing requires enough modeled net profit, not just price change',()=>{
 const p={strategyId:'champion',holdMinutes:10,pnlPct:17,peakPnlPct:26,acceleration:63,momentum:70,buyRatio:.62,flowFresh:true,quoteVerified:true};
 assert.equal(evaluateFiveBrainExit({...p,estimatedNetProfitUsd:1}).exit,false);
 assert.equal(evaluateFiveBrainExit({...p,estimatedNetProfitUsd:8}).reason,'verified_winner_trailing_protection');
});
test('missing flow means no new early thesis exit',()=>{
 const x=evaluateFiveBrainExit({strategyId:'dip',holdMinutes:7,pnlPct:-5,peakPnlPct:0,acceleration:12,momentum:20,buyRatio:.2,flowFresh:false,quoteVerified:true});
 assert.equal(x.exit,false);
});
