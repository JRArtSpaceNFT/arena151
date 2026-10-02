const MC_LEVELS=[10000,15000,25000,50000,75000,100000,150000,250000,500000,1000000];
const CURVE_LEVELS=[10,25,50,70,80,90,95,100];
const HORIZONS_MS=[15000,30000,60000,120000,180000,300000,600000,900000,1800000,3600000];
const TARGETS=[{up:25,down:-15},{up:50,down:-20},{up:100,down:-30}];
const now=()=>Date.now();
const num=x=>Number.isFinite(Number(x))?Number(x):0;
const clamp=(x,a=0,b=100)=>Math.max(a,Math.min(b,Number.isFinite(x)?x:a));
const pct=(a,b)=>b?((a/b)-1)*100:0;
const avg=a=>a.length?a.reduce((s,x)=>s+num(x),0)/a.length:0;
const median=a=>{const x=a.filter(Number.isFinite).slice().sort((a,b)=>a-b);if(!x.length)return 0;const i=Math.floor(x.length/2);return x.length%2?x[i]:(x[i-1]+x[i])/2};
const safe=o=>JSON.parse(JSON.stringify(o??null));
const band=mc=>{mc=num(mc);if(mc<15000)return'<15K';if(mc<25000)return'15-25K';if(mc<50000)return'25-50K';if(mc<75000)return'50-75K';if(mc<100000)return'75-100K';if(mc<150000)return'100-150K';if(mc<250000)return'150-250K';if(mc<500000)return'250-500K';if(mc<1000000)return'500K-1M';return'1M+'};
const bucket=x=>x>=80?'80+':x>=60?'60-79':x>=40?'40-59':x>=20?'20-39':'<20';
function fingerprint(r){return [r.phase||'UNKNOWN',band(r.mc),bucket(r.organic?.score||0),bucket(100-(r.manipulation?.score||0)),r.market?.regime||'UNKNOWN'].join('|')}
function quantile(xs,q=.5){const a=xs.filter(Number.isFinite).slice().sort((x,y)=>x-y);if(!a.length)return 0;return a[Math.min(a.length-1,Math.max(0,Math.round((a.length-1)*q)))]}
function sameSlotRisk(events){const m=new Map();for(const e of events){if(e.slot==null)continue;const k=String(e.slot);if(!m.has(k))m.set(k,new Set());m.get(k).add(e.wallet)}return [...m.values()].filter(s=>s.size>=3).reduce((a,s)=>a+s.size,0)}
function compactWallets(map,limit=200){return [...map.entries()].sort((a,b)=>num(b[1].last)-num(a[1].last)).slice(0,limit)}

export class PumpLabLifecycleResearch{
  constructor(opts={}){
    this.version='v4.1-coin-lifecycle';this.start=num(opts.start)||1000;
    this.tokens=new Map();this.wallets=new Map();this.entryCases=[];this.mcCases=[];this.holdCases=[];this.postGradCases=[];
    this.decisions=[];this.decisionLookup=new Map();this.empiricalCache=new Map();this.holdCache=new Map();this.marketCache={ts:0,value:null};this.missedWinners=[];this.avoidedLosers=[];this.tradeErrors=[];this.completedTrades=[];
    this.counters={tokenObservations:0,walletEvents:0,decisionObservations:0,entries:0,trades:0,mcCrossings:0,curveCrossings:0,settledEntryCases:0,missedWinners:0,avoidedLosers:0};
  }
  get(mint){let r=this.tokens.get(mint);if(!r){r={mint,firstTs:0,firstPrice:0,firstMc:0,lastTs:0,lastPrice:0,lastMc:0,peakPrice:0,peakMc:0,troughPrice:0,troughMc:0,phase:'UNKNOWN',graduatedAt:0,mcCrossings:{},curveCrossings:{},walletBook:new Map(),flow:[],snapshots:[],sampledAt:0,entryExperiments:[],holdMarks:{},meta:{},decisionIds:[]};this.tokens.set(mint,r)}return r}
  observeWalletEvent(e,t={}){
    if(!e?.mint||!e?.wallet||!['BUY','SELL'].includes(e.action))return;
    this.counters.walletEvents++;const r=this.get(e.mint),w=r.walletBook.get(e.wallet)||{wallet:e.wallet,units:0,cost:0,bought:0,sold:0,buys:0,sells:0,first:now(),last:0,watchlist:false,firstBuyMc:0};
    const units=Math.abs(num(e.tokenDelta)),price=num(e.price)||num(t.price),notional=num(e.notionalUsd)||units*price;
    if(e.action==='BUY'){w.units+=units;w.cost+=notional;w.bought+=notional;w.buys++;if(!w.firstBuyMc)w.firstBuyMc=num(e.mc)||num(t.mc)}
    else{const frac=w.units>0?Math.min(1,units/w.units):0;w.cost*=1-frac;w.units=Math.max(0,w.units-units);w.sold+=notional;w.sells++}
    w.last=num(e.ts)||now();w.watchlist=w.watchlist||!!e.watchlist;r.walletBook.set(e.wallet,w);
    r.flow.push({ts:num(e.ts)||now(),slot:e.slot??null,wallet:e.wallet,action:e.action,notional,price,mc:num(e.mc)||num(t.mc)});r.flow=r.flow.filter(x=>now()-x.ts<30*60000).slice(-1000);
    const gw=this.wallets.get(e.wallet)||{wallet:e.wallet,events:0,mints:new Set(),buys:0,sells:0,first:now(),last:0};gw.events++;gw.mints.add(e.mint);if(e.action==='BUY')gw.buys++;else gw.sells++;gw.last=now();this.wallets.set(e.wallet,gw);
  }
  organicDemand(r){
    const e=r.flow.filter(x=>now()-x.ts<5*60000),buys=e.filter(x=>x.action==='BUY'),sells=e.filter(x=>x.action==='SELL'),buyers=new Map();
    for(const x of buys){const a=buyers.get(x.wallet)||[];a.push(x.notional);buyers.set(x.wallet,a)}
    const unique=buyers.size,repeat=[...buyers.values()].filter(a=>a.length>1).length,buyVol=buys.reduce((s,x)=>s+x.notional,0),sellVol=sells.reduce((s,x)=>s+x.notional,0);
    const vals=buys.map(x=>x.notional).filter(x=>x>0),largest=vals.length?Math.max(...vals):0,concentration=buyVol?largest/buyVol:0,independence=buys.length?unique/buys.length:0;
    const score=clamp(unique*4+independence*28+Math.min(20,repeat*3)+(buyVol+sellVol?buyVol/(buyVol+sellVol)*22:0)-concentration*25);
    return{score,windowMin:5,uniqueBuyers:unique,repeatBuyers:repeat,buyEvents:buys.length,sellEvents:sells.length,independencePct:independence*100,buyVolume:buyVol,sellVolume:sellVol,medianBuy:median(vals),largestBuySharePct:concentration*100};
  }
  firstBuyerDNA(r){
    const buys=r.flow.filter(x=>x.action==='BUY').sort((a,b)=>a.ts-b.ts),first=[...new Set(buys.map(x=>x.wallet))].slice(0,25);
    const rows=first.map(wallet=>this.wallets.get(wallet)).filter(Boolean),returning=rows.filter(w=>(w.mints?.size||0)>=2).length,experienced=rows.filter(w=>w.events>=5).length,watchlist=first.filter(wallet=>r.walletBook.get(wallet)?.watchlist).length;
    const score=clamp(first.length*2+returning*3+experienced*2+watchlist*10);
    return{score,observed:first.length,returningWallets:returning,experiencedWallets:experienced,verifiedWatchlistWallets:watchlist,scope:'first 25 observed buy wallets'};
  }
  manipulation(r,organic){
    const e=r.flow.filter(x=>now()-x.ts<5*60000),byWallet=new Map();for(const x of e){let a=byWallet.get(x.wallet)||{b:0,s:0,v:0};if(x.action==='BUY')a.b++;else a.s++;a.v+=x.notional;byWallet.set(x.wallet,a)}
    const roundTrips=[...byWallet.values()].filter(x=>x.b&&x.s).length,ss=sameSlotRisk(e),vals=e.map(x=>x.notional).filter(x=>x>0),med=median(vals),uniform=vals.length&&med?vals.filter(x=>Math.abs(x-med)/med<.08).length/vals.length:0;
    const fewWalletPenalty=e.length>=8&&organic.uniqueBuyers<=3?28:0,score=clamp(roundTrips*7+ss*4+uniform*22+organic.largestBuySharePct*.28+fewWalletPenalty+(organic.independencePct<35?15:0));
    return{score,roundTripWallets:roundTrips,sameSlotClusterWallets:ss,uniformSizePct:uniform*100,fewWalletPenalty,observedWallets:byWallet.size};
  }
  profitOverhang(r,currentPrice){
    let total=0,p25=0,p50=0,p100=0,p300=0,creator=0,profitableSellers=0;
    for(const w of r.walletBook.values()){if(!(w.units>0))continue;const basis=w.cost/Math.max(w.units,1e-18),value=w.units*currentPrice,gain=pct(currentPrice,basis);total+=value;if(gain>=25)p25+=value;if(gain>=50)p50+=value;if(gain>=100)p100+=value;if(gain>=300)p300+=value;if(r.meta.creator&&w.wallet===r.meta.creator)creator+=value}
    const recentSells=r.flow.filter(x=>x.action==='SELL'&&now()-x.ts<120000);for(const s of recentSells){const w=r.walletBook.get(s.wallet);if(w&&w.bought>w.sold)profitableSellers++}
    const f=x=>total?x/total*100:0;return{coverageValue:total,supplyCoverage:'observed-wallet-value-only',profit25Pct:f(p25),profit50Pct:f(p50),profit100Pct:f(p100),profit300Pct:f(p300),creatorObservedPct:f(creator),recentProfitableSellers:profitableSellers};
  }
  sellPressure(r,organic,overhang){
    const recent=r.flow.filter(x=>now()-x.ts<120000),buys=recent.filter(x=>x.action==='BUY'),sells=recent.filter(x=>x.action==='SELL'),bv=buys.reduce((s,x)=>s+x.notional,0),sv=sells.reduce((s,x)=>s+x.notional,0);
    const earlyExit=new Set(sells.filter(x=>num(r.walletBook.get(x.wallet)?.firstBuyMc)&&num(r.walletBook.get(x.wallet)?.firstBuyMc)<=Math.max(25000,r.firstMc*1.5)).map(x=>x.wallet)).size;
    const ratio=bv+sv?sv/(bv+sv):0,score=clamp(ratio*48+earlyExit*8+overhang.profit100Pct*.22+Math.max(0,35-organic.score)*.35);
    return{score,sellVolumeSharePct:ratio*100,earlyBuyerExits:earlyExit,buyVolume:bv,sellVolume:sv};
  }
  attention(t,f,r){
    const socialPresence=(t.twitter?30:0)+(t.telegram?18:0)+(t.website?14:0),boost=clamp(num(t.boosts)*4,0,20),flowSupport=clamp(num(f?.social),0,100)*.18,sourceSupport=clamp(num(f?.sourceQuality),0,100)*.12;
    const current=clamp(socialPresence+boost+flowSupport+sourceSupport),prev=r.snapshots.length>4?num(r.snapshots.at(-5)?.attention?.score):current,acceleration=current-prev;
    return{score:current,acceleration,socials:{twitter:!!t.twitter,telegram:!!t.telegram,website:!!t.website},boosts:num(t.boosts),scope:'observable metadata/flow only; no unsourced social mention counts'};
  }
  marketEnvironment(allMarket={}){
    if(this.marketCache.value&&now()-this.marketCache.ts<500)return{...this.marketCache.value,...safe(allMarket)};
    const active=[...this.tokens.values()].filter(x=>now()-x.lastTs<10*60000),recentLaunch=active.filter(x=>now()-x.firstTs<5*60000),returns=active.filter(x=>x.firstPrice>0).map(x=>pct(x.lastPrice,x.firstPrice));
    const value={trackedActive:active.length,launchesPerMin:recentLaunch.length/5,medianSinceSeenReturn:median(returns),positivePct:returns.length?returns.filter(x=>x>0).length/returns.length*100:0,graduatedRecent:active.filter(x=>x.graduatedAt).length};this.marketCache={ts:now(),value};return{...value,...safe(allMarket)};
  }
  scoreFingerprint(t,f,q,r,organic,manipulation,attention,overhang,sellPressure,market){
    const creator=num(f?.creatorRisk),quality=num(q?.score),survival=num(f?.meme?.survival),novelty=100-num(f?.meme?.crowdingRisk),chart=num(f?.chart?.chartQuality);
    const coinQuality=clamp(quality*.22+organic.score*.24+(100-manipulation.score)*.19+survival*.12+novelty*.10+chart*.08+(100-creator)*.05);
    const entryQuality=clamp(coinQuality*.35+num(f?.acceleration)*.15+num(f?.momentum)*.12+num(f?.buyRatio)*100*.12+(100-sellPressure.score)*.12+(100-overhang.profit100Pct)*.06+attention.score*.08);
    return{coinQuality,entryQuality,creatorQuality:100-creator,organic:organic.score,manipulationRisk:manipulation.score,attentionQuality:attention.score,sellPressure:sellPressure.score,overhangRisk:clamp(overhang.profit100Pct*.7+overhang.profit300Pct*.3),marketRegime:market.regime||'UNKNOWN'};
  }
  recordCrossings(r,t,f){
    for(const level of MC_LEVELS)if(num(t.mc)>=level&&!r.mcCrossings[level]){r.mcCrossings[level]={ts:now(),price:num(t.price),mc:num(t.mc),peakAfter:0,worstAfter:0,settled:false};this.counters.mcCrossings++}
    const gp=clamp(num(f?.graduation),0,100);for(const level of CURVE_LEVELS)if(gp>=level&&!r.curveCrossings[level]){r.curveCrossings[level]={ts:now(),price:num(t.price),mc:num(t.mc),progress:gp};this.counters.curveCrossings++}
  }
  settleCrossings(r,t){
    for(const [level,c] of Object.entries(r.mcCrossings)){const rr=pct(num(t.price),c.price);c.peakAfter=Math.max(num(c.peakAfter),rr);c.worstAfter=Math.min(num(c.worstAfter),rr);if(!c.settled&&now()-c.ts>=15*60000){c.settled=true;this.mcCases.push({mint:r.mint,level:num(level),entryMc:c.mc,peak15:c.peakAfter,worst15:c.worstAfter,graduated:!!r.graduatedAt});this.mcCases=this.mcCases.slice(-8000)}}
  }
  sampleOpportunity(r,snap){
    if(now()-r.sampledAt<30000)return;r.sampledAt=now();const c={id:r.mint+':'+now(),mint:r.mint,ts:now(),price:snap.price,mc:snap.mc,fingerprint:fingerprint(snap),phase:snap.phase,organic:snap.organic.score,manipulation:snap.manipulation.score,entryQuality:snap.fingerprint.entryQuality,targets:TARGETS.map(x=>({...x,result:null,seconds:null})),max:0,min:0,horizons:{}};r.entryExperiments.push(c);r.entryExperiments=r.entryExperiments.slice(-120);this.entryCases.push(c);this.entryCases=this.entryCases.slice(-10000)}
  }
  settleOpportunityCases(r,t){
    for(const c of r.entryExperiments){if(c.done)continue;const ret=pct(num(t.price),c.price);c.max=Math.max(c.max,ret);c.min=Math.min(c.min,ret);const elapsed=now()-c.ts;
      for(const z of c.targets){if(z.result)continue;if(ret>=z.up){z.result='UP_FIRST';z.seconds=elapsed/1000}else if(ret<=z.down){z.result='DOWN_FIRST';z.seconds=elapsed/1000}}
      for(const h of HORIZONS_MS)if(elapsed>=h&&c.horizons[h]==null)c.horizons[h]=ret;
      if(elapsed>=3600000||c.targets.every(x=>x.result)){c.done=true;this.counters.settledEntryCases++;this.empiricalCache.delete(c.fingerprint);this.holdCache.delete(c.fingerprint)}
    }
  }
  empiricalFor(snap){
    const fp=fingerprint(snap),hit=this.empiricalCache.get(fp);if(hit&&now()-hit.ts<10000)return hit.value;const rows=this.entryCases.filter(x=>x.done&&x.fingerprint===fp).slice(-300),result={sample:rows.length,fingerprint:fp,targets:[]};
    for(let i=0;i<TARGETS.length;i++){const settled=rows.map(x=>x.targets[i]).filter(x=>x.result),up=settled.filter(x=>x.result==='UP_FIRST').length;result.targets.push({...TARGETS[i],sample:settled.length,upFirstPct:settled.length?up/settled.length*100:null,medianSeconds:median(settled.map(x=>x.seconds))})}
    this.empiricalCache.set(fp,{ts:now(),value:result});return result;
  }
  holdModel(snap){
    const fp=fingerprint(snap),hit=this.holdCache.get(fp);if(hit&&now()-hit.ts<10000)return hit.value;const rows=this.entryCases.filter(x=>x.done&&x.fingerprint===fp).slice(-300),h=HORIZONS_MS.map(ms=>{const vals=rows.map(x=>x.horizons[ms]).filter(Number.isFinite);return{seconds:ms/1000,n:vals.length,mean:avg(vals),median:median(vals),p25:quantile(vals,.25),p75:quantile(vals,.75)}}),best=h.filter(x=>x.n>=5).sort((a,b)=>b.mean-a.mean)[0]||null;const value={fingerprint:fp,sample:rows.length,bestHorizonSeconds:best?.seconds||null,horizons:h};this.holdCache.set(fp,{ts:now(),value});return value
  }
  entryDecision(t,snap){
    const empirical=this.empiricalFor(snap),t0=empirical.targets[0],f=snap.features||{},vertical=num(f.shortRet)>25||num(f.chart?.spikeRisk)>72,tooEarly=num(f.age)<.25;
    let action='BUY_NOW',reason='quality/flow state is acceptable for continued paper research',confidence=35;
    if(snap.manipulation.score>=82){action='NEVER_BUY';reason='extreme observed manipulation risk';confidence=85}
    else if(snap.sellPressure.score>=78){action='WAIT';reason='sell pressure is currently dominant';confidence=70}
    else if(vertical){action='WAIT_FOR_PULLBACK';reason='price is vertically extended';confidence=65}
    else if(tooEarly&&snap.organic.uniqueBuyers<3){action='WAIT_FOR_CONFIRMATION';reason='insufficient independent buyer evidence';confidence=60}
    if(t0?.sample>=20&&t0.upFirstPct!=null){confidence=Math.min(95,45+t0.sample/2);if(t0.upFirstPct<35){action='WAIT';reason='historical competing-risk outcomes are weak for this fingerprint'}else if(t0.upFirstPct>=62&&snap.fingerprint.entryQuality>=60){action='BUY_NOW';reason='historical target-before-stop outcomes support this state'}}
    const sizeMultiplier=action==='BUY_NOW'?clamp(.55+snap.fingerprint.entryQuality/150,.55,1.2):((action==='WAIT_FOR_PULLBACK'||action==='WAIT_FOR_CONFIRMATION')?0.55:(action==='WAIT'?0.40:0.15));
    return{action,reason,confidence,sizeMultiplier,empirical,hold:this.holdModel(snap),entryMc:num(t.mc),mcBand:band(t.mc)};
  }
  exitDecision(position,t,snap){
    const pnl=pct(num(t.price),num(position.entry)),holdMin=(now()-num(position.opened))/60000,h=this.holdModel(snap),remaining25=this.empiricalFor(snap).targets[0],sp=snap.sellPressure.score,over=snap.overhang.profit100Pct,att=snap.attention.acceleration;
    let action='HOLD',fraction=0,reason='remaining upside evidence not invalidated',confidence=35;
    if(sp>=82||snap.manipulation.score>=88){action='EXIT';fraction=1;reason='extreme sell/manipulation pressure';confidence=85}
    else if(sp>=68&&pnl>10){action='TRIM';fraction=.35;reason='rising sell pressure while profitable';confidence=65}
    else if(over>=55&&pnl>=40){action='TRIM';fraction=.25;reason='large observed profit overhang';confidence=60}
    else if(att<-12&&pnl>0){action='TRIM';fraction=.25;reason='attention/participation deterioration';confidence=55}
    else if(h.bestHorizonSeconds&&holdMin*60>h.bestHorizonSeconds*1.6&&remaining25?.sample>=15&&num(remaining25.upFirstPct)<45){action='EXIT';fraction=1;reason='historical edge has decayed beyond best hold horizon';confidence=65}
    return{action,fraction,reason,confidence,pnl,holdMin,sellPressure:sp,profit100Overhang:over,bestHistoricalHoldSeconds:h.bestHorizonSeconds};
  }
  observeToken(t,ctx={}){
    if(!t?.mint||!(num(t.price)>0))return null;this.counters.tokenObservations++;const r=this.get(t.mint),ts=now();if(!r.firstTs){r.firstTs=num(t.createdAt)||ts;r.firstPrice=num(t.price);r.firstMc=num(t.mc);r.troughPrice=num(t.price);r.troughMc=num(t.mc)}
    r.lastTs=ts;r.lastPrice=num(t.price);r.lastMc=num(t.mc);r.peakPrice=Math.max(r.peakPrice,num(t.price));r.peakMc=Math.max(r.peakMc,num(t.mc));r.troughPrice=Math.min(r.troughPrice||num(t.price),num(t.price));r.troughMc=Math.min(r.troughMc||num(t.mc),num(t.mc));r.meta={symbol:t.symbol,name:t.name,narrative:t.narrative,creator:t.creator,twitter:t.twitter,telegram:t.telegram,website:t.website};
    const f=ctx.features||{},q=ctx.quality||{},phase=t.graduated?'PUMPSWAP':'BONDING_CURVE';if(t.graduated&&!r.graduatedAt)r.graduatedAt=ts;r.phase=phase;
    const organic=this.organicDemand(r),firstBuyerDNA=this.firstBuyerDNA(r),manipulation=this.manipulation(r,organic),attention=this.attention(t,f,r),overhang=this.profitOverhang(r,num(t.price)),sellPressure=this.sellPressure(r,organic,overhang),market=this.marketEnvironment(ctx.market||{}),fp=this.scoreFingerprint(t,f,q,r,organic,manipulation,attention,overhang,sellPressure,market);
    const snap={ts,price:num(t.price),mc:num(t.mc),liq:num(t.liq),phase,features:safe(f),quality:num(q?.score||q),organic,firstBuyerDNA,manipulation,attention,overhang,sellPressure,market,fingerprint:{...fp,firstBuyerQuality:firstBuyerDNA.score}};
    r.snapshots.push(snap);r.snapshots=r.snapshots.slice(-360);this.recordCrossings(r,t,f);this.settleCrossings(r,t);this.settleOpportunityCases(r,t);this.sampleOpportunity(r,snap);this.updateDecisionOutcomes(r,t);
    if(r.graduatedAt){const elapsed=ts-r.graduatedAt;for(const h of HORIZONS_MS.filter(x=>x<=900000))if(elapsed>=h&&r.holdMarks['g'+h]==null){r.holdMarks['g'+h]=pct(num(t.price),num(r.snapshots.find(x=>x.ts>=r.graduatedAt)?.price)||r.firstPrice);this.postGradCases.push({mint:r.mint,horizonSec:h/1000,ret:r.holdMarks['g'+h]});this.postGradCases=this.postGradCases.slice(-4000)}}
    const current={...snap,entry:this.entryDecision(t,snap),mcJourney:this.mcJourney(r),curveJourney:safe(r.curveCrossings)};r.lastCurrent=current;return current;
  }
  mcJourney(r){const crossings=Object.entries(r.mcCrossings).map(([level,c])=>({level:num(level),...safe(c),minutesFromSeen:(c.ts-r.firstTs)/60000})).sort((a,b)=>a.level-b.level);return{firstMc:r.firstMc,currentMc:r.lastMc,peakMc:r.peakMc,troughMc:r.troughMc,crossings}}
  current(mint){const r=this.tokens.get(mint);if(!r)return null;if(r.lastCurrent)return safe(r.lastCurrent);const s=r.snapshots?.at(-1);if(!s)return null;const current={...safe(s),entry:this.entryDecision({...r.meta,mint,mc:r.lastMc,price:r.lastPrice},s),mcJourney:this.mcJourney(r),curveJourney:safe(r.curveCrossings)};r.lastCurrent=current;return safe(current)}
  recordDecision(row,t){
    if(!row?.mint)return;this.counters.decisionObservations++;const r=this.get(row.mint),id=row.strategy+':'+row.ts+':'+row.action,d={id,ts:row.ts,mint:row.mint,strategy:row.strategy,action:row.action,price:num(row.price),mc:num(row.mc),reason:row.why,best:0,worst:0,last:0,entered:row.action==='BUY',classified:false};this.decisions.push(d);this.decisionLookup.set(id,d);this.decisions=this.decisions.slice(-12000);if(this.decisionLookup.size>14000){const keep=new Set(this.decisions.map(x=>x.id));for(const k of this.decisionLookup.keys())if(!keep.has(k))this.decisionLookup.delete(k)}r.decisionIds.push(id);r.decisionIds=r.decisionIds.slice(-250)}
  updateDecisionOutcomes(r,t){
    for(const id of r.decisionIds){const d=this.decisionLookup.get(id);if(!d||d.classified||!(d.price>0))continue;const ret=pct(num(t.price),d.price);d.last=ret;d.best=Math.max(d.best,ret);d.worst=Math.min(d.worst,ret);const age=now()-d.ts;
      if(d.action==='REJECT'&&d.best>=100){d.classified=true;const x={...safe(d),classification:'MISSED_WINNER_2X'};this.missedWinners.unshift(x);this.missedWinners=this.missedWinners.slice(0,500);this.counters.missedWinners++}
      else if(d.action==='REJECT'&&d.worst<=-50&&age>=5*60000){d.classified=true;const x={...safe(d),classification:'AVOIDED_COLLAPSE'};this.avoidedLosers.unshift(x);this.avoidedLosers=this.avoidedLosers.slice(0,500);this.counters.avoidedLosers++}
      else if(age>=60*60000)d.classified=true;
    }
  }
  recordEntry(position,t){this.counters.entries++;const cur=this.current(t.mint);if(cur)position.lifecycleEntry={ts:now(),...cur.entry,fingerprint:cur.fingerprint,organic:cur.organic,manipulation:cur.manipulation,sellPressure:cur.sellPressure,overhang:cur.overhang}}
  recordPartialExit(position,t,fraction,why){position.lifecyclePartialExits=position.lifecyclePartialExits||[];position.lifecyclePartialExits.push({ts:now(),fraction,why,current:this.current(t.mint)?.fingerprint||null})}
  recordTrade(position,t){
    this.counters.trades++;const cur=this.current(t.mint),entry=position.lifecycleEntry||{},pnl=num(position.pnlPct),mfe=num(position.mfe),mae=num(position.mae);let error='STATISTICALLY_NORMAL_OUTCOME';
    if(pnl<0&&mfe<15)error='WRONG_COIN_OR_ENTRY';else if(pnl<0&&mfe>=25)error='RIGHT_COIN_WRONG_EXIT';else if(pnl>0&&mfe-pnl>=35)error='EXIT_LEFT_MAJOR_UPSIDE';else if(num(position.executionStress?.penalty)>=8)error='EXECUTION_COST_SENSITIVE';
    const row={ts:now(),mint:position.mint,strategy:position.strategy,pnlPct:pnl,mfe,mae,error,entryMc:num(position.entryMc),exitMc:num(t.mc),holdMin:(now()-num(position.opened))/60000,entry:safe(entry),exit:safe(cur?.fingerprint||null)};this.tradeErrors.unshift(row);this.tradeErrors=this.tradeErrors.slice(0,2000);this.completedTrades.unshift(row);this.completedTrades=this.completedTrades.slice(0,4000);return row
  }
  marketCapMatrix(){
    const levels=MC_LEVELS.map(level=>{const a=this.mcCases.filter(x=>x.level===level),n=a.length;return{level,n,graduationPct:n?a.filter(x=>x.graduated).length/n*100:null,meanPeak15:n?avg(a.map(x=>x.peak15)):null,medianPeak15:n?median(a.map(x=>x.peak15)):null,meanWorst15:n?avg(a.map(x=>x.worst15)):null,hit25Pct:n?a.filter(x=>x.peak15>=25).length/n*100:null,hit100Pct:n?a.filter(x=>x.peak15>=100).length/n*100:null}});return{levels,bestObserved:levels.filter(x=>x.n>=10).sort((a,b)=>num(b.meanPeak15)-num(a.meanPeak15))[0]||null}
  }
  graduationMatrix(){return CURVE_LEVELS.map(level=>{const rows=[...this.tokens.values()].filter(r=>r.curveCrossings[level]);return{progress:level,n:rows.length,graduatedPct:rows.length?rows.filter(r=>r.graduatedAt).length/rows.length*100:null}})}
  lifecycleStages(){return[
    'Universe Capture','Creator Quality','First Buyer DNA','Organic Demand','Manipulation Detection','Attention Quality','Market Cap Journey','Bonding Curve Journey','Entry Opportunity','Waiting Model','Execution Reality Link','Evidence Position Sizing','Hold Time Model','Holder Profit Overhang','Sell Pressure Forecast','Exit Decision','Post Graduation Model','Market Environment','Missed Winner Research','Avoided Loser Research','Decision Decomposition','Perfect Coin Fingerprint'
  ].map((name,i)=>({stage:i+1,name,active:true}))}
  perfectCoinBoard(){
    const rows=[];for(const r of this.tokens.values()){const s=r.snapshots.at(-1);if(!s||now()-s.ts>10*60000)continue;const entry=this.entryDecision({...r.meta,mint:r.mint,mc:r.lastMc,price:r.lastPrice},s);rows.push({mint:r.mint,symbol:r.meta.symbol,mc:r.lastMc,phase:r.phase,coinQuality:s.fingerprint.coinQuality,entryQuality:s.fingerprint.entryQuality,organic:s.organic.score,firstBuyerQuality:s.firstBuyerDNA?.score||0,manipulationRisk:s.manipulation.score,sellPressure:s.sellPressure.score,attention:s.attention.score,profit100Overhang:s.overhang.profit100Pct,entryAction:entry.action,entryReason:entry.reason,sizeMultiplier:entry.sizeMultiplier,bestHoldSec:entry.hold.bestHorizonSeconds,target25BeforeStop15:entry.empirical.targets[0]?.upFirstPct??null,targetSample:entry.empirical.targets[0]?.sample||0,mcBand:band(r.lastMc)});}return rows.sort((a,b)=>b.entryQuality-a.entryQuality).slice(0,40)
  }
  snapshot(compact=false){const board=this.perfectCoinBoard();return{version:this.version,paperOnly:true,stages:this.lifecycleStages(),counters:{...this.counters},marketCapMatrix:this.marketCapMatrix(),graduationMatrix:this.graduationMatrix(),perfectCoinBoard:board.slice(0,compact?12:40),missedWinners:this.missedWinners.slice(0,compact?8:30),avoidedLosers:this.avoidedLosers.slice(0,compact?8:30),decisionErrors:this.tradeErrors.slice(0,compact?8:30),samples:{tokens:this.tokens.size,wallets:this.wallets.size,entryCases:this.entryCases.length,mcCases:this.mcCases.length,postGradCases:this.postGradCases.length}}}
  serialize(){return{version:this.version,counters:this.counters,tokens:[...this.tokens].slice(-1200).map(([k,r])=>[k,{...r,walletBook:compactWallets(r.walletBook),snapshots:r.snapshots.slice(-120),entryExperiments:r.entryExperiments.slice(-60)}]),wallets:[...this.wallets].slice(-1500).map(([k,w])=>[k,{...w,mints:[...w.mints].slice(-80)}]),entryCases:this.entryCases.slice(-5000),mcCases:this.mcCases.slice(-5000),holdCases:this.holdCases.slice(-3000),postGradCases:this.postGradCases.slice(-3000),decisions:this.decisions.slice(-6000),missedWinners:this.missedWinners.slice(0,500),avoidedLosers:this.avoidedLosers.slice(0,500),tradeErrors:this.tradeErrors.slice(0,1200),completedTrades:this.completedTrades.slice(0,2500)}}
  restore(s){try{if(!s)return false;this.counters={...this.counters,...(s.counters||{})};this.tokens=new Map((s.tokens||[]).map(([k,r])=>[k,{...r,walletBook:new Map(r.walletBook||[])}]));this.wallets=new Map((s.wallets||[]).map(([k,w])=>[k,{...w,mints:new Set(w.mints||[])}]));this.entryCases=s.entryCases||[];this.decisionLookup.clear();this.empiricalCache.clear();this.holdCache.clear();this.marketCache={ts:0,value:null};this.mcCases=s.mcCases||[];this.holdCases=s.holdCases||[];this.postGradCases=s.postGradCases||[];this.decisions=s.decisions||[];for(const d of this.decisions)this.decisionLookup.set(d.id,d);this.missedWinners=s.missedWinners||[];this.avoidedLosers=s.avoidedLosers||[];this.tradeErrors=s.tradeErrors||[];this.completedTrades=s.completedTrades||[];return true}catch{return false}}
  reset(){const x=new PumpLabLifecycleResearch({start:this.start});this.restore(x.serialize())}
}
export function createPumpLabLifecycleResearch(opts={}){return new PumpLabLifecycleResearch(opts)}
