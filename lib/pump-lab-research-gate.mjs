// Deterministic research gate: calculations use already-closed paper trades only.
// No order-signing, strategy mutation, or automatic real-money approval lives here.
export const DEFAULT_RESEARCH_THRESHOLDS=Object.freeze({
 minTrades:100,minSharpe:1,minProfitFactor:1.3,maxDrawdown:.15,minDoubleCostSharpe:0,minOosSharpe:0
});
const valid=v=>typeof v==='number'&&Number.isFinite(v);
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
export function walkForwardWindows(length,{train=60,test=20}={}){
 if(!Number.isInteger(length)||!Number.isInteger(train)||!Number.isInteger(test)||length<0||train<=0||test<=0)throw new RangeError('invalid split parameters');
 const windows=[];for(let start=0;start+train+test<=length;start+=test)windows.push({trainStart:start,trainEnd:start+train,testStart:start+train,testEnd:start+train+test});
 return windows;
}
function roundTripCost(t){
 const en=t.entryExecution,ex=t.exitExecution;
 if(!en||!ex||!valid(en.feeRate)||!valid(ex.feeRate)||!valid(en.slippage)||!valid(ex.slippage))return null;
 const invested=Number(t.invested),exitValue=Number(t.units)*Number(t.exit);
 if(!valid(invested)||invested<=0||!valid(exitValue)||exitValue<0)return null;
 const values=[en.feeRate,ex.feeRate,en.slippage,ex.slippage];
 if(values.some(v=>v<0||v>.5))return null;
 const fixed=[en.fixedCost,ex.fixedCost,en.expectedFailureCost,ex.expectedFailureCost].map(v=>v===undefined?0:Number(v));
 if(fixed.some(v=>!valid(v)||v<0))return null;
 // Fees and slippage are ALREADY in net P&L. Subtract one additional round trip for 2x cost stress.
 return invested*(en.feeRate+en.slippage)+exitValue*(ex.feeRate+ex.slippage)+fixed.reduce((a,b)=>a+b,0);
}
function dailyReturns(rows,base=1000){
 const days=new Map();for(const t of rows){const day=Math.floor(t.closedAt/86400000);days.set(day,(days.get(day)||0)+t.pnl)}
 if(!days.size)return [];
 const keys=[...days.keys()].sort((a,b)=>a-b),series=[],last=Math.min(keys.at(-1),keys[0]+365);
 let capital=base;for(let d=keys[0];d<=last;d++){const amount=days.get(d)||0;const ret=capital>0?amount/capital:-1;series.push(ret);capital+=amount;if(capital<=0){series[series.length-1]=-1;break}}
 return series;
}
function annualSharpe(returns){
 if(returns.length<14)return null;
 const m=returns.reduce((a,b)=>a+b,0)/returns.length;
 const variance=returns.reduce((a,b)=>a+(b-m)**2,0)/(returns.length-1);
 return variance>0?m/Math.sqrt(variance)*Math.sqrt(365):null;
}
function drawdown(rows,base=1000){
 let equity=base,peak=base,worst=0;
 for(const t of rows){equity+=t.pnl;peak=Math.max(peak,equity);worst=Math.max(worst,peak>0?(peak-equity)/peak:1)}
 return Math.min(1,worst);
}
function metrics(rows){
 const winners=rows.filter(x=>x.pnl>0).reduce((s,x)=>s+x.pnl,0);
 const losers=-rows.filter(x=>x.pnl<0).reduce((s,x)=>s+x.pnl,0);
 const stressed=rows.map(t=>({...t,pnl:t.pnl-t.extraCost}));
 const normalDays=dailyReturns(rows),stressDays=dailyReturns(stressed);
 return {trades:rows.length,days:normalDays.length,sharpe:annualSharpe(normalDays),
  doubleCostSharpe:annualSharpe(stressDays),profitFactor:losers>0?winners/losers:null,
  maxDrawdown:drawdown(rows),netPnl:rows.reduce((s,t)=>s+t.pnl,0),
  stressNetPnl:stressed.reduce((s,t)=>s+t.pnl,0)};
}
export function evaluateTradeHistory(input,{minTrain=60,testSize=20}={}){
 const original=Array.isArray(input)?input:[];
 const trades=original.filter(t=>valid(t?.closedAt)&&valid(t?.pnl)&&t.closedAt>0)
  .slice().sort((a,b)=>a.closedAt-b.closedAt||String(a.id||'').localeCompare(String(b.id||'')));
 const missingExecution=trades.filter(t=>roundTripCost(t)===null).length;
 const rows=trades.map(t=>({id:t.id,closedAt:t.closedAt,pnl:t.pnl,extraCost:roundTripCost(t)}));
 const windows=walkForwardWindows(rows.length,{train:minTrain,test:testSize});
 const nOos=Math.max(testSize,Math.floor(rows.length*.2));
 const oos=rows.length>=minTrain+nOos?rows.slice(-nOos):[];
 const result={sample:trades.length,missingExecution,windows:windows.length,
  methodology:'realized paper ledger; chronological fixed-policy forward windows; 365-day annualization; no parameter optimization; simulated double friction',
  metrics:null,holdout:null,forward:[],status:'INSUFFICIENT_DATA'};
 if(!rows.length||missingExecution)return {...result,gate:assessCandidate({trades:rows.length})};
 result.metrics=metrics(rows);
 result.holdout=oos.length?metrics(oos):null;
 result.forward=windows.map(w=>({train:{start:w.trainStart,end:w.trainEnd},test:{start:w.testStart,end:w.testEnd},
  result:metrics(rows.slice(w.testStart,w.testEnd))}));
 // A candidate must survive distinct chronological future windows, not only a random token holdout.
 const forwardSharpe=result.forward.map(f=>f.result.sharpe);
 const validForward=result.forward.length>=2&&forwardSharpe.every(valid);
 const oosSharpe=validForward&&valid(result.holdout?.sharpe)&&result.holdout.days>=14
  ?Math.min(result.holdout.sharpe,...forwardSharpe):null;
 result.gate=assessCandidate({
  trades:rows.length,sharpe:result.metrics.sharpe,profitFactor:result.metrics.profitFactor,
  maxDrawdown:result.metrics.maxDrawdown,doubleCostSharpe:result.metrics.doubleCostSharpe,oosSharpe
 });
 result.status=result.gate.status;
 return result;
}
