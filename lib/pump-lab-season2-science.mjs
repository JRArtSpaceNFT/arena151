const HORIZONS_MIN=[1,3,5,10,30];
const FEATURE_KEYS=['momentum','acceleration','buyRatio','liqScore','volScore','risk','sourceQuality','age'];
const now=()=>Date.now();
const num=x=>Number.isFinite(Number(x))?Number(x):0;
const clamp=(x,a=0,b=100)=>Math.max(a,Math.min(b,Number.isFinite(x)?x:a));
const pct=(a,b)=>b?((a/b)-1)*100:0;
const avg=a=>a.length?a.reduce((s,x)=>s+num(x),0)/a.length:0;
const median=a=>{const x=a.filter(Number.isFinite).slice().sort((m,n)=>m-n);if(!x.length)return 0;const i=Math.floor(x.length/2);return x.length%2?x[i]:(x[i-1]+x[i])/2};
const stdev=a=>{if(a.length<2)return 0;const m=avg(a);return Math.sqrt(avg(a.map(x=>(x-m)**2)))};
const safe=o=>JSON.parse(JSON.stringify(o??null));
function stableHash(s=''){let h=2166136261;for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619)}return h>>>0}
function erf(x){const s=x<0?-1:1,a=Math.abs(x),t=1/(1+.3275911*a);const y=1-(((((1.061405429*t-1.453152027)*t+1.421413741)*t-0.284496736)*t+.254829592)*t)*Math.exp(-a*a);return s*y}
const normCdf=z=>.5*(1+erf(z/Math.sqrt(2)));
function corr(xs,ys){if(xs.length<3||ys.length!==xs.length)return 0;const mx=avg(xs),my=avg(ys),sx=Math.sqrt(xs.reduce((s,x)=>s+(x-mx)**2,0)),sy=Math.sqrt(ys.reduce((s,y)=>s+(y-my)**2,0));if(!sx||!sy)return 0;return xs.reduce((s,x,i)=>s+(x-mx)*(ys[i]-my),0)/(sx*sy)}
function slug(x=''){return String(x).toLowerCase().replace(/https?:\/\//g,' ').replace(/[^a-z0-9]+/g,' ').trim().split(/\s+/).filter(x=>x.length>1).slice(0,10)}
function jaccard(a,b){const A=new Set(a),B=new Set(b);if(!A.size&&!B.size)return 1;let i=0;for(const x of A)if(B.has(x))i++;return i/Math.max(1,new Set([...A,...B]).size)}
function nearest(series,ts,maxGap=60000){let best=null,d=Infinity;for(const x of series){const q=Math.abs(num(x.ts)-ts);if(q<d){best=x;d=q}}return d<=maxGap?best:null}
function mcBand(mc){mc=num(mc);if(mc<25000)return'u25';if(mc<50000)return'25_50';if(mc<100000)return'50_100';if(mc<250000)return'100_250';if(mc<500000)return'250_500';if(mc<1000000)return'500_1m';return'1m_plus'}

export class PumpLabSeason2Science {
  constructor(opts={}){
    this.version='v4.0-season2-science';this.start=num(opts.start)||1000;
    this.tokens=new Map();this.launches=[];this.survivalCases=[];this.strategyTrades=new Map();this.entries=new Map();this.exitLabs=[];this.familyStats=new Map();this.featureOutcomes=new Map();this.vetoLog=[];this.executionLog=[];this.tokenGateCache=new Map();this.evidenceCache=new Map();
    this.counters={tokens:0,entries:0,trades:0,vetoes:0,executionSims:0,walkForwardRuns:0};
  }
  tokenSeries(mint){let r=this.tokens.get(mint);if(!r){r={mint,firstTs:0,firstPrice:0,firstMc:0,series:[],horizons:{},meta:{}};this.tokens.set(mint,r)}return r}
  narrativeSaturation(t){
    const ts=now(),terms=slug(`${t?.name||''} ${t?.symbol||''} ${t?.narrative||''}`),cut=ts-20*60000;this.launches=this.launches.filter(x=>x.ts>=cut);
    const peers=this.launches.filter(x=>x.mint!==t?.mint),similar=peers.map(x=>({...x,sim:jaccard(terms,x.terms)})).filter(x=>x.sim>=.45),clones=similar.filter(x=>x.sim>=.68),sameNarrative=peers.filter(x=>x.narrative===(t?.narrative||'Memes'));
    const density=clamp(clones.length*16+similar.length*7+Math.max(0,sameNarrative.length-3)*3),novelty=clamp(100-density);
    return{windowMin:20,peers:peers.length,similar:similar.length,clones:clones.length,sameNarrative:sameNarrative.length,density,novelty,topMatches:similar.sort((a,b)=>b.sim-a.sim).slice(0,5).map(x=>({mint:x.mint,symbol:x.symbol,sim:x.sim}))};
  }
  familyDNA(t,ctx={}){
    const creator=t?.creator||'unknown',terms=slug(`${t?.name||''} ${t?.symbol||''}`),site=(()=>{try{return new URL(t?.website||'').hostname.replace(/^www\./,'')}catch{return''}})();
    const wallets=[...(ctx.earlyWallets||[]),...(ctx.funders||[])].filter(Boolean).map(String).sort().slice(0,8),meta=[site,(t?.twitter||'').replace(/^@/,''),terms.slice(0,4).join('_')].filter(Boolean);
    const components=[creator,...wallets,...meta],key='fam_'+stableHash(components.join('|')).toString(36),row=this.familyStats.get(key)||{key,creator,launches:0,collapses:0,graduates:0,mints:[],wallets,metadata:meta,last:0};
    if(!row.mints.includes(t?.mint)){row.mints.push(t?.mint);row.launches++}row.mints=row.mints.slice(-80);row.last=now();if(t?.graduated)row.graduates=Math.max(row.graduates,1);this.familyStats.set(key,row);
    return{key,observedOnly:true,creator,launches:row.launches,collapses:row.collapses,graduates:row.graduates,wallets:row.wallets,metadata:row.metadata};
  }
  observeToken(t,ctx={}){
    if(!t?.mint||!(num(t.price)>0))return null;this.counters.tokens++;const ts=now(),r=this.tokenSeries(t.mint);if(!r.firstTs){r.firstTs=num(t.createdAt)||ts;r.firstPrice=num(t.price);r.firstMc=num(t.mc)}
    const snap={ts,price:num(t.price),mc:num(t.mc),liq:num(t.liq),buys:num(t.buys),sells:num(t.sells),features:safe(ctx.features||{}),quality:num(ctx.quality?.score||ctx.quality||0),market:safe(ctx.market||{}),alpha:safe(ctx.alpha||{})};r.series.push(snap);r.series=r.series.filter(x=>ts-x.ts<=45*60000).slice(-900);
    r.meta={symbol:t.symbol,name:t.name,narrative:t.narrative,creator:t.creator,website:t.website,twitter:t.twitter,graduated:!!t.graduated};
    if(!this.launches.some(x=>x.mint===t.mint)){this.launches.push({ts:r.firstTs||ts,mint:t.mint,symbol:t.symbol,narrative:t.narrative||'Memes',terms:slug(`${t.name||''} ${t.symbol||''} ${t.narrative||''}`)})}
    const sat=this.narrativeSaturation(t),family=this.familyDNA(t,ctx);this.settleSurvival(t,r,ctx,sat,family);this.updateEntryCounterfactuals(t,r);const survival=this.survivalForecast(t,ctx,sat,family);const gate={ts,narrative:sat,family,survival};this.tokenGateCache.set(t.mint,gate);if(this.tokenGateCache.size>2000){const old=[...this.tokenGateCache.entries()].sort((a,b)=>a[1].ts-b[1].ts).slice(0,this.tokenGateCache.size-1500);for(const [k] of old)this.tokenGateCache.delete(k)}return gate;
  }
  settleSurvival(t,r,ctx,sat,family){
    const age=(now()-r.firstTs)/60000;if(!(r.firstPrice>0))return;for(const h of HORIZONS_MIN){if(r.horizons[h]||age<h)continue;const s=nearest(r.series,r.firstTs+h*60000,120000)||r.series.at(-1),ret=pct(num(s?.price),r.firstPrice),collapsed=ret<=-50||num(s?.price)<=0;r.horizons[h]={ts:num(s?.ts)||now(),ret,collapsed};
      this.survivalCases.push({mint:t.mint,horizon:h,collapsed,ret,features:safe(ctx.features||{}),quality:num(ctx.quality?.score||ctx.quality||0),mc:r.firstMc,liq:num(s?.liq),narrative:t.narrative||'Memes',saturation:sat.density,family:family.key});this.survivalCases=this.survivalCases.slice(-12000);if(collapsed){const fs=this.familyStats.get(family.key);if(fs)fs.collapses++}
    }
  }
  survivalForecast(t,ctx={},sat=this.narrativeSaturation(t),family=this.familyDNA(t,ctx)){
    const f=ctx.features||{},age=num(f.age)||Math.max(0,(now()-(num(t?.createdAt)||now()))/60000),baseRisk=clamp(num(f.risk)||50),liq=Math.max(1,num(t?.liq)),tx=num(f.totalTx)||num(t?.buys)+num(t?.sells),source=num(f.sourceQuality)||50;
    const out={};for(const h of HORIZONS_MIN){const empirical=this.survivalCases.filter(x=>x.horizon===h&&mcBand(x.mc)===mcBand(t?.mc)).slice(-500),emp=empirical.length?empirical.filter(x=>x.collapsed).length/empirical.length:null;
      const horizonLift={1:-8,3:-2,5:3,10:8,30:14}[h];let p=.18+baseRisk/180+horizonLift/100+sat.density/280+(liq<5000?.12:liq<12000?.05:0)+(tx<6?.09:0)+(source<40?.08:0)+(age<.5?.06:0)+(family.collapses>=2?.10:0)-(t?.graduated?.10:0);if(emp!=null)p=p*.62+emp*.38;out[h]=clamp(p*100,1,97)}
    return{collapsePct:out,model:'empirical-bayes-hazard-v1',sample:this.survivalCases.length};
  }
  bayesianConfidence(strategyId,partition=null){
    const rows=(this.strategyTrades.get(strategyId)||[]).filter(x=>!partition||x.partition===partition),xs=rows.map(x=>num(x.pnlPct)),n=xs.length,priorN=8,priorMean=-1.0,m=avg(xs),sd=Math.max(8,stdev(xs)||20),postMean=(priorMean*priorN+m*n)/(priorN+n),se=sd/Math.sqrt(Math.max(1,n+priorN)),z=postMean/se,p=normCdf(z);
    return{n,posteriorMean:postMean,probPositive:p,probNegative:1-p,credibleLow:postMean-1.64*se,credibleHigh:postMean+1.64*se,prior:'conservative -1% / 8 pseudo-trades'};
  }
  walkForward(strategyId){
    const rows=(this.strategyTrades.get(strategyId)||[]).slice().sort((a,b)=>a.closedAt-b.closedAt),trainN=40,testN=15,step=15,windows=[];for(let i=0;i+trainN+testN<=rows.length;i+=step){const train=rows.slice(i,i+trainN),test=rows.slice(i+trainN,i+trainN+testN),tm=avg(train.map(x=>x.pnlPct)),hm=avg(test.map(x=>x.pnlPct)),alpha=avg(test.map(x=>x.alphaPct));windows.push({start:train[0]?.closedAt,end:test.at(-1)?.closedAt,trainN,testN,trainMean:tm,testMean:hm,testAlpha:alpha,passed:hm>0&&alpha>0})}
    this.counters.walkForwardRuns++;return{strategyId,windows,positivePct:windows.length?windows.filter(x=>x.passed).length/windows.length*100:0,latest:windows.at(-1)||null,trainN,testN,step};
  }
  featureDrift(strategyId){
    const rows=(this.featureOutcomes.get(strategyId)||[]).slice(-240);if(rows.length<30)return{strategyId,n:rows.length,score:0,status:'collecting',features:[]};const split=Math.max(15,Math.floor(rows.length*.65)),base=rows.slice(0,split),recent=rows.slice(split),features=[];
    for(const k of FEATURE_KEYS){const a=base.map(x=>num(x.features?.[k])),b=recent.map(x=>num(x.features?.[k])),scale=Math.max(1,stdev(a)),shift=Math.abs(avg(b)-avg(a))/scale,ca=corr(a,base.map(x=>x.pnlPct)),cb=corr(b,recent.map(x=>x.pnlPct)),predictiveBreak=Math.abs(cb-ca),score=clamp(shift*32+predictiveBreak*55);features.push({key:k,shift,predictiveBefore:ca,predictiveNow:cb,score})}
    const score=Math.max(...features.map(x=>x.score));return{strategyId,n:rows.length,score,status:score>=70?'high':score>=45?'watch':'stable',features:features.sort((a,b)=>b.score-a.score)};
  }
  evidenceDecision(strategyId){
    const all=this.bayesianConfidence(strategyId),hold=this.bayesianConfidence(strategyId,'holdout'),wf=this.walkForward(strategyId),drift=this.featureDrift(strategyId);let status='COLLECTING',block=false,reason='collecting evidence';
    if(all.n>=30&&hold.n>=8&&all.probPositive<.12&&hold.probPositive<.20&&wf.windows.length>=2&&wf.positivePct<35){status='KILL';block=true;reason='posterior expectancy and walk-forward evidence are negative'}
    else if(all.n>=40&&hold.n>=12&&all.probPositive>.90&&hold.probPositive>.80&&wf.windows.length>=2&&wf.positivePct>=60&&drift.score<70){status='PROMOTION CANDIDATE';reason='repeatable positive expectancy after costs; manual promotion only'}
    else if(all.n>=20&&(all.probPositive<.30||drift.score>=70)){status='WATCH';reason=drift.score>=70?'feature relationship drift':'weak posterior expectancy'}
    return{strategyId,status,block,reason,bayesian:all,holdout:hold,walkForward:wf,drift,autoPromotion:false};
  }
  evidenceDecisionCached(strategyId,ttlMs=30000){
    const hit=this.evidenceCache.get(strategyId),ts=now();
    if(hit&&ts-hit.ts<ttlMs)return hit.value;
    const value=this.evidenceDecision(strategyId);this.evidenceCache.set(strategyId,{ts,value});
    return value;
  }
  tokenGateCached(token,features={},quality={}){
    const hit=this.tokenGateCache.get(token?.mint);
    if(hit&&now()-hit.ts<5000)return hit;
    const sat=this.narrativeSaturation(token),family=this.familyDNA(token,{}),survival=this.survivalForecast(token,{features,quality},sat,family),gate={ts:now(),narrative:sat,family,survival};
    if(token?.mint)this.tokenGateCache.set(token.mint,gate);return gate;
  }
  executionSimulation(t,notional,side='buy',base={},alphaExec={}){
    const series=this.tokenSeries(t?.mint).series,vol=series.length>2?stdev(series.slice(-12).map((x,i,a)=>i?pct(x.price,a[i-1].price):0).slice(1)):0,congestion=clamp(num(alphaExec?.congestion)||0),sourceAgeMs=Math.max(0,now()-num(t?.updatedAt||now())),detectionMs=Math.min(2500,180+sourceAgeMs*.25),decisionMs=180+clamp(vol*8,0,520),networkMs=420+congestion*12,totalMs=detectionMs+decisionMs+networkMs;
    const recent=series.slice(-8),velocity=recent.length>1?pct(recent.at(-1).price,recent[0].price)/Math.max(1,(recent.at(-1).ts-recent[0].ts)/1000):0,latencyDriftPct=velocity*(totalMs/1000),failPct=clamp(1.5+congestion*.28+Math.max(0,vol-10)*.55+(sourceAgeMs>5000?8:0),1,45),baseFill=num(base.fillPrice)||num(t?.price),direction=side==='buy'?1:-1,fillPrice=baseFill*(1+direction*latencyDriftPct/100),feeRate=num(base.feeRate),fixedCost=num(base.fixedCost)+num(alphaExec?.networkCostUsd),expectedFailureCost=(failPct/100)*(fixedCost+Math.max(.001,num(notional)*.001));
    const out={...safe(base),side,fillPrice,detectionMs,decisionMs,networkMs,totalLatencyMs:totalMs,latencyDriftPct,txFailureProbability:failPct/100,expectedFailureCost,networkCostUsd:num(alphaExec?.networkCostUsd),priorityLamports:num(alphaExec?.priorityLamports),jitoTipLamports:num(alphaExec?.jitoTipLamports),executionMode:alphaExec?.mode||'STANDARD_RPC',model:'season2-execution-reality-v1'};this.executionLog.unshift({ts:now(),mint:t?.mint,notional,side,...out});this.executionLog=this.executionLog.slice(0,2500);this.counters.executionSims++;return out;
  }
  marketReturnBetween(start,end,excludeMint='',band=null){
    const rs=[];for(const [mint,r] of this.tokens){if(mint===excludeMint)continue;const a=nearest(r.series,start,90000),b=nearest(r.series,end,90000);if(!a||!b||!(a.price>0)||!(b.price>0))continue;if(band&&mcBand(a.mc)!==band)continue;rs.push(pct(b.price,a.price))}return{n:rs.length,median:median(rs),mean:avg(rs)};
  }
  entryCounterfactual(position,t){
    const r=this.tokenSeries(t.mint),ts=num(position.opened)||now(),entry=num(position.entry)||num(t.price),back15=nearest(r.series,ts-15000,12000),back30=nearest(r.series,ts-30000,16000);return{id:position.id,strategy:position.strategy,mint:t.mint,opened:ts,entry,actual:null,earlier15:back15?.price?pct(num(t.price),back15.price):null,earlier30:back30?.price?pct(num(t.price),back30.price):null,later15:null,later30:null,firstPullback:null,retest:null,minAfter:entry,maxAfter:entry};
  }
  recordEntry(position,t,ctx={}){if(!position?.id||!t?.mint)return;this.counters.entries++;this.entries.set(position.id,{...this.entryCounterfactual(position,t),features:safe(ctx.features||position.entryFeatures||{}),quality:num(ctx.quality?.score||position.entryQuality),partition:position.samplePartition||'train',market:safe(ctx.market||{}),path:[{ts:now(),price:num(t.price),buyRatio:num(ctx.features?.buyRatio)}]});}
  updateEntryCounterfactuals(t,r){for(const e of this.entries.values()){if(e.mint!==t.mint||e.closed)continue;const age=(now()-e.opened)/1000,price=num(t.price);e.path.push({ts:now(),price,buyRatio:num(r.series.at(-1)?.features?.buyRatio)});e.path=e.path.slice(-800);e.minAfter=Math.min(e.minAfter||price,price);e.maxAfter=Math.max(e.maxAfter||price,price);if(age>=15&&e.later15==null)e.later15=pct(price,e.entry);if(age>=30&&e.later30==null)e.later30=pct(price,e.entry);if(e.firstPullback==null&&pct(price,e.maxAfter)<=-8)e.firstPullback=pct(price,e.entry);if(e.retest==null&&e.firstPullback!=null&&price>=e.entry)e.retest=pct(price,e.entry)}}
  observePosition(position,t,features={}){const e=this.entries.get(position?.id);if(!e||e.closed)return;e.path.push({ts:now(),price:num(t?.price),buyRatio:num(features?.buyRatio),momentum:num(features?.momentum)});e.path=e.path.slice(-900)}
  exitCounterfactuals(entry){
    const path=entry.path||[],ep=entry.entry;if(!path.length||!(ep>0))return{};const ret=x=>pct(num(x?.price),ep),first=(fn)=>path.find(fn),last=path.at(-1),peakTrack=[];let peak=ep;for(const x of path){peak=Math.max(peak,num(x.price));peakTrack.push({x,peak})}
    const trailing=peakTrack.find(q=>pct(num(q.x.price),q.peak)<=-15&&pct(q.peak,ep)>=15)?.x,structure=path.find(x=>num(x.momentum)>0&&num(x.momentum)<38),attention=path.find(x=>num(x.buyRatio)>0&&num(x.buyRatio)<.40),at5=nearest(path,entry.opened+5*60000,90000),at15=nearest(path,entry.opened+15*60000,120000);
    return{stop10:ret(first(x=>ret(x)<=-10)||last),stop15:ret(first(x=>ret(x)<=-15)||last),stop20:ret(first(x=>ret(x)<=-20)||last),take25:ret(first(x=>ret(x)>=25)||last),take50:ret(first(x=>ret(x)>=50)||last),trailing15:ret(trailing||last),structureBreak:ret(structure||last),time5m:ret(at5||last),time15m:ret(at15||last),attentionDecay:ret(attention||last),actual:num(entry.actual)};
  }
  recordTrade(position,t,ctx={}){
    if(!position?.strategy)return null;this.counters.trades++;const e=this.entries.get(position.id)||{id:position.id,strategy:position.strategy,mint:position.mint,opened:position.opened,entry:position.entry,path:[]};e.closed=true;e.closedAt=num(position.closedAt)||now();e.actual=num(position.pnlPct);const bench=this.marketReturnBetween(num(position.opened),e.closedAt,position.mint,mcBand(position.entryMc||t?.mc)),alpha=e.actual-bench.median,exitCounterfactuals=this.exitCounterfactuals(e);e.benchmark=bench;e.alphaPct=alpha;e.exitCounterfactuals=exitCounterfactuals;
    const row={strategy:position.strategy,mint:position.mint,opened:num(position.opened),closedAt:e.closedAt,pnlPct:e.actual,alphaPct:alpha,partition:position.samplePartition||e.partition||'train',features:safe(position.entryFeatures||e.features||{}),quality:num(position.entryQuality||e.quality),executionStress:safe(position.executionStress||{}),benchmark:bench};let arr=this.strategyTrades.get(position.strategy)||[];arr.push(row);arr=arr.slice(-1200);this.strategyTrades.set(position.strategy,arr);let fo=this.featureOutcomes.get(position.strategy)||[];fo.push({features:row.features,pnlPct:row.pnlPct,alphaPct:row.alphaPct,closedAt:row.closedAt});this.featureOutcomes.set(position.strategy,fo.slice(-500));this.exitLabs.unshift({id:e.id,strategy:e.strategy,mint:e.mint,actual:e.actual,methods:exitCounterfactuals});this.exitLabs=this.exitLabs.slice(0,2500);this.entries.delete(position.id);return{benchmark:bench,alphaPct:alpha,exitCounterfactuals,evidence:this.evidenceDecision(position.strategy)};
  }
  evaluateEntry({strategy,token,features={},quality={},market={},alpha={},baseExecution={}}={}){
    const shared=this.tokenGateCached(token,features,quality),sat=shared.narrative,family=shared.family,survival=shared.survival,exec=this.executionSimulation(token,Math.max(5,num(baseExecution?.notional)||20),'buy',baseExecution,alpha?.execution||{}),evidence=this.evidenceDecisionCached(strategy?.id||'unknown'),drift=evidence.drift;
    const collapse5=num(survival.collapsePct?.[5]),riskOff=String(market?.regime||'').includes('RISK'),tox=num(alpha?.toxicity?.score),pStop=clamp(num(alpha?.probability?.pStop15)*100),q=num(quality?.score||quality),score=clamp(collapse5*.34+sat.density*.18+exec.txFailureProbability*100*.14+drift.score*.12+tox*.10+pStop*.08+(riskOff?8:0)+(q<50?8:0));
    const reasons=[];if(evidence.block)reasons.push('strategy evidence kill switch');if(collapse5>=65)reasons.push('5m collapse hazard');if(sat.density>=75)reasons.push('narrative saturation');if(exec.txFailureProbability>=.28)reasons.push('execution failure risk');if(drift.score>=78)reasons.push('feature drift');if(tox>=78)reasons.push('toxic flow');if(pStop>=80)reasons.push('loss probability');
    const veto=evidence.block||score>=78;const out={veto,score,reasons,survival,narrative:sat,family,execution:exec,evidence,doNothing:{veto,score,reasons,model:'global-abstention-v1'}};if(veto){this.counters.vetoes++;this.vetoLog.unshift({ts:now(),strategy:strategy?.id,mint:token?.mint,score,reasons});this.vetoLog=this.vetoLog.slice(0,2500)}return out;
  }
  subsystemStatus(){return[
    ['Walk Forward Testing',true,'rolling 40-trade train / 15-trade unseen test windows'],['Bayesian Strategy Confidence',true,'conservative posterior probability of positive expectancy'],['Meme Coin Survival Model',true,'1/3/5/10/30 minute empirical-Bayes collapse hazards'],['Creator + Wallet Cluster DNA',true,'observed creator/funder/early-wallet/metadata family signatures'],['Copycat / Narrative Saturation',true,'20-minute fuzzy clone density + novelty'],['Execution Reality Simulator',true,'latency, drift, slippage, fees, priority cost and failure probability'],['Entry Timing Counterfactuals',true,'earlier/later/pullback/retest replay'],['Exit Counterfactuals',true,'10 alternate exit policies per completed trade'],['Feature Drift Alarm',true,'distribution shift + predictive relationship break'],['Evidence Strategy Kill Switch',true,'Bayesian + holdout + walk-forward retirement evidence'],['Market Relative Performance',true,'market-cap-band benchmark alpha'],['Ultimate Do Nothing Model',true,'global abstention veto above individual strategies']
  ].map(([name,ok,detail])=>({name,ok,detail}));}
  snapshot(strategyIds=[]){
    const ids=strategyIds.length?strategyIds:[...this.strategyTrades.keys()],strategies=ids.map(id=>this.evidenceDecision(id)).sort((a,b)=>b.bayesian.probPositive-a.bayesian.probPositive);return{version:this.version,paperOnly:true,subsystems:this.subsystemStatus(),counters:{...this.counters},strategies,topFamilies:[...this.familyStats.values()].sort((a,b)=>b.launches-a.launches).slice(0,20),recentVetoes:this.vetoLog.slice(0,30),execution:{n:this.executionLog.length,avgFailurePct:avg(this.executionLog.map(x=>num(x.txFailureProbability)*100)),avgLatencyMs:avg(this.executionLog.map(x=>num(x.totalLatencyMs)))},survivalSamples:this.survivalCases.length,exitCounterfactuals:this.exitLabs.slice(0,30)};}
  serialize(){return{version:this.version,counters:this.counters,tokens:[...this.tokens].map(([k,v])=>[k,{...v,series:v.series.slice(-300)}]),launches:this.launches.slice(-1200),survivalCases:this.survivalCases.slice(-6000),strategyTrades:[...this.strategyTrades],entries:[...this.entries],exitLabs:this.exitLabs.slice(0,1200),familyStats:[...this.familyStats],featureOutcomes:[...this.featureOutcomes],vetoLog:this.vetoLog.slice(0,1200),executionLog:this.executionLog.slice(0,1200)};}
  restore(s){try{if(!s)return false;this.tokenGateCache.clear();this.evidenceCache.clear();this.counters={...this.counters,...(s.counters||{})};this.tokens=new Map(s.tokens||[]);this.launches=s.launches||[];this.survivalCases=s.survivalCases||[];this.strategyTrades=new Map(s.strategyTrades||[]);this.entries=new Map(s.entries||[]);this.exitLabs=s.exitLabs||[];this.familyStats=new Map(s.familyStats||[]);this.featureOutcomes=new Map(s.featureOutcomes||[]);this.vetoLog=s.vetoLog||[];this.executionLog=s.executionLog||[];return true}catch{return false}}
  reset(){const fresh=new PumpLabSeason2Science({start:this.start});this.restore(fresh.serialize())}
}
export function createPumpLabSeason2Science(opts={}){return new PumpLabSeason2Science(opts)}
