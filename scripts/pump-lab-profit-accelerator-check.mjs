import assert from 'node:assert/strict';
import { createPumpLabProfitAccelerator } from '../lib/pump-lab-profit-accelerator.mjs';

const era='v4.0-season2-science';
const pa=createPumpLabProfitAccelerator();
const strat=(id,name,risk='MED')=>({id,name,risk,dd:0});
const trade=(strategy,pnlPct,{regime='HOT',social=50,mfe=Math.max(0,pnlPct),mae=Math.min(0,pnlPct)}={})=>({
  strategy,
  pnlPct,
  pnl:pnlPct,
  policyVersion:era,
  entryRegime:regime,
  entryFeatures:{social},
  mfe,
  mae
});

const badRows=Array.from({length:14},()=>trade('bad',-8));
const badGate=pa.strategyGate({strategy:strat('bad','Bad Bot'),trades:badRows,regime:'HOT',era});
assert.equal(badGate.ok,false,'persistently negative strategy should be paused');
assert.equal(badGate.status,'PAUSED');

const goodRows=Array.from({length:14},(_,i)=>trade('good',i%4===0?-2:7,{mfe:i%4===0?5:18,mae:i%4===0?-4:-2}));
const table=pa.championTable({strategies:[strat('good','Good Bot'),strat('bad','Bad Bot')],trades:[...goodRows,...badRows],regime:'HOT',era});
assert.equal(table[0].id,'good','positive expectancy strategy should rank above losing strategy');
assert(pa.championMultiplier({strategyId:'good',strategies:[strat('good','Good Bot'),strat('bad','Bad Bot')],trades:[...goodRows,...badRows],regime:'HOT',era})>1);

const socialNoise=[
  ...Array.from({length:10},()=>trade('social',5,{social:15})),
  ...Array.from({length:10},()=>trade('social',-4,{social:90}))
];
const social=pa.socialEvidence({trades:socialNoise,strategyId:'social',era});
assert.equal(social.status,'NOISE','losing high-social setups should be treated as noise');
assert(social.multiplier<=.1);

const badExec=pa.executionQuality({slippage:.07,impact:.04,volatilitySlip:.01,txFailureProbability:.10},{landingScore:70});
const goodExec=pa.executionQuality({slippage:.008,impact:.003,volatilitySlip:.001,txFailureProbability:.01},{landingScore:82});
assert.equal(badExec.veto,true,'excess slippage should veto execution');
assert.equal(goodExec.veto,false);
assert(goodExec.score>badExec.score);

const token={mint:'MINT1',narrative:'Cats'};
const tokenMap=new Map([['MINT1',token]]);
const corr=pa.correlationGuard({
  strategyId:'a',
  token,
  positions:[{strategy:'b',mint:'MINT1',closed:false}],
  correlations:[{a:'a',b:'b',jaccard:82}],
  tokens:tokenMap
});
assert.equal(corr.ok,false,'highly correlated strategy should not duplicate the same token');

const exitRows=Array.from({length:16},(_,i)=>trade('exitbot',i%4===0?-6:12,{
  mfe:i%4===0?4:28+(i%3)*6,
  mae:i%4===0?-10:-3-(i%4)
}));
const learned=pa.exitLearning({strategyId:'exitbot',trades:exitRows,era});
assert(learned.confidence>=.30);
assert(Number.isFinite(learned.stopCap));
assert(Number.isFinite(learned.takeFloor));

const post=pa.classifyTrade({pnlPct:-4,mfe:32,mae:-7,modeledRoundTripPct:2});
assert.equal(post.category,'EXIT MANAGEMENT');

const snap=pa.snapshot({
  strategies:[strat('good','Good Bot'),strat('bad','Bad Bot')],
  trades:[...goodRows,...badRows],
  regime:'HOT',
  era,
  correlations:[{a:'good',b:'bad',jaccard:65}],
  noTrade:{n:10,falseRejectRate:5,saveRate:40}
});
assert.equal(snap.version,'profit-accelerator-v1');
assert.equal(snap.champions[0].id,'good');
assert(snap.correlationHotspots.length===1);

console.log('PUMP_LAB_PROFIT_ACCELERATOR_CHECK ok '+JSON.stringify({
  paused:badGate.status,
  champion:table[0].id,
  social:social.status,
  executionScore:goodExec.score,
  learnedStop:learned.stopCap,
  learnedTake:learned.takeFloor
}));
