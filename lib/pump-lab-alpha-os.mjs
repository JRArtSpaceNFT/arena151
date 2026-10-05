const clamp=(v,a=0,b=100)=>Math.max(a,Math.min(b,Number(v)||0));
const avg=a=>a?.length?a.reduce((s,x)=>s+(Number(x)||0),0)/a.length:0;
const num=x=>Number.isFinite(Number(x))?Number(x):0;
const pct=(a,b)=>b?((Number(a)-Number(b))/Number(b))*100:0;
const median=a=>{const x=(a||[]).filter(Number.isFinite).slice().sort((m,n)=>m-n);if(!x.length)return 0;const i=Math.floor(x.length/2);return x.length%2?x[i]:(x[i-1]+x[i])/2;};
const stdev=a=>{const x=(a||[]).filter(Number.isFinite);if(x.length<2)return 0;const m=avg(x);return Math.sqrt(x.reduce((s,v)=>s+(v-m)**2,0)/(x.length-1));};
const q=(a,p)=>{const x=(a||[]).filter(Number.isFinite).slice().sort((m,n)=>m-n);if(!x.length)return 0;return x[Math.min(x.length-1,Math.max(0,Math.floor((x.length-1)*p)))];};
const now=()=>Date.now();
const h32=s=>{let h=2166136261>>>0;for(const ch of String(s||'')){h^=ch.charCodeAt(0);h=Math.imul(h,16777619)>>>0;}return h>>>0;};
const part=mint=>h32(mint)%5===0?'holdout':'train';
const mcBand=mc=>mc<50000?'u50k':mc<250000?'50k-250k':mc<1000000?'250k-1m':'1m+';
const safe=o=>JSON.parse(JSON.stringify(o));

export class PumpLabAlphaOS {
  constructor(opts={}){
    this.version='alpha-os-v2-wallet-intelligence';
    this.start=Number(opts.start||1000);
    this.rpcUrl=opts.rpcUrl||'';
    this.jitoTipUrl=opts.jitoTipUrl||'https://bundles.jito.wtf/api/v1/bundles/tip_floor';
    this.routeQuoteUrl=opts.routeQuoteUrl||'https://lite-api.jup.ag/swap/v1/quote';
    this.shadowWalletPublicKey=opts.shadowWalletPublicKey||'';
    this.mintDecimals=new Map();
    this.probCache=new Map();
    this.leadCache=new Map();
    this.micro=new Map();
    this.walletStats=new Map();
    this.walletLots=new Map();
    this.walletClosed=[];
    this.walletQualityCache=new Map();
    this.walletConsensusCache=new Map();
    this.walletPairs=new Map();
    this.fundingEdges=new Map();
    this.creatorEdges=new Map();
    this.firstBuyers=new Map();
    this.walletSignals=[];
    this.forecasts=[];
    this.shadow=[];
    this.world=[];
    this.execution={priority:{ts:0,p50:0,p75:0,p90:0,sample:0},jito:{ts:0,p25:0,p50:0,p75:0,p95:0},sol:{ts:0,price:0,ret5m:0,history:[]},lastPoll:0,errors:0};
    this.master={cash:this.start,equity:this.start,peak:this.start,dd:0,positions:[],trades:[],proposals:[],lastAuction:0};
    this.counters={tokens:0,walletEvents:0,walletClosedTrades:0,forecasts:0,shadowIntents:0,auctions:0,masterTrades:0,adaptiveExits:0};
    this.lastWorldAt=0;
    this.lastExternalPoll=0;
  }

  serializeCritical(){
    return{
      version:this.version,scope:'critical-alpha',
      walletStats:[...this.walletStats].slice(-1200),
      walletLots:[...this.walletLots].slice(-1600),
      walletClosed:this.walletClosed.slice(-1600),
      walletSignals:this.walletSignals.slice(-1200),
      forecasts:this.forecasts.slice(-800),
      shadow:this.shadow.slice(-500),
      world:this.world.slice(-300),
      execution:this.execution,
      master:{...this.master,trades:(this.master?.trades||[]).slice(-500),proposals:(this.master?.proposals||[]).slice(-500),positions:this.master?.positions||[]},
      counters:{...this.counters},
      lastWorldAt:this.lastWorldAt,lastExternalPoll:this.lastExternalPoll
    };
  }
  restoreCritical(s){
    if(!s||typeof s!=='object')return false;
    try{
      this.walletStats=new Map(s.walletStats||[]);
      this.walletLots=new Map(s.walletLots||[]);
      this.walletClosed=Array.isArray(s.walletClosed)?s.walletClosed:this.walletClosed;
      this.walletSignals=Array.isArray(s.walletSignals)?s.walletSignals:this.walletSignals;
      this.forecasts=Array.isArray(s.forecasts)?s.forecasts:this.forecasts;
      this.shadow=Array.isArray(s.shadow)?s.shadow:this.shadow;
      this.world=Array.isArray(s.world)?s.world:this.world;
      this.execution={...this.execution,...(s.execution||{})};
      this.master={...this.master,...(s.master||{})};
      this.counters={...this.counters,...(s.counters||{})};
      this.lastWorldAt=Number(s.lastWorldAt||0);this.lastExternalPoll=Number(s.lastExternalPoll||0);
      return true;
    }catch{return false;}
  }

  serialize(){
    return{
      version:this.version,
      micro:[...this.micro].slice(-1200),
      mintDecimals:[...this.mintDecimals].slice(-3000),
      walletStats:[...this.walletStats].slice(-4000),
      walletLots:[...this.walletLots].slice(-6000),
      walletClosed:this.walletClosed.slice(-6000),
      walletPairs:[...this.walletPairs].slice(-10000),
      fundingEdges:[...this.fundingEdges].slice(-10000),
      creatorEdges:[...this.creatorEdges].slice(-10000),
      firstBuyers:[...this.firstBuyers].slice(-5000),
      walletSignals:this.walletSignals.slice(-5000),
      forecasts:this.forecasts.slice(-6000),
      shadow:this.shadow.slice(-2500),
      world:this.world.slice(-1000),
      execution:this.execution,
      master:this.master,
      counters:this.counters,
      lastWorldAt:this.lastWorldAt,
      lastExternalPoll:this.lastExternalPoll
    };
  }

  restore(s){
    if(!s||typeof s!=='object')return false;
    try{
      this.micro=new Map(s.micro||[]);
      this.mintDecimals=new Map(s.mintDecimals||[]);
      this.walletStats=new Map(s.walletStats||[]);
      this.walletLots=new Map(s.walletLots||[]);
      this.walletClosed=Array.isArray(s.walletClosed)?s.walletClosed:[];
      this.walletPairs=new Map(s.walletPairs||[]);
      this.fundingEdges=new Map(s.fundingEdges||[]);
      this.creatorEdges=new Map(s.creatorEdges||[]);
      this.firstBuyers=new Map(s.firstBuyers||[]);
      this.walletSignals=Array.isArray(s.walletSignals)?s.walletSignals:[];
      this.forecasts=Array.isArray(s.forecasts)?s.forecasts:[];
      this.shadow=Array.isArray(s.shadow)?s.shadow:[];
      this.world=Array.isArray(s.world)?s.world:[];
      this.execution={...this.execution,...(s.execution||{})};
      this.master={...this.master,...(s.master||{})};
      this.counters={...this.counters,...(s.counters||{})};
      this.lastWorldAt=Number(s.lastWorldAt||0);
      this.lastExternalPoll=Number(s.lastExternalPoll||0);
      return true;
    }catch{return false;}
  }

  microstructure(t){
    const ts=now(),cached=t?.mint?this.micro.get(t.mint):null;if(cached&&ts-Number(cached.ts||0)<1000)return cached;
    const hist=(t?.history||[]).filter(x=>x&&x.ts&&x.price>0),chain=(t?.chainFlow||[]).filter(e=>ts-Number(e.ts||0)<120000);
    const recent=hist.filter(x=>ts-x.ts<60000),prior=hist.filter(x=>ts-x.ts>=60000&&ts-x.ts<120000);
    const txDelta=a=>a.length>1?Math.max(0,(Number(a.at(-1)?.buys||0)+Number(a.at(-1)?.sells||0))-(Number(a[0]?.buys||0)+Number(a[0]?.sells||0))):0;
    const rtx=txDelta(recent),ptx=txDelta(prior),velocity=rtx+chain.length,acceleration=rtx-ptx;
    const buys=chain.filter(e=>e.action==='BUY'),sells=chain.filter(e=>e.action==='SELL');
    const wallets=buys.map(e=>e.wallet).filter(Boolean),uniqueBuyers=new Set(wallets).size;
    const buySizes=buys.map(e=>Math.abs(Number(e.notionalUsd||0))).filter(x=>x>0),m=avg(buySizes),cv=m?stdev(buySizes)/m:1;
    const slotGroups=new Map();
    for(const e of buys){const k=String(e.slot||Math.floor(Number(e.ts||0)/1500));slotGroups.set(k,(slotGroups.get(k)||0)+1);}
    const maxSlot=slotGroups.size?Math.max(...slotGroups.values()):0,clusterRatio=buys.length?maxSlot/buys.length:0;
    const sellerArrival=chain.length?sells.filter(e=>ts-e.ts<30000).length/Math.max(1,chain.filter(e=>ts-e.ts<30000).length):0;
    const buyRatio=chain.length?buys.length/chain.length:(Number(t?.buys||0)+Number(t?.sells||0)?Number(t.buys||0)/(Number(t.buys||0)+Number(t.sells||0)):0.5);
    const out={ts,velocity,acceleration,uniqueBuyers,buyEvents:buys.length,sellEvents:sells.length,buyRatio,sellerArrival,avgBuyUsd:m,buySizeCv:cv,clusterRatio,maxSameSlot:maxSlot};
    if(t?.mint)this.micro.set(t.mint,out);
    return out;
  }

  toxicity(t,micro=this.microstructure(t)){
    if(micro?.toxicity&&now()-Number(micro.toxicity.ts||0)<1000)return micro.toxicity;
    const chain=(t?.chainFlow||[]).filter(e=>now()-Number(e.ts||0)<120000);
    const buys=chain.filter(e=>e.action==='BUY'),flags=[];let score=0;
    const byWallet=new Map();for(const e of buys)if(e.wallet)byWallet.set(e.wallet,(byWallet.get(e.wallet)||0)+1);
    const repeat=buys.length?[...byWallet.values()].filter(n=>n>1).reduce((s,n)=>s+n,0)/buys.length:0;
    const fundingSources=buys.map(e=>this.latestFunder(e.wallet)).filter(Boolean),funderCounts=new Map();for(const x of fundingSources)funderCounts.set(x,(funderCounts.get(x)||0)+1);
    const sharedFunder=fundingSources.length?Math.max(0,...funderCounts.values())/fundingSources.length:0;
    if(micro.clusterRatio>=.6&&micro.buyEvents>=4){score+=25;flags.push('same-slot buy cluster');}
    if(sharedFunder>=.5&&fundingSources.length>=3){score+=28;flags.push('buyers share funding source');}
    if(micro.buySizeCv<.12&&micro.buyEvents>=5){score+=22;flags.push('near-identical buy sizing');}
    if(repeat>.45&&micro.buyEvents>=4){score+=18;flags.push('repeated-wallet concentration');}
    if(micro.sellerArrival>.48){score+=16;flags.push('fast seller arrival');}
    if(t?.liq>0&&t?.mc>0&&t.mc/t.liq>40){score+=14;flags.push('thin liquidity versus market cap');}
    if(micro.uniqueBuyers>0&&micro.buyEvents/micro.uniqueBuyers>2.5){score+=12;flags.push('low unique-buyer diversity');}
    if(Number(t?.liq||0)<5000){score+=10;flags.push('very thin liquidity');}
    score=clamp(score);
    const out={ts:now(),score,flags,veto:score>=76,confidence:micro.buyEvents>=5?'observed':'low-sample'};
    if(t?.mint)this.micro.set(t.mint,{...micro,toxicity:out});
    return out;
  }

  observeFundingTransfer({from,to,sol,ts=now(),signature=null}={}){
    if(!from||!to||from===to||!(Number(sol)>0))return;
    const key=from+'|'+to,r=this.fundingEdges.get(key)||{from,to,count:0,totalSol:0,last:0,signatures:[]};
    r.count++;r.totalSol+=Number(sol);r.last=Math.max(r.last,Number(ts));if(signature&&!r.signatures.includes(signature))r.signatures.push(signature);r.signatures=r.signatures.slice(-10);this.fundingEdges.set(key,r);
  }

  latestFunder(wallet){
    if(!wallet)return null;let best=null;
    for(const e of this.fundingEdges.values())if(e.to===wallet&&(!best||e.last>best.last))best=e;
    return best&&now()-best.last<7*24*3600000?best.from:null;
  }

  walletGraph(){
    const first=[...this.firstBuyers.entries()].map(([mint,x])=>({mint,...x})).slice(-1000);
    return{
      walletNodes:this.walletStats.size,coBuyEdges:this.walletPairs.size,fundingEdges:this.fundingEdges.size,creatorEdges:this.creatorEdges.size,
      firstBuyerTokens:this.firstBuyers.size,
      topFunding:[...this.fundingEdges.values()].sort((a,b)=>b.count-a.count||b.totalSol-a.totalSol).slice(0,20),
      topCoBuy:[...this.walletPairs.values()].sort((a,b)=>b.coBuys-a.coBuys).slice(0,20),
      firstBuyers:first.slice(-30)
    };
  }

  observeWalletEvent(e,t=null){
    if(!e?.wallet||!e?.mint)return;
    this.counters.walletEvents++;
    let w=this.walletStats.get(e.wallet)||{wallet:e.wallet,events:0,buys:0,sells:0,mints:{},bands:{},leadSamples:0,avg1m:0,avg5m:0,avg15m:0,hit25:0,last:0,realizedTrades:0,realizedWins:0,realizedPnlUsd:0,realizedPnlPctSum:0,holdSeconds:[]};
    w.events++;w.last=Math.max(w.last,Number(e.ts||now()));if(e.action==='BUY')w.buys++;if(e.action==='SELL')w.sells++;
    w.mints[e.mint]=(w.mints[e.mint]||0)+1;
    const px=Number(e.price||t?.price||0),delta=Math.abs(Number(e.tokenDelta||0)),lotKey=e.wallet+'|'+e.mint;
    if(px>0&&delta>0&&(e.action==='BUY'||e.action==='SELL')){
      let lot=this.walletLots.get(lotKey)||{wallet:e.wallet,mint:e.mint,units:0,costUsd:0,openedAt:0,lastBuyAt:0,lastSellAt:0};
      if(e.action==='BUY'){
        if(!(lot.units>0))lot.openedAt=Number(e.ts||now());
        lot.units+=delta;lot.costUsd+=delta*px;lot.lastBuyAt=Number(e.ts||now());
      }else if(lot.units>0){
        const units=Math.min(lot.units,delta),avgCost=lot.units>0?lot.costUsd/lot.units:0,cost=units*avgCost,proceeds=units*px,pnlUsd=proceeds-cost,pnlPct=cost>0?pnlUsd/cost*100:0,holdSeconds=Math.max(0,(Number(e.ts||now())-Number(lot.openedAt||e.ts||now()))/1000);
        lot.units=Math.max(0,lot.units-units);lot.costUsd=Math.max(0,lot.costUsd-cost);lot.lastSellAt=Number(e.ts||now());
        if(lot.units<=1e-12){lot.units=0;lot.costUsd=0;lot.openedAt=0;}
        const closed={ts:Number(e.ts||now()),wallet:e.wallet,mint:e.mint,traderId:e.traderId||null,pnlUsd,pnlPct,holdSeconds,units,entryAvg:avgCost,exit:px,source:e.source||''};
        this.walletClosed.unshift(closed);this.walletClosed=this.walletClosed.slice(0,6000);this.counters.walletClosedTrades++;
        w.realizedTrades=Number(w.realizedTrades||0)+1;w.realizedWins=Number(w.realizedWins||0)+(pnlUsd>0?1:0);w.realizedPnlUsd=Number(w.realizedPnlUsd||0)+pnlUsd;w.realizedPnlPctSum=Number(w.realizedPnlPctSum||0)+pnlPct;
        w.holdSeconds=[...(w.holdSeconds||[]),holdSeconds].slice(-200);
      }
      this.walletLots.set(lotKey,lot);
    }
    this.walletStats.set(e.wallet,w);
    if(t?.creator){
      const key=e.wallet+'|'+t.creator,r=this.creatorEdges.get(key)||{wallet:e.wallet,creator:t.creator,count:0,mints:[],last:0};r.count++;r.last=now();if(!r.mints.includes(e.mint))r.mints.push(e.mint);r.mints=r.mints.slice(-40);this.creatorEdges.set(key,r);
    }
    if(e.action==='BUY'&&Number(e.price)>0){
      const fb=this.firstBuyers.get(e.mint);if(!fb||Number(e.ts||now())<fb.ts)this.firstBuyers.set(e.mint,{wallet:e.wallet,ts:Number(e.ts||now()),price:Number(e.price),traderId:e.traderId||null,funder:this.latestFunder(e.wallet)});
      const sig={id:(e.signature||'')+':'+e.wallet+':'+e.mint+':'+e.ts,wallet:e.wallet,traderId:e.traderId||null,mint:e.mint,ts:Number(e.ts||now()),price:Number(e.price),mc:Number(e.mc||t?.mc||0),band:mcBand(Number(e.mc||t?.mc||0)),one:null,five:null,fifteen:null,peak:0,trough:0};
      this.walletSignals.unshift(sig);this.walletSignals.splice(5000);
      const peers=this.walletSignals.filter(x=>x.mint===e.mint&&x.wallet!==e.wallet&&Math.abs(x.ts-sig.ts)<=60000).slice(0,20);
      for(const p of peers){const key=[e.wallet,p.wallet].sort().join('|'),r=this.walletPairs.get(key)||{a:key.split('|')[0],b:key.split('|')[1],coBuys:0,last:0,mints:[]};r.coBuys++;r.last=now();if(!r.mints.includes(e.mint))r.mints.push(e.mint);r.mints=r.mints.slice(-30);this.walletPairs.set(key,r);}
    }
  }

  settleWalletSignals(t){
    if(!t?.mint||!(t.price>0))return;
    const ts=now();
    for(const s of this.walletSignals){
      if(s.mint!==t.mint||s.ts>ts)continue;
      const r=pct(t.price,s.price),mins=(ts-s.ts)/60000;s.peak=Math.max(Number(s.peak||0),r);s.trough=Math.min(Number(s.trough||0),r);
      if(mins>=1&&s.one==null)s.one=r;if(mins>=5&&s.five==null)s.five=r;if(mins>=15&&s.fifteen==null)s.fifteen=r;
    }
    const affected=new Set(this.walletSignals.filter(s=>s.mint===t.mint&&s.fifteen!=null).map(s=>s.wallet));
    for(const wallet of affected){
      const settled=this.walletSignals.filter(s=>s.wallet===wallet&&s.fifteen!=null),w=this.walletStats.get(wallet);if(!w)continue;
      w.leadSamples=settled.length;w.avg1m=avg(settled.map(s=>s.one));w.avg5m=avg(settled.map(s=>s.five));w.avg15m=avg(settled.map(s=>s.fifteen));w.hit25=settled.length?settled.filter(s=>s.peak>=25).length/settled.length*100:0;
      const bands={};for(const b of ['u50k','50k-250k','250k-1m','1m+']){const a=settled.filter(s=>s.band===b);bands[b]={n:a.length,avg5:avg(a.map(x=>x.five)),avg15:avg(a.map(x=>x.fifteen)),hit25:a.length?a.filter(x=>x.peak>=25).length/a.length*100:0};}w.bands=bands;
    }
  }

  walletQuality(wallet,mc=0){
    const cacheKey=wallet+':'+mcBand(mc),cached=this.walletQualityCache.get(cacheKey);if(cached&&cached.closedN===this.walletClosed.length&&cached.signalN===this.walletSignals.length&&now()-cached.ts<5000)return cached.value;
    const w=this.walletStats.get(wallet)||{},closed=this.walletClosed.filter(x=>x.wallet===wallet).slice(0,500),realizedN=closed.length||Number(w.realizedTrades||0),wins=closed.length?closed.filter(x=>num(x.pnlUsd)>0).length:Number(w.realizedWins||0),pnlPcts=closed.map(x=>num(x.pnlPct)),avgPnl=closed.length?avg(pnlPcts):(realizedN?num(w.realizedPnlPctSum)/realizedN:0);
    const winRate=realizedN?wins/realizedN*100:0,winRows=pnlPcts.filter(x=>x>0),lossRows=pnlPcts.filter(x=>x<0),avgWin=avg(winRows),avgLoss=Math.abs(avg(lossRows)),profitFactor=lossRows.length?Math.abs(winRows.reduce((s,x)=>s+x,0)/lossRows.reduce((s,x)=>s+x,0)):(winRows.length?9.99:0);
    const holdRows=closed.map(x=>num(x.holdSeconds)).filter(x=>x>=0),medianHoldSec=holdRows.length?median(holdRows):median(w.holdSeconds||[]),uniqueMints=new Set([...closed.map(x=>x.mint),...Object.keys(w.mints||{})]).size;
    const settled=this.walletSignals.filter(x=>x.wallet===wallet&&x.fifteen!=null).slice(0,250),leadN=settled.length||num(w.leadSamples),leadAvg15=settled.length?avg(settled.map(x=>num(x.fifteen))):num(w.avg15m),leadHit25=settled.length?settled.filter(x=>num(x.peak)>=25).length/settled.length*100:num(w.hit25);
    const evidenceN=Math.max(realizedN,leadN),shrink=evidenceN/(evidenceN+20),rawProfit=clamp(50+avgPnl*2.5),profitability=50+(rawProfit-50)*shrink,rawWin=clamp(winRate||leadHit25||50),winScore=50+(rawWin-50)*shrink;
    const holdScore=medianHoldSec<=0?50:medianHoldSec<5?0:medianHoldSec<60?25:medianHoldSec<300?55:medianHoldSec<21600?88:72;
    const overtrade24h=this.walletSignals.filter(x=>x.wallet===wallet&&x.ts>=now()-86400000).length,overtradePenalty=overtrade24h>35?30:overtrade24h>20?18:overtrade24h>12?8:0;
    const concentrationPenalty=evidenceN>=5&&uniqueMints<=1?35:evidenceN>=8&&uniqueMints<=2?18:0,mevLike=realizedN>=3&&medianHoldSec>0&&medianHoldSec<5,insiderLike=evidenceN>=6&&uniqueMints<=1;
    const variability=stdev(pnlPcts),consistency=clamp(60+avgPnl*1.4-variability*.45+(uniqueMints>=5?10:0)-concentrationPenalty),leadScore=clamp(50+leadAvg15*1.4+(leadHit25-25)*.30),copyability=clamp(holdScore*.60+leadScore*.25+Math.min(15,uniqueMints*2)-overtradePenalty);
    let score=clamp(profitability*.35+winScore*.25+copyability*.25+consistency*.15-concentrationPenalty*.35);if(mevLike)score=Math.min(score,20);if(insiderLike)score=Math.min(score,30);
    const excluded=mevLike||insiderLike||(closed.length>=8&&profitFactor<.70)||(realizedN>=8&&avgPnl<-5),evidenceTier=evidenceN>=200?'PROVEN':evidenceN>=50?'ESTABLISHED':evidenceN>=20?'TRACK':evidenceN>=5?'PROVISIONAL':'UNPROVEN';
    const windowMetrics=days=>{const cutoff=now()-days*86400000,a=closed.filter(x=>x.ts>=cutoff),w=a.filter(x=>x.pnlPct>0),l=a.filter(x=>x.pnlPct<0),gw=w.reduce((s,x)=>s+num(x.pnlPct),0),gl=Math.abs(l.reduce((s,x)=>s+num(x.pnlPct),0));return{n:a.length,winRate:a.length?w.length/a.length*100:0,avgPnl:avg(a.map(x=>num(x.pnlPct))),profitFactor:gl?gw/gl:gw>0?9.99:0};};
    const value={wallet,score,evidenceTier,evidenceN,realizedN,leadN,winRate,avgPnl,avgWin,avgLoss,profitFactor,medianHoldSec,uniqueMints,leadAvg15,leadHit25,copyability,consistency,overtrade24h,overtradePenalty,concentrationPenalty,mevLike,insiderLike,excluded,mcBand:mcBand(mc),windows:{d1:windowMetrics(1),d7:windowMetrics(7),d30:windowMetrics(30),d90:windowMetrics(90)}};
    this.walletQualityCache.set(cacheKey,{ts:now(),closedN:this.walletClosed.length,signalN:this.walletSignals.length,value});if(this.walletQualityCache.size>3000)this.walletQualityCache.clear();return value;
  }

  walletLeaderboard(limit=25){return[...this.walletStats.keys()].map(w=>this.walletQuality(w)).sort((a,b)=>b.score-a.score).slice(0,limit);}

  walletConsensus(t,windowMin=15){
    const cacheKey=(t?.mint||'')+':'+windowMin,cached=this.walletConsensusCache.get(cacheKey);if(cached&&cached.signalN===this.walletSignals.length&&cached.closedN===this.walletClosed.length&&now()-cached.ts<2500)return cached.value;
    const cutoff=now()-windowMin*60000,signals=this.walletSignals.filter(s=>s.mint===t?.mint&&s.ts>=cutoff),latest=new Map();for(const s of signals){const old=latest.get(s.wallet);if(!old||s.ts>old.ts)latest.set(s.wallet,s);}
    const raw=[...latest.values()].map(s=>{const quality=this.walletQuality(s.wallet,Number(t?.mc||0)),funder=this.latestFunder(s.wallet),ageMin=(now()-s.ts)/60000,chase=s.price>0&&t?.price>0?pct(t.price,s.price):0;return{...s,quality,funder,ageMin,chase};});
    const eligible=raw.filter(x=>!x.quality.excluded&&x.quality.score>=52&&(x.quality.evidenceN>=3||x.traderId)),byCluster=new Map();for(const x of eligible){const k=x.funder||x.wallet,old=byCluster.get(k);if(!old||x.quality.score>old.quality.score)byCluster.set(k,x);}
    const independent=[...byCluster.values()].sort((a,b)=>b.quality.score-a.quality.score),qualified=independent.filter(x=>x.quality.score>=58&&x.quality.copyability>=45),weight=x=>Math.max(.25,1-x.ageMin/windowMin);
    const weighted=qualified.length?qualified.reduce((s,x)=>s+x.quality.score*weight(x),0)/qualified.reduce((s,x)=>s+weight(x),0):0,avgChase=qualified.length?avg(qualified.map(x=>x.chase)):null,score=clamp(weighted+Math.min(12,Math.max(0,qualified.length-1)*4)-(avgChase>10?Math.min(20,avgChase-10):0)),strong=qualified.length>=2&&score>=58&&(avgChase==null||avgChase<=12);
    const value={count:raw.length,eligibleCount:eligible.length,independentCount:independent.length,qualifiedCount:qualified.length,score,strong,avgChase,leaders:qualified.slice(0,8).map(x=>({wallet:x.wallet,traderId:x.traderId,ageMin:x.ageMin,chase:x.chase,funder:x.funder,quality:x.quality}))};
    this.walletConsensusCache.set(cacheKey,{ts:now(),signalN:this.walletSignals.length,closedN:this.walletClosed.length,value});if(this.walletConsensusCache.size>1500)this.walletConsensusCache.clear();return value;
  }

  walletLeadLag(t){
    const key=t?.mint||'',cache=this.leadCache.get(key);if(cache&&cache.signalCount===this.walletSignals.length&&now()-cache.ts<3000)return cache.value;
    const cutoff=now()-15*60000,signals=this.walletSignals.filter(s=>s.mint===t?.mint&&s.ts>=cutoff),latest=new Map();for(const s of signals){const old=latest.get(s.wallet);if(!old||s.ts>old.ts)latest.set(s.wallet,s)}
    const rows=[...latest.values()].map(s=>{const w=this.walletStats.get(s.wallet)||{},b=w.bands?.[mcBand(Number(t?.mc||0))]||{},sample=Number(b.n||w.leadSamples||0),raw=clamp(50+Number(b.avg5||w.avg5m||0)*1.2+Number(b.hit25||w.hit25||0)*.25),shrink=sample/(sample+8),score=clamp(50+(raw-50)*shrink),reliability=clamp(shrink*100);return{wallet:s.wallet,traderId:s.traderId,score,reliability,sample,avg5:Number(b.avg5||w.avg5m||0),hit25:Number(b.hit25||w.hit25||0),ageMin:(now()-s.ts)/60000,funder:this.latestFunder(s.wallet)};});
    const independentFunders=new Set(rows.map(x=>x.funder).filter(Boolean)).size,credible=rows.filter(x=>x.sample>=3),consensusRows=credible.length?credible:rows,consensusV2=this.walletConsensus(t,15),value={count:rows.length,credibleCount:credible.length,independentFunders,leaders:rows.sort((a,b)=>b.score-a.score).slice(0,8),consensus:consensusRows.length?avg(consensusRows.map(x=>x.score)):50,consensusV2};this.leadCache.set(key,{ts:now(),signalCount:this.walletSignals.length,value});return value;
  }

  forecastVector(t,f={},micro=this.microstructure(t),tox=this.toxicity(t,micro)){
    return[
      clamp(Number(f.momentum||50))/100,clamp(Number(f.acceleration||50))/100,clamp(Number(f.flow||micro.buyRatio*100))/100,
      clamp(Number(f.liqScore||0))/100,clamp(Number(f.volScore||0))/100,clamp(Number(f.risk||50))/100,
      clamp(Number(micro.velocity||0)*4)/100,clamp((Number(micro.acceleration||0)+20)*2.5)/100,clamp(Number(tox.score||0))/100,
      clamp(Math.log10(Math.max(1,Number(t?.mc||0)))*13-25)/100
    ];
  }

  vectorDistance(a,b){let s=0,n=Math.min(a?.length||0,b?.length||0);if(!n)return 9;for(let i=0;i<n;i++)s+=(Number(a[i]||0)-Number(b[i]||0))**2;return Math.sqrt(s/n);}

  maybeCreateForecast(t,f,micro,tox){
    if(!t?.mint||!(t.price>0))return;
    const last=this.forecasts.find(x=>x.mint===t.mint&&!x.settled);
    if(last&&now()-last.ts<120000)return;
    const prediction=this.probabilities(t,f,{});this.forecasts.unshift({id:t.mint+':'+now(),mint:t.mint,ts:now(),price:t.price,partition:part(t.mint),vec:this.forecastVector(t,f,micro,tox),prediction,peak:0,trough:0,barrier:null,barrierAt:null,ret15:null,settled:false});
    this.forecasts.splice(6000);this.counters.forecasts++;
  }

  settleForecasts(t){
    if(!t?.mint||!(t.price>0))return;
    const ts=now();
    for(const x of this.forecasts){
      if(x.mint!==t.mint||x.settled)continue;
      const r=pct(t.price,x.price);x.peak=Math.max(x.peak,r);x.trough=Math.min(x.trough,r);
      if(!x.barrier){if(r>=25){x.barrier='UP25';x.barrierAt=ts;}else if(r<=-15){x.barrier='DOWN15';x.barrierAt=ts;}}
      if((ts-x.ts)>=15*60000){x.ret15=r;x.settled=true;if(!x.barrier)x.barrier='NONE';}
    }
  }

  probabilities(t,f={},similar={}){
    const cacheKey=(t?.mint||'')+':'+this.forecasts.length,cache=this.probCache.get(cacheKey);if(cache&&now()-cache.ts<3000)return cache.value;
    const micro=this.microstructure(t),tox=this.toxicity(t,micro),vec=this.forecastVector(t,f,micro,tox);
    const settled=this.forecasts.filter(x=>x.settled&&x.partition==='train'&&x.mint!==t?.mint).map(x=>({...x,d:this.vectorDistance(vec,x.vec)})).sort((a,b)=>a.d-b.d).slice(0,60);
    const n=settled.length,weighted=settled.map(x=>({...x,w:Math.exp(-Math.max(0,x.d)*7)})),sw=weighted.reduce((s,x)=>s+x.w,0),ws=(fn)=>weighted.reduce((s,x)=>s+x.w*(fn(x)?1:0),0),wa=(fn)=>sw?weighted.reduce((s,x)=>s+x.w*num(fn(x)),0)/sw:0;
    const fallback25=clamp(Number(similar.hit25||25),5,75)/100,fallback100=clamp(Number(similar.hit100||8),1,35)/100,fallbackStop=clamp(35+tox.score*.25,15,75)/100,priorStrength=8;
    const p25=sw?(fallback25*priorStrength+ws(x=>x.barrier==='UP25'))/(priorStrength+sw):fallback25,pStop=sw?(fallbackStop*priorStrength+ws(x=>x.barrier==='DOWN15'))/(priorStrength+sw):fallbackStop,p100=sw?(fallback100*priorStrength+ws(x=>x.peak>=100))/(priorStrength+sw):fallback100;
    const expected15=sw?wa(x=>x.ret15):((p25*25)-(pStop*15))*.45,nearestAvgDistance=n?avg(settled.map(x=>x.d)):null,effectiveN=sw,uncertainty=clamp(1-effectiveN/18+(nearestAvgDistance||0)*.45,.08,1),confidence=clamp((1-uncertainty)*(1-(nearestAvgDistance||0)*.55),0,1);
    const value={n,effectiveN,p25,p100,pStop15:pStop,expected15,uncertainty,confidence,nearestAvgDistance,model:'distance-weighted empirical Bayes KNN v2'};this.probCache.set(cacheKey,{ts:now(),value});if(this.probCache.size>1000)for(const [k,v] of this.probCache)if(now()-v.ts>10000)this.probCache.delete(k);return value;
  }
  probabilityCalibration(){
    const rows=this.forecasts.filter(x=>x.settled&&x.prediction),calc=(partition)=>{const a=rows.filter(x=>!partition||x.partition===partition);if(!a.length)return{n:0,brier25:null,brierStop:null,meanP25:null,actual25:null,meanPStop:null,actualStop:null};const b=(p,y)=>(num(p)-y)**2;return{n:a.length,brier25:avg(a.map(x=>b(x.prediction?.p25,x.barrier==='UP25'?1:0))),brierStop:avg(a.map(x=>b(x.prediction?.pStop15,x.barrier==='DOWN15'?1:0))),meanP25:avg(a.map(x=>num(x.prediction?.p25)))*100,actual25:a.filter(x=>x.barrier==='UP25').length/a.length*100,meanPStop:avg(a.map(x=>num(x.prediction?.pStop15)))*100,actualStop:a.filter(x=>x.barrier==='DOWN15').length/a.length*100};};
    return{train:calc('train'),holdout:calc('holdout'),all:calc(null)};
  }

  executionBrain(t,candidate={}){
    const p=this.execution.priority,j=this.execution.jito,accel=Number(candidate?.features?.acceleration||0),score=Number(candidate?.score||0),liq=Number(t?.liq||0);
    const urgency=clamp((accel-45)*1.2+(score-60)*1.1+(liq>50000?8:0));
    const congestion=clamp(Math.log10(1+Number(p.p75||0))*18);
    const useJito=urgency>=58||congestion>=62;
    const priorityLamports=Math.max(0,Math.round(Number(p.p75||p.p50||0)));
    const baseFeeLamports=5000,jitoTipLamports=useJito?Math.max(1000,Math.round(Number(j.p50||0)*1e9)):0;
    const totalNetworkLamports=baseFeeLamports+priorityLamports+jitoTipLamports,solUsd=Number(t?.inferredSolUsd||0),networkCostUsd=solUsd>0?totalNetworkLamports/1e9*solUsd:null;
    const landingScore=clamp(55+urgency*.18+(priorityLamports>=Number(p.p75||0)?12:0)+(useJito&&jitoTipLamports>0?10:0)-congestion*.15);
    return{mode:useJito?'JITO_PROTECTED':'STANDARD_RPC',urgency,congestion,baseFeeLamports,priorityLamports,jitoTipLamports,totalNetworkLamports,networkCostUsd,landingScore,revertProtection:useJito,routeQuoteConnected:!!this.routeQuoteUrl,broadcastAllowed:false};
  }

  preTradeSafety(token,c={},micro=this.microstructure(token),tox=this.toxicity(token,micro)){
    const q=num(c?.quality?.score||c?.quality||0),sources=num(c?.quality?.sourceCount||token?.sources?.length||0),age=num(c?.features?.age),mc=num(token?.mc),liq=num(token?.liq),tx=num(c?.features?.totalTx),buy=num(c?.features?.buyRatio||micro?.buyRatio),researchOnly=c?.strategy?.risk==='R&D'||c?.strategy?.risk==='CONTROL'||!!c?.strategy?.specialist,reasons=[];let score=100;
    if(liq<5000){score-=35;reasons.push('very thin liquidity');}else if(liq<10000){score-=15;reasons.push('thin liquidity');}
    if(mc<25000){score-=35;reasons.push('micro-cap launch zone');}else if(mc<100000){score-=12;reasons.push('sub-100K risk zone');}
    if(age<.5){score-=25;reasons.push('first-30-second fragility');}else if(age<2){score-=10;reasons.push('very young token');}
    if(sources<2){score-=14;reasons.push('single-source market data');}if(tx<6){score-=14;reasons.push('shallow transaction sample');}if(buy>.82){score-=20;reasons.push('euphoric buyer pressure');}if(tox.score>=70){score-=30;reasons.push('toxic / clustered flow');}if(q&&q<60){score-=18;reasons.push('weak data quality');}
    const hardVeto=tox.veto||liq<3000||(!researchOnly&&mc<50000)||(!researchOnly&&age<.35)||(!researchOnly&&sources<1);
    return{score:clamp(score),hardVeto,reasons,researchOnly,model:'external-research-safety-v1'};
  }

  evaluateCandidate(c){
    const micro=this.microstructure(c.token),tox=this.toxicity(c.token,micro),prob=this.probabilities(c.token,c.features,c.similar||{}),lead=this.walletLeadLag(c.token),walletConsensus=this.walletConsensus(c.token,15),exec=this.executionBrain(c.token,c),world=this.worldContext(c.strategy?.id),safety=this.preTradeSafety(c.token,c,micro,tox);
    const quality=Number(c.quality?.score||50)/100,confidence=clamp((Number(c.score||0)-Number(c.threshold||55)+20)/40,0.15,1),leadBase=walletConsensus.qualifiedCount?walletConsensus.score:lead.consensus,walletBoost=clamp((leadBase-50)/100,-.2,.30),worldBoost=clamp(Number(world.strategyEdge||0)/50,-.25,.25);
    const modelEdge=prob.expected15+(prob.p25*25)-(prob.pStop15*18),frictionPenalty=2.5+Math.max(0,exec.congestion-50)*.015+Math.max(0,70-safety.score)*.04,uncertaintyPenalty=prob.uncertainty*6,rawEv=modelEdge+(walletBoost+worldBoost)*10-tox.score*.10-frictionPenalty-uncertaintyPenalty;
    const utility=rawEv*confidence*quality*(.55+.45*num(prob.confidence||1))*(1-tox.score/130)*(safety.score/100),sizeMultiplier=clamp(.70+utility/45+walletBoost+worldBoost,.30,1.20),veto=safety.hardVeto||tox.veto||prob.pStop15>.78||exec.congestion>95;
    return{version:this.version,micro,toxicity:tox,probability:prob,walletLeadLag:lead,walletConsensus,preTradeSafety:safety,execution:exec,world,expectedValue:rawEv,modelEdge,frictionPenalty,uncertaintyPenalty,utility,sizeMultiplier,veto,vetoReason:safety.hardVeto?'pre-trade safety veto':tox.veto?'toxic-flow veto':prob.pStop15>.78?'probability-of-loss veto':exec.congestion>95?'execution-congestion veto':''};
  }

  proposeCapital(c){
    const key=(c.strategy?.id||'unknown')+':'+c.token?.mint,exists=this.master.proposals.find(x=>x.key===key&&now()-x.ts<12000);if(exists)return exists;
    const ev=this.evaluateCandidate(c),p={key,ts:now(),strategy:c.strategy?.id||'',strategyName:c.strategy?.name||'',mint:c.token?.mint,symbol:c.token?.symbol,mc:Number(c.token?.mc||0),liq:Number(c.token?.liq||0),price:Number(c.token?.price||0),utility:ev.utility,expectedValue:ev.expectedValue,sizeMultiplier:ev.sizeMultiplier,veto:ev.veto,probability:ev.probability,toxicity:ev.toxicity,execution:ev.execution,world:ev.world};
    this.master.proposals.push(p);this.master.proposals=this.master.proposals.filter(x=>now()-x.ts<30000).slice(-300);return p;
  }

  runCapitalAuction(tokenLookup,executionQuote){
    if(now()-this.master.lastAuction<1500)return null;this.master.lastAuction=now();this.counters.auctions++;
    this.markMaster(tokenLookup,executionQuote);
    const ready=this.master.proposals.filter(x=>now()-x.ts>=1200&&!x.veto&&x.utility>1.5);
    this.master.proposals=this.master.proposals.filter(x=>now()-x.ts<30000&&!ready.includes(x));
    const byMint=new Map();for(const p of ready){const old=byMint.get(p.mint);if(!old||p.utility>old.utility)byMint.set(p.mint,p);}
    const ranked=[...byMint.values()].sort((a,b)=>b.utility-a.utility);
    const picks=[];for(const p of ranked){
      if(this.master.positions.some(x=>x.mint===p.mint)||this.master.positions.length>=4)continue;
      const t=tokenLookup?.(p.mint);if(!t?.price)continue;
      const budget=Math.min(this.master.cash*.25,this.master.equity*.15,Math.max(this.master.equity*.04,this.master.equity*.10*p.sizeMultiplier));
      if(budget<5||this.master.cash<budget)continue;
      const ex=executionQuote?executionQuote(t,budget,'buy'):{fillPrice:t.price,feeRate:.0125,fixedCost:.02,slippage:.01};
      const cost=budget*(1+Number(ex.feeRate||0))+Number(ex.fixedCost||0);if(cost>this.master.cash)continue;
      this.master.cash-=cost;this.master.positions.push({id:'cio:'+now()+':'+p.mint,mint:p.mint,symbol:p.symbol,strategy:p.strategy,strategyName:p.strategyName,opened:now(),entry:Number(ex.fillPrice||t.price),units:budget/Number(ex.fillPrice||t.price),invested:budget,entryCost:cost,peak:Number(ex.fillPrice||t.price),trough:Number(ex.fillPrice||t.price),proposal:p,execution:ex,lastPrice:t.price});
      picks.push(p);if(picks.length>=2)break;
    }
    this.markMaster(tokenLookup,executionQuote);return picks;
  }

  exitPlan(position,t,f={}){
    const current=pct(Number(t?.price||0),Number(position?.entry||0)),micro=this.microstructure(t),tox=this.toxicity(t,micro),prob=this.probabilities(t,f,position?.proposal?.probability||{}),lead=this.walletLeadLag(t);
    const recentSells=(t?.chainFlow||[]).filter(e=>now()-Number(e.ts||0)<60000&&e.action==='SELL').length,recentBuys=(t?.chainFlow||[]).filter(e=>now()-Number(e.ts||0)<60000&&e.action==='BUY').length;
    const flowDecay=recentSells>recentBuys&&recentSells>=2,holdScore=(prob.p25-prob.pStop15)*100+micro.acceleration*.8+(micro.buyRatio-.5)*35+(lead.consensus-50)*.25-tox.score*.45;
    let action='HOLD',fraction=0,reason='expected hold value remains positive';
    if(current<=-20||tox.score>=84||prob.pStop15>=.82){action='EXIT';fraction=1;reason=current<=-20?'loss circuit':tox.score>=84?'toxic flow spike':'loss probability spike';}
    else if(flowDecay&&current>5&&holdScore<5){action='TRIM';fraction=.50;reason='seller arrival + fading hold value';}
    else if(current>=35&&holdScore<15){action='TRIM';fraction=.25;reason='harvest strength while edge decays';}
    else if(current>=70&&holdScore<28){action='TRIM';fraction=.25;reason='runner de-risk';}
    this.counters.adaptiveExits+=action==='HOLD'?0:1;
    return{action,fraction,reason,holdScore,current,probability:prob,toxicity:tox,micro,walletLeadLag:lead};
  }

  markMaster(tokenLookup,executionQuote){
    for(const p of [...this.master.positions]){
      const t=tokenLookup?.(p.mint);if(!t?.price)continue;p.lastPrice=t.price;p.peak=Math.max(p.peak,t.price);p.trough=Math.min(p.trough,t.price);
      const plan=this.exitPlan(p,t,{});
      if(plan.action==='EXIT'||pct(t.price,p.entry)<=-18||pct(t.price,p.entry)>=120){
        const ex=executionQuote?executionQuote(t,p.units*t.price,'sell'):{fillPrice:t.price,feeRate:.0125,fixedCost:.02,slippage:.01},gross=p.units*Number(ex.fillPrice||t.price),proceeds=Math.max(0,gross*(1-Number(ex.feeRate||0))-Number(ex.fixedCost||0)),pnl=proceeds-p.entryCost;
        this.master.cash+=proceeds;this.master.trades.unshift({...p,closedAt:now(),exit:Number(ex.fillPrice||t.price),exitExecution:ex,pnl,pnlPct:p.entryCost?pnl/p.entryCost*100:0,why:plan.reason});this.master.trades=this.master.trades.slice(0,1000);this.master.positions=this.master.positions.filter(x=>x.id!==p.id);this.counters.masterTrades++;
      }
    }
    this.master.equity=this.master.cash+this.master.positions.reduce((s,p)=>{const t=tokenLookup?.(p.mint);return s+p.units*Number(t?.price||p.lastPrice||p.entry);},0);this.master.peak=Math.max(this.master.peak,this.master.equity);this.master.dd=Math.max(this.master.dd,this.master.peak?100*(1-this.master.equity/this.master.peak):0);
  }

  async getMintDecimals(mint){
    if(!mint)return null;if(this.mintDecimals.has(mint))return this.mintDecimals.get(mint);
    if(!this.rpcUrl)return null;
    try{
      const r=await fetch(this.rpcUrl,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({jsonrpc:'2.0',id:1,method:'getTokenSupply',params:[mint,{commitment:'confirmed'}]})});
      if(!r.ok)return null;const j=await r.json(),d=Number(j?.result?.value?.decimals);if(Number.isFinite(d)){this.mintDecimals.set(mint,d);return d;}
    }catch{}
    return null;
  }

  async captureRouteQuote(row,token){
    if(!row||!token||!this.routeQuoteUrl)return;
    const solUsd=Number(token.inferredSolUsd||0);if(!(solUsd>0)){row.routeQuoteStatus='missing-sol-usd';return;}
    const decimals=await this.getMintDecimals(token.mint);if(!Number.isFinite(decimals)){row.routeQuoteStatus='mint-decimals-unavailable';return;}
    const solAmount=Math.max(10000,Math.round((Number(row.notional||0)/solUsd)*1e9));
    try{
      const u=new URL(this.routeQuoteUrl);u.searchParams.set('inputMint','So11111111111111111111111111111111111111112');u.searchParams.set('outputMint',token.mint);u.searchParams.set('amount',String(solAmount));u.searchParams.set('slippageBps','150');
      const r=await fetch(u,{headers:{accept:'application/json'}});if(!r.ok){row.routeQuoteStatus='http-'+r.status;return;}
      const j=await r.json();if(!j?.outAmount){row.routeQuoteStatus='no-route';return;}
      const tokenOut=Number(j.outAmount)/(10**decimals),impliedUsd=tokenOut>0?Number(row.notional||0)/tokenOut:null;
      row.routeQuoteStatus='quoted';row.routeQuote={ts:now(),contextSlot:j.contextSlot||null,timeTaken:Number(j.timeTaken||0),priceImpactPct:Number(j.priceImpactPct||0),outAmount:j.outAmount,otherAmountThreshold:j.otherAmountThreshold||null,tokenOut,impliedUsd,observedUsd:Number(token.price||0),impliedVsObservedPct:impliedUsd&&token.price?pct(impliedUsd,Number(token.price)):null,route:(j.routePlan||[]).map(x=>x?.swapInfo?.label).filter(Boolean).slice(0,8)};
      if(this.shadowWalletPublicKey&&this.rpcUrl){
        try{
          const swapUrl=this.routeQuoteUrl.replace(/\/quote(?:\?.*)?$/,'/swap');
          const sr=await fetch(swapUrl,{method:'POST',headers:{'content-type':'application/json',accept:'application/json'},body:JSON.stringify({quoteResponse:j,userPublicKey:this.shadowWalletPublicKey,wrapAndUnwrapSol:true,dynamicComputeUnitLimit:true})});
          if(!sr.ok){row.transactionSimulation={status:'build-http-'+sr.status};}
          else{
            const sj=await sr.json(),tx=sj?.swapTransaction;
            if(!tx)row.transactionSimulation={status:'no-transaction'};
            else{
              const sim=await fetch(this.rpcUrl,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({jsonrpc:'2.0',id:1,method:'simulateTransaction',params:[tx,{encoding:'base64',sigVerify:false,replaceRecentBlockhash:true,commitment:'processed'}]})});
              const simj=sim.ok?await sim.json():null,val=simj?.result?.value;
              row.transactionSimulation={status:val?(val.err?'simulation-failed':'simulation-ok'):'simulation-unavailable',err:val?.err||null,unitsConsumed:Number(val?.unitsConsumed||0),logs:(val?.logs||[]).slice(-12)};
            }
          }
        }catch(e){row.transactionSimulation={status:'simulation-error',error:String(e?.message||e).slice(0,160)};}
      }else row.transactionSimulation={status:'shadow-wallet-not-configured'};
    }catch(e){row.routeQuoteStatus='error';row.routeQuoteError=String(e?.message||e).slice(0,160);}
  }

  recordShadowEntry({position,token,alpha}){
    if(!position||!token)return;
    const row={id:'shadow:'+position.id,positionId:position.id,strategy:position.strategy,mint:position.mint,symbol:position.symbol,ts:now(),observedPrice:Number(token.price||0),paperFill:Number(position.entry||0),paperCost:Number(position.entryCost||0),notional:Number(position.invested||0),executionPlan:alpha?.execution||null,probability:alpha?.probability||null,toxicity:alpha?.toxicity||null,routeQuoteStatus:this.routeQuoteUrl?'pending':'not-connected',checkpoints:{twoSec:null,fiveSec:null,fifteenSec:null},closed:false};
    this.shadow.unshift(row);this.shadow=this.shadow.slice(0,2500);this.counters.shadowIntents++;if(this.routeQuoteUrl)this.captureRouteQuote(row,token);return row;
  }

  markShadow(t){
    const ts=now();for(const s of this.shadow){if(s.mint!==t?.mint||s.closed||!(t.price>0))continue;const age=(ts-s.ts)/1000,r=pct(t.price,s.observedPrice);if(age>=2&&s.checkpoints.twoSec==null)s.checkpoints.twoSec=r;if(age>=5&&s.checkpoints.fiveSec==null)s.checkpoints.fiveSec=r;if(age>=15&&s.checkpoints.fifteenSec==null)s.checkpoints.fifteenSec=r;}
  }

  recordShadowClose(position){
    const s=this.shadow.find(x=>x.positionId===position?.id);if(!s)return;s.closed=true;s.closedAt=now();s.paperPnlPct=Number(position.pnlPct||0);s.exitExecution=position.exitExecution||null;
  }

  observeToken(t,ctx={}){
    if(!t?.mint)return null;this.counters.tokens++;
    const micro=this.microstructure(t),tox=this.toxicity(t,micro);this.settleWalletSignals(t);this.settleForecasts(t);this.maybeCreateForecast(t,ctx.features||{},micro,tox);this.markShadow(t);
    return{micro,toxicity:tox};
  }

  observeWorld(ctx={}){
    if(now()-this.lastWorldAt<60000)return;this.lastWorldAt=now();
    const toks=Array.isArray(ctx.tokens)?ctx.tokens:[],mcs=toks.map(t=>Number(t.mc||0)).filter(x=>x>0),liqs=toks.map(t=>Number(t.liq||0)).filter(x=>x>0);
    const weather=ctx.weather||{},eq=ctx.strategyEquity||{};
    const vec=[clamp(weather.temperature||0)/100,clamp(weather.buyPressure||0)/100,clamp(weather.launchVelocity*8||0)/100,clamp(weather.collapseRate||0)/100,clamp(Math.log10(1+median(mcs))*15)/100,clamp(Math.log10(1+median(liqs))*18)/100,clamp(Math.log10(1+Number(this.execution.priority.p75||0))*18)/100,clamp(50+Number(this.execution.sol?.ret5m||0)*3)/100];
    for(const old of this.world){if(!old.settled&&now()-old.ts>=15*60000){old.strategyReturns={};for(const [id,v] of Object.entries(eq)){const b=Number(old.strategyEquity?.[id]||0);if(b>0)old.strategyReturns[id]=pct(Number(v),b);}old.settled=true;}}
    this.world.unshift({ts:now(),vec,weather:safe(weather),strategyEquity:safe(eq),strategyReturns:null,settled:false});this.world=this.world.slice(0,1000);
  }

  worldContext(strategyId){
    const cur=this.world[0];if(!cur)return{n:0,strategyEdge:0,label:'collecting'};
    const peers=this.world.filter(x=>x.settled&&x!==cur).map(x=>({...x,d:this.vectorDistance(cur.vec,x.vec)})).sort((a,b)=>a.d-b.d).slice(0,20);
    const vals=peers.map(x=>Number(x.strategyReturns?.[strategyId])).filter(Number.isFinite),edge=avg(vals);
    return{n:vals.length,strategyEdge:edge,label:vals.length>=5?(edge>3?'historically favorable':edge<-3?'historically hostile':'historically neutral'):'collecting',nearestDistance:peers.length?avg(peers.map(x=>x.d)):null};
  }

  async pollExternal(){
    if(now()-this.lastExternalPoll<30000)return;this.lastExternalPoll=now();
    try{
      if(this.rpcUrl){
        const r=await fetch(this.rpcUrl,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({jsonrpc:'2.0',id:1,method:'getRecentPrioritizationFees',params:[[]]})});
        if(r.ok){const j=await r.json(),fees=(j.result||[]).map(x=>Number(x.prioritizationFee||0)).filter(Number.isFinite);if(fees.length)this.execution.priority={ts:now(),p50:q(fees,.50),p75:q(fees,.75),p90:q(fees,.90),sample:fees.length};}
      }
      const jr=await fetch(this.jitoTipUrl,{headers:{accept:'application/json'}});if(jr.ok){const j=await jr.json(),x=Array.isArray(j)?j[0]:j;if(x)this.execution.jito={ts:now(),p25:Number(x.landed_tips_25th_percentile||0),p50:Number(x.ema_landed_tips_50th_percentile||x.landed_tips_50th_percentile||0),p75:Number(x.landed_tips_75th_percentile||0),p95:Number(x.landed_tips_95th_percentile||0)};}
      if(this.routeQuoteUrl){
        const u=new URL(this.routeQuoteUrl);u.searchParams.set('inputMint','So11111111111111111111111111111111111111112');u.searchParams.set('outputMint','EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v');u.searchParams.set('amount','1000000000');u.searchParams.set('slippageBps','30');
        const sr=await fetch(u,{headers:{accept:'application/json'}});if(sr.ok){const sj=await sr.json(),price=Number(sj.outAmount||0)/1e6;if(price>0){const hist=[...(this.execution.sol?.history||[]),{ts:now(),price}].filter(x=>now()-x.ts<3600000).slice(-120),old=hist.filter(x=>now()-x.ts>=5*60000).at(-1)||hist[0];this.execution.sol={ts:now(),price,ret5m:old?.price?pct(price,old.price):0,history:hist};}}
      }
      this.execution.lastPoll=now();
    }catch{this.execution.errors++;}
  }

  prune(){
    const cutoff=now()-48*3600000;this.walletSignals=this.walletSignals.filter(x=>x.ts>=cutoff).slice(0,5000);this.walletClosed=this.walletClosed.filter(x=>x.ts>=now()-90*86400000).slice(0,6000);this.forecasts=this.forecasts.filter(x=>!x.settled||x.ts>=cutoff).slice(0,6000);this.shadow=this.shadow.filter(x=>!x.closed||x.ts>=cutoff).slice(0,2500);
    if(this.walletPairs.size>10000){const rows=[...this.walletPairs.entries()].sort((a,b)=>Number(b[1].last||0)-Number(a[1].last||0)).slice(0,10000);this.walletPairs=new Map(rows);}
    if(this.fundingEdges.size>10000)this.fundingEdges=new Map([...this.fundingEdges.entries()].sort((a,b)=>Number(b[1].last||0)-Number(a[1].last||0)).slice(0,10000));
    if(this.creatorEdges.size>10000)this.creatorEdges=new Map([...this.creatorEdges.entries()].sort((a,b)=>Number(b[1].last||0)-Number(a[1].last||0)).slice(0,10000));
  }

  snapshot(compact=false){
    const settled=this.forecasts.filter(x=>x.settled&&x.partition==='train'),sh=this.shadow.filter(x=>x.checkpoints?.fiveSec!=null),quoted=this.shadow.filter(x=>x.routeQuoteStatus==='quoted'),wallets=[...this.walletStats.values()].filter(x=>x.leadSamples>0).sort((a,b)=>(b.avg5m||0)-(a.avg5m||0)).slice(0,15);
    const subsystems=[
      ['Shadow Execution Twin',true,this.routeQuoteUrl?(this.shadowWalletPublicKey?'Jupiter quote + unsigned Solana simulation configured':'Jupiter quote active; unsigned simulation waiting for public wallet address'):'paper-vs-next-tick twin active'],
      ['Wallet Intelligence Graph',this.walletStats.size>0,this.walletStats.size+' wallets · '+this.walletPairs.size+' co-buy edges'],
      ['Wallet Quality + Copyability',this.walletStats.size>0,this.walletClosed.length+' realized proxy closes · MEV/insider/overtrade penalties'],
      ['Independent Wallet Consensus',true,'funding-cluster de-duplication + qualified multi-wallet agreement'],
      ['Toxic Flow Detector',true,'cluster, sizing similarity, concentration, seller-arrival vetoes'],
      ['Lead-Lag Wallet Engine',wallets.length>0,wallets.length+' wallets with settled lead samples'],
      ['Microstructure Engine',this.micro.size>0,this.micro.size+' token states'],
      ['Execution Brain',this.execution.priority.ts>0||this.execution.jito.ts>0,'priority fee + Jito tip telemetry; broadcast disabled'],
      ['CIO Capital Auction',true,'shared paper portfolio; '+this.master.positions.length+' open'],
      ['Probability Engine',true,settled.length+' settled training forecasts · distance-weighted empirical Bayes + calibration'],
      ['Adaptive Exit Intelligence',true,this.counters.adaptiveExits+' non-hold decisions'],
      ['World Model',true,this.world.filter(x=>x.settled).length+' settled market regimes']
    ].map(([name,active,detail],i)=>({id:i+1,name,active,detail}));
    return{
      version:this.version,subsystems,
      execution:this.execution,
      master:{cash:this.master.cash,equity:this.master.equity,peak:this.master.peak,dd:this.master.dd,open:this.master.positions.length,trades:this.master.trades.length,positions:this.master.positions.slice(-20),recentTrades:this.master.trades.slice(0,20),proposalCount:this.master.proposals.length},
      shadow:{intents:this.shadow.length,with5s:sh.length,avg5s:avg(sh.map(x=>x.checkpoints.fiveSec)),routeQuoteConnected:!!this.routeQuoteUrl,transactionSimulationConfigured:!!this.shadowWalletPublicKey,simulatedOk:this.shadow.filter(x=>x.transactionSimulation?.status==='simulation-ok').length,quoted:quoted.length,routeCoveragePct:this.shadow.length?quoted.length/this.shadow.length*100:0,avgRouteImpactPct:avg(quoted.map(x=>Number(x.routeQuote?.priceImpactPct||0)*100)),avgRouteVsObservedPct:avg(quoted.map(x=>Number(x.routeQuote?.impliedVsObservedPct||0)))},
      forecasts:{total:this.forecasts.length,settledTrain:settled.length,up25Rate:settled.length?settled.filter(x=>x.barrier==='UP25').length/settled.length*100:0,down15Rate:settled.length?settled.filter(x=>x.barrier==='DOWN15').length/settled.length*100:0,calibration:this.probabilityCalibration()},
      wallets:{nodes:this.walletStats.size,edges:this.walletPairs.size,leaders:wallets,qualityLeaderboard:compact?[]:this.walletLeaderboard(25),closedProxyTrades:this.walletClosed.length,model:'35% profitability + 25% win quality + 25% copyability + 15% consistency, with MEV/insider/overtrade penalties',graph:compact?null:this.walletGraph()},
      world:{snapshots:this.world.length,settled:this.world.filter(x=>x.settled).length,current:this.world[0]||null},
      counters:this.counters
    };
  }
}

export function createPumpLabAlphaOS(opts={}){return new PumpLabAlphaOS(opts);}
