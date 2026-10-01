import http from 'node:http';
import fs from 'node:fs';

const PORT = Number(process.env.PORT || 3000);
const PUMP_KEY = process.env.PUMPPORTAL_API_KEY || '';
const ALLOW_METERED = (process.env.ALLOW_METERED_PUMPPORTAL || 'false') === 'true';
const START = 1000;
const TARGET = 100000;
const FEE_RATE = 0.0125;
const STATE_FILE = process.env.STATE_FILE || '/tmp/pump-lab-state-v06.json';
const DATABASE_URL = process.env.DATABASE_URL || '';
const PUMP_PROGRAM = '6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P';
const SOLANA_RPC_HTTP = process.env.SOLANA_RPC_HTTP || 'https://api.mainnet-beta.solana.com';
const SOLANA_RPC_WSS = process.env.SOLANA_RPC_WSS || 'wss://api.mainnet-beta.solana.com';

// Public Fomo trader identities requested for research. Wallets are attached only when
// a public mapping is corroborated strongly enough to avoid polluting the dataset.
const FOMO_WATCHLIST = [
  {id:'dingalingts',name:'Dingalingts',status:'resolving',wallets:[]},
  {id:'rachelwolchin',name:'RachelWolchin',status:'resolving',wallets:[]},
  {id:'unipcs',name:'Unipcs',status:'tracking',wallets:[
    {address:'2heJbC32Tpfcb3nbUb5ER61K11FGZVfVGtVnDm6LDogF',label:'Fomo/public Solana',confidence:'verified'}
  ]},
  {id:'frankdegods',name:'FrankDeGods',status:'tracking',wallets:[
    {address:'498g1rVnFcnjBjpfw1xyqA1WvgQXUU8RWuELjxkjAayQ',label:'Fomo/public Solana',confidence:'verified'}
  ]},
  {id:'macdegods',name:'MacDeGods',status:'tracking',wallets:[
    {address:'5RZPhPW9qGEd3hRGibgYaF5Yk2jBzXR1VZMKSP71C3Lb',label:'public Solana',confidence:'verified'}
  ]},
  {id:'orangie',name:'Orangie',status:'tracking',wallets:[
    {address:'DuQabFqdC9eeBULVa7TTdZYxe8vK8ct5DZr4Xcf7docy',label:'primary public Solana',confidence:'verified'}
  ]},
  {id:'tjr',name:'TJR',status:'resolving',wallets:[]},
  {id:'rasmr',name:'Rasmr',status:'tracking',wallets:[
    {address:'9CNyLECt2j8tnDhqxtjYk5HUhZ2b8Nwnyb7sfYN7vND2',label:'Fomo-mapped Solana',confidence:'verified'},
    {address:'DtjZR9SdxUKbMyu4qeUVgjMJyGDhYg76BttXxfhf3z59',label:'secondary / creator Solana',confidence:'secondary'}
  ]}
];
const WATCHED_WALLET_LOOKUP = new Map();
for(const trader of FOMO_WATCHLIST)for(const wallet of trader.wallets)WATCHED_WALLET_LOOKUP.set(wallet.address,{traderId:trader.id,traderName:trader.name,...wallet});

const MAX_ACTIVITY = 400;
const MAX_TRADES = 800;
const MAX_DECISIONS = 3000;
const MAX_TIMELINE = 240;

const tokens = new Map();
const creators = new Map();
const positions = [];
const trades = [];
const activity = [];
const decisions = [];
const opportunities = new Map();
const health = new Map();
const clients = new Set();
const timeline = [];
const autopsies = [];
const experiments = [];
const replayFrames = [];
let corrCache = {ts:0, rows:[]};
const promotions = [];
const graveyard = [];
const walletEvents = [];
const solanaQueue = [];
const solanaSeen = new Set();
let solanaWs = null;
let solanaObserved = 0;
let solanaResolved = 0;
let solanaSubAcks = 0;
let db = null;
let research = { last: 0, notes: [], hypotheses: [] };
let startedAt = Date.now();

const strategyDefs = [
  ['banker','🏦','The Banker','LOW',.04,78,18,55,1,'capital preservation + confirmation'],
  ['quant','∑','The Quant','LOW',.05,76,20,65,1,'multi-factor statistical confirmation'],
  ['smart','🧠','Smart Money','MED',.07,72,24,70,1,'wallet/flow proxies + quality filters'],
  ['social','📡','Social Alpha','MED',.07,70,23,65,1,'social metadata + attention proxies'],
  ['momentum','⚡','Momentum Hunter','HIGH',.09,66,18,72,1,'price and buyer acceleration'],
  ['graduation','🎓','Graduation','MED',.07,70,22,65,1,'bonding-curve / migration proximity'],
  ['dip','↘','Dip Buyer','MED',.07,72,20,65,1,'quality pullbacks with improving flow'],
  ['swing','🌊','Swing Trader','MED',.06,74,28,85,1,'liquidity + structure + patience'],
  ['degen','🔥','Early Degen','EXTREME',.13,60,16,55,2,'very early asymmetry hunting'],
  ['smartmom','🧬','Smart Momentum','HIGH',.10,70,20,72,2,'flow + momentum hybrid'],
  ['culture','🌐','Culture Hybrid','HIGH',.09,70,22,72,2,'attention + flow + momentum'],
  ['contrarian','🪞','Contrarian','MED',.06,75,20,65,1,'avoid crowded late momentum'],
  ['sniper','🎯','Patient Sniper','MED',.12,84,18,80,1,'rare high-conviction setups'],
  ['champion','👑','Champion','EXTREME',.15,67,20,68,2,'maximize terminal paper wealth'],
  ['professional','🛡','Professional','LOW',.055,80,18,65,1,'risk-adjusted return'],
  ['adaptive','🧭','Adaptive Master','MED',.09,74,20,72,2,'regime-aware ensemble'],
  ['random','🎲','Random Control','CONTROL',.05,70,22,45,1,'random baseline'],
  ['volume','📊','Volume Control','CONTROL',.06,68,22,50,1,'simple volume baseline'],
  ['launchctl','🧱','Every Launch Control','CONTROL',.035,0,30,50,3,'buy-everything launch baseline'],
  ['socialctl','📣','Social Metadata Control','CONTROL',.04,58,25,55,2,'simple social-metadata baseline']
].map(([id,icon,name,risk,size,min,stop,take,maxOpen,thesis]) => ({
  id,icon,name,risk,size,min,stop,take,maxOpen,thesis,version:1,equity:START,cash:START,peak:START,dd:0,wins:0,losses:0,n:0
}));

const challengers = [
  makeChallenger('momentum','momentum-c1','Momentum Challenger','min -4 / longer winners',{minDelta:-4,takeDelta:12}),
  makeChallenger('professional','professional-c1','Professional Challenger','stricter risk / slightly larger winners',{minDelta:2,takeDelta:8,riskCap:38}),
  makeChallenger('degen','degen-c1','Degen Challenger','less trigger-happy early entries',{minDelta:6,stopDelta:-2}),
  makeChallenger('smartmom','smartmom-c1','Smart Momentum Challenger','higher confirmation threshold',{minDelta:4,takeDelta:10})
];

function makeChallenger(parentId,id,name,mutation,mods={}) {
  const p = strategyDefs.find(x=>x.id===parentId);
  return {...p,id,name,icon:'🧪',risk:'R&D',type:'challenger',parentId,mutation,
    min:p.min+(mods.minDelta||0),stop:p.stop+(mods.stopDelta||0),take:p.take+(mods.takeDelta||0),riskCap:mods.riskCap,
    equity:START,cash:START,peak:START,dd:0,wins:0,losses:0,n:0,version:p.version+0.1};
}

const allTraders = () => [...strategyDefs, ...challengers.filter(c=>!c.graveyardAt&&!c.promotedAt)];
const now = () => Date.now();
const clamp = (x,a=0,b=100) => Math.max(a, Math.min(b, Number.isFinite(x)?x:0));
const num = x => Number.isFinite(Number(x)) ? Number(x) : 0;
const pct = (a,b) => b ? (a/b-1)*100 : 0;
const ageMin = t => Math.max(0,(now()-t.createdAt)/60000);

function log(kind,text,severity='info',data={}) {
  const row={ts:now(),kind,text,severity,data};
  activity.unshift(row); activity.splice(MAX_ACTIVITY);
  broadcast('activity',row);
}
function setHealth(component,status,detail,meta={}) {
  const row={ts:now(),component,status,detail,...meta}; health.set(component,row); broadcast('health',row);
}
function broadcast(type,data) {
  const payload=`event: ${type}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const c of [...clients]) { try { c.write(payload); } catch { clients.delete(c); } }
}

function narrativeFor(t) {
  const z=`${t.name||''} ${t.symbol||''}`.toLowerCase();
  if(/ai|agent|gpt|robot|model|compute/.test(z)) return 'AI';
  if(/dog|doge|inu|shib|pup|woof/.test(z)) return 'Dogs';
  if(/cat|kitty|meow|feline/.test(z)) return 'Cats';
  if(/frog|pepe|toad/.test(z)) return 'Frogs';
  if(/game|pixel|play|quest/.test(z)) return 'Games';
  if(/trump|polit|president|america|maga|gov/.test(z)) return 'Politics';
  if(/grok|elon|tesla|xai/.test(z)) return 'Elon / Grok';
  if(/coin|cash|money|rich|million|billion/.test(z)) return 'Money Meta';
  if(/baby|mini|based|official|real/.test(z)) return 'Derivatives';
  return 'Memes';
}

function normalize(raw,source='live') {
  const mint = raw.mint || raw.tokenAddress || raw.address || raw.baseToken?.address;
  if(!mint) return null;
  const symbol=(raw.symbol||raw.baseToken?.symbol||raw.name||'TOKEN').toString().slice(0,18).toUpperCase();
  const name=(raw.name||raw.baseToken?.name||symbol).toString().slice(0,64);
  let mc=num(raw.usd_market_cap||raw.marketCapUsd||raw.marketCap||raw.fdv||0);
  if(mc>0 && mc<1000 && num(raw.marketCapSol)>0) mc=num(raw.marketCapSol)*150;
  let price=num(raw.priceUsd||raw.price_usd||0); if(!price&&mc>0) price=mc/1e9;
  const liq=num(raw.liquidity?.usd||raw.liquidityUsd||raw.liquidity||Math.max(500,mc*.08));
  const vol=num(raw.volume?.m5||raw.volume?.h1||raw.volume1m||raw.volume||0);
  const buys=num(raw.txns?.m5?.buys||raw.txns?.h1?.buys||raw.buys1m||raw.buys||0);
  const sells=num(raw.txns?.m5?.sells||raw.txns?.h1?.sells||raw.sells1m||raw.sells||0);
  const created=num(raw.created_timestamp||raw.pairCreatedAt||raw.createdAt||now());
  const createdAt=created<1e12?created*1000:created;
  const socials=raw.info?.socials||[];
  const twitter=raw.twitter||socials.find(x=>/twitter|x/i.test(x.platform||''))?.handle||'';
  const website=raw.website||raw.info?.websites?.[0]?.url||'';
  const creator=raw.creator||raw.traderPublicKey||raw.user||'';
  const boosts=num(raw.boosts?.active||raw.boostAmount||0);
  return {mint,symbol,name,source,price,mc,liq,vol,buys,sells,createdAt,updatedAt:now(),narrative:narrativeFor({name,symbol}),graduated:!!raw.complete,
    twitter,website,image:raw.image_uri||raw.image||raw.info?.imageUrl||'',creator,boosts,history:[],sources:[source],firstPrice:price,firstMc:mc,peakPrice:price,peakMc:mc,troughPrice:price||0,troughMc:mc||0};
}

function mergeToken(old,t) {
  if(!old) return t;
  const hist=(old.history||[]).slice(-119);
  hist.push({ts:now(),price:old.price,mc:old.mc,liq:old.liq,vol:old.vol,buys:old.buys,sells:old.sells});
  return {...old,...t,
    firstPrice:old.firstPrice||t.price,firstMc:old.firstMc||t.mc,history:hist,
    peakPrice:Math.max(old.peakPrice||0,t.price||0),peakMc:Math.max(old.peakMc||0,t.mc||0),
    troughPrice:Math.min(old.troughPrice||t.price||0,t.price||old.troughPrice||0),troughMc:Math.min(old.troughMc||t.mc||0,t.mc||old.troughMc||0),
    sources:[...new Set([...(old.sources||[]),...(t.sources||[]),t.source])],
    twitter:t.twitter||old.twitter,website:t.website||old.website,image:t.image||old.image,creator:t.creator||old.creator,
    buys:Math.max(t.buys||0,old.buys||0),sells:Math.max(t.sells||0,old.sells||0),vol:Math.max(t.vol||0,old.vol||0),boosts:Math.max(t.boosts||0,old.boosts||0)
  };
}

function updateCreator(t) {
  if(!t.creator) return;
  let c=creators.get(t.creator);
  if(!c) c={creator:t.creator,tokens:new Set(),launches:0,firstSeen:now(),lastSeen:now(),bestPeakX:0,collapses:0,graduates:0};
  if(!c.tokens.has(t.mint)){c.tokens.add(t.mint);c.launches++;}
  c.lastSeen=now();
  const x=t.firstMc? t.peakMc/t.firstMc : 1; c.bestPeakX=Math.max(c.bestPeakX,x);
  if(t.firstMc&&t.mc/t.firstMc<.35)c.collapses++;
  if(t.graduated)c.graduates++;
  creators.set(t.creator,c);
}

function creatorDNA(t) {
  const c=t.creator?creators.get(t.creator):null;
  return {known:!!c,launches:c?.launches||0,bestPeakX:c?.bestPeakX||0,collapses:c?.collapses||0,graduates:c?.graduates||0,
    repeatCreator:(c?.launches||0)>1,observedOnly:true};
}

function features(t) {
  const hist=t.history||[];
  const prev=hist[Math.max(0,hist.length-5)]||{price:t.price,vol:t.vol};
  const momentum=clamp(50+pct(t.price,prev.price)*2.0);
  const total=t.buys+t.sells; const buyRatio=total?t.buys/total:.5;
  const flow=clamp(buyRatio*100);
  const age=ageMin(t);
  const liqScore=clamp(Math.log10(Math.max(10,t.liq))*18-30);
  const volScore=clamp(Math.log10(Math.max(10,t.vol))*17-25);
  const early=clamp(100-age*2.6);
  const graduation=t.graduated?100:clamp((t.mc/69000)*100);
  const social=clamp((t.twitter?22:0)+(t.website?10:0)+Math.min(25,t.boosts*4)+Math.min(25,total*1.25));
  const sourceQuality=clamp((t.sources?.length||1)*28);
  const dna=creatorDNA(t);
  const creatorRisk=clamp((dna.launches>=4?12:0)+(dna.collapses>=2?20:0)-(dna.graduates?10:0));
  const risk=clamp(78-liqScore*.38-(total>8?10:0)+(age<.6?10:0)+(t.website?0:5)+(t.twitter?0:5)+creatorRisk-sourceQuality*.06);
  const score=clamp(momentum*.23+flow*.19+liqScore*.14+volScore*.16+early*.07+social*.08+(100-risk)*.09+sourceQuality*.04);
  return {momentum,flow,buyRatio,age,liqScore,volScore,early,graduation,social,risk,score,sourceQuality,creatorRisk};
}

function strategyRegimeWeight(id,regime){
  const rows=trades.filter(t=>t.strategy===id&&(t.entryRegime||'UNKNOWN')===regime).slice(0,120);
  if(!rows.length)return 1;
  const edge=rows.reduce((a,t)=>a+t.pnlPct,0)/rows.length;
  const learned=clamp(1+edge/45,.35,2.5);const trust=rows.length/(rows.length+10);
  return learned*trust+1*(1-trust);
}

function strategyScore(d,f,t) {
  const sid=d.parentId||d.id;
  let s=f.score;
  if(sid==='banker')s=f.liqScore*.28+f.flow*.18+f.volScore*.20+(100-f.risk)*.34;
  else if(sid==='quant')s=f.score+(f.buyRatio>.62?8:-4)+(f.sourceQuality>45?4:0);
  else if(sid==='smart')s=f.flow*.34+f.volScore*.24+f.momentum*.18+(100-f.risk)*.24;
  else if(sid==='social')s=f.social*.40+f.momentum*.24+f.flow*.18+f.volScore*.18;
  else if(sid==='momentum')s=f.momentum*.45+f.flow*.22+f.volScore*.23+f.liqScore*.10;
  else if(sid==='graduation')s=f.graduation*.45+f.flow*.20+f.volScore*.20+(100-f.risk)*.15;
  else if(sid==='dip')s=(pct(t.price,(t.history.at(-1)||t).price)<0?70:38)*.35+f.flow*.25+f.liqScore*.20+(100-f.risk)*.20;
  else if(sid==='swing')s=f.liqScore*.28+f.volScore*.24+f.flow*.18+(100-f.risk)*.30;
  else if(sid==='degen')s=f.early*.35+f.momentum*.25+f.flow*.20+f.volScore*.20;
  else if(sid==='smartmom')s=f.momentum*.34+f.flow*.27+f.volScore*.22+(100-f.risk)*.17;
  else if(sid==='culture')s=f.social*.30+f.momentum*.28+f.flow*.22+f.volScore*.20;
  else if(sid==='contrarian')s=(f.momentum>38&&f.momentum<58?76:32)*.40+(100-f.risk)*.30+f.liqScore*.30;
  else if(sid==='sniper')s=f.score+(f.risk<35?12:-14)+(f.sourceQuality>50?4:0);
  else if(sid==='champion')s=f.momentum*.38+f.flow*.24+f.volScore*.22+f.early*.16;
  else if(sid==='professional')s=f.liqScore*.30+f.volScore*.20+f.flow*.18+(100-f.risk)*.32;
  else if(sid==='adaptive'){
    const regime=marketWeather().regime;
    const peers=strategyDefs.filter(p=>p.risk!=='CONTROL'&&!['adaptive','champion','professional'].includes(p.id));
    let total=0,weight=0,agree=0;
    for(const p of peers){const ps=strategyScore(p,f,t),w=strategyRegimeWeight(p.id,regime)*diversityWeight(p.id);total+=ps*w;weight+=w;if(ps>=p.min)agree++;}
    s=(weight?total/weight:f.score)+Math.min(12,agree*1.15)+(regime==='HOT'?f.momentum*.04:(100-f.risk)*.04);
  }
  else if(sid==='volume')s=f.volScore*.70+f.liqScore*.30;
  else if(sid==='launchctl')s=100;
  else if(sid==='socialctl')s=f.social;
  else if(sid==='random')s=Math.random()*100;
  return clamp(s);
}

function detective(t,f=features(t)) {
  const dna=creatorDNA(t); const flags=[];
  if(f.risk>65)flags.push('high structural risk');
  if(t.liq<4000)flags.push('thin liquidity');
  if(f.age<1)flags.push('extremely young');
  if(!t.twitter&&!t.website)flags.push('no linked social/site metadata');
  if(dna.launches>=4)flags.push(`repeat creator observed ${dna.launches} launches`);
  if(dna.collapses>=2)flags.push('creator has repeated observed collapses');
  if((t.sources?.length||1)===1)flags.push('single-source price observation');
  const unknown=['holder concentration','linked-wallet clusters','bundle/sniper ownership'].filter(()=>!PUMP_KEY||!ALLOW_METERED);
  return {score:clamp(f.risk+(flags.length*3)),flags,unknown,verdict:f.risk>72?'VETO':f.risk>52?'CAUTION':'PASS'};
}

function consensus(t) {
  const f=features(t); const votes=[];
  for(const d of strategyDefs.filter(x=>x.risk!=='CONTROL')){
    const score=strategyScore(d,f,t); const blocked=(d.risk==='LOW'&&f.risk>48)||(d.id==='sniper'&&f.risk>34);
    votes.push({id:d.id,name:d.name,icon:d.icon,score,yes:score>=d.min&&!blocked,threshold:d.min,blocked});
  }
  const yes=votes.filter(v=>v.yes).length;
  return {yes,total:votes.length,pct:yes/votes.length*100,votes};
}

function marketWeather() {
  const recent=[...tokens.values()].filter(t=>now()-t.updatedAt<180000);
  if(!recent.length)return{regime:'OFFLINE',temperature:0,buyPressure:0,launchVelocity:0,collapseRate:0,risk:0,graduations:0};
  const fs=recent.map(features);
  const avg=x=>x.length?x.reduce((a,b)=>a+b,0)/x.length:0;
  const buyPressure=avg(fs.map(f=>f.buyRatio))*100;
  const mom=avg(fs.map(f=>f.momentum));
  const risk=avg(fs.map(f=>f.risk));
  const launchVelocity=recent.filter(t=>now()-t.createdAt<300000).length/5;
  const collapseRate=recent.filter(t=>t.firstPrice&&t.price/t.firstPrice<.5).length/recent.length*100;
  const graduations=recent.filter(t=>t.graduated).length;
  const temperature=clamp(mom*.45+buyPressure*.35+(100-risk)*.20);
  let regime='SELECTIVE'; if(temperature>68&&buyPressure>56)regime='HOT'; if(temperature<42||buyPressure<43)regime='RISK OFF';
  return{regime,temperature,buyPressure,launchVelocity,collapseRate,risk,graduations};
}

function narrativeStats() {
  const groups=new Map();
  for(const t of tokens.values()){
    if(now()-t.updatedAt>1800000)continue;
    const key=t.narrative||'Memes'; if(!groups.has(key))groups.set(key,[]);groups.get(key).push(t);
  }
  return [...groups].map(([name,arr])=>{
    const fs=arr.map(features); const avg=x=>x.length?x.reduce((a,b)=>a+b,0)/x.length:0;
    const momentum=avg(fs.map(f=>f.momentum));const buyPressure=avg(fs.map(f=>f.buyRatio))*100;const volume=arr.reduce((a,t)=>a+t.vol,0);
    const recent=arr.filter(t=>now()-t.createdAt<600000).length;const saturation=clamp(arr.length*6);const heat=clamp(momentum*.34+buyPressure*.28+Math.log10(Math.max(10,volume))*7+recent*3-saturation*.12);
    return{name,count:arr.length,recent,momentum,buyPressure,volume,heat,saturation};
  }).sort((a,b)=>b.heat-a.heat);
}

function openCount(id){return positions.filter(p=>p.strategy===id&&!p.closed).length;}
function markEquity(d){let e=d.cash;for(const p of positions.filter(x=>x.strategy===d.id&&!x.closed)){const t=tokens.get(p.mint);if(t)e+=p.units*t.price;}d.equity=e;d.peak=Math.max(d.peak,e);d.dd=Math.max(d.dd,(1-e/d.peak)*100);}

function recordDecision(d,t,f,score,action,why='') {
  const row={ts:now(),strategy:d.id,strategyName:d.name,mint:t.mint,symbol:t.symbol,action,score,risk:f.risk,price:t.price,mc:t.mc,narrative:t.narrative,regime:marketWeather().regime,why,
    features:{momentum:f.momentum,flow:f.flow,volScore:f.volScore,liqScore:f.liqScore,social:f.social,age:f.age,sourceQuality:f.sourceQuality}};
  decisions.unshift(row); decisions.splice(MAX_DECISIONS);
  const key=`${d.id}:${t.mint}`;
  if(!opportunities.has(key)) opportunities.set(key,{...row,firstTs:row.ts,firstPrice:t.price,bestReturn:0,worstReturn:0,latestReturn:0,entered:action==='BUY'});
  else if(action==='BUY'){const o=opportunities.get(key);o.entered=true;o.action='BUY';o.entryTs=row.ts;o.entryPrice=t.price;o.score=score;o.risk=f.risk;o.why=why;o.regime=row.regime;}
}

function updateOpportunities(t) {
  for(const [key,o] of opportunities){if(o.mint!==t.mint||!o.firstPrice)continue;const r=pct(t.price,o.firstPrice);o.latestReturn=r;o.bestReturn=Math.max(o.bestReturn,r);o.worstReturn=Math.min(o.worstReturn,r);o.lastTs=now();}
}

function maybeTrade(t) {
  const f=features(t);
  for(const d of allTraders()){
    markEquity(d);
    const existing=positions.find(p=>p.strategy===d.id&&p.mint===t.mint&&!p.closed);
    if(existing){
      const pnl=pct(t.price,existing.entry);const hold=(now()-existing.opened)/60000;const fade=f.momentum<38||f.buyRatio<.38;
      const maxHold=d.id==='swing'?90:d.type==='challenger'?45:35;
      if(pnl<=-d.stop||pnl>=d.take||hold>maxHold||fade) closePos(d,existing,t,fade?'thesis broke':pnl>=d.take?'take profit':pnl<=-d.stop?'stop':'time exit');
      continue;
    }
    if(openCount(d.id)>=d.maxOpen||d.cash<25||!(t.price>0))continue;
    const score=strategyScore(d,f,t);
    const lowBlocked=d.risk==='LOW'&&f.risk>48; const sniperBlocked=d.parentId==='sniper'||d.id==='sniper'?f.risk>34:false; const customBlocked=d.riskCap&&f.risk>d.riskCap;
    if(score<d.min||lowBlocked||sniperBlocked||customBlocked){
      if(!opportunities.has(`${d.id}:${t.mint}`))recordDecision(d,t,f,score,'REJECT',score<d.min?'below threshold':'risk veto');
      continue;
    }
    const regime=marketWeather().regime;let sizeMult=1;
    if(regime==='RISK OFF'){if(['degen','champion'].includes(d.id))sizeMult=.5;else if(d.risk==='LOW'||d.id==='professional')sizeMult=.8;else sizeMult=.65;}
    if(regime==='HOT'&&['champion','momentum','smartmom'].includes(d.id))sizeMult=1.15;
    if(d.id==='adaptive')sizeMult*=clamp(.65+(score-60)/45,.55,1.35);
    const budget=Math.min(d.cash*.45,Math.max(12,d.equity*d.size*sizeMult));
    const slip=.0035+Math.min(.04,budget/Math.max(1000,t.liq)*.5);const entry=t.price*(1+slip);const cost=budget*(1+FEE_RATE);
    if(cost>d.cash)continue;
    d.cash-=cost;
    const p={id:'p'+now()+Math.random(),strategy:d.id,mint:t.mint,symbol:t.symbol,entry,units:budget/entry,invested:budget,opened:now(),closed:false,score,entryFeatures:{...f},reason:`score ${score.toFixed(0)} · risk ${f.risk.toFixed(0)} · flow ${(f.buyRatio*100).toFixed(0)}%`,entryRegime:regime,peakDuring:entry,troughDuring:entry};
    positions.push(p);recordDecision(d,t,f,score,'BUY',p.reason);
    if(d.risk!=='R&D')log('buy',`${d.icon} ${d.name} bought $${t.symbol} · $${budget.toFixed(0)} paper · ${p.reason}`,'good',{strategy:d.id,mint:t.mint});
  }
}

function updateOpenPositionExtremes(t){for(const p of positions){if(p.closed||p.mint!==t.mint)continue;p.peakDuring=Math.max(p.peakDuring||p.entry,t.price);p.troughDuring=Math.min(p.troughDuring||p.entry,t.price);}}

function closePos(d,p,t,why){
  const slip=.0035+Math.min(.04,p.invested/Math.max(1000,t.liq)*.5);const exit=t.price*(1-slip);const gross=p.units*exit;const proceeds=gross*(1-FEE_RATE);
  d.cash+=proceeds;p.closed=true;p.closedAt=now();p.exit=exit;p.pnl=proceeds-p.invested*(1+FEE_RATE);p.pnlPct=p.pnl/(p.invested*(1+FEE_RATE))*100;p.why=why;
  p.mfe=pct(p.peakDuring||exit,p.entry);p.mae=pct(p.troughDuring||exit,p.entry);p.counterfactual={exitNow:p.pnlPct,holdAfterExit:{oneMin:null,fiveMin:null,fifteenMin:null},bestObservedAfterExit:null};
  const stressPenalty=2.5+Math.min(10,(p.invested/Math.max(1000,t.liq))*100);
  p.executionStress={easy:p.pnlPct+1.5,realistic:p.pnlPct,nightmare:p.pnlPct-stressPenalty,penalty:stressPenalty};
  d.n++;if(p.pnl>0)d.wins++;else d.losses++;trades.unshift({...p,name:t.name,narrative:t.narrative});trades.splice(MAX_TRADES);markEquity(d);
  const aut=buildAutopsy(d,p,t);autopsies.unshift(aut);autopsies.splice(250);
  if(d.risk!=='R&D')log('sell',`${d.icon} ${d.name} sold $${t.symbol} ${p.pnlPct>=0?'+':''}${p.pnlPct.toFixed(1)}% · ${why}`,p.pnl>=0?'good':'bad',{strategy:d.id,mint:t.mint});
}

function buildAutopsy(d,p,t){
  const ef=p.entryFeatures||{};const mistakes=[];const strengths=[];
  if(ef.risk>60)mistakes.push('entered with elevated structural risk'); else strengths.push('risk filter passed');
  if(ef.buyRatio>.62)strengths.push('strong entry buy pressure'); else mistakes.push('weak entry buy pressure');
  if(ef.momentum>65)strengths.push('confirmed momentum'); else if(ef.momentum<45)mistakes.push('weak momentum at entry');
  if(p.mfe>35&&p.pnlPct<10)mistakes.push('captured little of favorable excursion');
  if(p.mae<-20)mistakes.push('position endured deep adverse excursion');
  const verdict=p.pnl>0?(mistakes.length?'profitable but imperfect':'clean win'):(p.mfe>25?'exit/management failure candidate':'entry thesis failure candidate');
  return{ts:now(),strategy:d.id,strategyName:d.name,mint:t.mint,symbol:t.symbol,pnlPct:p.pnlPct,mfe:p.mfe,mae:p.mae,why:p.why,verdict,strengths,mistakes};
}

function updateCounterfactuals(t){
  for(const p of trades){if(p.mint!==t.mint||!p.closedAt||!p.counterfactual)continue;const mins=(now()-p.closedAt)/60000;const after=p.exit?pct(t.price,p.exit):0;p.counterfactual.bestObservedAfterExit=Math.max(p.counterfactual.bestObservedAfterExit??after,after);
    if(mins>=1&&p.counterfactual.holdAfterExit.oneMin==null)p.counterfactual.holdAfterExit.oneMin=after;
    if(mins>=5&&p.counterfactual.holdAfterExit.fiveMin==null)p.counterfactual.holdAfterExit.fiveMin=after;
    if(mins>=15&&p.counterfactual.holdAfterExit.fifteenMin==null)p.counterfactual.holdAfterExit.fifteenMin=after;
  }
}

function ingest(raw,source){
  const incoming=normalize(raw,source);if(!incoming||!(incoming.price>0))return;
  const old=tokens.get(incoming.mint);const t=mergeToken(old,incoming);tokens.set(t.mint,t);updateCreator(t);updateOpportunities(t);updateOpenPositionExtremes(t);updateCounterfactuals(t);
  if(!old)log('token',`🪙 LIVE token spotted: $${t.symbol} · ${t.name}`,'info',{mint:t.mint,source});
  maybeTrade(t);broadcast('tick',{mint:t.mint});
}

async function fetchJson(url){const r=await fetch(url,{headers:{accept:'application/json','user-agent':'PUMP-LAB-LIVE/0.9'}});if(!r.ok)throw Error(`HTTP ${r.status}`);return r.json();}
async function pumpPoll(){
  try{const u='https://frontend-api-v3.pump.fun/coins?offset=0&limit=60&sort=created_timestamp&order=DESC&includeNsfw=false';const j=await fetchJson(u);const rows=Array.isArray(j)?j:(j.data||j.coins||[]);if(!rows.length)throw Error('no rows');rows.forEach(x=>ingest(x,'pump.fun'));setHealth('pump.fun','ok',`Live launch/state snapshots · ${rows.length} coins`,{truth:'observed'});}catch(e){setHealth('pump.fun','warn',`Snapshot feed unavailable: ${e.message}`);}
}
async function dexPoll(){
  try{
    const prof=await fetchJson('https://api.dexscreener.com/token-profiles/latest/v1');
    const boosts=await fetchJson('https://api.dexscreener.com/token-boosts/latest/v1');
    const items=[...(Array.isArray(prof)?prof:[]),...(Array.isArray(boosts)?boosts:[])].filter(x=>x.chainId==='solana');
    const addrs=[...new Set(items.map(x=>x.tokenAddress).filter(Boolean))].slice(0,30);if(!addrs.length)throw Error('no Solana profiles');
    const pairs=await fetchJson('https://api.dexscreener.com/tokens/v1/solana/'+addrs.join(','));
    const best=new Map();for(const p of (Array.isArray(pairs)?pairs:[])){const a=p.baseToken?.address;if(!a)continue;const cur=best.get(a);if(!cur||(p.liquidity?.usd||0)>(cur.liquidity?.usd||0))best.set(a,p);}
    let n=0;for(const [a,p] of best){const meta=items.find(x=>x.tokenAddress===a)||{};ingest({...p,mint:a,image:meta.icon,boostAmount:meta.totalAmount||meta.amount||0,website:meta.links?.find(x=>x.url)?.url},'dexscreener');n++;}
    setHealth('dexscreener','ok',`Batch enrichment · ${n} Solana tokens`,{truth:'observed'});
  }catch(e){setHealth('dexscreener','warn',`Enrichment unavailable: ${e.message}`);}
}
function connectPumpPortal(){
  if(!PUMP_KEY){setHealth('pumpportal','standby','API key not connected · free realtime launch/migration stream available once added',{truth:'not connected'});return;}
  try{
    const ws=new WebSocket('wss://pumpportal.fun/api/data?api-key='+encodeURIComponent(PUMP_KEY));
    ws.addEventListener('open',()=>{setHealth('pumpportal','ok',`Realtime websocket connected · metered trades ${ALLOW_METERED?'ON':'OFF'}`,{truth:'observed'});ws.send(JSON.stringify({method:'subscribeNewToken'}));ws.send(JSON.stringify({method:'subscribeMigration'}));});
    ws.addEventListener('message',ev=>{try{ingest(JSON.parse(String(ev.data)),'pumpportal');}catch{}});
    ws.addEventListener('close',()=>{setHealth('pumpportal','warn','Disconnected; reconnect scheduled');setTimeout(connectPumpPortal,5000);});
    ws.addEventListener('error',()=>setHealth('pumpportal','warn','Websocket error'));
  }catch(e){setHealth('pumpportal','warn',e.message);}
}


function queueSolanaSignature(sig){
  if(!sig||solanaSeen.has(sig))return;
  solanaSeen.add(sig); if(solanaSeen.size>5000){const first=solanaSeen.values().next().value;solanaSeen.delete(first);}
  solanaQueue.push(sig); if(solanaQueue.length>300)solanaQueue.shift(); solanaObserved++;
}
function connectSolanaStream(){
  try{
    solanaWs=new WebSocket(SOLANA_RPC_WSS);
    solanaWs.addEventListener('open',()=>{
      const watched=[...WATCHED_WALLET_LOOKUP.keys()];solanaSubAcks=0;
      setHealth('solana-stream','ok',`WebSocket open · requesting Pump.fun + ${watched.length} Fomo wallet subscriptions`,{truth:'observed'});
      setHealth('fomo-watchlist','standby',`Waiting for ${watched.length} verified wallet subscription acknowledgements`,{truth:'observed'});
      solanaWs.send(JSON.stringify({jsonrpc:'2.0',id:901,method:'logsSubscribe',params:[{mentions:[PUMP_PROGRAM]},{commitment:'confirmed'}]}));
      watched.forEach((address,i)=>solanaWs.send(JSON.stringify({jsonrpc:'2.0',id:1000+i,method:'logsSubscribe',params:[{mentions:[address]},{commitment:'confirmed'}]})));
      console.log(`Solana WS open · requested ${1+watched.length} subscriptions`);
    });
    solanaWs.addEventListener('message',ev=>{try{
      const m=JSON.parse(String(ev.data));
      if(m?.error){const msg=m.error?.message||'unknown subscription error';setHealth('solana-stream','warn','Subscription error: '+msg,{truth:'observed'});console.warn('Solana subscription error',m.error);return;}
      if(m?.result!==undefined&&Number.isInteger(m?.id)&&m.id>=901){
        solanaSubAcks++;
        const watched=WATCHED_WALLET_LOOKUP.size;
        if(m.id>=1000)setHealth('fomo-watchlist','ok',`${Math.min(watched,Math.max(0,solanaSubAcks-1))}/${watched} verified wallet streams acknowledged`,{truth:'observed'});
        if(solanaSubAcks>=1+watched)setHealth('solana-stream','ok',`Pump.fun + ${watched} Fomo wallet subscriptions acknowledged`,{truth:'observed'});
        return;
      }
      const sig=m?.params?.result?.value?.signature;if(sig)queueSolanaSignature(sig);
    }catch{}});
    solanaWs.addEventListener('close',()=>{setHealth('solana-stream','warn','Solana websocket disconnected · reconnecting',{truth:'observed'});setTimeout(connectSolanaStream,5000);});
    solanaWs.addEventListener('error',()=>setHealth('solana-stream','warn','Solana websocket error',{truth:'observed'}));
  }catch(e){setHealth('solana-stream','warn','Solana stream setup failed: '+e.message,{truth:'observed'});}
}
async function rpcTransaction(sig){
  const r=await fetch(SOLANA_RPC_HTTP,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({jsonrpc:'2.0',id:1,method:'getTransaction',params:[sig,{commitment:'confirmed',encoding:'jsonParsed',maxSupportedTransactionVersion:0}]})});
  if(!r.ok)throw Error('RPC '+r.status); const j=await r.json(); return j.result||null;
}
function uiAmt(x){return num(x?.uiTokenAmount?.uiAmountString??x?.uiTokenAmount?.uiAmount??0);}
function keyText(k){return typeof k==='string'?k:(k?.pubkey||'');}
function solDeltaFor(tx,wallet){
  const keys=tx?.transaction?.message?.accountKeys||[];const i=keys.findIndex(k=>keyText(k)===wallet);
  if(i<0)return 0;const pre=tx?.meta?.preBalances?.[i],post=tx?.meta?.postBalances?.[i];
  return Number.isFinite(pre)&&Number.isFinite(post)?(post-pre)/1e9:0;
}
function parseWalletTx(sig,tx){
  const keys=tx?.transaction?.message?.accountKeys||[]; const signerKeys=keys.filter(k=>typeof k==='object'&&k.signer).map(k=>k.pubkey);
  if(!signerKeys.length&&typeof keys[0]==='string')signerKeys.push(keys[0]);
  const allKeys=new Set(keys.map(keyText).filter(Boolean));const hasPump=allKeys.has(PUMP_PROGRAM);
  const pre=tx?.meta?.preTokenBalances||[], post=tx?.meta?.postTokenBalances||[];
  const idx=new Map();
  for(const b of pre){const k=(b.owner||'')+':'+b.mint;idx.set(k,{owner:b.owner,mint:b.mint,pre:uiAmt(b),post:0});}
  for(const b of post){const k=(b.owner||'')+':'+b.mint;const x=idx.get(k)||{owner:b.owner,mint:b.mint,pre:0,post:0};x.post=uiAmt(b);idx.set(k,x);}
  let found=0;
  for(const x of idx.values()){
    if(!x.owner||!signerKeys.includes(x.owner))continue; const delta=x.post-x.pre;if(Math.abs(delta)<1e-12)continue;
    const tok=tokens.get(x.mint);const watch=WATCHED_WALLET_LOOKUP.get(x.owner);const solDelta=solDeltaFor(tx,x.owner);
    let action=delta>0?'BUY':'SELL',classification='token-balance delta';
    if(watch&&!hasPump){
      if(delta>0&&solDelta>=-.0001)action='TOKEN_IN';
      if(delta<0&&solDelta<=.0001)action='TOKEN_OUT';
      classification=(action==='BUY'||action==='SELL')?'token + native SOL delta':'direction observed; trade not yet proven';
    }else if(hasPump)classification='Pump.fun program + token delta';
    const event={ts:now(),blockTime:tx?.blockTime?tx.blockTime*1000:null,slot:tx?.slot||null,signature:sig,wallet:x.owner,mint:x.mint,symbol:tok?.symbol||x.mint.slice(0,5),action,tokenDelta:delta,solDelta,price:tok?.price||0,mc:tok?.mc||0,classification,source:'Solana RPC',watchlist:!!watch,traderId:watch?.traderId||null,traderName:watch?.traderName||null,walletLabel:watch?.label||null};
    walletEvents.unshift(event);walletEvents.splice(1200); found++;
    if(watch)log('smart-wallet',`👀 ${watch.traderName} · ${action} · ${event.symbol}`,'info',{traderId:watch.traderId,wallet:x.owner,mint:x.mint,signature:sig});
    if(tok){tok.chainBuys=num(tok.chainBuys)+(action==='BUY'?1:0);tok.chainSells=num(tok.chainSells)+(action==='SELL'?1:0);tok.chainTx=num(tok.chainTx)+1;tok.lastChainAt=now();}
  }
  if(found)solanaResolved++;
}
async function drainSolanaQueue(){
  const sig=solanaQueue.shift(); if(!sig)return;
  try{const tx=await rpcTransaction(sig);if(tx)parseWalletTx(sig,tx);setHealth('wallet-intel','ok',`Observed on-chain wallet activity · ${solanaResolved} resolved Pump transactions`,{truth:'observed'});}
  catch(e){if(/429/.test(e.message))setHealth('wallet-intel','warn','Public RPC rate limited · queue retained',{truth:'observed'});}
}
function walletLeaderboard(){
  const m=new Map();
  for(const e of walletEvents){let w=m.get(e.wallet);if(!w)w={wallet:e.wallet,buys:0,sells:0,events:0,mints:new Set(),marked:[],last:0};w.events++;w.mints.add(e.mint);w.last=Math.max(w.last,e.ts);if(e.action==='BUY'){w.buys++;if(e.price>0){const t=tokens.get(e.mint);if(t?.price>0)w.marked.push(pct(t.price,e.price));}}else w.sells++;m.set(e.wallet,w);}
  return [...m.values()].map(w=>({wallet:w.wallet,buys:w.buys,sells:w.sells,events:w.events,mints:w.mints.size,last:w.last,marked:w.marked.length?avg(w.marked):0,sample:w.marked.length,score:clamp(Math.log10(1+w.events)*22+Math.min(30,w.mints*3)+(w.marked.length?clamp(50+avg(w.marked),0,100)*.25:0))})).sort((a,b)=>b.score-a.score).slice(0,40);
}
function fomoWatchlistSnapshot(){
  return FOMO_WATCHLIST.map(trader=>{
    const ev=walletEvents.filter(e=>e.traderId===trader.id);
    const mints=new Set(ev.map(e=>e.mint));const buys=ev.filter(e=>e.action==='BUY'),sells=ev.filter(e=>e.action==='SELL');
    const marked=buys.map(e=>{const t=tokens.get(e.mint);return e.price>0&&t?.price>0?pct(t.price,e.price):null}).filter(Number.isFinite);
    return{id:trader.id,name:trader.name,status:trader.wallets.length?'tracking':'resolving',walletCount:trader.wallets.length,
      wallets:trader.wallets.map(w=>({address:w.address,label:w.label,confidence:w.confidence})),events:ev.length,buys:buys.length,sells:sells.length,
      directional:ev.filter(e=>e.action==='TOKEN_IN'||e.action==='TOKEN_OUT').length,tokens:mints.size,last:ev[0]?.ts||0,marked:marked.length?avg(marked):null,sample:marked.length};
  });
}

function missedMonsters(){return [...opportunities.values()].filter(o=>o.action==='REJECT'&&o.bestReturn>75).sort((a,b)=>b.bestReturn-a.bestReturn).slice(0,25);}
function savedMyAss(){return [...opportunities.values()].filter(o=>o.action==='REJECT'&&o.worstReturn<-55).sort((a,b)=>a.worstReturn-b.worstReturn).slice(0,25);}
function hallOfFame(){return trades.filter(t=>!t.strategy.includes('-c')).sort((a,b)=>b.pnlPct-a.pnlPct).slice(0,20);}
function worstTrades(){return trades.filter(t=>!t.strategy.includes('-c')).sort((a,b)=>a.pnlPct-b.pnlPct).slice(0,20);}
function creatorLeaderboard(){return [...creators.values()].map(c=>({...c,tokens:[...c.tokens]})).sort((a,b)=>b.launches-a.launches||b.bestPeakX-a.bestPeakX).slice(0,30);}


function productionTrades(){return trades.filter(t=>!t.strategy.includes('-c')&&!['random','volume'].includes(t.strategy));}
function avg(xs){return xs.length?xs.reduce((a,b)=>a+b,0)/xs.length:0;}
function bandStats(rows,getBand){
  const m=new Map();for(const r of rows){const k=getBand(r);if(!m.has(k))m.set(k,[]);m.get(k).push(r);}
  return [...m].map(([band,a])=>({band,n:a.length,avgPnl:avg(a.map(x=>x.pnlPct)),winRate:a.filter(x=>x.pnlPct>0).length/a.length*100,avgMfe:avg(a.map(x=>x.mfe||0)),avgMae:avg(a.map(x=>x.mae||0))})).sort((a,b)=>b.avgPnl-a.avgPnl);
}
function confidenceCalibration(){
  const rows=[...opportunities.values()].filter(o=>o.entered&&Number.isFinite(o.score)&&Number.isFinite(o.bestReturn));
  const defs=[[50,60],[60,70],[70,80],[80,90],[90,101]];
  return defs.map(([lo,hi])=>{const a=rows.filter(o=>o.score>=lo&&o.score<hi);return{band:`${lo}-${hi===101?'100':hi-1}`,n:a.length,hitRate:a.length?a.filter(o=>o.bestReturn>=25).length/a.length*100:0,avgBest:avg(a.map(o=>o.bestReturn)),avgWorst:avg(a.map(o=>o.worstReturn))};});
}
function entryLab(){
  const rows=productionTrades();
  return{
    score:bandStats(rows,t=>{const x=t.score||0;return x>=85?'85+':x>=75?'75-84':x>=65?'65-74':'<65';}),
    risk:bandStats(rows,t=>{const x=t.entryFeatures?.risk||0;return x<35?'risk <35':x<50?'risk 35-49':x<65?'risk 50-64':'risk 65+';}),
    age:bandStats(rows,t=>{const x=t.entryFeatures?.age||0;return x<2?'<2m':x<5?'2-5m':x<15?'5-15m':'15m+';})
  };
}
function exitLab(){
  const rows=productionTrades();const usable=rows.filter(t=>t.counterfactual);
  const hold=k=>avg(usable.map(t=>t.counterfactual?.holdAfterExit?.[k]).filter(Number.isFinite));
  const capture=usable.filter(t=>(t.mfe||0)>0).map(t=>Math.max(0,t.pnlPct)/Math.max(1,t.mfe)*100);
  return{n:usable.length,actual:avg(usable.map(t=>t.pnlPct)),avgMfe:avg(usable.map(t=>t.mfe||0)),capture:avg(capture),oneMin:hold('oneMin'),fiveMin:hold('fiveMin'),fifteenMin:hold('fifteenMin'),leftOnTable:avg(usable.map(t=>Math.max(0,(t.counterfactual?.bestObservedAfterExit||0))))};
}
function sizingLab(){
  const rows=productionTrades();const total=rows.reduce((a,t)=>a+(t.pnl||0),0);
  return[.5,1,1.5,2].map(mult=>({mult,totalPnl:total*mult,stressDrawdown:avg(rows.map(t=>Math.max(0,-t.pnlPct)*mult)),label:mult===1?'CURRENT':mult<1?'DEFENSIVE':'AGGRESSIVE'}));
}
function executionLab(){
  const rows=productionTrades().filter(t=>t.executionStress);
  const sum=k=>rows.reduce((a,t)=>a+(t.executionStress?.[k]||0),0);
  return{n:rows.length,easyAvg:avg(rows.map(t=>t.executionStress.easy)),realisticAvg:avg(rows.map(t=>t.executionStress.realistic)),nightmareAvg:avg(rows.map(t=>t.executionStress.nightmare)),easyTotal:sum('easy'),realisticTotal:sum('realistic'),nightmareTotal:sum('nightmare')};
}
function benchmarkStats(){
  strategyDefs.forEach(markEquity);
  const ids=['champion','professional','adaptive','random','volume','launchctl','socialctl'];
  return ids.map(id=>{const d=strategyDefs.find(x=>x.id===id);return{id,name:d.name,equity:d.equity,returnPct:(d.equity/START-1)*100,dd:d.dd,n:d.n,winRate:d.n?d.wins/d.n*100:0};});
}
function godBot(){
  const rows=productionTrades();const favorable=rows.filter(t=>(t.mfe||0)>0);
  const actual=favorable.reduce((a,t)=>a+Math.max(0,t.pnlPct),0),available=favorable.reduce((a,t)=>a+Math.max(0,t.mfe||0),0);
  const missed=[...opportunities.values()].filter(o=>o.action==='REJECT').sort((a,b)=>b.bestReturn-a.bestReturn)[0];
  const best=[...rows].sort((a,b)=>(b.mfe||0)-(a.mfe||0))[0];
  return{trades:rows.length,capture:available?actual/available*100:0,avgAvailable:avg(rows.map(t=>t.mfe||0)),bestTheoretical:best?{symbol:best.symbol,mfe:best.mfe,pnl:best.pnlPct}:null,biggestMiss:missed?{symbol:missed.symbol,bestReturn:missed.bestReturn,why:missed.why}:null};
}
function archetypeMemory(){
  const groups=new Map();for(const o of opportunities.values()){if(!Number.isFinite(o.bestReturn))continue;const key=`${o.narrative||'Memes'} · ${o.regime||'UNKNOWN'} · ${o.score>=80?'80+':o.score>=70?'70-79':'<70'}`;if(!groups.has(key))groups.set(key,[]);groups.get(key).push(o);}
  return[...groups].map(([name,a])=>({name,n:a.length,hitRate:a.filter(o=>o.bestReturn>=25).length/a.length*100,avgBest:avg(a.map(o=>o.bestReturn)),avgWorst:avg(a.map(o=>o.worstReturn))})).filter(x=>x.n>=3).sort((a,b)=>b.hitRate-a.hitRate||b.avgBest-a.avgBest).slice(0,15);
}


function strategyCorrelation(){
  if(now()-corrCache.ts<60000)return corrCache.rows;
  const cutoff=now()-6*3600000;
  const ids=strategyDefs.filter(d=>d.risk!=='CONTROL'&&!['adaptive','champion','professional'].includes(d.id)).map(d=>d.id);
  const sets=new Map(ids.map(id=>[id,new Set(decisions.filter(x=>x.ts>=cutoff&&x.action==='BUY'&&x.strategy===id).map(x=>x.mint))]));
  const rows=[];
  for(let i=0;i<ids.length;i++)for(let j=i+1;j<ids.length;j++){
    const a=sets.get(ids[i]),b=sets.get(ids[j]);const union=new Set([...a,...b]);if(union.size<3)continue;
    let inter=0;for(const x of a)if(b.has(x))inter++;
    rows.push({a:ids[i],b:ids[j],aName:strategyDefs.find(x=>x.id===ids[i])?.name||ids[i],bName:strategyDefs.find(x=>x.id===ids[j])?.name||ids[j],n:union.size,jaccard:inter/union.size*100,intersection:inter});
  }
  corrCache={ts:now(),rows:rows.sort((a,b)=>b.jaccard-a.jaccard)};return corrCache.rows;
}
function diversityWeight(id){
  const a=strategyCorrelation().filter(x=>x.a===id||x.b===id);if(!a.length)return 1;
  const c=avg(a.map(x=>x.jaccard))/100;return clamp(1-c*.45,.55,1.05);
}
function tokenDataQuality(t){
  const ageSec=Math.max(0,(now()-t.updatedAt)/1000);const sourceCount=(t.sources||[]).length;const tx=(t.buys||0)+(t.sells||0);
  const freshness=clamp(100-ageSec*2);const multi=sourceCount>=2?100:sourceCount?55:0;const market=clamp(features(t).liqScore*.65+Math.min(35,tx*1.5));
  return{score:clamp(freshness*.35+multi*.3+market*.35),freshness,sourceCount,ageSec,market,level:ageSec>90?'STALE':sourceCount>=2?'CROSS-CHECKED':'SINGLE SOURCE'};
}
function providerAudit(){
  const rows=[...health.values()].map(x=>{const ageSec=Math.max(0,(now()-x.ts)/1000);const live=x.status==='ok';const score=live?clamp(100-ageSec*1.5):(x.status==='standby'?25:10);return{...x,ageSec,score};});
  const counted=rows.filter(x=>!['x-social','wallet-intel'].includes(x.component));
  return{rows,overall:counted.length?avg(counted.map(x=>x.score)):0,stale:rows.filter(x=>x.status==='ok'&&x.ageSec>90).map(x=>x.component)};
}
function noTradeAlpha(){
  const a=[...opportunities.values()].filter(o=>o.action==='REJECT'&&now()-o.firstTs>5*60000);
  return{n:a.length,falseRejects:a.filter(o=>o.bestReturn>=50).length,correctAvoids:a.filter(o=>o.worstReturn<=-50).length,
    avgBest:avg(a.map(o=>o.bestReturn)),avgWorst:avg(a.map(o=>o.worstReturn)),
    falseRejectRate:a.length?a.filter(o=>o.bestReturn>=50).length/a.length*100:0,saveRate:a.length?a.filter(o=>o.worstReturn<=-50).length/a.length*100:0};
}
function chaosLab(){
  const a=productionTrades();if(!a.length)return{n:0,normal:0,doubleFees:0,latencyShock:0,missBest:0,missedTrades:0};
  const normal=avg(a.map(t=>t.pnlPct)),doubleFees=avg(a.map(t=>t.pnlPct-FEE_RATE*200));
  const latencyShock=avg(a.map(t=>t.pnlPct-(3+Math.min(10,(t.invested/Math.max(1000,(t.entryFeatures?.liqScore||20)*500))*100))));
  const sorted=[...a].sort((x,y)=>y.pnlPct-x.pnlPct),miss=Math.max(1,Math.floor(sorted.length*.1)),remaining=sorted.slice(miss);
  return{n:a.length,normal,doubleFees,latencyShock,missBest:avg(remaining.map(t=>t.pnlPct)),missedTrades:miss};
}
function takeReplay(){
  const active=[...tokens.values()].filter(t=>now()-t.updatedAt<180000).sort((a,b)=>b.vol-a.vol).slice(0,24).map(t=>({mint:t.mint,symbol:t.symbol,name:t.name,price:t.price,mc:t.mc,narrative:t.narrative,score:features(t).score,risk:features(t).risk,quality:tokenDataQuality(t).score}));
  replayFrames.push({ts:now(),weather:marketWeather(),tokens:active,narratives:narrativeStats().slice(0,8)});while(replayFrames.length>240)replayFrames.shift();
}

function holdTimeLab(){
  const rows=productionTrades().map(t=>({...t,holdMin:(t.closedAt-t.opened)/60000}));
  return bandStats(rows,t=>t.holdMin<3?'<3m':t.holdMin<10?'3-10m':t.holdMin<30?'10-30m':'30m+');
}
function coalitionStats(){
  const byMint=new Map();for(const d of decisions){if(d.action!=='BUY'||['random','volume','launchctl','socialctl'].includes(d.strategy)||d.strategy.includes('-c'))continue;if(!byMint.has(d.mint))byMint.set(d.mint,[]);byMint.get(d.mint).push(d);}
  const pairs=new Map();
  for(const [mint,a0] of byMint){const a=[...new Map(a0.map(x=>[x.strategy,x])).values()].sort((x,y)=>x.ts-y.ts);for(let i=0;i<a.length;i++)for(let j=i+1;j<a.length;j++){if(Math.abs(a[i].ts-a[j].ts)>120000)continue;const ids=[a[i].strategy,a[j].strategy].sort();const key=ids.join('+');const o1=opportunities.get(a[i].strategy+':'+mint),o2=opportunities.get(a[j].strategy+':'+mint);const best=Math.max(o1?.bestReturn||0,o2?.bestReturn||0),worst=Math.min(o1?.worstReturn||0,o2?.worstReturn||0);if(!pairs.has(key))pairs.set(key,[]);pairs.get(key).push({best,worst});}}
  return[...pairs].map(([pair,a])=>({pair,n:a.length,hitRate:a.filter(x=>x.best>=25).length/a.length*100,avgBest:avg(a.map(x=>x.best)),avgWorst:avg(a.map(x=>x.worst))})).filter(x=>x.n>=2).sort((a,b)=>b.hitRate-a.hitRate||b.avgBest-a.avgBest).slice(0,15);
}
function regimeMatrix(){
  const regimes=['HOT','SELECTIVE','RISK OFF'];return regimes.map(regime=>{const rows=strategyDefs.filter(d=>d.risk!=='CONTROL').map(d=>{const a=trades.filter(t=>t.strategy===d.id&&(t.entryRegime||'UNKNOWN')===regime);return{name:d.name,id:d.id,n:a.length,avgPnl:avg(a.map(t=>t.pnlPct)),winRate:a.length?a.filter(t=>t.pnlPct>0).length/a.length*100:0};}).filter(x=>x.n>0).sort((a,b)=>b.avgPnl-a.avgPnl);return{regime,leaders:rows.slice(0,5)};});
}
function masterAllocation(){
  const regime=marketWeather().regime;const peers=strategyDefs.filter(d=>d.risk!=='CONTROL'&&!['adaptive','champion','professional'].includes(d.id));
  const raw=peers.map(d=>({id:d.id,name:d.name,weight:strategyRegimeWeight(d.id,regime)}));const sum=raw.reduce((a,x)=>a+x.weight,0)||1;
  return{regime,weights:raw.map(x=>({...x,pct:x.weight/sum*100})).sort((a,b)=>b.pct-a.pct).slice(0,10)};
}
function riskScoreboard(){
  strategyDefs.forEach(markEquity);return strategyDefs.filter(d=>d.risk!=='CONTROL').map(d=>{const ret=(d.equity/START-1)*100;const rows=trades.filter(t=>t.strategy===d.id);const losses=rows.filter(t=>t.pnlPct<0);const avgLoss=Math.abs(avg(losses.map(t=>t.pnlPct)));const riskAdjusted=ret/Math.max(5,d.dd||0);const ruinProxy=clamp((d.dd||0)*1.4+avgLoss*.7+(d.risk==='EXTREME'?12:d.risk==='HIGH'?6:0));return{id:d.id,name:d.name,ret,dd:d.dd,riskAdjusted,ruinProxy,n:d.n};}).sort((a,b)=>b.riskAdjusted-a.riskAdjusted);
}
function tournament(){
  const since=now()-24*3600000;const map=new Map();for(const t of trades.filter(t=>t.closedAt>=since&&!t.strategy.includes('-c'))){if(!map.has(t.strategy))map.set(t.strategy,{pnl:0,n:0,wins:0});const x=map.get(t.strategy);x.pnl+=t.pnl||0;x.n++;if(t.pnl>0)x.wins++;}
  return[...map].map(([id,x])=>{const d=strategyDefs.find(q=>q.id===id);return{id,name:d?.name||id,pnl:x.pnl,n:x.n,winRate:x.n?x.wins/x.n*100:0};}).sort((a,b)=>b.pnl-a.pnl);
}

function evaluateEvolution(){
  for(const c of challengers){const p=strategyDefs.find(x=>x.id===c.parentId);if(!p||c.n<50)continue;markEquity(c);markEquity(p);const edge=c.equity-p.equity;
    if(!c.promotedAt&&edge>125&&c.dd<=p.dd+5){p.min=c.min;p.stop=c.stop;p.take=c.take;if(c.riskCap)p.riskCap=c.riskCap;p.version=(p.version||1)+1;c.promotedAt=now();const row={ts:now(),child:c.name,parent:p.name,edge,sample:c.n,newVersion:p.version};promotions.unshift(row);promotions.splice(100);log('evolution',`🏆 ${c.name} promoted into ${p.name} v${p.version}`,'system',row);}
    else if(!c.graveyardAt&&edge<-100){c.graveyardAt=now();const row={ts:now(),child:c.name,parent:p.name,edge,sample:c.n,reason:'failed forward challenge'};graveyard.unshift(row);graveyard.splice(100);log('evolution',`☠️ ${c.name} moved to the Strategy Graveyard`,'system',row);}
  }
}
function familyTree(){return strategyDefs.filter(p=>p.risk!=='CONTROL').map(p=>({parent:p.name,version:p.version||1,children:challengers.filter(c=>c.parentId===p.id).map(c=>({name:c.name,n:c.n,equity:c.equity,dd:c.dd,promotedAt:c.promotedAt||0,graveyardAt:c.graveyardAt||0,mutation:c.mutation}))})).filter(x=>x.children.length);}


function spawnResearchChallenger(){
  const active=challengers.filter(c=>!c.promotedAt&&!c.graveyardAt);if(active.length>=8||challengers.length>=30)return null;
  strategyDefs.filter(d=>d.risk!=='CONTROL').forEach(markEquity);
  const exit=exitLab(),noTrade=noTradeAlpha(),risk=riskScoreboard();
  let parentId='momentum',mutation='longer winners',mods={takeDelta:15};
  if(noTrade.n>=20&&noTrade.falseRejectRate>20){parentId='quant';mutation='looser entry threshold from missed-monster evidence';mods={minDelta:-3,takeDelta:5};}
  else if(risk[0]&&risk[0].dd>25){parentId='professional';mutation='defensive drawdown response';mods={minDelta:3,stopDelta:-3,riskCap:34};}
  else if(exit.n>=10&&exit.capture>70){parentId='smartmom';mutation='tighter profit capture';mods={takeDelta:-8,minDelta:2};}
  const duplicate=challengers.find(c=>c.parentId===parentId&&c.mutation===mutation&&!c.graveyardAt);if(duplicate)return null;
  const seq=challengers.filter(c=>c.parentId===parentId).length+1,id=`${parentId}-auto-${seq}`;
  const p=strategyDefs.find(x=>x.id===parentId),c=makeChallenger(parentId,id,`${p.name} Mutation ${seq}`,mutation,mods);c.bornAt=now();c.auto=true;challengers.push(c);
  log('evolution',`🧬 Research Director spawned ${c.name}: ${mutation}`,'system',{parentId,id,mods});return c;
}

function researchCycle(){
  evaluateEvolution();
  spawnResearchChallenger();
  const recent=trades.filter(t=>now()-t.closedAt<3600000&&!t.strategy.includes('-c'));const wins=recent.filter(t=>t.pnl>0);const avg=recent.length?recent.reduce((a,t)=>a+t.pnlPct,0)/recent.length:0;
  const prod=strategyDefs.filter(d=>d.risk!=='CONTROL');prod.forEach(markEquity);const best=[...prod].sort((a,b)=>b.equity-a.equity)[0];
  const misses=missedMonsters().slice(0,5);const hypotheses=[];
  if(misses.length>=3)hypotheses.push('Rejection thresholds may be too strict for a subset of high-upside tokens; keep testing with challengers rather than relaxing production rules.');
  const badExit=trades.filter(t=>t.counterfactual?.bestObservedAfterExit>35&&t.pnlPct<20).slice(0,10);if(badExit.length>=3)hypotheses.push('Several exits left large continuation on the table; longer-hold challenger variants deserve more sample.');
  const weather=marketWeather();const ex=exitLab();if(ex.n>=5&&ex.capture<45)hypotheses.push('Exit capture is below 45% of observed favorable excursion; prioritize longer-hold exit challengers.');const cal=confidenceCalibration().filter(x=>x.n>=5);if(cal.length&&cal.at(-1)?.hitRate<cal[0]?.hitRate)hypotheses.push('High confidence buckets are not yet better calibrated than lower buckets; confidence scores need more evidence.');if(weather.regime==='RISK OFF')hypotheses.push('Current regime is risk-off; compare defensive strategies against momentum before expanding exposure.');
  research={last:now(),notes:[`${recent.length} production exits this hour · ${recent.length?((wins.length/recent.length)*100).toFixed(0):0}% win rate · avg ${avg.toFixed(1)}% · leader ${best?.name||'n/a'}`,'Production strategies remain stable. Challengers use separate paper capital and cannot silently rewrite the incumbent.'],hypotheses};
  log('research','🧪 Research Director completed an hourly review','system',{hypotheses:hypotheses.length});
}

function experimentSnapshot(){
  return challengers.map(c=>{markEquity(c);const p=strategyDefs.find(x=>x.id===c.parentId);markEquity(p);const sample=c.n;const edge=c.equity-p.equity;let status='COLLECTING';if(sample>=25&&edge>50&&c.dd<=p.dd+8)status='PROMOTION CANDIDATE';else if(sample>=25&&edge<-50)status='GRAVEYARD CANDIDATE';return{id:c.id,name:c.name,parent:p.name,mutation:c.mutation,equity:c.equity,parentEquity:p.equity,edge,sample,dd:c.dd,status};});
}

function takeTimeline(){const w=marketWeather();strategyDefs.forEach(markEquity);timeline.push({ts:now(),regime:w.regime,temperature:w.temperature,capital:strategyDefs.filter(x=>x.risk!=='CONTROL').reduce((a,d)=>a+d.equity,0),champion:strategyDefs.find(x=>x.id==='champion').equity,tokens:tokens.size,topNarrative:narrativeStats()[0]?.name||'n/a'});while(timeline.length>MAX_TIMELINE)timeline.shift();}

async function initDb(){
  if(!DATABASE_URL){setHealth('research-memory','standby','Render Postgres provisioned but DATABASE_URL is not attached to this service yet',{truth:'not connected'});return;}
  try{const {Client}=await import('pg');db=new Client({connectionString:DATABASE_URL,ssl:DATABASE_URL.includes('render.com')?{rejectUnauthorized:false}:undefined});await db.connect();await db.query('CREATE TABLE IF NOT EXISTS pump_lab_state (id text primary key, payload jsonb not null, updated_at timestamptz default now())');const r=await db.query("SELECT payload FROM pump_lab_state WHERE id='main'");if(r.rows[0]?.payload)restore(r.rows[0].payload);setHealth('research-memory','ok','Postgres durable memory online',{truth:'observed'});}catch(e){db=null;setHealth('research-memory','warn','Postgres connection failed: '+e.message);}
}
function serialize(){return{strategies:strategyDefs.map(stripTrader),challengers:challengers.map(stripTrader),positions,trades,activity,decisions,opportunities:[...opportunities],research,timeline,replayFrames,autopsies,promotions,graveyard,walletEvents:walletEvents.slice(0,1200),creators:[...creators].map(([k,v])=>[k,{...v,tokens:[...v.tokens]}])};}
function stripTrader(d){return{id:d.id,name:d.name,icon:d.icon,risk:d.risk,type:d.type,parentId:d.parentId,mutation:d.mutation,auto:d.auto,bornAt:d.bornAt,cash:d.cash,peak:d.peak,dd:d.dd,wins:d.wins,losses:d.losses,n:d.n,version:d.version,min:d.min,stop:d.stop,take:d.take,size:d.size,maxOpen:d.maxOpen,riskCap:d.riskCap,promotedAt:d.promotedAt,graveyardAt:d.graveyardAt};}
function restore(s){try{for(const x of s.strategies||[]){const d=strategyDefs.find(q=>q.id===x.id);if(d)Object.assign(d,x)}for(const x of s.challengers||[]){let d=challengers.find(q=>q.id===x.id);if(!d&&x.parentId&&strategyDefs.some(q=>q.id===x.parentId)){d=makeChallenger(x.parentId,x.id,x.name||x.id,x.mutation||'restored mutation',{});challengers.push(d)}if(d)Object.assign(d,x)}positions.splice(0,positions.length,...(s.positions||[]));trades.splice(0,trades.length,...(s.trades||[]));activity.splice(0,activity.length,...(s.activity||[]));decisions.splice(0,decisions.length,...(s.decisions||[]));opportunities.clear();for(const [k,v] of s.opportunities||[])opportunities.set(k,v);research=s.research||research;timeline.splice(0,timeline.length,...(s.timeline||[]));replayFrames.splice(0,replayFrames.length,...(s.replayFrames||[]));autopsies.splice(0,autopsies.length,...(s.autopsies||[]));promotions.splice(0,promotions.length,...(s.promotions||[]));graveyard.splice(0,graveyard.length,...(s.graveyard||[]));walletEvents.splice(0,walletEvents.length,...(s.walletEvents||[]));creators.clear();for(const [k,v] of s.creators||[])creators.set(k,{...v,tokens:new Set(v.tokens||[])});}catch{}}
async function save(){const s=serialize();try{fs.writeFileSync(STATE_FILE,JSON.stringify(s));}catch{}if(db){try{await db.query("INSERT INTO pump_lab_state(id,payload,updated_at) VALUES('main',$1,now()) ON CONFLICT(id) DO UPDATE SET payload=$1,updated_at=now()",[s]);}catch(e){setHealth('research-memory','warn','Postgres save failed: '+e.message);}}}
function loadLocal(){try{restore(JSON.parse(fs.readFileSync(STATE_FILE,'utf8')));}catch{}}

function snapshot(){
  allTraders().forEach(markEquity);const active=[...tokens.values()].filter(t=>now()-t.updatedAt<900000).sort((a,b)=>b.updatedAt-a.updatedAt).slice(0,80).map(t=>({...t,features:features(t),detective:detective(t),consensus:consensus(t),dna:creatorDNA(t),quality:tokenDataQuality(t)}));
  const prod=strategyDefs.filter(d=>d.risk!=='CONTROL');const weather=marketWeather();
  return{now:now(),startedAt,paperOnly:true,mode:'LIVE ONLY',version:'1.1 Fomo Smart Wallets',target:TARGET,weather,providers:[...health.values()],
    summary:{capital:prod.reduce((a,d)=>a+d.equity,0),start:prod.length*START,trades:prod.reduce((a,d)=>a+d.n,0),open:positions.filter(p=>!p.closed&&prod.some(d=>d.id===p.strategy)).length,tokens:tokens.size,decisions:decisions.length},
    strategies:strategyDefs.map(d=>({...d,winRate:d.n?d.wins/d.n*100:0,open:openCount(d.id)})),experiments:experimentSnapshot(),tokens:active,
    narratives:narrativeStats().slice(0,15),creators:creatorLeaderboard(),positions:positions.filter(p=>!p.closed).slice(-120),trades:trades.slice(0,150),activity:activity.slice(0,140),research,
    missed:missedMonsters(),saved:savedMyAss(),hall:hallOfFame(),worst:worstTrades(),autopsies:autopsies.slice(0,30),timeline:timeline.slice(-120),decisions:decisions.slice(0,160),calibration:confidenceCalibration(),entryLab:entryLab(),exitLab:exitLab(),sizingLab:sizingLab(),executionLab:executionLab(),benchmarks:benchmarkStats(),godBot:godBot(),archetypes:archetypeMemory(),evolution:{family:familyTree(),promotions:promotions.slice(0,20),graveyard:graveyard.slice(0,20)},holdTime:holdTimeLab(),coalitions:coalitionStats(),correlation:strategyCorrelation().slice(0,20),regimeMatrix:regimeMatrix(),masterAllocation:masterAllocation(),riskBoard:riskScoreboard(),tournament:tournament(),providerAudit:providerAudit(),noTrade:noTradeAlpha(),chaos:chaosLab(),replay:replayFrames.slice(-120),walletBoard:walletLeaderboard(),fomoWatchlist:fomoWatchlistSnapshot(),fomoEvents:walletEvents.filter(e=>e.watchlist).slice(0,100),solana:{observed:solanaObserved,resolved:solanaResolved,queued:solanaQueue.length,watchedWallets:WATCHED_WALLET_LOOKUP.size,subscriptionAcks:solanaSubAcks}};
}

const HTML=`<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>PUMP LAB / LIVE</title><style>
:root{--bg:#07090d;--card:#0f141d;--card2:#121925;--line:#253045;--muted:#8ea0bc;--text:#f4f7fb;--green:#4ff5a2;--red:#ff6d86;--blue:#7588ff;--amber:#ffcc66}*{box-sizing:border-box}body{margin:0;background:radial-gradient(circle at 50% -20%,#182136 0,#080b11 35%,#06080c 72%);color:var(--text);font:14px Inter,ui-sans-serif,system-ui,-apple-system,sans-serif}.wrap{max-width:1560px;margin:auto;padding:22px 28px 60px}.top{display:flex;justify-content:space-between;gap:18px;align-items:center}.brand{font-size:27px;font-weight:950;letter-spacing:-1.1px}.sub{color:#8bb0e8;font-size:13px;margin-top:2px}.badges{display:flex;gap:8px;flex-wrap:wrap;justify-content:flex-end}.badge,.pill{font-size:11px;border:1px solid #2c394f;padding:5px 8px;border-radius:99px;background:#111827}.live{border-color:#00dc70;color:#64f9aa;background:#071a13}.hero{margin-top:18px;padding:20px;border:1px solid #2a3850;border-radius:18px;background:linear-gradient(135deg,#121a27,#0d1119);display:grid;grid-template-columns:1.4fr 1fr;gap:18px}.big{font-size:28px;font-weight:900;letter-spacing:-.6px}.muted{color:var(--muted)}.green{color:var(--green)}.red{color:var(--red)}.amber{color:var(--amber)}.grid4{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin:14px 0}.card{background:linear-gradient(180deg,#10151e,#0c1119);border:1px solid var(--line);border-radius:14px;padding:14px;box-shadow:0 12px 30px #0002}.card h3{margin:0 0 9px;font-size:13px;color:#cbd6e8}.health{display:flex;gap:7px;flex-wrap:wrap}.health span{border:1px solid #29354a;padding:6px 9px;border-radius:8px;background:#0c121b}.tabs{display:flex;gap:8px;margin:16px 0;flex-wrap:wrap}.tab{padding:9px 13px;border-radius:9px;background:#111824;border:1px solid #293349;cursor:pointer}.tab.on{background:#f7f9fd;color:#080b10;border-color:#fff}.pane{display:none}.pane.on{display:block}.strategies{display:grid;grid-template-columns:repeat(3,1fr);gap:10px}.strategy .topline{display:flex;align-items:center;justify-content:space-between}.strategy .money{font-size:24px;font-weight:900;margin:7px 0}.mini{font-size:12px;color:#91a7c9}.two{display:grid;grid-template-columns:1.5fr 1fr;gap:12px}.three{display:grid;grid-template-columns:repeat(3,1fr);gap:12px}.feed{max-height:510px;overflow:auto}.feedrow{display:grid;grid-template-columns:95px 1fr;gap:10px;padding:9px 2px;border-bottom:1px solid #1c2534}.table{width:100%;border-collapse:collapse}.table th,.table td{padding:9px 7px;text-align:left;border-bottom:1px solid #1d2737;font-size:12px}.table th{color:#8fa4c3;font-weight:650;position:sticky;top:0;background:#0f141d}.scroll{max-height:560px;overflow:auto}.heatwrap{display:flex;gap:10px;flex-wrap:wrap;align-items:flex-end;min-height:190px}.bubble{display:flex;align-items:center;justify-content:center;border-radius:50%;border:1px solid #3a4967;background:radial-gradient(circle at 35% 30%,#26365b,#121827);text-align:center;font-size:11px;padding:9px}.meter{height:7px;background:#182131;border-radius:99px;overflow:hidden}.meter>i{display:block;height:100%;background:linear-gradient(90deg,#667cff,#4ff5a2)}.token{cursor:pointer}.token:hover{background:#141c29}.drawer{position:fixed;right:0;top:0;height:100vh;width:min(560px,96vw);background:#0a0f17;border-left:1px solid #2b3850;z-index:20;padding:20px;transform:translateX(102%);transition:.2s;overflow:auto;box-shadow:-25px 0 60px #0007}.drawer.on{transform:none}.close{float:right;border:1px solid #37445b;border-radius:9px;background:#111824;color:white;padding:6px 10px;cursor:pointer}.vote{display:inline-flex;gap:4px;align-items:center;padding:4px 7px;border-radius:7px;margin:3px;background:#121a27;border:1px solid #26354c}.vote.y{border-color:#16683f;color:#77f8ae}.vote.n{color:#a1aec2}.spark{width:100%;height:90px}.world{min-height:270px;display:flex;gap:12px;flex-wrap:wrap;align-items:center;justify-content:center}.worldGrid{display:grid;grid-template-columns:repeat(auto-fit,minmax(235px,1fr));gap:12px}.ecosystem{background:#0b111a;border:1px solid #253249;border-radius:14px;padding:12px;min-height:150px}.nodes{display:flex;gap:6px;flex-wrap:wrap;margin-top:9px}.worldNode{cursor:pointer;border:1px solid #2c3a51;background:#121b29;color:#dce8fa;border-radius:999px;padding:6px 9px;font-size:11px}.worldNode.hot{border-color:#1b7f50;color:#78f8b0}.worldNode.risky{border-color:#7b3043;color:#ff91a7}.worldNode:hover{transform:translateY(-1px);background:#182338}.smallcard{padding:10px;border:1px solid #253249;background:#0c121b;border-radius:10px}.sectionTitle{display:flex;justify-content:space-between;align-items:end;margin:18px 0 9px}.sectionTitle h2{margin:0;font-size:17px}.sectionTitle p{margin:0;color:#8497b4;font-size:12px}.truth{font-size:10px;text-transform:uppercase;letter-spacing:.5px;color:#8094b2}.controls{display:flex;gap:8px;align-items:center}select{background:#0f1621;color:white;border:1px solid #2a3850;border-radius:8px;padding:7px} @media(max-width:1050px){.strategies{grid-template-columns:1fr 1fr}.grid4,.three{grid-template-columns:1fr 1fr}.two,.hero{grid-template-columns:1fr}}@media(max-width:680px){.wrap{padding:16px}.strategies,.grid4,.three{grid-template-columns:1fr}.big{font-size:22px}.top{align-items:flex-start}.hideMobile{display:none}}
</style></head><body><div class="wrap"><div class="top"><div><div class="brand">PUMP LAB <span style="color:var(--blue)">/ LIVE</span></div><div class="sub">Autonomous Pump.fun & Solana paper-trading research laboratory</div></div><div class="badges"><span class="badge live">● REAL MARKET DATA</span><span class="badge">PAPER ONLY</span><span class="badge" id="version"></span></div></div>
<div class="hero"><div><div class="muted">CHAMPION CHALLENGE</div><div class="big" id="champ"></div><div class="muted" id="champMeta"></div><div class="meter" style="margin-top:12px"><i id="champBar"></i></div></div><div><div class="muted">MARKET WEATHER</div><div class="big" id="weather"></div><div class="mini" id="weatherMeta"></div></div></div>
<div class="grid4"><div class="card"><div class="muted">LAB CAPITAL</div><div class="big" id="capital"></div><div class="mini" id="capitalDelta"></div></div><div class="card"><div class="muted">PAPER EXITS</div><div class="big" id="tradeCount"></div><div class="mini" id="decisionCount"></div></div><div class="card"><div class="muted">OPEN POSITIONS</div><div class="big" id="open"></div><div class="mini">across production agents</div></div><div class="card"><div class="muted">TOKENS OBSERVED</div><div class="big" id="tokenCount"></div><div class="mini" id="uptime"></div></div></div>
<div class="card health" id="health"></div><div class="tabs" id="tabs"><div class="tab on" data-p="war">War Room</div><div class="tab" data-p="radar">Token Lab</div><div class="tab" data-p="intel">Intelligence</div><div class="tab" data-p="planet">The World</div><div class="tab" data-p="research">Research Lab</div><div class="tab" data-p="time">Time Machine</div></div>
<div class="pane on" id="war"><div class="sectionTitle"><h2>Autonomous Traders</h2><p>Same market. Same $1,000 start. Different personalities.</p></div><div class="strategies" id="strats"></div><div class="two" style="margin-top:12px"><div class="card"><h3>LIVE ACTIVITY</h3><div class="feed" id="feed"></div></div><div class="card"><h3>NARRATIVE RADAR</h3><div id="narrMini"></div></div></div></div>
<div class="pane" id="radar"><div class="two"><div class="card scroll"><table class="table"><thead><tr><th>Token</th><th>MC</th><th>Liq</th><th>Score</th><th>Risk</th><th>Quality</th><th>Consensus</th><th>Source</th></tr></thead><tbody id="tokenRows"></tbody></table></div><div class="card"><h3>DETECTIVE WATCH</h3><div id="detectiveList"></div></div></div></div>
<div class="pane" id="intel"><div class="card"><div class="sectionTitle"><h2>🌎 Narrative World</h2><p>Heat = momentum + buyer pressure + volume + fresh launches − saturation</p></div><div class="world" id="world"></div></div><div class="two" style="margin-top:12px"><div class="card scroll"><h3>CREATOR DNA · OBSERVED BY PUMP LAB</h3><table class="table"><thead><tr><th>Creator</th><th>Launches</th><th>Best X</th><th>Collapses</th><th>Graduations</th></tr></thead><tbody id="creators"></tbody></table></div><div class="card"><h3>DATA TRUTH</h3><div id="truth"></div></div></div><div class="card" style="margin-top:12px"><h3>👀 FOMO SMART-WALLET WATCHLIST</h3><div class="mini">Requested Fomo identities. Only corroborated public Solana mappings are subscribed; unresolved identities stay labeled resolving instead of being guessed.</div><div class="scroll"><table class="table"><thead><tr><th>Trader</th><th>Status</th><th>Wallets</th><th>Events</th><th>Buys</th><th>Sells</th><th>Tokens</th><th>Marked</th><th>Last</th></tr></thead><tbody id="fomoWatchlist"></tbody></table></div></div>
<div class="two" style="margin-top:12px"><div class="card"><h3>⚡ FOMO WATCHLIST · RECENT ON-CHAIN ACTIVITY</h3><div class="mini">BUY/SELL requires Pump.fun evidence or token + native SOL direction. Otherwise PUMP LAB reports TOKEN IN/OUT rather than inventing a trade.</div><div class="scroll"><table class="table"><thead><tr><th>Trader</th><th>Action</th><th>Token</th><th>Token Δ</th><th>SOL Δ</th><th>When</th></tr></thead><tbody id="fomoEvents"></tbody></table></div></div><div class="card"><h3>🔭 GLOBAL WALLET ACTIVITY · ON-CHAIN OBSERVED</h3><div class="mini">Direct Solana observations. Marked return is inferred from token price when first observed, not a claim of realized wallet P&L.</div><div class="scroll"><table class="table"><thead><tr><th>Wallet</th><th>Events</th><th>Buys</th><th>Sells</th><th>Tokens</th><th>Marked</th><th>Score</th></tr></thead><tbody id="walletBoard"></tbody></table></div></div></div></div>
<div class="pane" id="planet"><div class="card"><div class="sectionTitle"><h2>🌎 THE WORLD</h2><p>A live map of the token economy PUMP LAB can actually observe.</p></div><div id="worldStats" class="grid4"></div><div id="tokenWorld" class="worldGrid" style="margin-top:12px"></div></div><div class="two" style="margin-top:12px"><div class="card"><h3>🔥 WORLD LEADERS</h3><div id="worldLeaders"></div></div><div class="card"><h3>⚠️ WORLD RISKS</h3><div id="worldRisks"></div></div></div></div>
<div class="pane" id="research"><div class="three"><div class="card"><h3>🧪 CHALLENGERS</h3><div id="experiments"></div></div><div class="card"><h3>🚀 MISSED MONSTERS</h3><div id="missed"></div></div><div class="card"><h3>🛟 SAVED MY ASS</h3><div id="saved"></div></div></div><div class="two" style="margin-top:12px"><div class="card"><h3>🏆 HALL OF FAME</h3><div id="hall"></div></div><div class="card"><h3>🧬 TRADE AUTOPSIES</h3><div id="autopsies"></div></div></div><div class="card" style="margin-top:12px"><h3>RESEARCH DIRECTOR</h3><div id="researchText"></div></div>
<div class="three" style="margin-top:12px"><div class="card"><h3>🎯 CONFIDENCE CALIBRATION</h3><div id="calibration"></div></div><div class="card"><h3>🆚 BENCHMARKS</h3><div id="benchmarks"></div></div><div class="card"><h3>🧬 EVOLUTION</h3><div id="evolution"></div></div></div>
<div class="grid4" style="margin-top:12px"><div class="card"><h3>ENTRY LAB</h3><div id="entryLab"></div></div><div class="card"><h3>EXIT LAB</h3><div id="exitLab"></div></div><div class="card"><h3>SIZING LAB</h3><div id="sizingLab"></div></div><div class="card"><h3>EXECUTION STRESS</h3><div id="executionLab"></div></div></div>
<div class="two" style="margin-top:12px"><div class="card"><h3>👁 GOD BOT · UPPER BOUND</h3><div id="godBot"></div></div><div class="card"><h3>🧠 MARKET ARCHETYPE MEMORY</h3><div id="archetypes"></div></div></div>
<div class="card" style="margin-top:12px"><h3>☠️ STRATEGY GRAVEYARD / PROMOTIONS</h3><div id="graveyard"></div></div>
<div class="three" style="margin-top:12px"><div class="card"><h3>🧭 ADAPTIVE MASTER ALLOCATION</h3><div id="masterAllocation"></div></div><div class="card"><h3>🤝 SIGNAL COALITIONS</h3><div id="coalitions"></div></div><div class="card"><h3>⏱ HOLD-TIME LAB</h3><div id="holdTime"></div></div></div>
<div class="two" style="margin-top:12px"><div class="card"><h3>🌦 REGIME LEADERBOARD</h3><div id="regimeMatrix"></div></div><div class="card"><h3>🏁 24H GRAND PRIX / RISK BOARD</h3><div id="tournament"></div><hr style="border-color:#223047"><div id="riskBoard"></div></div></div>
<div class="three" style="margin-top:12px"><div class="card"><h3>🧬 SIGNAL INDEPENDENCE</h3><div id="correlation"></div></div><div class="card"><h3>🛡 NO-TRADE ALPHA</h3><div id="noTrade"></div></div><div class="card"><h3>🌪 CHAOS LAB</h3><div id="chaos"></div></div></div>
<div class="card" style="margin-top:12px"><h3>📡 DATA INTEGRITY</h3><div id="providerAudit"></div></div></div>
<div class="pane" id="time"><div class="card"><div class="sectionTitle"><h2>⏪ Time Machine</h2><p>Immutable periodic snapshots of what the lab knew then.</p></div><div class="controls"><select id="timeSelect"></select><span class="muted" id="timeView"></span></div><div id="timeCards" class="grid4"></div></div><div class="card" style="margin-top:12px"><h3>🎞 ROLLING MARKET REPLAY</h3><div id="marketReplay"></div></div><div class="card" style="margin-top:12px"><h3>TRUTH LEDGER · RECENT DECISIONS</h3><div class="scroll"><table class="table"><thead><tr><th>Time</th><th>Agent</th><th>Token</th><th>Decision</th><th>Score</th><th>Risk</th><th>Why</th></tr></thead><tbody id="ledger"></tbody></table></div></div></div>
</div><div class="drawer" id="drawer"><button class="close" onclick="closeDrawer()">Close</button><div id="drawerBody"></div></div><script>
const $=x=>document.getElementById(x);const money=n=>'$'+Number(n||0).toLocaleString(undefined,{maximumFractionDigits:0});const one=n=>Number(n||0).toFixed(1);let S=null;
function age(ms){const m=Math.max(0,Date.now()-ms)/60000;if(m<60)return m.toFixed(0)+'m';return(m/60).toFixed(1)+'h'}function esc(x){return String(x??'').replace(/[&<>]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[c]))}
function render(s){S=s;$('version').textContent=s.version;$('capital').textContent=money(s.summary.capital);$('capitalDelta').textContent=(s.summary.capital>=s.summary.start?'+':'')+money(s.summary.capital-s.summary.start)+' vs start';$('tradeCount').textContent=s.summary.trades;$('decisionCount').textContent=s.summary.decisions+' immutable decisions recorded';$('open').textContent=s.summary.open;$('tokenCount').textContent=s.summary.tokens;$('uptime').textContent='engine up '+age(s.startedAt);const c=s.strategies.find(x=>x.id==='champion');$('champ').textContent=money(c.equity)+' → $100,000 ('+(c.equity/100000*100).toFixed(2)+'%)';$('champMeta').textContent='P&L '+(c.equity>=1000?'+':'')+money(c.equity-1000)+' · max DD '+one(c.dd)+'% · '+c.n+' exits';$('champBar').style.width=Math.min(100,c.equity/100000*100)+'%';$('weather').textContent=s.weather.regime+' · '+one(s.weather.temperature)+'/100';$('weatherMeta').textContent='buy pressure '+one(s.weather.buyPressure)+'% · launch velocity '+one(s.weather.launchVelocity)+'/min · collapse rate '+one(s.weather.collapseRate)+'%';
$('health').innerHTML=s.providers.map(x=>'<span>'+esc(x.component)+': <b class="'+(x.status==='ok'?'green':x.status==='warn'?'amber':'')+'">'+esc(x.status)+'</b><small class="muted"> · '+esc(x.detail)+'</small></span>').join('');
$('strats').innerHTML=s.strategies.filter(x=>x.risk!=='CONTROL').sort((a,b)=>b.equity-a.equity).map((x,i)=>'<div class="card strategy"><div class="topline"><b>'+(i+1)+'. '+x.icon+' '+esc(x.name)+'</b><span class="pill">'+esc(x.risk)+'</span></div><div class="money '+(x.equity>=1000?'green':'red')+'">'+money(x.equity)+'</div><div class="mini">'+x.n+' exits · '+one(x.winRate)+'% wins · '+one(x.dd)+'% max DD · '+x.open+' open</div><div class="truth" style="margin-top:8px">'+esc(x.thesis)+'</div></div>').join('');
$('feed').innerHTML=s.activity.slice(0,90).map(x=>'<div class="feedrow"><span class="muted">'+new Date(x.ts).toLocaleTimeString()+'</span><span>'+esc(x.text)+'</span></div>').join('');
$('narrMini').innerHTML=s.narratives.slice(0,8).map(n=>'<div class="smallcard" style="margin:7px 0"><b>'+esc(n.name)+'</b><span style="float:right">'+one(n.heat)+'</span><div class="meter" style="margin:6px 0"><i style="width:'+n.heat+'%"></i></div><div class="mini">'+n.count+' tokens · '+one(n.buyPressure)+'% buys · '+n.recent+' fresh</div></div>').join('');
$('tokenRows').innerHTML=s.tokens.map(t=>'<tr class="token" data-mint="'+esc(t.mint)+'" onclick="openToken(this.dataset.mint)"><td><b>$'+esc(t.symbol)+'</b><br><span class="muted">'+esc(t.name)+'</span></td><td>'+money(t.mc)+'</td><td>'+money(t.liq)+'</td><td>'+one(t.features.score)+'</td><td class="'+(t.detective.score>65?'red':t.detective.score>45?'amber':'green')+'">'+one(t.detective.score)+'</td><td>'+one(t.quality.score)+'</td><td>'+t.consensus.yes+'/'+t.consensus.total+'</td><td class="muted">'+esc((t.sources||[]).join(' + '))+'</td></tr>').join('');
$('detectiveList').innerHTML=s.tokens.slice().sort((a,b)=>b.detective.score-a.detective.score).slice(0,10).map(t=>'<div class="smallcard" style="margin:7px 0"><b>$'+esc(t.symbol)+'</b><span style="float:right" class="'+(t.detective.score>65?'red':'amber')+'">'+esc(t.detective.verdict)+' '+one(t.detective.score)+'</span><div class="mini">'+esc((t.detective.flags||[]).slice(0,2).join(' · ')||'no major observed flags')+'</div></div>').join('');
$('world').innerHTML=s.narratives.map(n=>{const size=80+n.heat*1.1;return'<div class="bubble" style="width:'+size+'px;height:'+size+'px"><div><b>'+esc(n.name)+'</b><br><span class="green">'+one(n.heat)+'</span><br><small>'+n.count+' tokens</small></div></div>'}).join('');
const cross=s.tokens.filter(t=>t.quality?.sourceCount>=2).length,highConsensus=s.tokens.filter(t=>t.consensus?.yes>=5).length,risky=s.tokens.filter(t=>t.detective?.score>=70).length;
$('worldStats').innerHTML='<div class="smallcard"><span class="muted">ACTIVE</span><div class="big">'+s.tokens.length+'</div></div><div class="smallcard"><span class="muted">CROSS-CHECKED</span><div class="big">'+cross+'</div></div><div class="smallcard"><span class="muted">5+ AGENTS AGREE</span><div class="big">'+highConsensus+'</div></div><div class="smallcard"><span class="muted">HIGH RISK</span><div class="big">'+risky+'</div></div>';
$('tokenWorld').innerHTML=s.narratives.map(n=>{const ts=s.tokens.filter(t=>t.narrative===n.name).sort((a,b)=>b.features.score-a.features.score).slice(0,14);return'<div class="ecosystem"><div><b>'+esc(n.name)+'</b><span style="float:right" class="'+(n.heat>=65?'green':'muted')+'">heat '+one(n.heat)+'</span></div><div class="mini">'+n.count+' observed · '+one(n.buyPressure)+'% buy pressure · saturation '+one(n.saturation)+'</div><div class="nodes">'+ts.map(t=>'<button class="worldNode '+(t.detective.score>=70?'risky':t.features.score>=72?'hot':'')+'" data-mint="'+esc(t.mint)+'" onclick="openToken(this.dataset.mint)">&#36;'+esc(t.symbol)+' · '+one(t.features.score)+'</button>').join('')+'</div></div>'}).join('');
$('worldLeaders').innerHTML=s.tokens.slice().sort((a,b)=>b.features.score-a.features.score).slice(0,10).map((t,i)=>'<div class="smallcard" style="margin:6px 0"><b>'+(i+1)+'. &#36;'+esc(t.symbol)+'</b><span style="float:right" class="green">'+one(t.features.score)+'</span><div class="mini">'+esc(t.narrative)+' · Q'+one(t.quality.score)+' · '+t.consensus.yes+'/'+t.consensus.total+' agents</div></div>').join('');
$('worldRisks').innerHTML=s.tokens.slice().sort((a,b)=>b.detective.score-a.detective.score).slice(0,10).map(t=>'<div class="smallcard" style="margin:6px 0"><b>&#36;'+esc(t.symbol)+'</b><span style="float:right" class="red">'+one(t.detective.score)+'</span><div class="mini">'+esc((t.detective.flags||[]).slice(0,2).join(' · ')||'structural caution')+'</div></div>').join('');
$('fomoWatchlist').innerHTML=(s.fomoWatchlist||[]).map(w=>'<tr><td><b>'+esc(w.name)+'</b></td><td class="'+(w.status==='tracking'?'green':'amber')+'">'+esc(w.status.toUpperCase())+'</td><td>'+w.walletCount+'</td><td>'+w.events+'</td><td class="green">'+w.buys+'</td><td class="red">'+w.sells+'</td><td>'+w.tokens+'</td><td class="'+(w.marked==null?'muted':w.marked>=0?'green':'red')+'">'+(w.marked==null?'—':(w.marked>=0?'+':'')+one(w.marked)+'%')+'</td><td class="muted">'+(w.last?age(w.last):'—')+'</td></tr>').join('');
$('fomoEvents').innerHTML=(s.fomoEvents||[]).slice(0,40).map(e=>'<tr><td><b>'+esc(e.traderName||'Tracked')+'</b></td><td class="'+(e.action==='BUY'||e.action==='TOKEN_IN'?'green':'red')+'">'+esc(e.action)+'</td><td><b>&#36;'+esc(e.symbol)+'</b></td><td>'+Number(e.tokenDelta||0).toLocaleString(undefined,{maximumSignificantDigits:5})+'</td><td>'+(e.solDelta>=0?'+':'')+Number(e.solDelta||0).toFixed(4)+'</td><td class="muted">'+age(e.ts)+'</td></tr>').join('')||'<tr><td colspan="6" class="muted">Listening for the verified watchlist wallets…</td></tr>';
$('walletBoard').innerHTML=(s.walletBoard||[]).map(w=>'<tr><td><code>'+esc(w.wallet.slice(0,7))+'…'+esc(w.wallet.slice(-5))+'</code></td><td>'+w.events+'</td><td class="green">'+w.buys+'</td><td class="red">'+w.sells+'</td><td>'+w.mints+'</td><td class="'+(w.marked>=0?'green':'red')+'">'+(w.marked>=0?'+':'')+one(w.marked)+'%</td><td>'+one(w.score)+'</td></tr>').join('')||'<tr><td colspan="7" class="muted">Listening for Pump.fun on-chain wallet activity…</td></tr>';
$('creators').innerHTML=s.creators.map(c=>'<tr><td><code>'+esc(c.creator.slice(0,7))+'…'+esc(c.creator.slice(-5))+'</code></td><td>'+c.launches+'</td><td>'+one(c.bestPeakX)+'×</td><td>'+c.collapses+'</td><td>'+c.graduates+'</td></tr>').join('')||'<tr><td colspan="5" class="muted">Creator history is accumulating from observed launches.</td></tr>';
$('truth').innerHTML='<div class="smallcard"><b>OBSERVED</b><p class="mini">Pump.fun launch/state snapshots, DEX Screener prices/liquidity/volume, any connected PumpPortal events.</p></div><div class="smallcard" style="margin-top:8px"><b>INFERRED</b><p class="mini">Risk score, narrative heat, consensus, creator reputation and market regime are PUMP LAB models built from observed data.</p></div><div class="smallcard" style="margin-top:8px"><b>NOT CONNECTED YET</b><p class="mini">Full X firehose, holder concentration, unresolved wallet-cluster members and metered token/account trade streams. Verified public Fomo wallets are tracked separately.</p></div>';
$('experiments').innerHTML=s.experiments.map(e=>'<div class="smallcard" style="margin:7px 0"><b>'+esc(e.name)+'</b><span style="float:right" class="'+(e.edge>=0?'green':'red')+'">'+(e.edge>=0?'+':'')+money(e.edge)+'</span><div class="mini">vs '+esc(e.parent)+' · '+esc(e.mutation)+' · n='+e.sample+' · '+esc(e.status)+'</div></div>').join('');
$('missed').innerHTML=listOpp(s.missed,'bestReturn',true,'No qualifying missed monsters yet.');$('saved').innerHTML=listOpp(s.saved,'worstReturn',false,'No qualifying saves yet.');
$('hall').innerHTML=s.hall.slice(0,10).map(t=>'<div class="smallcard" style="margin:7px 0"><b>'+esc(t.strategyName||t.strategy)+' · $'+esc(t.symbol)+'</b><span style="float:right" class="green">+'+one(t.pnlPct)+'%</span><div class="mini">MFE '+one(t.mfe)+'% · MAE '+one(t.mae)+'% · '+esc(t.why)+'</div></div>').join('')||'<div class="muted">Collecting trades.</div>';
$('autopsies').innerHTML=s.autopsies.slice(0,10).map(a=>'<div class="smallcard" style="margin:7px 0"><b>'+esc(a.strategyName)+' · $'+esc(a.symbol)+'</b><span style="float:right" class="'+(a.pnlPct>=0?'green':'red')+'">'+(a.pnlPct>=0?'+':'')+one(a.pnlPct)+'%</span><div class="mini">'+esc(a.verdict)+' · MFE '+one(a.mfe)+'% · MAE '+one(a.mae)+'%</div></div>').join('')||'<div class="muted">Autopsies appear after closed trades.</div>';

$('calibration').innerHTML=(s.calibration||[]).map(x=>'<div class="smallcard" style="margin:7px 0"><b>'+esc(x.band)+'</b><span style="float:right">'+one(x.hitRate)+'% hit</span><div class="mini">n='+x.n+' · avg best '+one(x.avgBest)+'% · avg worst '+one(x.avgWorst)+'%</div></div>').join('')||'<div class="muted">Collecting calibrated outcomes.</div>';
$('benchmarks').innerHTML=(s.benchmarks||[]).map(x=>'<div class="smallcard" style="margin:7px 0"><b>'+esc(x.name)+'</b><span style="float:right" class="'+(x.returnPct>=0?'green':'red')+'">'+(x.returnPct>=0?'+':'')+one(x.returnPct)+'%</span><div class="mini">'+x.n+' exits · '+one(x.winRate)+'% wins · '+one(x.dd)+'% DD</div></div>').join('');
$('evolution').innerHTML=(s.evolution.family||[]).map(x=>'<div class="smallcard" style="margin:7px 0"><b>'+esc(x.parent)+' v'+x.version+'</b><div class="mini">'+x.children.map(c=>esc(c.name)+' n='+c.n+(c.promotedAt?' 🏆':c.graveyardAt?' ☠️':'')).join(' · ')+'</div></div>').join('')||'<div class="muted">No challenger families yet.</div>';
const topEntry=(s.entryLab.score||[])[0];$('entryLab').innerHTML=topEntry?'<div class="big">'+esc(topEntry.band)+'</div><div class="mini">best score band · n='+topEntry.n+' · avg '+one(topEntry.avgPnl)+'% · '+one(topEntry.winRate)+'% wins</div>':'<div class="muted">Need closed trades.</div>';
$('exitLab').innerHTML='<div class="big">'+one(s.exitLab.capture)+'%</div><div class="mini">favorable move captured · actual avg '+one(s.exitLab.actual)+'% · MFE '+one(s.exitLab.avgMfe)+'% · 5m after exit '+one(s.exitLab.fiveMin)+'%</div>';
$('sizingLab').innerHTML=(s.sizingLab||[]).map(x=>'<div class="smallcard" style="margin:6px 0"><b>'+x.mult+'× '+esc(x.label)+'</b><span style="float:right" class="'+(x.totalPnl>=0?'green':'red')+'">'+(x.totalPnl>=0?'+':'')+money(x.totalPnl)+'</span><div class="mini">stress loss '+one(x.stressDrawdown)+'%</div></div>').join('');
$('executionLab').innerHTML='<div class="smallcard"><b>EASY</b><span style="float:right">'+one(s.executionLab.easyAvg)+'%</span></div><div class="smallcard" style="margin-top:6px"><b>REALISTIC</b><span style="float:right">'+one(s.executionLab.realisticAvg)+'%</span></div><div class="smallcard" style="margin-top:6px"><b>NIGHTMARE</b><span style="float:right">'+one(s.executionLab.nightmareAvg)+'%</span></div><div class="mini" style="margin-top:7px">n='+s.executionLab.n+' closed production trades</div>';
$('godBot').innerHTML='<div class="big">'+one(s.godBot.capture)+'%</div><div class="mini">of observed favorable excursion captured · avg available '+one(s.godBot.avgAvailable)+'%</div>'+(s.godBot.bestTheoretical?'<p>Best theoretical held move: <b>$'+esc(s.godBot.bestTheoretical.symbol)+'</b> '+one(s.godBot.bestTheoretical.mfe)+'% MFE vs '+one(s.godBot.bestTheoretical.pnl)+'% captured</p>':'')+(s.godBot.biggestMiss?'<p>Biggest rejected opportunity: <b>$'+esc(s.godBot.biggestMiss.symbol)+'</b> '+one(s.godBot.biggestMiss.bestReturn)+'%</p>':'');
$('archetypes').innerHTML=(s.archetypes||[]).slice(0,10).map(x=>'<div class="smallcard" style="margin:6px 0"><b>'+esc(x.name)+'</b><span style="float:right">'+one(x.hitRate)+'%</span><div class="mini">n='+x.n+' · avg best '+one(x.avgBest)+'% · avg worst '+one(x.avgWorst)+'%</div></div>').join('')||'<div class="muted">Pattern memory needs more observations.</div>';
$('graveyard').innerHTML='<div class="two"><div><b class="green">PROMOTIONS</b>'+((s.evolution.promotions||[]).map(x=>'<div class="smallcard" style="margin:6px 0">🏆 '+esc(x.child)+' → '+esc(x.parent)+' v'+x.newVersion+' · n='+x.sample+'</div>').join('')||'<div class="muted">No promotions yet.</div>')+'</div><div><b class="red">GRAVEYARD</b>'+((s.evolution.graveyard||[]).map(x=>'<div class="smallcard" style="margin:6px 0">☠️ '+esc(x.child)+' · '+esc(x.reason)+' · n='+x.sample+'</div>').join('')||'<div class="muted">No dead challengers yet.</div>')+'</div></div>';
$('masterAllocation').innerHTML='<div class="mini">Current regime: <b>'+esc(s.masterAllocation.regime)+'</b></div>'+(s.masterAllocation.weights||[]).slice(0,8).map(x=>'<div class="smallcard" style="margin:6px 0"><b>'+esc(x.name)+'</b><span style="float:right">'+one(x.pct)+'%</span><div class="meter" style="margin-top:5px"><i style="width:'+Math.min(100,x.pct*4)+'%"></i></div></div>').join('');
$('coalitions').innerHTML=(s.coalitions||[]).slice(0,10).map(x=>'<div class="smallcard" style="margin:6px 0"><b>'+esc(x.pair)+'</b><span style="float:right">'+one(x.hitRate)+'% hit</span><div class="mini">n='+x.n+' · best '+one(x.avgBest)+'% · worst '+one(x.avgWorst)+'%</div></div>').join('')||'<div class="muted">Waiting for repeated co-signals.</div>';
$('holdTime').innerHTML=(s.holdTime||[]).map(x=>'<div class="smallcard" style="margin:6px 0"><b>'+esc(x.band)+'</b><span style="float:right" class="'+(x.avgPnl>=0?'green':'red')+'">'+(x.avgPnl>=0?'+':'')+one(x.avgPnl)+'%</span><div class="mini">n='+x.n+' · '+one(x.winRate)+'% wins · MFE '+one(x.avgMfe)+'%</div></div>').join('')||'<div class="muted">Need closed trades.</div>';
$('regimeMatrix').innerHTML=(s.regimeMatrix||[]).map(r=>'<div class="smallcard" style="margin:7px 0"><b>'+esc(r.regime)+'</b><div class="mini">'+(r.leaders.length?r.leaders.map(x=>esc(x.name)+' '+(x.avgPnl>=0?'+':'')+one(x.avgPnl)+'% n='+x.n).join(' · '):'collecting data')+'</div></div>').join('');
$('tournament').innerHTML=(s.tournament||[]).slice(0,8).map((x,i)=>'<div class="smallcard" style="margin:6px 0"><b>'+(i+1)+'. '+esc(x.name)+'</b><span style="float:right" class="'+(x.pnl>=0?'green':'red')+'">'+(x.pnl>=0?'+':'')+money(x.pnl)+'</span><div class="mini">24h · '+x.n+' exits · '+one(x.winRate)+'% wins</div></div>').join('')||'<div class="muted">Grand Prix collecting first exits.</div>';
$('riskBoard').innerHTML=(s.riskBoard||[]).slice(0,6).map(x=>'<div class="mini" style="margin:5px 0">'+esc(x.name)+' · risk-adj '+one(x.riskAdjusted)+' · ruin proxy '+one(x.ruinProxy)+'/100</div>').join('');
$('correlation').innerHTML=(s.correlation||[]).slice(0,8).map(x=>'<div class="smallcard" style="margin:6px 0"><b>'+esc(x.aName)+' + '+esc(x.bName)+'</b><span style="float:right">'+one(x.jaccard)+'%</span><div class="mini">shared buys '+x.intersection+' · union '+x.n+'</div></div>').join('')||'<div class="muted">Need repeated strategy decisions.</div>';
$('noTrade').innerHTML='<div class="big">'+one(s.noTrade.falseRejectRate)+'%</div><div class="mini">rejected setups later reaching +50% · '+s.noTrade.falseRejects+'/'+s.noTrade.n+' false rejects</div><div class="smallcard" style="margin-top:8px">Correct crash avoids: <b>'+s.noTrade.correctAvoids+'</b> · '+one(s.noTrade.saveRate)+'%</div>';
$('chaos').innerHTML='<div class="smallcard"><b>Normal avg</b><span style="float:right">'+one(s.chaos.normal)+'%</span></div><div class="smallcard" style="margin-top:6px"><b>Double fees</b><span style="float:right">'+one(s.chaos.doubleFees)+'%</span></div><div class="smallcard" style="margin-top:6px"><b>Latency shock</b><span style="float:right">'+one(s.chaos.latencyShock)+'%</span></div><div class="smallcard" style="margin-top:6px"><b>Miss best 10%</b><span style="float:right">'+one(s.chaos.missBest)+'%</span></div>';
$('providerAudit').innerHTML='<div class="mini">Integrity score <b>'+one(s.providerAudit.overall)+'/100</b>'+(s.providerAudit.stale.length?' · stale: '+esc(s.providerAudit.stale.join(', ')):' · no stale live providers')+'</div><div class="health" style="margin-top:8px">'+s.providerAudit.rows.map(x=>'<span>'+esc(x.component)+' '+one(x.score)+'/100 · '+one(x.ageSec)+'s old</span>').join('')+'</div>';
const frames=s.replay||[];const rf=frames.length?frames[frames.length-1]:null;$('marketReplay').innerHTML=rf?'<div class="mini">'+new Date(rf.ts).toLocaleTimeString()+' · '+esc(rf.weather.regime)+' · '+rf.tokens.length+' active tokens</div><div style="margin-top:8px">'+rf.tokens.slice(0,12).map(t=>'<span class="vote '+(t.score>=70?'y':'n')+'">&#36;'+esc(t.symbol)+' '+one(t.score)+' / Q'+one(t.quality)+'</span>').join('')+'</div>':'<div class="muted">Collecting replay frames every 30 seconds.</div>';

$('researchText').innerHTML='<p><b>Last cycle:</b> '+(s.research.last?new Date(s.research.last).toLocaleString():'collecting first hour')+'</p>'+s.research.notes.map(n=>'<p>• '+esc(n)+'</p>').join('')+(s.research.hypotheses.length?'<hr style="border-color:#223047"><b>Hypotheses under test</b>'+s.research.hypotheses.map(n=>'<p>🧠 '+esc(n)+'</p>').join(''):'');
renderTime(s.timeline);$('ledger').innerHTML=s.decisions.slice(0,120).map(d=>'<tr><td>'+new Date(d.ts).toLocaleTimeString()+'</td><td>'+esc(d.strategyName)+'</td><td>$'+esc(d.symbol)+'</td><td class="'+(d.action==='BUY'?'green':'muted')+'">'+d.action+'</td><td>'+one(d.score)+'</td><td>'+one(d.risk)+'</td><td class="muted">'+esc(d.why)+'</td></tr>').join('');}
function listOpp(a,key,positive,empty){return a.slice(0,10).map(o=>'<div class="smallcard" style="margin:7px 0"><b>$'+esc(o.symbol)+' · '+esc(o.strategyName)+'</b><span style="float:right" class="'+(positive?'green':'red')+'">'+(o[key]>=0?'+':'')+one(o[key])+'%</span><div class="mini">rejected: '+esc(o.why)+'</div></div>').join('')||'<div class="muted">'+empty+'</div>'}
function openToken(mint){const t=S.tokens.find(x=>x.mint===mint);if(!t)return;const hist=t.history||[];const pts=hist.slice(-45).map(x=>x.price).concat(t.price);const min=Math.min(...pts),max=Math.max(...pts);const path=pts.map((p,i)=>{const x=pts.length<2?0:i/(pts.length-1)*500;const y=80-((p-min)/(max-min||1))*70;return x+','+y}).join(' ');$('drawerBody').innerHTML='<h2>$'+esc(t.symbol)+'</h2><div class="muted">'+esc(t.name)+'</div><svg class="spark" viewBox="0 0 500 90"><polyline fill="none" stroke="#63f4a4" stroke-width="3" points="'+path+'"/></svg><div class="grid4" style="grid-template-columns:1fr 1fr"><div class="smallcard">MC<br><b>'+money(t.mc)+'</b></div><div class="smallcard">Liquidity<br><b>'+money(t.liq)+'</b></div><div class="smallcard">Data Quality<br><b>'+one(t.quality.score)+' · '+esc(t.quality.level)+'</b></div><div class="smallcard">Detective<br><b>'+esc(t.detective.verdict)+' '+one(t.detective.score)+'</b></div><div class="smallcard">Consensus<br><b>'+t.consensus.yes+'/'+t.consensus.total+'</b></div></div><h3>Agent Consensus</h3>'+t.consensus.votes.map(v=>'<span class="vote '+(v.yes?'y':'n')+'">'+v.icon+' '+esc(v.name)+' '+one(v.score)+'</span>').join('')+'<h3>AI Detective</h3><p>'+esc((t.detective.flags||[]).join(' · ')||'No major observed red flags.')+'</p><div class="muted">Unknown until deeper streams are connected: '+esc((t.detective.unknown||[]).join(', '))+'</div><h3>Creator DNA</h3><p>'+t.dna.launches+' observed launches · best observed '+one(t.dna.bestPeakX)+'× · '+t.dna.collapses+' collapses · '+t.dna.graduates+' graduations</p><h3>Signal Breakdown</h3><p>Momentum '+one(t.features.momentum)+' · Flow '+one(t.features.flow)+' · Volume '+one(t.features.volScore)+' · Liquidity '+one(t.features.liqScore)+' · Social metadata '+one(t.features.social)+' · Source quality '+one(t.features.sourceQuality)+'</p>';$('drawer').classList.add('on')}
function closeDrawer(){$('drawer').classList.remove('on')}function renderTime(tl){const sel=$('timeSelect');const old=sel.value;sel.innerHTML=tl.slice().reverse().map((x,i)=>'<option value="'+(tl.length-1-i)+'">'+new Date(x.ts).toLocaleTimeString()+' · '+x.regime+'</option>').join('');if(old)sel.value=old;sel.onchange=showTime;showTime()}function showTime(){if(!S||!S.timeline.length)return;const i=Number($('timeSelect').value||S.timeline.length-1);const t=S.timeline[i]||S.timeline.at(-1);$('timeView').textContent=new Date(t.ts).toLocaleString();$('timeCards').innerHTML='<div class="card"><div class="muted">LAB CAPITAL</div><div class="big">'+money(t.capital)+'</div></div><div class="card"><div class="muted">CHAMPION</div><div class="big">'+money(t.champion)+'</div></div><div class="card"><div class="muted">REGIME</div><div class="big">'+esc(t.regime)+'</div></div><div class="card"><div class="muted">TOP NARRATIVE</div><div class="big">'+esc(t.topNarrative)+'</div></div>'}
async function go(){try{render(await(await fetch('/api/state',{cache:'no-store'})).json())}catch(e){console.error('PUMP LAB render error',e);const h=document.getElementById('health');if(h)h.innerHTML='<span class=\"bad\">CLIENT ERROR · refresh or check system health</span>';}}go();setInterval(go,5000);const es=new EventSource('/api/events');es.addEventListener('tick',()=>go());document.querySelectorAll('.tab').forEach(t=>t.onclick=()=>{document.querySelectorAll('.tab,.pane').forEach(x=>x.classList.remove('on'));t.classList.add('on');$(t.dataset.p).classList.add('on')});</script></body></html>`;

const server=http.createServer((req,res)=>{
  if(req.url==='/api/state'){res.writeHead(200,{'content-type':'application/json','cache-control':'no-store'});return res.end(JSON.stringify(snapshot()));}
  if(req.url==='/api/health'){res.writeHead(200,{'content-type':'application/json','cache-control':'no-store'});return res.end(JSON.stringify({ok:true,paperOnly:true,version:'1.1 Fomo Smart Wallets',weather:marketWeather(),providers:[...health.values()]}));}
  if(req.url==='/api/events'){res.writeHead(200,{'content-type':'text/event-stream','cache-control':'no-cache','connection':'keep-alive'});res.write('data: {}\n\n');clients.add(res);req.on('close',()=>clients.delete(res));return;}
  res.writeHead(200,{'content-type':'text/html; charset=utf-8','cache-control':'no-store'});res.end(HTML);
});

loadLocal();
await initDb();
setHealth('engine','ok','18 production/control portfolios + 4 R&D challengers online',{truth:'observed'});
setHealth('x-social','standby','Full X stream not connected · social agent uses token social metadata only',{truth:'not connected'});
setHealth('wallet-intel','standby','Connecting Solana stream + verified Fomo wallet watchlist…',{truth:'not connected'});setHealth('fomo-watchlist','standby','Preparing verified public wallet subscriptions',{truth:'not connected'});
server.listen(PORT,'0.0.0.0',()=>{log('system','🚀 PUMP LAB v1.1 Fomo Smart Wallets started','system');connectPumpPortal();connectSolanaStream();pumpPoll();dexPoll();console.log('PUMP LAB v1.1 on '+PORT);});
setInterval(drainSolanaQueue,1100).unref?.();setInterval(pumpPoll,7000).unref?.();setInterval(dexPoll,20000).unref?.();setInterval(takeTimeline,30000).unref?.();setInterval(takeReplay,30000).unref?.();setInterval(researchCycle,3600000).unref?.();setInterval(()=>save(),30000).unref?.();takeTimeline();takeReplay();
process.on('SIGTERM',async()=>{await save();server.close(()=>process.exit(0));});process.on('SIGINT',async()=>{await save();server.close(()=>process.exit(0));});
