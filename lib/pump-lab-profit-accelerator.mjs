const clamp=(v,lo=0,hi=1)=>Math.max(lo,Math.min(hi,Number.isFinite(Number(v))?Number(v):0));
const num=v=>Number.isFinite(Number(v))?Number(v):0;
const avg=a=>a.length?a.reduce((s,x)=>s+num(x),0)/a.length:0;
const quantile=(xs,q)=>{
  const a=xs.map(num).filter(Number.isFinite).sort((x,y)=>x-y);
  if(!a.length)return 0;
  const i=(a.length-1)*q,lo=Math.floor(i),hi=Math.ceil(i);
  return lo===hi?a[lo]:a[lo]+(a[hi]-a[lo])*(i-lo);
};
function summarize(rows){
  const a=(rows||[]).filter(x=>Number.isFinite(num(x?.pnlPct)));
  const wins=a.filter(x=>num(x.pnlPct)>0),losses=a.filter(x=>num(x.pnlPct)<0);
  const avgWin=avg(wins.map(x=>x.pnlPct)),avgLoss=Math.abs(avg(losses.map(x=>x.pnlPct)));
  const winRate=a.length?wins.length/a.length:0;
  const expectancy=winRate*avgWin-(1-winRate)*avgLoss;
  const grossWin=wins.reduce((s,x)=>s+Math.max(0,num(x.pnlPct)),0);
  const grossLoss=Math.abs(losses.reduce((s,x)=>s+Math.min(0,num(x.pnlPct)),0));
  const profitFactor=grossLoss?grossWin/grossLoss:grossWin>0?9.99:0;
  return{n:a.length,wins:wins.length,losses:losses.length,winRate:winRate*100,avgWin,avgLoss,expectancy,profitFactor};
}
function scopedTrades(trades,strategyId,era,regime=null){
  return(trades||[]).filter(t=>t?.strategy===strategyId&&(!era||t?.policyVersion===era)&&(!regime||(t?.entryRegime||'UNKNOWN')===regime));
}
export class PumpLabProfitAccelerator{
  constructor(){this.socialCache=new Map();this.championCache={key:'',ts:0,rows:[]};}
  strategyGate({strategy,trades,regime,era}){
    if(!strategy)return{ok:true,sizeMultiplier:1,status:'UNKNOWN',reason:'strategy missing'};
    if(strategy.risk==='CONTROL'||strategy.risk==='R&D'||strategy.specialist||strategy.type==='challenger')return{ok:true,sizeMultiplier:1,status:'RESEARCH',reason:'research/control shadow population'};
    const rows=scopedTrades(trades,strategy.id,era).slice(0,50),all=summarize(rows),recent=summarize(rows.slice(0,10));
    const reg=summarize(scopedTrades(trades,strategy.id,era,regime).slice(0,30));
    const hardFail=all.n>=12&&all.expectancy<=-5&&all.profitFactor<.78;
    const recentFail=recent.n>=8&&recent.expectancy<=-7&&recent.profitFactor<.65;
    const regimeFail=reg.n>=8&&reg.expectancy<=-5&&reg.profitFactor<.80;
    if(hardFail||recentFail)return{ok:false,sizeMultiplier:0,status:'PAUSED',reason:hardFail?'profit accelerator: persistently negative expectancy':'profit accelerator: recent expectancy collapse',all,recent,regime:reg};
    if(regimeFail)return{ok:false,sizeMultiplier:0,status:'REGIME PAUSED',reason:`profit accelerator: ${regime} regime has negative expectancy`,all,recent,regime:reg};
    let sizeMultiplier=1,status='ACTIVE';
    if(all.n>=6&&all.expectancy<0){sizeMultiplier=.62;status='THROTTLED';}
    else if(all.n>=6&&all.profitFactor<1){sizeMultiplier=.78;status='WATCH';}
    else if(all.n>=20&&all.expectancy>5&&all.profitFactor>1.40){sizeMultiplier=1.35;status='HIGH CONVICTION';}
    else if(all.n>=12&&all.expectancy>3&&all.profitFactor>1.25){sizeMultiplier=1.25;status='PROVEN POSITIVE';}
    else if(all.n>=6&&all.expectancy>0&&all.profitFactor>1.10){sizeMultiplier=1.12;status='EARLY POSITIVE';}
    return{ok:true,sizeMultiplier,status,reason:'profit accelerator evidence gate passed',all,recent,regime:reg};
  }
  championTable({strategies,trades,regime,era}){
    const key=[era,regime,(trades||[]).length,(strategies||[]).length].join(':');
    if(this.championCache.key===key&&Date.now()-this.championCache.ts<10000)return this.championCache.rows;
    const rows=(strategies||[]).filter(d=>d&&d.risk!=='CONTROL'&&!d.specialist).map(d=>{
      const all=summarize(scopedTrades(trades,d.id,era).slice(0,60)),reg=summarize(scopedTrades(trades,d.id,era,regime).slice(0,30));
      const sample=all.n/(all.n+18),pf=Math.min(2.5,all.profitFactor||0),regSample=reg.n/(reg.n+10);
      const score=all.expectancy*sample+reg.expectancy*regSample*.55+(pf-1)*5-Math.max(0,num(d.dd)-12)*.20;
      return{id:d.id,name:d.name,n:all.n,expectancy:all.expectancy,profitFactor:all.profitFactor,regimeN:reg.n,regimeExpectancy:reg.expectancy,score};
    }).sort((a,b)=>b.score-a.score);
    this.championCache={key,ts:Date.now(),rows};return rows;
  }
  championMultiplier(args){
    const rows=this.championTable(args),row=rows.find(x=>x.id===args.strategyId);
    if(!row||row.n<6)return 1;
    const rank=rows.indexOf(row);
    if(rank===0&&row.expectancy>3&&row.profitFactor>1.25)return 1.25;
    if(rank===0&&row.expectancy>0)return 1.18;
    if(rank<=2&&row.expectancy>0)return 1.12;
    if(rank>=Math.max(5,Math.floor(rows.length*.65))&&row.expectancy<0)return .62;
    return .94;
  }
  socialEvidence({trades,strategyId,era}){
    const rows=scopedTrades(trades,strategyId,era).filter(t=>Number.isFinite(num(t?.entryFeatures?.social))&&Number.isFinite(num(t?.pnlPct))).slice(0,100);
    const key=`${strategyId}:${era}:${rows.length}`;if(this.socialCache.has(key))return this.socialCache.get(key);
    if(rows.length<16){const out={n:rows.length,multiplier:.20,uplift:0,status:'UNPROVEN'};this.socialCache.set(key,out);return out;}
    const sorted=[...rows].sort((a,b)=>num(a.entryFeatures.social)-num(b.entryFeatures.social)),cut=Math.max(4,Math.floor(sorted.length*.35));
    const low=sorted.slice(0,cut),high=sorted.slice(-cut),uplift=avg(high.map(x=>x.pnlPct))-avg(low.map(x=>x.pnlPct));
    const multiplier=uplift<=0?.08:uplift<2?.30:uplift<5?.65:1;
    const out={n:rows.length,multiplier,uplift,status:uplift>2?'PREDICTIVE':uplift>0?'WEAK':'NOISE'};
    this.socialCache.clear();this.socialCache.set(key,out);return out;
  }
  adjustedSocial(raw,args){
    const e=this.socialEvidence(args),neutral=50;
    return{value:neutral+(num(raw)-neutral)*e.multiplier,evidence:e};
  }
  executionQuality(quote={},alphaExecution={}){
    const slippage=Math.max(0,num(quote.slippage)),impact=Math.max(0,num(quote.impact)),volSlip=Math.max(0,num(quote.volatilitySlip));
    const failure=clamp(num(quote.txFailureProbability??quote.failureProbability),0,1),landing=num(alphaExecution?.landingScore||quote?.landingScore||70);
    let score=100-slippage*700-impact*450-volSlip*350-failure*55;
    if(landing<60)score-=(60-landing)*.45;
    score=clamp(score,0,100);
    const veto=slippage>.065||failure>.35||score<38;
    const sizeMultiplier=veto?0:clamp(.55+(score/100)*.50,.55,1.03);
    return{score,veto,sizeMultiplier,slippagePct:slippage*100,impactPct:impact*100,failureProbability:failure,landingScore:landing,reason:veto?'execution quality below floor':score<60?'execution quality weak':'execution quality acceptable'};
  }
  correlationGuard({strategyId,token,positions,correlations,tokens}){
    const peers=new Map();
    for(const r of correlations||[]){
      if(r.a===strategyId)peers.set(r.b,num(r.jaccard));
      else if(r.b===strategyId)peers.set(r.a,num(r.jaccard));
    }
    const live=(positions||[]).filter(p=>!p.closed&&p.strategy!==strategyId);
    const sameMint=live.filter(p=>p.mint===token?.mint);
    const hardPeer=sameMint.find(p=>(peers.get(p.strategy)||0)>=70);
    if(hardPeer)return{ok:false,sizeMultiplier:0,reason:'correlation guard: highly similar strategy already owns this token',peer:hardPeer.strategy};
    if(sameMint.length>=3)return{ok:false,sizeMultiplier:0,reason:'correlation guard: token already crowded across bots'};
    const narrative=token?.narrative||'';
    const correlatedNarrative=live.filter(p=>{
      const c=peers.get(p.strategy)||0;if(c<60)return false;
      const pt=tokens?.get?tokens.get(p.mint):null;return narrative&&pt?.narrative===narrative;
    });
    if(correlatedNarrative.length>=2)return{ok:true,sizeMultiplier:.55,reason:'correlation guard: crowded correlated narrative'};
    if(sameMint.length)return{ok:true,sizeMultiplier:.72,reason:'correlation guard: duplicate token exposure reduced'};
    return{ok:true,sizeMultiplier:1,reason:'correlation exposure clear'};
  }
  exitLearning({strategyId,trades,era}){
    const rows=scopedTrades(trades,strategyId,era).slice(0,80),wins=rows.filter(x=>num(x.pnlPct)>0&&Number.isFinite(num(x.mfe))&&Number.isFinite(num(x.mae)));
    if(rows.length<12||wins.length<4)return{n:rows.length,confidence:0,stopCap:null,takeFloor:null,trailFrac:null};
    const winnerMaeAbs=wins.map(x=>Math.abs(Math.min(0,num(x.mae)))),winnerMfe=wins.map(x=>Math.max(0,num(x.mfe)));
    const stopCap=clamp(quantile(winnerMaeAbs,.75)+3,8,18),takeFloor=clamp(quantile(winnerMfe,.50)*.55,18,90);
    const trailFrac=clamp(.30+Math.max(0,quantile(winnerMfe,.75)-40)/300,.30,.46),confidence=clamp(rows.length/40,0,1);
    return{n:rows.length,wins:wins.length,confidence,stopCap,takeFloor,trailFrac,winnerMaeP75:quantile(winnerMaeAbs,.75),winnerMfeMedian:quantile(winnerMfe,.50)};
  }
  classifyTrade(position={}){
    const pnl=num(position.pnlPct),mfe=num(position.mfe),mae=num(position.mae),roundTrip=num(position.modeledRoundTripPct||0);
    let category='CLEAN';
    if(pnl<0&&mfe>=20)category='EXIT MANAGEMENT';
    else if(pnl<0&&mae<=-20)category='ENTRY / RISK FAILURE';
    else if(pnl>0&&mfe>Math.max(35,pnl*2.5))category='UNDER CAPTURED WINNER';
    else if(pnl<0&&roundTrip>=8)category='EXECUTION FRICTION';
    return{category,pnlPct:pnl,mfe,mae,roundTripPct:roundTrip};
  }
  snapshot({strategies,trades,regime,era,correlations,noTrade}){
    const champions=this.championTable({strategies,trades,regime,era}).slice(0,5);
    const gates=(strategies||[]).filter(d=>d.risk!=='CONTROL'&&!d.specialist).map(d=>({id:d.id,name:d.name,...this.strategyGate({strategy:d,trades,regime,era})})).map(x=>({id:x.id,name:x.name,status:x.status,sizeMultiplier:x.sizeMultiplier,expectancy:x.all?.expectancy||0,profitFactor:x.all?.profitFactor||0}));
    const paused=gates.filter(x=>x.status==='PAUSED'||x.status==='REGIME PAUSED');
    return{version:'profit-accelerator-v1',champions,gates:gates.slice(0,40),paused,correlationHotspots:(correlations||[]).filter(x=>num(x.jaccard)>=60).slice(0,12),noTrade:noTrade||null};
  }
}
export function createPumpLabProfitAccelerator(){return new PumpLabProfitAccelerator();}
