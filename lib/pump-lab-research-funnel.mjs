// Article-inspired deterministic token-selection funnel. PAPER RESEARCH ONLY.
// No Jev key, no external calls, no order execution, and no fabricated probabilities.
export const FUNNEL_POLICY=Object.freeze({
 minAgeMin:.5,maxAgeMin:240,minLiqUsd:10000,maxMarketCap:1000000,minMarketCap:10000,
 minTrades:5,minBuyFraction:.52,minScore:63,maxRisk:70,minQuality:58,
 maxFreshAgeMs:90000,observeGapMs:20000,candidateTtlMs:300000,chooseGapMs:300000,
 maxCandidates:80,maxRejections:80
});
const finite=x=>typeof x==='number'&&Number.isFinite(x);
const clamp=(x,lo=0,hi=100)=>Math.max(lo,Math.min(hi,x));
const COOLDOWN=Object.freeze({
 stale_quote:25000,missing_price:40000,missing_metrics:60000,too_young:20000,
 too_old:3600000,too_small:90000,too_large:900000,thin_liquidity:90000,
 flow_unobserved:40000,insufficient_trades:40000,no_sellers:180000,
 sell_dominance:45000,weak_quality:60000,high_risk:120000,
 price_path_unverified:40000,source_disagreement:40000,low_signal:35000
});
const materialize=(t,f,q,opts)=>({
 mint:t?.mint,symbol:String(t?.symbol||'').slice(0,20),mc:t?.mc,liq:t?.liq,price:t?.price,
 ageMin:f?.age,tx:f?.totalTx,buysPct:f?.buyRatio,flowFresh:f?.flowFresh,
 risk:f?.risk,score:f?.score,quality:q?.score,
 quoteFresh:opts?.quoteFresh===true,continuousPath:opts?.continuousPath===true,
 crossSource:finite(q?.sourceCount)&&q.sourceCount>=2,
 sourceDisagreement:opts?.sourceDisagreement===true,
 authoritiesKnown:opts?.authoritiesKnown===true,
 authorityOpen:opts?.authorityOpen===true,
 observedSocial:opts?.socialVerified===true,
 auditedAt:opts?.ts
});
export function assessFunnel(row,policy=FUNNEL_POLICY){
 if(!row?.mint)return {status:'SKIP',stage:'FREE',reason:'missing_metrics'};
 const fields=['mc','liq','ageMin','tx','buysPct','risk','score','quality'];
 if(!finite(row.price)||row.price<=0)return {status:'SKIP',stage:'FREE',reason:'missing_price'};
 if(!row.quoteFresh)return {status:'SKIP',stage:'FREE',reason:'stale_quote'};
 if(fields.some(k=>!finite(row[k])))return {status:'SKIP',stage:'FREE',reason:'missing_metrics'};
 if(row.ageMin<policy.minAgeMin)return {status:'SKIP',stage:'FREE',reason:'too_young'};
 if(row.ageMin>policy.maxAgeMin)return {status:'SKIP',stage:'FREE',reason:'too_old'};
 if(row.mc<policy.minMarketCap)return {status:'SKIP',stage:'FREE',reason:'too_small'};
 if(row.mc>policy.maxMarketCap)return {status:'SKIP',stage:'FREE',reason:'too_large'};
 if(row.liq<policy.minLiqUsd)return {status:'SKIP',stage:'FREE',reason:'thin_liquidity'};
 if(!row.flowFresh)return {status:'SKIP',stage:'TRADE',reason:'flow_unobserved'};
 if(row.tx<policy.minTrades)return {status:'SKIP',stage:'TRADE',reason:'insufficient_trades'};
 if(row.buysPct>=.98&&row.tx>=20)return {status:'SKIP',stage:'TRADE',reason:'no_sellers'};
 if(row.buysPct<policy.minBuyFraction)return {status:'SKIP',stage:'TRADE',reason:'sell_dominance'};
 if(row.authorityOpen)return {status:'SKIP',stage:'FACT',reason:'authority_open'};
 if(row.sourceDisagreement)return {status:'SKIP',stage:'FACT',reason:'source_disagreement'};
 if(!row.continuousPath||!row.crossSource)return {status:'SKIP',stage:'FACT',reason:'price_path_unverified'};
 if(row.quality<policy.minQuality)return {status:'SKIP',stage:'FACT',reason:'weak_quality'};
 if(row.risk>policy.maxRisk)return {status:'SKIP',stage:'FACT',reason:'high_risk'};
 // Social metadata is not authenticated ownership evidence; no bonus for an unverified handle.
 const ranking=clamp(row.score*.58+row.quality*.24+(100-row.risk)*.18);
 if(ranking<policy.minScore)return {status:'SKIP',stage:'JUDGE',reason:'low_signal',ranking};
 return {status:'CANDIDATE',stage:'PICK',reason:null,ranking,source:'deterministic_heuristic_not_calibrated_probability',facts:{authoritiesKnown:row.authoritiesKnown,verifiedSocial:row.observedSocial}};
}
export class ResearchFunnel{
 constructor({clock=Date.now,policy=FUNNEL_POLICY}={}){this.clock=clock;this.policy=policy;this.version=1;this.seen=new Map();this.bench=new Map();this.candidates=new Map();this.counters={observed:0,benchSkips:0,stages:{FREE:0,TRADE:0,FACT:0,JUDGE:0,PICK:0},reasons:{}};this.picks=[];this.lastPickAt=0;this.savedAt=0;}
 observe(t,f,q,opts={}){
  const ts=finite(opts.ts)?opts.ts:this.clock(),mint=t?.mint;if(!mint)return false;
  if(ts-(this.seen.get(mint)||0)<this.policy.observeGapMs)return false;
  this.seen.set(mint,ts);if(this.seen.size>500){for(const [id,at] of this.seen)if(at<ts-3600000)this.seen.delete(id);if(this.seen.size>500)this.seen.delete(this.seen.keys().next().value)}
  const previous=this.bench.get(mint);if(previous&&previous.until>ts){this.counters.benchSkips++;return false}
  const row=materialize(t,f,q,{...opts,ts}),decision=assessFunnel(row,this.policy);
  this.counters.observed++;this.counters.stages[decision.stage]=(this.counters.stages[decision.stage]||0)+1;
  if(decision.status==='CANDIDATE'){this.candidates.set(mint,{...row,...decision,ts});this.bench.delete(mint)}
  else{
   this.candidates.delete(mint);this.counters.reasons[decision.reason]=(this.counters.reasons[decision.reason]||0)+1;
   this.bench.set(mint,{reason:decision.reason,stage:decision.stage,until:ts+(COOLDOWN[decision.reason]||60000)});
  }
  for(const [id,c] of this.candidates)if(ts-c.ts>this.policy.candidateTtlMs)this.candidates.delete(id);
  if(this.candidates.size>this.policy.maxCandidates)this.candidates.delete(this.candidates.keys().next().value);
  if(this.bench.size>this.policy.maxRejections)for(const [id,x] of this.bench){if(x.until<=ts)this.bench.delete(id);if(this.bench.size<=this.policy.maxRejections)break;}
  this.savedAt=ts;return true;
 }
 choose(ts=this.clock()){
  const survivors=[...this.candidates.values()].filter(x=>ts-x.ts<=this.policy.candidateTtlMs&&!this.bench.has(x.mint))
    .sort((a,b)=>b.ranking-a.ranking||b.quality-a.quality||a.mint.localeCompare(b.mint)).slice(0,10);
  const best=survivors[0],winner=best&&best.ranking>=this.policy.minScore?best:null;
  const result={at:ts,action:winner?'SHADOW_PICK':'NO_TRADE',why:winner?'highest_validated_heuristic_score':'no_eligible_candidate',
   mint:winner?.mint||null,symbol:winner?.symbol||null,ranking:winner?.ranking??null,
   candidates:survivors.length,model:'deterministic_v1',notRealOrder:true,notCalibratedProbability:true,
   alternatives:survivors.slice(0,5).map(x=>({mint:x.mint,symbol:x.symbol,ranking:x.ranking}))};
  this.picks.unshift(result);this.picks.splice(0,70);this.lastPickAt=ts;this.savedAt=ts;return result;
 }
 snapshot(ts=this.clock()){
  const rejections=Object.entries(this.counters.reasons).sort((a,b)=>b[1]-a[1]).slice(0,10).map(([reason,count])=>({reason,count}));
  return{paperOnly:true,version:this.version,mode:'observe_and_choose_only',lastPickAt:this.lastPickAt,observed:this.counters.observed,benchSkips:this.counters.benchSkips,
   stages:this.counters.stages,rejections,activeBench:[...this.bench.values()].filter(x=>x.until>ts).length,
   eligible:[...this.candidates.values()].filter(x=>ts-x.ts<=this.policy.candidateTtlMs).length,
   picks:this.picks.slice(0,8)};
 }
 serialize(){return{version:this.version,savedAt:this.savedAt,lastPickAt:this.lastPickAt,counters:this.counters,
  seen:[...this.seen].slice(-500),bench:[...this.bench].slice(-100),candidates:[...this.candidates].slice(-80),picks:this.picks.slice(0,70)}}
 restore(s){if(!s||s.version!==this.version||!finite(s.savedAt)||s.savedAt<this.savedAt||!s.counters||!Array.isArray(s.bench)||!Array.isArray(s.candidates))return false;
  this.savedAt=s.savedAt;this.lastPickAt=Number(s.lastPickAt)||0;
  this.counters={observed:Number(s.counters.observed)||0,benchSkips:Number(s.counters.benchSkips)||0,
   stages:{...this.counters.stages,...s.counters.stages},reasons:{...s.counters.reasons}};
  this.seen=new Map((s.seen||[]).filter(x=>Array.isArray(x)&&typeof x[0]==='string'&&finite(x[1])).slice(-500));
  this.bench=new Map(s.bench.filter(x=>Array.isArray(x)&&typeof x[0]==='string'&&finite(x[1]?.until)).slice(-100));
  this.candidates=new Map(s.candidates.filter(x=>Array.isArray(x)&&typeof x[0]==='string'&&finite(x[1]?.ranking)).slice(-80));
  this.picks=Array.isArray(s.picks)?s.picks.slice(0,70):[];return true;
 }
}
