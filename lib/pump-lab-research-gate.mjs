// Research-only alpha rejection gate. Does not place trades or alter live strategies.
export const DEFAULT_RESEARCH_THRESHOLDS=Object.freeze({minTrades:100,minSharpe:1,minProfitFactor:1.3,maxDrawdown:.15,minDoubleCostSharpe:0,minOosSharpe:0});
const valid=(v)=>typeof v==='number'&&Number.isFinite(v);
export function assessCandidate(stats,thresholds=DEFAULT_RESEARCH_THRESHOLDS){
 const required=['trades','sharpe','profitFactor','maxDrawdown','doubleCostSharpe','oosSharpe'];
 const missing=required.filter(k=>!valid(stats?.[k]));
 if(missing.length)return {status:'INSUFFICIENT_DATA',failed:missing.map(k=>'missing_'+k),approved:false};
 const checks={
  minimumSample:stats.trades>=thresholds.minTrades,
  riskAdjustedReturn:stats.sharpe>thresholds.minSharpe,
  profitFactor:stats.profitFactor>thresholds.minProfitFactor,
  drawdown:stats.maxDrawdown<thresholds.maxDrawdown,
  costStress:stats.doubleCostSharpe>thresholds.minDoubleCostSharpe,
  unseenData:stats.oosSharpe>thresholds.minOosSharpe
 };
 const failed=Object.entries(checks).filter(([,pass])=>!pass).map(([name])=>name);
 return {status:failed.length?'REJECT':'RESEARCH_PASS',failed,checks,approved:false};
}
// Each split trains strictly before its next test interval. No look-ahead.
export function walkForwardWindows(length,{train=500,test=100}={}){
 if(!Number.isInteger(length)||!Number.isInteger(train)||!Number.isInteger(test)||length<0||train<=0||test<=0)throw new RangeError('invalid split parameters');
 const windows=[];for(let start=0;start+train+test<=length;start+=test)windows.push({trainStart:start,trainEnd:start+train,testStart:start+train,testEnd:start+train+test});
 return windows;
}
