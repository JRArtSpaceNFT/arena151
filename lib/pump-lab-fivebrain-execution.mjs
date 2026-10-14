// Explicit Five Brain policy experiment: PAPER ONLY. Does not override data, execution, or risk vetoes.
// Four score points or a conservative rank cannot substitute for verified quotes.
const KNOWN=new Set(['banker','momentum','dip','champion','smartmom']);
const PCT=Object.freeze({banker:36,momentum:38,dip:42,champion:38,smartmom:38});
const finite=x=>typeof x==='number'&&Number.isFinite(x);
export function calibrateFiveBrainEntry({strategyId,baseMin,p75,p90,closedTrades=0,funnel,flowFresh=false,quality=0,marketRisk=100}={}){
 if(!KNOWN.has(strategyId)||!finite(baseMin))return{enabled:false,min:baseMin,adjustment:0,reason:'not_core'};
 // Relative entry thresholds adapt to observed market quality without bypassing structural or liquidity checks.
 const percentile=finite(p75)?p75:finite(p90)?p90-3:baseMin;
 const evidenceReady=!!(funnel?.status==='CANDIDATE'||(funnel?.stage==='JUDGE'&&funnel?.reason==='low_signal'))
  &&flowFresh&&quality>=70&&marketRisk<=54;
 const bounded=Math.max(PCT[strategyId],Math.min(baseMin,percentile+(closedTrades>=30?5:2)));
 // For the momentum bot, use a slightly wider score window only when the observed
 // funnel and market evidence are verified. This never bypasses any independent
 // price integrity, liquidity, execution, or risk veto in the trading engine.
 const verifiedMomentum= strategyId==='momentum'&&evidenceReady&&quality>=78&&marketRisk<=48;
 const min=evidenceReady?Math.max(PCT[strategyId],bounded-(verifiedMomentum?7:3)):bounded;
 return{enabled:true,min,adjustment:Math.max(0,baseMin-min),reason:evidenceReady?'funnel_verified_rank':'percentile_calibration',funnelStage:funnel?.stage??'NONE'};
}
export function evaluateFiveBrainExit({strategyId,holdMinutes,pnlPct,peakPnlPct,acceleration,momentum,buyRatio,flowFresh,quoteVerified,estimatedNetProfitUsd=0}={}){
 if(!KNOWN.has(strategyId))return{exit:false,reason:'not_core'};
 if(!quoteVerified)return{exit:false,reason:'unverified_price_hold'};
 if(![holdMinutes,pnlPct,peakPnlPct,acceleration,momentum,buyRatio].every(finite))
  return{exit:false,reason:'missing_live_evidence'};
 const fade=flowFresh===true&&acceleration<44&&momentum<50&&buyRatio<.48;
 const hardFade=flowFresh===true&&acceleration<39&&momentum<45&&buyRatio<.43;
 const proofWindow=strategyId==='banker'?4.0:strategyId==='champion'?4.0:strategyId==='dip'?4.0:3.0;
 // Take a verified exit when a short-term thesis fails; never exit solely for missing data.
 if(holdMinutes>=proofWindow&&peakPnlPct<3&&pnlPct<=-2&&fade)
  return{exit:true,reason:'no_proof_flow_failed'};
 if(holdMinutes>=6&&peakPnlPct<5&&pnlPct<0&&hardFade)
  return{exit:true,reason:'six_minute_failed_thesis'};
 // A winning position may be exited on an actual retreat only if projected net profit remains positive.
 const minNet=strategyId==='champion'?4:2.5;
 if(peakPnlPct>=14&&peakPnlPct-pnlPct>=Math.max(5,peakPnlPct*.28)&&estimatedNetProfitUsd>=minNet)
  return{exit:true,reason:'verified_winner_trailing_protection'};
 return{exit:false,reason:'continue_with_original_risk_exits'};
}
