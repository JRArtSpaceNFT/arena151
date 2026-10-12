// Independent paper-only research cohort. NEVER modifies the canonical five-bot ledger.
const START=1000,FEE=.0125,FIXED=.02;
export const SHADOW_PROFILES=[
 {id:'flash',name:'Flash Scout',lo:10000,hi:100000,style:'flash',risk:58,quality:66,hold:18,stop:10,take:23},
 {id:'pulse',name:'Pulse Hunter',lo:100000,hi:250000,style:'momentum',risk:56,quality:68,hold:30,stop:9,take:28},
 {id:'climber',name:'Steady Climber',lo:250000,hi:500000,style:'trend',risk:52,quality:72,hold:50,stop:10,take:35},
 {id:'whale',name:'Deep Water',lo:500000,hi:1000000,style:'quality',risk:46,quality:78,hold:75,stop:8,take:33},
 {id:'rebound',name:'Rebound Watch',lo:100000,hi:1000000,style:'rebound',risk:54,quality:72,hold:50,stop:9,take:31},
 {id:'baseline',name:'Baseline Control',lo:100000,hi:1000000,style:'control',risk:54,quality:72,hold:30,stop:9,take:28}
];
const valid=v=>typeof v==='number'&&Number.isFinite(v);
function hash(x){let h=2166136261;for(const c of String(x)){h^=c.charCodeAt(0);h=Math.imul(h,16777619)}return h>>>0}
const slip=(usd,liq)=>Math.min(.065,.004+usd/Math.max(1,liq)*.35);
function quoteOk(t,ts){
 const seen=Number(t?.sourceSeen?.dexscreener)||0;
 return !!(t&&valid(t.price)&&t.price>0&&valid(t.mc)&&valid(t.liq)&&t.liq>=10000&&
 t.priceSource==='dexscreener'&&t.liquidityKind==='dex-liquidity'&&seen>0&&
 ts>=seen&&ts-seen<=90000&&Array.isArray(t.sources)&&t.sources.length>=2);
}
function eligible(p,t,f,q){
 if(t.mc<p.lo||t.mc>=p.hi||q.score<p.quality||f.risk>p.risk||
 !valid(f.buyRatio)||!valid(f.momentum)||!valid(f.acceleration)||!valid(f.age))return false;
 if(p.style==='flash')return f.age>=.8&&f.age<=25&&f.buyRatio>=.54&&f.buyRatio<=.78&&f.momentum>=51&&f.acceleration>=43;
 if(p.style==='momentum')return f.age>=1&&f.age<=45&&f.buyRatio>=.55&&f.buyRatio<=.77&&f.momentum>=56&&f.acceleration>=48;
 if(p.style==='trend')return f.age>=2&&f.buyRatio>=.52&&f.momentum>=51&&f.acceleration>=42&&f.chart?.chartQuality>=50;
 if(p.style==='quality')return f.age>=3&&f.buyRatio>=.50&&f.momentum>=46&&f.acceleration>=37&&f.chart?.chartQuality>=56;
 if(p.style==='rebound')return f.age>=2&&f.drawdown<=-8&&f.drawdown>=-35&&f.rebound>=4&&f.buyRatio>=.52&&f.acceleration>=40;
 return p.style==='control'&&f.age>=2&&f.buyRatio>=.48&&f.buyRatio<=.78&&hash(t.mint)%13===0;
}
export class ShadowCohorts{
 constructor(){
  this.version=1;this.savedAt=0;this.lastObservedAt=0;
  this.bots=SHADOW_PROFILES.map(x=>({...x,cash:START,peak:START,n:0,wins:0,losses:0,rejects:0,observations:0,lastTradeAt:0}));
  this.positions=[];this.trades=[];this.actions=[];
 }
 observe(t,f,q,{executable=false,ts=Date.now(),tradingUnlocked=false}={}){
  if(!valid(ts)||!t?.mint)return false;
  this.lastObservedAt=ts;const verified=!!executable&&quoteOk(t,ts),score=Number(f?.score)||0;
  let changed=false;
  for(const b of this.bots){
   b.observations++;const pos=this.positions.find(x=>x.bot===b.id&&x.mint===t.mint);
   if(pos){
    if(!verified){b.rejects++;continue}
    pos.lastPrice=t.price;pos.lastMarkedAt=ts;
    const move=(t.price/pos.entry-1)*100,age=(ts-pos.opened)/60000;
    const reason=move<=-b.stop?'stop':move>=b.take?'take':age>=b.hold?'time':null;
    if(reason){
     const xSlip=slip(pos.notional,t.liq),exit=t.price*(1-xSlip),proceeds=Math.max(0,pos.units*exit*(1-FEE)-FIXED),pnl=proceeds-pos.cost;
     b.cash+=proceeds;b.n++;if(pnl>=0)b.wins++;else b.losses++;
     this.trades.unshift({...pos,closedAt:ts,exit,pnl,pnlPct:pnl/pos.cost*100,why:reason,exitSource:'dexscreener',exitSlip:xSlip});
     this.trades.splice(600);this.positions.splice(this.positions.indexOf(pos),1);
     b.peak=Math.max(b.peak,b.cash+this.positions.filter(x=>x.bot===b.id).reduce((v,x)=>v+x.units*x.lastPrice,0));
     this.actions.unshift({ts,bot:b.id,action:'EXIT',mint:t.mint,reason});changed=true;
    }
    continue;
   }
   if(!tradingUnlocked||!verified||!eligible(b,t,f,q||{})){b.rejects++;continue}
   const open=this.positions.filter(x=>x.bot===b.id),exposure=open.reduce((v,x)=>v+x.notional,0);
   const equity=b.cash+open.reduce((v,x)=>v+x.units*x.lastPrice,0);
   if(open.length>=2||exposure>250||equity<=b.peak*.85||b.cash<130||ts-b.lastTradeAt<90000){b.rejects++;continue}
   const recent=this.trades.filter(x=>x.bot===b.id&&ts-x.opened<3600000).length+open.filter(x=>ts-x.opened<3600000).length;
   if(recent>=6||this.trades.some(x=>x.bot===b.id&&x.mint===t.mint&&ts-x.closedAt<7200000)){b.rejects++;continue}
   const requested=score>=90&&t.liq>=50000?250:100;
   const budget=Math.min(requested,t.liq*.01,(b.cash-FIXED)/(1+FEE));
   if(budget<100||slip(budget,t.liq)>.04){b.rejects++;continue}
   const entry=t.price*(1+slip(budget,t.liq)),cost=budget*(1+FEE)+FIXED;
   b.cash-=cost;b.lastTradeAt=ts;
   this.positions.push({id:'shadow:'+b.id+':'+t.mint+':'+ts,bot:b.id,mint:t.mint,symbol:t.symbol,opened:ts,entry,units:budget/entry,notional:budget,cost,entrySlip:slip(budget,t.liq),entrySource:'dexscreener',lastPrice:t.price,lastMarkedAt:ts});
   this.actions.unshift({ts,bot:b.id,action:'ENTRY',mint:t.mint,amount:budget});changed=true;
  }
  this.actions.splice(200);if(changed)this.savedAt=ts;return changed;
 }
 snapshot(ts=Date.now()){
  return {version:this.version,savedAt:this.savedAt,lastObservedAt:this.lastObservedAt,paperOnly:true,independentLedger:true,
   bots:this.bots.map(b=>{const open=this.positions.filter(p=>p.bot===b.id),equity=b.cash+open.reduce((v,p)=>v+p.units*p.lastPrice,0);
    return {...b,equity,open:open.length,unpriced:open.filter(p=>ts-p.lastMarkedAt>90000).length,pnl:equity-START,winRate:b.n?b.wins/b.n*100:0};}),
   positions:this.positions.slice(-24),trades:this.trades.slice(0,60),actions:this.actions.slice(0,20)};
 }
 serialize(){return {version:this.version,savedAt:this.savedAt,lastObservedAt:this.lastObservedAt,bots:this.bots.map(x=>({...x})),positions:this.positions.slice(-24),trades:this.trades.slice(0,600),actions:this.actions.slice(0,200)}}
 restore(data){
  if(!data||data.version!==this.version||!valid(data.savedAt)||data.savedAt<this.savedAt||
   !Array.isArray(data.bots)||!Array.isArray(data.positions)||!Array.isArray(data.trades))return false;
  const by=new Map(data.bots.map(x=>[x.id,x]));
  for(const b of this.bots){const saved=by.get(b.id);if(!saved)continue;
   for(const k of ['cash','peak','n','wins','losses','rejects','observations','lastTradeAt'])if(valid(saved[k])&&saved[k]>=0)b[k]=saved[k];
  }
  this.positions=data.positions.filter(x=>this.bots.some(b=>b.id===x.bot)&&valid(x.units)&&x.units>0&&valid(x.entry)&&x.entry>0).slice(-24);
  this.trades=data.trades.filter(x=>this.bots.some(b=>b.id===x.bot)&&valid(x.pnl)&&valid(x.closedAt)).slice(0,600);
  this.actions=(data.actions||[]).slice(0,200);this.savedAt=data.savedAt;this.lastObservedAt=Number(data.lastObservedAt)||0;return true;
 }
}
