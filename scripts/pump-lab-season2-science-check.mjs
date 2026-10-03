import {createPumpLabSeason2Science} from '../lib/pump-lab-season2-science.mjs';
const ok=(x,m)=>{if(!x)throw new Error(m)};
const s=createPumpLabSeason2Science({start:1000});
const base=Date.now()-31*60000;
const token={mint:'MintScience111',symbol:'SCI',name:'Science Cat',narrative:'Cats',price:1,mc:80000,liq:18000,buys:18,sells:7,creator:'Creator1',createdAt:base,updatedAt:Date.now(),website:'https://science.example',twitter:'science'};
const features={momentum:70,acceleration:65,buyRatio:.72,liqScore:68,volScore:72,risk:38,sourceQuality:82,age:31,totalTx:25};
for(let i=0;i<35;i++){const price=1*(1+i*.012);s.observeToken({...token,price,updatedAt:base+i*60000},{features:{...features,age:i},quality:{score:80},market:{regime:'SELECTIVE'}})}
const surv=s.survivalForecast(token,{features,quality:{score:80}});ok(surv.collapsePct[5]!=null,'survival horizons missing');
const p={id:'p1',strategy:'quant',mint:token.mint,opened:Date.now()-10*60000,entry:1.1,entryMc:80000,samplePartition:'train',entryFeatures:features,entryQuality:80};s.recordEntry(p,{...token,price:1.1},{features,quality:{score:80}});for(let i=1;i<=10;i++)s.observePosition(p,{...token,price:1.1*(1+i*.03)},{...features,buyRatio:i>8?.35:.65,momentum:i>8?30:70});p.closedAt=Date.now();p.pnlPct=22;s.recordTrade(p,{...token,price:1.34});
for(let i=0;i<70;i++){const part=i%5===0?'holdout':'train',row={id:'x'+i,strategy:'quant',mint:'m'+i,opened:base+i*1000,closedAt:base+i*1000+60000,pnlPct:(i%4===0?-8:6),samplePartition:part,entryFeatures:{...features,momentum:55+i%15},entryQuality:80,entryMc:80000};s.recordEntry(row,{...token,mint:row.mint,price:1,createdAt:row.opened},{features:row.entryFeatures,quality:{score:80}});s.recordTrade(row,{...token,mint:row.mint,price:1.05});}
const b=s.bayesianConfidence('quant');ok(b.n>=70&&b.probPositive>0,'bayesian confidence missing');
const wf=s.walkForward('quant');ok(wf.windows.length>=1,'walk-forward windows missing');
const e=s.evidenceDecision('quant');ok(e.walkForward&&e.drift,'evidence decision incomplete');
const weak=createPumpLabSeason2Science({start:1000});
for(let i=0;i<6;i++){const row={id:'weak'+i,strategy:'momentum',mint:'weakmint'+i,opened:base+i*1000,closedAt:base+i*1000+60000,pnlPct:-18-i,samplePartition:i===5?'holdout':'train',entryFeatures:features,entryQuality:80,entryMc:80000};weak.recordTrade(row,{...token,mint:row.mint,price:.8});}
const weakEvidence=weak.evidenceDecision('momentum');ok(weakEvidence.status==='QUARANTINE','severe early losing streak should quarantine');ok(weakEvidence.probeOnly&&weakEvidence.sizeMultiplier<=.25&&!weakEvidence.block,'quarantine must throttle to micro-probes without permanent kill');
const ex=s.executionSimulation(token,50,'buy',{fillPrice:1.01,feeRate:.0125,fixedCost:.02},{congestion:30,networkCostUsd:.001});ok(ex.totalLatencyMs>0&&ex.txFailureProbability>0,'execution sim missing');
const gate=s.evaluateEntry({strategy:{id:'quant'},token,features,quality:{score:80},market:{regime:'SELECTIVE'},alpha:{toxicity:{score:20},probability:{pStop15:.2},execution:{congestion:20}},baseExecution:{fillPrice:1.01,feeRate:.0125,fixedCost:.02}});ok(gate.doNothing&&gate.survival&&gate.narrative,'do-nothing model incomplete');
const snap=s.snapshot(['quant']);ok(snap.subsystems.length>=14,'expected upgraded science systems');ok(snap.subsystems.some(x=>x.name==='Feature Importance Lab'),'feature-importance subsystem missing');ok(snap.featureImportance&&Array.isArray(snap.featureImportance.features),'feature-importance report missing');ok(snap.abstention&&snap.entryTiming,'abstention or entry-timing report missing');
const rebuilt=createPumpLabSeason2Science();const rebuiltOut=rebuilt.rebuildFromTradeLedger([
  {id:'r1',strategy:'quant',mint:'rm1',opened:base,closedAt:base+60000,pnlPct:12,samplePartition:'train',entryFeatures:features,entryQuality:80,entryMc:80000,season2ScienceResult:{alphaPct:9,benchmark:{n:4,median:3,mean:2}}},
  {id:'r2',strategy:'quant',mint:'rm2',opened:base+1000,closedAt:base+61000,pnlPct:-6,samplePartition:'holdout',entryFeatures:features,entryQuality:76,entryMc:80000,season2ScienceResult:{alphaPct:-8,benchmark:{n:4,median:2,mean:1}}}
]);ok(rebuiltOut.rebuilt===2&&rebuilt.counters.trades===2,'detailed ledger science rebuild failed');ok(rebuilt.bayesianConfidence('quant').n===2,'rebuilt strategy evidence missing');
const copy=createPumpLabSeason2Science();ok(copy.restore(s.serialize()),'restore failed');const restored=copy.snapshot(['quant']);ok(restored.subsystems.length>=13&&restored.featureImportance,'restored snapshot invalid');
console.log('PUMP LAB Season 2 Science checks passed: 14+ systems + early quarantine + evidence labs + ledger rebuild + persistence');
