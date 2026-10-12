import test from 'node:test';
import assert from 'node:assert/strict';
import {assessFunnel,ResearchFunnel} from '../lib/pump-lab-research-funnel.mjs';
const base={mint:'mint1',symbol:'MOON',price:.001,mc:150000,liq:40000,ageMin:12,tx:38,buysPct:.67,
 flowFresh:true,risk:29,score:87,quality:86,quoteFresh:true,continuousPath:true,crossSource:true,
 authoritiesKnown:false,authorityOpen:false,observedSocial:false,memeEligible:true};
const token=(mint,fields={})=>({mint,symbol:mint,mc:base.mc,liq:base.liq,price:base.price,...fields});
const features=(fields={})=>({age:base.ageMin,totalTx:base.tx,buyRatio:base.buysPct,flowFresh:true,risk:base.risk,score:base.score,...fields});
const quality=(fields={})=>({score:base.quality,sourceCount:2,...fields});
const opts=(ts=1000000,fields={})=>({ts,quoteFresh:true,continuousPath:true,memeEligible:true,...fields});
test('only genuine fields make it through cheap and trade-stage cuts',()=>{
 assert.equal(assessFunnel({...base,mc:null}).reason,'missing_metrics');
 assert.equal(assessFunnel({...base,flowFresh:false}).stage,'TRADE');
 assert.equal(assessFunnel({...base,tx:21,buysPct:1}).reason,'no_sellers');
 assert.equal(assessFunnel({...base,mc:2000000}).stage,'FREE');
});
test('fresh source and execution path are required, rather than treating null as safe',()=>{
 assert.equal(assessFunnel({...base,crossSource:false}).reason,'price_path_unverified');
 assert.equal(assessFunnel({...base,continuousPath:false}).reason,'price_path_unverified');
 assert.equal(assessFunnel({...base,sourceDisagreement:true}).reason,'source_disagreement');
 assert.equal(assessFunnel({...base,authorityOpen:true}).reason,'authority_open');
});
test('strict no trade decision when no candidate qualifies',()=>{
 const f=new ResearchFunnel({clock:()=>1000000});const p=f.choose();
 assert.equal(p.action,'NO_TRADE');assert.equal(p.mint,null);assert.equal(p.notRealOrder,true);
});
test('typed paper shortlist selects verified best and never represents ranking as probability',()=>{
 const f=new ResearchFunnel({clock:()=>1000000});
 assert.equal(f.observe(token('first'),features({score:82}),quality(),opts()),true);
 assert.equal(f.observe(token('second'),features({score:90}),quality(),opts()),true);
 assert.equal(f.choose().mint,'second');assert.equal(f.choose().notCalibratedProbability,true);
 assert.equal(f.snapshot().eligible,2);
});
test('reason-based cooldown avoids repeated rejected token analysis',()=>{
 let t=1000000;const f=new ResearchFunnel({clock:()=>t});
 assert.equal(f.observe(token('x',{liq:100}),features(),quality(),opts(t)),true);
 t+=25000;assert.equal(f.observe(token('x',{liq:100}),features(),quality(),opts(t)),false);
 assert.equal(f.snapshot().benchSkips,1);
 t+=90001;assert.equal(f.observe(token('x',{liq:40000}),features(),quality(),opts(t)),true);
 assert.equal(f.choose().mint,'x');
});
test('does not fetch any paid model or source and keeps research ledger separate from five bots',()=>{
 const f=new ResearchFunnel({clock:()=>1000000});
 f.observe(token('only'),features(),quality(),opts());
 const state=f.serialize();assert.ok(!Object.hasOwn(state,'positions')&&!Object.hasOwn(state,'trades'));
 assert.equal(f.snapshot().paperOnly,true);
});
test('snapshot restore preserves cooldown and recent paper choices',()=>{
 const f=new ResearchFunnel({clock:()=>1000000});
 f.observe(token('one'),features(),quality(),opts());f.choose();
 const next=new ResearchFunnel({clock:()=>1000000});
 assert.equal(next.restore(f.serialize()),true);
 assert.equal(next.choose().action,'SHADOW_PICK');
 assert.equal(next.snapshot().observed,1);
});
test('stale candidates disappear and abstain instead of repurchasing stale picks',()=>{
 let t=1000000;const f=new ResearchFunnel({clock:()=>t});
 f.observe(token('one'),features(),quality(),opts());
 t+=600000;assert.equal(f.choose().action,'NO_TRADE');
});
