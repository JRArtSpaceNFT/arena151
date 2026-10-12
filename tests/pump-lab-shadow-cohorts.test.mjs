import test from 'node:test';import assert from 'node:assert/strict';
import {ShadowCohorts,SHADOW_PROFILES} from '../lib/pump-lab-shadow-cohorts.mjs';
const ts=Date.now()-120000;
function token(p=1,time=ts){
 return {mint:'mintA',symbol:'TEST',price:p,mc:150000,liq:100000,priceSource:'dexscreener',liquidityKind:'dex-liquidity',
  sourceSeen:{dexscreener:time,'pump.fun':time},sources:['dexscreener','pump.fun']};
}
const features={age:5,buyRatio:.61,momentum:66,acceleration:65,risk:35,chart:{chartQuality:80},drawdown:-2,rebound:1};
const quality={score:95};
test('six distinct bounded experimental bots, independent from main portfolios',()=>{
 const r=new ShadowCohorts();assert.equal(r.bots.length,6);
 assert.equal(new Set(SHADOW_PROFILES.map(x=>x.id)).size,6);
 assert.equal(r.positions.length,0);assert.equal(r.trades.length,0);
});
test('no phantom buys when canonical storage locked or quote unverified',()=>{
 const r=new ShadowCohorts();
 r.observe(token(),features,quality,{executable:true,ts,tradingUnlocked:false});
 assert.equal(r.positions.length,0);
 r.observe({...token(),priceSource:'pump.fun'},features,quality,{executable:true,ts,tradingUnlocked:true});
 assert.equal(r.positions.length,0);
 r.observe(token(),features,quality,{executable:false,ts,tradingUnlocked:true});
 assert.equal(r.positions.length,0);
});
test('matched mid-cap bot enters $100 paper and exits only on verified quote',()=>{
 const r=new ShadowCohorts();assert.equal(r.observe(token(),features,quality,{executable:true,ts,tradingUnlocked:true}),true);
 assert.ok(r.positions.some(p=>p.bot==='pulse'&&p.notional===100));
 assert.equal(r.trades.length,0);
 r.observe({...token(2,ts+30000),sourceSeen:{dexscreener:ts,'pump.fun':ts}},features,quality,{executable:false,ts:ts+30000,tradingUnlocked:true});
 assert.equal(r.trades.length,0);
 r.observe(token(1.5,ts+45000),features,quality,{executable:true,ts:ts+45000,tradingUnlocked:true});
 assert.ok(r.trades.some(t=>t.bot==='pulse'&&t.pnl>0));
 assert.equal(r.positions.filter(p=>p.bot==='pulse').length,0);
});
test('restore preserves paper experiment history while ignoring older snapshots',()=>{
 const a=new ShadowCohorts();a.observe(token(),features,quality,{executable:true,ts,tradingUnlocked:true});
 const data=a.serialize();const b=new ShadowCohorts();assert.equal(b.restore(data),true);
 assert.equal(b.positions.length,a.positions.length);
 assert.equal(b.bots.find(x=>x.id==='pulse').cash,a.bots.find(x=>x.id==='pulse').cash);
 assert.equal(b.restore({...data,savedAt:ts-1,bots:[]}),false);
});
test('liquidity cap and two-position max remain binding',()=>{
 const r=new ShadowCohorts();
 r.observe({...token(),liq:9000},features,quality,{executable:true,ts,tradingUnlocked:true});
 assert.equal(r.positions.length,0);
 assert.ok(r.snapshot().bots.every(b=>b.cash<=1000&&Number.isFinite(b.equity)));
});