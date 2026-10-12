// Observed-wallet copy desk. Independent PAPER ONLY; no credentials, wallet signing or paid AI.
export const COPY_POLICY=Object.freeze({minClosed:20,minWinRate:.55,maxTopCoinShare:.5,minHoldSeconds:60,maxRisk:50,maxTop10:30,minLockedPct:90,minConfidence:.65,maxPositions:2,standardTicket:100,maxImpact:.03,minLiquidity:10000,maxDailyDrawdown:.15,maxAgeMs:90000,reportTtlMs:300000,requestGapMs:20000});
const good=x=>typeof x==='number'&&Number.isFinite(x);
const median=xs=>{if(!xs.length)return null;const a=xs.slice().sort((a,b)=>a-b);return a.length%2?a[a.length>>1]:(a[a.length/2-1]+a[a.length/2])/2};
export function screenCopyTrader({wallet,quality,closed=[],ts=Date.now()}){
 const rows=closed.filter(x=>x.wallet===wallet&&good(x.pnlUsd)&&good(x.ts)&&x.ts<=ts);
 const wins=rows.filter(x=>x.pnlUsd>0),profits=wins.reduce((s,x)=>s+x.pnlUsd,0);
 const byMint=new Map();for(const x of wins)byMint.set(x.mint,(byMint.get(x.mint)||0)+x.pnlUsd);
 const topShare=profits>0?Math.max(0,...byMint.values())/profits:null;
 const recent=rows.filter(x=>x.ts>=ts-7*86400000),sevenDayNet=recent.reduce((s,x)=>s+x.pnlUsd,0);
 const hold=median(rows.filter(x=>good(x.holdSeconds)&&x.holdSeconds>=0).map(x=>x.holdSeconds));
 const winRate=rows.length?wins.length/rows.length:null,reasons=[];
 if(!wallet||!quality||quality.wallet!==wallet)reasons.push('wallet_unverified');
 if(quality?.excluded)reasons.push('wallet_quality_excluded');
 if(rows.length<COPY_POLICY.minClosed)reasons.push('insufficient_closed_trades');
 if(winRate===null||winRate<COPY_POLICY.minWinRate)reasons.push('low_observed_win_rate');
 if(topShare===null||topShare>COPY_POLICY.maxTopCoinShare)reasons.push('one_coin_concentration');
 if(!recent.length||sevenDayNet<=0)reasons.push('no_positive_7d_evidence');
 if(hold===null||hold<COPY_POLICY.minHoldSeconds)reasons.push('unrepeatable_hold_time');
 // These are inferred Solana wallet-ledger outcomes, not independently verified Fomo leaderboard P&L.
 return {status:reasons.length?'REJECT':'CANDIDATE',reasons,wallet,sample:rows.length,winRate,topCoinProfitShare:topShare,sevenDayNetUsd:recent.length?sevenDayNet:null,medianHoldSeconds:hold,copyability:good(quality?.copyability)?quality.copyability:null,evidence:'observed_wallet_proxy'};
}
export function normalizeRugcheck(raw){
 if(!raw||typeof raw!=='object'||Array.isArray(raw))return null;
 const score=[raw.score_normalised,raw.score_normalized,raw.scoreNormalized,raw.risk_score_normalised].find(good);
 const t=raw.token&&typeof raw.token==='object'?raw.token:{};
 const hasMint=Object.hasOwn(t,'mintAuthority')||Object.hasOwn(raw,'mintAuthority');
 const hasFreeze=Object.hasOwn(t,'freezeAuthority')||Object.hasOwn(raw,'freezeAuthority');
 const mintAuthority=t.mintAuthority??raw.mintAuthority??null,freezeAuthority=t.freezeAuthority??raw.freezeAuthority??null;
 const holders=Array.isArray(raw.topHolders)?raw.topHolders:null;
 const top10=holders&&holders.length>=1&&holders.slice(0,10).every(x=>good(x?.pct)&&x.pct>=0&&x.pct<=100)?holders.slice(0,10).reduce((s,x)=>s+x.pct,0):null;
 const dangers=(Array.isArray(raw.risks)?raw.risks:[]).filter(x=>['danger','critical'].includes(String(x?.level||'').toLowerCase())).map(x=>String(x?.name||'unknown'));
 const insiders=Array.isArray(raw.insiderNetworks)?raw.insiderNetworks.length:null;
 const locked=good(raw.lpLockedPct)?raw.lpLockedPct:null;
 return {score:good(score)&&score>=0&&score<=100?score:null,hasMint,hasFreeze,mintAuthority,freezeAuthority,top10Pct:top10,insiderNetworks:insiders,lockedPct:locked,dangers};
}
export function assessCopyToken(report,{graduated=false}={}){
 const r=normalizeRugcheck(report),reasons=[];
 if(!r)return {status:'SKIP',reasons:['no_report']};
 if(r.score===null)reasons.push('missing_normalized_risk_score');
 else if(r.score>COPY_POLICY.maxRisk)reasons.push('risk_score');
 if(!r.hasMint||!r.hasFreeze)reasons.push('unknown_authority');
 if(r.mintAuthority||r.freezeAuthority)reasons.push('authority_open');
 if(r.dangers.length)reasons.push('danger:'+r.dangers[0]);
 if(r.top10Pct===null)reasons.push('missing_top10_evidence');
 else if(r.top10Pct>COPY_POLICY.maxTop10)reasons.push('top10_concentration');
 if(r.insiderNetworks===null)reasons.push('missing_insider_evidence');
 else if(r.insiderNetworks>0)reasons.push('insider_networks');
 // Pump.fun bonding-curve tokens do not yet have the same DEX LP-lock semantics.
 if(graduated){if(r.lockedPct===null)reasons.push('missing_pool_lock_evidence');else if(r.lockedPct<COPY_POLICY.minLockedPct)reasons.push('pool_not_locked')}
 return {status:reasons.length?'SKIP':'PASSED_FACT_CHECKS',reasons,report:r};
}
const slippage=(usd,liq)=>Math.min(.08,.004+usd/Math.max(1,liq)*.35);
const quoteOk=(q,ts)=>!!(q?.verified&&good(q.price)&&q.price>0&&good(q.liq)&&q.liq>=COPY_POLICY.minLiquidity&&good(q.updatedAt)&&ts>=q.updatedAt&&ts-q.updatedAt<=COPY_POLICY.maxAgeMs);
export class CopyDesk{
 constructor({fetchReport=null,clock=Date.now}={}){
  this.version=1;this.clock=clock;this.fetchReport=fetchReport||this.defaultReport.bind(this);
  this.cash=1000;this.peak=1000;this.positions=[];this.trades=[];this.decisions=[];this.leaders=[];this.lastReviewedAt=0;this.lastCheckedAt=0;this.lastRequestAt=0;this.savedAt=0;this.requestCount=0;this.cache=new Map();this.pending=new Set();
 }
 async defaultReport(mint){
  const signal=AbortSignal.timeout(5500),res=await fetch('https://api.rugcheck.xyz/v1/tokens/'+encodeURIComponent(mint)+'/report',{headers:{accept:'application/json'},signal});
  if(!res.ok)throw Error('http_'+res.status);
  return res.json();
 }
 record(row){this.decisions.unshift({ts:this.clock(),...row});this.decisions.splice(100);this.savedAt=this.clock();return true}
 review(rows=[]){const unique=new Map();for(const r of rows){if(!r?.wallet||unique.has(r.wallet))continue;unique.set(r.wallet,screenCopyTrader({...r,ts:this.clock()}))}
  this.leaders=[...unique.values()].sort((a,b)=>((b.status==='CANDIDATE')-(a.status==='CANDIDATE'))||(b.sevenDayNetUsd||0)-(a.sevenDayNetUsd||0)).slice(0,25);
  this.lastReviewedAt=this.clock();return this.leaders;
 }
 async inspectBuy({event,quality,closed=[],quote=()=>null}={}){
  if(event?.action!=='BUY'||event?.confidence!=='verified'||!event?.watchlist||!event?.traderId)return false;
  const ts=this.clock(),key=event.signature+':'+event.wallet+':'+event.mint;
  if(this.pending.has(key)||this.decisions.some(x=>x.key===key))return false;
  this.pending.add(key);
  try{
   const trader=screenCopyTrader({wallet:event.wallet,quality,closed,ts});
   if(trader.status!=='CANDIDATE')return this.record({key,action:'SKIP',stage:'TRADER',wallet:event.wallet,mint:event.mint,reason:trader.reasons.join(',')});
   if(!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(event.mint))return this.record({key,action:'SKIP',stage:'TOKEN',wallet:event.wallet,mint:event.mint,reason:'invalid_solana_mint'});
   if(ts-this.lastRequestAt<COPY_POLICY.requestGapMs)return this.record({key,action:'SKIP',stage:'SOURCE',wallet:event.wallet,mint:event.mint,reason:'rate_limit'});
   this.lastRequestAt=ts;
   let info=this.cache.get(event.mint),raw;
   if(info&&ts-info.ts<COPY_POLICY.reportTtlMs)raw=info.report;
   else{this.requestCount++;try{raw=await this.fetchReport(event.mint)}catch(e){return this.record({key,action:'SKIP',stage:'SOURCE',wallet:event.wallet,mint:event.mint,reason:'rugcheck_unavailable:'+String(e?.message||e).slice(0,60)})}this.cache.set(event.mint,{ts:this.clock(),report:raw});if(this.cache.size>80)this.cache.delete(this.cache.keys().next().value)}
   const q=quote(),safety=assessCopyToken(raw,{graduated:!!q?.graduated});
   if(safety.status!=='PASSED_FACT_CHECKS')return this.record({key,action:'SKIP',stage:'FACT',wallet:event.wallet,mint:event.mint,reason:safety.reasons.join(',')});
   const now=this.clock();
   if(!quoteOk(q,now))return this.record({key,action:'SKIP',stage:'PRICE',wallet:event.wallet,mint:event.mint,reason:'no_fresh_executable_price'});
   const positions=this.positions,exposure=positions.reduce((s,x)=>s+x.notional,0);
   const eq=this.cash+positions.reduce((s,x)=>s+x.units*x.lastPrice,0);
   if(positions.length>=COPY_POLICY.maxPositions||positions.some(x=>x.mint===event.mint)||exposure>=250||eq<this.peak*(1-COPY_POLICY.maxDailyDrawdown)||this.cash<120)
    return this.record({key,action:'SKIP',stage:'RISK',wallet:event.wallet,mint:event.mint,reason:'portfolio_guard'});
   const budget=Math.min(COPY_POLICY.standardTicket,.01*q.liq,this.cash/1.02);
   if(budget<100||slippage(budget,q.liq)>COPY_POLICY.maxImpact)return this.record({key,action:'SKIP',stage:'FILL',wallet:event.wallet,mint:event.mint,reason:'market_impact'});
   const entry=q.price*(1+slippage(budget,q.liq)),cost=budget*1.0125+.02;
   if(cost>this.cash)return this.record({key,action:'SKIP',stage:'FILL',wallet:event.wallet,mint:event.mint,reason:'cash_insufficient'});
   this.cash-=cost;this.positions.push({id:'copy:'+event.mint+':'+now,mint:event.mint,wallet:event.wallet,traderId:event.traderId,symbol:q.symbol||event.symbol,opened:now,entry,units:budget/entry,notional:budget,cost,lastPrice:q.price,lastMarkedAt:now});
   this.record({key,action:'PAPER_BUY',stage:'FILL',wallet:event.wallet,mint:event.mint,notional:budget,reason:'all_fact_gates_passed'});return true;
  }finally{this.pending.delete(key)}
 }
 mark(q,{verified=false,ts=this.clock(),sourceWallet=null}={}){
  if(!verified||!quoteOk({...q,verified},ts))return false;
  let changed=false;
  for(const p of [...this.positions]){if(p.mint!==q.mint)continue;p.lastPrice=q.price;p.lastMarkedAt=ts;
   const change=(q.price/p.entry-1)*100,mins=(ts-p.opened)/60000;
   const why=sourceWallet&&sourceWallet===p.wallet?'source_exit':change<=-15?'stop':change>=30?'take_profit':mins>=45?'time':null;
   if(!why)continue;const sell=q.price*(1-slippage(p.notional,q.liq)),proceeds=Math.max(0,p.units*sell*(1-.0125)-.02),pnl=proceeds-p.cost;
   this.cash+=proceeds;this.trades.unshift({...p,closedAt:ts,exit:sell,pnl,pnlPct:pnl/p.cost*100,why});this.trades.splice(150);
   this.positions.splice(this.positions.indexOf(p),1);this.peak=Math.max(this.peak,this.cash+this.positions.reduce((v,x)=>v+x.units*x.lastPrice,0));
   this.record({action:'PAPER_SELL',stage:'EXIT',wallet:p.wallet,mint:p.mint,reason:why,pnl});changed=true;
  }
  return changed;
 }
 snapshot(){return{paperOnly:true,version:this.version,cash:this.cash,peak:this.peak,equity:this.cash+this.positions.reduce((s,x)=>s+x.units*x.lastPrice,0),open:this.positions.length,completed:this.trades.length,trades:this.trades.slice(0,15),leaders:this.leaders.slice(0,12),decisions:this.decisions.slice(0,20),lastReviewedAt:this.lastReviewedAt,reportRequests:this.requestCount,lastCheckedAt:this.lastRequestAt}}
 serialize(){return{version:this.version,savedAt:this.savedAt,cash:this.cash,peak:this.peak,positions:this.positions.slice(0,3),trades:this.trades.slice(0,150),decisions:this.decisions.slice(0,100),leaders:this.leaders.slice(0,25),lastReviewedAt:this.lastReviewedAt,requestCount:this.requestCount}}
 restore(s){if(!s||s.version!==this.version||!good(s.savedAt)||s.savedAt<this.savedAt||!good(s.cash)||s.cash<0||!good(s.peak)||!Array.isArray(s.positions)||!Array.isArray(s.trades))return false;
  this.savedAt=s.savedAt;this.cash=s.cash;this.peak=s.peak;this.positions=s.positions.filter(p=>good(p.units)&&p.units>0&&good(p.entry)&&p.entry>0).slice(0,3);this.trades=s.trades.filter(x=>good(x.pnl)).slice(0,150);this.decisions=(s.decisions||[]).slice(0,100);this.leaders=(s.leaders||[]).slice(0,25);this.lastReviewedAt=s.lastReviewedAt||0;this.requestCount=s.requestCount||0;return true}
}
