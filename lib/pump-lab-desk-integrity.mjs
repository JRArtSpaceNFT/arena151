// Pure read-only desk observability. No orders, no subscription, no wallet signing.
// Author's venue assumptions are HYPOTHETICAL and intentionally do not alter Pump Lab
// Pump.fun/PumpSwap execution fee models.
const FINITE=v=>typeof v==='number'&&Number.isFinite(v);
export const FOMO_RESEARCH_ASSUMPTIONS=Object.freeze({feeRate:.0045,minimumFeeUsd:.95});
export function hypotheticalFomoEconomics(entryUsd,assumptions=FOMO_RESEARCH_ASSUMPTIONS){
 if(!FINITE(entryUsd)||entryUsd<=0)return null;
 const {feeRate,minimumFeeUsd}=assumptions;
 if(!FINITE(feeRate)||feeRate<0||feeRate>=1||!FINITE(minimumFeeUsd)||minimumFeeUsd<0)return null;
 const fee=amount=>Math.max(amount*feeRate,minimumFeeUsd);
 const inFee=fee(entryUsd),flatOutFee=fee(entryUsd);
 const requiredProceeds=entryUsd+inFee;
 // Solve exit proceeds net of exit fee exactly; FOMO minimum may bind either side.
 const sold=Math.max(requiredProceeds+minimumFeeUsd,requiredProceeds/(1-feeRate));
 const trueExitFee=fee(sold);
 return{entryUsd,buyFee:inFee,flatExitFee:flatOutFee,flatRoundTripFee:inFee+flatOutFee,
  flatFeePct:(inFee+flatOutFee)/entryUsd*100,breakEvenExitNotional:sold,
  breakEvenMovePct:(sold/entryUsd-1)*100,model:'HYPOTHETICAL_FOMO_ONLY',
  excludes:'slippage, network fees, adverse selection, failed orders, price impact'};
}
function recentDecisionSummary(decisions,id,now,windowMs){
 const relevant=(Array.isArray(decisions)?decisions:[]).filter(d=>d?.strategy===id&&FINITE(d.ts)&&d.ts<=now&&now-d.ts<=windowMs);
 const buys=relevant.filter(d=>d.action==='BUY'),rejects=relevant.filter(d=>d.action==='REJECT');
 const reasons=new Map();for(const d of rejects){const reason=String(d.why||'unspecified').slice(0,110);reasons.set(reason,(reasons.get(reason)||0)+1);}
 return{checked:relevant.length,buys:buys.length,rejections:rejects.length,
  topReasons:[...reasons].sort((a,b)=>b[1]-a[1]).slice(0,3).map(([reason,count])=>({reason,count})),
  latestDecisionAt:relevant.reduce((a,d)=>Math.max(a,d.ts),0)||null};
}
export function buildDeskIntegrityReport({at=Date.now(),bots=[],decisions=[],runtime={},providers=[],evidenceGrades=[],tradeCount=0}={}){
 const horizonMs=6*3600*1000,rs=Array.isArray(providers)?providers:[],
  marketFeeds=rs.filter(p=>['pump.fun','dexscreener'].includes(p.component)),
  liveMarketFeeds=marketFeeds.filter(p=>p.status==='ok'&&FINITE(p.ts)&&p.ts<=at&&at-p.ts<3*60000),
  sourceReady=liveMarketFeeds.length>0,storageReady=runtime?.durable===true&&runtime?.dbConnected===true,
  engineReady=runtime?.ready===true&&sourceReady&&storageReady,
  auditBots=(Array.isArray(bots)?bots:[]).filter(b=>b&&b.id&&b.fiveBrain===true).map(bot=>{
   const activity=recentDecisionSummary(decisions,bot.id,at,horizonMs);
   const prior=evidenceGrades.find(g=>g.id===bot.id)||{};
   const sample=FINITE(prior.sample)?prior.sample:FINITE(bot.n)?bot.n:0;
   const forwardWindows=FINITE(prior.forwardWindows)?prior.forwardWindows:0;
   // Existing independent holdout gate remains sole authority; this is just a truthful label.
   let verdict='INSUFFICIENT_EVIDENCE',reason='no independently proven, after-cost holdout edge';
   if(sample>=60&&forwardWindows>=2&&prior.status==='PASS'&&prior.failed?.length===0&&
      FINITE(prior.stressedNetPnl)&&prior.stressedNetPnl>0&&FINITE(prior.oosSharpe)&&prior.oosSharpe>0){
    verdict='VALIDATION_CANDIDATE';reason='existing evidence gate passed; independent audit still required';
   }else if(sample>=60&&forwardWindows>=2&&FINITE(prior.stressedNetPnl)&&prior.stressedNetPnl<=0){
    verdict='NO_EDGE_SHOWN';reason='sufficient samples but 2x execution friction erases modeled P&L';
   }
   return{id:bot.id,name:bot.name,tradeCount:FINITE(bot.n)?bot.n:0,verdict,reason,evidenceSample:sample,forwardWindows,...activity};
  });
 return{paperOnly:true,readOnly:true,at,monitorWindowHours:6,
   health:engineReady?'READY_OBSERVED':runtime?.phase==='RESTORING'?'RESTORING':'DEGRADED_OR_UNVERIFIED',
   checks:{processReady:runtime?.ready===true,canonicalStorage:storageReady,marketFeedFresh:sourceReady},
   marketFeeds:liveMarketFeeds.map(x=>({source:x.component,observedAt:x.ts})),
   macroDial:{status:'NOT_COMPUTED',value:null,appliedToTrading:false,
    reason:'No verified point-in-time FRED/BTC/SOL research series is connected; article dial is not evidence of edge'},
   modeledTradingVenue:'PUMP_FUN_OR_PUMPSWAP_NOT_FOMO',
   fomoComparison:[100,250].map(x=>hypotheticalFomoEconomics(x)),
   ledgerClosedTrades:tradeCount,auditBots};
}
