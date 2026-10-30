// V2 pre-registered experimental signal rules. Research-only; no fills.
export const V2_RULE_VERSION='2.0.0';
const num=n=>Number.isFinite(n);
const base=f=>{
 const reasons=[];
 if(!f||!f.mint)reasons.push('MISSING_MINT');
 if(!num(f.quoteAgeSec)||f.quoteAgeSec>=5)reasons.push('STALE_QUOTE');
 if(!num(f.liquidityUsd)||f.liquidityUsd<=0)reasons.push('MISSING_LIQUIDITY');
 if(!num(f.top10Pct)||f.top10Pct>=35)reasons.push('TOP10_HOLDERS');
 if(!num(f.bundleSupplyPct)||f.bundleSupplyPct>20)reasons.push('BUNDLE_VETO');
 if(!num(f.funderClusterPct)||f.funderClusterPct>25)reasons.push('FUNDER_VETO');
 if(!num(f.proximityToGraduationSol)||f.proximityToGraduationSol<15)reasons.push('GRADUATION_PROXIMITY');
 return reasons;
};
const inRange=(v,a,b)=>num(v)&&v>=a&&v<=b;
export function evaluateV2(name,f){
 const errors=base(f),reasons=[...errors];
 if(name==='Fortress'){
  if(!f.graduated||!inRange(f.minutesSinceGraduation,10,120))reasons.push('GRADUATION_AGE');
  if(!inRange(f.marketCapUsd,100000,1000000))reasons.push('MARKET_CAP');
  if(!(f.liquidityUsd>=25000))reasons.push('LIQUIDITY');
  if(!inRange(f.buyerRatio5m,.52,.70))reasons.push('BUYER_RATIO');
  if(!f.uniqueBuyersRising)reasons.push('UNIQUE_BUYERS');
  if(!inRange(f.return5m,0,.4))reasons.push('RETURN_5M');
 }else if(name==='Second Chance'){
  if(!(f.marketCapUsd>=75000&&f.ageMinutes>=3))reasons.push('CAP_AGE');
  if(!inRange(f.pullbackFrom15mHigh,.10,.35))reasons.push('PULLBACK');
  if(!(f.reboundFromLow>=.03))reasons.push('REBOUND');
  if(!inRange(f.buyerRatio60s,.50,.70))reasons.push('BUYER_RATIO');
  if(!(f.liquidityChangePct>=-.15))reasons.push('LIQUIDITY_CHANGE');
 }else if(name==='Velocity'){
  if(!inRange(f.ageSeconds,15,600)||!inRange(f.marketCapUsd,20000,350000))reasons.push('CAP_AGE');
  if(!inRange(f.return20s,.02,.32)||!inRange(f.buyerRatio20s,.56,.84))reasons.push('MOMENTUM');
  if(!(f.liquidityUsd>=7000))reasons.push('LIQUIDITY');
 }else if(name==='Vetted Sampler'){
  if(!(f.marketCapUsd>=50000))reasons.push('MARKET_CAP');
 }else if(name==='Meta-Gate')return{eligible:false,reasons:['REQUIRES_TRAINED_HOLDOUT_VALIDATED_MODEL'],version:V2_RULE_VERSION};
 else return{eligible:false,reasons:['UNKNOWN_STRATEGY'],version:V2_RULE_VERSION};
 return{eligible:reasons.length===0,reasons,version:V2_RULE_VERSION};
}
