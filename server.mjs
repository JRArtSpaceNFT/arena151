import http from 'node:http';
import fs from 'node:fs';

const PORT = Number(process.env.PORT || 3000);
const PUMP_KEY = process.env.PUMPPORTAL_API_KEY || '';
const ALLOW_METERED = (process.env.ALLOW_METERED_PUMPPORTAL || 'false') === 'true';
const START = 1000;
const TARGET = 100000;
const STRATEGY_ERA = 'v3.1-megga-research';
const FEE_RATE = 0.0125;
const STATE_FILE = process.env.STATE_FILE || '/tmp/pump-lab-state-v06.json';
const DATABASE_URL = process.env.DATABASE_URL || '';
const PUMP_PROGRAM = '6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P';
const SOLANA_RPC_HTTP = process.env.SOLANA_RPC_HTTP || 'https://api.mainnet-beta.solana.com';
const SOLANA_RPC_WSS = process.env.SOLANA_RPC_WSS || 'wss://api.mainnet-beta.solana.com';

// Public Fomo trader identities requested for research. Wallets are attached only when
// a public mapping is corroborated strongly enough to avoid polluting the dataset.
const FOMO_WATCHLIST = [
  {id:'dingalingts',name:'Dingalingts',status:'resolving',profileUrl:'https://fomo.family/profile/dingalingts',walletHint:'4sVrMC…7Tmi',wallets:[]},
  {id:'rachelwolchin',name:'RachelWolchin',status:'resolving',profileUrl:'https://fomo.family/r/RachelWolchin',wallets:[]},
  {id:'megga',name:'Megga',status:'tracking',profileUrl:'https://pump.fun/profile/H31vEBxSJk1nQdUN11qZgZyhScyShhscKhvhZZU3dQoU',wallets:[
    {address:'H31vEBxSJk1nQdUN11qZgZyhScyShhscKhvhZZU3dQoU',label:'Pump.fun public profile / Solana execution wallet',confidence:'verified'}
  ]},
  {id:'unipcs',name:'Unipcs',status:'tracking',profileUrl:'https://fomo.family/profile/unipcs',wallets:[
    {address:'2heJbC32Tpfcb3nbUb5ER61K11FGZVfVGtVnDm6LDogF',label:'Fomo/public Solana',confidence:'verified'}
  ]},
  {id:'frankdegods',name:'FrankDeGods',status:'tracking',profileUrl:'https://fomo.family/profile/frankdegods',wallets:[
    {address:'498g1rVnFcnjBjpfw1xyqA1WvgQXUU8RWuELjxkjAayQ',label:'Fomo/public Solana',confidence:'verified'}
  ]},
  {id:'macdegods',name:'MacDeGods',status:'partial',profileUrl:'https://fomo.family/profile/macdegods',walletHint:'C6hE7Z…6t6c',wallets:[
    {address:'5RZPhPW9qGEd3hRGibgYaF5Yk2jBzXR1VZMKSP71C3Lb',label:'associated public Solana; current Fomo execution wallet still resolving',confidence:'associated'}
  ]},
  {id:'orangie',name:'Orangie',status:'tracking',profileUrl:'https://fomo.family/profile/orangie',wallets:[
    {address:'DuQabFqdC9eeBULVa7TTdZYxe8vK8ct5DZr4Xcf7docy',label:'primary public Solana',confidence:'verified'}
  ]},
  {id:'tjr',name:'TJR',status:'resolving',profileUrl:'https://fomo.family/profile/tjr',walletHint:'9pqU4R…BoqZ',wallets:[]},
  {id:'rasmr',name:'Rasmr',status:'tracking',profileUrl:'https://fomo.family/profile/rasmr',wallets:[
    {address:'9CNyLECt2j8tnDhqxtjYk5HUhZ2b8Nwnyb7sfYN7vND2',label:'Fomo-mapped Solana',confidence:'verified'}
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
let dbConnecting = false;
let dbStateRestored = false;
let research = { last: 0, notes: [], hypotheses: [] };
let startedAt = Date.now();

// PUMP LAB v2 learning memory. In-memory structures are bounded; the durable event
// ledger is also flushed to Postgres so research survives process restarts.
const MAX_MARKET_EVENTS = 6000;
const MAX_DNA_ARCHIVE = 2500;
const marketEvents = [];
const dnaArchive = new Map();
const marketEventClock = new Map();
const pendingDbEvents = [];
let lastDbEventFlush = 0;
let lastScientistRun = 0;

const strategyDefs = [
  ['banker','🏦','The Banker','LOW',.025,62,14,90,1,'only confirmed momentum with capital preservation; tolerate small misses for rare asymmetric winners'],
  ['quant','∑','The Quant','LOW',.03,64,14,110,1,'multi-factor confirmation with hard quality floors and catastrophic-loss avoidance'],
  ['smart','🧠','Smart Money','MED',.03,62,15,110,1,'verified smart-wallet activity plus market confirmation; never use flow as a wallet proxy'],
  ['social','📡','Social Alpha','MED',.025,63,14,75,1,'social presence is context only; require fresh market confirmation and multiple channels'],
  ['momentum','⚡','Momentum Hunter','HIGH',.04,67,13,90,1,'trade acceleration, not stale absolute momentum; require fresh buyers and observed liquidity'],
  ['graduation','🎓','Graduation','MED',.03,64,14,85,1,'confirmed irreversible graduation breakout with post-migration liquidity and flow'],
  ['dip','↘','Dip Buyer','MED',.03,62,13,75,1,'real pullback plus rebound confirmation; never buy a falling knife from one tick'],
  ['swing','🌊','Swing Trader','MED',.035,64,15,125,1,'deep observed liquidity, mature structure, small risk and room for asymmetric runners'],
  ['degen','🔥','Early Degen','EXTREME',.02,66,11,80,1,'tiny early starter only after real flow appears; no blind first-second momentum'],
  ['smartmom','🧬','Smart Momentum','HIGH',.04,69,13,105,1,'high-quality acceleration with strong buyer pressure; modeled on the successful confirmation challenger'],
  ['culture','🌐','Culture Hybrid','HIGH',.035,65,14,95,1,'narrative/social context only when confirmed by fresh flow, quality and momentum'],
  ['contrarian','🪞','Contrarian','MED',.025,64,12,70,1,'buy controlled pullback recovery, not weakness for its own sake'],
  ['sniper','🎯','Patient Sniper','MED',.035,72,11,145,1,'rare cross-checked high-conviction setup with strong quality and acceleration'],
  ['champion','👑','Champion','HIGH',.04,70,13,125,1,'ensemble only when independent evidence agrees; abstention is a valid win'],
  ['professional','🛡','Professional','LOW',.025,68,11,85,1,'risk-adjusted return with cross-source data, deep liquidity and strict loss control'],
  ['adaptive','🧭','Adaptive Master','MED',.035,68,13,105,1,'regime-aware evidence ensemble that ignores weak peers and can stay in cash'],
  ['copy_unipcs','🔭','Unipcs Conviction Copy','MED',.025,62,16,220,2,'paper-copy verified Unipcs entries with chase limits; tiny starters and long asymmetric runners'],
  ['copy_frank','🎒','Frank Consistency Copy','MED',.03,64,14,130,2,'paper-copy verified Frank entries only with fresh quality confirmation'],
  ['copy_orangie','🍊','Orangie Diversified Copy','LOW',.025,64,12,80,2,'paper-copy verified Orangie entries with diversified small sizing and disciplined exits'],
  ['copy_rasmr','⚡','Rasmr Fast Copy','HIGH',.02,65,10,50,2,'paper-copy verified Rasmr entries as short-horizon trades with strict chase and time limits'],
  ['wallet_consensus','👥','Smart Wallet Consensus','MED',.04,69,12,125,2,'requires multiple independently verified tracked wallets to converge on the same token'],
  ['confirmed_runner','🏃','Confirmed Runner','HIGH',.035,70,12,130,1,'fresh acceleration plus strong buyer flow, cross-source quality and room for a runner'],
  ['asym_swing','💎','Mac-Style Asymmetric Swing','MED',.025,67,14,220,1,'behavioral model inspired by MacDeGods payoff asymmetry; not direct copy until the current execution wallet is independently verified'],
  ['copy_megga','🎮','Megga Direct Copy','HIGH',.015,58,12,400,6,'paper-copy Megga public-wallet buys with tiny probes, strict chase limits, source-aware sells and runner preservation'],
  ['megga_scout','🛰️','Megga Micro Scout','HIGH',.015,58,12,400,8,'behavioral model: many tiny sub-$100K scouts, asymmetric payoff, no averaging down, scale winners and keep a runner'],

  ['random','🎲','Random Control','CONTROL',.05,70,22,45,1,'random baseline'],
  ['volume','📊','Volume Control','CONTROL',.06,68,22,50,1,'simple volume baseline'],
  ['launchctl','🧱','Every Launch Control','CONTROL',.035,0,30,50,3,'buy-everything launch baseline'],
  ['socialctl','📣','Social Metadata Control','CONTROL',.04,58,25,55,2,'simple social-metadata baseline'],

  // Specialist Cohort Lab: deliberately narrow populations for clean apples-to-apples experiments.
  ['mc_u25','🔬','Under $25K','MED',.045,58,24,65,1,'only trades tokens below $25k market cap'],
  ['mc_25_50','🧫','$25K–$50K','MED',.05,59,23,68,1,'only trades $25k–$50k market cap'],
  ['mc_50_100','🌱','$50K–$100K','MED',.055,60,22,70,1,'only trades $50k–$100k market cap'],
  ['mc_100_250','🚦','$100K–$250K','MED',.06,61,21,72,1,'only trades $100k–$250k market cap'],
  ['mc_250_500','🏎️','$250K–$500K','MED',.065,62,20,75,1,'only trades $250k–$500k market cap'],
  ['mc_500_1m','🏙️','$500K–$1M','LOW',.06,63,18,72,1,'only trades $500k–$1m market cap'],
  ['mc_1m_plus','🏛️','$1M+','LOW',.055,64,17,68,1,'only trades above $1m market cap'],
  ['mc_sub100','🪙','Sub $100K','HIGH',.065,59,23,72,2,'broad early-cap cohort below $100k'],
  ['mc_over100','📈','$100K+','MED',.06,62,20,72,1,'broad cohort only after $100k'],
  ['mc_over250','🧱','$250K+','LOW',.06,63,18,70,1,'established tokens only above $250k'],
  ['mc_graduation_zone','🎓','Graduation Zone','MED',.06,61,21,74,1,'focuses on roughly $60k–$100k transition zone'],

  ['age_flash','⏱️','First Minute','EXTREME',.055,60,24,75,1,'only the first 60 seconds after launch'],
  ['age_1_5','🕐','1–5 Minute','HIGH',.06,60,22,74,1,'only tokens aged 1 to 5 minutes'],
  ['age_5_15','🕔','5–15 Minute','MED',.06,61,20,72,1,'only tokens aged 5 to 15 minutes'],
  ['age_mature','🕰️','15 Minute+','LOW',.055,62,18,68,1,'only tokens at least 15 minutes old'],

  ['liq_5_15','💧','$5K–$15K Liquidity','HIGH',.05,59,24,72,1,'thin but tradable liquidity cohort'],
  ['liq_15_50','🌊','$15K–$50K Liquidity','MED',.06,61,20,72,1,'medium liquidity cohort'],
  ['liq_50_plus','🏦','$50K+ Liquidity','LOW',.06,63,18,68,1,'deep liquidity only'],
  ['liq_ratio','⚖️','Liquidity Rich','MED',.06,61,20,72,1,'requires unusually strong liquidity relative to market cap'],

  ['flow_70','🟢','70%+ Buyers','HIGH',.065,61,21,76,1,'only strong buyer-dominant order flow'],
  ['flow_balanced','🧘','Balanced Flow','MED',.055,61,20,68,1,'tests healthy but non-euphoric buyer pressure'],
  ['flow_extreme','🚀','80%+ Buyers','EXTREME',.06,63,23,82,1,'only extreme buyer-pressure bursts'],

  ['meta_verified','✅','Full Metadata','MED',.055,61,20,70,1,'requires both X/Twitter and website metadata'],
  ['meta_dark','🌑','No Metadata','HIGH',.045,62,25,75,1,'contrarian test of tokens with neither X nor website'],

  ['creator_repeat_clean','🧬','Repeat Clean Creator','MED',.06,61,20,74,1,'repeat creators with no observed collapse history'],
  ['creator_first','🆕','First-Time Creator','HIGH',.055,60,23,75,1,'creator has only one observed launch'],
  ['crosscheck','🔎','Cross-Checked Only','LOW',.06,63,18,70,1,'requires two or more independent market-data sources'],

  ['regime_hot','🔥','Hot Market Only','HIGH',.065,60,22,78,1,'only trades while market regime is HOT'],
  ['regime_riskoff','🛡️','Risk-Off Only','LOW',.05,63,17,62,1,'only trades while market regime is RISK OFF'],

  ['pre_grad','🛤️','Pre-Graduation','HIGH',.06,60,22,76,1,'only tokens not yet marked graduated'],
  ['post_grad','🎓','Post-Graduation','LOW',.06,63,18,68,1,'only tokens already marked graduated']
].map(([id,icon,name,risk,size,min,stop,take,maxOpen,thesis]) => ({
  id,icon,name,risk,size,min,stop,take,maxOpen,thesis,version:3,equity:START,cash:START,peak:START,dd:0,wins:0,losses:0,n:0
}));

const specialistProfiles = {
  mc_u25:{cohort:'MARKET CAP',mcMax:25000,scoreMode:'early'},
  mc_25_50:{cohort:'MARKET CAP',mcMin:25000,mcMax:50000,scoreMode:'early'},
  mc_50_100:{cohort:'MARKET CAP',mcMin:50000,mcMax:100000,scoreMode:'momentum'},
  mc_100_250:{cohort:'MARKET CAP',mcMin:100000,mcMax:250000,scoreMode:'momentum'},
  mc_250_500:{cohort:'MARKET CAP',mcMin:250000,mcMax:500000,scoreMode:'quality'},
  mc_500_1m:{cohort:'MARKET CAP',mcMin:500000,mcMax:1000000,scoreMode:'quality'},
  mc_1m_plus:{cohort:'MARKET CAP',mcMin:1000000,scoreMode:'quality'},
  mc_sub100:{cohort:'MARKET CAP',mcMax:100000,scoreMode:'momentum',exitMode:'runner'},
  mc_over100:{cohort:'MARKET CAP',mcMin:100000,scoreMode:'quality'},
  mc_over250:{cohort:'MARKET CAP',mcMin:250000,scoreMode:'quality',exitMode:'structure'},
  mc_graduation_zone:{cohort:'MARKET CAP',mcMin:60000,mcMax:100000,scoreMode:'momentum'},

  age_flash:{cohort:'TOKEN AGE',tokenAgeMax:1,scoreMode:'early',exitMode:'runner'},
  age_1_5:{cohort:'TOKEN AGE',tokenAgeMin:1,tokenAgeMax:5,scoreMode:'momentum'},
  age_5_15:{cohort:'TOKEN AGE',tokenAgeMin:5,tokenAgeMax:15,scoreMode:'quality'},
  age_mature:{cohort:'TOKEN AGE',tokenAgeMin:15,scoreMode:'quality',exitMode:'structure'},

  liq_5_15:{cohort:'LIQUIDITY',liqMin:5000,liqMax:15000,scoreMode:'momentum'},
  liq_15_50:{cohort:'LIQUIDITY',liqMin:15000,liqMax:50000,scoreMode:'quality'},
  liq_50_plus:{cohort:'LIQUIDITY',liqMin:50000,scoreMode:'quality',exitMode:'defensive'},
  liq_ratio:{cohort:'LIQUIDITY',liqMcRatioMin:.12,scoreMode:'quality'},

  flow_70:{cohort:'ORDER FLOW',buyRatioMin:.70,scoreMode:'flow',exitMode:'runner'},
  flow_balanced:{cohort:'ORDER FLOW',buyRatioMin:.52,buyRatioMax:.62,scoreMode:'quality'},
  flow_extreme:{cohort:'ORDER FLOW',buyRatioMin:.80,scoreMode:'flow',exitMode:'runner'},

  meta_verified:{cohort:'METADATA',requireTwitter:true,requireWebsite:true,scoreMode:'social'},
  meta_dark:{cohort:'METADATA',noSocial:true,scoreMode:'contrarian'},

  creator_repeat_clean:{cohort:'CREATOR DNA',repeatCleanCreator:true,scoreMode:'creator'},
  creator_first:{cohort:'CREATOR DNA',firstObservedCreator:true,scoreMode:'early'},
  crosscheck:{cohort:'DATA QUALITY',sourceMin:2,scoreMode:'quality',exitMode:'defensive'},

  regime_hot:{cohort:'MARKET REGIME',regime:'HOT',scoreMode:'momentum',exitMode:'runner'},
  regime_riskoff:{cohort:'MARKET REGIME',regime:'RISK OFF',scoreMode:'quality',exitMode:'defensive'},

  pre_grad:{cohort:'LIFECYCLE',requireGraduated:false,scoreMode:'early'},
  post_grad:{cohort:'LIFECYCLE',requireGraduated:true,scoreMode:'quality',exitMode:'structure'}
};
for(const d of strategyDefs){if(specialistProfiles[d.id])Object.assign(d,{specialist:true,...specialistProfiles[d.id]});}

const copyProfiles={
  copy_unipcs:{copyLab:true,copySource:'unipcs',copyWindowMin:30,maxChase:12,exitMode:'conviction',maxHold:720},
  copy_frank:{copyLab:true,copySource:'frankdegods',copyWindowMin:20,maxChase:10,exitMode:'runner',maxHold:240},
  copy_orangie:{copyLab:true,copySource:'orangie',copyWindowMin:15,maxChase:8,exitMode:'balanced',maxHold:120},
  copy_rasmr:{copyLab:true,copySource:'rasmr',copyWindowMin:8,maxChase:6,exitMode:'scalp',maxHold:28},
  wallet_consensus:{copyLab:true,consensusWallets:2,copyWindowMin:15,maxChase:8,exitMode:'runner',maxHold:180},
  confirmed_runner:{researchProfile:'confirmed-runner',exitMode:'runner',maxHold:120},
  asym_swing:{researchProfile:'asymmetric-swing',exitMode:'conviction',maxHold:720,scaleOut:true},
  copy_megga:{copyLab:true,copySource:'megga',copyWindowMin:6,maxChase:8,exitMode:'conviction',maxHold:1440,scaleOut:true},
  megga_scout:{researchProfile:'megga-scout',exitMode:'conviction',maxHold:1440,scaleOut:true}
};
for(const d of strategyDefs)if(copyProfiles[d.id])Object.assign(d,copyProfiles[d.id]);

const challengers = [
  makeChallenger('momentum','momentum-c1','Momentum Challenger','stricter confirmation + fast invalidation',{minDelta:5,takeDelta:10,exitMode:'scalp',sizeBias:.75}),
  makeChallenger('professional','professional-c1','Professional Challenger','stricter risk / slightly larger winners',{minDelta:2,takeDelta:8,riskCap:38}),
  makeChallenger('degen','degen-c1','Degen Challenger','less trigger-happy early entries',{minDelta:6,stopDelta:-2}),
  makeChallenger('smartmom','smartmom-c1','Smart Momentum Challenger','higher confirmation threshold',{minDelta:4,takeDelta:10})
];

function makeChallenger(parentId,id,name,mutation,mods={}) {
  const p = strategyDefs.find(x=>x.id===parentId);
  return {...p,id,name,icon:'🧪',risk:'R&D',type:'challenger',parentId,mutation,
    min:p.min+(mods.minDelta||0),stop:p.stop+(mods.stopDelta||0),take:p.take+(mods.takeDelta||0),riskCap:mods.riskCap,
    exitMode:mods.exitMode||p.exitMode||null,sizeBias:mods.sizeBias||1,
    equity:START,cash:START,peak:START,dd:0,wins:0,losses:0,n:0,version:p.version+0.1};
}

const allTraders = () => [...strategyDefs, ...challengers.filter(c=>!c.graveyardAt&&!c.promotedAt)];
const coreStrategies = () => strategyDefs.filter(d=>d.risk!=='CONTROL'&&!d.specialist);
const specialistStrategies = () => strategyDefs.filter(d=>d.specialist);
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

function canonicalSource(source='live'){return source.startsWith('dexscreener')?'dexscreener':source.startsWith('pump.fun')?'pump.fun':source;}
function normalize(raw,source='live') {
  const mint = raw.mint || raw.tokenAddress || raw.address || raw.baseToken?.address;
  if(!mint) return null;
  const ts=now(),src=canonicalSource(source);
  const symbol=(raw.symbol||raw.baseToken?.symbol||raw.name||'TOKEN').toString().slice(0,18).toUpperCase();
  const name=(raw.name||raw.baseToken?.name||symbol).toString().slice(0,64);
  const usdMc=num(raw.usd_market_cap||raw.marketCapUsd||raw.marketCap||raw.fdv||0),solMc=num(raw.market_cap||raw.marketCapSol||0);
  let mc=usdMc>0?usdMc:0;
  const inferredSolUsd=usdMc>0&&solMc>0?usdMc/solMc:0;
  if(!(mc>0)&&solMc>0&&inferredSolUsd>0)mc=solMc*inferredSolUsd;
  let price=num(raw.priceUsd||raw.price_usd||0); if(!price&&mc>0) price=mc/1e9;
  const rawLiq=raw.liquidity?.usd??raw.liquidityUsd??raw.liquidity;
  const directLiq=Number.isFinite(Number(rawLiq))&&Number(rawLiq)>0?num(rawLiq):0;
  const virtualSol=num(raw.virtual_sol_reserves||raw.virtualSolReserves||0)/1e9,realSol=num(raw.real_sol_reserves||raw.realSolReserves||0)/1e9;
  const curveDepthUsd=inferredSolUsd>0?Math.max(virtualSol,realSol)*inferredSolUsd*2:0;
  const liqObserved=directLiq>0||curveDepthUsd>0,liq=directLiq||curveDepthUsd;
  const liquidityKind=directLiq>0?'dex-liquidity':curveDepthUsd>0?'pump-curve-depth':'unknown';
  const rawVol=raw.volume?.m5??raw.volume1m??raw.volume?.h1??raw.volume;
  const volumeObserved=Number.isFinite(Number(rawVol))&&Number(rawVol)>=0;
  const vol=volumeObserved?num(rawVol):0;
  const rawBuys=raw.txns?.m5?.buys??raw.buys1m??raw.txns?.h1?.buys??raw.buys;
  const rawSells=raw.txns?.m5?.sells??raw.sells1m??raw.txns?.h1?.sells??raw.sells;
  const flowObserved=Number.isFinite(Number(rawBuys))&&Number.isFinite(Number(rawSells));
  const buys=flowObserved?num(rawBuys):0,sells=flowObserved?num(rawSells):0;
  const created=num(raw.created_timestamp||raw.createdAt||raw.pairCreatedAt||ts);
  const createdAt=created<1e12?created*1000:created;
  const socials=raw.info?.socials||[];
  const twitter=raw.twitter||socials.find(x=>/twitter|x/i.test(x.platform||''))?.handle||'';
  const telegram=raw.telegram||socials.find(x=>/telegram/i.test(x.platform||''))?.handle||'';
  const website=raw.website||raw.info?.websites?.[0]?.url||'';
  const creator=raw.creator||raw.traderPublicKey||raw.user||'';
  const boosts=num(raw.boosts?.active||raw.boostAmount||0);
  return {mint,symbol,name,source,price,mc,liq,vol,buys,sells,createdAt,updatedAt:ts,narrative:narrativeFor({name,symbol}),graduated:!!raw.complete,
    twitter,telegram,website,image:raw.image_uri||raw.image||raw.info?.imageUrl||'',creator,boosts,history:[],sources:[src],sourceSeen:{[src]:ts},
    flowObserved,flowUpdatedAt:flowObserved?ts:0,flowSource:flowObserved?src:'',volumeObserved,volumeUpdatedAt:volumeObserved?ts:0,volumeSource:volumeObserved?src:'',
    liquidityObserved:liqObserved,liquidityUpdatedAt:liqObserved?ts:0,liquiditySource:liqObserved?src:'',liquidityKind,curveDepthUsd,inferredSolUsd,
    firstPrice:price,firstMc:mc,peakPrice:price,peakMc:mc,troughPrice:price||0,troughMc:mc||0};
}

function mergeToken(old,t) {
  if(!old) return t;
  const ts=now(),hist=(old.history||[]).slice(-239);
  hist.push({ts,price:old.price,mc:old.mc,liq:old.liq,vol:old.vol,buys:old.buys,sells:old.sells});
  const seen={...(old.sourceSeen||{})};for(const [k,v] of Object.entries(t.sourceSeen||{}))seen[k]=Math.max(num(seen[k]),num(v));
  const freshFlow=t.flowObserved;
  const freshVol=t.volumeObserved;
  const freshLiq=t.liquidityObserved;
  const createdCandidates=[old.createdAt,t.createdAt].filter(x=>x>0);
  return {...old,...t,
    createdAt:createdCandidates.length?Math.min(...createdCandidates):t.createdAt,
    graduated:!!old.graduated||!!t.graduated,
    firstPrice:old.firstPrice||t.price,firstMc:old.firstMc||t.mc,history:hist,
    peakPrice:Math.max(old.peakPrice||0,t.price||0),peakMc:Math.max(old.peakMc||0,t.mc||0),
    troughPrice:Math.min(old.troughPrice||t.price||0,t.price||old.troughPrice||0),troughMc:Math.min(old.troughMc||t.mc||0,t.mc||old.troughMc||0),
    sourceSeen:seen,sources:Object.keys(seen),
    twitter:t.twitter||old.twitter,telegram:t.telegram||old.telegram,website:t.website||old.website,image:t.image||old.image,creator:t.creator||old.creator,
    buys:freshFlow?t.buys:old.buys,sells:freshFlow?t.sells:old.sells,flowObserved:freshFlow||old.flowObserved,
    flowUpdatedAt:freshFlow?t.flowUpdatedAt:old.flowUpdatedAt,flowSource:freshFlow?t.flowSource:old.flowSource,
    vol:freshVol?t.vol:old.vol,volumeObserved:freshVol||old.volumeObserved,volumeUpdatedAt:freshVol?t.volumeUpdatedAt:old.volumeUpdatedAt,volumeSource:freshVol?t.volumeSource:old.volumeSource,
    liq:freshLiq?t.liq:old.liq,liquidityObserved:freshLiq||old.liquidityObserved,liquidityUpdatedAt:freshLiq?t.liquidityUpdatedAt:old.liquidityUpdatedAt,liquiditySource:freshLiq?t.liquiditySource:old.liquiditySource,
    liquidityKind:freshLiq?t.liquidityKind:old.liquidityKind,curveDepthUsd:t.curveDepthUsd||old.curveDepthUsd||0,inferredSolUsd:t.inferredSolUsd||old.inferredSolUsd||0,
    chainFlow:old.chainFlow||[],boosts:Math.max(t.boosts||0,old.boosts||0)
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
  const hist=(t.history||[]).filter(x=>x.price>0),age=ageMin(t),ts=now();
  const one=hist.at(-1)||{price:t.price},five=hist[Math.max(0,hist.length-5)]||one,twenty=hist[Math.max(0,hist.length-20)]||five;
  const shortRet=pct(t.price,one.price),mediumRet=pct(t.price,five.price),longRet=pct(t.price,twenty.price);
  const momentum=clamp(50+Math.tanh(shortRet/12)*24+Math.tanh(mediumRet/35)*26);
  const acceleration=clamp(50+Math.tanh((shortRet-mediumRet/Math.max(1,Math.min(5,hist.length)))/10)*50);
  const chain=(t.chainFlow||[]).filter(e=>ts-e.ts<90000),chainBuys=chain.filter(e=>e.action==='BUY').length,chainSells=chain.filter(e=>e.action==='SELL').length,chainVol=chain.reduce((a,e)=>a+num(e.notionalUsd),0);
  const windowFlowFresh=!!t.flowObserved&&ts-num(t.flowUpdatedAt)<90000,chainFresh=chain.length>0,flowFresh=windowFlowFresh||chainFresh;
  const volumeFresh=(!!t.volumeObserved&&ts-num(t.volumeUpdatedAt)<90000)||chainVol>0,liqFresh=!!t.liquidityObserved&&ts-num(t.liquidityUpdatedAt)<180000;
  const buys=windowFlowFresh?t.buys:chainBuys,sells=windowFlowFresh?t.sells:chainSells,total=buys+sells; const buyRatio=total?buys/total:.5;
  const flow=clamp(buyRatio*100);
  const liqScore=liqFresh&&t.liq>0?clamp(Math.log10(Math.max(10,t.liq))*18-30):0;
  const activeVol=(!!t.volumeObserved&&ts-num(t.volumeUpdatedAt)<90000)?t.vol:chainVol;
  const volScore=volumeFresh&&activeVol>0?clamp(Math.log10(Math.max(10,activeVol))*17-25):0;
  const early=clamp(100-age*2.6);
  const graduation=t.graduated?100:clamp((t.mc/69000)*100);
  const social=clamp((t.twitter?20:0)+(t.telegram?16:0)+(t.website?9:0)+Math.min(20,t.boosts*3)+(flowFresh?Math.min(20,total*.9):0));
  const sourceSet=Object.entries(t.sourceSeen||{}).filter(([,v])=>ts-num(v)<180000).map(([k])=>k);
  if(chainFresh&&!sourceSet.includes('solana-rpc'))sourceSet.push('solana-rpc');
  const freshSources=sourceSet.length,sourceQuality=clamp(freshSources*34);
  const dna=creatorDNA(t);
  const creatorRisk=clamp((dna.launches>=4?12:0)+(dna.collapses>=2?20:0)-(dna.graduates?10:0));
  const drawdown=t.peakPrice>0?pct(t.price,t.peakPrice):0;
  const recentLow=hist.slice(-20).reduce((m,x)=>x.price>0?Math.min(m,x.price):m,t.price);
  const rebound=recentLow>0?pct(t.price,recentLow):0;
  const stalePenalty=(!flowFresh?10:0)+(!volumeFresh?7:0)+(!liqFresh?14:0);
  const risk=clamp(72-liqScore*.32-(total>8?8:0)+(age<.6?9:0)+(t.website?0:3)+(t.twitter||t.telegram?0:4)+creatorRisk-sourceQuality*.07+stalePenalty);
  const score=clamp(momentum*.20+acceleration*.10+flow*.18+liqScore*.13+volScore*.14+early*.05+social*.07+(100-risk)*.09+sourceQuality*.04);
  return {momentum,acceleration,shortRet,mediumRet,longRet,drawdown,rebound,flow,flowFresh,buyRatio,totalTx:total,age,liqScore,liqFresh,volScore,volumeFresh,early,graduation,social,risk,score,sourceQuality,freshSources,creatorRisk};
}

function strategyRegimeWeight(id,regime){
  const rows=trades.filter(t=>t.strategy===id&&t.policyVersion===STRATEGY_ERA&&(t.entryRegime||'UNKNOWN')===regime).slice(0,120);
  if(rows.length<3)return 1;
  const edge=rows.reduce((a,t)=>a+t.pnlPct,0)/rows.length;
  const learned=clamp(1+edge/45,.45,2.0);const trust=rows.length/(rows.length+12);
  return learned*trust+1*(1-trust);
}

function specialistEligibility(d,t,f=features(t)){
  if(!d.specialist)return{ok:true,reason:'core'};
  const dna=creatorDNA(t),age=f.age,ratio=t.mc>0?t.liq/t.mc:0,regime=marketWeather().regime;
  if(Number.isFinite(d.mcMin)&&t.mc<d.mcMin)return{ok:false,reason:'below market-cap floor'};
  if(Number.isFinite(d.mcMax)&&t.mc>=d.mcMax)return{ok:false,reason:'above market-cap ceiling'};
  if(Number.isFinite(d.tokenAgeMin)&&age<d.tokenAgeMin)return{ok:false,reason:'too young'};
  if(Number.isFinite(d.tokenAgeMax)&&age>=d.tokenAgeMax)return{ok:false,reason:'too old'};
  if(Number.isFinite(d.liqMin)&&t.liq<d.liqMin)return{ok:false,reason:'below liquidity floor'};
  if(Number.isFinite(d.liqMax)&&t.liq>=d.liqMax)return{ok:false,reason:'above liquidity ceiling'};
  if(Number.isFinite(d.liqMcRatioMin)&&ratio<d.liqMcRatioMin)return{ok:false,reason:'liquidity ratio too low'};
  if(Number.isFinite(d.buyRatioMin)&&f.buyRatio<d.buyRatioMin)return{ok:false,reason:'buyer pressure too low'};
  if(Number.isFinite(d.buyRatioMax)&&f.buyRatio>d.buyRatioMax)return{ok:false,reason:'buyer pressure too high'};
  if(d.requireTwitter&&!t.twitter)return{ok:false,reason:'X metadata required'};
  if(d.requireWebsite&&!t.website)return{ok:false,reason:'website required'};
  if(d.noSocial&&(t.twitter||t.website))return{ok:false,reason:'metadata present'};
  if(Number.isFinite(d.sourceMin)&&(t.sources?.length||0)<d.sourceMin)return{ok:false,reason:'not cross-checked'};
  if(d.repeatCleanCreator&&!(dna.launches>=2&&dna.collapses===0))return{ok:false,reason:'creator DNA mismatch'};
  if(d.firstObservedCreator&&dna.launches>1)return{ok:false,reason:'repeat creator'};
  if(d.regime&&regime!==d.regime)return{ok:false,reason:'wrong market regime'};
  if(d.requireGraduated===true&&!t.graduated)return{ok:false,reason:'not graduated'};
  if(d.requireGraduated===false&&t.graduated)return{ok:false,reason:'already graduated'};
  return{ok:true,reason:'specialist population match'};
}

function specialistScore(d,f,t){
  const mode=d.scoreMode||'quality';
  if(mode==='early')return clamp(f.early*.28+f.momentum*.24+f.flow*.22+f.volScore*.18+(100-f.risk)*.08);
  if(mode==='momentum')return clamp(f.momentum*.36+f.flow*.26+f.volScore*.22+f.liqScore*.10+(100-f.risk)*.06);
  if(mode==='flow')return clamp(f.flow*.42+f.momentum*.24+f.volScore*.20+f.liqScore*.08+(100-f.risk)*.06);
  if(mode==='social')return clamp(f.social*.34+f.flow*.22+f.momentum*.20+f.volScore*.16+(100-f.risk)*.08);
  if(mode==='contrarian')return clamp((f.momentum>35&&f.momentum<62?72:34)*.30+(100-f.risk)*.30+f.liqScore*.20+f.flow*.20);
  if(mode==='creator')return clamp(f.flow*.24+f.momentum*.20+f.volScore*.18+f.liqScore*.12+(100-f.risk)*.20+f.sourceQuality*.06);
  return clamp(f.liqScore*.24+f.volScore*.20+f.flow*.20+f.momentum*.14+(100-f.risk)*.22);
}

function strategyScore(d,f,t) {
  const sid=d.parentId||d.id,q=tokenDataQuality(t),wallet=verifiedWalletSignal(t,d.copyWindowMin||15,d.copySource||null);
  if(d.specialist)return specialistScore(d,f,t);
  let s=f.score;
  if(sid==='banker')s=f.liqScore*.24+f.flow*.16+f.volScore*.13+f.momentum*.18+f.acceleration*.10+(100-f.risk)*.19;
  else if(sid==='quant')s=f.score+(f.buyRatio>.60?6:-5)+(q.sourceCount>=2?7:-6)+(f.acceleration>52?4:0);
  else if(sid==='smart')s=f.flow*.23+f.volScore*.14+f.momentum*.17+f.acceleration*.10+(100-f.risk)*.16+q.score*.10+Math.min(18,wallet.count*12);
  else if(sid==='social')s=f.social*.25+f.momentum*.20+f.acceleration*.10+f.flow*.18+f.volScore*.12+(100-f.risk)*.15;
  else if(sid==='momentum')s=f.momentum*.34+f.acceleration*.20+f.flow*.22+f.volScore*.14+f.liqScore*.10;
  else if(sid==='graduation')s=(t.graduated?28:0)+f.flow*.18+f.momentum*.16+f.acceleration*.10+f.volScore*.12+f.liqScore*.08+(100-f.risk)*.08;
  else if(sid==='dip')s=clamp(45+Math.max(-20,f.drawdown)*.35+f.rebound*.45+f.acceleration*.18+f.flow*.16+(100-f.risk)*.12);
  else if(sid==='swing')s=f.liqScore*.22+f.volScore*.13+f.flow*.16+f.momentum*.14+f.acceleration*.08+(100-f.risk)*.17+q.score*.10;
  else if(sid==='degen')s=f.early*.18+f.momentum*.25+f.acceleration*.18+f.flow*.20+f.volScore*.11+(100-f.risk)*.08;
  else if(sid==='smartmom')s=f.momentum*.27+f.acceleration*.17+f.flow*.25+f.volScore*.12+(100-f.risk)*.12+q.score*.07;
  else if(sid==='culture')s=f.social*.19+f.momentum*.20+f.acceleration*.12+f.flow*.21+f.volScore*.12+(100-f.risk)*.10+q.score*.06;
  else if(sid==='contrarian')s=clamp(42+f.rebound*.50+f.acceleration*.18+(100-f.risk)*.16+f.liqScore*.12);
  else if(sid==='sniper')s=f.score*.45+q.score*.18+f.momentum*.12+f.acceleration*.10+f.flow*.10+(100-f.risk)*.05;
  else if(sid==='champion'){const e=evidenceStack(t,f,q);s=f.score*.55+q.score*.18+f.acceleration*.10+Math.min(17,e.n*2.4);}
  else if(sid==='professional')s=f.liqScore*.20+f.volScore*.10+f.flow*.14+f.momentum*.10+f.acceleration*.06+(100-f.risk)*.22+q.score*.18;
  else if(sid==='adaptive'){const e=evidenceStack(t,f,q);s=f.score*.58+q.score*.18+f.acceleration*.08+Math.min(16,e.n*2.2);}
  else if(sid==='copy_unipcs')s=f.score*.45+q.score*.18+(100-f.risk)*.10+Math.min(27,wallet.count*27);
  else if(sid==='copy_frank')s=f.score*.48+q.score*.20+(100-f.risk)*.10+Math.min(22,wallet.count*22);
  else if(sid==='copy_orangie')s=f.score*.46+q.score*.22+(100-f.risk)*.12+Math.min(20,wallet.count*20);
  else if(sid==='copy_rasmr')s=f.momentum*.19+f.acceleration*.17+f.flow*.18+q.score*.16+(100-f.risk)*.10+Math.min(20,wallet.count*20);
  else if(sid==='copy_megga')s=f.early*.12+f.momentum*.12+f.acceleration*.12+f.flow*.11+q.score*.08+(100-f.risk)*.08+Math.min(37,wallet.count*37);
  else if(sid==='megga_scout')s=f.early*.27+f.momentum*.18+f.acceleration*.20+f.flow*.18+f.volScore*.07+(100-f.risk)*.05+q.score*.05;
  else if(sid==='wallet_consensus')s=f.score*.40+q.score*.18+f.acceleration*.10+Math.min(32,wallet.count*16);
  else if(sid==='confirmed_runner')s=f.momentum*.25+f.acceleration*.20+f.flow*.20+q.score*.14+f.liqScore*.10+(100-f.risk)*.11;
  else if(sid==='asym_swing')s=f.liqScore*.19+q.score*.18+f.flow*.14+f.momentum*.14+f.acceleration*.10+(100-f.risk)*.20+f.volScore*.05;
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
  const f=features(t),adv=adversarialRisk(t),q=tokenDataQuality(t),regime=marketWeather().regime,votes=[];
  for(const d of strategyDefs.filter(x=>x.risk!=='CONTROL'&&!x.specialist)){
    const score=strategyScore(d,f,t),p=entryPolicy(d),g=entryGuard(d,t,f,score,p,q,adv,regime),weight=strategyRegimeWeight(d.id,regime)*diversityWeight(d.id);
    votes.push({id:d.id,name:d.name,icon:d.icon,score,yes:g.ok&&score>=p.min,threshold:g.requiredScore||p.min,baseThreshold:d.min,blocked:!g.ok,why:g.reason,weight});
  }
  const yes=votes.filter(v=>v.yes).length,totalWeight=votes.reduce((a,v)=>a+v.weight,0)||1,yesWeight=votes.filter(v=>v.yes).reduce((a,v)=>a+v.weight,0);
  return {yes,total:votes.length,pct:votes.length?yes/votes.length*100:0,weightedPct:yesWeight/totalWeight*100,hardVeto:adv.hardVeto,votes};
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
function positionMarkPrice(p){
  const live=tokens.get(p.mint)?.price;
  if(live>0)return live;
  if(p.lastPrice>0)return p.lastPrice;
  return p.entry>0?p.entry:0;
}
function markEquity(d){
  let e=d.cash;
  for(const p of positions.filter(x=>x.strategy===d.id&&!x.closed)){
    const px=positionMarkPrice(p);if(px>0)e+=p.units*px;
  }
  d.equity=e;d.peak=Math.max(d.peak,e);d.dd=Math.max(d.dd,(1-e/d.peak)*100);
}

function recordDecision(d,t,f,score,action,why='') {
  const row={ts:now(),era:STRATEGY_ERA,strategy:d.id,strategyName:d.name,mint:t.mint,symbol:t.symbol,action,score,risk:f.risk,price:t.price,mc:t.mc,narrative:t.narrative,regime:marketWeather().regime,why,
    features:{momentum:f.momentum,acceleration:f.acceleration,flow:f.flow,buyRatio:f.buyRatio,volScore:f.volScore,liqScore:f.liqScore,drawdown:f.drawdown,rebound:f.rebound,social:f.social,age:f.age,sourceQuality:f.sourceQuality}};
  decisions.unshift(row); decisions.splice(MAX_DECISIONS);
  const key=`${d.id}:${t.mint}`;
  if(!opportunities.has(key)) opportunities.set(key,{...row,firstTs:row.ts,firstPrice:t.price,bestReturn:0,worstReturn:0,latestReturn:0,entered:action==='BUY'});
  else if(action==='BUY'){const o=opportunities.get(key);o.entered=true;o.action='BUY';o.entryTs=row.ts;o.entryPrice=t.price;o.score=score;o.risk=f.risk;o.why=why;o.regime=row.regime;}
}

function updateOpportunities(t) {
  for(const [key,o] of opportunities){if(o.mint!==t.mint||!o.firstPrice)continue;const r=pct(t.price,o.firstPrice);o.latestReturn=r;o.bestReturn=Math.max(o.bestReturn,r);o.worstReturn=Math.min(o.worstReturn,r);o.lastTs=now();}
}

function percentile(xs,q){
  const a=xs.filter(Number.isFinite).sort((x,y)=>x-y);if(!a.length)return null;
  const i=Math.min(a.length-1,Math.max(0,Math.floor((a.length-1)*q)));return a[i];
}
function verifiedWalletSignal(t,windowMin=15,traderId=null){
  const cutoff=now()-windowMin*60000,events=walletEvents.filter(e=>e.mint===t.mint&&e.watchlist&&e.ts>=cutoff&&(!traderId||e.traderId===traderId)&&WATCHED_WALLET_LOOKUP.get(e.wallet)?.confidence==='verified');
  const latest=new Map();
  for(const e of events.sort((a,b)=>b.ts-a.ts))if(e.traderId&&!latest.has(e.traderId))latest.set(e.traderId,e);
  const active=[...latest.values()].filter(e=>e.action==='BUY');
  const chase=active.map(e=>e.price>0?pct(t.price,e.price):null).filter(Number.isFinite);
  return{count:active.length,traders:active.map(e=>e.traderId),freshestMin:active.length?Math.min(...active.map(e=>(now()-e.ts)/60000)):null,
    avgChase:chase.length?avg(chase):null,maxChase:chase.length?Math.max(...chase):null,events:active};
}

const CORE_PLAYBOOKS={
  banker:{minQuality:62,minBuy:.49,maxBuy:.78,minTx:8,maxRisk:58,minMomentum:58,minAccel:46,minLiq:8000,minAge:1,instruction:'confirmation first; winners need real momentum; small losses are acceptable but catastrophic stops are not'},
  quant:{minQuality:66,minBuy:.49,maxBuy:.78,minTx:10,maxRisk:58,minMomentum:55,minAccel:48,minLiq:10000,minAge:1,requireCross:true,instruction:'multi-factor agreement from fresh independent data; reject anything with a missing market leg'},
  smart:{minQuality:62,minBuy:.56,maxBuy:.82,minTx:8,maxRisk:62,minMomentum:52,minAccel:46,minLiq:7000,minAge:.5,walletCount:1,walletWindow:20,instruction:'verified tracked-wallet buy is mandatory; flow alone is never smart money'},
  social:{minQuality:62,minBuy:.56,maxBuy:.82,minTx:8,maxRisk:62,minMomentum:55,minAccel:48,minLiq:7000,minAge:1,requireSocial2:true,instruction:'social presence is a prior, never a trigger; require at least two channels plus market confirmation'},
  momentum:{minQuality:62,minBuy:.52,maxBuy:.82,minTx:10,maxRisk:64,minMomentum:72,minAccel:55,minLiq:7000,minAge:.5,instruction:'buy acceleration with fresh buyers; never chase stale historical momentum'},
  graduation:{minQuality:65,minBuy:.52,maxBuy:.82,minTx:8,maxRisk:60,minMomentum:55,minAccel:48,minLiq:12000,minAge:1,requireGraduated:true,requireCross:true,instruction:'only confirmed irreversible graduation with observed post-migration liquidity'},
  dip:{minQuality:62,minBuy:.52,maxBuy:.80,minTx:10,maxRisk:60,minMomentum:45,minAccel:55,minLiq:9000,minAge:3,drawMin:-35,drawMax:-6,minRebound:3,instruction:'pullback must stop falling and rebound; no one-tick dip buying'},
  swing:{minQuality:68,minBuy:.50,maxBuy:.78,minTx:10,maxRisk:58,minMomentum:52,minAccel:45,minLiq:15000,minAge:5,requireCross:true,instruction:'deep observed liquidity and stable structure; preserve upside with a long runner'},
  degen:{minQuality:58,minBuy:.58,maxBuy:.86,minTx:5,maxRisk:70,minMomentum:72,minAccel:55,minLiq:3000,minAge:.3,maxAge:4,instruction:'tiny early starter only after real transactions, liquidity and acceleration appear'},
  smartmom:{minQuality:68,minBuy:.61,maxBuy:.86,minTx:10,maxRisk:60,minMomentum:68,minAccel:52,minLiq:9000,minAge:.5,instruction:'strong buyer pressure plus acceleration and quality; use the confirmation challenger lesson'},
  culture:{minQuality:64,minBuy:.52,maxBuy:.78,minTx:8,maxRisk:62,minMomentum:60,minAccel:50,minLiq:8000,minSocial:35,minAge:1,instruction:'culture/narrative only counts when attention is confirmed by market behavior'},
  contrarian:{minQuality:66,minBuy:.50,maxBuy:.75,minTx:8,maxRisk:58,minMomentum:42,maxMomentum:65,minAccel:54,minLiq:12000,minAge:4,drawMin:-28,drawMax:-5,minRebound:2,instruction:'mean reversion requires evidence of recovery; never buy weakness alone'},
  sniper:{minQuality:74,minBuy:.60,maxBuy:.82,minTx:12,maxRisk:52,minMomentum:70,minAccel:55,minLiq:12000,minAge:1,requireCross:true,instruction:'rare cross-checked setup; quality and acceleration must both be exceptional'},
  champion:{minQuality:70,minBuy:.55,maxBuy:.82,minTx:10,maxRisk:58,minMomentum:62,minAccel:52,minLiq:10000,minAge:1,minEvidence:5,instruction:'act only when independent evidence stacks; staying in cash beats forced action'},
  professional:{minQuality:74,minBuy:.49,maxBuy:.76,minTx:12,maxRisk:50,minMomentum:52,minAccel:46,minLiq:18000,minAge:2,requireCross:true,instruction:'protect capital first; no single-source or thin-liquidity bets'},
  adaptive:{minQuality:68,minBuy:.54,maxBuy:.82,minTx:10,maxRisk:60,minMomentum:58,minAccel:50,minLiq:9000,minAge:1,minEvidence:4,instruction:'ensemble only high-quality independent evidence; ignore losing-peer consensus'},
  confirmed_runner:{minQuality:72,minBuy:.58,maxBuy:.82,minTx:10,maxRisk:60,minMomentum:72,minAccel:56,minLiq:10000,minAge:.5,requireCross:true,instruction:'fresh multi-source breakout with acceleration; trail the winner rather than predict a fixed top'},
  asym_swing:{minQuality:72,minBuy:.50,maxBuy:.78,minTx:12,maxRisk:56,minMomentum:58,minAccel:50,minLiq:18000,minAge:3,requireCross:true,instruction:'small downside budget for rare large upside; never average down'},
  megga_scout:{minQuality:52,minBuy:.50,maxBuy:.90,minTx:4,maxRisk:70,minMomentum:55,minAccel:44,minLiq:2500,minAge:.05,maxAge:5,mcMin:3000,mcMax:100000,minEvidence:3,instruction:'tiny early micro-cap probes only; accept many small misses, never average down, scale out confirmed winners and preserve a runner'}
};
function strategyPlaybook(d){
  const id=d.parentId||d.id;
  if(CORE_PLAYBOOKS[id])return CORE_PLAYBOOKS[id];
  if(d.copyLab){
    const base={minQuality:62,minBuy:.52,maxBuy:.86,minTx:5,maxRisk:64,minMomentum:50,minAccel:45,minLiq:7000,minAge:.5,instruction:d.thesis};
    if(d.id==='copy_unipcs')return{...base,minQuality:60,maxRisk:66,minBuy:.52};
    if(d.id==='copy_frank')return{...base,minQuality:64,maxRisk:62,minBuy:.55};
    if(d.id==='copy_orangie')return{...base,minQuality:66,maxRisk:58,minBuy:.57};
    if(d.id==='copy_rasmr')return{...base,minQuality:60,maxRisk:64,minBuy:.60,minAccel:52};
    if(d.id==='copy_megga')return{...base,minQuality:48,maxRisk:70,minBuy:.48,maxBuy:.92,minTx:3,minMomentum:50,minAccel:40,minLiq:2500,minAge:.05,maxAge:10,mcMax:250000};
    if(d.id==='wallet_consensus')return{...base,minQuality:68,maxRisk:60,minBuy:.58,minMomentum:58,minAccel:50};
    return base;
  }
  if(d.specialist){
    const low=d.risk==='LOW',high=d.risk==='HIGH'||d.risk==='EXTREME',cohort=d.cohort||'';
    let minBuy=.50,maxBuy=.86,minMomentum=high?56:46,minAccel=44,minTx=6;
    if(cohort==='ORDER FLOW'){minBuy=0;maxBuy=1;minMomentum=45;}
    if(cohort==='TOKEN AGE'){minBuy=.48;minAccel=48;}
    if(cohort==='METADATA'||cohort==='CREATOR DNA'){minBuy=.50;minMomentum=50;}
    return{minQuality:low?68:high?60:64,minBuy,maxBuy,minTx,maxRisk:low?56:high?68:62,minMomentum,minAccel,minLiq:low?12000:5000,minAge:.4,
      instruction:`${d.thesis}; cohort eligibility is necessary but fresh observed liquidity, transaction depth and confirmation are still mandatory`};
  }
  return{minQuality:60,minBuy:.55,maxRisk:64,minMomentum:50,minAccel:45,minLiq:5000,minAge:.5,instruction:d.thesis};
}
function evidenceStack(t,f,q){
  let n=0;if(q.score>=70)n++;if(f.buyRatio>=.62)n++;if(f.momentum>=68)n++;if(f.acceleration>=55)n++;if(f.risk<=55)n++;if(q.sourceCount>=2)n++;if(f.liqScore>=45)n++;
  const w=verifiedWalletSignal(t,15);if(w.count)n++;if(w.count>=2)n++;
  return{n,wallets:w.count};
}
function entryPolicy(d){
  const rows=decisions.filter(x=>x.strategy===d.id&&x.era===STRATEGY_ERA).slice(0,250);
  const rejects=rows.filter(x=>x.action==='REJECT').length,scores=rows.map(x=>num(x.score)).filter(Number.isFinite);
  const p90=percentile(scores,.90);
  // V3 can tighten a gate as evidence arrives, but it never lowers the authored floor merely to force trades.
  const effectiveMin=rows.length>=50&&Number.isFinite(p90)?Math.max(d.min,p90):d.min;
  const p=strategyPlaybook(d);
  return{coldStart:!rows.some(x=>x.action==='BUY'),rejects,relief:0,min:effectiveMin,baseMin:d.min,p90,p25Risk:null,
    lowRiskLimit:p.maxRisk??58,sniperRiskLimit:p.maxRisk??52,customRiskLimit:d.riskCap||p.maxRisk||null};
}

function strategyHealth(d){
  const rows=trades.filter(x=>x.strategy===d.id&&x.policyVersion===STRATEGY_ERA).slice(0,8);
  return{n:rows.length,avg:rows.length?avg(rows.map(x=>x.pnlPct)):0,winRate:rows.length?rows.filter(x=>x.pnl>0).length/rows.length*100:0};
}
function entryGuard(d,t,f,score,policy,quality,adv,regime){
  if(d.risk==='CONTROL')return{ok:true,reason:'benchmark/control',requiredScore:policy.min,minQuality:0,minBuyRatio:0,health:strategyHealth(d),playbook:{instruction:d.thesis}};
  const h=strategyHealth(d),p=strategyPlaybook(d),stack=evidenceStack(t,f,quality);
  let scoreBuffer=0,minQuality=p.minQuality??60,minBuyRatio=p.minBuy??.55,maxRisk=p.maxRisk??64;
  if(regime==='RISK OFF'){scoreBuffer+=4;minQuality+=4;minBuyRatio+=.03;maxRisk-=3;}
  if(h.n>=4&&h.avg<0){scoreBuffer+=3;minQuality+=3;minBuyRatio+=.02;}
  if(h.n>=5&&h.avg<=-8){scoreBuffer+=4;maxRisk-=3;}
  const learned=Number.isFinite(policy.p90)?policy.p90:policy.min,requiredScore=Math.max(policy.min,learned+scoreBuffer);
  const fail=reason=>({ok:false,reason,requiredScore,minQuality,minBuyRatio,health:h,playbook:p,stack});
  if(quality.score<minQuality)return fail('abstain: data quality');
  if(p.requireCross&&quality.sourceCount<2)return fail('abstain: cross-source confirmation');
  if(!f.flowFresh||!f.liqFresh)return fail('abstain: stale or unobserved market data');
  if(f.totalTx<(p.minTx??0))return fail('abstain: insufficient transaction depth');
  if(f.buyRatio<minBuyRatio||f.buyRatio>(p.maxBuy??1))return fail('abstain: buyer pressure shape');
  if(f.risk>maxRisk||adv.score>=72)return fail('abstain: structural risk');
  if(f.momentum<(p.minMomentum??0)||f.momentum>(p.maxMomentum??100))return fail('abstain: momentum shape');
  if(f.acceleration<(p.minAccel??0))return fail('abstain: no acceleration');
  if(t.liq<(p.minLiq??0))return fail('abstain: thin liquidity');
  if(f.age<(p.minAge??0)||f.age>(p.maxAge??Infinity))return fail('abstain: wrong age window');
  if(Number.isFinite(p.mcMin)&&t.mc<p.mcMin)return fail('abstain: market cap below playbook');
  if(Number.isFinite(p.mcMax)&&t.mc>p.mcMax)return fail('abstain: market cap above playbook');
  if(Number.isFinite(p.walletCount)){
    const smartSignal=verifiedWalletSignal(t,p.walletWindow||15);
    if(smartSignal.count<p.walletCount)return fail('abstain: smart-wallet confirmation');
  }
  if(Number.isFinite(p.drawMin)&&f.drawdown<p.drawMin)return fail('abstain: pullback too deep');
  if(Number.isFinite(p.drawMax)&&f.drawdown>p.drawMax)return fail('abstain: no qualifying pullback');
  if(Number.isFinite(p.minRebound)&&f.rebound<p.minRebound)return fail('abstain: rebound unconfirmed');
  if(Number.isFinite(p.minSocial)&&f.social<p.minSocial)return fail('abstain: attention unconfirmed');
  if(p.requireSocial2&&[!!t.twitter,!!t.telegram,!!t.website].filter(Boolean).length<2)return fail('abstain: social channels incomplete');
  if(p.requireGraduated&&!t.graduated)return fail('abstain: graduation unconfirmed');
  if(Number.isFinite(p.minEvidence)&&stack.n<p.minEvidence)return fail('abstain: evidence stack');
  if(d.copyLab){
    const signal=verifiedWalletSignal(t,d.copyWindowMin||15,d.copySource||null);
    const need=d.consensusWallets||1;
    if(signal.count<need)return fail('abstain: verified wallet signal');
    if(Number.isFinite(signal.maxChase)&&signal.maxChase>(d.maxChase??10))return fail('abstain: copy chase limit');
  }
  if(score<requiredScore)return fail('abstain: edge buffer');
  return{ok:true,reason:'v3 evidence stack passed',requiredScore,minQuality,minBuyRatio,health:h,playbook:p,stack};
}

function maybeTrade(t) {
  const f=features(t),adv=adversarialRisk(t),quality=tokenDataQuality(t),similar=dnaSimilarity(t);
  for(const d of allTraders()){
    markEquity(d);
    const existing=positions.find(p=>p.strategy===d.id&&p.mint===t.mint&&!p.closed);
    if(existing){
      if(manageCopyPosition(d,existing,t))continue;
      if(manageScaleOut(d,existing,t))continue;
      const ex=exitDecision(d,existing,t,f);if(ex.exit)closePos(d,existing,t,ex.why);continue;
    }
    const eligibility=specialistEligibility(d,t,f);
    if(!eligibility.ok)continue;
    if(openCount(d.id)>=d.maxOpen||d.cash<25||!(t.price>0))continue;
    const score=strategyScore(d,f,t);const policy=entryPolicy(d);const regime=marketWeather().regime;
    const lowBlocked=d.risk==='LOW'&&f.risk>policy.lowRiskLimit;
    const sniperBlocked=(d.parentId==='sniper'||d.id==='sniper')&&f.risk>policy.sniperRiskLimit;
    const customBlocked=policy.customRiskLimit&&f.risk>policy.customRiskLimit;
    const guard=entryGuard(d,t,f,score,policy,quality,adv,regime);
    if(score<policy.min||lowBlocked||sniperBlocked||customBlocked||adv.hardVeto||!guard.ok){
      if(!opportunities.has(`${d.id}:${t.mint}`))recordDecision(d,t,f,score,'REJECT',score<policy.min?'below threshold':adv.hardVeto?'adversarial veto':!guard.ok?guard.reason:'risk veto');
      continue;
    }
    let sizeMult=1;
    if(regime==='RISK OFF'){if(['degen','champion'].includes(d.id))sizeMult=.4;else if(d.risk==='LOW'||d.id==='professional')sizeMult=.65;else sizeMult=.5;}
    if(regime==='HOT'&&['champion','momentum','smartmom'].includes(d.id))sizeMult=1.15;
    if(guard.health.n>=5&&guard.health.avg<0)sizeMult*=.65;
    if(guard.health.n>=5&&guard.health.avg<=-8)sizeMult*=.6;
    const confidence=clamp((score-policy.min)/28+.75,.65,1.35);
    const qualityMult=clamp(.7+quality.score/180,.7,1.22);
    const dnaMult=similar.n>=6?clamp(.85+(similar.hit25/100)*.35,.85,1.2):1;
    const allocatorMult=d.type==='challenger'?1:allocationWeight(d.id);
    if(d.id==='adaptive')sizeMult*=clamp(.65+(score-60)/45,.55,1.35);
    sizeMult*=confidence*qualityMult*dnaMult*allocatorMult*(d.sizeBias||1);
    sizeMult=clamp(sizeMult,.25,1.35);
    const authoredSize=d.risk==='CONTROL'?d.size:Math.min(d.size,.04);
    const budget=Math.min(d.cash*(d.risk==='CONTROL' ? .38 : .20),Math.max(10,d.equity*authoredSize*sizeMult));
    const slip=.0035+Math.min(.04,budget/Math.max(1000,t.liq)*.5);const entry=t.price*(1+slip);const cost=budget*(1+FEE_RATE);
    if(cost>d.cash)continue;
    d.cash-=cost;
    const exploratory=false;
    const p={id:'p'+now()+Math.random(),strategy:d.id,mint:t.mint,symbol:t.symbol,entry,units:budget/entry,originalUnits:budget/entry,invested:budget,realizedProceeds:0,partialExits:[],scaleOutHits:[],sourceEntrySig:d.copyLab?(verifiedWalletSignal(t,d.copyWindowMin||15,d.copySource||null).events[0]?.signature||null):null,opened:now(),closed:false,lastPrice:t.price,lastMarkedAt:now(),markSource:'entry',score,entryFeatures:{...f,mc:t.mc,liq:t.liq},entryMc:t.mc,entryLiq:t.liq,entryQuality:quality.score,dnaHit25:similar.hit25,dnaSample:similar.n,allocationMult:allocatorMult,exitMode:exitModeFor(d),policyVersion:STRATEGY_ERA,guard:{requiredScore:guard.requiredScore,minQuality:guard.minQuality,minBuyRatio:guard.minBuyRatio,recentAvg:guard.health.avg,recentN:guard.health.n},reason:`${exploratory?'cold-start exploration · ':''}score ${score.toFixed(0)} · gate ${policy.min.toFixed(0)} · risk ${f.risk.toFixed(0)} · Q${quality.score.toFixed(0)} · size×${sizeMult.toFixed(2)}`,entryRegime:regime,peakDuring:entry,troughDuring:entry};
    positions.push(p);recordDecision(d,t,f,score,'BUY',p.reason);
    if(d.risk!=='R&D')log('buy',`${d.icon} ${d.name} bought ${t.symbol} · ${budget.toFixed(0)} paper · ${p.reason}`,'good',{strategy:d.id,mint:t.mint});
  }
}

function updateOpenPositionExtremes(t){for(const p of positions){if(p.closed||p.mint!==t.mint)continue;p.lastPrice=t.price;p.lastMarkedAt=now();p.markSource=(t.sources||[]).join('+')||'live';p.peakDuring=Math.max(p.peakDuring||p.entry,t.price);p.troughDuring=Math.min(p.troughDuring||p.entry,t.price);}}

function closePos(d,p,t,why){
  const slip=.0035+Math.min(.04,p.invested/Math.max(1000,t.liq)*.5);const exit=t.price*(1-slip);const gross=p.units*exit;const proceeds=gross*(1-FEE_RATE);
  d.cash+=proceeds;p.closed=true;p.closedAt=now();p.exit=exit;const totalProceeds=num(p.realizedProceeds)+proceeds;p.pnl=totalProceeds-p.invested*(1+FEE_RATE);p.pnlPct=p.pnl/(p.invested*(1+FEE_RATE))*100;p.why=why;
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
  const old=tokens.get(incoming.mint);const t=mergeToken(old,incoming);tokens.set(t.mint,t);updateCreator(t);updateOpportunities(t);updateOpenPositionExtremes(t);updateCounterfactuals(t);updateDnaArchive(t);recordMarketEvent(t,source);
  if(!old)log('token',`🪙 LIVE token spotted: ${t.symbol} · ${t.name}`,'info',{mint:t.mint,source});
  maybeTrade(t);broadcast('tick',{mint:t.mint});
}

async function fetchJson(url){const r=await fetch(url,{headers:{accept:'application/json','user-agent':'PUMP-LAB-LIVE/0.9'}});if(!r.ok)throw Error(`HTTP ${r.status}`);return r.json();}
async function pumpPoll(){
  try{const u='https://frontend-api-v3.pump.fun/coins?offset=0&limit=60&sort=created_timestamp&order=DESC&includeNsfw=false';const j=await fetchJson(u);const rows=Array.isArray(j)?j:(j.data||j.coins||[]);if(!rows.length)throw Error('no rows');rows.forEach(x=>ingest(x,'pump.fun'));setHealth('pump.fun','ok',`Live launch/state snapshots · ${rows.length} coins`,{truth:'observed'});}catch(e){setHealth('pump.fun','warn',`Snapshot feed unavailable: ${e.message}`);}
}
async function openPositionPoll(){
  try{
    const mints=[...new Set(positions.filter(p=>!p.closed).map(p=>p.mint).filter(Boolean))].slice(0,120);
    if(!mints.length){setHealth('open-marks','ok','No open positions require dedicated marks',{truth:'observed'});return;}
    let updated=0;
    for(let i=0;i<mints.length;i+=30){
      const chunk=mints.slice(i,i+30);
      const pairs=await fetchJson('https://api.dexscreener.com/tokens/v1/solana/'+chunk.join(','));
      const best=new Map();
      for(const p of (Array.isArray(pairs)?pairs:[])){const a=p.baseToken?.address;if(!a)continue;const cur=best.get(a);if(!cur||(p.liquidity?.usd||0)>(cur.liquidity?.usd||0))best.set(a,p);}
      for(const [mint,pair] of best){
        const incoming=normalize({...pair,mint},'dexscreener-open');
        if(!incoming||!(incoming.price>0))continue;
        const old=tokens.get(mint),t=mergeToken(old,incoming);tokens.set(mint,t);
        updateOpportunities(t);updateOpenPositionExtremes(t);updateCounterfactuals(t);updateDnaArchive(t);recordMarketEvent(t,'dexscreener-open');
        const touched=new Set();
        for(const pos of positions.filter(x=>!x.closed&&x.mint===mint)){
          if(touched.has(pos.strategy))continue;touched.add(pos.strategy);
          const d=allTraders().find(x=>x.id===pos.strategy);if(!d)continue;
          const ex=exitDecision(d,pos,t,features(t));if(ex.exit)closePos(d,pos,t,ex.why);else markEquity(d);
        }
        updated++;
      }
    }
    setHealth('open-marks','ok',`Dedicated marks · ${updated}/${mints.length} open mints refreshed`,{truth:'observed'});
  }catch(e){setHealth('open-marks','warn','Open-position mark refresh failed: '+e.message,{truth:'observed'});}
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
      setHealth('fomo-watchlist','standby',`Waiting for ${watched.length} watched-wallet subscription acknowledgements`,{truth:'observed'});
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
        if(m.id>=1000)setHealth('fomo-watchlist','ok',`${Math.min(watched,Math.max(0,solanaSubAcks-1))}/${watched} watched-wallet streams acknowledged`,{truth:'observed'});
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
async function hydrateWalletMint(mint){
  try{
    const p=await fetchJson('https://frontend-api-v3.pump.fun/coins/'+encodeURIComponent(mint));
    if(p&&typeof p==='object')ingest(p,'pump.fun-wallet');
  }catch{}
  try{
    const pairs=await fetchJson('https://api.dexscreener.com/tokens/v1/solana/'+encodeURIComponent(mint));
    const best=(Array.isArray(pairs)?pairs:[]).sort((a,b)=>(b.liquidity?.usd||0)-(a.liquidity?.usd||0))[0];
    if(best)ingest({...best,mint},'dexscreener-wallet');
  }catch{}
  return tokens.get(mint)||null;
}
async function parseWalletTx(sig,tx){
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
    const watch=WATCHED_WALLET_LOOKUP.get(x.owner);let tok=tokens.get(x.mint);
    if(watch?.confidence==='verified')tok=await hydrateWalletMint(x.mint)||tok;
    const solDelta=solDeltaFor(tx,x.owner);
    let action=delta>0?'BUY':'SELL',classification='token-balance delta';
    if(watch&&!hasPump){
      if(delta>0&&solDelta>=-.0001)action='TOKEN_IN';
      if(delta<0&&solDelta<=.0001)action='TOKEN_OUT';
      classification=(action==='BUY'||action==='SELL')?'token + native SOL delta':'direction observed; trade not yet proven';
    }else if(hasPump)classification='Pump.fun program + token delta';
    const event={ts:now(),blockTime:tx?.blockTime?tx.blockTime*1000:null,slot:tx?.slot||null,signature:sig,wallet:x.owner,mint:x.mint,symbol:tok?.symbol||x.mint.slice(0,5),action,tokenDelta:delta,tokenPre:x.pre,tokenPost:x.post,sellFraction:delta<0&&x.pre>0?clamp((-delta)/x.pre,0,1):null,solDelta,price:tok?.price||0,mc:tok?.mc||0,classification,source:'Solana RPC',watchlist:!!watch,traderId:watch?.traderId||null,traderName:watch?.traderName||null,walletLabel:watch?.label||null,confidence:watch?.confidence||null};
    walletEvents.unshift(event);walletEvents.splice(1200); found++;
    if(watch)log('smart-wallet',`👀 ${watch.traderName} · ${action} · ${event.symbol}`,'info',{traderId:watch.traderId,wallet:x.owner,mint:x.mint,signature:sig,confidence:watch.confidence});
    if(tok){
      tok.chainBuys=num(tok.chainBuys)+(action==='BUY'?1:0);tok.chainSells=num(tok.chainSells)+(action==='SELL'?1:0);tok.chainTx=num(tok.chainTx)+1;tok.lastChainAt=now();
      tok.chainFlow=(tok.chainFlow||[]).filter(e=>now()-e.ts<120000);
      if(action==='BUY'||action==='SELL')tok.chainFlow.push({ts:now(),action,notionalUsd:Math.abs(delta)*num(tok.price),watchlist:!!watch,traderId:watch?.traderId||null});
      if(watch?.confidence==='verified'&&(action==='BUY'||action==='SELL'))maybeTrade(tok);
    }
  }
  if(found)solanaResolved++;
}
async function drainSolanaQueue(){
  const sig=solanaQueue.shift(); if(!sig)return;
  try{const tx=await rpcTransaction(sig);if(tx)await parseWalletTx(sig,tx);setHealth('wallet-intel','ok',`Observed on-chain wallet activity · ${solanaResolved} resolved transactions`,{truth:'observed'});}
  catch(e){if(/429/.test(e.message))setHealth('wallet-intel','warn','Public RPC rate limited · queue retained',{truth:'observed'});else setHealth('wallet-intel','warn','Wallet resolver: '+e.message,{truth:'observed'});}
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
    return{id:trader.id,name:trader.name,status:trader.status||((trader.wallets||[]).length?'tracking':'resolving'),profileUrl:trader.profileUrl||'',walletHint:trader.walletHint||'',walletCount:trader.wallets.length,
      wallets:trader.wallets.map(w=>({address:w.address,label:w.label,confidence:w.confidence})),events:ev.length,buys:buys.length,sells:sells.length,
      directional:ev.filter(e=>e.action==='TOKEN_IN'||e.action==='TOKEN_OUT').length,tokens:mints.size,last:ev[0]?.ts||0,marked:marked.length?avg(marked):null,sample:marked.length};
  });
}

function missedMonsters(){return [...opportunities.values()].filter(o=>o.era===STRATEGY_ERA&&o.action==='REJECT'&&o.bestReturn>75).sort((a,b)=>b.bestReturn-a.bestReturn).slice(0,25);}
function savedMyAss(){return [...opportunities.values()].filter(o=>o.era===STRATEGY_ERA&&o.action==='REJECT'&&o.worstReturn<-55).sort((a,b)=>a.worstReturn-b.worstReturn).slice(0,25);}
function hallOfFame(){return trades.filter(t=>!t.strategy.includes('-c')).sort((a,b)=>b.pnlPct-a.pnlPct).slice(0,20);}
function worstTrades(){return trades.filter(t=>!t.strategy.includes('-c')).sort((a,b)=>a.pnlPct-b.pnlPct).slice(0,20);}
function creatorLeaderboard(){return [...creators.values()].map(c=>({...c,tokens:[...c.tokens]})).sort((a,b)=>b.launches-a.launches||b.bestPeakX-a.bestPeakX).slice(0,30);}


function productionTrades(eraOnly=false){return trades.filter(t=>{const d=strategyDefs.find(x=>x.id===t.strategy);return !t.strategy.includes('-c')&&!['random','volume','launchctl','socialctl'].includes(t.strategy)&&!d?.specialist&&(!eraOnly||t.policyVersion===STRATEGY_ERA);});}
function specialistTrades(eraOnly=false){return trades.filter(t=>strategyDefs.find(d=>d.id===t.strategy)?.specialist&&(!eraOnly||t.policyVersion===STRATEGY_ERA));}
function avg(xs){return xs.length?xs.reduce((a,b)=>a+b,0)/xs.length:0;}
function bandStats(rows,getBand){
  const m=new Map();for(const r of rows){const k=getBand(r);if(!m.has(k))m.set(k,[]);m.get(k).push(r);}
  return [...m].map(([band,a])=>({band,n:a.length,avgPnl:avg(a.map(x=>x.pnlPct)),winRate:a.filter(x=>x.pnlPct>0).length/a.length*100,avgMfe:avg(a.map(x=>x.mfe||0)),avgMae:avg(a.map(x=>x.mae||0))})).sort((a,b)=>b.avgPnl-a.avgPnl);
}
function confidenceCalibration(){
  const rows=[...opportunities.values()].filter(o=>o.era===STRATEGY_ERA&&o.entered&&Number.isFinite(o.score)&&Number.isFinite(o.bestReturn));
  const defs=[[50,60],[60,70],[70,80],[80,90],[90,101]];
  return defs.map(([lo,hi])=>{const a=rows.filter(o=>o.score>=lo&&o.score<hi);return{band:`${lo}-${hi===101?'100':hi-1}`,n:a.length,hitRate:a.length?a.filter(o=>o.bestReturn>=25).length/a.length*100:0,avgBest:avg(a.map(o=>o.bestReturn)),avgWorst:avg(a.map(o=>o.worstReturn))};});
}
function entryLab(){
  const rows=productionTrades(true);
  return{
    score:bandStats(rows,t=>{const x=t.score||0;return x>=85?'85+':x>=75?'75-84':x>=65?'65-74':'<65';}),
    risk:bandStats(rows,t=>{const x=t.entryFeatures?.risk||0;return x<35?'risk <35':x<50?'risk 35-49':x<65?'risk 50-64':'risk 65+';}),
    age:bandStats(rows,t=>{const x=t.entryFeatures?.age||0;return x<2?'<2m':x<5?'2-5m':x<15?'5-15m':'15m+';})
  };
}
function exitLab(){
  const rows=productionTrades(true);const usable=rows.filter(t=>t.counterfactual);
  const hold=k=>avg(usable.map(t=>t.counterfactual?.holdAfterExit?.[k]).filter(Number.isFinite));
  const capture=usable.filter(t=>(t.mfe||0)>0).map(t=>Math.max(0,t.pnlPct)/Math.max(1,t.mfe)*100);
  return{n:usable.length,actual:avg(usable.map(t=>t.pnlPct)),avgMfe:avg(usable.map(t=>t.mfe||0)),capture:avg(capture),oneMin:hold('oneMin'),fiveMin:hold('fiveMin'),fifteenMin:hold('fifteenMin'),leftOnTable:avg(usable.map(t=>Math.max(0,(t.counterfactual?.bestObservedAfterExit||0))))};
}
function sizingLab(){
  const rows=productionTrades(true);const total=rows.reduce((a,t)=>a+(t.pnl||0),0);
  return[.5,1,1.5,2].map(mult=>({mult,totalPnl:total*mult,stressDrawdown:avg(rows.map(t=>Math.max(0,-t.pnlPct)*mult)),label:mult===1?'CURRENT':mult<1?'DEFENSIVE':'AGGRESSIVE'}));
}
function executionLab(){
  const rows=productionTrades(true).filter(t=>t.executionStress);
  const sum=k=>rows.reduce((a,t)=>a+(t.executionStress?.[k]||0),0);
  return{n:rows.length,easyAvg:avg(rows.map(t=>t.executionStress.easy)),realisticAvg:avg(rows.map(t=>t.executionStress.realistic)),nightmareAvg:avg(rows.map(t=>t.executionStress.nightmare)),easyTotal:sum('easy'),realisticTotal:sum('realistic'),nightmareTotal:sum('nightmare')};
}
function benchmarkStats(){
  strategyDefs.forEach(markEquity);
  const ids=['champion','professional','adaptive','random','volume','launchctl','socialctl'];
  return ids.map(id=>{const d=strategyDefs.find(x=>x.id===id);return{id,name:d.name,equity:d.equity,returnPct:(d.equity/START-1)*100,dd:d.dd,n:d.n,winRate:d.n?d.wins/d.n*100:0};});
}
function godBot(){
  const rows=productionTrades(true);const favorable=rows.filter(t=>(t.mfe||0)>0);
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
  const ids=strategyDefs.filter(d=>d.risk!=='CONTROL'&&!d.specialist&&!['adaptive','champion','professional'].includes(d.id)).map(d=>d.id);
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
  const ts=now(),ageSec=Math.max(0,(ts-t.updatedAt)/1000),f=features(t);
  const freshSources=Object.entries(t.sourceSeen||{}).filter(([,v])=>ts-num(v)<180000).map(([k])=>k);
  if((t.chainFlow||[]).some(e=>ts-e.ts<90000)&&!freshSources.includes('solana-rpc'))freshSources.push('solana-rpc');
  const freshness=clamp(100-ageSec*2),cross=freshSources.length>=2?100:freshSources.length?45:0;
  const liq=f.liqFresh?100:0,flow=f.flowFresh?100:0,volume=f.volumeFresh?100:0,depth=clamp(Math.log10(1+f.totalTx)*45);
  const score=clamp(freshness*.20+cross*.20+liq*.20+flow*.18+volume*.12+depth*.10);
  return{score,freshness,sourceCount:freshSources.length,sources:freshSources,ageSec,market:clamp(f.liqScore*.65+Math.min(35,f.totalTx*1.5)),
    observed:{liquidity:f.liqFresh,flow:f.flowFresh,volume:f.volumeFresh},level:ageSec>90?'STALE':freshSources.length>=2?'CROSS-CHECKED':score>=60?'OBSERVED':'PARTIAL'};
}


function pipelineSafe(x){return Number.isFinite(Number(x))?Number(x):0;}
function median(xs){
  const a=xs.filter(Number.isFinite).slice().sort((x,y)=>x-y);if(!a.length)return 0;
  const m=Math.floor(a.length/2);return a.length%2?a[m]:(a[m-1]+a[m])/2;
}
function stdev(xs){
  const a=xs.filter(Number.isFinite);if(a.length<2)return 0;const m=avg(a);
  return Math.sqrt(a.reduce((s,x)=>s+(x-m)*(x-m),0)/(a.length-1));
}
function tokenDNA(t){
  const f=features(t),dna=creatorDNA(t),q=tokenDataQuality(t),tx=(t.buys||0)+(t.sells||0);
  return{
    momentum:f.momentum,flow:f.flow,liquidity:f.liqScore,volume:f.volScore,early:f.early,
    graduation:f.graduation,social:f.social,risk:f.risk,sourceQuality:f.sourceQuality,
    dataQuality:q.score,creatorRisk:f.creatorRisk,buyPressure:f.buyRatio*100,
    txDepth:clamp(Math.log10(1+tx)*32),marketCap:clamp(Math.log10(Math.max(1,t.mc))*13-25),
    repeatCreator:dna.repeatCreator?100:0,hasTwitter:t.twitter?100:0,hasWebsite:t.website?100:0
  };
}
function dnaDistance(a,b){
  const weights={momentum:1.2,flow:1.3,liquidity:1,volume:1.15,early:.9,graduation:.8,social:.8,risk:1.35,sourceQuality:.75,dataQuality:1,creatorRisk:1.2,buyPressure:1.3,txDepth:.8,marketCap:.9,repeatCreator:.55,hasTwitter:.3,hasWebsite:.3};
  let s=0,w=0;for(const [k,v] of Object.entries(weights)){const d=(num(a?.[k])-num(b?.[k]))/100;s+=v*d*d;w+=v;}
  return Math.sqrt(s/Math.max(.001,w));
}
function updateDnaArchive(t){
  if(!(t.price>0))return;let a=dnaArchive.get(t.mint);
  if(!a){a={mint:t.mint,symbol:t.symbol,name:t.name,firstTs:now(),firstPrice:t.price,firstMc:t.mc,narrative:t.narrative,creator:t.creator||'',dna:tokenDNA(t),peakReturn:0,worstReturn:0,lastReturn:0,graduated:!!t.graduated,observations:0};dnaArchive.set(t.mint,a);}
  const r=pct(t.price,a.firstPrice);a.peakReturn=Math.max(a.peakReturn,r);a.worstReturn=Math.min(a.worstReturn,r);a.lastReturn=r;a.graduated=a.graduated||!!t.graduated;a.observations++;
  if(dnaArchive.size>MAX_DNA_ARCHIVE){const oldest=[...dnaArchive.values()].sort((x,y)=>x.firstTs-y.firstTs)[0];if(oldest)dnaArchive.delete(oldest.mint);}
}
function dnaSimilarity(t,limit=12){
  const q=tokenDNA(t);const rows=[...dnaArchive.values()].filter(x=>x.mint!==t.mint&&x.observations>=2&&now()-x.firstTs>=5*60000)
    .map(x=>({...x,distance:dnaDistance(q,x.dna),similarity:clamp((1-dnaDistance(q,x.dna))*100)})).sort((a,b)=>a.distance-b.distance).slice(0,limit);
  return{n:rows.length,avgSimilarity:avg(rows.map(x=>x.similarity)),hit25:rows.length?rows.filter(x=>x.peakReturn>=25).length/rows.length*100:0,
    hit100:rows.length?rows.filter(x=>x.peakReturn>=100).length/rows.length*100:0,avgPeak:avg(rows.map(x=>x.peakReturn)),avgWorst:avg(rows.map(x=>x.worstReturn)),
    matches:rows.slice(0,6).map(x=>({mint:x.mint,symbol:x.symbol,similarity:x.similarity,peakReturn:x.peakReturn,worstReturn:x.worstReturn,narrative:x.narrative}))};
}
function adversarialRisk(t){
  const f=features(t),dna=creatorDNA(t),q=tokenDataQuality(t),flags=[];let score=f.risk;
  if(q.score<35){score+=12;flags.push('weak data quality');}
  if((t.sources||[]).length<2){score+=5;flags.push('single source');}
  if(dna.launches>=5&&dna.collapses>=2){score+=18;flags.push('repeat creator with multiple observed collapses');}
  if((t.buys+t.sells)>=8&&f.buyRatio<.34){score+=15;flags.push('sell pressure dominates');}
  if(t.liq>0&&t.mc/t.liq>35){score+=12;flags.push('market cap / liquidity imbalance');}
  score=clamp(score);return{score,flags,hardVeto:score>=82,reason:flags.join(' · ')||'no independent hard veto'};
}
function recordMarketEvent(t,source){
  const ts=now(),last=marketEventClock.get(t.mint)||0;if(ts-last<7000)return;marketEventClock.set(t.mint,ts);
  const f=features(t),dna=tokenDNA(t),quality=tokenDataQuality(t),regime=marketWeather().regime;
  const scores={};for(const d of strategyDefs.filter(x=>x.risk!=='CONTROL'))scores[d.id]=strategyScore(d,f,t);
  const row={ts,era:STRATEGY_ERA,mint:t.mint,symbol:t.symbol,source,price:t.price,mc:t.mc,liq:t.liq,vol:t.vol,buys:t.buys,sells:t.sells,narrative:t.narrative,regime,features:{...f},dna,quality:quality.score,scores};
  marketEvents.push(row);while(marketEvents.length>MAX_MARKET_EVENTS)marketEvents.shift();
  pendingDbEvents.push(row);if(pendingDbEvents.length>1500)pendingDbEvents.shift();
}
function replayLab(){
  const rows=[...dnaArchive.values()].filter(x=>x.observations>=2&&now()-x.firstTs>=5*60000);const out=[];
  for(const d of strategyDefs.filter(x=>x.risk!=='CONTROL'&&!x.specialist)){
    const seen=new Set(),signals=[];
    for(const e of marketEvents){if(e.era!==STRATEGY_ERA||seen.has(e.mint)||e.scores?.[d.id]==null)continue;const gate=Math.max(0,entryPolicy(d).min);if(e.scores[d.id]>=gate){seen.add(e.mint);const o=dnaArchive.get(e.mint);if(o&&o.observations>=2)signals.push(o);}}
    out.push({id:d.id,name:d.name,n:signals.length,hit25:signals.length?signals.filter(x=>x.peakReturn>=25).length/signals.length*100:0,hit100:signals.length?signals.filter(x=>x.peakReturn>=100).length/signals.length*100:0,avgPeak:avg(signals.map(x=>x.peakReturn)),avgWorst:avg(signals.map(x=>x.worstReturn))});
  }
  return{events:marketEvents.length,archive:rows.length,strategies:out.sort((a,b)=>(b.hit25-a.hit25)||(b.avgPeak-a.avgPeak)).slice(0,12)};
}
function walletGraphSnapshot(){
  const byMint=new Map();for(const e of walletEvents){if(!e.wallet||!e.mint)continue;if(!byMint.has(e.mint))byMint.set(e.mint,[]);byMint.get(e.mint).push(e);}
  const edges=new Map(),nodes=new Map();
  for(const e of walletEvents){let n=nodes.get(e.wallet)||{wallet:e.wallet,events:0,mints:new Set(),watchlist:!!e.watchlist,traderName:e.traderName||null,last:0};n.events++;n.mints.add(e.mint);n.last=Math.max(n.last,e.ts);nodes.set(e.wallet,n);}
  for(const es of byMint.values()){const wallets=[...new Set(es.map(x=>x.wallet))];for(let i=0;i<wallets.length;i++)for(let j=i+1;j<wallets.length;j++){const a=wallets[i],b=wallets[j],key=[a,b].sort().join('|');const prev=edges.get(key)||{a,b,shared:0,mints:new Set()};prev.shared++;for(const e of es)prev.mints.add(e.mint);edges.set(key,prev);}}
  const eout=[...edges.values()].map(x=>({a:x.a,b:x.b,shared:x.shared,mints:x.mints.size,aName:nodes.get(x.a)?.traderName||null,bName:nodes.get(x.b)?.traderName||null})).sort((a,b)=>b.shared-a.shared).slice(0,40);
  const nout=[...nodes.values()].map(x=>({wallet:x.wallet,events:x.events,mints:x.mints.size,watchlist:x.watchlist,traderName:x.traderName,last:x.last,degree:eout.filter(e=>e.a===x.wallet||e.b===x.wallet).length})).sort((a,b)=>b.degree-a.degree||b.events-a.events).slice(0,40);
  return{nodes:nout,edges:eout,clusters:eout.filter(x=>x.shared>=2).length};
}
function strategyStatistics(){
  return strategyDefs.filter(d=>d.risk!=='CONTROL'&&!d.specialist).map(d=>{
    const all=trades.filter(t=>t.strategy===d.id),a=all.filter(t=>t.policyVersion===STRATEGY_ERA),rets=a.map(t=>t.pnlPct).filter(Number.isFinite),m=avg(rets),sd=stdev(rets),se=rets.length?sd/Math.sqrt(rets.length):0;
    const grossWin=a.filter(t=>t.pnl>0).reduce((sum,t)=>sum+t.pnl,0),grossLoss=Math.abs(a.filter(t=>t.pnl<0).reduce((sum,t)=>sum+t.pnl,0));
    const shrink=rets.length/(rets.length+20),shrunkMean=m*shrink;
    return{id:d.id,name:d.name,n:rets.length,legacyN:all.length-rets.length,mean:m,median:median(rets),stdev:sd,ciLow:m-1.96*se,ciHigh:m+1.96*se,shrunkMean,
      winRate:rets.length?a.filter(t=>t.pnlPct>0).length/rets.length*100:0,profitFactor:grossLoss?grossWin/grossLoss:grossWin>0?9.99:0,dd:d.dd,equity:d.equity};
  }).sort((a,b)=>b.shrunkMean-a.shrunkMean);
}
function dynamicAllocator(){
  const regime=marketWeather().regime,stats=strategyStatistics();const rows=stats.map(st=>{
    const d=strategyDefs.find(x=>x.id===st.id),reg=strategyRegimeWeight(st.id,regime),sample=st.n/(st.n+20);
    const evidence=st.n>=3?clamp(1+st.shrunkMean/35,.55,1.55):1;
    const independence=diversityWeight(st.id),raw=Math.max(.10,reg*(.75+.25*sample)*evidence*independence);
    return{id:st.id,name:st.name,raw,n:st.n,legacyN:st.legacyN,shrunkMean:st.shrunkMean,dd:st.dd,risk:d?.risk||'MED'};
  });const sum=rows.reduce((a,x)=>a+x.raw,0)||1;
  return{regime,era:STRATEGY_ERA,weights:rows.map(x=>({...x,pct:x.raw/sum*100})).sort((a,b)=>b.pct-a.pct),concentration:rows.length?Math.max(...rows.map(x=>x.raw/sum*100)):0};
}
function allocationWeight(id){
  const a=dynamicAllocator(),w=a.weights.find(x=>x.id===id);if(!w)return 1;
  const equal=100/Math.max(1,a.weights.length);return clamp(w.pct/equal,.55,1.65);
}
function exitModeFor(d){
  if(d.exitMode)return d.exitMode;
  const id=d.parentId||d.id;if(['banker','professional','sniper'].includes(id))return'defensive';
  if(['momentum','smartmom','champion','degen','confirmed_runner'].includes(id))return'runner';
  if(['swing','dip','contrarian','asym_swing'].includes(id))return'structure';
  return'balanced';
}
function partialClose(d,p,t,fraction,why){
  if(!(p.units>0)||!(t.price>0))return false;
  const frac=clamp(fraction,.05,.80),units=p.units*frac,notional=units*t.price;
  const slip=.0035+Math.min(.04,notional/Math.max(1000,t.liq)*.5),exit=t.price*(1-slip),proceeds=units*exit*(1-FEE_RATE);
  p.units=Math.max(0,p.units-units);p.realizedProceeds=num(p.realizedProceeds)+proceeds;
  p.partialExits=p.partialExits||[];p.partialExits.push({ts:now(),why,fraction:frac,units,exit,proceeds});
  d.cash+=proceeds;markEquity(d);
  if(d.risk!=='R&D')log('trim',`${d.icon} ${d.name} trimmed ${Math.round(frac*100)}% of ${t.symbol} · ${why}`,'good',{strategy:d.id,mint:t.mint});
  return true;
}
function manageScaleOut(d,p,t){
  if(!d.scaleOut)return false;
  const pnl=pct(t.price,p.entry),levels=[30,75,150,300];p.scaleOutHits=p.scaleOutHits||[];
  const level=levels.find(x=>pnl>=x&&!p.scaleOutHits.includes(x));if(!level)return false;
  const frac=level>=150?.25:.20;if(partialClose(d,p,t,frac,`runner scale-out +${level}%`)){p.scaleOutHits.push(level);return true;}return false;
}
function manageCopyPosition(d,p,t){
  if(!d.copyLab||!d.copySource)return false;
  const ev=walletEvents.find(e=>e.traderId===d.copySource&&e.mint===p.mint&&e.ts>=p.opened&&e.signature!==p.lastCopySignal&&(e.action==='SELL'||e.action==='TOKEN_OUT'));
  if(!ev)return false;p.lastCopySignal=ev.signature;
  const full=ev.action==='SELL'&&(num(ev.tokenPost)<=1e-12||num(ev.sellFraction)>=.80);
  if(full){closePos(d,p,t,'source wallet exited');return true;}
  return partialClose(d,p,t,Number.isFinite(ev.sellFraction)?clamp(ev.sellFraction,.15,.60):.25,'source wallet partial sell');
}

function exitDecision(d,p,t,f){
  const mode=exitModeFor(d),pnl=pct(t.price,p.entry),hold=(now()-p.opened)/60000,peakPnl=pct(p.peakDuring||t.price,p.entry),drawFromPeak=peakPnl-pnl;
  let stop=Math.min(d.stop,18),take=d.take,maxHold=d.maxHold||60;
  if(mode==='scalp'){maxHold=Math.min(maxHold,28);stop=Math.min(stop,10);take=Math.min(take,50);}
  if(mode==='defensive'){maxHold=Math.min(maxHold,60);stop=Math.min(stop,12);}
  if(mode==='runner')maxHold=Math.max(maxHold,120);
  if(mode==='structure')maxHold=Math.max(maxHold,180);
  if(mode==='conviction')maxHold=Math.max(maxHold,720);
  const trailFrac=mode==='conviction' ? .48 : mode==='runner' ? .36 : .30;
  const trailing=peakPnl>=18&&drawFromPeak>=Math.max(7,peakPnl*trailFrac);
  const catastrophic=(f.flowFresh&&f.buyRatio<.28)||(f.risk>=84);
  const fade=f.flowFresh&&f.acceleration<38&&f.momentum<42&&f.buyRatio<((mode==='runner'||mode==='conviction') ? .38 : .44);
  if(catastrophic&&hold>.75)return{exit:true,why:'catastrophic thesis break',mode};
  if(pnl<=-stop)return{exit:true,why:'stop',mode};
  if(pnl>=take&&!d.scaleOut)return{exit:true,why:'take profit',mode};
  if(trailing)return{exit:true,why:'trailing peak protection',mode};
  if(hold>maxHold)return{exit:true,why:'time exit',mode};
  if(fade&&hold>(mode==='scalp'?1.5:3))return{exit:true,why:'thesis broke',mode};
  return{exit:false,mode};
}
function exitOptimizer(){
  const e=exitLab(),rows=productionTrades().filter(t=>t.counterfactual);const one=avg(rows.map(t=>t.counterfactual?.holdAfterExit?.oneMin).filter(Number.isFinite)),five=avg(rows.map(t=>t.counterfactual?.holdAfterExit?.fiveMin).filter(Number.isFinite));
  const early=rows.filter(t=>(t.counterfactual?.bestObservedAfterExit||0)>=25&&t.pnlPct<15).length;
  const late=rows.filter(t=>t.mae<=-25&&t.pnlPct<0).length;
  let direction='COLLECTING';if(rows.length>=8){if(five>8&&early>late)direction='TEST LONGER HOLDS';else if(late>early)direction='TEST TIGHTER RISK';else direction='CURRENT MIX BALANCED';}
  return{n:rows.length,direction,capture:e.capture,oneMin:one,fiveMin:five,earlyExitCandidates:early,lateExitCandidates:late,modes:['defensive','balanced','runner','structure']};
}
function opportunityCostLab(){
  const rows=productionTrades().slice(0,250).map(t=>{const missed=[...opportunities.values()].filter(o=>o.strategy===t.strategy&&o.action==='REJECT'&&o.firstTs>=t.opened&&o.firstTs<=t.closedAt);const best=missed.length?Math.max(...missed.map(o=>o.bestReturn||0)):0;return{strategy:t.strategy,symbol:t.symbol,actual:t.pnlPct,bestMissed:best,cost:Math.max(0,best-t.pnlPct)};});
  return{n:rows.length,avgCost:avg(rows.map(x=>x.cost)),highCost:rows.filter(x=>x.cost>=50).length,worst:rows.sort((a,b)=>b.cost-a.cost).slice(0,10)};
}

function specialistCohortStats(){
  const activeTokens=[...tokens.values()].filter(t=>now()-t.updatedAt<900000);
  const traders=specialistStrategies().map(d=>{
    markEquity(d);const a=trades.filter(t=>t.strategy===d.id),eligibleNow=activeTokens.filter(t=>specialistEligibility(d,t,features(t)).ok).length;
    return{id:d.id,name:d.name,icon:d.icon,cohort:d.cohort,thesis:d.thesis,risk:d.risk,equity:d.equity,pnl:d.equity-START,n:d.n,
      winRate:d.n?d.wins/d.n*100:0,dd:d.dd,open:openCount(d.id),eligibleNow,entryGate:entryPolicy(d).min};
  }).sort((a,b)=>b.equity-a.equity);
  const groups=[...new Set(traders.map(x=>x.cohort))].map(name=>{
    const rows=traders.filter(x=>x.cohort===name),closed=rows.reduce((a,x)=>a+x.n,0);
    return{name,traders:rows,capital:rows.reduce((a,x)=>a+x.equity,0),start:rows.length*START,closed,open:rows.reduce((a,x)=>a+x.open,0)};
  });
  return{count:traders.length,capital:traders.reduce((a,x)=>a+x.equity,0),start:traders.length*START,trades:traders.reduce((a,x)=>a+x.n,0),open:traders.reduce((a,x)=>a+x.open,0),groups,traders};
}
function scientistInsights(){
  const hypotheses=[];const stats=strategyStatistics(),replay=replayLab(),op=opportunityCostLab(),ex=exitOptimizer();
  const bestReplay=replay.strategies.find(x=>x.n>=5);if(bestReplay)hypotheses.push({kind:'entry',text:`${bestReplay.name} replay signals currently show ${bestReplay.hit25.toFixed(0)}% reaching +25% in the captured archive.`,evidence:{n:bestReplay.n,avgPeak:bestReplay.avgPeak}});
  if(ex.n>=8&&ex.direction!=='CURRENT MIX BALANCED')hypotheses.push({kind:'exit',text:`${ex.direction}: post-exit continuation and adverse excursion evidence justify a controlled exit challenger.`,evidence:{n:ex.n,capture:ex.capture,fiveMin:ex.fiveMin}});
  if(op.n>=8&&op.avgCost>15)hypotheses.push({kind:'capital',text:`Observed opportunity cost is elevated at ${op.avgCost.toFixed(1)} percentage points on average; allocator should penalize long low-edge holds.`,evidence:{n:op.n,highCost:op.highCost}});
  const proven=stats.filter(x=>x.n>=10&&x.ciLow>0);if(proven.length)hypotheses.push({kind:'statistics',text:`${proven[0].name} has a positive 95% mean-return interval in the current sample; keep validating before promotion.`,evidence:{n:proven[0].n,ciLow:proven[0].ciLow,ciHigh:proven[0].ciHigh}});
  return hypotheses.slice(0,8);
}
function providerAudit(){
  const rows=[...health.values()].map(x=>{const ageSec=Math.max(0,(now()-x.ts)/1000);const live=x.status==='ok';const score=live?clamp(100-ageSec*1.5):(x.status==='standby'?25:10);return{...x,ageSec,score};});
  const counted=rows.filter(x=>!['x-social','wallet-intel'].includes(x.component));
  return{rows,overall:counted.length?avg(counted.map(x=>x.score)):0,stale:rows.filter(x=>x.status==='ok'&&x.ageSec>90).map(x=>x.component)};
}
function noTradeAlpha(){
  const a=[...opportunities.values()].filter(o=>o.era===STRATEGY_ERA&&o.action==='REJECT'&&now()-o.firstTs>5*60000);
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
  const regimes=['HOT','SELECTIVE','RISK OFF'];return regimes.map(regime=>{const rows=strategyDefs.filter(d=>d.risk!=='CONTROL'&&!d.specialist).map(d=>{const a=trades.filter(t=>t.strategy===d.id&&(t.entryRegime||'UNKNOWN')===regime);return{name:d.name,id:d.id,n:a.length,avgPnl:avg(a.map(t=>t.pnlPct)),winRate:a.length?a.filter(t=>t.pnlPct>0).length/a.length*100:0};}).filter(x=>x.n>0).sort((a,b)=>b.avgPnl-a.avgPnl);return{regime,leaders:rows.slice(0,5)};});
}
function masterAllocation(){
  const regime=marketWeather().regime;const peers=strategyDefs.filter(d=>d.risk!=='CONTROL'&&!d.specialist&&!['adaptive','champion','professional'].includes(d.id));
  const raw=peers.map(d=>({id:d.id,name:d.name,weight:strategyRegimeWeight(d.id,regime)}));const sum=raw.reduce((a,x)=>a+x.weight,0)||1;
  return{regime,weights:raw.map(x=>({...x,pct:x.weight/sum*100})).sort((a,b)=>b.pct-a.pct).slice(0,10)};
}
function riskScoreboard(){
  return strategyDefs.filter(d=>d.risk!=='CONTROL'&&!d.specialist).map(d=>{
    const rows=trades.filter(t=>t.strategy===d.id&&t.policyVersion===STRATEGY_ERA),losses=rows.filter(t=>t.pnlPct<0),avgLoss=Math.abs(avg(losses.map(t=>t.pnlPct)));
    let curve=START,peak=START,maxDd=0;for(const t of [...rows].sort((a,b)=>a.closedAt-b.closedAt)){curve+=num(t.pnl);peak=Math.max(peak,curve);maxDd=Math.max(maxDd,(1-curve/Math.max(1,peak))*100);}
    const ret=(curve/START-1)*100,riskAdjusted=ret/Math.max(5,maxDd),ruinProxy=clamp(maxDd*1.4+avgLoss*.7+(d.risk==='EXTREME'?12:d.risk==='HIGH'?6:0));
    return{id:d.id,name:d.name,era:STRATEGY_ERA,ret,dd:maxDd,riskAdjusted,ruinProxy,n:rows.length};
  }).sort((a,b)=>b.riskAdjusted-a.riskAdjusted);
}
function tournament(){
  const since=now()-24*3600000,map=new Map();
  for(const t of trades.filter(t=>t.policyVersion===STRATEGY_ERA&&t.closedAt>=since&&!t.strategy.includes('-c')&&!strategyDefs.find(d=>d.id===t.strategy)?.specialist)){
    if(!map.has(t.strategy))map.set(t.strategy,{pnl:0,n:0,wins:0});const x=map.get(t.strategy);x.pnl+=t.pnl||0;x.n++;if(t.pnl>0)x.wins++;
  }
  return[...map].map(([id,x])=>{const d=strategyDefs.find(q=>q.id===id);return{id,name:d?.name||id,pnl:x.pnl,n:x.n,winRate:x.n?x.wins/x.n*100:0,era:STRATEGY_ERA};}).sort((a,b)=>b.pnl-a.pnl);
}

function eraPerformance(id){
  const rows=trades.filter(t=>t.strategy===id&&t.policyVersion===STRATEGY_ERA),rets=rows.map(t=>t.pnlPct).filter(Number.isFinite);
  const mean=avg(rets),wins=rows.filter(t=>t.pnl>0),losses=rows.filter(t=>t.pnl<0),grossWin=wins.reduce((z,t)=>z+t.pnl,0),grossLoss=Math.abs(losses.reduce((z,t)=>z+t.pnl,0));
  return{n:rows.length,mean,total:rows.reduce((z,t)=>z+(t.pnl||0),0),winRate:rows.length?wins.length/rows.length*100:0,
    profitFactor:grossLoss?grossWin/grossLoss:grossWin>0?9.99:0,tail:rets.length?percentile(rets,.10):0};
}
function evaluateEvolution(){
  for(const c of challengers){
    const p=strategyDefs.find(x=>x.id===c.parentId);if(!p)continue;
    const child=eraPerformance(c.id),parent=eraPerformance(p.id);if(child.n<30)continue;
    const edge=child.mean-(parent.n>=10?parent.mean:0),tailOk=child.tail>=(parent.n>=10?parent.tail-5:-25);
    if(!c.promotedAt&&edge>5&&child.profitFactor>1.15&&tailOk){
      p.min=c.min;p.stop=c.stop;p.take=c.take;if(c.riskCap)p.riskCap=c.riskCap;if(c.exitMode)p.exitMode=c.exitMode;if(c.sizeBias)p.sizeBias=c.sizeBias;
      p.version=(p.version||3)+1;c.promotedAt=now();const row={ts:now(),era:STRATEGY_ERA,child:c.name,parent:p.name,edge,sample:child.n,profitFactor:child.profitFactor,newVersion:p.version};
      promotions.unshift(row);promotions.splice(100);log('evolution',`🏆 ${c.name} promoted into ${p.name} v${p.version}`,'system',row);
    }else if(!c.graveyardAt&&edge<-8){
      c.graveyardAt=now();const row={ts:now(),era:STRATEGY_ERA,child:c.name,parent:p.name,edge,sample:child.n,reason:'failed v3 forward challenge'};
      graveyard.unshift(row);graveyard.splice(100);log('evolution',`☠️ ${c.name} moved to the Strategy Graveyard`,'system',row);
    }
  }
}
function familyTree(){return strategyDefs.filter(p=>p.risk!=='CONTROL'&&!p.specialist).map(p=>({parent:p.name,version:p.version||1,children:challengers.filter(c=>c.parentId===p.id).map(c=>{const ep=eraPerformance(c.id);return{name:c.name,n:c.n,eraN:ep.n,eraMean:ep.mean,eraProfitFactor:ep.profitFactor,equity:c.equity,dd:c.dd,promotedAt:c.promotedAt||0,graveyardAt:c.graveyardAt||0,mutation:c.mutation};})})).filter(x=>x.children.length);}


function spawnResearchChallenger(){
  const active=challengers.filter(c=>!c.promotedAt&&!c.graveyardAt);if(active.length>=8||challengers.length>=30)return null;
  strategyDefs.filter(d=>d.risk!=='CONTROL'&&!d.specialist).forEach(markEquity);
  const exit=exitOptimizer(),noTrade=noTradeAlpha(),risk=riskScoreboard();
  let parentId='momentum',mutation='longer winners',mods={takeDelta:15};
  if(noTrade.n>=30&&noTrade.falseRejectRate>25){parentId='quant';mutation='confirmation-preserving runner for missed upside';mods={minDelta:2,takeDelta:15,exitMode:'runner'};}
  else if(risk[0]&&risk[0].dd>25){parentId='professional';mutation='defensive drawdown response';mods={minDelta:3,stopDelta:-3,riskCap:34};}
  else if(exit.n>=10&&exit.direction==='TEST LONGER HOLDS'){parentId='smartmom';mutation='runner exit from post-exit continuation evidence';mods={takeDelta:12,exitMode:'runner'};}
  else if(exit.n>=10&&exit.direction==='TEST TIGHTER RISK'){parentId='professional';mutation='defensive exit from adverse-excursion evidence';mods={stopDelta:-3,exitMode:'defensive',riskCap:36};}
  const duplicate=challengers.find(c=>c.parentId===parentId&&c.mutation===mutation&&!c.graveyardAt);if(duplicate)return null;
  const seq=challengers.filter(c=>c.parentId===parentId).length+1,id=`${parentId}-auto-${seq}`;
  const p=strategyDefs.find(x=>x.id===parentId),c=makeChallenger(parentId,id,`${p.name} Mutation ${seq}`,mutation,mods);c.bornAt=now();c.auto=true;challengers.push(c);
  log('evolution',`🧬 Research Director spawned ${c.name}: ${mutation}`,'system',{parentId,id,mods});return c;
}

function researchCycle(){
  evaluateEvolution();
  spawnResearchChallenger();
  const recent=trades.filter(t=>t.policyVersion===STRATEGY_ERA&&now()-t.closedAt<3600000&&!t.strategy.includes('-c'));const wins=recent.filter(t=>t.pnl>0);const avg=recent.length?recent.reduce((a,t)=>a+t.pnlPct,0)/recent.length:0;
  const prod=strategyDefs.filter(d=>d.risk!=='CONTROL'&&!d.specialist);prod.forEach(markEquity);const best=[...prod].sort((a,b)=>b.equity-a.equity)[0];
  const misses=missedMonsters().slice(0,5);const hypotheses=[];
  if(misses.length>=3)hypotheses.push('Rejection thresholds may be too strict for a subset of high-upside tokens; keep testing with challengers rather than relaxing production rules.');
  const badExit=trades.filter(t=>t.counterfactual?.bestObservedAfterExit>35&&t.pnlPct<20).slice(0,10);if(badExit.length>=3)hypotheses.push('Several exits left large continuation on the table; longer-hold challenger variants deserve more sample.');
  const weather=marketWeather();const ex=exitLab();if(ex.n>=5&&ex.capture<45)hypotheses.push('Exit capture is below 45% of observed favorable excursion; prioritize longer-hold exit challengers.');const cal=confidenceCalibration().filter(x=>x.n>=5);if(cal.length&&cal.at(-1)?.hitRate<cal[0]?.hitRate)hypotheses.push('High confidence buckets are not yet better calibrated than lower buckets; confidence scores need more evidence.');if(weather.regime==='RISK OFF')hypotheses.push('Current regime is risk-off; compare defensive strategies against momentum before expanding exposure.');
  for(const h of scientistInsights())hypotheses.push(h.text);
  lastScientistRun=now();
  research={last:now(),notes:[`${recent.length} production exits this hour · ${recent.length?((wins.length/recent.length)*100).toFixed(0):0}% win rate · avg ${avg.toFixed(1)}% · leader ${best?.name||'n/a'}`,'Production strategies remain stable. Challengers use separate paper capital and cannot silently rewrite the incumbent.'],hypotheses};
  log('research','🧪 Research Director completed an hourly review','system',{hypotheses:hypotheses.length});
}

function experimentSnapshot(){
  return challengers.map(c=>{const p=strategyDefs.find(x=>x.id===c.parentId),child=eraPerformance(c.id),parent=eraPerformance(p.id),edge=child.mean-(parent.n>=10?parent.mean:0);let status='COLLECTING';
    if(child.n>=30&&edge>5&&child.profitFactor>1.15)status='PROMOTION CANDIDATE';else if(child.n>=30&&edge<-8)status='GRAVEYARD CANDIDATE';
    return{id:c.id,name:c.name,parent:p.name,mutation:c.mutation,era:STRATEGY_ERA,equity:c.equity,parentEquity:p.equity,edge,sample:child.n,profitFactor:child.profitFactor,status};
  });
}

function takeTimeline(){const w=marketWeather();strategyDefs.forEach(markEquity);timeline.push({ts:now(),regime:w.regime,temperature:w.temperature,capital:strategyDefs.filter(x=>x.risk!=='CONTROL'&&!x.specialist).reduce((a,d)=>a+d.equity,0),champion:strategyDefs.find(x=>x.id==='champion').equity,tokens:tokens.size,topNarrative:narrativeStats()[0]?.name||'n/a'});while(timeline.length>MAX_TIMELINE)timeline.shift();}

async function initDb(restoreState=true){
  if(!DATABASE_URL){setHealth('research-memory','standby','Render Postgres provisioned but DATABASE_URL is not attached to this service yet',{truth:'not connected'});return;}
  if(db||dbConnecting)return;dbConnecting=true;let client=null;
  try{
    const {Client}=await import('pg');
    client=new Client({connectionString:DATABASE_URL,ssl:DATABASE_URL.includes('render.com')?{rejectUnauthorized:false}:undefined});
    client.on('error',e=>{
      if(db===client)db=null;
      setHealth('research-memory','warn','Postgres connection interrupted · reconnecting',{truth:'observed'});
      console.warn('Postgres connection interrupted:',e.message);
      const timer=setTimeout(()=>initDb(!dbStateRestored),5000);timer.unref?.();
    });
    await client.connect();db=client;
    await db.query('CREATE TABLE IF NOT EXISTS pump_lab_state (id text primary key, payload jsonb not null, updated_at timestamptz default now())');
    await db.query('CREATE TABLE IF NOT EXISTS pump_lab_market_events (id bigserial primary key, ts bigint not null, mint text not null, payload jsonb not null)');
    await db.query('CREATE INDEX IF NOT EXISTS pump_lab_market_events_ts_idx ON pump_lab_market_events(ts)');
    await db.query('CREATE INDEX IF NOT EXISTS pump_lab_market_events_mint_idx ON pump_lab_market_events(mint)');
    if(restoreState||!dbStateRestored){
      const r=await db.query("SELECT payload FROM pump_lab_state WHERE id='main'");
      if(r.rows[0]?.payload)restore(r.rows[0].payload);
      dbStateRestored=true;
      logStrategyDiagnostics();
    }
    setHealth('research-memory','ok','Postgres durable memory online',{truth:'observed'});
    console.log('Postgres durable memory online');
  }catch(e){
    if(db===client)db=null;
    try{await client?.end();}catch{}
    setHealth('research-memory','warn','Postgres connection failed · retrying: '+e.message,{truth:'observed'});
    console.warn('Postgres connection failed:',e.message);
    const timer=setTimeout(()=>initDb(!dbStateRestored),10000);timer.unref?.();
  }finally{dbConnecting=false;}
}
function serialize(){return{strategies:strategyDefs.map(stripTrader),challengers:challengers.map(stripTrader),positions,trades,activity,decisions,opportunities:[...opportunities],research,timeline,replayFrames,autopsies,promotions,graveyard,walletEvents:walletEvents.slice(0,1200),marketEvents:marketEvents.slice(-1000),dnaArchive:[...dnaArchive],creators:[...creators].map(([k,v])=>[k,{...v,tokens:[...v.tokens]}])};}
function stripTrader(d){return{id:d.id,name:d.name,icon:d.icon,risk:d.risk,type:d.type,parentId:d.parentId,mutation:d.mutation,auto:d.auto,bornAt:d.bornAt,cash:d.cash,peak:d.peak,dd:d.dd,wins:d.wins,losses:d.losses,n:d.n,version:d.version,min:d.min,stop:d.stop,take:d.take,size:d.size,maxOpen:d.maxOpen,riskCap:d.riskCap,exitMode:d.exitMode,sizeBias:d.sizeBias,promotedAt:d.promotedAt,graveyardAt:d.graveyardAt};}
function restore(s){try{
  for(const x of s.strategies||[]){
    const d=strategyDefs.find(q=>q.id===x.id);if(!d)continue;
    const codeVersion=num(d.version)||1;
    for(const k of ['cash','peak','dd','wins','losses','n','promotedAt','graveyardAt','bornAt','auto'])if(x[k]!==undefined)d[k]=x[k];
    // Runtime memory must never silently overwrite newer code configuration.
    // Only restore strategy parameters when the persisted strategy is a genuinely evolved version.
    if(num(x.version)>codeVersion){
      for(const k of ['min','stop','take','size','maxOpen','riskCap','exitMode','sizeBias','version'])if(x[k]!==undefined)d[k]=x[k];
    }
  }
  for(const x of s.challengers||[]){
    let d=challengers.find(q=>q.id===x.id);if(!d)continue;
    const codeVersion=num(d.version)||1;
    for(const k of ['cash','peak','dd','wins','losses','n','promotedAt','graveyardAt','bornAt','auto'])if(x[k]!==undefined)d[k]=x[k];
    if(num(x.version)>codeVersion)for(const k of ['min','stop','take','size','maxOpen','riskCap','exitMode','sizeBias','version'])if(x[k]!==undefined)d[k]=x[k];
  }
  positions.splice(0,positions.length,...(s.positions||[]));trades.splice(0,trades.length,...(s.trades||[]));activity.splice(0,activity.length,...(s.activity||[]));decisions.splice(0,decisions.length,...(s.decisions||[]));opportunities.clear();for(const [k,v] of s.opportunities||[])opportunities.set(k,v);research=s.research||research;timeline.splice(0,timeline.length,...(s.timeline||[]));replayFrames.splice(0,replayFrames.length,...(s.replayFrames||[]));autopsies.splice(0,autopsies.length,...(s.autopsies||[]));promotions.splice(0,promotions.length,...(s.promotions||[]));graveyard.splice(0,graveyard.length,...(s.graveyard||[]));walletEvents.splice(0,walletEvents.length,...(s.walletEvents||[]));marketEvents.splice(0,marketEvents.length,...(s.marketEvents||[]));dnaArchive.clear();for(const [k,v] of s.dnaArchive||[])dnaArchive.set(k,v);creators.clear();for(const [k,v] of s.creators||[])creators.set(k,{...v,tokens:new Set(v.tokens||[])});
}catch(e){console.warn('State restore warning:',e.message)}}
async function flushMarketEvents(){
  if(!db||!pendingDbEvents.length)return;const batch=pendingDbEvents.splice(0,Math.min(750,pendingDbEvents.length));
  try{await db.query("INSERT INTO pump_lab_market_events(ts,mint,payload) SELECT (x->>'ts')::bigint,x->>'mint',x FROM jsonb_array_elements($1::jsonb) x",[JSON.stringify(batch)]);lastDbEventFlush=now();}
  catch(e){pendingDbEvents.unshift(...batch);pendingDbEvents.splice(1500);setHealth('research-memory','warn','Event ledger flush failed: '+e.message);}
}
async function save(){const s=serialize();try{fs.writeFileSync(STATE_FILE,JSON.stringify(s));}catch{}if(db){try{await flushMarketEvents();await db.query("INSERT INTO pump_lab_state(id,payload,updated_at) VALUES('main',$1,now()) ON CONFLICT(id) DO UPDATE SET payload=$1,updated_at=now()",[s]);}catch(e){setHealth('research-memory','warn','Postgres save failed: '+e.message);}}}
function loadLocal(){try{restore(JSON.parse(fs.readFileSync(STATE_FILE,'utf8')));}catch{}}

function strategyDiagnostics(){
  return strategyDefs.map(d=>{
    markEquity(d);
    const rows=decisions.filter(x=>x.strategy===d.id);const rejects=rows.filter(x=>x.action==='REJECT'),buys=rows.filter(x=>x.action==='BUY');
    const scores=rejects.map(x=>num(x.score));const riskVetos=rejects.filter(x=>x.why==='risk veto').length;
    const maxScore=scores.length?Math.max(...scores):null;const avgScore=scores.length?avg(scores):null;
    const ep=entryPolicy(d),h=strategyHealth(d);const near=rejects.filter(x=>num(x.score)>=ep.min-5).length;
    return{id:d.id,name:d.name,n:d.n,wins:d.wins,losses:d.losses,open:openCount(d.id),equity:d.equity,pnl:d.equity-START,recentAvg:h.avg,recentN:h.n,threshold:d.min,effectiveMin:ep.min,relief:ep.relief,p90:ep.p90,riskLimit:d.id==='sniper'?ep.sniperRiskLimit:d.risk==='LOW'?ep.lowRiskLimit:ep.customRiskLimit,buys:buys.length,rejects:rejects.length,maxRejectScore:maxScore,avgRejectScore:avgScore,nearMisses:near,riskVetos,cash:d.cash};
  });
}
function logPerformanceSnapshot(){
  allTraders().forEach(markEquity);const core=strategyDefs.filter(d=>d.risk!=='CONTROL'&&!d.specialist),controls=strategyDefs.filter(d=>d.risk==='CONTROL'),spec=specialistStrategies();
  const pack=rows=>({count:rows.length,capital:rows.reduce((a,d)=>a+d.equity,0),start:rows.length*START,pnl:rows.reduce((a,d)=>a+d.equity-START,0),green:rows.filter(d=>d.equity>=START).length,red:rows.filter(d=>d.equity<START).length,trades:rows.reduce((a,d)=>a+d.n,0),open:rows.reduce((a,d)=>a+openCount(d.id),0)});
  console.log('PERFORMANCE_SNAPSHOT '+JSON.stringify({ts:now(),version:'3.1 Megga Research',weather:marketWeather(),core:pack(core),controls:pack(controls),specialists:pack(spec)}));
}
function logStrategyDiagnostics(){
  console.log('STRATEGY_DIAGNOSTICS '+JSON.stringify(strategyDiagnostics()));
}
function traderPostmortem(d){
  markEquity(d);
  const rows=trades.filter(x=>x.strategy===d.id),wins=rows.filter(x=>x.pnl>0),losses=rows.filter(x=>x.pnl<=0);
  const A=(xs,k)=>avg(xs.map(x=>num(k(x))).filter(Number.isFinite));
  const med=xs=>percentile(xs.map(x=>num(x.pnlPct)).filter(Number.isFinite),.5);
  const feature=(xs,k)=>A(xs,x=>x.entryFeatures?.[k]);
  const exits={};for(const x of rows){const k=x.why||'unknown';if(!exits[k])exits[k]={n:0,pnl:0};exits[k].n++;exits[k].pnl+=num(x.pnlPct);}
  for(const v of Object.values(exits))v.avg=v.n?v.pnl/v.n:0;
  const open=positions.filter(x=>x.strategy===d.id&&!x.closed);
  return{
    id:d.id,name:d.name,cohort:d.cohort||'CORE',n:rows.length,wins:wins.length,losses:losses.length,
    winRate:rows.length?wins.length/rows.length*100:0,equity:d.equity,pnl:d.equity-START,
    avgPnl:A(rows,x=>x.pnlPct),medianPnl:med(rows),avgWin:A(wins,x=>x.pnlPct),avgLoss:A(losses,x=>x.pnlPct),
    avgHoldMin:A(rows,x=>(x.closedAt-x.opened)/60000),avgMfe:A(rows,x=>x.mfe),avgMae:A(rows,x=>x.mae),
    winnerMfe:A(wins,x=>x.mfe),loserMfe:A(losses,x=>x.mfe),winnerMae:A(wins,x=>x.mae),loserMae:A(losses,x=>x.mae),
    entry:{
      score:A(rows,x=>x.score),risk:feature(rows,'risk'),momentum:feature(rows,'momentum'),flow:feature(rows,'flow'),
      buyRatio:feature(rows,'buyRatio'),vol:feature(rows,'volScore'),liq:feature(rows,'liqScore'),social:feature(rows,'social'),
      sourceQuality:feature(rows,'sourceQuality'),quality:A(rows,x=>x.entryQuality),mc:A(rows,x=>x.entryFeatures?.mc)
    },
    winnerEntry:{
      score:A(wins,x=>x.score),risk:feature(wins,'risk'),momentum:feature(wins,'momentum'),flow:feature(wins,'flow'),
      buyRatio:feature(wins,'buyRatio'),vol:feature(wins,'volScore'),liq:feature(wins,'liqScore'),quality:A(wins,x=>x.entryQuality)
    },
    loserEntry:{
      score:A(losses,x=>x.score),risk:feature(losses,'risk'),momentum:feature(losses,'momentum'),flow:feature(losses,'flow'),
      buyRatio:feature(losses,'buyRatio'),vol:feature(losses,'volScore'),liq:feature(losses,'liqScore'),quality:A(losses,x=>x.entryQuality)
    },
    regimes:Object.fromEntries([...new Set(rows.map(x=>x.entryRegime||'unknown'))].map(k=>[k,{n:rows.filter(x=>(x.entryRegime||'unknown')===k).length,avg:A(rows.filter(x=>(x.entryRegime||'unknown')===k),x=>x.pnlPct)}])),
    exits,postExit:{one:A(rows,x=>x.counterfactual?.holdAfterExit?.oneMin),five:A(rows,x=>x.counterfactual?.holdAfterExit?.fiveMin),fifteen:A(rows,x=>x.counterfactual?.holdAfterExit?.fifteenMin),best:A(rows,x=>x.counterfactual?.bestObservedAfterExit)},
    open:open.map(x=>({symbol:x.symbol,entry:x.entry,mark:positionMarkPrice(x),pnl:pct(positionMarkPrice(x),x.entry),ageMin:(now()-x.opened)/60000,score:x.score,regime:x.entryRegime}))
  };
}
function logFullPostmortem(){
  for(const d of allTraders())console.log('TRADER_POSTMORTEM_ITEM '+JSON.stringify(traderPostmortem(d)));
}
function v3SelfTest(){
  const issues=[];
  const production=strategyDefs.filter(d=>d.risk!=='CONTROL');
  for(const d of production){
    const p=strategyPlaybook(d);
    if(!p||!p.instruction)issues.push(d.id+': missing playbook');
    if(!d.specialist&&!d.copyLab&&d.size>.04)issues.push(d.id+': authored size above v3 cap');
  }
  for(const d of strategyDefs.filter(x=>x.copyLab&&x.copySource)){
    const trader=FOMO_WATCHLIST.find(x=>x.id===d.copySource);
    const verified=(trader?.wallets||[]).some(w=>w.confidence==='verified');
    if(!verified)issues.push(d.id+': copy source is not verified');
  }
  const mac=FOMO_WATCHLIST.find(x=>x.id==='macdegods');
  if((mac?.wallets||[]).some(w=>w.confidence==='verified'))issues.push('macdegods: review direct-copy eligibility; mapping changed');
  const graduation=strategyDefs.find(x=>x.id==='graduation');
  if(!CORE_PLAYBOOKS.graduation?.requireGraduated||!graduation)issues.push('graduation: confirmed state guard missing');
  return{pass:issues.length===0,era:STRATEGY_ERA,production:production.length,controls:strategyDefs.filter(d=>d.risk==='CONTROL').length,
    copyModels:strategyDefs.filter(d=>d.copyLab).map(d=>d.id),issues};
}
function logV3SelfTest(){console.log('V3_SELFTEST '+JSON.stringify(v3SelfTest()));}

function snapshot(){
  allTraders().forEach(markEquity);const active=[...tokens.values()].filter(t=>now()-t.updatedAt<900000).sort((a,b)=>b.updatedAt-a.updatedAt).slice(0,80).map(t=>({...t,features:features(t),detective:detective(t),adversarial:adversarialRisk(t),consensus:consensus(t),dna:creatorDNA(t),tokenDNA:tokenDNA(t),similarity:dnaSimilarity(t),quality:tokenDataQuality(t)}));
  const prod=strategyDefs.filter(d=>d.risk!=='CONTROL'&&!d.specialist),cohort=specialistStrategies();const weather=marketWeather();
  return{now:now(),startedAt,paperOnly:true,mode:'LIVE + V3.1 EVIDENCE PLAYBOOKS + MEGGA COPY/SCOUT LAB + DURABLE REPLAY',version:'3.1 Megga Research',target:TARGET,weather,providers:[...health.values()],
    summary:{capital:prod.reduce((a,d)=>a+d.equity,0),start:prod.length*START,trades:prod.reduce((a,d)=>a+d.n,0),open:positions.filter(p=>!p.closed&&prod.some(d=>d.id===p.strategy)).length,cohortCapital:cohort.reduce((a,d)=>a+d.equity,0),cohortStart:cohort.length*START,cohortTrades:cohort.reduce((a,d)=>a+d.n,0),cohortOpen:positions.filter(p=>!p.closed&&cohort.some(d=>d.id===p.strategy)).length,tokens:tokens.size,decisions:decisions.length},
    strategies:strategyDefs.map(d=>{const ep=entryPolicy(d),pb=strategyPlaybook(d),eraTrades=trades.filter(t=>t.strategy===d.id&&t.policyVersion===STRATEGY_ERA);return{...d,winRate:d.n?d.wins/d.n*100:0,open:openCount(d.id),effectiveMin:ep.min,coldStart:ep.coldStart,entryRejects:ep.rejects,thresholdRelief:ep.relief,playbook:pb.instruction,era:STRATEGY_ERA,eraN:eraTrades.length,eraWinRate:eraTrades.length?eraTrades.filter(t=>t.pnl>0).length/eraTrades.length*100:0,eraPnl:eraTrades.reduce((a,t)=>a+num(t.pnl),0),eraAvgPnl:eraTrades.length?avg(eraTrades.map(t=>t.pnlPct)):0}}),experiments:experimentSnapshot(),tokens:active,
    narratives:narrativeStats().slice(0,15),creators:creatorLeaderboard(),positions:positions.filter(p=>!p.closed).slice(-120),trades:trades.slice(0,150),activity:activity.slice(0,140),research,
    missed:missedMonsters(),saved:savedMyAss(),hall:hallOfFame(),worst:worstTrades(),autopsies:autopsies.slice(0,30),timeline:timeline.slice(-120),decisions:decisions.slice(0,160),calibration:confidenceCalibration(),entryLab:entryLab(),exitLab:exitLab(),sizingLab:sizingLab(),executionLab:executionLab(),benchmarks:benchmarkStats(),godBot:godBot(),archetypes:archetypeMemory(),evolution:{family:familyTree(),promotions:promotions.slice(0,20),graveyard:graveyard.slice(0,20)},holdTime:holdTimeLab(),coalitions:coalitionStats(),correlation:strategyCorrelation().slice(0,20),regimeMatrix:regimeMatrix(),masterAllocation:masterAllocation(),dynamicAllocation:dynamicAllocator(),statistics:strategyStatistics(),exitOptimizer:exitOptimizer(),opportunityCost:opportunityCostLab(),scientist:scientistInsights(),replayLab:replayLab(),specialistCohorts:specialistCohortStats(),walletGraph:walletGraphSnapshot(),riskBoard:riskScoreboard(),tournament:tournament(),providerAudit:providerAudit(),noTrade:noTradeAlpha(),chaos:chaosLab(),replay:replayFrames.slice(-120),walletBoard:walletLeaderboard(),fomoWatchlist:fomoWatchlistSnapshot(),fomoEvents:walletEvents.filter(e=>e.watchlist).slice(0,100),eventLedger:{memory:marketEvents.length,pending:pipelineSafe(pendingDbEvents.length),lastFlush:lastDbEventFlush,dnaArchive:dnaArchive.size},solana:{observed:solanaObserved,resolved:solanaResolved,queued:solanaQueue.length,watchedWallets:WATCHED_WALLET_LOOKUP.size,subscriptionAcks:solanaSubAcks}};
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
<div class="card" style="margin-top:12px"><div class="sectionTitle"><h2>🧪 SPECIALIST COHORT LAB</h2><p>31 isolated traders testing market cap, age, liquidity, flow, metadata, creator DNA, regime and lifecycle populations.</p></div><div id="specialistCohorts"></div></div>
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
$('strats').innerHTML=s.strategies.filter(x=>x.risk!=='CONTROL'&&!x.specialist).sort((a,b)=>b.equity-a.equity).map((x,i)=>'<div class="card strategy"><div class="topline"><b>'+(i+1)+'. '+x.icon+' '+esc(x.name)+'</b><span class="pill">'+esc(x.risk)+'</span></div><div class="money '+(x.equity>=1000?'green':'red')+'">'+money(x.equity)+'</div><div class="mini">'+x.n+' exits · '+one(x.winRate)+'% wins · '+one(x.dd)+'% max DD · '+x.open+' open</div><div class="mini">entry gate '+one(x.effectiveMin)+(x.coldStart&&x.thresholdRelief?' <span class="amber">(cold-start −'+one(x.thresholdRelief)+')</span>':'')+' · '+x.entryRejects+' rejects</div><div class="truth" style="margin-top:8px">'+esc(x.playbook||x.thesis)+'</div><div class="mini" style="margin-top:6px">v3.1 exits '+(x.eraN||0)+' · '+one(x.eraWinRate||0)+'% wins · era P&L '+((x.eraPnl||0)>=0?'+':'')+money(x.eraPnl||0)+' · avg '+one(x.eraAvgPnl||0)+'%</div></div>').join('');
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
$('fomoWatchlist').innerHTML=(s.fomoWatchlist||[]).map(w=>'<tr><td><b>'+esc(w.name)+'</b></td><td class="'+(w.status==='tracking'?'green':w.status==='partial'?'amber':'amber')+'">'+esc(w.status.toUpperCase())+'</td><td>'+w.walletCount+(w.walletHint?' · <span class="muted">'+esc(w.walletHint)+'</span>':'')+'</td><td>'+w.events+'</td><td class="green">'+w.buys+'</td><td class="red">'+w.sells+'</td><td>'+w.tokens+'</td><td class="'+(w.marked==null?'muted':w.marked>=0?'green':'red')+'">'+(w.marked==null?'—':(w.marked>=0?'+':'')+one(w.marked)+'%')+'</td><td class="muted">'+(w.last?age(w.last):'—')+'</td></tr>').join('');
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
const sc=s.specialistCohorts||{groups:[],capital:0,start:0,trades:0,open:0,count:0};
$('specialistCohorts').innerHTML='<div class="grid4"><div class="smallcard"><span class="muted">SPECIALISTS</span><div class="big">'+sc.count+'</div></div><div class="smallcard"><span class="muted">COHORT CAPITAL</span><div class="big">'+money(sc.capital)+'</div><div class="mini">'+(sc.capital>=sc.start?'+':'')+money(sc.capital-sc.start)+' vs cohort start</div></div><div class="smallcard"><span class="muted">COHORT EXITS</span><div class="big">'+sc.trades+'</div></div><div class="smallcard"><span class="muted">OPEN</span><div class="big">'+sc.open+'</div></div></div>'+sc.groups.map(g=>'<div class="ecosystem" style="margin-top:10px"><div><b>'+esc(g.name)+'</b><span style="float:right" class="'+(g.capital>=g.start?'green':'red')+'">'+money(g.capital)+' / '+money(g.start)+'</span></div><div class="mini">'+g.closed+' exits · '+g.open+' open</div><div class="worldGrid" style="margin-top:9px">'+g.traders.map(x=>'<div class="smallcard"><div><b>'+x.icon+' '+esc(x.name)+'</b><span style="float:right" class="'+(x.equity>=1000?'green':'red')+'">'+money(x.equity)+'</span></div><div class="mini">'+x.n+' exits · '+one(x.winRate)+'% wins · '+one(x.dd)+'% DD · '+x.eligibleNow+' eligible now</div><div class="truth" style="margin-top:6px">'+esc(x.thesis)+'</div></div>').join('')+'</div></div>').join('');
renderTime(s.timeline);$('ledger').innerHTML=s.decisions.slice(0,120).map(d=>'<tr><td>'+new Date(d.ts).toLocaleTimeString()+'</td><td>'+esc(d.strategyName)+'</td><td>$'+esc(d.symbol)+'</td><td class="'+(d.action==='BUY'?'green':'muted')+'">'+d.action+'</td><td>'+one(d.score)+'</td><td>'+one(d.risk)+'</td><td class="muted">'+esc(d.why)+'</td></tr>').join('');}
function listOpp(a,key,positive,empty){return a.slice(0,10).map(o=>'<div class="smallcard" style="margin:7px 0"><b>$'+esc(o.symbol)+' · '+esc(o.strategyName)+'</b><span style="float:right" class="'+(positive?'green':'red')+'">'+(o[key]>=0?'+':'')+one(o[key])+'%</span><div class="mini">rejected: '+esc(o.why)+'</div></div>').join('')||'<div class="muted">'+empty+'</div>'}
function openToken(mint){const t=S.tokens.find(x=>x.mint===mint);if(!t)return;const hist=t.history||[];const pts=hist.slice(-45).map(x=>x.price).concat(t.price);const min=Math.min(...pts),max=Math.max(...pts);const path=pts.map((p,i)=>{const x=pts.length<2?0:i/(pts.length-1)*500;const y=80-((p-min)/(max-min||1))*70;return x+','+y}).join(' ');$('drawerBody').innerHTML='<h2>$'+esc(t.symbol)+'</h2><div class="muted">'+esc(t.name)+'</div><svg class="spark" viewBox="0 0 500 90"><polyline fill="none" stroke="#63f4a4" stroke-width="3" points="'+path+'"/></svg><div class="grid4" style="grid-template-columns:1fr 1fr"><div class="smallcard">MC<br><b>'+money(t.mc)+'</b></div><div class="smallcard">Liquidity<br><b>'+money(t.liq)+'</b></div><div class="smallcard">Data Quality<br><b>'+one(t.quality.score)+' · '+esc(t.quality.level)+'</b></div><div class="smallcard">Detective<br><b>'+esc(t.detective.verdict)+' '+one(t.detective.score)+'</b></div><div class="smallcard">Consensus<br><b>'+t.consensus.yes+'/'+t.consensus.total+'</b></div></div><h3>Agent Consensus</h3>'+t.consensus.votes.map(v=>'<span class="vote '+(v.yes?'y':'n')+'">'+v.icon+' '+esc(v.name)+' '+one(v.score)+'</span>').join('')+'<h3>AI Detective</h3><p>'+esc((t.detective.flags||[]).join(' · ')||'No major observed red flags.')+'</p><div class="muted">Unknown until deeper streams are connected: '+esc((t.detective.unknown||[]).join(', '))+'</div><h3>Creator DNA</h3><p>'+t.dna.launches+' observed launches · best observed '+one(t.dna.bestPeakX)+'× · '+t.dna.collapses+' collapses · '+t.dna.graduates+' graduations</p><h3>Signal Breakdown</h3><p>Momentum '+one(t.features.momentum)+' · Flow '+one(t.features.flow)+' · Volume '+one(t.features.volScore)+' · Liquidity '+one(t.features.liqScore)+' · Social metadata '+one(t.features.social)+' · Source quality '+one(t.features.sourceQuality)+'</p>';$('drawer').classList.add('on')}
function closeDrawer(){$('drawer').classList.remove('on')}function renderTime(tl){const sel=$('timeSelect');const old=sel.value;sel.innerHTML=tl.slice().reverse().map((x,i)=>'<option value="'+(tl.length-1-i)+'">'+new Date(x.ts).toLocaleTimeString()+' · '+x.regime+'</option>').join('');if(old)sel.value=old;sel.onchange=showTime;showTime()}function showTime(){if(!S||!S.timeline.length)return;const i=Number($('timeSelect').value||S.timeline.length-1);const t=S.timeline[i]||S.timeline.at(-1);$('timeView').textContent=new Date(t.ts).toLocaleString();$('timeCards').innerHTML='<div class="card"><div class="muted">LAB CAPITAL</div><div class="big">'+money(t.capital)+'</div></div><div class="card"><div class="muted">CHAMPION</div><div class="big">'+money(t.champion)+'</div></div><div class="card"><div class="muted">REGIME</div><div class="big">'+esc(t.regime)+'</div></div><div class="card"><div class="muted">TOP NARRATIVE</div><div class="big">'+esc(t.topNarrative)+'</div></div>'}
async function go(){try{render(await(await fetch('/api/state',{cache:'no-store'})).json())}catch(e){console.error('PUMP LAB render error',e);const h=document.getElementById('health');if(h)h.innerHTML='<span class=\"bad\">CLIENT ERROR · refresh or check system health</span>';}}go();setInterval(go,5000);const es=new EventSource('/api/events');es.addEventListener('tick',()=>go());document.querySelectorAll('.tab').forEach(t=>t.onclick=()=>{document.querySelectorAll('.tab,.pane').forEach(x=>x.classList.remove('on'));t.classList.add('on');$(t.dataset.p).classList.add('on')});</script></body></html>`;

const server=http.createServer((req,res)=>{
  if(req.url==='/api/state'){res.writeHead(200,{'content-type':'application/json','cache-control':'no-store'});return res.end(JSON.stringify(snapshot()));}
  if(req.url==='/api/health'){res.writeHead(200,{'content-type':'application/json','cache-control':'no-store'});return res.end(JSON.stringify({ok:true,paperOnly:true,version:'3.1 Megga Research',weather:marketWeather(),providers:[...health.values()]}));}
  if(req.url==='/api/events'){res.writeHead(200,{'content-type':'text/event-stream','cache-control':'no-cache','connection':'keep-alive'});res.write('data: {}\n\n');clients.add(res);req.on('close',()=>clients.delete(res));return;}
  res.writeHead(200,{'content-type':'text/html; charset=utf-8','cache-control':'no-store'});res.end(HTML);
});

loadLocal();
await initDb();
if(dbStateRestored)logStrategyDiagnostics();
logV3SelfTest();
setHealth('engine','ok','v3.1 evidence playbooks + Megga copy/scout lab + 31 specialist cohorts + controls online',{truth:'observed'});
setHealth('learning-core','ok','era-separated allocator + DNA memory + replay + exit optimizer + counterfactual lab online',{truth:'inferred'});
setHealth('x-social','standby','Full X stream not connected · social agent uses token social metadata only',{truth:'not connected'});
setHealth('wallet-intel','standby','Connecting Solana stream + verified Fomo wallet watchlist…',{truth:'not connected'});setHealth('fomo-watchlist','standby','Preparing verified public wallet subscriptions',{truth:'not connected'});
server.listen(PORT,'0.0.0.0',()=>{log('system','🚀 PUMP LAB v3.1 Megga Research started','system');connectPumpPortal();connectSolanaStream();pumpPoll();dexPoll();console.log('PUMP LAB v3.1 on '+PORT);});
setInterval(drainSolanaQueue,1100).unref?.();setInterval(pumpPoll,7000).unref?.();setInterval(dexPoll,20000).unref?.();setInterval(openPositionPoll,15000).unref?.();setInterval(takeTimeline,30000).unref?.();setInterval(takeReplay,30000).unref?.();setInterval(researchCycle,3600000).unref?.();setInterval(()=>save(),30000).unref?.();const diagTimer=setTimeout(()=>{logStrategyDiagnostics();logPerformanceSnapshot();logFullPostmortem();},20000);diagTimer.unref?.();const diagLoop=setInterval(()=>{logStrategyDiagnostics();logPerformanceSnapshot();logFullPostmortem();},300000);diagLoop.unref?.();takeTimeline();takeReplay();openPositionPoll();
process.on('SIGTERM',async()=>{await save();server.close(()=>process.exit(0));});process.on('SIGINT',async()=>{await save();server.close(()=>process.exit(0));});
