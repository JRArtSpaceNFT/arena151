import {createPumpLabLifecycleResearch} from '../lib/pump-lab-lifecycle-research.mjs';
const ok=(x,m)=>{if(!x)throw new Error(m)};
const l=createPumpLabLifecycleResearch({start:1000}),base=Date.now()-20*60000;
let t={mint:'Life111',symbol:'LIFE',name:'Life Cat',narrative:'Cats',price:.00002,mc:20000,liq:8000,creator:'CreatorA',createdAt:base,twitter:'life',website:'https://life.example',graduated:false};
const f={momentum:65,acceleration:62,buyRatio:.68,shortRet:4,age:1,graduation:29,social:60,sourceQuality:70,creatorRisk:10,chart:{chartQuality:70,spikeRisk:20},meme:{survival:60,crowdingRisk:15}};
for(let i=0;i<8;i++)l.observeWalletEvent({mint:t.mint,wallet:'W'+i,action:'BUY',tokenDelta:1000+i*10,notionalUsd:10+i,price:t.price,mc:t.mc,slot:100+i,ts:Date.now()-8000+i*1000},t);
let s=l.observeToken(t,{features:f,quality:{score:80},market:{regime:'SELECTIVE'}});ok(s.organic.uniqueBuyers===8,'unique buyers');ok(s.entry&&s.mcJourney,'entry journey');
for(let i=1;i<=20;i++){t={...t,price:t.price*1.04,mc:20000*Math.pow(1.08,i),graduated:i>=12};s=l.observeToken(t,{features:{...f,age:i,graduation:Math.min(100,29+i*5)},quality:{score:82},market:{regime:'HOT'}})}
ok(l.get(t.mint).mcCrossings[25000],'mc crossing');ok(l.get(t.mint).graduatedAt,'graduation transition');
const p={id:'p1',mint:t.mint,strategy:'quant',entry:t.price,entryMc:t.mc,opened:Date.now()-60000};l.recordEntry(p,t);p.pnlPct=20;p.mfe=35;p.mae=-5;p.executionStress={penalty:3};l.recordTrade(p,t);
l.recordDecision({ts:Date.now()-1000,mint:t.mint,strategy:'quant',action:'REJECT',price:t.price,mc:t.mc,why:'test'},t);
const snap=l.snapshot();ok(snap.stages.length===22,'22 lifecycle stages');ok(snap.perfectCoinBoard.length===1,'perfect coin board');ok(snap.samples.tokens===1,'token sample');
const copy=createPumpLabLifecycleResearch();ok(copy.restore(l.serialize()),'restore');ok(copy.snapshot().stages.length===22,'restored stages');
console.log('PUMP LAB v4.1 lifecycle checks passed: 22 stages + persistence');
