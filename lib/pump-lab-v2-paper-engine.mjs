import {Pool} from 'pg';
import crypto from 'node:crypto';
export class PaperEngine {
 constructor({databaseUrl,log=console.log}={}){
  this.log=log;this.pool=databaseUrl?new Pool({connectionString:databaseUrl,ssl:databaseUrl.includes('render.com')?{rejectUnauthorized:false}:undefined,max:3,connectionTimeoutMillis:5000}):null;
  this.ready=false;this.prices=new Map();this.positions=new Map();this.results=[];this.events=[];this.balances=new Map(['Fortress','Second Chance','Velocity','Vetted Sampler','Meta-Gate','Conviction Runner','Sampler 30K / $50'].map(n=>[n,1000]));this.lastRun=0;this.training={n:0,weights:null,accuracy:null};this.inflight=false;this.highWater=new Map();
 }
 async init(){
  if(!this.pool){this.log('V2_ENGINE_OFFLINE missing DATABASE_URL');return}
  try {
   await this.pool.query(`CREATE TABLE IF NOT EXISTS v2_paper_events(id TEXT PRIMARY KEY,ts TIMESTAMPTZ NOT NULL DEFAULT NOW(),kind TEXT NOT NULL,bot TEXT,mint TEXT,payload JSONB NOT NULL)`);
   await this.pool.query('CREATE INDEX IF NOT EXISTS v2_paper_events_ts ON v2_paper_events(ts)');
   const r=await this.pool.query('SELECT id,kind,bot,mint,payload,ts FROM v2_paper_events ORDER BY ts ASC LIMIT 10000');
   for(const x of r.rows)this.replay(x);
   for(const bot of ['Fortress','Second Chance','Velocity','Meta-Gate','Conviction Runner']){
    const id='sampler-v1-'+bot.replace(/[^a-z]/gi,'-').toLowerCase();
    const rr=await this.pool.query("INSERT INTO v2_paper_events(id,kind,bot,mint,payload) VALUES($1,'RESET',$2,'',$3::jsonb) ON CONFLICT(id) DO NOTHING RETURNING id,kind,bot,mint,payload,ts",[id,bot,JSON.stringify({balance:1000,reason:'sampler-variants',historyPreserved:true})]);
    if(rr.rows[0])this.replay(rr.rows[0]);
   }
   this.ready=true;this.log('V2_ENGINE_POSTGRES_READY rows='+r.rowCount);
  }catch(e){this.ready=false;this.log('V2_ENGINE_DATABASE_ERROR '+e.message)}
 }
 replay(row){
  const x={id:row.id,kind:row.kind,bot:row.bot,mint:row.mint,...row.payload,at:row.ts};
  if(x.kind==='RESET'){for(const p of this.positions.values())if(p.bot===x.bot&&!p.closed){p.closed=true;p.resetClosed=true}this.balances.set(x.bot,Number(x.balance)||1000)}
  if(x.kind==='BUY'){this.positions.set(x.id,x);this.balances.set(x.bot,(this.balances.get(x.bot)||0)-x.entryCost)}
  if(x.kind==='SELL'){const p=this.positions.get(x.buyId);if(p)p.closed=true;this.balances.set(x.bot,(this.balances.get(x.bot)||0)+x.proceeds);this.results.push(x)}
  this.events.push(x);if(this.events.length>200)this.events.shift();
 }
 async record(kind,bot,mint,payload){
  if(!this.ready)throw Error('DATABASE_NOT_READY');
  const id=crypto.randomUUID(),r=await this.pool.query('INSERT INTO v2_paper_events(id,kind,bot,mint,payload) VALUES($1,$2,$3,$4,$5) RETURNING id,kind,bot,mint,payload,ts',[id,kind,bot,mint,JSON.stringify(payload)]);
  this.replay(r.rows[0]);
  if(kind==='BUY'||kind==='SELL'){
   const p=payload||{},verified=kind==='BUY'
     ? Number.isFinite(p.entryPrice)&&p.entryPrice>0&&Number.isFinite(p.quantity)&&p.quantity>0&&Number.isFinite(p.entryCost)&&p.entryCost>0
     : Number.isFinite(p.priceUsd)&&p.priceUsd>0&&Number.isFinite(p.quantity)&&p.quantity>0&&Number.isFinite(p.proceeds)&&Number.isFinite(p.pnl)&&Number.isFinite(p.returnPct)&&Math.abs((p.proceeds-(this.positions.get(p.buyId)?.entryCost||0))-p.pnl)<0.000001;
   this.log('V2_PAPER_'+kind+'_PERSISTED '+JSON.stringify({eventId:id,bot,mint,verified,source:p.quoteSource,quoteAgeMs:p.quoteAgeMs,pnl:kind==='SELL'?p.pnl:null}));
  }
  return id;
 }
 async fetchQuote(mint){
  const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),4500);
  try{
   const r=await fetch('https://api.dexscreener.com/latest/dex/tokens/'+encodeURIComponent(mint),{signal:controller.signal,headers:{accept:'application/json'}});
   if(!r.ok)return null;
   const d=await r.json(),pair=(d.pairs||[]).filter(x=>x.chainId==='solana'&&Number(x.priceUsd)>0&&Number(x.liquidity?.usd)>=5000).sort((a,b)=>(Number(b.liquidity?.usd)||0)-(Number(a.liquidity?.usd)||0))[0];
   if(!pair)return null;
   return{mint,priceUsd:Number(pair.priceUsd),liq:Number(pair.liquidity.usd),marketCap:Number(pair.marketCap||pair.fdv||0),pairAddress:pair.pairAddress,volume5m:Number(pair.volume?.m5||0),buys5m:Number(pair.txns?.m5?.buys||0),sells5m:Number(pair.txns?.m5?.sells||0),fetchedAt:Date.now(),source:'dexscreener',pairCreatedAt:Number(pair.pairCreatedAt||0)};
  }catch{return null}finally{clearTimeout(timeout)}
 }
 async observe(mint){
  const q=await this.fetchQuote(mint);if(!q)return null;
  const old=this.prices.get(mint)||[];old.push(q);if(old.length>180)old.shift();this.prices.set(mint,old);
  return q;
 }
 features(mint){
  const rows=this.prices.get(mint)||[],q=rows.at(-1);if(!q||Date.now()-q.fetchedAt>15000||rows.length<3)return null;
  const n=rows.length,previous=rows[Math.max(0,n-4)],ratio=q.priceUsd/previous.priceUsd-1;
  const b=q.buys5m,s=q.sells5m;
  return{q,rows,n,ratio,buyerRatio:b+s>0?b/(b+s):0,vol:q.volume5m,liq:q.liq,cap:q.marketCap};
 }
 trainMeta(){
  const closed=this.results.filter(x=>x.features&&typeof x.pnl==='number');
  if(closed.length<50){this.training={n:closed.length,weights:null,accuracy:null};return}
  // Train on earlier 80% of examples only; keep latest 20% as untouched holdout.
  const split=Math.floor(closed.length*.8),train=closed.slice(0,split),test=closed.slice(split);
  const logistic=z=>1/(1+Math.exp(-Math.max(-30,Math.min(30,z))));
  const vec=x=>[1,Math.min(1,x.features.ratio||0)*4,Math.min(1,x.features.buyerRatio||0),Math.min(1,(x.features.liq||0)/100000)];
  let w=[0,0,0,0];for(let i=0;i<300;i++)for(const x of train){const v=vec(x),err=logistic(v.reduce((a,n,j)=>a+n*w[j],0))-(x.pnl>0?1:0);for(let j=0;j<w.length;j++)w[j]-=.015*(err*v[j]+.002*w[j])}
  const hits=test.filter(x=>{const v=vec(x),p=logistic(v.reduce((a,n,j)=>a+n*w[j],0));return(p>.5)===(x.pnl>0)}).length;
  this.training={n:closed.length,weights:w,accuracy:hits/test.length,holdout:test.length};
 }
 selectBot(f,mint){
  if(!f||f.liq<12000||f.cap<25000||f.cap>1500000||f.buyerRatio<.47||f.ratio<-.30||f.ratio>.45)return null;
  if(this.positions.size>2000)return null;
  if([...this.positions.values()].some(p=>!p.closed&&p.mint===mint))return null;
  const count=bot=>[...this.positions.values()].filter(p=>!p.closed&&p.bot===bot).length;
  const eligible=bot=>count(bot)<2&&(this.balances.get(bot)||0)>=105;
  // Deterministic sampler baseline is independent of momentum scoring.
  if(eligible('Vetted Sampler')&&parseInt(crypto.createHash('sha256').update(mint).digest('hex').slice(0,4),16)%13===0)return 'Vetted Sampler';
  // Vetted Sampler above remains the untouched control (hash bucket 0).
  // Other bots use separate deterministic hash buckets, each with one slight filter variation.
  const bucket=parseInt(crypto.createHash('sha256').update(mint).digest('hex').slice(0,4),16)%13;
  const variants=[
   ['Fortress',1,f.liq>=18000],
   ['Second Chance',2,f.buyerRatio>=.50],
   ['Velocity',3,f.vol>=750],
   ['Meta-Gate',4,f.cap>=40000],
   ['Conviction Runner',5,f.buyerRatio>=.52],
   ['Sampler 30K / $50',6,f.cap>=30000&&f.vol>=50]
  ];
  for(const [name,slice,passes] of variants)
   if(bucket===slice&&passes&&eligible(name))return name;
  return null;
 }
 async cycle(mints){
  if(this.inflight||!this.ready)return;this.inflight=true;
  try{
   const selected=[...new Set([...this.positions.values()].filter(p=>!p.closed).map(p=>p.mint).concat(mints.slice(-20)))].slice(0,35);
   for(const mint of selected){
    const q=await this.observe(mint);if(!q)continue;
    const f=this.features(mint);
    for(const p of this.positions.values()){
     if(p.mint!==mint||p.closed)continue;
     const age=Date.now()-p.openedAt,returnGross=q.priceUsd/p.entryPrice-1;
     const conviction=p.bot==='Conviction Runner';
     const peak=Math.max(this.highWater.get(p.id)||p.entryPrice,q.priceUsd);this.highWater.set(p.id,peak);
     const peakGain=peak/p.entryPrice-1,drawdown=q.priceUsd/peak-1;
     const shouldExit=conviction?(returnGross<=-.15||age>=120*60*1000||(peakGain>=.18&&drawdown<=-.12)||(age>=20*60*1000&&returnGross<0&&f&&f.ratio<-.05)):(returnGross<=-.12||returnGross>=.22||age>=15*60*1000);
     if(shouldExit){
      // 1% exit fee plus 1% modeled slippage; both prices quoted from independent API.
      const proceeds=p.quantity*q.priceUsd*.98,pnl=proceeds-p.entryCost;
      await this.record('SELL',p.bot,mint,{exitReason:conviction?(returnGross<=-.15?'hard_stop':age>=120*60*1000?'time_limit':peakGain>=.18&&drawdown<=-.12?'trailing_stop':'momentum_faded'):'standard_exit',peakPrice:peak,buyId:p.id,priceUsd:q.priceUsd,quantity:p.quantity,proceeds,pnl,returnPct:pnl/p.entryCost*100,quoteSource:q.source,quoteAgeMs:Date.now()-q.fetchedAt,features:p.features});
     }
    }
    if(!f)continue;
    const bot=this.selectBot(f,mint);if(!bot)continue;
    const spend=100,quantity=spend*.98/q.priceUsd; // 1% entry fee + 1% entry slippage
    await this.record('BUY',bot,mint,{entryPrice:q.priceUsd,quantity,entryCost:spend,openedAt:Date.now(),quoteSource:q.source,quoteAgeMs:Date.now()-q.fetchedAt,features:{ratio:f.ratio,buyerRatio:f.buyerRatio,liq:f.liq}});
   }
   this.trainMeta();this.lastRun=Date.now();
  }catch(e){this.log('V2_ENGINE_CYCLE_ERROR '+e.message)}finally{this.inflight=false}
 }
 state(){
  const open=[...this.positions.values()].filter(x=>!x.closed);
  return{ready:this.ready,storage:this.ready?'postgres':'unavailable',quoteSource:'DexScreener polled',lastCycle:this.lastRun,observedTokens:this.prices.size,openPositions:open.length,closedTrades:this.results.length,meta:this.training,bots:[...this.balances].map(([name,cash])=>({name,cash,open:open.filter(x=>x.bot===name).length,pnl:this.results.filter(x=>x.bot===name).reduce((a,x)=>a+x.pnl,0)})),trades:this.events.filter(x=>x.kind==='BUY'||x.kind==='SELL').slice(-80).reverse(),warnings: this.ready?['Paper-fill assumptions: 1% fee + 1% slippage per side. Quotes are polled; not executable on-chain prices.']:['DATABASE_URL required for durable automatic paper trading.']};
 }
}
