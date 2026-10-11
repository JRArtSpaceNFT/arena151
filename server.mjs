import http from 'node:http';
import fs from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { memoryReport, rejectSlowStream, reuseSnapshotUnderPressure } from './lib/pump-lab-runtime-guard.mjs';
import { createPumpLabAlphaOS } from './lib/pump-lab-alpha-os.mjs';
import { createPumpLabSeason2Science } from './lib/pump-lab-season2-science.mjs';
import { createPumpLabProfitAccelerator } from './lib/pump-lab-profit-accelerator.mjs';
import { renderBotProfileHtml } from './lib/bot-profile.mjs';

const PORT = Number(process.env.PORT || 3000);
const PUMP_KEY = process.env.PUMPPORTAL_API_KEY || '';
const ALLOW_METERED = (process.env.ALLOW_METERED_PUMPPORTAL || 'false') === 'true';
const START = 1000;
const TARGET = 100000;
const STRATEGY_ERA = 'v5.1-integrity-freeze';
const CLEAN_SEASON_LABEL = 'season3-clean-execution-2026-10-04';
const STATE_AUTHORITY_VERSION = 'v6-single-runtime-ledger-authority';
const ALLOW_SEASON_MIGRATION = (process.env.ALLOW_SEASON_MIGRATION || 'false') === 'true';
const FEE_RATE = 0.0125; // conservative fallback for unknown venue/lifecycle
const PAPER_FIXED_TX_COST_USD = Number(process.env.PAPER_FIXED_TX_COST_USD || 0.02);
const PAPER_MIN_PROFIT_TAKE_USD = Math.max(0, Number(process.env.PAPER_MIN_PROFIT_TAKE_USD || 50));
const PAPER_MIN_EXPECTED_NET_WIN_USD = Math.max(0, Number(process.env.PAPER_MIN_EXPECTED_NET_WIN_USD || 50));
const STATE_FILE = process.env.STATE_FILE || '/tmp/pump-lab-state-v06.json';
const DATABASE_URL = process.env.DATABASE_URL || '';
const REDIS_URL = process.env.REDIS_URL || '';
const PEER_RECOVERY_URLS = (process.env.PEER_RECOVERY_URLS || process.env.PEER_RECOVERY_URL || 'https://pump-lab-ui.onrender.com/api/recovery-snapshot-cache,https://pump-lab-recovery-peer.onrender.com/api/recovery-snapshot-cache')
  .split(',').map(x=>x.trim()).filter(x=>x&&x!=='disabled');
const PEER_RECOVERY_URL = PEER_RECOVERY_URLS[0] || '';
const PEER_RECOVERY_MAX_AGE_MS = Number(process.env.PEER_RECOVERY_MAX_AGE_MS || 3600000);
const PEER_RECOVERY_TIMEOUT_MS = Math.max(6000, Number(process.env.PEER_RECOVERY_TIMEOUT_MS || 20000));
const RECOVERY_MIN_EXITS = Math.max(1, Number(process.env.RECOVERY_MIN_EXITS || 1));
const JOURNAL_REPAIR_MIN_GAP = Math.max(3, Number(process.env.JOURNAL_REPAIR_MIN_GAP || 5));
const FORENSIC_BASELINE = (()=>{try{return JSON.parse(fs.readFileSync(new URL('./recovery/season2-pre-incident-2026-10-03T215312Z.json',import.meta.url),'utf8'));}catch{return null;}})();
const LOCAL_RECOVERY_MAX_AGE_MS = Number(process.env.LOCAL_RECOVERY_MAX_AGE_MS || 1800000);
const AUDIT_VERSION = '2026-10-01-process-audit';
const ALLOW_AUTO_PROMOTION = (process.env.ALLOW_AUTO_PROMOTION || 'false') === 'true';
const SEASON2_SCIENCE_VETO = (process.env.SEASON2_SCIENCE_VETO || 'true') === 'true';
const RESET_SEASON = (process.env.RESET_SEASON || '').trim();
const DURABLE_WRITE_GRACE_MS = Number(process.env.DURABLE_WRITE_GRACE_MS || 900000);
const STALE_MARK_WARN_MS = Number(process.env.STALE_MARK_WARN_MS || 120000);
const STALE_MARK_ZERO_MS = Number(process.env.STALE_MARK_ZERO_MS || 1800000); // retained only for backward-compatible config; stale marks are never decayed or written off
const PRICE_QUOTE_MAX_AGE_MS = Number(process.env.PRICE_QUOTE_MAX_AGE_MS || 20000);
const PRICE_STAGNANT_MAX_MS = Number(process.env.PRICE_STAGNANT_MAX_MS || 90000);
const IMPOSSIBLE_LOSS_TOLERANCE_PCT = Number(process.env.IMPOSSIBLE_LOSS_TOLERANCE_PCT || 5);
const FROZEN_EXPERIMENT_MIN_TRADES = Number(process.env.FROZEN_EXPERIMENT_MIN_TRADES || 30);
const CORE_COLLECTION_MIN_SCORE_FLOOR = Number(process.env.CORE_COLLECTION_MIN_SCORE_FLOOR || 48);
const CORE_COLLECTION_MAX_SCORE_RELIEF = Number(process.env.CORE_COLLECTION_MAX_SCORE_RELIEF || 18);
const PAPER_COLLECTION_MIN_EXPECTED_NET_WIN_USD = Math.max(5, Number(process.env.PAPER_COLLECTION_MIN_EXPECTED_NET_WIN_USD || 15));
const ACTIVE_EXPERIMENT_IDS = new Set(['banker','graduation','confirmed_runner','mc_over100','liq_50_plus','crosscheck','random','winner1','winner2','launchctl']);
const MAX_RUNTIME_TOKENS = Number(process.env.MAX_RUNTIME_TOKENS || 600);
const MAX_OPPORTUNITIES = Number(process.env.MAX_OPPORTUNITIES || 5000);
const OPPORTUNITY_RETENTION_MS = Number(process.env.OPPORTUNITY_RETENTION_MS || 129600000);
const PAPER_DAILY_LOSS_LIMIT_PCT = Number(process.env.PAPER_DAILY_LOSS_LIMIT_PCT || 10);
const PAPER_MAX_DRAWDOWN_PCT = Number(process.env.PAPER_MAX_DRAWDOWN_PCT || 25);
const PAPER_SAME_MINT_COOLDOWN_MS = Number(process.env.PAPER_SAME_MINT_COOLDOWN_MS || 14400000);
const PAPER_CORE_ENTRY_GAP_MS = Number(process.env.PAPER_CORE_ENTRY_GAP_MS || 120000);
const PAPER_MAX_CORE_ENTRIES_PER_HOUR = Number(process.env.PAPER_MAX_CORE_ENTRIES_PER_HOUR || 6);
const SHADOW_EXECUTION_VALIDATED = (process.env.SHADOW_EXECUTION_VALIDATED || 'false') === 'true';
const PUMP_PROGRAM = '6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P';
const SOLANA_RPC_HTTP = process.env.SOLANA_RPC_HTTP || 'https://api.mainnet-beta.solana.com';
const SOLANA_RPC_WSS = process.env.SOLANA_RPC_WSS || 'wss://api.mainnet-beta.solana.com';
const SHADOW_ROUTE_QUOTE_URL = process.env.SHADOW_ROUTE_QUOTE_URL || '';
const SHADOW_WALLET_PUBLIC_KEY = process.env.SHADOW_WALLET_PUBLIC_KEY || '';
const X_BEARER_TOKEN = process.env.X_BEARER_TOKEN || '';
const X_FEED_HANDLES = (process.env.X_FEED_HANDLES || 'garyvee,frankdegods,blknoiz06,orangie,_TJRTrades,Megga,rasmr_eth,theunipcs').split(',').map(x=>x.trim().replace(/^@/,'')).filter(Boolean);
const X_REFRESH_MS = Math.max(30000, Number(process.env.X_REFRESH_MS || 120000));
const X_MAX_CACHE = Math.max(20, Math.min(200, Number(process.env.X_MAX_CACHE || 100)));

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

const MAX_ACTIVITY = 250;
const MAX_SSE_CLIENTS = 24;
const RUNTIME_MEMORY_BUDGET_MIB = Math.max(128, Number(process.env.RUNTIME_MEMORY_BUDGET_MIB || 512));
const MAX_TRADES = Math.max(1000, Number(process.env.MAX_TRADES || 2000));
const MAX_DECISIONS = Math.max(750, Number(process.env.MAX_DECISIONS || 1500));
const MAX_TIMELINE = 120;
const MAX_TOKEN_HISTORY = Math.max(45, Number(process.env.MAX_TOKEN_HISTORY || 90));

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
let edgeFocusCache = {ts:0,data:null};
let allocatorCache = {ts:0,regime:'',data:null};
const entryPolicyCache = new Map();
const regimeWeightCache = new Map();
const dnaSimilarityCache = new Map();
const featureCache = new Map();
let marketWeatherCache = {ts:0,value:null};
let narrativeStatsCache = {ts:0,value:null};
const promotions = [];
const graveyard = [];
const walletEvents = [];
const solanaQueue = [];
const solanaPriorityQueue = [];
const solanaSubscriptionKinds = new Map();
const discoveryLedger = [];
const discoveryFirstByMint = new Map();
let solanaCreateSignals = 0;
const solanaSeen = new Set();
let solanaWs = null;
let solanaObserved = 0;
let solanaResolved = 0;
let solanaSubAcks = 0;
let db = null;
let emergencyOffsiteRestored = false;
let emergencyOffsiteSavedAt = 0;
let archiveMonsterExportCache = null;
let dbConnecting = false;
let dbStateRestored = false;
let lastDurableSaveAt = 0;
let lastDurableRestoreAt = 0;
let saveInProgress = false;
let saveQueued = false;
let criticalSaveTimer = null;
let criticalSaveInProgress = false;
let criticalSaveQueued = false;
let lastCriticalSaveAt = 0;
let dbWriteHigh = [];
let dbWriteNormal = [];
let dbWriteLow = [];
let dbWriteBusy = false;
let kv = null;
let kvConnecting = false;
let kvReady = false;
let kvStateRestored = false;
let lastKvSaveAt = 0;
let lastKvRestoreAt = 0;
let localStateRestored = false;
let lastLocalRestoreAt = 0;
let peerStateRestored = false;
let lastPeerRestoreAt = 0;
let lastPeerAttemptAt = 0;
let peerRetryNotBefore = 0;
let peerFailureCount = 0;
let stateVersionTs = 0;
let dbReconnectTimer = null;
let dbReconnectAttempt = 0;
let dbDisabledUntil = 0;
let lastDbFailure = '';
const DB_RECONNECT_MAX_MS = Math.max(60000, Number(process.env.DB_RECONNECT_MAX_MS || 300000));
const opportunityKeysByMint = new Map();
const alphaOS = createPumpLabAlphaOS({
  start:START,
  rpcUrl:SOLANA_RPC_HTTP,
  routeQuoteUrl:SHADOW_ROUTE_QUOTE_URL,
  shadowWalletPublicKey:SHADOW_WALLET_PUBLIC_KEY
});
const science = createPumpLabSeason2Science({start:START});
const profitAccelerator = createPumpLabProfitAccelerator();
let research = { last: 0, notes: [], hypotheses: [] };
let forensicLedgerGaps={total:0,production:0,cohort:0,control:0,other:0,baselineAt:0,source:''};
let forensicRecovery={active:false,lastRepairAt:0,regressionCutoff:0,journalRows:0,detailedTrades:0,observedLedgerRows:0};
const forensicObservedHighWater=FORENSIC_BASELINE?.observedHighWater||{};
let recoveryHighWater={
  seasonKey:'archive:season2-2026-10-01',
  ledgerRows:Math.max(0,Number(forensicObservedHighWater.ledgerRows||0)),
  productionExits:Math.max(0,Number(forensicObservedHighWater.productionExits||0)),
  exitTotal:(FORENSIC_BASELINE?.traders||[]).reduce((z,x)=>z+Math.max(0,Number(x?.n)||0),0),
  strategyN:Object.fromEntries((FORENSIC_BASELINE?.traders||[]).map(x=>[x.id,Math.max(0,Number(x?.n)||0)])),
  updatedAt:Number(forensicObservedHighWater.capturedAtMs||FORENSIC_BASELINE?.capturedAtMs||0),
  source:'forensic-observed-high-water'
};
let startedAt = Date.now();
let seasonInfo = {label:'legacy',startedAt,archiveId:null,resetApplied:false};

// PUMP LAB v2 learning memory. In-memory structures are bounded; the durable event
// ledger is also flushed to Postgres so research survives process restarts.
const MAX_MARKET_EVENTS = Math.max(1000, Number(process.env.MAX_MARKET_EVENTS || 2500));
const MAX_DNA_ARCHIVE = Math.max(600, Number(process.env.MAX_DNA_ARCHIVE || 1200));
const marketEvents = [];
const dnaArchive = new Map();
const marketEventClock = new Map();
const pendingDbEvents = [];
const pendingTradeJournal = [];
let lastDbEventFlush = 0;
let lastTradeJournalFlush = 0;
let journalEventsWritten = 0;
let journalReplayedAt = 0;
let stateIntegrityOk = true;
let lastIntegrityReport = null;
const backpressureDrops = {solana:0,prioritySolana:0,dbEvents:0,journal:0};
let lastScientistRun = 0;
let lastStateBuildMs = 0;
let lastStateBytes = 0;
let lastStateBuildAt = 0;
let lifecyclePhase = 'BOOTING';
let lifecycleSince = Date.now();
let lifecycleDetail = 'process starting';
let shuttingDown = false;
let eventLoopLagMs = 0;
let eventLoopLagP95 = 0;
const eventLoopSamples = [];
let systemPressure = 'NORMAL';
let criticalPressureSince = 0;
const CRITICAL_PRESSURE_DEGRADE_MS = Math.max(20000, Number(process.env.CRITICAL_PRESSURE_DEGRADE_MS || 30000));
let lastIngestAt = 0;
let lastPumpPollAt = 0;
let lastDexPollAt = 0;
let lastOpenPositionPollAt = 0;
let lastPumpOpenPositionPollAt = 0;
let lastMinuteUniverseAt = 0;
let minuteUniverseInFlight = null;
let fastOpenCursor = 0;
let lastSolanaDrainAt = 0;
const subsystemRuntime = new Map();
const providerCircuits = new Map();
let xFeedCache = [];
let xFeedLastFetch = 0;
let xFeedSinceId = null;
let xFeedInFlight = null;
const xPublicFailures = new Map();

const strategyDefs = [
  ['banker','🏦','The Banker','LOW',.025,62,14,90,1,'only confirmed momentum with capital preservation; tolerate small misses for rare asymmetric winners'],
  ['quant','∑','The Quant','LOW',.03,64,11,110,1,'multi-factor confirmation with hard quality floors and catastrophic-loss avoidance'],
  ['smart','🧠','Smart Money','MED',.03,62,10,110,1,'verified smart-wallet activity plus market confirmation; never use flow as a wallet proxy'],
  ['social','📡','Social Alpha','MED',.025,63,14,75,1,'social presence is context only; require fresh market confirmation and multiple channels'],
  ['momentum','⚡','Momentum Hunter','HIGH',.04,67,13,90,1,'trade acceleration, not stale absolute momentum; require fresh buyers and observed liquidity'],
  ['graduation','🎓','Graduation','MED',.03,64,14,85,1,'confirmed irreversible graduation breakout with post-migration liquidity and flow'],
  ['dip','↘','Dip Buyer','MED',.03,62,13,75,1,'real pullback plus rebound confirmation; never buy a falling knife from one tick'],
  ['swing','🌊','Swing Trader','MED',.035,64,12,125,1,'deep observed liquidity, mature structure, small risk and room for asymmetric runners'],
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
  ['wallet_consensus','👥','Smart Wallet Consensus','MED',.03,69,10,150,2,'requires multiple independently verified tracked wallets to converge on the same token'],
  ['confirmed_runner','🏃','Confirmed Runner','HIGH',.035,70,12,130,1,'fresh acceleration plus strong buyer flow, cross-source quality and room for a runner'],
  ['asym_swing','💎','Mac-Style Asymmetric Swing','MED',.025,67,14,220,1,'behavioral model inspired by MacDeGods payoff asymmetry; not direct copy until the current execution wallet is independently verified'],
  ['copy_megga','🎮','Megga Direct Copy','HIGH',.015,58,12,400,6,'paper-copy Megga public-wallet buys with tiny probes, strict chase limits, source-aware sells and runner preservation'],
  ['megga_scout','🛰️','Megga Micro Scout','HIGH',.015,58,12,400,8,'behavioral model: many tiny sub-$100K scouts, asymmetric payoff, no averaging down, scale winners and keep a runner'],

  // Hypothesis Arena: narrow, falsifiable momentum experiments. These never auto-promote.
  ['hyp_bal_1_3','H1','1–3m Balanced Burst','R&D',.02,60,10,90,1,'H1: 1–3 minute tokens with strong but non-euphoric buyers outperform generic momentum'],
  ['hyp_bal_3_6','H2','3–6m Confirmation','R&D',.02,61,10,95,1,'H2: waiting 3–6 minutes improves signal quality without giving up most upside'],
  ['hyp_transition','H3','Transition Crosscheck','R&D',.02,61,10,100,1,'H3: $60K–$120K cross-checked transition tokens offer better expectancy than broad early-cap entries'],
  ['hyp_accel','H4','Acceleration Not Euphoria','R&D',.02,62,9,105,1,'H4: high acceleration with moderate buyer pressure beats extreme crowding'],
  ['hyp_liqrunner','H5','Liquidity Runner','R&D',.02,62,10,110,1,'H5: deeper-liquidity momentum produces smaller losers while retaining runner upside'],
  ['hyp_lowrisk','H6','Low-Risk Momentum','R&D',.02,62,9,95,1,'H6: structural risk below 50 plus momentum produces superior risk-adjusted expectancy'],
  ['hyp_rebound','H7','Rebound Momentum','R&D',.02,60,9,100,1,'H7: controlled pullback plus fresh rebound is better than buying the initial vertical move'],
  ['hyp_quality','H8','Quality First Momentum','R&D',.02,60,9,100,1,'H8: very high data quality with only moderate momentum beats raw momentum intensity'],
  ['hyp_hotbalanced','H9','Hot Regime Balanced','R&D',.02,61,10,110,1,'H9: in HOT regimes, balanced pressure outperforms euphoric pressure'],
  ['hyp_riskoff','H10','Risk-Off Momentum','R&D',.015,63,8,70,1,'H10: only the cleanest low-risk momentum can retain positive expectancy in RISK OFF'],

  // Research Graduate trio: paper-only experiments synthesized from the observed Season 2 evidence.
  ['hyp_grad_fortress','G1','The Fortress','R&D',.015,65,8,70,1,'G1: established cross-checked quality with balanced pressure and clean creator history reduces catastrophic downside'],
  ['hyp_grad_rebound','G2','Second Chance','R&D',.015,63,9,130,1,'G2: controlled pullback plus confirmed rebound outperforms chasing the first impulse'],
  ['hyp_grad_outlier','G3','The Outlier','R&D',.0125,66,9,250,1,'G3: rare high-quality non-euphoric structures with asymmetric exits can offset a low hit rate'],
  ['velocity_scalper','⚡','Velocity Scalper','R&D',.10,64,6,11,1,'fast paper scalper: target roughly $100 when fresh momentum accelerates, then exit within minutes instead of waiting for a moonshot'],
  ['minute_sub100','⏱️','Sub $100K Minute Trader','R&D',.10,0,8,8,1,'forced paper sampler: take the best currently observed memecoin below $100K market cap roughly once per minute'],
  ['minute_100_250','⏱️','$100K–$250K Minute Trader','R&D',.10,0,7,8,1,'forced paper sampler: take the best currently observed $100K–$250K memecoin roughly once per minute'],
  ['minute_500_1m','⏱️','$500K–$1M Minute Trader','R&D',.10,0,6,7,1,'forced paper sampler: take the best currently observed $500K–$1M memecoin roughly once per minute'],

  ['meme_smooth_curve','◒','Smooth Curve Climber','R&D',.02,61,9,110,1,'smooth pre-graduation climb with persistent participation; reject vertical mechanical curve spikes'],
  ['meme_retest','↗','Breakout Retest','R&D',.02,61,9,120,1,'enter only when a prior resistance area is reclaimed and retested with healthy flow'],
  ['meme_compression','◇','Compression Release','R&D',.02,62,9,125,1,'trade controlled volatility compression followed by expansion, not already-extended price'],
  ['meme_postgrad','◎','Post-Grad Continuation','R&D',.02,62,9,130,1,'post-graduation continuation on deeper canonical liquidity with clean chart structure'],
  ['meme_survival','△','Five-Minute Survivor','R&D',.02,62,8,100,1,'require survival beyond the most fragile launch window plus cross-checked quality and path continuity'],

  ['random','🎲','Random Control','CONTROL',.05,45,22,45,16,'random baseline'],
  ['winner1','🏆','Winner 1','CONTROL',.05,50,12,90,16,'broad randomized entry baseline with ruthless first-minute failure cutting and explicit post-entry path collection'],
  ['winner2','🥇','Winner 2','CONTROL',.05,55,15,140,2,'broad randomized entry baseline that gives trades time to prove a winner shape, then preserves confirmed runners and records the full early path'],
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
  id,icon,name,risk,size,min,stop,take,maxOpen:Math.max(4,Number(maxOpen)||0),thesis,version:3,equity:START,cash:START,peak:START,dd:0,wins:0,losses:0,n:0
}));

const specialistProfiles = {
  hyp_bal_1_3:{hypothesis:true,cohort:'HYPOTHESIS ARENA',tokenAgeMin:1,tokenAgeMax:3,mcMin:35000,mcMax:140000,buyRatioMin:.52,buyRatioMax:.68,sourceMin:2,scoreMode:'hypothesis',exitMode:'runner',maxHold:120,scaleOut:true,playbookOverride:{minQuality:80,minBuy:.52,maxBuy:.68,minTx:8,maxRisk:56,minMomentum:64,maxMomentum:90,minAccel:50,minLiq:9000,minAge:1,maxAge:3,mcMin:35000,mcMax:140000,requireCross:true,minEvidence:4,instruction:'1–3m balanced burst: high quality, cross-checked, strong acceleration, never euphoric flow'}},
  hyp_bal_3_6:{hypothesis:true,cohort:'HYPOTHESIS ARENA',tokenAgeMin:3,tokenAgeMax:6,mcMin:40000,mcMax:170000,buyRatioMin:.52,buyRatioMax:.70,sourceMin:2,scoreMode:'hypothesis',exitMode:'runner',maxHold:150,scaleOut:true,playbookOverride:{minQuality:80,minBuy:.52,maxBuy:.70,minTx:9,maxRisk:55,minMomentum:62,maxMomentum:90,minAccel:48,minLiq:10000,minAge:3,maxAge:6,mcMin:40000,mcMax:170000,requireCross:true,minEvidence:4,instruction:'3–6m confirmation: sacrifice first-tick upside for stronger evidence and cleaner structure'}},
  hyp_transition:{hypothesis:true,cohort:'HYPOTHESIS ARENA',tokenAgeMin:.8,tokenAgeMax:8,mcMin:60000,mcMax:120000,buyRatioMin:.50,buyRatioMax:.70,sourceMin:2,scoreMode:'hypothesis',exitMode:'runner',maxHold:150,scaleOut:true,playbookOverride:{minQuality:82,minBuy:.50,maxBuy:.70,minTx:8,maxRisk:56,minMomentum:62,maxMomentum:90,minAccel:48,minLiq:9000,minAge:.8,maxAge:8,mcMin:60000,mcMax:120000,requireCross:true,minEvidence:4,instruction:'transition crosscheck: isolate the $60K–$120K zone with high-quality independent confirmation'}},
  hyp_accel:{hypothesis:true,cohort:'HYPOTHESIS ARENA',tokenAgeMin:.6,tokenAgeMax:6,mcMin:25000,mcMax:180000,buyRatioMin:.50,buyRatioMax:.70,sourceMin:2,scoreMode:'hypothesis',exitMode:'runner',maxHold:120,scaleOut:true,playbookOverride:{minQuality:78,minBuy:.50,maxBuy:.70,minTx:8,maxRisk:58,minMomentum:60,maxMomentum:88,minAccel:60,minLiq:8000,minAge:.6,maxAge:6,mcMin:25000,mcMax:180000,requireCross:true,minEvidence:4,instruction:'acceleration not euphoria: demand acceleration while explicitly rejecting crowded buyer pressure and exhausted momentum'}},
  hyp_liqrunner:{hypothesis:true,cohort:'HYPOTHESIS ARENA',tokenAgeMin:2,tokenAgeMax:10,mcMin:70000,mcMax:300000,liqMin:20000,buyRatioMin:.52,buyRatioMax:.72,sourceMin:2,scoreMode:'hypothesis',exitMode:'runner',maxHold:180,scaleOut:true,playbookOverride:{minQuality:80,minBuy:.52,maxBuy:.72,minTx:10,maxRisk:54,minMomentum:60,maxMomentum:90,minAccel:46,minLiq:20000,minAge:2,maxAge:10,mcMin:70000,mcMax:300000,requireCross:true,minEvidence:4,instruction:'liquidity runner: test whether deeper markets reduce catastrophic downside without killing upside'}},
  hyp_lowrisk:{hypothesis:true,cohort:'HYPOTHESIS ARENA',tokenAgeMin:1,tokenAgeMax:10,mcMin:40000,mcMax:250000,buyRatioMin:.50,buyRatioMax:.70,sourceMin:2,scoreMode:'hypothesis',exitMode:'balanced',maxHold:120,playbookOverride:{minQuality:82,minBuy:.50,maxBuy:.70,minTx:9,maxRisk:50,minMomentum:60,maxMomentum:88,minAccel:48,minLiq:12000,minAge:1,maxAge:10,mcMin:40000,mcMax:250000,requireCross:true,minEvidence:4,instruction:'low-risk momentum: structural risk below 50 is non-negotiable; seek positive expectancy through loss compression'}},
  hyp_rebound:{hypothesis:true,cohort:'HYPOTHESIS ARENA',tokenAgeMin:2,tokenAgeMax:12,mcMin:30000,mcMax:220000,buyRatioMin:.50,buyRatioMax:.70,sourceMin:2,scoreMode:'hypothesis',exitMode:'structure',maxHold:180,scaleOut:true,playbookOverride:{minQuality:78,minBuy:.50,maxBuy:.70,minTx:8,maxRisk:56,minMomentum:50,maxMomentum:82,minAccel:52,minLiq:9000,minAge:2,maxAge:12,mcMin:30000,mcMax:220000,drawMin:-25,drawMax:-5,minRebound:3,requireCross:true,minEvidence:4,instruction:'rebound momentum: buy recovery after a controlled pullback, never the first vertical extension'}},
  hyp_quality:{hypothesis:true,cohort:'HYPOTHESIS ARENA',tokenAgeMin:1,tokenAgeMax:12,mcMin:35000,mcMax:250000,buyRatioMin:.50,buyRatioMax:.68,sourceMin:2,scoreMode:'hypothesis',exitMode:'balanced',maxHold:150,playbookOverride:{minQuality:88,minBuy:.50,maxBuy:.68,minTx:9,maxRisk:54,minMomentum:55,maxMomentum:84,minAccel:46,minLiq:10000,minAge:1,maxAge:12,mcMin:35000,mcMax:250000,requireCross:true,minEvidence:4,instruction:'quality first: very strong data quality and moderate momentum instead of chasing maximum speed'}},
  hyp_hotbalanced:{hypothesis:true,cohort:'HYPOTHESIS ARENA',regime:'HOT',tokenAgeMin:.8,tokenAgeMax:8,mcMin:30000,mcMax:200000,buyRatioMin:.52,buyRatioMax:.70,sourceMin:2,scoreMode:'hypothesis',exitMode:'runner',maxHold:150,scaleOut:true,playbookOverride:{minQuality:78,minBuy:.52,maxBuy:.70,minTx:8,maxRisk:58,minMomentum:62,maxMomentum:90,minAccel:50,minLiq:8000,minAge:.8,maxAge:8,mcMin:30000,mcMax:200000,requireCross:true,minEvidence:4,instruction:'hot-regime balanced: test whether healthy pressure beats euphoria when the overall market is hot'}},
  hyp_riskoff:{hypothesis:true,cohort:'HYPOTHESIS ARENA',regime:'RISK OFF',tokenAgeMin:2,tokenAgeMax:15,mcMin:60000,mcMax:300000,liqMin:18000,buyRatioMin:.50,buyRatioMax:.66,sourceMin:2,scoreMode:'hypothesis',exitMode:'defensive',maxHold:75,playbookOverride:{minQuality:88,minBuy:.50,maxBuy:.66,minTx:10,maxRisk:46,minMomentum:58,maxMomentum:82,minAccel:48,minLiq:18000,minAge:2,maxAge:15,mcMin:60000,mcMax:300000,requireCross:true,minEvidence:5,instruction:'risk-off momentum: only exceptional quality, deep liquidity and low structural risk are allowed'}},

  hyp_grad_fortress:{hypothesis:true,cohort:'RESEARCH GRADUATES',tokenAgeMin:3,tokenAgeMax:40,mcMin:100000,buyRatioMin:.52,buyRatioMax:.72,sourceMin:1,repeatCleanCreator:true,scoreMode:'quality',exitMode:'defensive',maxHold:60,playbookOverride:{minQuality:84,minBuy:.52,maxBuy:.72,minTx:10,maxRisk:50,minMomentum:46,maxMomentum:76,minAccel:42,minLiq:15000,minAge:3,maxAge:40,mcMin:100000,requireCross:true,minEvidence:5,instruction:'Fortress: stay conservative but evaluate a wider mature-token population; retain cross-checking, clean creator history and loss compression'}},
  hyp_grad_rebound:{hypothesis:true,cohort:'RESEARCH GRADUATES',tokenAgeMin:2,tokenAgeMax:25,mcMin:75000,mcMax:650000,buyRatioMin:.50,buyRatioMax:.72,sourceMin:1,scoreMode:'hypothesis',exitMode:'structure',maxHold:180,scaleOut:true,playbookOverride:{minQuality:82,minBuy:.50,maxBuy:.72,minTx:8,maxRisk:54,minMomentum:42,maxMomentum:80,minAccel:48,minLiq:10000,minAge:2,maxAge:25,mcMin:75000,mcMax:650000,drawMin:-35,drawMax:-4,minRebound:3,requireCross:false,minEvidence:4,instruction:'Second Chance: widen the recovery window but still require a real pullback, rebound, fresh flow, sufficient quality and renewed acceleration'}},
  hyp_grad_outlier:{hypothesis:true,memeTheory:true,cohort:'RESEARCH GRADUATES',tokenAgeMin:1.5,tokenAgeMax:24,mcMin:90000,buyRatioMin:.52,buyRatioMax:.74,sourceMin:1,scoreMode:'meme',exitMode:'conviction',maxHold:480,scaleOut:true,sizeBias:.35,minChartQuality:58,maxSpikeRisk:55,maxManipulationRisk:58,minFlowPersistence:52,allowedStructures:['SMOOTH_TREND','BREAKOUT','BREAKOUT_RETEST','RECOVERY','COMPRESSION','BASE'],playbookOverride:{minQuality:84,minBuy:.52,maxBuy:.74,minTx:10,maxRisk:52,minMomentum:50,maxMomentum:86,minAccel:46,minLiq:12000,minAge:1.5,maxAge:24,mcMin:90000,requireCross:false,minEvidence:4,instruction:'Outlier: broaden candidate discovery while preserving chart structure, anti-spike controls, low structural risk and asymmetric exits'}},
  velocity_scalper:{cohort:'FAST SCALP LAB',fastScalp:true,fixedStakeUsd:100,tokenAgeMin:.25,tokenAgeMax:10,mcMin:20000,mcMax:350000,buyRatioMin:.56,buyRatioMax:.84,sourceMin:1,scoreMode:'velocity',exitMode:'scalp',maxHold:3.5,playbookOverride:{minQuality:58,minBuy:.56,maxBuy:.84,minTx:6,maxRisk:70,minMomentum:60,maxMomentum:98,minAccel:52,minLiq:7000,minAge:.25,maxAge:10,mcMin:20000,mcMax:350000,minTimedCoverageSec:15,minRet5s:.4,minRet20s:2,maxRet20s:32,instruction:'Velocity Scalper: buy only a fresh time-normalized accelerating burst with real buyers/liquidity; aim for a quick double-digit gross move, cut fast when velocity fades, and never average down'}},
  minute_sub100:{cohort:'MINUTE MARKET CAP',minuteSampler:true,fixedStakeUsd:100,mcMin:0,mcMax:100000,minuteMinLiq:1500,scoreMode:'momentum',exitMode:'minute',maxHold:.80,playbookOverride:{minQuality:0,minBuy:0,maxBuy:1,minTx:0,maxRisk:100,minMomentum:0,minAccel:0,minLiq:1500,mcMin:0,mcMax:100000,instruction:'Minute sampler: one forced paper entry about every minute, strictly below $100K market cap; rank available candidates but do not wait for a normal alpha threshold'}},
  minute_100_250:{cohort:'MINUTE MARKET CAP',minuteSampler:true,fixedStakeUsd:100,mcMin:100000,mcMax:250000,minuteMinLiq:3000,scoreMode:'momentum',exitMode:'minute',maxHold:.80,playbookOverride:{minQuality:0,minBuy:0,maxBuy:1,minTx:0,maxRisk:100,minMomentum:0,minAccel:0,minLiq:3000,mcMin:100000,mcMax:250000,instruction:'Minute sampler: one forced paper entry about every minute, strictly $100K–$250K market cap; rank available candidates but do not wait for a normal alpha threshold'}},
  minute_500_1m:{cohort:'MINUTE MARKET CAP',minuteSampler:true,fixedStakeUsd:100,mcMin:500000,mcMax:1000000,minuteMinLiq:5000,scoreMode:'quality',exitMode:'minute',maxHold:.80,playbookOverride:{minQuality:0,minBuy:0,maxBuy:1,minTx:0,maxRisk:100,minMomentum:0,minAccel:0,minLiq:5000,mcMin:500000,mcMax:1000000,instruction:'Minute sampler: one forced paper entry about every minute, strictly $500K–$1M market cap; rank available candidates but do not wait for a normal alpha threshold'}},

  meme_smooth_curve:{memeTheory:true,cohort:'MEME / CHART THEORY',requireGraduated:false,tokenAgeMin:.8,tokenAgeMax:8,mcMin:25000,mcMax:180000,buyRatioMin:.50,buyRatioMax:.70,sourceMin:2,scoreMode:'meme',exitMode:'runner',maxHold:150,scaleOut:true,sizeBias:.35,minChartQuality:64,minPathQuality:58,maxSpikeRisk:58,maxManipulationRisk:62,minFlowPersistence:52,allowedStructures:['SMOOTH_TREND','BREAKOUT','BREAKOUT_RETEST']},
  meme_retest:{memeTheory:true,cohort:'MEME / CHART THEORY',tokenAgeMin:2,tokenAgeMax:15,mcMin:40000,mcMax:300000,buyRatioMin:.50,buyRatioMax:.70,sourceMin:2,scoreMode:'meme',exitMode:'runner',maxHold:180,scaleOut:true,sizeBias:.35,minChartQuality:62,maxSpikeRisk:60,maxManipulationRisk:60,minFlowPersistence:50,allowedStructures:['BREAKOUT_RETEST']},
  meme_compression:{memeTheory:true,cohort:'MEME / CHART THEORY',tokenAgeMin:2,tokenAgeMax:15,mcMin:30000,mcMax:250000,buyRatioMin:.50,buyRatioMax:.70,sourceMin:2,scoreMode:'meme',exitMode:'runner',maxHold:150,scaleOut:true,sizeBias:.35,minChartQuality:56,maxSpikeRisk:45,maxManipulationRisk:58,minCompression:45,minFlowPersistence:48,allowedStructures:['COMPRESSION','BREAKOUT']},
  meme_postgrad:{memeTheory:true,cohort:'MEME / CHART THEORY',requireGraduated:true,tokenAgeMin:1,tokenAgeMax:30,buyRatioMin:.50,buyRatioMax:.72,sourceMin:2,liqMin:12000,scoreMode:'meme',exitMode:'structure',maxHold:210,scaleOut:true,sizeBias:.35,minChartQuality:60,minPathQuality:52,maxSpikeRisk:62,maxManipulationRisk:58,minFlowPersistence:50,allowedStructures:['SMOOTH_TREND','BREAKOUT','BREAKOUT_RETEST','RECOVERY']},
  meme_survival:{memeTheory:true,cohort:'MEME / CHART THEORY',tokenAgeMin:5,tokenAgeMax:20,mcMin:40000,mcMax:300000,buyRatioMin:.50,buyRatioMax:.68,sourceMin:2,liqMin:10000,scoreMode:'meme',exitMode:'balanced',maxHold:120,sizeBias:.30,minChartQuality:60,minPathQuality:50,maxSpikeRisk:50,maxManipulationRisk:52,minFlowPersistence:55,minSurvival:58,allowedStructures:['SMOOTH_TREND','BREAKOUT_RETEST','RECOVERY','BASE']},

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
  wallet_consensus:{copyLab:true,consensusWallets:2,copyWindowMin:15,maxChase:8,minWalletQuality:58,minWalletCopyability:45,exitMode:'runner',maxHold:240,scaleOut:true},
  confirmed_runner:{researchProfile:'confirmed-runner',exitMode:'runner',maxHold:120},
  asym_swing:{researchProfile:'asymmetric-swing',exitMode:'conviction',maxHold:720,scaleOut:true},
  copy_megga:{copyLab:true,copySource:'megga',copyWindowMin:6,maxChase:8,exitMode:'conviction',maxHold:1440,scaleOut:true},
  megga_scout:{researchProfile:'megga-scout',exitMode:'conviction',maxHold:1440,scaleOut:true}
};
for(const d of strategyDefs)if(copyProfiles[d.id])Object.assign(d,copyProfiles[d.id]);
Object.assign(strategyDefs.find(d=>d.id==='winner1'),{postEntryProfile:'fast-failure',exitMode:'runner',maxHold:90,scaleOut:true});
Object.assign(strategyDefs.find(d=>d.id==='winner2'),{postEntryProfile:'confirm-runner',exitMode:'conviction',maxHold:180,scaleOut:true});
// The 6-3 Smart Money sample was essentially flat because losses overwhelmed winners.
// Keep the signal thesis, but compress downside and preserve the right tail.
Object.assign(strategyDefs.find(d=>d.id==='smart'),{exitMode:'runner',maxHold:240,scaleOut:true});
Object.assign(strategyDefs.find(d=>d.id==='quant'),{exitMode:'balanced',maxHold:150});
Object.assign(strategyDefs.find(d=>d.id==='swing'),{scaleOut:true,maxHold:300});

const challengers = [
  makeChallenger('momentum','momentum-c1','Momentum Challenger','stricter confirmation + fast invalidation',{minDelta:5,takeDelta:10,exitMode:'scalp',sizeBias:.75}),
  makeChallenger('professional','professional-c1','Professional Challenger','stricter risk / slightly larger winners',{minDelta:2,takeDelta:8,riskCap:38}),
  makeChallenger('degen','degen-c1','Degen Challenger','less trigger-happy early entries',{minDelta:6,stopDelta:-2}),
  makeChallenger('smartmom','smartmom-c1','Smart Momentum Challenger','higher confirmation threshold',{minDelta:4,takeDelta:10}),
  makeChallenger('smartmom','sweetspot-c1','Sweet Spot Runner','quality-first anti-chase runner in the strongest observed early/mid-cap zone',{minDelta:-4,exitMode:'runner',maxHold:150,scaleOut:true,sizeBias:.55,playbook:{minQuality:80,minBuy:.52,maxBuy:.72,minTx:8,maxRisk:55,minMomentum:65,maxMomentum:90,minAccel:50,minLiq:10000,minAge:1,maxAge:6,mcMin:40000,mcMax:150000,requireCross:true,minEvidence:4,instruction:'target the observed quality sweet spot: strong but not exhausted flow, high quality, controlled risk and room for a runner'}}),
  makeChallenger('graduation','transition-c1','Transition Runner','research the 50K–120K transition zone without chasing extreme buyer pressure',{minDelta:-2,exitMode:'runner',maxHold:120,scaleOut:true,sizeBias:.55,playbook:{minQuality:80,minBuy:.50,maxBuy:.72,minTx:8,maxRisk:56,minMomentum:64,maxMomentum:90,minAccel:48,minLiq:9000,minAge:.8,maxAge:8,mcMin:50000,mcMax:120000,requireCross:true,minEvidence:4,instruction:'trade the transition zone only when quality is high and buyer pressure is strong but not euphoric'}}),
  makeChallenger('quant','antichase-c1','Anti-Chase Quality','cross-checked quality with explicit exhaustion avoidance',{minDelta:-2,exitMode:'balanced',maxHold:90,sizeBias:.50,playbook:{minQuality:82,minBuy:.50,maxBuy:.70,minTx:9,maxRisk:55,minMomentum:60,maxMomentum:88,minAccel:48,minLiq:10000,minAge:1,maxAge:8,requireCross:true,minEvidence:4,instruction:'prefer high-quality balanced pressure; reject euphoric buyer ratios and momentum exhaustion'}})
];

function makeChallenger(parentId,id,name,mutation,mods={}) {
  const p = strategyDefs.find(x=>x.id===parentId);
  return {...p,id,name,icon:'🧪',risk:'R&D',type:'challenger',parentId,mutation,
    min:p.min+(mods.minDelta||0),stop:p.stop+(mods.stopDelta||0),take:p.take+(mods.takeDelta||0),riskCap:mods.riskCap,
    exitMode:mods.exitMode||p.exitMode||null,sizeBias:mods.sizeBias||1,playbookOverride:mods.playbook||null,maxHold:mods.maxHold||p.maxHold||null,scaleOut:mods.scaleOut??p.scaleOut??false,
    equity:START,cash:START,peak:START,dd:0,wins:0,losses:0,n:0,version:p.version+0.1};
}

const allTraders = () => [...strategyDefs, ...challengers.filter(c=>!c.graveyardAt&&!c.promotedAt)];
const coreStrategies = () => strategyDefs.filter(d=>d.risk!=='CONTROL'&&!d.specialist);
const specialistStrategies = () => strategyDefs.filter(d=>d.specialist&&!d.hypothesis&&!d.memeTheory);
const hypothesisStrategies = () => strategyDefs.filter(d=>d.hypothesis);
const memeTheoryStrategies = () => strategyDefs.filter(d=>d.memeTheory);
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
function setLifecycle(phase,detail=''){
  if(lifecyclePhase===phase&&(!detail||detail===lifecycleDetail))return;
  lifecyclePhase=phase;lifecycleSince=now();lifecycleDetail=detail||lifecycleDetail;
  console.log('LIFECYCLE '+JSON.stringify({phase,detail:lifecycleDetail,ts:lifecycleSince}));
}
function runtimePressure(){
  if(memoryReport(process.memoryUsage(),RUNTIME_MEMORY_BUDGET_MIB).pressure==='CRITICAL')return 'CRITICAL';
  // Market-event backlog is intentionally non-critical while Postgres is unavailable.
  // Counting an unreachable database backlog as runtime pressure caused a permanent
  // CRITICAL loop that starved the very market/mark tasks needed to recover safely.
  const durableEventDepth=db?pendingDbEvents.length:Math.min(50,pendingDbEvents.length);
  const queueDepth=solanaQueue.length+solanaPriorityQueue.length+durableEventDepth+dbWriteHigh.length+dbWriteNormal.length+dbWriteLow.length;
  // p95 is historical context, not proof that the loop is blocked right now.
  // Require current lag to corroborate a high historical p95 so one expected
  // snapshot build cannot pin the engine in CRITICAL for the whole sample window.
  if(eventLoopLagMs>=1000||queueDepth>=1200||(eventLoopLagP95>=1500&&eventLoopLagMs>=250))return'CRITICAL';
  if(eventLoopLagMs>=500||queueDepth>=600||(eventLoopLagP95>=900&&eventLoopLagMs>=100))return'HIGH';
  if(eventLoopLagMs>=150||eventLoopLagP95>=500||queueDepth>=250)return'ELEVATED';
  return'NORMAL';
}
function shouldDeferNonCritical(){return shuttingDown||systemPressure==='HIGH'||systemPressure==='CRITICAL';}
async function runScheduled(name,fn,{budgetMs=1000,critical=false}={}){
  const prev=subsystemRuntime.get(name);if(prev?.status==='running')return false;
  if(!critical&&shouldDeferNonCritical()){subsystemRuntime.set(name,{ts:now(),status:'deferred',pressure:systemPressure});return false;}
  const started=Date.now();subsystemRuntime.set(name,{ts:started,status:'running',budgetMs,pressure:systemPressure});
  try{await fn();const ms=Date.now()-started;subsystemRuntime.set(name,{ts:now(),status:'ok',ms,budgetMs});if(ms>budgetMs)setHealth('runtime-'+name,'warn',name+' exceeded '+budgetMs+'ms budget · '+ms+'ms',{truth:'observed'});return true;}
  catch(e){const ms=Date.now()-started;subsystemRuntime.set(name,{ts:now(),status:'error',ms,error:String(e?.message||e)});setHealth('runtime-'+name,'warn',name+' failed: '+String(e?.message||e),{truth:'observed'});return false;}
}
function watchdogTick(){
  if(shuttingDown||lifecyclePhase==='DRAINING')return;const ts=now(),actions=[];
  if(ts-lastPumpPollAt>30000){actions.push('pump-poll');runScheduled('pump-poll',()=>pumpPoll(),{budgetMs:6000,critical:true});}
  if(ts-lastDexPollAt>60000){actions.push('dex-poll');runScheduled('dex-poll',()=>dexPoll(),{budgetMs:9000,critical:true});}
  if(positions.some(p=>!p.closed)&&ts-lastOpenPositionPollAt>45000){actions.push('open-marks');runScheduled('open-marks',()=>openPositionPoll(),{budgetMs:9000,critical:true});}
  if((solanaQueue.length||solanaPriorityQueue.length)&&ts-lastSolanaDrainAt>5000){actions.push('solana-drain');runScheduled('solana-drain',()=>drainSolanaQueue(),{budgetMs:1500,critical:true});}
  if(DATABASE_URL&&!db&&!dbConnecting&&ts>=dbDisabledUntil){actions.push('postgres-reconnect');scheduleDbReconnect();}
  if(systemPressure==='CRITICAL'){
    criticalPressureSince=criticalPressureSince||ts;
    if(lifecyclePhase==='READY'&&ts-criticalPressureSince>=CRITICAL_PRESSURE_DEGRADE_MS)setLifecycle('DEGRADED','sustained runtime pressure critical');
  }else{
    criticalPressureSince=0;
    if(lifecyclePhase==='DEGRADED'&&/runtime pressure critical/.test(lifecycleDetail)&&['NORMAL','ELEVATED'].includes(systemPressure)&&durableTradingReady())setLifecycle('READY','runtime pressure recovered');
  }
  if(actions.length)console.warn('WATCHDOG_SELF_HEAL '+JSON.stringify({ts,actions,pressure:systemPressure}));
}
function readinessStatus(){
  const durable=durableTradingReady(),journalHealthy=pendingTradeJournal.length<250,integrityHealthy=lastIntegrityReport?.ok!==false,queuesHealthy=dbWriteHigh.length<100&&solanaPriorityQueue.length<100,eventLoopHealthy=eventLoopLagP95<1000;
  const ready=!shuttingDown&&durable&&journalHealthy&&integrityHealthy&&queuesHealthy&&eventLoopHealthy&&['READY','DEGRADED'].includes(lifecyclePhase);
  return{ready,phase:lifecyclePhase,phaseSince:lifecycleSince,detail:lifecycleDetail,pressure:systemPressure,eventLoopLagMs,eventLoopLagP95,durable,dbConnected:!!db,dbReconnect:{attempt:dbReconnectAttempt,nextRetryAt:dbDisabledUntil,lastError:lastDbFailure||null},kvConnected:kvReady,peerRestored:peerStateRestored,stateVersionTs,lastDurableSaveAt,lastCriticalSaveAt,lastPeerRestoreAt,lastIngestAt,integrity:lastIntegrityReport,checks:{durable,journalHealthy,integrityHealthy,queuesHealthy,eventLoopHealthy},journal:{pending:pendingTradeJournal.length,lastFlushAt:lastTradeJournalFlush,written:journalEventsWritten,replayedAt:journalReplayedAt},backpressure:{...backpressureDrops},circuits:Object.fromEntries(providerCircuits),queues:{solana:solanaQueue.length,prioritySolana:solanaPriorityQueue.length,pendingDbEvents:pendingDbEvents.length,dbHigh:dbWriteHigh.length,dbNormal:dbWriteNormal.length,dbLow:dbWriteLow.length},subsystems:Object.fromEntries(subsystemRuntime)};
}
function broadcast(type,data) {
  if(!clients.size)return;
  const payload=`event: ${type}\ndata: ${JSON.stringify(data)}\n\n`;
  for(const c of clients){
    if(rejectSlowStream(c)){clients.delete(c);try{c.destroy()}catch{}continue}
    try {
      // Never queue unbounded SSE data for a stalled mobile client.
      if(!c.write(payload)&&rejectSlowStream(c)){clients.delete(c);try{c.destroy()}catch{}}
    }catch{clients.delete(c);try{c.destroy()}catch{}}
  }
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
  const quoteSymbol=(raw.quoteToken?.symbol||raw.quoteSymbol||'').toString().toUpperCase();
  const dexId=(raw.dexId||raw.dex||'').toString().toLowerCase(),pairAddress=raw.pairAddress||raw.pair||'';
  return {mint,symbol,name,source,price,mc,liq,vol,buys,sells,createdAt,updatedAt:ts,quoteObservedAt:price>0?ts:0,priceUpdatedAt:price>0?ts:0,lastDistinctPriceAt:price>0?ts:0,unchangedPriceTicks:0,priceSource:price>0?src:'',narrative:narrativeFor({name,symbol}),graduated:!!raw.complete,
    twitter,telegram,website,image:raw.image_uri||raw.image||raw.info?.imageUrl||'',creator,boosts,quoteSymbol,dexId,pairAddress,history:[],sources:[src],sourceSeen:{[src]:ts},
    flowObserved,flowUpdatedAt:flowObserved?ts:0,flowSource:flowObserved?src:'',volumeObserved,volumeUpdatedAt:volumeObserved?ts:0,volumeSource:volumeObserved?src:'',
    liquidityObserved:liqObserved,liquidityUpdatedAt:liqObserved?ts:0,liquiditySource:liqObserved?src:'',liquidityKind,curveDepthUsd,inferredSolUsd,
    firstPrice:price,firstMc:mc,peakPrice:price,peakMc:mc,troughPrice:price||0,troughMc:mc||0};
}

function mergeToken(old,t) {
  if(!old) return t;
  const ts=now(),hist=(old.history||[]).slice(-(MAX_TOKEN_HISTORY-1));
  hist.push({ts,price:old.price,mc:old.mc,liq:old.liq,vol:old.vol,buys:old.buys,sells:old.sells});
  const seen={...(old.sourceSeen||{})};for(const [k,v] of Object.entries(t.sourceSeen||{}))seen[k]=Math.max(num(seen[k]),num(v));
  const freshFlow=t.flowObserved;
  const freshVol=t.volumeObserved;
  const freshLiq=t.liquidityObserved;
  const createdCandidates=[old.createdAt,t.createdAt].filter(x=>x>0);
  const oldPrice=num(old.price),incomingPrice=num(t.price),samePrice=oldPrice>0&&incomingPrice>0&&incomingPrice===oldPrice;
  const quoteObservedAt=incomingPrice>0?ts:num(old.quoteObservedAt||old.updatedAt);
  const priceUpdatedAt=incomingPrice>0&&!samePrice?ts:num(old.priceUpdatedAt||old.lastDistinctPriceAt||old.updatedAt||quoteObservedAt);
  const unchangedPriceTicks=incomingPrice>0?(samePrice?num(old.unchangedPriceTicks)+1:0):num(old.unchangedPriceTicks);
  return {...old,...t,
    createdAt:createdCandidates.length?Math.min(...createdCandidates):t.createdAt,
    updatedAt:ts,quoteObservedAt,priceUpdatedAt,lastDistinctPriceAt:priceUpdatedAt,unchangedPriceTicks,priceSource:incomingPrice>0?(t.sources?.[0]||t.source||old.priceSource||'live'):(old.priceSource||''),
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
    quoteSymbol:t.quoteSymbol||old.quoteSymbol||'',dexId:t.dexId||old.dexId||'',pairAddress:t.pairAddress||old.pairAddress||'',
    chainFlow:old.chainFlow||[],boosts:Math.max(t.boosts||0,old.boosts||0)
  };
}

const NON_MEME_SYMBOLS=new Set(['SPYX','NVDAX','RDDT']);
function tokenPriceIntegrity(t){
  const ts=now(),price=num(t?.price),quoteAt=num(t?.quoteObservedAt||t?.updatedAt),distinctAt=num(t?.lastDistinctPriceAt||t?.priceUpdatedAt||quoteAt);
  const quoteAgeMs=quoteAt>0?Math.max(0,ts-quoteAt):Infinity,distinctAgeMs=distinctAt>0?Math.max(0,ts-distinctAt):Infinity,unchangedPriceTicks=Math.max(0,num(t?.unchangedPriceTicks));
  return{price,quoteAt,distinctAt,quoteAgeMs,distinctAgeMs,unchangedPriceTicks,freshQuote:price>0&&quoteAgeMs<=PRICE_QUOTE_MAX_AGE_MS,moving:unchangedPriceTicks===0||distinctAgeMs<=PRICE_QUOTE_MAX_AGE_MS,executable:price>0&&quoteAgeMs<=PRICE_QUOTE_MAX_AGE_MS};
}
function memeUniverseEligibility(t){
  const symbol=String(t?.symbol||'').toUpperCase(),name=String(t?.name||''),text=(symbol+' '+name).toLowerCase();
  if(NON_MEME_SYMBOLS.has(symbol))return{ok:false,reason:'known tokenized stock/equity symbol'};
  if(/\b(tokenized|tokenised|stock|equity|etf|xstock|nasdaq|spdr|reddit|nvidia)\b/i.test(text))return{ok:false,reason:'non-meme/tokenized security metadata'};
  return{ok:true,reason:'meme-universe eligible'};
}
function cleanSeasonStart(){return num(seasonInfo?.startedAt)||0;}
function cleanStrategyTrades(id){
  const start=cleanSeasonStart();
  return trades.filter(x=>x.strategy===id&&num(x.closedAt)>=start);
}
function eraTradeCount(d){return cleanStrategyTrades(d.id).length;}
function isFrozenExperimentStrategy(d){return !!d&&ACTIVE_EXPERIMENT_IDS.has(d.id);}
function experimentStrategyEnabled(d){return !!d&&(d.minuteSampler||ACTIVE_EXPERIMENT_IDS.has(d.id));}
function duplicateTickerAudit(){
  const by=new Map();for(const t of tokens.values()){const s=String(t?.symbol||'').toUpperCase();if(!s)continue;if(!by.has(s))by.set(s,new Set());by.get(s).add(t.mint);}
  return[...by].filter(([,m])=>m.size>1).map(([symbol,mints])=>({symbol,mints:[...mints]})).sort((a,b)=>b.mints.length-a.mints.length);
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


function chartTheory(t){
  const prices=(t.history||[]).filter(x=>num(x.price)>0).slice(-39).map(x=>num(x.price));
  if(num(t.price)>0&&(prices.length===0||prices.at(-1)!==num(t.price)))prices.push(num(t.price));
  const n=prices.length;
  if(n<4)return{n,net:0,pathEfficiency:0,bullContinuity:0,upRatio:0,realizedVol:0,rangePct:0,extensionPct:0,compression:0,expansion:0,breakout:false,retest:false,whipsaw:0,spikeRisk:0,chartQuality:0,structure:'INSUFFICIENT'};
  const rs=[];for(let i=1;i<n;i++)rs.push(pct(prices[i],prices[i-1]));
  const net=pct(prices.at(-1),prices[0]),absPath=rs.reduce((a,x)=>a+Math.abs(x),0);
  const pathEfficiency=clamp(absPath?Math.abs(net)/absPath*100:0),upRatio=rs.length?rs.filter(x=>x>0).length/rs.length*100:50;
  let flips=0;for(let i=1;i<rs.length;i++)if(Math.sign(rs[i])&&Math.sign(rs[i-1])&&Math.sign(rs[i])!==Math.sign(rs[i-1]))flips++;
  const whipsaw=clamp(rs.length>1?flips/(rs.length-1)*100:0),realizedVol=stdev(rs);
  const maxP=Math.max(...prices),minP=Math.min(...prices),rangePct=minP>0?pct(maxP,minP):0;
  const fast=prices.slice(-6),slow=prices.slice(-16),fastMean=avg(fast),slowMean=avg(slow),extensionPct=fastMean>0?pct(prices.at(-1),fastMean):0;
  const prior=prices.slice(Math.max(0,n-22),Math.max(1,n-3)),priorHigh=prior.length?Math.max(...prior):prices[0];
  const recentBefore=prices.slice(Math.max(0,n-6),n-1),recentPeak=recentBefore.length?Math.max(...recentBefore):prices.at(-1);
  const breakout=priorHigh>0&&prices.at(-1)>priorHigh*1.025&&net>3;
  const retest=priorHigh>0&&recentPeak>priorHigh*1.045&&prices.at(-1)>=priorHigh*.965&&prices.at(-1)<=priorHigh*1.07&&fastMean>=slowMean;
  const recentRs=rs.slice(-5),olderRs=rs.slice(Math.max(0,rs.length-15),Math.max(0,rs.length-5)),recentVol=stdev(recentRs),olderVol=stdev(olderRs);
  const compression=olderVol>0?clamp((1-recentVol/olderVol)*100):0,expansion=olderVol>0?clamp((recentVol/olderVol-1)*55):0;
  const largest=Math.max(...rs.map(x=>Math.abs(x))),oneBarDominance=absPath?largest/absPath*100:0;
  const spikeRisk=clamp(Math.max(0,Math.abs(extensionPct)-12)*2.2+Math.max(0,oneBarDominance-38)*1.35+Math.max(0,realizedVol-18)*1.2);
  const bullContinuity=net>0?clamp(pathEfficiency*.58+upRatio*.42):0,trendBias=fastMean>slowMean?75:35;
  const chartQuality=clamp(bullContinuity*.42+(100-whipsaw)*.18+trendBias*.15+(100-spikeRisk)*.15+(net>0?70:25)*.10);
  let structure='BASE';
  if(spikeRisk>=72)structure='VERTICAL_SPIKE';
  else if(retest)structure='BREAKOUT_RETEST';
  else if(breakout)structure='BREAKOUT';
  else if(compression>=55&&Math.abs(extensionPct)<12)structure='COMPRESSION';
  else if(net>7&&bullContinuity>=62)structure='SMOOTH_TREND';
  else if(whipsaw>=62)structure='CHOP';
  else if(net<0&&prices.at(-1)>fastMean)structure='RECOVERY';
  return{n,net,pathEfficiency,bullContinuity,upRatio,realizedVol,rangePct,extensionPct,compression,expansion,breakout,retest,whipsaw,spikeRisk,chartQuality,structure,fastMean,slowMean};
}
function memeTheory(t,f,chart){
  const rows=(t.history||[]).slice(-12).map(x=>({buys:num(x.buys),sells:num(x.sells)})).filter(x=>x.buys+x.sells>0);
  const flowPersistence=rows.length?rows.filter(x=>x.buys/(x.buys+x.sells)>=.50).length/rows.length*100:50;
  const priorTotals=rows.slice(0,-1).map(x=>x.buys+x.sells),activityBase=avg(priorTotals),activityRatio=activityBase>0?f.totalTx/activityBase:1;
  const turnover=t.liq>0&&f.activeVol>0?f.activeVol/t.liq:0;
  const curveMechanicalRisk=!t.graduated?clamp(Math.max(0,chart.net-18)*1.15+Math.max(0,f.buyRatio-.72)*130+Math.max(0,12-f.totalTx)*2.2+chart.spikeRisk*.25):0;
  const crowdingRisk=clamp(Math.max(0,f.buyRatio-.68)*150+Math.max(0,f.momentum-82)*1.5+Math.max(0,chart.extensionPct-14)*1.4);
  const attentionDecay=clamp((1-Math.min(1.5,activityRatio))*75+Math.max(0,50-flowPersistence)*.8);
  const manipulationSuspicion=clamp(f.creatorRisk*.7+(100-f.sourceQuality)*.22+curveMechanicalRisk*.30+chart.spikeRisk*.25+(f.buyRatio>.78&&f.totalTx<12?18:0));
  const survival=clamp(Math.min(35,f.age*5)+Math.min(25,f.totalTx*1.3)+f.sourceQuality*.18+f.liqScore*.22);
  const antiCrowd=100-Math.max(crowdingRisk,curveMechanicalRisk);
  const memeQuality=clamp(chart.chartQuality*.32+flowPersistence*.17+survival*.18+antiCrowd*.18+(100-attentionDecay)*.08+(100-manipulationSuspicion)*.07);
  const phase=t.graduated?'PUMPSWAP':'BONDING_CURVE';
  let setup=phase+'_'+chart.structure;
  if(attentionDecay>=65)setup=phase+'_ATTENTION_FADE';
  if(manipulationSuspicion>=72)setup=phase+'_SUSPICIOUS';
  return{phase,setup,flowPersistence,activityRatio,turnover,curveMechanicalRisk,crowdingRisk,attentionDecay,manipulationSuspicion,survival,memeQuality};
}

function features(t) {
  const ts=now(),cacheKey=t?.mint||t?.symbol||'',cached=cacheKey?featureCache.get(cacheKey):null;if(cached&&cached.updatedAt===num(t?.updatedAt)&&ts-cached.ts<750)return cached.value;
  const hist=(t.history||[]).filter(x=>x.price>0),age=ageMin(t);
  const one=hist.at(-1)||{price:t.price},five=hist[Math.max(0,hist.length-5)]||one,twenty=hist[Math.max(0,hist.length-20)]||five;
  const shortRet=pct(t.price,one.price),mediumRet=pct(t.price,five.price),longRet=pct(t.price,twenty.price);
  const timedPrice=(ms)=>{const target=ts-ms;for(let i=hist.length-1;i>=0;i--){if(num(hist[i].ts)<=target&&num(hist[i].price)>0)return num(hist[i].price);}return num(hist[0]?.price)||num(t.price);};
  const timedCoverageSec=hist.length?Math.max(0,(ts-num(hist[0].ts))/1000):0,ret5s=pct(t.price,timedPrice(5000)),ret20s=pct(t.price,timedPrice(20000)),ret60s=pct(t.price,timedPrice(60000));
  const timedMomentum=clamp(50+Math.tanh(ret5s/5)*22+Math.tanh(ret20s/14)*28),timedAcceleration=clamp(50+Math.tanh(((ret5s/5)-(ret20s/20))*7)*50);
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
  const chart=chartTheory(t),score=clamp(momentum*.20+acceleration*.10+flow*.18+liqScore*.13+volScore*.14+early*.05+social*.07+(100-risk)*.09+sourceQuality*.04);
  const base={momentum,acceleration,shortRet,mediumRet,longRet,ret5s,ret20s,ret60s,timedMomentum,timedAcceleration,timedCoverageSec,drawdown,rebound,flow,flowFresh,buyRatio,totalTx:total,age,liqScore,liqFresh,volScore,volumeFresh,activeVol,early,graduation,social,risk,score,sourceQuality,freshSources,creatorRisk,chart};
  const meme=memeTheory(t,base,chart),value={...base,meme};if(cacheKey){featureCache.set(cacheKey,{ts,updatedAt:num(t?.updatedAt),value});if(featureCache.size>MAX_RUNTIME_TOKENS*2){for(const k of featureCache.keys()){if(!tokens.has(k))featureCache.delete(k);if(featureCache.size<=MAX_RUNTIME_TOKENS*2)break;}}}return value;
}

function strategyRegimeWeight(id,regime){
  const key=id+':'+regime,cache=regimeWeightCache.get(key);
  if(cache&&cache.tradeCount===trades.length&&now()-cache.ts<15000)return cache.value;
  const rows=trades.filter(t=>t.strategy===id&&t.policyVersion===STRATEGY_ERA&&(t.samplePartition||partitionForMint(t.mint))==='train'&&(t.entryRegime||'UNKNOWN')===regime).slice(0,120);
  let value=1;
  if(rows.length>=3){const edge=rows.reduce((a,t)=>a+t.pnlPct,0)/rows.length,learned=clamp(1+edge/45,.45,2.0),trust=rows.length/(rows.length+12);value=learned*trust+1*(1-trust);}
  regimeWeightCache.set(key,{ts:now(),tradeCount:trades.length,value});return value;
}

function specialistEligibility(d,t,f=features(t),regime=null){
  if(!d.specialist)return{ok:true,reason:'core'};
  regime=regime||marketWeather().regime;const dna=creatorDNA(t),age=f.age,ratio=t.mc>0?t.liq/t.mc:0;
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
  if(d.memeTheory){
    const ch=f.chart||{},m=f.meme||{};
    if(Number.isFinite(d.minChartQuality)&&ch.chartQuality<d.minChartQuality)return{ok:false,reason:'chart quality below theory floor'};
    if(Number.isFinite(d.minPathQuality)&&ch.bullContinuity<d.minPathQuality)return{ok:false,reason:'price path lacks continuity'};
    if(Number.isFinite(d.maxSpikeRisk)&&ch.spikeRisk>d.maxSpikeRisk)return{ok:false,reason:'vertical extension / spike risk'};
    if(Number.isFinite(d.maxManipulationRisk)&&m.manipulationSuspicion>d.maxManipulationRisk)return{ok:false,reason:'manipulation-suspicion proxy too high'};
    if(Number.isFinite(d.minFlowPersistence)&&m.flowPersistence<d.minFlowPersistence)return{ok:false,reason:'participation not persistent'};
    if(Number.isFinite(d.minSurvival)&&m.survival<d.minSurvival)return{ok:false,reason:'survival score too low'};
    if(Number.isFinite(d.minCompression)&&ch.compression<d.minCompression&&ch.structure!=='BREAKOUT')return{ok:false,reason:'no qualifying compression'};
    if(Array.isArray(d.allowedStructures)&&!d.allowedStructures.includes(ch.structure))return{ok:false,reason:'chart structure mismatch'};
  }
  return{ok:true,reason:'specialist population match'};
}

function specialistScore(d,f,t){
  const mode=d.scoreMode||'quality',q=tokenDataQuality(t);
  if(mode==='meme'){
    const m=f.meme||{},ch=f.chart||{};
    return clamp((m.memeQuality||0)*.36+(ch.chartQuality||0)*.25+f.acceleration*.12+f.flow*.10+f.liqScore*.07+(100-f.risk)*.10);
  }
  if(mode==='hypothesis'){
    const balancedFlow=f.buyRatio>=.50&&f.buyRatio<=.72?90:f.buyRatio>.80?25:55;
    const exhaustion=f.momentum>92?18:100;
    return clamp(q.score*.24+f.momentum*.18+f.acceleration*.18+f.flow*.12+f.liqScore*.10+(100-f.risk)*.10+balancedFlow*.05+exhaustion*.03);
  }
  if(mode==='velocity')return clamp(f.timedAcceleration*.32+f.timedMomentum*.26+f.flow*.14+f.volScore*.08+(f.chart?.chartQuality||50)*.08+(100-f.risk)*.12);
  if(mode==='early')return clamp(f.early*.28+f.momentum*.24+f.flow*.22+f.volScore*.18+(100-f.risk)*.08);
  if(mode==='momentum')return clamp(f.momentum*.36+f.flow*.26+f.volScore*.22+f.liqScore*.10+(100-f.risk)*.06);
  if(mode==='flow')return clamp(f.flow*.42+f.momentum*.24+f.volScore*.20+f.liqScore*.08+(100-f.risk)*.06);
  if(mode==='social'){const social=profitAccelerator.adjustedSocial(f.social,{trades,strategyId:d.id,era:STRATEGY_ERA}).value;return clamp(social*.34+f.flow*.22+f.momentum*.20+f.volScore*.16+(100-f.risk)*.08);}
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
  else if(sid==='social'){const social=profitAccelerator.adjustedSocial(f.social,{trades,strategyId:sid,era:STRATEGY_ERA}).value;s=social*.25+f.momentum*.20+f.acceleration*.10+f.flow*.18+f.volScore*.12+(100-f.risk)*.15;}
  else if(sid==='momentum')s=f.momentum*.34+f.acceleration*.20+f.flow*.22+f.volScore*.14+f.liqScore*.10;
  else if(sid==='graduation')s=(t.graduated?28:0)+f.flow*.18+f.momentum*.16+f.acceleration*.10+f.volScore*.12+f.liqScore*.08+(100-f.risk)*.08;
  else if(sid==='dip')s=clamp(45+Math.max(-20,f.drawdown)*.35+f.rebound*.45+f.acceleration*.18+f.flow*.16+(100-f.risk)*.12);
  else if(sid==='swing')s=f.liqScore*.22+f.volScore*.13+f.flow*.16+f.momentum*.14+f.acceleration*.08+(100-f.risk)*.17+q.score*.10;
  else if(sid==='degen')s=f.early*.18+f.momentum*.25+f.acceleration*.18+f.flow*.20+f.volScore*.11+(100-f.risk)*.08;
  else if(sid==='smartmom')s=f.momentum*.27+f.acceleration*.17+f.flow*.25+f.volScore*.12+(100-f.risk)*.12+q.score*.07;
  else if(sid==='culture'){const social=profitAccelerator.adjustedSocial(f.social,{trades,strategyId:sid,era:STRATEGY_ERA}).value;s=social*.19+f.momentum*.20+f.acceleration*.12+f.flow*.21+f.volScore*.12+(100-f.risk)*.10+q.score*.06;}
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
  else if(sid==='wallet_consensus'){const wc=alphaOS.walletConsensus(t,d.copyWindowMin||15);s=f.score*.30+q.score*.18+f.acceleration*.08+(100-f.risk)*.10+Math.min(20,wc.qualifiedCount*8)+wc.score*.14;}
  else if(sid==='confirmed_runner')s=f.momentum*.25+f.acceleration*.20+f.flow*.20+q.score*.14+f.liqScore*.10+(100-f.risk)*.11;
  else if(sid==='asym_swing')s=f.liqScore*.19+q.score*.18+f.flow*.14+f.momentum*.14+f.acceleration*.10+(100-f.risk)*.20+f.volScore*.05;
  else if(sid==='volume')s=f.volScore*.70+f.liqScore*.30;
  else if(sid==='launchctl')s=100;
  else if(sid==='socialctl')s=profitAccelerator.adjustedSocial(f.social,{trades,strategyId:sid,era:STRATEGY_ERA}).value;
  else if(sid==='random')s=deterministicScore('random-control:'+t.mint);
  else if(sid==='winner1')s=deterministicScore('winner1-entry:'+t.mint);
  else if(sid==='winner2')s=deterministicScore('winner2-entry:'+t.mint);
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

function consensus(t,regimeOverride=null) {
  const f=features(t),adv=adversarialRisk(t),q=tokenDataQuality(t),regime=regimeOverride||marketWeather().regime,votes=[];
  for(const d of strategyDefs.filter(x=>x.risk!=='CONTROL'&&!x.specialist)){
    const score=strategyScore(d,f,t),p=entryPolicy(d),g=entryGuard(d,t,f,score,p,q,adv,regime),weight=strategyRegimeWeight(d.id,regime)*diversityWeight(d.id);
    votes.push({id:d.id,name:d.name,icon:d.icon,score,yes:g.ok&&score>=p.min,threshold:g.requiredScore||p.min,baseThreshold:d.min,blocked:!g.ok,why:g.reason,weight});
  }
  const yes=votes.filter(v=>v.yes).length,totalWeight=votes.reduce((a,v)=>a+v.weight,0)||1,yesWeight=votes.filter(v=>v.yes).reduce((a,v)=>a+v.weight,0);
  return {yes,total:votes.length,pct:votes.length?yes/votes.length*100:0,weightedPct:yesWeight/totalWeight*100,hardVeto:adv.hardVeto,votes};
}
function marketWeather() {
  const ts=now();if(marketWeatherCache.value&&ts-marketWeatherCache.ts<1000)return marketWeatherCache.value;
  const recent=[...tokens.values()].filter(t=>ts-t.updatedAt<180000);
  if(!recent.length){const value={regime:'OFFLINE',phase:'OFFLINE',temperature:0,buyPressure:0,launchVelocity:0,collapseRate:0,risk:0,graduations:0,medianLiq:0,medianMc:0,momentumDispersion:0};marketWeatherCache={ts,value};return value;}
  const fs=recent.map(features),av=x=>x.length?x.reduce((a,b)=>a+b,0)/x.length:0;
  const buyPressure=av(fs.map(f=>f.buyRatio))*100,mom=av(fs.map(f=>f.momentum)),risk=av(fs.map(f=>f.risk)),momentumDispersion=stdev(fs.map(f=>f.momentum)),launchVelocity=recent.filter(t=>ts-t.createdAt<300000).length/5,collapseRate=recent.filter(t=>t.firstPrice&&t.price/t.firstPrice<.5).length/recent.length*100,graduations=recent.filter(t=>t.graduated).length,medianLiq=median(recent.map(t=>num(t.liq)).filter(x=>x>0)),medianMc=median(recent.map(t=>num(t.mc)).filter(x=>x>0)),temperature=clamp(mom*.45+buyPressure*.35+(100-risk)*.20);
  let regime='SELECTIVE';if(temperature>68&&buyPressure>56)regime='HOT';if(temperature<42||buyPressure<43)regime='RISK OFF';
  let phase='BALANCED';if(medianLiq>0&&medianLiq<9000)phase='THIN';else if(regime==='HOT'&&collapseRate>=35)phase='FRAGILE HOT';else if(regime==='HOT'&&launchVelocity>=2.5&&buyPressure>=60)phase='EUPHORIC';else if(regime==='HOT')phase='HEALTHY TREND';else if(regime==='RISK OFF')phase='DEFENSIVE';else if(momentumDispersion>=24||collapseRate>=40)phase='CHOPPY';else if(buyPressure>=53&&mom>=55)phase='EARLY TREND';
  const value={regime,phase,temperature,buyPressure,launchVelocity,collapseRate,risk,graduations,medianLiq,medianMc,momentumDispersion};marketWeatherCache={ts,value};return value;
}

function narrativeStats() {
  const ts=now();if(narrativeStatsCache.value&&ts-narrativeStatsCache.ts<5000)return narrativeStatsCache.value;
  const groups=new Map();
  for(const t of tokens.values()){if(ts-t.updatedAt>1800000)continue;const key=t.narrative||'Memes';if(!groups.has(key))groups.set(key,[]);groups.get(key).push(t);}
  const value=[...groups].map(([name,arr])=>{const fs=arr.map(features),av=x=>x.length?x.reduce((a,b)=>a+b,0)/x.length:0,momentum=av(fs.map(f=>f.momentum)),buyPressure=av(fs.map(f=>f.buyRatio))*100,volume=arr.reduce((a,t)=>a+t.vol,0),recent=arr.filter(t=>ts-t.createdAt<600000).length,saturation=clamp(arr.length*6),heat=clamp(momentum*.34+buyPressure*.28+Math.log10(Math.max(10,volume))*7+recent*3-saturation*.12);return{name,count:arr.length,recent,momentum,buyPressure,volume,heat,saturation};}).sort((a,b)=>b.heat-a.heat);
  narrativeStatsCache={ts,value};return value;
}

function openCount(id){return positions.filter(p=>p.strategy===id&&!p.closed).length;}
function positionMarkDetail(p){
  const t=tokens.get(p.mint),integrity=tokenPriceIntegrity(t),live=integrity.executable?num(t?.price):0,liveTs=integrity.executable?num(t?.quoteObservedAt||t?.updatedAt):0,last=num(p.lastPrice||p.entry),lastTs=num(p.lastMarkedAt||p.opened);
  const base=live>0?live:last,markTs=live>0?liveTs:lastTs,ageMs=Math.max(0,now()-markTs);
  return{price:base,rawPrice:base,ageMs,multiplier:1,stale:ageMs>STALE_MARK_WARN_MS,executable:integrity.executable,quoteAgeMs:integrity.quoteAgeMs,distinctAgeMs:integrity.distinctAgeMs,unchangedPriceTicks:integrity.unchangedPriceTicks,source:live>0?'verified-token':'last-verified-position'};
}
function positionMarkPrice(p){return positionMarkDetail(p).price;}
function markEquity(d){
  let e=d.cash;
  for(const p of positions.filter(x=>x.strategy===d.id&&!x.closed)){
    const px=positionMarkPrice(p);if(px>0)e+=p.units*px;
  }
  d.equity=e;d.peak=Math.max(d.peak,e);d.dd=Math.max(d.dd,(1-e/d.peak)*100);
  if(!(num(d.auditPeak)>0))d.auditPeak=e;
  d.auditPeak=Math.max(d.auditPeak,e);d.auditDd=Math.max(num(d.auditDd),d.auditPeak>0?(1-e/d.auditPeak)*100:0);
}
let lastAuthorityAudit={ts:0,ok:true,source:'boot',repairs:0,rows:[]};
function experimentLedgerView(d){
  const closed=cleanStrategyTrades(d.id),open=positions.filter(p=>p.strategy===d.id&&!p.closed);
  const minimumExpected=num(recoveryHighWater?.strategyN?.[d.id]);
  const coverageComplete=closed.length>=minimumExpected;
  const realizedPnl=closed.reduce((z,t)=>z+num(t.pnl),0);
  let cash=START+realizedPnl;
  for(const p of open)cash-=num(p.entryCost)||num(p.invested)*(1+FEE_RATE),cash+=num(p.realizedProceeds);
  let equity=cash;
  for(const p of open){const px=positionMarkPrice(p);if(px>0)equity+=num(p.units)*px;}
  return{closed,open,n:closed.length,wins:closed.filter(t=>num(t.pnl)>0).length,losses:closed.filter(t=>num(t.pnl)<=0).length,realizedPnl,cash,equity,coverageComplete,minimumExpected};
}
function reconcileAuthoritativeExperimentState({repair=true,source='runtime'}={}){
  const rows=[];let repairs=0,ok=true;
  for(const d of strategyDefs.filter(isFrozenExperimentStrategy)){
    const v=experimentLedgerView(d);
    if(!v.coverageComplete){ok=false;rows.push({id:d.id,ok:false,reason:'ledger coverage below recovery high-water',ledgerN:v.n,minimumExpected:v.minimumExpected,runtimeN:num(d.n)});continue;}
    const drift={n:num(d.n)-v.n,wins:num(d.wins)-v.wins,losses:num(d.losses)-v.losses,cash:num(d.cash)-v.cash,equity:num(d.equity)-v.equity};
    const bad=drift.n!==0||drift.wins!==0||drift.losses!==0||Math.abs(drift.cash)>.01||Math.abs(drift.equity)>.01;
    if(bad&&repair){
      d.n=v.n;d.wins=v.wins;d.losses=v.losses;d.cash=v.cash;d.equity=v.equity;
      d.peak=Math.max(START,num(d.peak),v.equity);d.auditPeak=Math.max(START,num(d.auditPeak),v.equity);
      d.dd=Math.max(0,num(d.dd),d.peak>0?(1-v.equity/d.peak)*100:0);
      d.auditDd=Math.max(0,num(d.auditDd),d.auditPeak>0?(1-v.equity/d.auditPeak)*100:0);
      repairs++;
    }
    rows.push({id:d.id,ok:!bad||repair,ledgerN:v.n,runtimeN:num(d.n),cash:num(d.cash),equity:num(d.equity),drift});
  }
  lastAuthorityAudit={ts:now(),ok:ok&&rows.every(r=>r.ok),source,repairs,rows};
  if(repairs)console.warn('STATE_AUTHORITY_RECONCILE '+JSON.stringify({source,repairs,rows:rows.filter(r=>Object.values(r.drift||{}).some(x=>Math.abs(num(x))>.01))}));
  setHealth('state-authority',lastAuthorityAudit.ok?'ok':'warn',lastAuthorityAudit.ok?'Single runtime/ledger authority reconciled':'State authority needs ledger coverage before repair',{truth:'observed'});
  return lastAuthorityAudit;
}
function authoritativeStrategyView(d){
  if(!isFrozenExperimentStrategy(d))return d;
  const v=experimentLedgerView(d);
  if(!v.coverageComplete)return{...d,authority:'runtime-counters',authorityWarning:'ledger coverage incomplete'};
  return{...d,n:v.n,wins:v.wins,losses:v.losses,cash:v.cash,equity:v.equity,authority:'clean-ledger',authorityWarning:null};
}

function recordDecision(d,t,f,score,action,why='',weather=null) {
  weather=weather||marketWeather();const exploratoryDecision=action==='BUY'&&String(why||'').startsWith('cold-start exploration');const row={ts:now(),era:STRATEGY_ERA,samplePartition:partitionForMint(t.mint),strategy:d.id,strategyName:d.name,mint:t.mint,symbol:t.symbol,action,score,risk:f.risk,price:t.price,mc:t.mc,narrative:t.narrative,regime:weather.regime,phase:weather.phase,why,exploratory:exploratoryDecision,
    features:{momentum:f.momentum,acceleration:f.acceleration,flow:f.flow,buyRatio:f.buyRatio,volScore:f.volScore,liqScore:f.liqScore,drawdown:f.drawdown,rebound:f.rebound,social:f.social,age:f.age,sourceQuality:f.sourceQuality,chartQuality:f.chart?.chartQuality,pathContinuity:f.chart?.bullContinuity,chartStructure:f.chart?.structure,spikeRisk:f.chart?.spikeRisk,memeSetup:f.meme?.setup,memeQuality:f.meme?.memeQuality,manipulationSuspicion:f.meme?.manipulationSuspicion,flowPersistence:f.meme?.flowPersistence}};
  decisions.unshift(row); decisions.splice(MAX_DECISIONS);
  if(action==='BUY'&&d.risk!=='CONTROL'&&!d.specialist&&!d.minuteSampler)console.log('CORE_ENTRY '+JSON.stringify({ts:row.ts,strategy:d.id,name:d.name,symbol:t.symbol,mint:t.mint,score,threshold:entryPolicy(d).min,exploratory:exploratoryDecision,reason:why,mc:t.mc,regime:weather.regime}));
  const key=`${d.id}:${t.mint}`;
  if(!opportunities.has(key)){
    opportunities.set(key,{...row,firstTs:row.ts,firstPrice:t.price,bestReturn:0,worstReturn:0,latestReturn:0,entered:action==='BUY'});
    registerOpportunityKey(key,t.mint);
  } else if(action==='BUY'){const o=opportunities.get(key);o.entered=true;o.action='BUY';o.entryTs=row.ts;o.entryPrice=t.price;o.score=score;o.risk=f.risk;o.why=why;o.regime=row.regime;}
}

function updateOpportunities(t) {
  const keys=opportunityKeysByMint.get(t.mint);if(!keys)return;
  for(const key of keys){const o=opportunities.get(key);if(!o||!o.firstPrice)continue;const r=pct(t.price,o.firstPrice);o.latestReturn=r;o.bestReturn=Math.max(o.bestReturn,r);o.worstReturn=Math.min(o.worstReturn,r);o.lastTs=now();}
}

function stableHash32(input=''){
  let h=2166136261>>>0;
  for(const ch of String(input)){h^=ch.charCodeAt(0);h=Math.imul(h,16777619)>>>0;}
  return h>>>0;
}
function deterministicScore(key){return (stableHash32(key)%1000000)/10000;}
function partitionForMint(mint){return stableHash32(mint)%5===0?'holdout':'train';}
function registerOpportunityKey(key,mint){
  if(!mint)return;
  if(!opportunityKeysByMint.has(mint))opportunityKeysByMint.set(mint,new Set());
  opportunityKeysByMint.get(mint).add(key);
}
function rebuildOpportunityIndex(){
  opportunityKeysByMint.clear();entryPolicyCache.clear();regimeWeightCache.clear();dnaSimilarityCache.clear();
  for(const [key,o] of opportunities)registerOpportunityKey(key,o?.mint);
}
function pruneOpportunities(){
  const cutoff=now()-OPPORTUNITY_RETENTION_MS;
  for(const [key,o] of opportunities){
    if(num(o?.lastTs||o?.firstTs)<cutoff){
      opportunities.delete(key);
      const set=opportunityKeysByMint.get(o?.mint);if(set){set.delete(key);if(!set.size)opportunityKeysByMint.delete(o?.mint);}
    }
  }
  if(opportunities.size>MAX_OPPORTUNITIES){
    const extra=opportunities.size-MAX_OPPORTUNITIES;
    const old=[...opportunities.entries()].sort((a,b)=>num(a[1]?.lastTs||a[1]?.firstTs)-num(b[1]?.lastTs||b[1]?.firstTs)).slice(0,extra);
    for(const [key,o] of old){opportunities.delete(key);const set=opportunityKeysByMint.get(o?.mint);if(set){set.delete(key);if(!set.size)opportunityKeysByMint.delete(o?.mint);}}
  }
}
function durableTradingReady(){
  // A pinned offsite snapshot is a rescue copy, not a writable current canonical store.
  // Never open new paper positions from it until Postgres is restored and checkpointed.
  if(emergencyOffsiteRestored&&(!db||!dbStateRestored||lastDurableSaveAt<=0))return false;
  if(!stateIntegrityOk||shuttingDown||lifecyclePhase==='DRAINING')return false;
  if(!DATABASE_URL&&!REDIS_URL&&!PEER_RECOVERY_URL)return true;
  if(!(dbStateRestored||kvStateRestored||localStateRestored||peerStateRestored))return false;
  const anchor=Math.max(lastDurableSaveAt,lastDurableRestoreAt,lastKvSaveAt,lastKvRestoreAt,lastLocalRestoreAt,lastPeerRestoreAt);
  return !!db||kvReady||(anchor>0&&now()-anchor<=DURABLE_WRITE_GRACE_MS);
}
function storageStatus(){
  return{
    canonical:DATABASE_URL?'postgres':REDIS_URL?'key-value':'local-memory',
    pinnedOffsite:{restored:emergencyOffsiteRestored,savedAt:emergencyOffsiteSavedAt,paperEntryLocked:emergencyOffsiteRestored&&!durableTradingReady()},
    postgres:{configured:!!DATABASE_URL,connected:!!db,restored:dbStateRestored,lastSaveAt:lastDurableSaveAt,lastRestoreAt:lastDurableRestoreAt},
    keyValue:{configured:!!REDIS_URL,connected:kvReady,restored:kvStateRestored,lastSaveAt:lastKvSaveAt,lastRestoreAt:lastKvRestoreAt,persistent:false,role:'disposable failover cache'},
    peer:{configured:!!PEER_RECOVERY_URL,restored:peerStateRestored,lastRestoreAt:lastPeerRestoreAt,maxRecoveryAgeMs:PEER_RECOVERY_MAX_AGE_MS,role:'independent emergency snapshot peer'},
    local:{restored:localStateRestored,lastRestoreAt:lastLocalRestoreAt,maxRecoveryAgeMs:LOCAL_RECOVERY_MAX_AGE_MS,role:'emergency recovery only'},
    highWater:{seasonKey:recoveryHighWater.seasonKey,ledgerRows:num(recoveryHighWater.ledgerRows),productionExits:num(recoveryHighWater.productionExits),exitTotal:num(recoveryHighWater.exitTotal),strategies:Object.keys(recoveryHighWater.strategyN||{}).length,updatedAt:num(recoveryHighWater.updatedAt),source:recoveryHighWater.source},
    forensic:{active:!!forensicRecovery.active,detailedTrades:num(forensicRecovery.detailedTrades),observedLedgerRows:num(forensicRecovery.observedLedgerRows),aggregateRecoveredRows:num(forensicLedgerGaps.total),baselineAt:num(forensicLedgerGaps.baselineAt),source:forensicLedgerGaps.source||''},
    tradingUnlocked:durableTradingReady(),stateVersionTs,graceMs:DURABLE_WRITE_GRACE_MS
  };
}
function pruneRuntimeMemory(){
  const openMints=new Set(positions.filter(p=>!p.closed).map(p=>p.mint));
  const cutoff=now()-2*3600000;
  for(const [mint,t] of tokens)if(!openMints.has(mint)&&num(t.updatedAt)<cutoff)tokens.delete(mint);
  if(tokens.size>MAX_RUNTIME_TOKENS){
    const removable=[...tokens.entries()].filter(([m])=>!openMints.has(m)).sort((a,b)=>num(a[1].updatedAt)-num(b[1].updatedAt));
    for(const [mint] of removable.slice(0,Math.max(0,tokens.size-MAX_RUNTIME_TOKENS)))tokens.delete(mint);
  }
  for(let i=positions.length-1;i>=0;i--)if(positions[i].closed)positions.splice(i,1);
  pruneOpportunities();
  const activeCreators=new Set([...tokens.values()].map(t=>t.creator).filter(Boolean));
  if(creators.size>4000)for(const [k] of creators)if(!activeCreators.has(k)&&creators.size>4000)creators.delete(k);
  if(marketEventClock.size>MAX_RUNTIME_TOKENS*2)for(const [mint] of marketEventClock)if(!tokens.has(mint))marketEventClock.delete(mint);
  if(featureCache.size>MAX_RUNTIME_TOKENS*2)for(const [mint] of featureCache)if(!tokens.has(mint))featureCache.delete(mint);
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
  smart:{minQuality:68,minBuy:.52,maxBuy:.76,minTx:9,maxRisk:58,minMomentum:50,minAccel:44,minLiq:10000,minAge:1,walletCount:1,walletWindow:20,requireCross:true,instruction:'a tracked-wallet buy is only a lead; require wallet quality, copyability, cross-source market confirmation and compressed downside'},
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
  if(d.playbookOverride)return{...d.playbookOverride,instruction:d.playbookOverride.instruction||d.thesis};
  const id=d.parentId||d.id;
  if(CORE_PLAYBOOKS[id])return CORE_PLAYBOOKS[id];
  if(d.copyLab){
    const base={minQuality:62,minBuy:.52,maxBuy:.86,minTx:5,maxRisk:64,minMomentum:50,minAccel:45,minLiq:7000,minAge:.5,instruction:d.thesis};
    if(d.id==='copy_unipcs')return{...base,minQuality:60,maxRisk:66,minBuy:.52};
    if(d.id==='copy_frank')return{...base,minQuality:64,maxRisk:62,minBuy:.55};
    if(d.id==='copy_orangie')return{...base,minQuality:66,maxRisk:58,minBuy:.57};
    if(d.id==='copy_rasmr')return{...base,minQuality:60,maxRisk:64,minBuy:.60,minAccel:52};
    if(d.id==='copy_megga')return{...base,minQuality:48,maxRisk:70,minBuy:.48,maxBuy:.92,minTx:3,minMomentum:50,minAccel:40,minLiq:2500,minAge:.05,maxAge:10,mcMax:250000};
    if(d.id==='wallet_consensus')return{...base,minQuality:70,maxRisk:56,minBuy:.52,maxBuy:.76,minMomentum:52,minAccel:46,minLiq:12000,minAge:1.5,requireCross:true,mcMin:75000};
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
  let n=0;if(q.score>=70)n++;if(f.buyRatio>=.58&&f.buyRatio<=.76)n++;if(f.momentum>=62)n++;if(f.acceleration>=52)n++;if(f.risk<=55)n++;if(q.sourceCount>=2)n++;if(f.liqScore>=45)n++;
  const w=verifiedWalletSignal(t,15),wc=alphaOS.walletConsensus(t,15);if(w.count)n++;if(wc.qualifiedCount>=1)n++;if(wc.strong)n++;
  return{n,wallets:w.count,qualifiedWallets:wc.qualifiedCount,walletConsensusScore:wc.score};
}
function entryPolicy(d){
  const cache=entryPolicyCache.get(d.id);
  if(cache&&cache.decisionCount===decisions.length&&now()-cache.ts<15000)return cache.value;
  const rows=decisions.filter(x=>x.strategy===d.id&&x.era===STRATEGY_ERA&&(x.samplePartition||partitionForMint(x.mint))==='train').slice(0,250);
  const rejects=rows.filter(x=>x.action==='REJECT').length,scores=rows.map(x=>num(x.score)).filter(Number.isFinite);
  const p75=percentile(scores,.75),p90=percentile(scores,.90),coldStart=!rows.some(x=>x.action==='BUY'&&!x.exploratory);
  let effectiveMin=d.min,relief=0;
  if(rows.length>=20&&Number.isFinite(p90)){
    if(isFrozenExperimentStrategy(d)&&eraTradeCount(d)<FROZEN_EXPERIMENT_MIN_TRADES){
      // Collection mode: calibrate to the market we are actually observing while
      // preserving every hard data/risk/liquidity/cross-source veto below.
      const adaptiveFloor=Math.max(CORE_COLLECTION_MIN_SCORE_FLOOR,d.min-CORE_COLLECTION_MAX_SCORE_RELIEF);
      effectiveMin=clamp((Number.isFinite(p75)?p75:p90)+3,adaptiveFloor,d.min);
      relief=Math.max(0,d.min-effectiveMin);
    }else if(coldStart){
      const adaptiveFloor=Math.max(46,d.min-14);
      effectiveMin=clamp(p90+3,adaptiveFloor,d.min);
      relief=Math.max(0,d.min-effectiveMin);
    }else effectiveMin=Math.max(d.min,p90);
  }
  const playbook=strategyPlaybook(d);
  const value={coldStart,rejects,relief,min:effectiveMin,baseMin:d.min,p75,p90,p25Risk:null,
    lowRiskLimit:playbook.maxRisk??58,sniperRiskLimit:playbook.maxRisk??52,customRiskLimit:d.riskCap||playbook.maxRisk||null};
  entryPolicyCache.set(d.id,{ts:now(),decisionCount:decisions.length,value});return value;
}

function strategyHealth(d){
  const rows=trades.filter(x=>x.strategy===d.id&&x.policyVersion===STRATEGY_ERA&&(x.samplePartition||partitionForMint(x.mint))==='train').slice(0,8);
  return{n:rows.length,avg:rows.length?avg(rows.map(x=>x.pnlPct)):0,winRate:rows.length?rows.filter(x=>x.pnl>0).length/rows.length*100:0};
}
function entryGuard(d,t,f,score,policy,quality,adv,regime){
  if(d.risk==='CONTROL')return{ok:true,reason:'benchmark/control',requiredScore:policy.min,minQuality:0,minBuyRatio:0,health:strategyHealth(d),playbook:{instruction:d.thesis}};
  const h=strategyHealth(d),p=strategyPlaybook(d),stack=evidenceStack(t,f,quality);
  const frozen=isFrozenExperimentStrategy(d)&&eraTradeCount(d)<FROZEN_EXPERIMENT_MIN_TRADES;
  let scoreBuffer=0,minQuality=p.minQuality??60,minBuyRatio=p.minBuy??.55,maxRisk=p.maxRisk??64;
  const minTx=frozen?Math.max(5,(p.minTx??0)-3):(p.minTx??0);
  const minMomentum=frozen?Math.max(48,(p.minMomentum??0)-10):(p.minMomentum??0);
  const minAccel=frozen?Math.max(42,(p.minAccel??0)-8):(p.minAccel??0);
  const minLiq=frozen?Math.max(7500,(p.minLiq??0)*.75):(p.minLiq??0);
  if(frozen){minQuality=Math.max(60,minQuality-6);minBuyRatio=Math.max(.50,minBuyRatio-.04);maxRisk=Math.min(68,maxRisk+4);}
  if(regime==='RISK OFF'){scoreBuffer+=4;minQuality+=4;minBuyRatio+=.03;maxRisk-=3;}
  if(!frozen&&h.n>=4&&h.avg<0){scoreBuffer+=3;minQuality+=3;minBuyRatio+=.02;}
  if(!frozen&&h.n>=5&&h.avg<=-8){scoreBuffer+=4;maxRisk-=3;}
  const learned=frozen?policy.min:(policy.coldStart?policy.min:(Number.isFinite(policy.p90)?policy.p90:policy.min)),requiredScore=Math.max(policy.min,learned+scoreBuffer);
  const fail=reason=>({ok:false,reason,requiredScore,minQuality,minBuyRatio,health:h,playbook:p,stack});
  if(quality.score<minQuality)return fail('abstain: data quality');
  if(p.requireCross&&quality.sourceCount<2)return fail('abstain: cross-source confirmation');
  if(!f.flowFresh||!f.liqFresh)return fail('abstain: stale or unobserved market data');
  if(f.totalTx<minTx)return fail('abstain: insufficient transaction depth');
  if(f.buyRatio<minBuyRatio||f.buyRatio>(p.maxBuy??1))return fail('abstain: buyer pressure shape');
  if(f.risk>maxRisk||adv.score>=72)return fail('abstain: structural risk');
  if(f.momentum<minMomentum||f.momentum>(p.maxMomentum??100))return fail('abstain: momentum shape');
  if(f.acceleration<minAccel)return fail('abstain: no acceleration');
  if(Number.isFinite(p.minTimedCoverageSec)&&f.timedCoverageSec<p.minTimedCoverageSec)return fail('abstain: insufficient timed price history');
  if(Number.isFinite(p.minRet5s)&&f.ret5s<p.minRet5s)return fail('abstain: 5s velocity too slow');
  if(Number.isFinite(p.minRet20s)&&f.ret20s<p.minRet20s)return fail('abstain: 20s velocity too slow');
  if(Number.isFinite(p.maxRet20s)&&f.ret20s>p.maxRet20s)return fail('abstain: 20s burst already overextended');
  if(Number.isFinite(p.minShortRet)&&f.shortRet<p.minShortRet)return fail('abstain: burst too slow');
  if(Number.isFinite(p.maxShortRet)&&f.shortRet>p.maxShortRet)return fail('abstain: burst already overextended');
  if(Number.isFinite(p.minMediumRet)&&f.mediumRet<p.minMediumRet)return fail('abstain: no sustained burst');
  if(Number.isFinite(p.maxMediumRet)&&f.mediumRet>p.maxMediumRet)return fail('abstain: burst already overextended');
  if(t.liq<minLiq)return fail('abstain: thin liquidity');
  if(f.age<(p.minAge??0)||f.age>(p.maxAge??Infinity))return fail('abstain: wrong age window');
  if(Number.isFinite(p.mcMin)&&t.mc<p.mcMin)return fail('abstain: market cap below playbook');
  if(Number.isFinite(p.mcMax)&&t.mc>p.mcMax)return fail('abstain: market cap above playbook');
  if(Number.isFinite(p.walletCount)){
    const smartSignal=verifiedWalletSignal(t,p.walletWindow||15);
    if(smartSignal.count<p.walletCount)return fail('abstain: smart-wallet confirmation');
    const ranked=smartSignal.events.map(e=>alphaOS.walletQuality(e.wallet,t.mc)).sort((a,b)=>b.score-a.score),best=ranked[0];
    if(best&&best.evidenceN>=3&&(best.excluded||best.score<52||best.copyability<40))return fail('abstain: watched wallet not yet copyable');
  }
  if(Number.isFinite(p.drawMin)&&f.drawdown<p.drawMin)return fail('abstain: pullback too deep');
  if(Number.isFinite(p.drawMax)&&f.drawdown>p.drawMax)return fail('abstain: no qualifying pullback');
  if(Number.isFinite(p.minRebound)&&f.rebound<p.minRebound)return fail('abstain: rebound unconfirmed');
  if(Number.isFinite(p.minSocial)&&f.social<p.minSocial)return fail('abstain: attention unconfirmed');
  if(p.requireSocial2&&[!!t.twitter,!!t.telegram,!!t.website].filter(Boolean).length<2)return fail('abstain: social channels incomplete');
  if(p.requireGraduated&&!t.graduated)return fail('abstain: graduation unconfirmed');
  if(Number.isFinite(p.minEvidence)&&stack.n<p.minEvidence)return fail('abstain: evidence stack');
  if(d.copyLab){
    if(d.id==='wallet_consensus'){
      const wc=alphaOS.walletConsensus(t,d.copyWindowMin||15);
      if(wc.qualifiedCount<(d.consensusWallets||2))return fail('abstain: independent qualified-wallet consensus');
      if(wc.score<(d.minWalletQuality||58))return fail('abstain: wallet consensus quality');
      if(Number.isFinite(wc.avgChase)&&wc.avgChase>(d.maxChase??10))return fail('abstain: consensus chase limit');
    }else{
      const signal=verifiedWalletSignal(t,d.copyWindowMin||15,d.copySource||null);
      if(signal.count<1)return fail('abstain: verified wallet signal');
      if(Number.isFinite(signal.maxChase)&&signal.maxChase>(d.maxChase??10))return fail('abstain: copy chase limit');
      const qualities=signal.events.map(e=>alphaOS.walletQuality(e.wallet,t.mc)),best=qualities.sort((a,b)=>b.score-a.score)[0];
      if(best&&best.evidenceN>=3&&(best.excluded||best.copyability<(d.minWalletCopyability||35)))return fail('abstain: source wallet not copyable');
    }
  }
  if(score<requiredScore)return fail('abstain: edge buffer');
  return{ok:true,reason:'v3 evidence stack passed',requiredScore,minQuality,minBuyRatio,health:h,playbook:p,stack};
}
function dormantExplorationGuard(d,t,f,score,policy,quality,adv,regime){
  if(d.copyLab||d.risk==='CONTROL'||!policy.coldStart||policy.rejects<6||adv.hardVeto)return{ok:false};
  const p=strategyPlaybook(d),stack=evidenceStack(t,f,quality),learned=Number.isFinite(policy.p90)?policy.p90-2:policy.min-8,scoreFloor=Math.max(40,Math.min(policy.min-5,learned));
  const maxRisk=Math.min(76,(p.maxRisk??60)+14),minQuality=Math.max(52,(p.minQuality??60)-12);
  const minBuy=Math.max(.44,(p.minBuy??.52)-.10),maxBuy=Math.min(.82,(p.maxBuy??.76)+.06);
  const minMom=Math.max(40,(p.minMomentum??55)-15),maxMom=Math.min(98,(p.maxMomentum??92)+6);
  const minAccel=Math.max(30,(p.minAccel??48)-16),minLiq=Math.max(2500,(p.minLiq??7000)*.38);
  if(quality.score<minQuality||quality.sourceCount<1||!f.flowFresh||!f.liqFresh)return{ok:false};
  if(f.totalTx<Math.max(3,(p.minTx??6)-5)||f.buyRatio<minBuy||f.buyRatio>maxBuy)return{ok:false};
  if(f.risk>maxRisk||adv.score>=80||f.momentum<minMom||f.momentum>maxMom||f.acceleration<minAccel)return{ok:false};
  if(t.liq<minLiq||score<scoreFloor)return{ok:false};
  if(Number.isFinite(p.mcMin)&&t.mc<p.mcMin*.85)return{ok:false};
  if(Number.isFinite(p.mcMax)&&t.mc>p.mcMax*1.15)return{ok:false};
  if(Number.isFinite(p.minEvidence)&&stack.n<Math.max(2,p.minEvidence-2))return{ok:false};
  return{ok:true,reason:'cold-start micro-probe',requiredScore:scoreFloor,minQuality,minBuyRatio:minBuy,health:strategyHealth(d),playbook:p,stack};
}


function recentLossStreak(d,limit=6){
  const rows=trades.filter(x=>x.strategy===d.id&&x.policyVersion===STRATEGY_ERA).slice(0,limit);
  let n=0;for(const r of rows){if(num(r.pnl)<0)n++;else break;}return n;
}
function recentRealizedPct(d,hours=6){
  const cutoff=now()-hours*3600000,rows=trades.filter(x=>x.strategy===d.id&&x.policyVersion===STRATEGY_ERA&&num(x.closedAt)>=cutoff);
  return rows.reduce((s,x)=>s+num(x.pnl),0)/Math.max(1,d.equity)*100;
}
function currentEraRiskWatermark(d){
  markEquity(d);
  const closed=trades.filter(x=>x.strategy===d.id&&x.policyVersion===STRATEGY_ERA&&Number.isFinite(num(x.pnl))).sort((a,b)=>num(a.closedAt)-num(b.closedAt));
  const open=positions.filter(p=>p.strategy===d.id&&!p.closed&&p.policyVersion===STRATEGY_ERA);
  const realized=closed.reduce((z,x)=>z+num(x.pnl),0);
  const openPnl=open.reduce((z,p)=>{
    const mark=num(p.units)*positionMarkPrice(p)+num(p.realizedProceeds);
    const cost=num(p.entryCost)||num(p.invested)*(1+FEE_RATE);
    return z+(mark-cost);
  },0);
  let base=d.equity-realized-openPnl;
  if(!(base>0))base=Math.max(1,d.equity);
  let equity=base,peak=base;
  for(const x of closed){equity+=num(x.pnl);peak=Math.max(peak,equity);}
  equity+=openPnl;
  peak=Math.max(peak,equity,d.equity);
  const drawdown=peak>0?Math.max(0,(1-d.equity/peak)*100):0;
  return{base,peak,drawdown,closedN:closed.length,openN:open.length,realized,openPnl};
}
function strategyRiskCircuit(d){
  const eraRisk=currentEraRiskWatermark(d),drawdown=eraRisk.drawdown,recent24h=recentRealizedPct(d,24);
  if(drawdown>=PAPER_MAX_DRAWDOWN_PCT)return{ok:false,reason:`risk circuit: current-era max drawdown ${drawdown.toFixed(1)}%`,drawdown,recent24h,eraRisk};
  if(recent24h<=-PAPER_DAILY_LOSS_LIMIT_PCT)return{ok:false,reason:`risk circuit: 24h loss ${recent24h.toFixed(1)}%`,drawdown,recent24h,eraRisk};
  return{ok:true,reason:'risk circuit clear',drawdown,recent24h,eraRisk};
}
function strategyExpectancyProfile(d){
  const rows=trades.filter(x=>x.strategy===d.id&&x.policyVersion===STRATEGY_ERA&&Number.isFinite(num(x.pnlPct))).slice(0,60),wins=rows.filter(x=>num(x.pnlPct)>0),losses=rows.filter(x=>num(x.pnlPct)<0),n=rows.length;
  const avgWin=avg(wins.map(x=>num(x.pnlPct))),avgLoss=Math.abs(avg(losses.map(x=>num(x.pnlPct)))),winRate=n?wins.length/n:0,expectancy=winRate*avgWin-(1-winRate)*avgLoss,grossWin=wins.reduce((s,x)=>s+num(x.pnlPct),0),grossLoss=Math.abs(losses.reduce((s,x)=>s+num(x.pnlPct),0)),profitFactor=grossLoss?grossWin/grossLoss:grossWin>0?9.99:0,reliability=n/(n+15);
  let mult=n<5?.90:expectancy<0?clamp(.80+expectancy/40,.45,.82):profitFactor<1?.72:clamp(.92+Math.min(12,expectancy)/120+.06*reliability,.92,1.06);
  if(n>=8&&avgLoss>Math.max(12,avgWin*1.5))mult=Math.min(mult,.60);
  return{n,wins:wins.length,losses:losses.length,winRate:winRate*100,avgWin,avgLoss,expectancy,profitFactor,reliability,mult};
}
function tradeCadenceGuard(d,t){
  if(d.risk==='CONTROL')return{ok:true,reason:'control cadence unrestricted'};
  const ts=now(),isResearch=d.risk==='R&D'||d.specialist,isCopy=!!d.copyLab,minGap=d.fastScalp?30000:isResearch?45000:isCopy?90000:PAPER_CORE_ENTRY_GAP_MS,sameMintGap=d.fastScalp?1800000:isResearch?Math.min(PAPER_SAME_MINT_COOLDOWN_MS,7200000):PAPER_SAME_MINT_COOLDOWN_MS,maxHour=d.fastScalp?12:isResearch||isCopy?7:PAPER_MAX_CORE_ENTRIES_PER_HOUR;
  const history=[...trades.filter(x=>x.policyVersion===STRATEGY_ERA),...positions.filter(x=>x.policyVersion===STRATEGY_ERA)].filter(x=>x.strategy===d.id),lastOpened=Math.max(0,...history.map(x=>num(x.opened))),recent=history.filter(x=>num(x.opened)>=ts-3600000).length,same=trades.find(x=>x.policyVersion===STRATEGY_ERA&&x.strategy===d.id&&x.mint===t.mint&&num(x.closedAt)>=ts-sameMintGap);
  if(lastOpened&&ts-lastOpened<minGap)return{ok:false,reason:'cadence guard: strategy cooling down'};
  if(recent>=maxHour)return{ok:false,reason:'cadence guard: hourly trade cap'};
  if(same)return{ok:false,reason:'cadence guard: same-token rebuy cooldown'};
  return{ok:true,reason:'cadence clear',recent,minGap,sameMintGap,maxHour};
}
function productionSafetyGate(d,t,f,quality,alpha){
  if(d.risk==='CONTROL'||d.risk==='R&D'||d.specialist)return{ok:true,reason:'research/control population exempt'};
  const wc=alpha?.walletConsensus||alphaOS.walletConsensus(t,15),dna=creatorDNA(t),reasons=[];
  if(t.mc<50000)reasons.push('production safety: sub-$50K launch zone');
  if(t.mc<100000&&!wc.strong)reasons.push('production safety: sub-$100K requires strong independent wallet consensus');
  if(dna.launches<=1&&!wc.strong)reasons.push('production safety: first-observed creator requires strong wallet consensus');
  if(!t.graduated&&t.mc<100000&&!wc.strong)reasons.push('production safety: fragile pre-graduation setup');
  if(f.buyRatio>.80&&!wc.strong)reasons.push('production safety: euphoric buyer pressure');
  if(quality.sourceCount<2&&!d.copyLab)reasons.push('production safety: single-source data');
  if(alpha?.preTradeSafety?.score<55)reasons.push('production safety: composite safety score');
  return{ok:reasons.length===0,reason:reasons[0]||'production safety passed',reasons,walletConsensus:wc};
}
function coldStartProbeSafety(d,t,f,quality,adv,alpha){
  if(d.copyLab||d.risk==='CONTROL'||d.specialist||d.minuteSampler)return{ok:false,reason:'cold-start probe not allowed for this strategy'};
  const reasons=[],tox=num(alpha?.toxicity?.score),pStop=num(alpha?.probability?.pStop15),congestion=num(alpha?.execution?.congestion),alphaSafety=num(alpha?.preTradeSafety?.score);
  if(adv.hardVeto||num(adv.score)>=72)reasons.push('adversarial hard veto');
  if(!(t.price>0))reasons.push('invalid price');
  if(num(t.mc)<50000)reasons.push('market cap below $50K probe floor');
  if(num(t.liq)<7500)reasons.push('liquidity below $7.5K probe floor');
  if(num(quality?.score)<52||num(quality?.sourceCount)<1)reasons.push('insufficient observed data quality');
  if(!f.flowFresh||!f.liqFresh)reasons.push('stale flow or liquidity');
  if(num(f.risk)>70)reasons.push('structural risk too high');
  if(num(f.age)<.35)reasons.push('token too young for probe');
  if(alpha?.toxicity?.veto||tox>=76)reasons.push('toxic flow veto');
  if(pStop>.78)reasons.push('loss probability hard veto');
  if(congestion>95)reasons.push('execution congestion hard veto');
  if(alphaSafety<42)reasons.push('Alpha safety below probe floor');
  return{ok:reasons.length===0,reason:reasons[0]||'bounded cold-start probe safety passed',reasons,alphaSafety,toxicity:tox,pStop,congestion};
}

function recentTokenVolatility(t){
  const h=(t.history||[]).filter(x=>x.price>0).slice(-14);if(h.length<3)return 0;
  const rs=[];for(let i=1;i<h.length;i++)rs.push(Math.abs(pct(h[i].price,h[i-1].price)));
  return avg(rs);
}
const SOL_CANONICAL_FEE_TIERS=[
  [420,.0125],[1470,.0120],[2460,.0115],[3440,.0110],[4420,.0105],[9820,.0100],[14740,.0095],[19650,.0090],[24560,.0085],[29470,.0080],
  [34380,.0075],[39300,.0070],[44210,.0065],[49120,.0060],[54030,.0055],[58940,.00525],[63860,.0050],[68770,.00475],[73681,.0045],
  [78590,.00425],[83500,.0040],[88400,.00375],[93330,.0035],[98240,.00325],[Infinity,.0030]
];
const USDC_CANONICAL_FEE_TIERS=[
  [59000,.0125],[300000,.0120],[500000,.0115],[700000,.0110],[900000,.0105],[2000000,.0100],[3000000,.0095],[4000000,.0090],
  [5000000,.0085],[6000000,.0080],[7000000,.0075],[8000000,.0070],[9000000,.0065],[10000000,.0060],[11000000,.0055],
  [12000000,.0053],[13000000,.0050],[14000000,.0048],[15000000,.0045],[16000000,.0043],[17000000,.0040],[18000000,.0038],
  [19000000,.0035],[20000000,.0033],[Infinity,.0030]
];
function feeTier(value,tiers){for(const [max,rate] of tiers)if(value<max)return rate;return FEE_RATE;}
function platformFeeRate(t){
  if(!t?.graduated)return FEE_RATE;
  const quote=(t.quoteSymbol||'').toUpperCase();
  if(quote==='USDC'&&t.mc>0)return feeTier(t.mc,USDC_CANONICAL_FEE_TIERS);
  if(quote==='SOL'&&t.mc>0&&t.inferredSolUsd>0)return feeTier(t.mc/t.inferredSolUsd,SOL_CANONICAL_FEE_TIERS);
  return FEE_RATE;
}
function executionQuote(t,notional,side='buy'){
  const liq=Math.max(1000,num(t?.liq)),vol=recentTokenVolatility(t);
  const impact=Math.min(.06,Math.max(0,num(notional))/liq*.5);
  const volatilitySlip=Math.min(.015,Math.max(0,vol)/100*.05);
  const slippage=clamp(.0035+impact+volatilitySlip,0,.08);
  const feeRate=platformFeeRate(t),fixedCost=Math.max(0,PAPER_FIXED_TX_COST_USD);
  const rawPrice=num(t?.price),fillPrice=rawPrice*(side==='sell'?1-slippage:1+slippage);
  return{side,feeRate,fixedCost,slippage,impact,volatilitySlip,rawPrice,fillPrice,liquidity:liq,volatility:vol,feeModel:t?.graduated?'pumpswap-canonical-or-conservative':'pump-bonding-curve'};
}
function tradeEconomicsAtTarget(d,t,budget,entryExec=null){
  const takePct=Math.max(1,num(d?.take)||20),buy=entryExec||executionQuote(t,budget,'buy'),grossProfit=budget*(takePct/100);
  const targetExitNotional=budget+grossProfit,sell=executionQuote(t,targetExitNotional,'sell');
  const buyCosts=budget*(num(buy.feeRate)+num(buy.slippage))+num(buy.fixedCost)+num(buy.expectedFailureCost);
  const sellCosts=targetExitNotional*(num(sell.feeRate)+num(sell.slippage))+num(sell.fixedCost)+num(sell.expectedFailureCost);
  const roundTripCosts=buyCosts+sellCosts,netAtTarget=grossProfit-roundTripCosts;
  return{takePct,grossProfit,buyCosts,sellCosts,roundTripCosts,netAtTarget,buySlippage:num(buy.slippage),sellSlippage:num(sell.slippage),exitNotional:targetExitNotional};
}

function adaptivePositionSizing(d,t,f,score,policy,quality,similar,guard,adv,regime,allocatorMult=1,exploratory=false){
  const isHypothesis=!!d.hypothesis,isResearch=d.risk==='R&D'||d.specialist,isProbe=!!d.copyLab||d.id==='megga_scout'||exploratory||isHypothesis,h=guard.health||strategyHealth(d);
  const basePct=exploratory?.10:isHypothesis?.18:isProbe?.24:isResearch?.20:.32;
  const confidence=clamp(.82+(score-(guard.requiredScore||policy.min))/40,.72,1.18);
  const qualityMult=clamp(.76+quality.score/300,.78,1.10);
  const adverseMult=clamp(1.14-num(adv.score)/180,.62,1.05);
  const regimeMult=regime==='HOT'?1.06:regime==='RISK OFF'?.70:regime==='OFFLINE'?.45:1;
  const mcMult=t.mc>0?(t.mc<25000?.72:t.mc<50000?.86:t.mc<100000?.94:t.mc>=500000?1.04:1):.82;
  const ageMult=f.age<.75?.72:f.age<2?.86:f.age>15?1.03:1;
  const vol=recentTokenVolatility(t),volMult=vol>30?.62:vol>20?.72:vol>12?.84:vol>7?.93:1;
  const dnaMult=similar.n>=6?clamp(.80+(similar.hit25/100)*.32,.80,1.12):.94;
  const healthMult=h.n<4?.92:h.avg<=-10?.55:h.avg<0?.74:h.avg>=8&&h.winRate>=55?1.06:1;
  const streak=recentLossStreak(d),streakMult=streak>=4?.45:streak===3?.58:streak===2?.72:streak===1?.88:1;
  const sizingRisk=currentEraRiskWatermark(d),sizingPeak=sizingRisk.peak,currentDd=sizingRisk.drawdown;
  const ddMult=currentDd>=12?.45:currentDd>=8?.60:currentDd>=5?.78:1;
  const recent6h=recentRealizedPct(d,6),recentMult=recent6h<=-7?.50:recent6h<=-4?.70:recent6h>=5?1.04:1;
  const learnedAlloc=clamp(allocatorMult,.35,1.45),expectancy=strategyExpectancyProfile(d),expectancyMult=expectancy.mult;
  const mult=clamp(confidence*qualityMult*adverseMult*regimeMult*mcMult*ageMult*volMult*dnaMult*healthMult*streakMult*ddMult*recentMult*learnedAlloc*expectancyMult,.28,1.45);

  const stopFrac=clamp((num(d.stop)||14)/100,.07,.30);
  const maxStopLossPct=d.risk==='LOW'?.040:d.risk==='HIGH'?.060:d.risk==='EXTREME'?.070:d.risk==='R&D'?.035:.050;
  const stopRiskCap=d.equity*maxStopLossPct/stopFrac;
  const positionCapPct=exploratory?.15:isHypothesis?.28:isProbe?.35:isResearch?.30:.50,portfolioCapPct=exploratory?.30:isHypothesis?.50:isProbe?.60:isResearch?.55:.75,narrativeCapPct=.40,creatorCapPct=.35;
  const mine=positions.filter(p=>p.strategy===d.id&&!p.closed);
  const markValue=p=>p.units*positionMarkPrice(p);
  const openExposure=mine.reduce((s,p)=>s+markValue(p),0);
  const narrativeExposure=t.narrative?mine.filter(p=>(tokens.get(p.mint)?.narrative||'')===t.narrative).reduce((s,p)=>s+markValue(p),0):0;
  const creatorExposure=t.creator?mine.filter(p=>(tokens.get(p.mint)?.creator||'')===t.creator).reduce((s,p)=>s+markValue(p),0):0;
  const exposureRoom=Math.max(0,d.equity*portfolioCapPct-openExposure);
  const narrativeRoom=Math.max(0,d.equity*narrativeCapPct-narrativeExposure);
  const creatorRoom=Math.max(0,d.equity*creatorCapPct-creatorExposure);
  const minStake=d.equity*(exploratory?.05:isHypothesis?.08:isProbe?.10:isResearch?.08:.15);
  const liquidityCap=t.liq>0?Math.max(minStake,t.liq*.020):0;
  const desired=Number.isFinite(num(d.fixedStakeUsd))&&num(d.fixedStakeUsd)>0?Math.min(num(d.fixedStakeUsd),d.equity*positionCapPct):d.equity*basePct*mult;
  const budget=Math.min(d.cash*.55,d.equity*positionCapPct,stopRiskCap,exposureRoom,narrativeRoom,creatorRoom,liquidityCap,Math.max(minStake,desired));
  const live100Equivalent=budget*(100/START);
  return{
    ok:budget>=minStake&&budget>0,budget,basePct,mult,confidence,qualityMult,adverseMult,regimeMult,mcMult,ageMult,vol,volMult,dnaMult,
    healthMult,streak,streakMult,currentDd,ddMult,recent6h,recentMult,learnedAlloc,expectancy,expectancyMult,stopFrac,maxStopLossPct,stopRiskCap,
    openExposure,narrativeExposure,creatorExposure,portfolioCapPct,narrativeCapPct,creatorCapPct,liquidityCap,live100Equivalent,
    reason:budget<minStake?'sizing guard: insufficient safe exposure room':'adaptive bankroll sizing'
  };
}

function maybeTrade(t,weather=null) {
  if(shuttingDown||lifecyclePhase==='DRAINING'||!durableTradingReady())return;
  weather=weather||marketWeather();const f=features(t),quality=tokenDataQuality(t),adv=adversarialRisk(t,f,quality),similar=dnaSimilarity(t);
  for(const d of allTraders()){
    markEquity(d);
    if(d.hypothesis&&d.hypothesisRetiredAt)continue;
    const existing=positions.find(p=>p.strategy===d.id&&p.mint===t.mint&&!p.closed);
    if(existing){
      if(manageCopyPosition(d,existing,t))continue;
      const alphaExit=alphaOS.exitPlan(existing,t,f),openProfitUsd=estimatedOpenProfitUsd(existing,t),alphaRiskExit=/risk|rug|liquidity|catastrophic|stop|fraud|honeypot|thesis|invalid/i.test(String(alphaExit.reason||'')),alphaProfitAllowed=openProfitUsd<=0||openProfitUsd>=PAPER_MIN_PROFIT_TAKE_USD||alphaRiskExit;
      const postEntryExperiment=!!d.postEntryProfile;
      if(alphaExit.action==='EXIT'&&alphaProfitAllowed&&(!postEntryExperiment||alphaRiskExit)){existing.alphaExit=alphaExit;closePos(d,existing,t,'Alpha OS · '+alphaExit.reason);continue;}
      if(alphaExit.action==='TRIM'&&alphaProfitAllowed&&!postEntryExperiment&&now()-num(existing.alphaExitAt)>60000){existing.alphaExitAt=now();existing.alphaExit=alphaExit;partialClose(d,existing,t,alphaExit.fraction,'Alpha OS · '+alphaExit.reason);continue;}
      if(manageScaleOut(d,existing,t))continue;
      const ex=exitDecision(d,existing,t,f);if(ex.exit)closePos(d,existing,t,ex.why);continue;
    }
    if(!experimentStrategyEnabled(d))continue;
    if(d.minuteSampler)continue;
    const priceIntegrity=tokenPriceIntegrity(t),universe=memeUniverseEligibility(t);
    if(!priceIntegrity.executable){recordDecision(d,t,f,strategyScore(d,f,t),'REJECT','data integrity: stale price quote',weather);continue;}
    const corroboratingMarketUpdate=(num(t.flowUpdatedAt)>0&&now()-num(t.flowUpdatedAt)<=PRICE_STAGNANT_MAX_MS)||(num(t.volumeUpdatedAt)>0&&now()-num(t.volumeUpdatedAt)<=PRICE_STAGNANT_MAX_MS)||(num(t.liquidityUpdatedAt)>0&&now()-num(t.liquidityUpdatedAt)<=PRICE_STAGNANT_MAX_MS);
    if(priceIntegrity.unchangedPriceTicks>=4&&priceIntegrity.distinctAgeMs>PRICE_STAGNANT_MAX_MS&&!corroboratingMarketUpdate){recordDecision(d,t,f,strategyScore(d,f,t),'REJECT','data integrity: truly stagnant quote without corroborating market updates',weather);continue;}
    if(!universe.ok){recordDecision(d,t,f,strategyScore(d,f,t),'REJECT','meme universe: '+universe.reason,weather);continue;}
    const eligibility=specialistEligibility(d,t,f,weather.regime);
    if(!eligibility.ok)continue;
    const frozenN=eraTradeCount(d),frozenCollection=isFrozenExperimentStrategy(d)&&frozenN<FROZEN_EXPERIMENT_MIN_TRADES;
    const accelGate=(d.risk==='CONTROL'||frozenCollection)?{ok:true,sizeMultiplier:1,reason:d.risk==='CONTROL'?'control sample unrestricted':'frozen evidence collection'}:profitAccelerator.strategyGate({strategy:d,trades,regime:weather.regime,era:STRATEGY_ERA});
    if(!accelGate.ok){if(!opportunities.has(`${d.id}:${t.mint}`))recordDecision(d,t,f,strategyScore(d,f,t),'REJECT',accelGate.reason,weather);continue;}
    const circuit=strategyRiskCircuit(d);
    if(!circuit.ok){if(!opportunities.has(`${d.id}:${t.mint}`))recordDecision(d,t,f,strategyScore(d,f,t),'REJECT',circuit.reason,weather);continue;}
    if(openCount(d.id)>=Math.max(4,Number(d.maxOpen)||0)||d.cash<Math.max(5,d.equity*.02)||!(t.price>0))continue;
    const score=strategyScore(d,f,t);const policy=entryPolicy(d);const regime=weather.regime,cadence=tradeCadenceGuard(d,t);
    if(!cadence.ok){if(!opportunities.has(`${d.id}:${t.mint}`))recordDecision(d,t,f,score,'REJECT',cadence.reason,weather);continue;}
    const lowBlocked=d.risk==='LOW'&&f.risk>policy.lowRiskLimit;
    const sniperBlocked=(d.parentId==='sniper'||d.id==='sniper')&&f.risk>policy.sniperRiskLimit;
    const customBlocked=policy.customRiskLimit&&f.risk>policy.customRiskLimit;
    const guard=entryGuard(d,t,f,score,policy,quality,adv,regime);
    const exploration=frozenCollection?{ok:false,reason:'frozen experiment: no cold-start rule relaxation'}:dormantExplorationGuard(d,t,f,score,policy,quality,adv,regime);
    const exploratory=(!guard.ok||score<policy.min||lowBlocked||sniperBlocked||customBlocked)&&exploration.ok&&!adv.hardVeto;
    const activeGuard=exploratory?exploration:guard;
    if(exploratory&&openCount(d.id)>=Math.max(4,Number(d.maxOpen)||0))continue;
    if(!exploratory&&(score<policy.min||lowBlocked||sniperBlocked||customBlocked||adv.hardVeto||!guard.ok)){
      if(!opportunities.has(`${d.id}:${t.mint}`))recordDecision(d,t,f,score,'REJECT',score<policy.min?'below threshold':adv.hardVeto?'adversarial veto':!guard.ok?guard.reason:'risk veto',weather);
      continue;
    }
    const corrGuard=d.risk==='CONTROL'?{ok:true,sizeMultiplier:1,reason:'control sample unrestricted'}:profitAccelerator.correlationGuard({strategyId:d.id,token:t,positions,correlations:strategyCorrelation(),tokens});
    if(!corrGuard.ok){recordDecision(d,t,f,score,'REJECT',corrGuard.reason,weather);continue;}
    const championMult=profitAccelerator.championMultiplier({strategyId:d.id,strategies:strategyDefs,trades,regime,era:STRATEGY_ERA});
    const allocatorMult=frozenCollection?1:(d.type==='challenger'?1:allocationWeight(d.id))*accelGate.sizeMultiplier*corrGuard.sizeMultiplier*championMult;
    const adaptiveSizing=adaptivePositionSizing(d,t,f,score,policy,quality,similar,activeGuard,adv,regime,allocatorMult,exploratory);
    const sizing=d.risk==='CONTROL'?{...adaptiveSizing,ok:true,budget:Math.min(d.cash*.50,d.equity*.05),basePct:.05,mult:1,expectancyMult:1,live100Equivalent:Math.min(d.cash*.50,d.equity*.05)*(100/START),reason:'control fixed 5% paper stake'}:adaptiveSizing;
    if(!sizing.ok){recordDecision(d,t,f,score,'REJECT',sizing.reason,weather);continue;}
    const alpha=alphaOS.evaluateCandidate({strategy:d,token:t,features:f,score,threshold:activeGuard.requiredScore||policy.min,quality,similar,regime}),productionSafety=productionSafetyGate(d,t,f,quality,alpha),probeSafety=exploratory?coldStartProbeSafety(d,t,f,quality,adv,alpha):null;
    alphaOS.proposeCapital({strategy:d,token:t,features:f,score,threshold:activeGuard.requiredScore||policy.min,quality,similar,regime});
    if(alpha.veto&&d.risk!=='CONTROL'){recordDecision(d,t,f,score,'REJECT','Alpha OS · '+alpha.vetoReason,weather);continue;}
    if(exploratory&&!probeSafety.ok){recordDecision(d,t,f,score,'REJECT','cold-start probe veto: '+probeSafety.reason,weather);continue;}
    if(!productionSafety.ok&&!exploratory){recordDecision(d,t,f,score,'REJECT',productionSafety.reason,weather);continue;}
    const alphaBudgetMult=d.risk==='CONTROL'?1:(exploratory?Math.max(.72,num(alpha.sizeMultiplier)||0):alpha.sizeMultiplier);
    let budget=d.fastScalp?Math.min(sizing.budget,num(d.fixedStakeUsd)||100,d.cash*.20,d.equity*.12,t.liq>0?Math.max(5,t.liq*.012):sizing.budget):Math.min(sizing.budget*alphaBudgetMult,d.cash*(exploratory?.15:.35),d.equity*(exploratory?.08:.25),t.liq>0?Math.max(d.equity*(exploratory?.02:.05),t.liq*.020):sizing.budget);
    if(budget<Math.max(exploratory?10:25,d.equity*(exploratory?.02:(d.risk==='R&D'||d.specialist)?.03:.05))){recordDecision(d,t,f,score,'REJECT','Alpha OS · stake below meaningful paper minimum',weather);continue;}
    const scienceGate=science.evaluateEntry({strategy:d,token:t,features:f,quality,market:weather,alpha,baseExecution:{...executionQuote(t,budget,'buy'),notional:budget}});
    const explorationScienceHardBlock=!!scienceGate.evidence?.block||num(scienceGate.survival?.collapsePct?.[5])>=85||num(scienceGate.execution?.txFailureProbability)>=.40;
    const fastScalpSoftBypass=!!d.fastScalp&&d.risk==='R&D'&&!explorationScienceHardBlock;
    if(SEASON2_SCIENCE_VETO&&d.risk!=='CONTROL'&&scienceGate.veto&&!fastScalpSoftBypass&&(!exploratory||explorationScienceHardBlock)){recordDecision(d,t,f,score,'REJECT','Season 2 Do Nothing · '+(scienceGate.reasons.join(', ')||('score '+scienceGate.score.toFixed(0))),weather);continue;}
    const scienceSize=(d.fastScalp||d.risk==='CONTROL')?1:clamp(num(scienceGate.evidence?.sizeMultiplier)||1,exploratory?.40:(d.risk==='R&D'||d.specialist)?.35:.50,1.05);let entryExec=scienceGate.execution;
    if(d.fastScalp)entryExec=science.executionSimulation(t,budget,'buy',{...executionQuote(t,budget,'buy'),notional:budget},alpha?.execution||{});
    else if(scienceSize<.999){budget=Math.max(3,budget*scienceSize);entryExec=science.executionSimulation(t,budget,'buy',{...executionQuote(t,budget,'buy'),notional:budget},alpha?.execution||{});}
    let executionQuality=profitAccelerator.executionQuality(entryExec,alpha?.execution||{});
    if(executionQuality.veto){recordDecision(d,t,f,score,'REJECT','execution veto: '+executionQuality.reason,weather);continue;}
    if(d.risk!=='CONTROL'&&!d.fastScalp&&executionQuality.sizeMultiplier<.999){budget=Math.max(3,budget*executionQuality.sizeMultiplier);entryExec=science.executionSimulation(t,budget,'buy',{...executionQuote(t,budget,'buy'),notional:budget},alpha?.execution||{});executionQuality=profitAccelerator.executionQuality(entryExec,alpha?.execution||{});}
    const meaningfulFloor=d.equity*(exploratory?.015:(d.risk==='R&D'||d.specialist)?.025:.05);
    if(!d.fastScalp&&budget<meaningfulFloor){recordDecision(d,t,f,score,'REJECT','paper sizing veto: final stake too small to be meaningful',weather);continue;}
    if(entryExec.slippage>.065){recordDecision(d,t,f,score,'REJECT','execution veto: modeled slippage',weather);continue;}
    const economics=tradeEconomicsAtTarget(d,t,budget,entryExec),economicFloor=(isFrozenExperimentStrategy(d)&&eraTradeCount(d)<FROZEN_EXPERIMENT_MIN_TRADES)?PAPER_COLLECTION_MIN_EXPECTED_NET_WIN_USD:Math.min(PAPER_MIN_EXPECTED_NET_WIN_USD,Math.max(10,budget*.10));
    if(d.risk!=='CONTROL'&&!d.fastScalp&&economics.netAtTarget<economicFloor){recordDecision(d,t,f,score,'REJECT',`economic edge veto: target net ${economics.netAtTarget.toFixed(0)} below ${economicFloor.toFixed(0)} after fees/slippage`,weather);continue;}
    const entry=entryExec.fillPrice;const cost=budget*(1+entryExec.feeRate)+num(entryExec.fixedCost)+num(entryExec.expectedFailureCost);
    if(cost>d.cash)continue;
    d.cash-=cost;
    const p={id:'p'+now()+Math.random(),strategy:d.id,mint:t.mint,symbol:t.symbol,entry,units:budget/entry,originalUnits:budget/entry,invested:budget,entryCost:cost,entryExecution:entryExec,executionQuality,entryEconomics:economics,realizedProceeds:0,partialExits:[],scaleOutHits:[],sourceEntrySig:d.copyLab?(verifiedWalletSignal(t,d.copyWindowMin||15,d.copySource||null).events[0]?.signature||null):null,opened:now(),closed:false,lastPrice:t.price,lastMarkedAt:now(),markSource:'entry',score,entryFeatures:{...f,mc:t.mc,liq:t.liq},entryMc:t.mc,entryLiq:t.liq,entryQuality:quality.score,dnaHit25:similar.hit25,dnaSample:similar.n,allocationMult:allocatorMult,sizingMode:'alpha-os-ev-v1',samplePartition:partitionForMint(t.mint),sizing,alphaOS:alpha,budgetPct:d.equity>0?budget/d.equity:0,live100Equivalent:sizing.live100Equivalent,exitMode:exitModeFor(d),policyVersion:STRATEGY_ERA,guard:{requiredScore:activeGuard.requiredScore,minQuality:activeGuard.minQuality,minBuyRatio:activeGuard.minBuyRatio,recentAvg:activeGuard.health.avg,recentN:activeGuard.health.n,exploratory},coldStartProbe:exploratory,probeSafety:exploratory?probeSafety:null,reason:`${exploratory?'cold-start exploration · ':''}score ${score.toFixed(0)} · gate ${policy.min.toFixed(0)} · risk ${f.risk.toFixed(0)} · Q${quality.score.toFixed(0)} · stake ${(budget/Math.max(1,d.equity)*100).toFixed(1)}% · $100≈${sizing.live100Equivalent.toFixed(2)} · size×${sizing.mult.toFixed(2)} · expectancy×${sizing.expectancyMult.toFixed(2)} · science×${scienceSize.toFixed(2)} · EV ${alpha.expectedValue.toFixed(1)} · targetNet ${economics.netAtTarget.toFixed(0)} · RTcost ${economics.roundTripCosts.toFixed(1)} · safety ${alpha.preTradeSafety.score.toFixed(0)} · walletQ ${alpha.walletConsensus.score.toFixed(0)} · tox ${alpha.toxicity.score.toFixed(0)}`,entryRegime:regime,entryPhase:weather.phase,peakDuring:entry,troughDuring:entry};
    p.season2Science=scienceGate;positions.push(p);science.recordEntry(p,t,{features:f,quality,market:weather});alphaOS.recordShadowEntry({position:p,token:t,alpha});recordDecision(d,t,f,score,'BUY',p.reason,weather);queueTradeJournal('BUY',d,p,t,{score,exploratory});scheduleCriticalSave();
    if(d.risk!=='R&D')log('buy',`${d.icon} ${d.name} bought ${t.symbol} · ${budget.toFixed(0)} paper · ${p.reason}`,'good',{strategy:d.id,mint:t.mint});
  }
}

async function refreshMinuteSamplerUniverse(force=false){
  const ts=now();
  if(!force&&lastMinuteUniverseAt&&ts-lastMinuteUniverseAt<30000)return{ok:true,cached:true};
  if(minuteUniverseInFlight)return minuteUniverseInFlight;
  minuteUniverseInFlight=(async()=>{
    const bands=[
      {id:'minute_sub100',min:0,max:100000,target:18},
      {id:'minute_100_250',min:100000,max:250000,target:18},
      {id:'minute_500_1m',min:500000,max:1000000,target:18}
    ];
    const found=new Map(bands.map(b=>[b.id,new Map()]));
    let pages=0,errors=0;
    for(let offset=0;offset<=900;offset+=60){
      pages++;
      try{
        const url='https://frontend-api-v3.pump.fun/coins?offset='+offset+'&limit=60&sort=market_cap&order=DESC&includeNsfw=false';
        const j=await fetchJson(url,6500),rows=Array.isArray(j)?j:(j?.data||j?.coins||[]);
        if(!rows.length)break;
        for(const raw of rows){
          const incoming=normalize(raw,'pump.fun-minute-universe');if(!incoming||!(incoming.price>0)||!(incoming.mc>0))continue;
          const band=bands.find(b=>incoming.mc>=b.min&&incoming.mc<b.max);if(!band)continue;
          const bucket=found.get(band.id);if(bucket.size<band.target)bucket.set(incoming.mint,raw);
          const old=tokens.get(incoming.mint),merged=mergeToken(old,incoming);tokens.set(incoming.mint,merged);updateCreator(merged);updateDnaArchive(merged);
        }
        if(bands.every(b=>found.get(b.id).size>=b.target))break;
      }catch{errors++;}
    }
    const mints=[...new Set([...found.values()].flatMap(m=>[...m.keys()]))],enriched=new Set();
    for(let i=0;i<mints.length;i+=30){
      const chunk=mints.slice(i,i+30);if(!chunk.length)continue;
      try{
        const pairs=await fetchJson('https://api.dexscreener.com/tokens/v1/solana/'+chunk.join(','),6500);
        const best=new Map();
        for(const p of (Array.isArray(pairs)?pairs:[])){const mint=p.baseToken?.address;if(!mint)continue;const cur=best.get(mint);if(!cur||(p.liquidity?.usd||0)>(cur.liquidity?.usd||0))best.set(mint,p);}
        for(const [mint,pair] of best){enriched.add(mint);ingest({...pair,mint},'dexscreener-minute-universe');}
      }catch{errors++;}
    }
    lastMinuteUniverseAt=now();
    const counts=Object.fromEntries(bands.map(b=>[b.id,minuteSamplerCandidates(strategyDefs.find(x=>x.id===b.id)).length]));
    setHealth('minute-sampler-universe',Object.values(counts).every(n=>n>0)?'ok':'warn','Dedicated market-cap discovery · '+Object.entries(counts).map(([k,v])=>k+': '+v).join(' · '),{truth:'observed'});
    console.log('MINUTE_SAMPLER_UNIVERSE '+JSON.stringify({ts:lastMinuteUniverseAt,pages,raw:Object.fromEntries(bands.map(b=>[b.id,found.get(b.id).size])),enriched:enriched.size,eligible:counts,errors}));
    return{ok:true,pages,enriched:enriched.size,counts,errors};
  })();
  try{return await minuteUniverseInFlight}finally{minuteUniverseInFlight=null}
}

function minuteSamplerRank(d,t){
  const f=features(t),q=tokenDataQuality(t),freshness=clamp(100-(now()-num(t.updatedAt))/1800);
  const novelty=trades.some(x=>x.strategy===d.id&&x.mint===t.mint&&now()-num(x.closedAt)<10*60000)?0:12;
  return specialistScore(d,f,t)*.45+q.score*.18+f.liqScore*.12+f.volScore*.08+f.flow*.07+freshness*.10+novelty;
}
function minuteSamplerCandidates(d){
  return [...tokens.values()].filter(t=>{
    const priceIntegrity=tokenPriceIntegrity(t),universe=memeUniverseEligibility(t),sources=t?.sources||[];
    // Minute samplers need an independently refreshable secondary quote path.
    // Pump-only tokens can disappear from the launch API and become impossible to
    // mark honestly at the scheduled exit, so require DexScreener confirmation.
    const hasDexExitPath=sources.some(x=>String(x).startsWith('dexscreener'));
    if(!(t?.price>0)||!(t?.mc>0)||!priceIntegrity.executable||!priceIntegrity.moving||priceIntegrity.unchangedPriceTicks>0||priceIntegrity.distinctAgeMs>PRICE_STAGNANT_MAX_MS||!universe.ok||!hasDexExitPath)return false;
    if(Number.isFinite(d.mcMin)&&t.mc<d.mcMin)return false;
    if(Number.isFinite(d.mcMax)&&t.mc>=d.mcMax)return false;
    if(!(t.liq>=num(d.minuteMinLiq)))return false;
    const f=features(t),adv=adversarialRisk(t,f,tokenDataQuality(t));
    if(adv.hardVeto)return false;
    const ex=executionQuote(t,num(d.fixedStakeUsd)||100,'buy');
    return Number.isFinite(ex.fillPrice)&&ex.fillPrice>0&&ex.slippage<=.07;
  }).sort((a,b)=>minuteSamplerRank(d,b)-minuteSamplerRank(d,a));
}
function openMinuteSamplerTrade(d,t,weather){
  const priceIntegrity=tokenPriceIntegrity(t),universe=memeUniverseEligibility(t);if(!priceIntegrity.executable||!priceIntegrity.moving||priceIntegrity.unchangedPriceTicks>0||!universe.ok)return false;
  markEquity(d);const f=features(t),quality=tokenDataQuality(t),score=specialistScore(d,f,t),budget=Math.min(num(d.fixedStakeUsd)||100,d.cash*.20);
  if(budget<10)return false;
  const baseExec={...executionQuote(t,budget,'buy'),notional:budget};
  if(!(baseExec.fillPrice>0)||baseExec.slippage>.07)return false;
  const alpha=alphaOS.evaluateCandidate({strategy:d,token:t,features:f,score,threshold:0,quality,similar:dnaSimilarity(t),regime:weather.regime});
  const entryExec=science.executionSimulation(t,budget,'buy',baseExec,alpha?.execution||{});
  if(!(entryExec.fillPrice>0)||entryExec.slippage>.07)return false;
  const entry=entryExec.fillPrice,cost=budget*(1+entryExec.feeRate)+num(entryExec.fixedCost)+num(entryExec.expectedFailureCost);
  if(cost>d.cash)return false;
  d.cash-=cost;
  const p={id:'p'+now()+Math.random(),strategy:d.id,mint:t.mint,symbol:t.symbol,entry,units:budget/entry,originalUnits:budget/entry,invested:budget,entryCost:cost,entryExecution:entryExec,executionQuality:profitAccelerator.executionQuality(entryExec,alpha?.execution||{}),realizedProceeds:0,partialExits:[],scaleOutHits:[],opened:now(),closed:false,lastPrice:t.price,lastMarkedAt:now(),markSource:'minute-sampler',score,entryFeatures:{...f,mc:t.mc,liq:t.liq},entryMc:t.mc,entryLiq:t.liq,entryQuality:quality.score,dnaHit25:0,dnaSample:0,allocationMult:1,sizingMode:'forced-minute-sampler',samplePartition:partitionForMint(t.mint),alphaOS:alpha,budgetPct:d.equity>0?budget/d.equity:0,live100Equivalent:budget*(100/START),exitMode:'minute',policyVersion:STRATEGY_ERA,guard:{requiredScore:0,minQuality:0,minBuyRatio:0,recentAvg:0,recentN:0,exploratory:true},reason:`forced minute sampler · MC $${Math.round(t.mc).toLocaleString()} · paper $${budget.toFixed(0)} · band ${Number.isFinite(d.mcMin)?'$'+Math.round(d.mcMin/1000)+'K+':'open'} to ${Number.isFinite(d.mcMax)?'<$'+Math.round(d.mcMax/1000)+'K':'open'}`,entryRegime:weather.regime,entryPhase:weather.phase,peakDuring:entry,troughDuring:entry,minuteSampler:true};
  positions.push(p);science.recordEntry(p,t,{features:f,quality,market:weather});alphaOS.recordShadowEntry({position:p,token:t,alpha});recordDecision(d,t,f,score,'BUY',p.reason,weather);queueTradeJournal('BUY',d,p,t,{score,minuteSampler:true});scheduleCriticalSave();
  log('buy',`${d.icon} ${d.name} sampled ${t.symbol} · ${budget.toFixed(0)} paper · MC ${Math.round(t.mc).toLocaleString()}`,'good',{strategy:d.id,mint:t.mint,minuteSampler:true});
  console.log('MINUTE_SAMPLER_ENTRY '+JSON.stringify({ts:now(),strategy:d.id,name:d.name,mint:t.mint,symbol:t.symbol,mc:t.mc,budget,entry,slippage:entryExec.slippage}));
  return true;
}
async function minuteSamplerTick(){
  if(shuttingDown||lifecyclePhase==='DRAINING'||!durableTradingReady())return;
  await refreshMinuteSamplerUniverse(false);
  const weather=marketWeather(),ts=now();
  for(const d of strategyDefs.filter(x=>x.minuteSampler)){
    markEquity(d);
    for(const p of [...positions].filter(x=>!x.closed&&x.strategy===d.id)){
      const t=tokens.get(p.mint);if(t&&ts-num(p.opened)>=45000)closePos(d,p,t,'minute sampler scheduled recycle');
    }
    const history=[...trades,...positions].filter(x=>x.strategy===d.id),lastOpened=Math.max(0,...history.map(x=>num(x.opened)));
    if(lastOpened&&ts-lastOpened<45000)continue;
    const candidates=minuteSamplerCandidates(d);
    const chosen=candidates.find(t=>!positions.some(p=>!p.closed&&p.strategy===d.id&&p.mint===t.mint))||candidates[0];
    if(!chosen){
      setHealth('minute-sampler-'+d.id,'warn',d.name+' could not find a currently observed safe token inside its exact market-cap band',{truth:'observed'});
      console.warn('MINUTE_SAMPLER_EMPTY '+JSON.stringify({ts:now(),strategy:d.id,name:d.name,mcMin:d.mcMin,mcMax:d.mcMax,tokens:tokens.size}));
      continue;
    }
    if(openMinuteSamplerTrade(d,chosen,weather))setHealth('minute-sampler-'+d.id,'ok',d.name+' · forced paper cadence active · latest entry '+new Date().toISOString(),{truth:'observed'});
  }
}

function effectiveMaxHoldMinutes(d){
  if(!d)return 60;if(d.minuteSampler)return Math.max(.25,num(d.maxHold)||.8);if(d.fastScalp)return Math.max(.25,num(d.maxHold)||3.5);
  let maxHold=num(d.maxHold)||60;const mode=exitModeFor(d);
  if(mode==='scalp')maxHold=Math.min(maxHold,28);
  if(mode==='defensive')maxHold=Math.min(maxHold,60);
  if(mode==='runner')maxHold=Math.max(maxHold,120);
  if(mode==='structure')maxHold=Math.max(maxHold,180);
  if(mode==='conviction')maxHold=Math.max(maxHold,720);
  return maxHold;
}
function voidUnobservableMinuteSample(d,p,reason){
  // A missing exit quote is a data failure, not a trading loss. Neutralize the
  // paper sample exactly and exclude it from win/loss/trade statistics.
  const realized=num(p.realizedProceeds),entryCost=num(p.entryCost)||num(p.invested);
  d.cash+=entryCost-realized;
  const pi=positions.indexOf(p);if(pi>=0)positions.splice(pi,1);
  markEquity(d);
  queueTradeJournal('VOID',d,p,tokens.get(p.mint),{positionId:p.id,reason,opened:p.opened,voidedAt:now(),minuteSampler:true});
  scheduleCriticalSave();
  log('integrity',`VOID sample · ${d.name} · ${p.symbol} · ${reason}`,'info',{strategy:d.id,mint:p.mint,positionId:p.id});
  console.warn('MINUTE_SAMPLE_VOID '+JSON.stringify({ts:now(),strategy:d.id,mint:p.mint,symbol:p.symbol,heldMin:(now()-num(p.opened))/60000,reason}));
  return true;
}
function stalePositionSweep(){
  let quarantined=0,overdue=0,voided=0;
  for(const p of [...positions]){
    if(p.closed)continue;
    const d=allTraders().find(x=>x.id===p.strategy);if(!d)continue;
    const detail=positionMarkDetail(p),t=tokens.get(p.mint),heldMs=Math.max(0,now()-num(p.opened)),maxHoldMs=effectiveMaxHoldMinutes(d)*60000,isOverdue=heldMs>=maxHoldMs;
    if(isOverdue)overdue++;
    if(isOverdue&&t&&tokenPriceIntegrity(t).executable){
      closePos(d,p,t,'hard max-hold verified exit');continue;
    }
    // Give the quote sources time to recover, then invalidate only R&D minute
    // samples that cannot be marked. Core strategy positions are never voided.
    if(d.minuteSampler&&isOverdue&&heldMs>=Math.max(10*60000,maxHoldMs+5*60000)&&(!t||!tokenPriceIntegrity(t).executable)){
      if(voidUnobservableMinuteSample(d,p,'no verified exit quote after 10 minute recovery window')){voided++;continue;}
    }
    if(detail.stale||isOverdue){
      quarantined++;p.exitPendingReason=isOverdue?'max hold exceeded; waiting for verified price':'stale quote; waiting for verified price';p.integrityQuarantinedAt=p.integrityQuarantinedAt||now();
      if(now()-num(p.lastIntegrityAlertAt)>60000){p.lastIntegrityAlertAt=now();console.warn('STALE_POSITION_QUARANTINE '+JSON.stringify({ts:now(),strategy:p.strategy,mint:p.mint,symbol:p.symbol,ageMs:detail.ageMs,heldMin:heldMs/60000,maxHoldMin:effectiveMaxHoldMinutes(d),lastVerifiedPrice:detail.rawPrice,quoteAgeMs:detail.quoteAgeMs,reason:p.exitPendingReason}));}
    }
  }
  if(quarantined)setHealth('position-integrity','warn',quarantined+' position(s) quarantined for stale/overdue verified-price exit · synthetic zero write-offs disabled · '+voided+' invalid sampler(s) voided',{truth:'observed'});
  else setHealth('position-integrity','ok','All open positions have timely verified-price handling · synthetic zero write-offs disabled · '+voided+' invalid sampler(s) voided',{truth:'observed'});
  return{quarantined,overdue,voided};
}
function updateOpenPositionExtremes(t){const f=features(t),integrity=tokenPriceIntegrity(t);if(!integrity.executable)return;for(const p of positions){if(p.closed||p.mint!==t.mint)continue;p.lastPrice=t.price;p.lastMarkedAt=num(t.quoteObservedAt||t.updatedAt)||now();p.markSource=(t.sources||[]).join('+')||'live';p.peakDuring=Math.max(p.peakDuring||p.entry,t.price);p.troughDuring=Math.min(p.troughDuring||p.entry,t.price);science.observePosition(p,t,f);}}

function closePos(d,p,t,why){
  const priceIntegrity=tokenPriceIntegrity(t);if(!priceIntegrity.executable){p.exitPendingReason='exit blocked: no fresh verified price';return false;}
  const notional=p.units*t.price,exitAlpha=alphaOS.executionBrain(t,{features:features(t),score:p.score||50}),exec=science.executionSimulation(t,notional,'sell',{...executionQuote(t,notional,'sell'),notional},exitAlpha),exit=exec.fillPrice,gross=p.units*exit;const proceeds=Math.max(0,gross*(1-exec.feeRate)-num(exec.fixedCost)-num(exec.expectedFailureCost));
  d.cash+=proceeds;p.closed=true;p.closedAt=now();p.exit=exit;p.exitExecution=exec;const totalProceeds=num(p.realizedProceeds)+proceeds,entryCost=num(p.entryCost)||p.invested*(1+FEE_RATE);p.pnl=totalProceeds-entryCost;p.pnlPct=p.pnl/Math.max(.000001,entryCost)*100;p.why=why;
  p.mfe=pct(p.peakDuring||exit,p.entry);p.mae=pct(p.troughDuring||exit,p.entry);p.counterfactual={exitNow:p.pnlPct,holdAfterExit:{oneMin:null,fiveMin:null,fifteenMin:null},bestObservedAfterExit:null};
  const modeledRoundTrip=(num(p.entryExecution?.slippage)+num(p.exitExecution?.slippage)+num(p.entryExecution?.feeRate)+num(p.exitExecution?.feeRate))*100;const stressPenalty=Math.max(2.5,modeledRoundTrip+Math.min(8,(p.invested/Math.max(1000,t.liq))*100));
  const integrityLowerBound=num(p.mae)-modeledRoundTrip-IMPOSSIBLE_LOSS_TOLERANCE_PCT,impossibleLoss=p.pnlPct<integrityLowerBound;
  p.integrity={quoteAgeMs:priceIntegrity.quoteAgeMs,distinctAgeMs:priceIntegrity.distinctAgeMs,lastRealPrice:num(t.price),priceSource:t.priceSource||t.sources?.[0]||'live',observedWorstPct:num(p.mae),modeledRoundTripPct:modeledRoundTrip,tolerancePct:IMPOSSIBLE_LOSS_TOLERANCE_PCT,lowerBoundPct:integrityLowerBound,impossibleLoss};
  if(impossibleLoss)console.error('IMPOSSIBLE_LOSS_FLAG '+JSON.stringify({strategy:d.id,mint:p.mint,symbol:p.symbol,pnlPct:p.pnlPct,mae:p.mae,modeledRoundTripPct:modeledRoundTrip,lowerBoundPct:integrityLowerBound,lastRealPrice:num(t.price),quoteAgeMs:priceIntegrity.quoteAgeMs,why}));
  p.executionStress={easy:p.pnlPct+1.5,realistic:p.pnlPct,nightmare:p.pnlPct-stressPenalty,penalty:stressPenalty};
  d.n++;if(p.pnl>0)d.wins++;else d.losses++;p.season2ScienceResult=science.recordTrade(p,t,{market:marketWeather()});trades.unshift({...p,name:t.name,narrative:t.narrative});trades.splice(MAX_TRADES);const pi=positions.indexOf(p);if(pi>=0)positions.splice(pi,1);markEquity(d);
  alphaOS.recordShadowClose(p);const aut=buildAutopsy(d,p,t);aut.accelerator=profitAccelerator.classifyTrade(p);autopsies.unshift(aut);autopsies.splice(250);queueTradeJournal('SELL',d,p,t,{why,pnlPct:p.pnlPct});scheduleCriticalSave();
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

function recordDiscoverySignal(t,source,observedAt=now()){
  if(!t?.mint)return null;const created=num(t.createdAt),latencyMs=created>0?Math.max(0,observedAt-created):null,existing=discoveryFirstByMint.get(t.mint);
  if(existing){if(!(existing.price>0)&&num(t.price)>0)existing.price=num(t.price);if(created>0&&!(existing.createdAt>0)){existing.createdAt=created;existing.latencyMs=Math.max(0,existing.ts-created)}return existing;}
  const row={mint:t.mint,symbol:t.symbol||'',source,ts:observedAt,createdAt:created||0,latencyMs,price:num(t.price),mc:num(t.mc),liq:num(t.liq)};
  discoveryFirstByMint.set(t.mint,row);discoveryLedger.push(row);while(discoveryLedger.length>3000){const x=discoveryLedger.shift();if(discoveryFirstByMint.get(x?.mint)===x)discoveryFirstByMint.delete(x.mint)}return row;
}
function edgeMcBand(mc){mc=num(mc);if(mc<25000)return'u25';if(mc<50000)return'25_50';if(mc<100000)return'50_100';if(mc<250000)return'100_250';if(mc<500000)return'250_500';if(mc<1000000)return'500_1m';return'1m_plus';}
function discoveryLab(){
  const rows=discoveryLedger.filter(x=>Number.isFinite(x.latencyMs)&&x.latencyMs>=0),sources=[...new Set(rows.map(x=>x.source))].map(source=>{const a=rows.filter(x=>x.source===source),xs=a.map(x=>x.latencyMs);return{source,n:a.length,p50Ms:percentile(xs,.5),p95Ms:percentile(xs,.95),under4s:a.length?a.filter(x=>x.latencyMs<=4000).length/a.length*100:0,under10s:a.length?a.filter(x=>x.latencyMs<=10000).length/a.length*100:0};}).sort((a,b)=>(a.p50Ms??1e15)-(b.p50Ms??1e15));
  const joined=rows.map(x=>{const d=dnaArchive.get(x.mint);return{...x,peakReturn:d?.peakReturn??null,worstReturn:d?.worstReturn??null}}).filter(x=>Number.isFinite(x.peakReturn));
  const lateMonsters=joined.filter(x=>x.peakReturn>=75&&x.latencyMs>4000);
  return{n:rows.length,p50Ms:percentile(rows.map(x=>x.latencyMs),.5),p95Ms:percentile(rows.map(x=>x.latencyMs),.95),under4s:rows.length?rows.filter(x=>x.latencyMs<=4000).length/rows.length*100:0,sources,lateMonsterProxy:{n:lateMonsters.length,avgLatencyMs:avg(lateMonsters.map(x=>x.latencyMs)),examples:lateMonsters.sort((a,b)=>b.peakReturn-a.peakReturn).slice(0,10)}};
}
function monsterPatternLab(){
  const perMint=new Map();for(const o of opportunities.values()){if(o.era!==STRATEGY_ERA||now()-num(o.firstTs)<5*60000||!Number.isFinite(o.bestReturn))continue;const old=perMint.get(o.mint);if(!old||num(o.firstTs)<num(old.firstTs))perMint.set(o.mint,o)}
  const rows=[...perMint.values()],monsters=rows.filter(x=>x.bestReturn>=75),controls=rows.filter(x=>x.bestReturn<25),keys=['momentum','acceleration','flow','buyRatio','volScore','liqScore','risk','sourceQuality','age','memeQuality','flowPersistence','manipulationSuspicion'];
  const matched=[];for(const m of monsters){const pool=controls.filter(x=>x.regime===m.regime&&edgeMcBand(x.mc)===edgeMcBand(m.mc)).sort((a,b)=>Math.abs(num(a.mc)-num(m.mc))-Math.abs(num(b.mc)-num(m.mc))).slice(0,5);matched.push(...pool)}
  const ctl=matched.length?matched:controls;
  const features=keys.map(key=>{const a=monsters.map(x=>num(x.features?.[key])),b=ctl.map(x=>num(x.features?.[key])),sd=Math.max(1,stdev([...a,...b])),monsterMean=avg(a),controlMean=avg(b),effect=(monsterMean-controlMean)/sd;return{key,monsterMean,controlMean,effectSize:effect,direction:effect>=0?'higher in monsters':'lower in monsters',strength:Math.abs(effect)}}).sort((a,b)=>b.strength-a.strength);
  const horizons=[5,15,30,60,180,300],timeline=horizons.map(sec=>{const get=(mints)=>{const vals=[];for(const mint of mints){const es=marketEvents.filter(e=>e.mint===mint&&Number.isFinite(e.features?.age));const target=sec/60,best=es.sort((a,b)=>Math.abs(num(a.features?.age)-target)-Math.abs(num(b.features?.age)-target))[0];if(best&&Math.abs(num(best.features?.age)-target)<=Math.max(.2,target*.55))vals.push(best)}return vals};const ma=get(monsters.map(x=>x.mint)),ca=get(ctl.map(x=>x.mint)),top=keys.map(key=>({key,monster:avg(ma.map(x=>num(x.features?.[key]))),control:avg(ca.map(x=>num(x.features?.[key])))})).map(x=>({...x,delta:x.monster-x.control})).sort((a,b)=>Math.abs(b.delta)-Math.abs(a.delta)).slice(0,4);return{sec,monsterN:ma.length,controlN:ca.length,topDeltas:top};});
  return{monsters:monsters.length,controls:ctl.length,matched:matched.length>0,features:features.slice(0,12),timeline,examples:monsters.sort((a,b)=>b.bestReturn-a.bestReturn).slice(0,12).map(x=>({symbol:x.symbol,mint:x.mint,bestReturn:x.bestReturn,worstReturn:x.worstReturn,why:x.why,regime:x.regime,mc:x.mc}))};
}
function edgeResearchFocus(){
  if(edgeFocusCache.data&&now()-edgeFocusCache.ts<30000)return edgeFocusCache.data;
  const stats=strategyStatistics(),ranked=stats.map(x=>{const d=strategyDefs.find(q=>q.id===x.id),distinct=diversityWeight(x.id),evidence=x.holdoutN>=5?x.holdoutMean:0,score=evidence*.45+x.shrunkMean*.30+distinct*10-Math.max(0,x.dd-12)*.35;return{id:x.id,name:x.name,n:x.n,holdoutN:x.holdoutN,holdoutMean:x.holdoutMean,score,distinct,thesis:d?.thesis||''}}).filter(x=>!['champion','professional','adaptive'].includes(x.id)).sort((a,b)=>b.score-a.score);
  const anchors=['momentum','smart','wallet_consensus','confirmed_runner','sniper'];const chosen=[];for(const id of anchors){const x=ranked.find(r=>r.id===id);if(x)chosen.push(x)}for(const x of ranked)if(chosen.length<10&&!chosen.some(y=>y.id===x.id))chosen.push(x);
  const data={mode:'focused evidence slate; all other bots remain paper/shadow research',count:chosen.length,strategies:chosen.slice(0,10)};edgeFocusCache={ts:now(),data};return data;
}
function ingest(raw,source){
  const incoming=normalize(raw,source);if(!incoming||!(incoming.price>0))return;lastIngestAt=now();
  const old=tokens.get(incoming.mint);if(!old)recordDiscoverySignal(incoming,source,now());const t=mergeToken(old,incoming);tokens.set(t.mint,t);updateCreator(t);updateOpportunities(t);updateOpenPositionExtremes(t);updateCounterfactuals(t);updateDnaArchive(t);const weather=marketWeather();recordMarketEvent(t,source,weather);(()=>{const sf=features(t),sq=tokenDataQuality(t),ao=alphaOS.observeToken(t,{features:sf,quality:sq}),wl=alphaOS.walletLeadLag(t);science.observeToken(t,{features:sf,quality:sq,market:weather,alpha:ao,earlyWallets:(wl.leaders||[]).map(x=>x.wallet)});})();
  if(!old)log('token',`🪙 LIVE token spotted: ${t.symbol} · ${t.name}`,'info',{mint:t.mint,source});
  maybeTrade(t,weather);broadcast('tick',{mint:t.mint});
}

function providerNameFor(url){try{const h=new URL(url).hostname;if(h.includes('pump.fun'))return'pump.fun';if(h.includes('dexscreener'))return'dexscreener';if(h.includes('solana'))return'solana-rpc';return h;}catch{return'http';}}
function circuitState(name){let s=providerCircuits.get(name);if(!s){s={failures:0,successes:0,openUntil:0,opens:0,lastError:null,lastLatencyMs:0,lastOkAt:0};providerCircuits.set(name,s);}return s;}
async function fetchWithCircuit(url,options={},name=providerNameFor(url),timeoutMs=8000){
  const state=circuitState(name),ts=now();if(state.openUntil>ts)throw Error(name+' circuit open for '+Math.ceil((state.openUntil-ts)/1000)+'s');
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),timeoutMs),started=Date.now();
  try{
    const r=await fetch(url,{...options,signal:controller.signal});
    if(!r.ok)throw Error('HTTP '+r.status);
    state.failures=0;state.successes++;state.lastLatencyMs=Date.now()-started;state.lastOkAt=now();state.lastError=null;
    return r;
  }catch(e){
    state.failures++;state.lastError=String(e?.message||e);state.lastLatencyMs=Date.now()-started;
    if(state.failures>=3){state.opens++;state.openUntil=now()+Math.min(120000,15000*Math.pow(2,Math.min(3,state.opens-1)));setHealth('circuit-'+name,'warn',name+' circuit opened · '+state.lastError,{truth:'observed'});}
    throw e;
  }finally{clearTimeout(timer)}
}
async function fetchJson(url,timeoutMs=8000){const r=await fetchWithCircuit(url,{headers:{accept:'application/json','user-agent':'PUMP-LAB-LIVE/1.0'}},providerNameFor(url),timeoutMs);return r.json();}
function xNormalizeResponse(j){
  const users=new Map((j.includes?.users||[]).map(u=>[u.id,u])),media=new Map((j.includes?.media||[]).map(m=>[m.media_key,m]));
  return(j.data||[]).map(t=>{const u=users.get(t.author_id)||{},ms=(t.attachments?.media_keys||[]).map(k=>media.get(k)).filter(Boolean).map(m=>({type:m.type,url:m.url||m.preview_image_url||null,width:m.width||null,height:m.height||null}));
    return{id:t.id,text:t.text||'',createdAt:t.created_at||null,conversationId:t.conversation_id||null,metrics:t.public_metrics||{},author:{id:u.id||t.author_id,name:u.name||'',username:u.username||'',verified:!!u.verified,profileImage:u.profile_image_url||''},media:ms,url:u.username?'https://x.com/'+u.username+'/status/'+t.id:'https://x.com/i/web/status/'+t.id};});
}
function xPublicNormalizeTweet(t,fallbackHandle=''){
  if(!t)return null;const u=t.user||{},id=String(t.id_str||t.id||'').trim(),username=u.screen_name||fallbackHandle;if(!id)return null;
  const media=(t.mediaDetails||t.photos||[]).map(m=>({type:m.type||'photo',url:m.media_url_https||m.url||m.preview_image_url||null,width:m.original_info?.width||m.width||null,height:m.original_info?.height||m.height||null})).filter(m=>m.url);
  return{id,text:t.full_text||t.text||'',createdAt:t.created_at||null,conversationId:t.conversation_id_str||null,metrics:{like_count:Number(t.favorite_count||0),retweet_count:Number(t.retweet_count||0),reply_count:Number(t.reply_count||0),quote_count:Number(t.quote_count||0)},author:{id:String(u.id_str||u.id||''),name:u.name||username,username,verified:!!(u.verified||u.is_blue_verified),profileImage:u.profile_image_url_https||u.profile_image_url||''},media,url:t.permalink?('https://x.com'+t.permalink.replace(/^https?:\/\/[^/]+/,'')):'https://x.com/'+username+'/status/'+id};
}
async function fetchPublicTimeline(handle){
  const r=await fetchWithCircuit('https://syndication.twitter.com/srv/timeline-profile/screen-name/'+encodeURIComponent(handle),{headers:{'user-agent':'Mozilla/5.0 (compatible; PumpLab/1.0)','accept':'text/html,application/xhtml+xml'}},'x-syndication',9000);
  const html=await r.text(),marker='<script id="__NEXT_DATA__" type="application/json">',start=html.indexOf(marker);if(start<0)throw Error('X public timeline payload missing');const end=html.indexOf('</script>',start);if(end<0)throw Error('X public timeline payload incomplete');
  const data=JSON.parse(html.slice(start+marker.length,end)),entries=data?.props?.pageProps?.timeline?.entries||[];return entries.map(e=>xPublicNormalizeTweet(e?.content?.tweet,handle)).filter(Boolean).slice(0,8);
}
function xFxNormalizeStatus(t,fallbackHandle=''){
  if(!t||t.type!=='status')return null;const a=t.author||{},username=a.screen_name||fallbackHandle,id=String(t.id||'').trim();if(!id)return null;
  const photos=(t.media?.photos||[]).map(m=>({type:m.type||'photo',url:m.url||null,width:m.width||null,height:m.height||null})),videos=(t.media?.videos||[]).map(m=>({type:m.type||'video',url:m.thumbnail_url||null,width:m.width||null,height:m.height||null}));
  return{id,text:t.text||'',createdAt:t.created_at||null,conversationId:null,metrics:{like_count:Number(t.likes||0),retweet_count:Number(t.reposts||0),reply_count:Number(t.replies||0),quote_count:Number(t.quotes||0)},author:{id:String(a.id||''),name:a.name||username,username,verified:!!a.verification?.verified,profileImage:a.avatar_url||''},media:[...photos,...videos].filter(m=>m.url),url:t.url||('https://x.com/'+username+'/status/'+id)};
}
async function fetchFxTimeline(handle){
  const r=await fetchWithCircuit('https://api.fxtwitter.com/2/profile/'+encodeURIComponent(handle)+'/statuses?count=8',{headers:{accept:'application/json','user-agent':'PumpLab/1.0'}},'fxtwitter',9000),j=await r.json().catch(()=>({}));
  if(Number(j.code||200)>=400)throw Error('FxTwitter timeline '+(j.code||'error')+' '+(j.message||''));return(j.results||[]).map(t=>xFxNormalizeStatus(t,handle)).filter(Boolean).slice(0,8);
}
function xHandleChunks(handles){const chunks=[];let cur=[],len=0;for(const h of handles){const piece='from:'+h;if(cur.length&&len+piece.length+4>430){chunks.push(cur);cur=[];len=0;}cur.push(h);len+=piece.length+4;}if(cur.length)chunks.push(cur);return chunks;}
async function fetchXChunk(handles,sinceId){
  const q='('+handles.map(h=>'from:'+h).join(' OR ')+') -is:retweet',u=new URL('https://api.x.com/2/tweets/search/recent');u.searchParams.set('query',q);u.searchParams.set('max_results','50');u.searchParams.set('tweet.fields','created_at,public_metrics,attachments,entities,conversation_id,referenced_tweets');u.searchParams.set('expansions','author_id,attachments.media_keys');u.searchParams.set('user.fields','name,username,profile_image_url,verified');u.searchParams.set('media.fields','type,url,preview_image_url,width,height');if(sinceId)u.searchParams.set('since_id',sinceId);
  const r=await fetchWithCircuit(u,{headers:{authorization:'Bearer '+X_BEARER_TOKEN,accept:'application/json'}},'x-api',9000),j=await r.json().catch(()=>({}));return{posts:xNormalizeResponse(j),newestId:j.meta?.newest_id||null};
}
async function refreshXFeed(force=false){
  if(!X_FEED_HANDLES.length)return{ok:true,configured:false,source:'none',handles:[],posts:[],fetchedAt:xFeedLastFetch||null};
  const ts=now();if(!force&&xFeedCache.length&&ts-xFeedLastFetch<X_REFRESH_MS)return{ok:true,configured:true,source:'cache',handles:X_FEED_HANDLES,posts:xFeedCache,fetchedAt:xFeedLastFetch,cached:true};if(xFeedInFlight)return xFeedInFlight;
  xFeedInFlight=(async()=>{const fresh=[],errors=[],sources=new Set();
    if(X_BEARER_TOKEN){try{let newest=xFeedSinceId;for(const chunk of xHandleChunks(X_FEED_HANDLES)){const out=await fetchXChunk(chunk,xFeedSinceId);fresh.push(...out.posts);if(out.newestId&&(!newest||BigInt(out.newestId)>BigInt(newest)))newest=out.newestId;}if(newest)xFeedSinceId=newest;sources.add('x-api');}catch(e){errors.push('x-api: '+String(e?.message||e));}}
    if(!fresh.length)for(const h of X_FEED_HANDLES){const blocked=xPublicFailures.get(h)||0;if(blocked>now())continue;try{let rows=[];try{rows=await fetchPublicTimeline(h);if(rows.length)sources.add('x-public-syndication');}catch{}if(!rows.length){rows=await fetchFxTimeline(h);if(rows.length)sources.add('fxtwitter-public-api');}fresh.push(...rows);xPublicFailures.delete(h);}catch(e){errors.push('@'+h+': '+String(e?.message||e));xPublicFailures.set(h,now()+180000);}}
    const merged=new Map(xFeedCache.map(p=>[p.id,p]));for(const p of fresh)merged.set(p.id,p);xFeedCache=[...merged.values()].sort((a,b)=>new Date(b.createdAt||0)-new Date(a.createdAt||0)).slice(0,X_MAX_CACHE);if(fresh.length)xFeedLastFetch=now();
    return{ok:xFeedCache.length>0,configured:true,source:sources.has('x-api')?'x-api':sources.has('fxtwitter-public-api')?'fxtwitter-public-api':'x-public-syndication',sources:[...sources],handles:X_FEED_HANDLES,posts:xFeedCache,fetchedAt:xFeedLastFetch||null,newCount:fresh.length,errors};
  })();try{return await xFeedInFlight}finally{xFeedInFlight=null}
}
async function pumpPoll(){
  lastPumpPollAt=now();try{const u='https://frontend-api-v3.pump.fun/coins?offset=0&limit=60&sort=created_timestamp&order=DESC&includeNsfw=false';const j=await fetchJson(u);const rows=Array.isArray(j)?j:(j.data||j.coins||[]);if(!rows.length)throw Error('no rows');rows.forEach(x=>ingest(x,'pump.fun'));setHealth('pump.fun','ok',`Live launch/state snapshots · ${rows.length} coins`,{truth:'observed'});}catch(e){setHealth('pump.fun','warn',`Snapshot feed unavailable: ${e.message}`);}
}
async function pumpOpenPositionPoll(){
  lastPumpOpenPositionPollAt=now();
  const open=positions.filter(p=>!p.closed&&p.mint);
  if(!open.length){setHealth('pump-open-marks','ok','No open Pump.fun positions require fast marks',{truth:'observed'});return;}
  const byMint=new Map();
  for(const p of open){
    const d=allTraders().find(x=>x.id===p.strategy),old=byMint.get(p.mint)||{mint:p.mint,fast:false,lastMarkedAt:Infinity};
    old.fast=old.fast||!!d?.fastScalp;old.lastMarkedAt=Math.min(old.lastMarkedAt,num(p.lastMarkedAt)||0);byMint.set(p.mint,old);
  }
  const ranked=[...byMint.values()].sort((a,b)=>{const pa=positions.find(p=>!p.closed&&p.mint===a.mint),pb=positions.find(p=>!p.closed&&p.mint===b.mint),da=allTraders().find(x=>x.id===pa?.strategy),db=allTraders().find(x=>x.id===pb?.strategy),oa=pa?Math.max(0,now()-num(pa.opened)-effectiveMaxHoldMinutes(da)*60000):0,ob=pb?Math.max(0,now()-num(pb.opened)-effectiveMaxHoldMinutes(db)*60000):0,sa=pa?positionMarkDetail(pa).stale:false,sb=pb?positionMarkDetail(pb).stale:false;return (Number(ob>0)-Number(oa>0))||(Number(sb)-Number(sa))||(Number(b.fast)-Number(a.fast))||(a.lastMarkedAt-b.lastMarkedAt);});
  const cap=Math.min(20,ranked.length),chosen=[];
  for(let i=0;i<cap;i++)chosen.push(ranked[(fastOpenCursor+i)%ranked.length]);
  fastOpenCursor=ranked.length?(fastOpenCursor+cap)%ranked.length:0;
  let updated=0,failed=0;
  await Promise.all(chosen.map(async row=>{
    try{
      const url='https://frontend-api-v3.pump.fun/coins/'+encodeURIComponent(row.mint);
      const r=await fetchWithCircuit(url,{headers:{accept:'application/json','user-agent':'PUMP-LAB-LIVE/1.0'}},'pump-open',4500);
      const raw=await r.json(),incoming=normalize({...raw,mint:row.mint},'pump.fun-open');
      if(!incoming||!(incoming.price>0))throw Error('no live price');
      const old=tokens.get(row.mint),t=mergeToken(old,incoming);tokens.set(row.mint,t);
      updateOpportunities(t);updateOpenPositionExtremes(t);updateCounterfactuals(t);updateDnaArchive(t);
      const weather=marketWeather();recordMarketEvent(t,'pump.fun-open',weather);
      const touched=new Set();
      for(const pos of positions.filter(x=>!x.closed&&x.mint===row.mint)){
        if(touched.has(pos.strategy))continue;touched.add(pos.strategy);
        const d=allTraders().find(x=>x.id===pos.strategy);if(!d)continue;
        const ex=exitDecision(d,pos,t,features(t));if(ex.exit)closePos(d,pos,t,ex.why);else markEquity(d);
      }
      updated++;
    }catch{failed++;}
  }));
  setHealth('pump-open-marks',failed&&updated===0?'warn':'ok',`Fast Pump.fun open marks · ${updated}/${chosen.length} refreshed${failed?' · '+failed+' failed':''}`,{truth:'observed'});
}

async function openPositionPoll(){
  lastOpenPositionPollAt=now();try{
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
        updateOpportunities(t);updateOpenPositionExtremes(t);updateCounterfactuals(t);updateDnaArchive(t);const weather=marketWeather();recordMarketEvent(t,'dexscreener-open',weather);(()=>{const sf=features(t),sq=tokenDataQuality(t),ao=alphaOS.observeToken(t,{features:sf,quality:sq}),wl=alphaOS.walletLeadLag(t);science.observeToken(t,{features:sf,quality:sq,market:weather,alpha:ao,earlyWallets:(wl.leaders||[]).map(x=>x.wallet)});})();
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
  lastDexPollAt=now();try{
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


function queueSolanaSignature(sig,kind='unknown'){
  if(!sig||solanaSeen.has(sig))return;
  solanaSeen.add(sig); if(solanaSeen.size>5000){const first=solanaSeen.values().next().value;solanaSeen.delete(first);}
  if(kind==='create'){solanaPriorityQueue.push(sig);if(solanaPriorityQueue.length>120){solanaPriorityQueue.shift();backpressureDrops.prioritySolana++;}solanaCreateSignals++;}else{solanaQueue.push(sig);if(solanaQueue.length>300){solanaQueue.shift();backpressureDrops.solana++;}}solanaObserved++;
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
        solanaSubAcks++;solanaSubscriptionKinds.set(m.result,m.id===901?'pump':'wallet');
        const watched=WATCHED_WALLET_LOOKUP.size;
        if(m.id>=1000)setHealth('fomo-watchlist','ok',`${Math.min(watched,Math.max(0,solanaSubAcks-1))}/${watched} watched-wallet streams acknowledged`,{truth:'observed'});
        if(solanaSubAcks>=1+watched)setHealth('solana-stream','ok',`Pump.fun + ${watched} Fomo wallet subscriptions acknowledged`,{truth:'observed'});
        return;
      }
      const sig=m?.params?.result?.value?.signature,logs=m?.params?.result?.value?.logs||[],subKind=solanaSubscriptionKinds.get(m?.params?.subscription)||'unknown',isCreate=logs.some(x=>/Instruction:\s*Create/i.test(String(x)));if(sig)queueSolanaSignature(sig,isCreate?'create':subKind);
    }catch{}});
    solanaWs.addEventListener('close',()=>{setHealth('solana-stream','warn','Solana websocket disconnected · reconnecting',{truth:'observed'});setTimeout(connectSolanaStream,5000);});
    solanaWs.addEventListener('error',()=>setHealth('solana-stream','warn','Solana websocket error',{truth:'observed'}));
  }catch(e){setHealth('solana-stream','warn','Solana stream setup failed: '+e.message,{truth:'observed'});}
}
async function rpcTransaction(sig){
  const r=await fetchWithCircuit(SOLANA_RPC_HTTP,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({jsonrpc:'2.0',id:1,method:'getTransaction',params:[sig,{commitment:'confirmed',encoding:'jsonParsed',maxSupportedTransactionVersion:0}]})},'solana-rpc',7000);
  const j=await r.json(); return j.result||null;
}
function uiAmt(x){return num(x?.uiTokenAmount?.uiAmountString??x?.uiTokenAmount?.uiAmount??0);}
function keyText(k){return typeof k==='string'?k:(k?.pubkey||'');}
function solDeltaFor(tx,wallet){
  const keys=tx?.transaction?.message?.accountKeys||[];const i=keys.findIndex(k=>keyText(k)===wallet);
  if(i<0)return 0;const pre=tx?.meta?.preBalances?.[i],post=tx?.meta?.postBalances?.[i];
  return Number.isFinite(pre)&&Number.isFinite(post)?(post-pre)/1e9:0;
}
function captureFundingEdges(tx,sig){
  const keys=tx?.transaction?.message?.accountKeys||[],pre=tx?.meta?.preBalances||[],post=tx?.meta?.postBalances||[];
  const rows=keys.map((k,i)=>({wallet:keyText(k),delta:(Number(post[i]||0)-Number(pre[i]||0))/1e9})).filter(x=>x.wallet);
  const donors=rows.filter(x=>x.delta<-.005).sort((a,b)=>a.delta-b.delta);
  if(!donors.length)return;
  for(const r of rows){
    if(r.delta<=.005||!WATCHED_WALLET_LOOKUP.has(r.wallet))continue;
    const donor=donors.find(x=>x.wallet!==r.wallet);if(!donor)continue;
    alphaOS.observeFundingTransfer({from:donor.wallet,to:r.wallet,sol:r.delta,ts:tx?.blockTime?tx.blockTime*1000:now(),signature:sig});
  }
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
  captureFundingEdges(tx,sig);
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
    walletEvents.unshift(event);walletEvents.splice(1200);alphaOS.observeWalletEvent(event,tok); found++;
    if(watch)log('smart-wallet',`👀 ${watch.traderName} · ${action} · ${event.symbol}`,'info',{traderId:watch.traderId,wallet:x.owner,mint:x.mint,signature:sig,confidence:watch.confidence});
    if(tok){
      tok.chainBuys=num(tok.chainBuys)+(action==='BUY'?1:0);tok.chainSells=num(tok.chainSells)+(action==='SELL'?1:0);tok.chainTx=num(tok.chainTx)+1;tok.lastChainAt=now();
      tok.chainFlow=(tok.chainFlow||[]).filter(e=>now()-e.ts<120000);
      if(action==='BUY'||action==='SELL')tok.chainFlow.push({ts:now(),slot:tx?.slot||null,signature:sig,wallet:x.owner,action,tokenDelta:delta,notionalUsd:Math.abs(delta)*num(tok.price),watchlist:!!watch,traderId:watch?.traderId||null});
      if(watch?.confidence==='verified'&&(action==='BUY'||action==='SELL'))maybeTrade(tok);
    }
  }
  if(found)solanaResolved++;
}
async function discoverPumpCreate(sig,tx){
  const keys=new Set((tx?.transaction?.message?.accountKeys||[]).map(keyText).filter(Boolean));if(!keys.has(PUMP_PROGRAM))return;
  const pre=new Set((tx?.meta?.preTokenBalances||[]).map(x=>x.mint).filter(Boolean)),post=[...new Set((tx?.meta?.postTokenBalances||[]).map(x=>x.mint).filter(Boolean))],candidates=post.filter(m=>m!=='So11111111111111111111111111111111111111112'&&(!pre.has(m)||String(m).toLowerCase().endsWith('pump'))).slice(0,3),signalAt=now(),createdAt=tx?.blockTime?tx.blockTime*1000:signalAt;
  for(const mint of candidates){if(discoveryFirstByMint.has(mint))continue;recordDiscoverySignal({mint,createdAt},'solana-create',signalAt);await hydrateWalletMint(mint);}
}
async function drainSolanaQueue(){
  lastSolanaDrainAt=now();const priority=solanaPriorityQueue.length>0,sig=priority?solanaPriorityQueue.shift():solanaQueue.shift(); if(!sig)return;
  try{const tx=await rpcTransaction(sig);if(tx){if(priority)await discoverPumpCreate(sig,tx);await parseWalletTx(sig,tx)}setHealth('wallet-intel','ok',`Observed on-chain activity · ${solanaResolved} resolved · ${solanaCreateSignals} create signals`,{truth:'observed'});}
  catch(e){if(/429/.test(e.message)){(priority?solanaPriorityQueue:solanaQueue).unshift(sig);setHealth('wallet-intel','warn','Public RPC rate limited · signature requeued',{truth:'observed'});}else setHealth('wallet-intel','warn','Wallet resolver: '+e.message,{truth:'observed'});}
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


function productionTrades(eraOnly=false){return trades.filter(t=>{const d=strategyDefs.find(x=>x.id===t.strategy);return !t.strategy.includes('-c')&&isFrozenExperimentStrategy(d)&&d.risk!=='CONTROL'&&!d.minuteSampler&&(!eraOnly||t.policyVersion===STRATEGY_ERA);});}
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
  const ts=now(),priceIntegrity=tokenPriceIntegrity(t),ageSec=Math.max(0,priceIntegrity.quoteAgeMs/1000),f=features(t);
  const freshSources=Object.entries(t.sourceSeen||{}).filter(([,v])=>ts-num(v)<180000).map(([k])=>k);
  if((t.chainFlow||[]).some(e=>ts-e.ts<90000)&&!freshSources.includes('solana-rpc'))freshSources.push('solana-rpc');
  const freshness=clamp(100-ageSec*2),cross=freshSources.length>=2?100:freshSources.length?45:0;
  const liq=f.liqFresh?100:0,flow=f.flowFresh?100:0,volume=f.volumeFresh?100:0,depth=clamp(Math.log10(1+f.totalTx)*45);
  const score=clamp(freshness*.20+cross*.20+liq*.20+flow*.18+volume*.12+depth*.10);
  return{score,freshness,sourceCount:freshSources.length,sources:freshSources,ageSec,market:clamp(f.liqScore*.65+Math.min(35,f.totalTx*1.5)),priceIntegrity,
    observed:{price:priceIntegrity.freshQuote,liquidity:f.liqFresh,flow:f.flowFresh,volume:f.volumeFresh},level:!priceIntegrity.freshQuote?'STALE':freshSources.length>=2?'CROSS-CHECKED':score>=60?'OBSERVED':'PARTIAL'};
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
function dnaSimilarity(t,limit=12,qOverride=null){
  const cacheKey=t.mint+':'+limit,cache=dnaSimilarityCache.get(cacheKey);
  if(cache&&cache.archiveSize===dnaArchive.size&&now()-cache.ts<60000)return cache.value;
  const q=qOverride||tokenDNA(t),rows=[];
  for(const x of dnaArchive.values()){
    if(x.mint===t.mint||x.observations<2||now()-x.firstTs<5*60000)continue;
    const distance=dnaDistance(q,x.dna),row={mint:x.mint,symbol:x.symbol,narrative:x.narrative,peakReturn:x.peakReturn,worstReturn:x.worstReturn,distance,similarity:clamp((1-distance)*100)};
    if(rows.length<limit){rows.push(row);rows.sort((a,b)=>a.distance-b.distance);}
    else if(distance<rows[rows.length-1].distance){rows[rows.length-1]=row;rows.sort((a,b)=>a.distance-b.distance);}
  }
  const value={n:rows.length,avgSimilarity:avg(rows.map(x=>x.similarity)),hit25:rows.length?rows.filter(x=>x.peakReturn>=25).length/rows.length*100:0,
    hit100:rows.length?rows.filter(x=>x.peakReturn>=100).length/rows.length*100:0,avgPeak:avg(rows.map(x=>x.peakReturn)),avgWorst:avg(rows.map(x=>x.worstReturn)),
    matches:rows.slice(0,6).map(({mint,symbol,similarity,peakReturn,worstReturn,narrative})=>({mint,symbol,similarity,peakReturn,worstReturn,narrative}))};
  dnaSimilarityCache.set(cacheKey,{ts:now(),archiveSize:dnaArchive.size,value});
  if(dnaSimilarityCache.size>500)for(const [k,v] of dnaSimilarityCache)if(now()-v.ts>120000)dnaSimilarityCache.delete(k);
  return value;
}
function adversarialRisk(t,f=null,q=null){
  f=f||features(t);q=q||tokenDataQuality(t);const dna=creatorDNA(t),flags=[];let score=f.risk;
  if(q.score<35){score+=12;flags.push('weak data quality');}
  if((t.sources||[]).length<2){score+=5;flags.push('single source');}
  if(dna.launches>=5&&dna.collapses>=2){score+=18;flags.push('repeat creator with multiple observed collapses');}
  if((t.buys+t.sells)>=8&&f.buyRatio<.34){score+=15;flags.push('sell pressure dominates');}
  if(t.liq>0&&t.mc/t.liq>35){score+=12;flags.push('market cap / liquidity imbalance');}
  score=clamp(score);return{score,flags,hardVeto:score>=82,reason:flags.join(' · ')||'no independent hard veto'};
}
function recordMarketEvent(t,source,weather=null){
  const ts=now(),last=marketEventClock.get(t.mint)||0;if(ts-last<7000)return;marketEventClock.set(t.mint,ts);
  weather=weather||marketWeather();const f=features(t),dna=tokenDNA(t),quality=tokenDataQuality(t),regime=weather.regime;
  const scores={};for(const d of strategyDefs.filter(x=>x.risk!=='CONTROL'))scores[d.id]=strategyScore(d,f,t);
  const row={ts,era:STRATEGY_ERA,mint:t.mint,symbol:t.symbol,source,price:t.price,mc:t.mc,liq:t.liq,vol:t.vol,buys:t.buys,sells:t.sells,narrative:t.narrative,regime,features:{...f},dna,quality:quality.score,scores};
  marketEvents.push(row);while(marketEvents.length>MAX_MARKET_EVENTS)marketEvents.shift();
  // Keep a small catch-up buffer when Postgres is offline, but do not let an
  // unavailable database consume the process and trigger permanent backpressure.
  pendingDbEvents.push(row);
  const eventCap=db?1500:250;
  while(pendingDbEvents.length>eventCap){pendingDbEvents.shift();backpressureDrops.dbEvents++;}
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
  return strategyDefs.filter(d=>isFrozenExperimentStrategy(d)&&d.risk!=='CONTROL'&&!d.minuteSampler).map(d=>{
    const all=trades.filter(t=>t.strategy===d.id),era=all.filter(t=>t.policyVersion===STRATEGY_ERA);
    const train=era.filter(t=>(t.samplePartition||partitionForMint(t.mint))==='train'),holdout=era.filter(t=>(t.samplePartition||partitionForMint(t.mint))==='holdout');
    const summarize=a=>{const rets=a.map(t=>t.pnlPct).filter(Number.isFinite),m=avg(rets),sd=stdev(rets),se=rets.length?sd/Math.sqrt(rets.length):0,grossWin=a.filter(t=>t.pnl>0).reduce((s,t)=>s+num(t.pnl),0),grossLoss=Math.abs(a.filter(t=>t.pnl<0).reduce((s,t)=>s+num(t.pnl),0));return{n:rets.length,mean:m,median:median(rets),stdev:sd,ciLow:m-1.96*se,ciHigh:m+1.96*se,winRate:rets.length?a.filter(t=>t.pnlPct>0).length/rets.length*100:0,profitFactor:grossLoss?grossWin/grossLoss:grossWin>0?9.99:0};};
    const tr=summarize(train),ho=summarize(holdout),overall=summarize(era),shrink=tr.n/(tr.n+20),shrunkMean=tr.mean*shrink;
    return{id:d.id,name:d.name,n:overall.n,trainN:tr.n,holdoutN:ho.n,legacyN:all.length-era.length,mean:overall.mean,median:overall.median,stdev:overall.stdev,ciLow:overall.ciLow,ciHigh:overall.ciHigh,
      trainMean:tr.mean,trainCiLow:tr.ciLow,trainCiHigh:tr.ciHigh,holdoutMean:ho.mean,holdoutCiLow:ho.ciLow,holdoutCiHigh:ho.ciHigh,holdoutWinRate:ho.winRate,
      shrunkMean,winRate:overall.winRate,profitFactor:overall.profitFactor,trainProfitFactor:tr.profitFactor,holdoutProfitFactor:ho.profitFactor,dd:d.dd,equity:d.equity};
  }).sort((a,b)=>b.shrunkMean-a.shrunkMean);
}
function dynamicAllocator(){
  const regime=marketWeather().regime;if(allocatorCache.data&&allocatorCache.regime===regime&&now()-allocatorCache.ts<10000)return allocatorCache.data;
  const stats=strategyStatistics(),focus=new Set(edgeResearchFocus().strategies.map(x=>x.id));const rows=stats.map(st=>{
    const d=strategyDefs.find(x=>x.id===st.id),reg=strategyRegimeWeight(st.id,regime),sample=st.n/(st.n+20);
    const evidence=st.n>=3?clamp(1+st.shrunkMean/35,.55,1.55):1,focused=focus.has(st.id),focusMult=focused?1:.22;
    const independence=diversityWeight(st.id),raw=Math.max(focused?.10:.02,reg*(.75+.25*sample)*evidence*independence*focusMult);
    return{id:st.id,name:st.name,raw,n:st.n,legacyN:st.legacyN,shrunkMean:st.shrunkMean,dd:st.dd,risk:d?.risk||'MED',focused,tier:focused?'CORE EVIDENCE':'EXPLORATION'};
  });const sum=rows.reduce((a,x)=>a+x.raw,0)||1,data={regime,era:STRATEGY_ERA,focusCount:focus.size,weights:rows.map(x=>({...x,pct:x.raw/sum*100})).sort((a,b)=>b.pct-a.pct),concentration:rows.length?Math.max(...rows.map(x=>x.raw/sum*100)):0};allocatorCache={ts:now(),regime,data};return data;
}
function allocationWeight(id){
  const a=dynamicAllocator(),w=a.weights.find(x=>x.id===id);if(!w)return 1;
  const equal=100/Math.max(1,a.weights.length);return clamp(w.pct/equal,w.focused?.55:.18,w.focused?1.75:.55);
}
function exitModeFor(d){
  if(d.exitMode)return d.exitMode;
  const id=d.parentId||d.id;if(['banker','professional','sniper'].includes(id))return'defensive';
  if(['momentum','smartmom','champion','degen','confirmed_runner'].includes(id))return'runner';
  if(['swing','dip','contrarian','asym_swing'].includes(id))return'structure';
  return'balanced';
}
function partialClose(d,p,t,fraction,why){
  if(!(p.units>0)||!(t.price>0)||!tokenPriceIntegrity(t).executable)return false;
  const frac=clamp(fraction,.05,.80),units=p.units*frac,notional=units*t.price;
  const exec=executionQuote(t,notional,'sell'),partialAlpha=alphaOS.executionBrain(t,{features:features(t),score:p.score||50}),exit=exec.fillPrice,gross=units*exit;exec.networkCostUsd=Number(partialAlpha.networkCostUsd||0);exec.priorityLamports=Number(partialAlpha.priorityLamports||0);exec.jitoTipLamports=Number(partialAlpha.jitoTipLamports||0);exec.executionMode=partialAlpha.mode||'STANDARD_RPC';const proceeds=Math.max(0,gross*(1-exec.feeRate)-exec.fixedCost-exec.networkCostUsd);
  p.units=Math.max(0,p.units-units);p.realizedProceeds=num(p.realizedProceeds)+proceeds;
  p.partialExits=p.partialExits||[];p.partialExits.push({ts:now(),why,fraction:frac,units,exit,proceeds,execution:exec});
  d.cash+=proceeds;markEquity(d);queueTradeJournal('PARTIAL',d,p,t,{why,fraction:frac});scheduleCriticalSave();
  if(d.risk!=='R&D')log('trim',`${d.icon} ${d.name} trimmed ${Math.round(frac*100)}% of ${t.symbol} · ${why}`,'good',{strategy:d.id,mint:t.mint});
  return true;
}
function manageScaleOut(d,p,t){
  if(!d.scaleOut)return false;
  const pnl=pct(t.price,p.entry),estimatedProfitUsd=(p.units*t.price)-((num(p.entryCost)||p.invested*(1+FEE_RATE))-num(p.realizedProceeds));
  if(estimatedProfitUsd<PAPER_MIN_PROFIT_TAKE_USD)return false;
  const levels=[30,75,150,300];p.scaleOutHits=p.scaleOutHits||[];
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

function estimatedOpenProfitUsd(p,t){
  const remainingEntryCost=Math.max(0,(num(p.entryCost)||p.invested*(1+FEE_RATE))-num(p.realizedProceeds));
  return (p.units*num(t.price))-remainingEntryCost;
}
function exitDecision(d,p,t,f){
  const mode=exitModeFor(d),pnl=pct(t.price,p.entry),hold=(now()-p.opened)/60000,peakPnl=pct(p.peakDuring||t.price,p.entry),drawFromPeak=peakPnl-pnl,estimatedProfitUsd=estimatedOpenProfitUsd(p,t),meaningfulProfit=estimatedProfitUsd>=PAPER_MIN_PROFIT_TAKE_USD;
  if(d.postEntryProfile){
    p.postEntryPath=p.postEntryPath||[];
    const last=num(p.postEntryPath.at(-1)?.ts);
    if(!last||now()-last>=15000){
      p.postEntryPath.push({ts:now(),holdMin:hold,pnl,peakPnl,drawFromPeak,momentum:num(f.momentum),acceleration:num(f.acceleration),buyRatio:num(f.buyRatio),risk:num(f.risk),flow:num(f.flow),liqScore:num(f.liqScore)});
      if(p.postEntryPath.length>48)p.postEntryPath.shift();
    }
    const catastrophic=(f.flowFresh&&f.buyRatio<.25)||f.risk>=84;
    if(catastrophic&&hold>=.25)return{exit:true,why:d.postEntryProfile+' · emergency thesis break',mode:'post-entry'};
    if(d.postEntryProfile==='fast-failure'){
      const noSpark45=hold>=.75&&peakPnl<2&&pnl<=-3&&(f.acceleration<48||f.momentum<52||f.buyRatio<.48);
      const failed90=hold>=1.5&&peakPnl<5&&pnl<1&&(f.acceleration<45||f.buyRatio<.50);
      const hardLoss=pnl<=-12;
      const winnerTrail=peakPnl>=15&&drawFromPeak>=Math.max(6,peakPnl*.26)&&meaningfulProfit;
      if(hardLoss)return{exit:true,why:'Winner 1 · hard failure cut',mode:'post-entry-fast'};
      if(noSpark45)return{exit:true,why:'Winner 1 · no early spark',mode:'post-entry-fast'};
      if(failed90)return{exit:true,why:'Winner 1 · failed to confirm by 90s',mode:'post-entry-fast'};
      if(winnerTrail)return{exit:true,why:'Winner 1 · confirmed winner trail',mode:'post-entry-fast'};
      if(hold>=90&&(pnl<=0||meaningfulProfit))return{exit:true,why:'Winner 1 · max observation window',mode:'post-entry-fast'};
      return{exit:false,mode:'post-entry-fast'};
    }
    if(d.postEntryProfile==='confirm-runner'){
      p.winnerConfirmed=p.winnerConfirmed||false;
      if(!p.winnerConfirmed&&((hold<=3&&peakPnl>=8&&f.momentum>=52&&f.acceleration>=44&&f.buyRatio>=.50)||(peakPnl>=12&&pnl>=6)))p.winnerConfirmed=true;
      const hardLoss=pnl<=-15;
      const failedProof=hold>=2.5&&!p.winnerConfirmed&&peakPnl<6&&pnl<2;
      const lateNoProof=hold>=5&&!p.winnerConfirmed&&peakPnl<10;
      const confirmedTrail=p.winnerConfirmed&&peakPnl>=18&&drawFromPeak>=Math.max(7,peakPnl*.34)&&meaningfulProfit;
      if(hardLoss)return{exit:true,why:'Winner 2 · hard failure cut',mode:'post-entry-confirm'};
      if(failedProof)return{exit:true,why:'Winner 2 · did not prove winner shape',mode:'post-entry-confirm'};
      if(lateNoProof)return{exit:true,why:'Winner 2 · no confirmation after 5m',mode:'post-entry-confirm'};
      if(confirmedTrail)return{exit:true,why:'Winner 2 · confirmed runner trail',mode:'post-entry-confirm'};
      if(hold>=180&&(pnl<=0||meaningfulProfit))return{exit:true,why:'Winner 2 · max runner window',mode:'post-entry-confirm'};
      return{exit:false,mode:'post-entry-confirm'};
    }
  }
  if(d.minuteSampler){
    if(pnl<=-d.stop)return{exit:true,why:'minute sampler stop',mode:'minute'};
    if(pnl>=d.take)return{exit:true,why:'minute sampler take',mode:'minute'};
    if(hold>=.80)return{exit:true,why:'minute sampler recycle',mode:'minute'};
    return{exit:false,mode:'minute'};
  }
  if(d.fastScalp){
    const velocityFade=hold>=.55&&(f.acceleration<48||f.buyRatio<.50||f.shortRet<-1.5);
    const microTrail=peakPnl>=7&&drawFromPeak>=3.5;
    if(pnl<=-6)return{exit:true,why:'velocity scalp hard stop',mode:'scalp'};
    if(pnl>=11)return{exit:true,why:'velocity scalp quick take',mode:'scalp'};
    if(microTrail)return{exit:true,why:'velocity scalp micro-trail',mode:'scalp'};
    if(velocityFade)return{exit:true,why:'velocity faded',mode:'scalp'};
    if(hold>=3.5)return{exit:true,why:'velocity scalp timeout',mode:'scalp'};
    return{exit:false,mode:'scalp'};
  }
  const learnedExit=isFrozenExperimentStrategy(d)&&eraTradeCount(d)<FROZEN_EXPERIMENT_MIN_TRADES?{confidence:0}:profitAccelerator.exitLearning({strategyId:d.id,trades,era:STRATEGY_ERA});
  let stop=Math.min(d.stop,18),take=d.take,maxHold=d.maxHold||60;
  if(learnedExit.confidence>=.30){if(Number.isFinite(learnedExit.stopCap))stop=Math.min(stop,learnedExit.stopCap);if(Number.isFinite(learnedExit.takeFloor))take=Math.max(take,learnedExit.takeFloor);}
  if(mode==='scalp'){maxHold=Math.min(maxHold,28);stop=Math.min(stop,10);take=Math.min(take,50);}
  if(mode==='defensive'){maxHold=Math.min(maxHold,60);stop=Math.min(stop,12);}
  if(mode==='runner')maxHold=Math.max(maxHold,120);
  if(mode==='structure')maxHold=Math.max(maxHold,180);
  if(mode==='conviction')maxHold=Math.max(maxHold,720);
  const baseTrailFrac=mode==='conviction' ? .48 : mode==='runner' ? .36 : .30;
  const trailFrac=learnedExit.confidence>=.30&&Number.isFinite(learnedExit.trailFrac)?Math.max(baseTrailFrac,learnedExit.trailFrac):baseTrailFrac;
  const trailing=peakPnl>=18&&drawFromPeak>=Math.max(7,peakPnl*trailFrac);
  const deadOnArrival=hold>=1.25&&pnl<=-8&&peakPnl<6&&(f.acceleration<48||f.momentum<58||f.buyRatio<.50);
  const failedBreakout=hold>=2.5&&pnl<=-6&&peakPnl<10&&f.acceleration<45;
  const catastrophic=(f.flowFresh&&f.buyRatio<.28)||(f.risk>=84);
  const memeChartBreak=!!d.memeTheory&&hold>=1.5&&((f.chart?.chartQuality||0)<32||(f.meme?.manipulationSuspicion||0)>=78||((f.meme?.attentionDecay||0)>=72&&pnl<12));
  const fade=f.flowFresh&&f.acceleration<38&&f.momentum<42&&f.buyRatio<((mode==='runner'||mode==='conviction') ? .38 : .44);
  if(catastrophic&&hold>.75)return{exit:true,why:'catastrophic thesis break',mode};
  if(memeChartBreak)return{exit:true,why:'meme chart thesis broke',mode};
  if(deadOnArrival)return{exit:true,why:'dead-on-arrival invalidation',mode};
  if(failedBreakout)return{exit:true,why:'failed breakout invalidation',mode};
  if(pnl<=-stop)return{exit:true,why:'stop',mode};
  if(pnl>=take&&!d.scaleOut&&meaningfulProfit)return{exit:true,why:`take profit · ${estimatedProfitUsd.toFixed(0)}`,mode};
  if(trailing&&meaningfulProfit)return{exit:true,why:`trailing peak protection · ${estimatedProfitUsd.toFixed(0)}`,mode};
  if(hold>maxHold&&(pnl<=0||meaningfulProfit))return{exit:true,why:pnl>0?`time exit · ${estimatedProfitUsd.toFixed(0)}`:'time exit',mode};
  if(fade&&hold>(mode==='scalp'?1.5:3)&&(pnl<=0||meaningfulProfit))return{exit:true,why:pnl>0?`thesis broke · ${estimatedProfitUsd.toFixed(0)}`:'thesis broke',mode};
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

function hypothesisStatusFor(d){
  const all=eraPerformance(d.id),train=eraPerformance(d.id,'train'),hold=eraPerformance(d.id,'holdout');
  let status='COLLECTING',reason='needs 50 total exits and 10 holdout exits';
  if(d.hypothesisRetiredAt){status='RETIRED';reason=d.hypothesisReason||'failed holdout evidence';}
  else if(d.hypothesisCandidateAt){status='PROMISING';reason=d.hypothesisReason||'positive holdout expectancy';}
  else if(all.n>=50&&hold.n>=10){
    const bad=hold.mean<=-3&&hold.profitFactor<.90&&hold.ciHigh<6;
    const good=hold.mean>2&&hold.profitFactor>1.15&&hold.ciLow>-8&&d.dd<20;
    if(bad){status='RETIRE CANDIDATE';reason='negative holdout expectancy + weak profit factor';}
    else if(good){status='PROMISING CANDIDATE';reason='positive holdout expectancy + PF > 1.15';}
    else{status='INCONCLUSIVE';reason='sample sufficient but edge is not statistically convincing';}
  }
  return{status,reason,all,train,hold};
}
function evaluateHypothesisArena(){
  for(const d of hypothesisStrategies()){
    const h=hypothesisStatusFor(d);
    if(h.status==='RETIRE CANDIDATE'&&!d.hypothesisRetiredAt){
      d.hypothesisRetiredAt=now();d.hypothesisReason=h.reason;
      graveyard.unshift({ts:now(),era:STRATEGY_ERA,child:d.name,parent:'Hypothesis Arena',totalSample:h.all.n,holdoutSample:h.hold.n,holdoutMean:h.hold.mean,reason:h.reason,status:'HYPOTHESIS RETIRED'});
      graveyard.splice(100);log('research','☠️ Hypothesis retired: '+d.name,'system',{id:d.id,holdout:h.hold});
    }else if(h.status==='PROMISING CANDIDATE'&&!d.hypothesisCandidateAt){
      d.hypothesisCandidateAt=now();d.hypothesisReason=h.reason;
      promotions.unshift({ts:now(),era:STRATEGY_ERA,child:d.name,parent:'Hypothesis Arena',totalSample:h.all.n,holdoutSample:h.hold.n,holdoutMean:h.hold.mean,holdoutProfitFactor:h.hold.profitFactor,status:'HYPOTHESIS PROMISING'});
      promotions.splice(100);log('research','🏆 Promising hypothesis: '+d.name,'system',{id:d.id,holdout:h.hold});
    }
  }
}
function hypothesisArenaSnapshot(){
  const rows=hypothesisStrategies().map(d=>{
    markEquity(d);const h=hypothesisStatusFor(d);
    return{id:d.id,name:d.name,icon:d.icon,thesis:d.thesis,status:h.status,reason:h.reason,equity:d.equity,pnl:d.equity-START,n:h.all.n,trainN:h.train.n,holdoutN:h.hold.n,
      mean:h.all.mean,trainMean:h.train.mean,holdoutMean:h.hold.mean,holdoutPF:h.hold.profitFactor,holdoutCiLow:h.hold.ciLow,holdoutCiHigh:h.hold.ciHigh,dd:d.dd,open:openCount(d.id),eligibleNow:[...tokens.values()].filter(t=>now()-t.updatedAt<900000&&specialistEligibility(d,t,features(t)).ok).length};
  });
  const promising=rows.filter(x=>x.status==='PROMISING'||x.status==='PROMISING CANDIDATE').length,retired=rows.filter(x=>x.status==='RETIRED'||x.status==='RETIRE CANDIDATE').length;
  return{count:rows.length,promising,retired,collecting:rows.length-promising-retired,capital:rows.reduce((a,x)=>a+x.equity,0),start:rows.length*START,rows};
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

function memeChartLabSnapshot(){
  const active=[...tokens.values()].filter(t=>now()-t.updatedAt<900000);
  const traders=memeTheoryStrategies().map(d=>{markEquity(d);const rows=trades.filter(x=>x.strategy===d.id&&x.policyVersion===STRATEGY_ERA),hold=eraPerformance(d.id,'holdout');
    return{id:d.id,name:d.name,thesis:d.thesis,equity:d.equity,n:rows.length,winRate:rows.length?rows.filter(x=>x.pnl>0).length/rows.length*100:0,avg:avg(rows.map(x=>x.pnlPct)),holdoutN:hold.n,holdoutMean:hold.mean,holdoutPF:hold.profitFactor,dd:d.dd,open:openCount(d.id),eligibleNow:active.filter(t=>specialistEligibility(d,t,features(t)).ok).length};
  });
  const setupMap=new Map();
  for(const t of trades.filter(x=>x.policyVersion===STRATEGY_ERA).slice(0,750)){
    const setup=t.entryFeatures?.meme?.setup||t.features?.memeSetup||'UNKNOWN';if(setup==='UNKNOWN')continue;
    if(!setupMap.has(setup))setupMap.set(setup,[]);setupMap.get(setup).push(t);
  }
  const setups=[...setupMap].map(([setup,rows])=>{const hold=rows.filter(x=>(x.samplePartition||partitionForMint(x.mint))==='holdout');return{setup,n:rows.length,avg:avg(rows.map(x=>x.pnlPct)),winRate:rows.length?rows.filter(x=>x.pnl>0).length/rows.length*100:0,holdoutN:hold.length,holdoutAvg:avg(hold.map(x=>x.pnlPct))};}).sort((a,b)=>b.holdoutN-a.holdoutN||b.avg-a.avg);
  const structures={};for(const t of active){const f=features(t),k=f.chart?.structure||'UNKNOWN';structures[k]=(structures[k]||0)+1;}
  const best=active.map(t=>{const f=features(t);return{mint:t.mint,symbol:t.symbol,mc:t.mc,liq:t.liq,chart:f.chart,meme:f.meme,score:f.score};}).sort((a,b)=>(b.meme?.memeQuality||0)-(a.meme?.memeQuality||0)).slice(0,12);
  return{traders,setups:setups.slice(0,20),structures,best};
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
function phaseMatrix(){
  const phases=['EUPHORIC','FRAGILE HOT','HEALTHY TREND','EARLY TREND','BALANCED','CHOPPY','THIN','DEFENSIVE'];return phases.map(phase=>{const rows=strategyDefs.filter(d=>d.risk!=='CONTROL'&&!d.specialist).map(d=>{const a=trades.filter(t=>t.strategy===d.id&&(t.entryPhase||'UNKNOWN')===phase);return{name:d.name,id:d.id,n:a.length,avgPnl:avg(a.map(t=>t.pnlPct)),winRate:a.length?a.filter(t=>t.pnlPct>0).length/a.length*100:0};}).filter(x=>x.n>0).sort((a,b)=>b.avgPnl-a.avgPnl);return{phase,leaders:rows.slice(0,5)}}).filter(x=>x.leaders.length);
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

function eraPerformance(id,partition=null){
  const rows=trades.filter(t=>t.strategy===id&&t.policyVersion===STRATEGY_ERA&&(!partition||(t.samplePartition||partitionForMint(t.mint))===partition));
  const rets=rows.map(t=>t.pnlPct).filter(Number.isFinite),mean=avg(rets),sd=stdev(rets),se=rets.length?sd/Math.sqrt(rets.length):0,wins=rows.filter(t=>t.pnl>0),losses=rows.filter(t=>t.pnl<0),grossWin=wins.reduce((z,t)=>z+num(t.pnl),0),grossLoss=Math.abs(losses.reduce((z,t)=>z+num(t.pnl),0));
  return{n:rows.length,mean,total:rows.reduce((z,t)=>z+num(t.pnl),0),winRate:rows.length?wins.length/rows.length*100:0,
    profitFactor:grossLoss?grossWin/grossLoss:grossWin>0?9.99:0,tail:rets.length?percentile(rets,.10):0,ciLow:mean-1.96*se,ciHigh:mean+1.96*se};
}
function evaluateEvolution(){
  for(const childDef of challengers){
    const parentDef=strategyDefs.find(x=>x.id===childDef.parentId);if(!parentDef)continue;
    const child=eraPerformance(childDef.id),parent=eraPerformance(parentDef.id),childHold=eraPerformance(childDef.id,'holdout'),parentHold=eraPerformance(parentDef.id,'holdout');
    if(child.n<60||childHold.n<12)continue;
    const baseline=parentHold.n>=8?parentHold.mean:(parent.n>=20?parent.mean:0),edge=childHold.mean-baseline,tailOk=childHold.tail>=(parentHold.n>=8?parentHold.tail-5:-25);
    const candidate=edge>3&&childHold.mean>0&&childHold.profitFactor>1.20&&tailOk&&childHold.ciLow>-8;
    if(candidate&&!childDef.promotedAt){
      if(!childDef.promotionCandidateAt){
        childDef.promotionCandidateAt=now();
        const row={ts:now(),era:STRATEGY_ERA,child:childDef.name,parent:parentDef.name,edge,totalSample:child.n,holdoutSample:childHold.n,holdoutMean:childHold.mean,holdoutProfitFactor:childHold.profitFactor,autoPromotion:ALLOW_AUTO_PROMOTION};
        promotions.unshift({...row,status:'CANDIDATE'});promotions.splice(100);log('evolution',`🏆 ${childDef.name} earned holdout promotion-candidate status`,'system',row);
      }
      if(ALLOW_AUTO_PROMOTION){
        parentDef.min=childDef.min;parentDef.stop=childDef.stop;parentDef.take=childDef.take;if(childDef.riskCap)parentDef.riskCap=childDef.riskCap;if(childDef.exitMode)parentDef.exitMode=childDef.exitMode;if(childDef.sizeBias)parentDef.sizeBias=childDef.sizeBias;
        parentDef.version=(parentDef.version||3)+1;childDef.promotedAt=now();log('evolution',`🏆 ${childDef.name} auto-promoted into ${parentDef.name} v${parentDef.version}`,'system',{edge,holdoutSample:childHold.n});
      }
    }else if(!candidate&&!childDef.graveyardAt&&child.n>=60&&childHold.n>=12&&edge<-8&&childHold.mean<0){
      childDef.graveyardAt=now();const row={ts:now(),era:STRATEGY_ERA,child:childDef.name,parent:parentDef.name,edge,totalSample:child.n,holdoutSample:childHold.n,reason:'failed out-of-sample holdout'};
      graveyard.unshift(row);graveyard.splice(100);log('evolution',`☠️ ${childDef.name} moved to the Strategy Graveyard after holdout failure`,'system',row);
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
  evaluateHypothesisArena();
  spawnResearchChallenger();
  const recent=trades.filter(t=>t.policyVersion===STRATEGY_ERA&&now()-t.closedAt<3600000&&!t.strategy.includes('-c'));const wins=recent.filter(t=>t.pnl>0);const avg=recent.length?recent.reduce((a,t)=>a+t.pnlPct,0)/recent.length:0;
  const prod=strategyDefs.filter(d=>d.risk!=='CONTROL'&&!d.specialist);prod.forEach(markEquity);const best=[...prod].sort((a,b)=>b.equity-a.equity)[0];
  const misses=missedMonsters().slice(0,5),monsterLab=monsterPatternLab(),disc=discoveryLab(),scienceSnap=science.snapshot(strategyDefs.map(d=>d.id)),hypotheses=[];
  if(misses.length>=3)hypotheses.push('Rejection thresholds may be too strict for a subset of high-upside tokens; use matched monster-vs-control features before relaxing any production gate.');
  if(monsterLab.features?.[0]?.strength>=.35)hypotheses.push(`Matched Missed Monster study: ${monsterLab.features[0].key} is currently the strongest early separator (effect ${monsterLab.features[0].effectSize.toFixed(2)}); validate on holdout before using it.`);
  if((disc.p95Ms||0)>4000)hypotheses.push(`Discovery p95 is ${Math.round(disc.p95Ms)} ms, above the 4s research target; prioritize create-signal resolution and measure late-monster incidence.`);
  if(scienceSnap.featureImportance?.n>=20&&scienceSnap.featureImportance.features?.[0])hypotheses.push(`Train-only feature lab currently ranks ${scienceSnap.featureImportance.features[0].key} highest for trade alpha; holdout remains untouched.`);
  if(scienceSnap.abstention?.n>=20&&scienceSnap.abstention.falseRejectRate>30)hypotheses.push('The global abstention model is rejecting too many +25% counterfactuals; inspect veto reasons rather than broadly loosening gates.');
  const badExit=trades.filter(t=>t.counterfactual?.bestObservedAfterExit>35&&t.pnlPct<20).slice(0,10);if(badExit.length>=3)hypotheses.push('Several exits left large continuation on the table; compare exit policies independently from entry selection.');
  const weather=marketWeather();const ex=exitLab();if(ex.n>=5&&ex.capture<45)hypotheses.push('Exit capture is below 45% of observed favorable excursion; prioritize longer-hold exit challengers.');const cal=confidenceCalibration().filter(x=>x.n>=5);if(cal.length&&cal.at(-1)?.hitRate<cal[0]?.hitRate)hypotheses.push('High confidence buckets are not yet better calibrated than lower buckets; confidence scores need more evidence.');if(weather.regime==='RISK OFF')hypotheses.push('Current regime is risk-off; compare defensive strategies against momentum before expanding exposure.');
  for(const h of scientistInsights())hypotheses.push(h.text);
  lastScientistRun=now();
  research={last:now(),notes:[`${recent.length} production exits this hour · ${recent.length?((wins.length/recent.length)*100).toFixed(0):0}% win rate · avg ${avg.toFixed(1)}% · leader ${best?.name||'n/a'}`,'Production strategies remain stable. Challengers use separate paper capital and cannot silently rewrite the incumbent.'],hypotheses};
  log('research','🧪 Research Director completed an hourly review','system',{hypotheses:hypotheses.length});
}

function experimentSnapshot(){
  return challengers.map(ch=>{const p=strategyDefs.find(x=>x.id===ch.parentId),child=eraPerformance(ch.id),parent=eraPerformance(p.id),ho=eraPerformance(ch.id,'holdout'),pho=eraPerformance(p.id,'holdout');
    const baseline=pho.n>=8?pho.mean:(parent.n>=20?parent.mean:0),edge=ho.mean-baseline;let status='COLLECTING';
    if(ch.promotedAt)status='PROMOTED';else if(ch.promotionCandidateAt)status='HOLDOUT CANDIDATE';else if(child.n>=60&&ho.n>=12&&edge>3&&ho.mean>0&&ho.profitFactor>1.2)status='PROMOTION CANDIDATE';else if(child.n>=60&&ho.n>=12&&edge<-8)status='GRAVEYARD CANDIDATE';
    return{id:ch.id,name:ch.name,parent:p.name,mutation:ch.mutation,era:STRATEGY_ERA,equity:ch.equity,parentEquity:p.equity,edge,sample:child.n,holdoutSample:ho.n,holdoutMean:ho.mean,holdoutProfitFactor:ho.profitFactor,profitFactor:child.profitFactor,status,autoPromotion:ALLOW_AUTO_PROMOTION};
  });
}

function takeTimeline(){const w=marketWeather();strategyDefs.forEach(markEquity);timeline.push({ts:now(),regime:w.regime,temperature:w.temperature,capital:strategyDefs.filter(x=>x.risk!=='CONTROL'&&!x.specialist).reduce((a,d)=>a+d.equity,0),champion:strategyDefs.find(x=>x.id==='champion').equity,tokens:tokens.size,topNarrative:narrativeStats()[0]?.name||'n/a'});while(timeline.length>MAX_TIMELINE)timeline.shift();}


function resetTraderRuntime(d){
  d.equity=START;d.cash=START;d.peak=START;d.dd=0;d.auditPeak=START;d.auditDd=0;d.wins=0;d.losses=0;d.n=0;
  for(const k of ['promotionCandidateAt','promotedAt','graveyardAt','hypothesisCandidateAt','hypothesisRetiredAt','hypothesisReason'])delete d[k];
}
async function beginCleanExecutionEraIfNeeded(){
  if(seasonInfo?.label===CLEAN_SEASON_LABEL)return false;
  if(!ALLOW_SEASON_MIGRATION){
    const evidence={label:seasonInfo?.label||null,trades:trades.length,open:positions.length,stateVersionTs};
    console.error('SEASON_MIGRATION_BLOCKED '+JSON.stringify(evidence));
    throw new Error('Season migration required but ALLOW_SEASON_MIGRATION is false; refusing automatic reset');
  }
  const previous={
    label:seasonInfo?.label||'legacy',
    startedAt:num(seasonInfo?.startedAt)||startedAt,
    endedAt:now(),
    detailedTrades:trades.length,
    aggregateRecoveredRows:num(forensicLedgerGaps.total),
    productionExits:strategyDefs.filter(d=>d.risk!=='CONTROL'&&!d.specialist).reduce((z,d)=>z+num(d.n),0),
    totalExits:currentExitTotal(),
    note:'Season 2 results retained for forensics but excluded from Season 3 strategy-era scoring.'
  };
  for(const d of allTraders())resetTraderRuntime(d);
  positions.splice(0);
  activity.splice(0);decisions.splice(0);timeline.splice(0);autopsies.splice(0);experiments.splice(0);replayFrames.splice(0);
  promotions.splice(0);graveyard.splice(0);opportunities.clear();opportunityKeysByMint.clear();
  entryPolicyCache.clear();regimeWeightCache.clear();dnaSimilarityCache.clear();featureCache.clear();
  marketWeatherCache={ts:0,value:null};narrativeStatsCache={ts:0,value:null};corrCache={ts:0,rows:[]};edgeFocusCache={ts:0,data:null};allocatorCache={ts:0,regime:'',data:null};
  research={last:0,notes:['Season 3 clean execution era started. Season 2 detailed trades remain available only as historical forensic evidence.'],hypotheses:[]};lastScientistRun=0;
  const freshAlpha=createPumpLabAlphaOS({start:START,rpcUrl:SOLANA_RPC_HTTP,routeQuoteUrl:SHADOW_ROUTE_QUOTE_URL,shadowWalletPublicKey:SHADOW_WALLET_PUBLIC_KEY});
  alphaOS.restore(freshAlpha.serialize());science.reset();
  startedAt=now();
  seasonInfo={label:CLEAN_SEASON_LABEL,startedAt,archiveId:'historical:season2-contaminated',resetApplied:true,previous};
  recoveryHighWater={
    seasonKey:CLEAN_SEASON_LABEL,
    ledgerRows:trades.length+Math.max(0,num(forensicLedgerGaps.total)),
    productionExits:0,
    exitTotal:0,
    strategyN:Object.fromEntries(allTraders().map(d=>[d.id,0])),
    updatedAt:now(),
    source:'season3-clean-execution-migration'
  };
  stateVersionTs=now();
  validateStateIntegrity({repair:true});
  await writeLocalAtomic(serialize());
  await writeLocalCriticalAtomic(serializeCritical());
  console.warn('SEASON3_CLEAN_EXECUTION_START '+JSON.stringify({label:CLEAN_SEASON_LABEL,previous,retainedHistoricalTrades:trades.length,newProductionExits:0,newOpen:positions.length}));
  return true;
}

function resetSeasonInMemory(label,archiveId){
  for(const d of strategyDefs)resetTraderRuntime(d);
  for(const d of challengers)resetTraderRuntime(d);
  positions.splice(0);trades.splice(0);activity.splice(0);decisions.splice(0);timeline.splice(0);autopsies.splice(0);experiments.splice(0);replayFrames.splice(0);
  promotions.splice(0);graveyard.splice(0);walletEvents.splice(0);marketEvents.splice(0);pendingDbEvents.splice(0);solanaQueue.splice(0);solanaPriorityQueue.splice(0);discoveryLedger.splice(0);discoveryFirstByMint.clear();solanaSubscriptionKinds.clear();solanaCreateSignals=0;
  opportunities.clear();opportunityKeysByMint.clear();tokens.clear();creators.clear();dnaArchive.clear();marketEventClock.clear();solanaSeen.clear();
  entryPolicyCache.clear();regimeWeightCache.clear();dnaSimilarityCache.clear();featureCache.clear();marketWeatherCache={ts:0,value:null};narrativeStatsCache={ts:0,value:null};corrCache={ts:0,rows:[]};edgeFocusCache={ts:0,data:null};allocatorCache={ts:0,regime:'',data:null};
  research={last:0,notes:[],hypotheses:[]};lastScientistRun=0;lastDbEventFlush=0;
  const freshAlpha=createPumpLabAlphaOS({start:START,rpcUrl:SOLANA_RPC_HTTP,routeQuoteUrl:SHADOW_ROUTE_QUOTE_URL,shadowWalletPublicKey:SHADOW_WALLET_PUBLIC_KEY});
  alphaOS.restore(freshAlpha.serialize());science.reset();
  startedAt=now();
  seasonInfo={label,startedAt,archiveId,resetApplied:true};
}
function buildArchiveMonsterExport(archive,updatedAt){
  const s=archive?.state||{},rawOpps=Array.isArray(s.opportunities)?s.opportunities:[],opps=rawOpps.map(x=>Array.isArray(x)?x[1]:x).filter(o=>o&&o.action==='REJECT');
  const mints=new Set(opps.map(o=>o.mint).filter(Boolean));
  const safeRejects=opps.map(o=>({ts:o.ts,firstTs:o.firstTs,era:o.era,samplePartition:o.samplePartition,strategy:o.strategy,strategyName:o.strategyName,mint:o.mint,symbol:o.symbol,action:o.action,score:o.score,risk:o.risk,price:o.price,firstPrice:o.firstPrice,mc:o.mc,narrative:o.narrative,regime:o.regime,why:o.why,features:o.features,bestReturn:o.bestReturn,worstReturn:o.worstReturn,latestReturn:o.latestReturn,entered:o.entered,entryTs:o.entryTs,entryPrice:o.entryPrice}));
  const events=(s.marketEvents||[]).filter(e=>mints.has(e.mint)).map(e=>({ts:e.ts,era:e.era,mint:e.mint,symbol:e.symbol,source:e.source,price:e.price,mc:e.mc,liq:e.liq,vol:e.vol,buys:e.buys,sells:e.sells,narrative:e.narrative,regime:e.regime,quality:e.quality,features:e.features,scores:e.scores}));
  const relatedTrades=(s.trades||[]).filter(t=>mints.has(t.mint)).map(t=>({strategy:t.strategy,strategyName:t.strategyName,mint:t.mint,symbol:t.symbol,opened:t.opened,closedAt:t.closedAt,entry:t.entry,exit:t.exit,entryMc:t.entryMc,exitMc:t.exitMc,pnl:t.pnl,pnlPct:t.pnlPct,mfe:t.mfe,mae:t.mae,reason:t.reason,samplePartition:t.samplePartition,policyVersion:t.policyVersion}));
  return{ok:true,archiveId:'archive:season2-2026-10-01',label:archive?.label,archivedAt:archive?.archivedAt,updatedAt,summary:archive?.summary,counts:{rejectOpportunities:safeRejects.length,uniqueRejectedMints:mints.size,marketEvents:events.length,trades:relatedTrades.length},opportunities:safeRejects,marketEvents:events,trades:relatedTrades};
}
function seasonArchiveEnvelope(label,state){
  const postmortems=allTraders().map(traderPostmortem);
  const strategyRows=strategyDiagnostics();
  return{
    archiveVersion:1,label,archivedAt:now(),strategyEra:STRATEGY_ERA,auditVersion:AUDIT_VERSION,
    summary:{
      completedTrades:trades.length,openPositions:positions.filter(p=>!p.closed).length,
      traders:allTraders().length,marketEventsInState:marketEvents.length,
      bankrollStart:START,totalEquity:allTraders().reduce((z,d)=>{markEquity(d);return z+num(d.equity)},0)
    },
    strategyDiagnostics:strategyRows,postmortems,
    hypothesisArena:typeof hypothesisArenaSnapshot==='function'?hypothesisArenaSnapshot():null,
    memeChartLab:typeof memeChartLabSnapshot==='function'?memeChartLabSnapshot():null,
    specialistCohorts:typeof specialistCohortStats==='function'?specialistCohortStats():null,
    state
  };
}
async function archiveAndResetSeason(label){
  if(!db||!label)return false;
  const safe=label.replace(/[^a-zA-Z0-9._-]/g,'_').slice(0,80),archiveId='archive:'+safe;
  const exists=await db.query('SELECT id FROM pump_lab_state WHERE id=$1',[archiveId]);
  if(exists.rows[0]){
    seasonInfo={...seasonInfo,label:safe,archiveId,resetApplied:false};
    console.log('SEASON_RESET already applied · archive exists '+archiveId);
    return false;
  }
  const oldState=serialize(),archive=seasonArchiveEnvelope(safe,oldState);
  await db.query('BEGIN');
  try{
    await db.query('INSERT INTO pump_lab_state(id,payload,updated_at) VALUES($1,$2,now())',[archiveId,archive]);
    resetSeasonInMemory(safe,archiveId);
    const fresh=serialize();
    await db.query("INSERT INTO pump_lab_state(id,payload,updated_at) VALUES('main',$1,now()) ON CONFLICT(id) DO UPDATE SET payload=$1,updated_at=now()",[fresh]);
    await db.query('COMMIT');
    lastDurableSaveAt=now();
    console.log('SEASON_RESET complete '+JSON.stringify({label:safe,archiveId,archivedTrades:archive.summary.completedTrades,archivedOpen:archive.summary.openPositions,newTrades:trades.length,newOpen:positions.length}));
    return true;
  }catch(e){
    try{await db.query('ROLLBACK')}catch{}
    restore(oldState);
    throw e;
  }
}

function scheduleDbReconnect(delay=null){
  if(dbReconnectTimer||db||dbConnecting)return;
  const ts=now();
  if(ts<dbDisabledUntil)return;
  const backoff=delay??Math.min(DB_RECONNECT_MAX_MS,5000*Math.pow(2,Math.min(6,dbReconnectAttempt)));
  dbReconnectTimer=setTimeout(()=>{dbReconnectTimer=null;if(now()>=dbDisabledUntil)initDb(!dbStateRestored);},Math.max(1000,backoff));
  dbReconnectTimer.unref?.();
}
function markRestoreSource(source){
  if(source==='postgres'){dbStateRestored=true;lastDurableRestoreAt=now();}
  if(source==='key-value'){kvStateRestored=true;lastKvRestoreAt=now();}
  if(source==='local'){localStateRestored=true;lastLocalRestoreAt=now();}
  if(source==='peer'){peerStateRestored=true;lastPeerRestoreAt=now();}
}
function restoreIfNewer(s,source,sourceTs=0){
  if(!s||typeof s!=='object')return false;
  const ts=num(s?.stateMeta?.savedAt)||num(sourceTs)||0;
  if(!recoveryHighWaterAllows(s,source))return false;
  const incoming=recoveryMetricsFromState(s);
  if(stateVersionTs&&ts&&ts<stateVersionTs){
    console.warn('STATE_VERSION_REGRESSION_REJECTED '+JSON.stringify({source,savedAt:ts,current:stateVersionTs,ledgerRows:incoming.ledgerRows,productionExits:incoming.productionExits}));
    return false;
  }
  restore(s);stateVersionTs=Math.max(stateVersionTs,ts);markRestoreSource(source);
  reconcileAuthoritativeExperimentState({repair:true,source:'restore:'+source});
  console.log('STATE_RESTORE '+JSON.stringify({source,savedAt:ts,current:stateVersionTs,ledgerRows:incoming.ledgerRows,productionExits:incoming.productionExits,authority:STATE_AUTHORITY_VERSION}));
  return true;
}
async function initKv(restoreState=true){
  if(!REDIS_URL)return false;
  if(kvReady||kvConnecting)return kvReady;
  kvConnecting=true;let client=null;
  const bounded=async(p,ms,label)=>{let timer;try{return await Promise.race([p,new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error(label+' timeout')),ms);timer.unref?.();})]);}finally{clearTimeout(timer);}};
  try{
    const {createClient}=await import('redis');
    client=createClient({url:REDIS_URL,socket:{connectTimeout:7000,reconnectStrategy:r=>Math.min(5000,250*Math.max(1,r))}});
    client.on('error',e=>{kvReady=false;setHealth('research-failover','warn','Key Value failover reconnecting: '+e.message,{truth:'observed'});});
    client.on('ready',()=>{kvReady=true;setHealth('research-failover','ok','Free Key Value failover online',{truth:'observed'});});
    await bounded(client.connect(),restoreState?9000:15000,'Key Value connect');kv=client;kvReady=true;
    if(restoreState){
      const [raw,criticalRaw,highRaw]=await bounded(Promise.all([kv.get('pump-lab:state:main'),kv.get('pump-lab:state:critical'),kv.get('pump-lab:state:highwater')]),7000,'Key Value restore');
      if(highRaw){try{applyRecoveryHighWater(JSON.parse(highRaw),'key-value-high-water');}catch(e){console.warn('Key Value high-water warning:',e.message);}}
      if(raw){try{restoreIfNewer(JSON.parse(raw),'key-value');}catch(e){console.warn('Key Value restore warning:',e.message);}}
      if(criticalRaw){try{restoreCriticalFromSource(JSON.parse(criticalRaw),'key-value');}catch(e){console.warn('Key Value critical restore warning:',e.message);}}
      if(!raw&&!criticalRaw&&!DATABASE_URL){
        kvStateRestored=true;lastKvRestoreAt=now();
        console.log('STATE_RESTORE '+JSON.stringify({source:'key-value-empty-fresh',savedAt:0,current:stateVersionTs}));
      }
    }
    setHealth('research-failover','ok','Free Key Value failover online · Postgres remains canonical',{truth:'observed'});
    return true;
  }catch(e){
    kvReady=false;if(kv===client)kv=null;try{client?.destroy?.();}catch{}
    setHealth('research-failover','warn','Key Value failover unavailable: '+e.message,{truth:'observed'});
    console.warn('Key Value connection failed:',e.message);return false;
  }finally{kvConnecting=false;}
}
function rebuildScienceFromDetailedLedger(reason='critical-recovery'){
  const previous=num(science.counters?.trades);
  if(!trades.length||previous>=trades.length)return false;
  const out=science.rebuildFromTradeLedger(trades);
  console.warn('SCIENCE_LEDGER_REBUILD '+JSON.stringify({reason,previous,detailedTrades:trades.length,rebuilt:num(out?.rebuilt),preservedAlpha:num(out?.preservedAlpha)}));
  return num(out?.rebuilt)>previous;
}
async function reseedCanonicalFullSnapshot(client,reason='recovery'){
  if(!client)return false;
  try{
    validateStateIntegrity({repair:true});advanceRecoveryHighWater('canonical-reseed');
    const s=serialize(),savedAt=num(s?.stateMeta?.savedAt)||now();stateVersionTs=Math.max(stateVersionTs,savedAt);
    await client.query('BEGIN');
    try{
      await client.query("INSERT INTO pump_lab_state(id,payload,updated_at) VALUES('main',$1,now()) ON CONFLICT(id) DO UPDATE SET payload=$1,updated_at=now()",[s]);
      await client.query("INSERT INTO pump_lab_state(id,payload,updated_at) VALUES('main:highwater',$1,now()) ON CONFLICT(id) DO UPDATE SET payload=$1,updated_at=now()",[recoveryHighWater]);
      await client.query('COMMIT');
    }catch(e){try{await client.query('ROLLBACK')}catch{}throw e;}
    await writeLocalAtomic(s);
    if(kvReady&&kv){try{await Promise.all([kv.set('pump-lab:state:main',JSON.stringify(s)),kv.set('pump-lab:state:highwater',JSON.stringify(recoveryHighWater))]);lastKvSaveAt=now();}catch(e){console.warn('Canonical KV reseed warning:',e.message);}}
    lastDurableSaveAt=now();
    console.warn('CANONICAL_FULL_RESEED '+JSON.stringify({reason,savedAt,ledgerRows:currentRecoveryMetrics().ledgerRows,productionExits:currentRecoveryMetrics().productionExits,scienceTrades:num(science.counters?.trades)}));
    return true;
  }catch(e){console.warn('Canonical full reseed warning:',e.message);return false;}
}
async function initDb(restoreState=true){
  if(!DATABASE_URL){setHealth('research-memory','standby','Render Postgres not attached · using failover storage when available',{truth:'not connected'});return;}
  if(db||dbConnecting)return;dbConnecting=true;let client=null;
  try{
    const {Client}=await import('pg');
    client=new Client({connectionString:DATABASE_URL,ssl:DATABASE_URL.includes('render.com')?{rejectUnauthorized:false}:undefined,connectionTimeoutMillis:15000,keepAlive:true,keepAliveInitialDelayMillis:5000});
    client.on('error',e=>{
      if(db===client)db=null;
      setHealth('research-memory','warn','Postgres interrupted · independent failover remains active while reconnecting',{truth:'observed'});
      // Postgres is canonical when healthy, but a brief canonical-store outage is not
      // an engine outage when the peer/local failover has a fresh trusted checkpoint.
      if(!durableTradingReady()&&lifecyclePhase==='READY')setLifecycle('DEGRADED','durable storage unavailable');
      console.warn('Postgres connection interrupted:',e.message);scheduleDbReconnect(5000);
    });
    await client.connect();db=client;dbReconnectAttempt=0;dbDisabledUntil=0;lastDbFailure='';
    await client.query('CREATE TABLE IF NOT EXISTS pump_lab_state (id text primary key, payload jsonb not null, updated_at timestamptz default now())');
    await client.query('CREATE TABLE IF NOT EXISTS pump_lab_market_events (id bigserial primary key, ts bigint not null, mint text not null, payload jsonb not null)');
    await client.query('CREATE INDEX IF NOT EXISTS pump_lab_market_events_ts_idx ON pump_lab_market_events(ts)');
    await client.query('CREATE INDEX IF NOT EXISTS pump_lab_market_events_mint_idx ON pump_lab_market_events(mint)');
    await client.query('CREATE TABLE IF NOT EXISTS pump_lab_trade_journal (event_id text primary key, ts bigint not null, kind text not null, strategy text not null, mint text not null, payload jsonb not null)');
    await client.query('CREATE INDEX IF NOT EXISTS pump_lab_trade_journal_ts_idx ON pump_lab_trade_journal(ts)');
    await client.query('CREATE INDEX IF NOT EXISTS pump_lab_trade_journal_strategy_idx ON pump_lab_trade_journal(strategy,ts)');
    if(restoreState||!dbStateRestored){
      const r=await client.query("SELECT id,payload,updated_at FROM pump_lab_state WHERE id IN ('main','main:critical','main:highwater')");
      const fullRow=r.rows.find(x=>x.id==='main'),criticalRow=r.rows.find(x=>x.id==='main:critical'),highRow=r.rows.find(x=>x.id==='main:highwater');let restoredAny=false,fullRestored=false,criticalRestored=false;
      if(highRow?.payload)applyRecoveryHighWater(highRow.payload,'postgres-high-water');
      if(fullRow?.payload){fullRestored=restoreIfNewer(fullRow.payload,'postgres',new Date(fullRow.updated_at).getTime());restoredAny=fullRestored||restoredAny;}
      if(criticalRow?.payload){criticalRestored=restoreCriticalIfNewer(criticalRow.payload,new Date(criticalRow.updated_at).getTime());restoredAny=criticalRestored||restoredAny;}
      // Postgres is not privileged during restore. Before journal repair or any
      // canonical reseed, inspect the independent peer and let a newer valid
      // timestamp supersede Postgres.
      const peerRestoredNow=PEER_RECOVERY_URL?await tryPeerRecovery():false;
      restoredAny=peerRestoredNow||restoredAny;
      if(!restoredAny){dbStateRestored=true;lastDurableRestoreAt=now();}
      const journalRepaired=await repairCurrentSeasonFromJournal(client);
      if(!journalRepaired)await replayTradeJournal(client,stateVersionTs);
      const scienceRebuilt=rebuildScienceFromDetailedLedger(peerRestoredNow?'peer-restore':fullRestored?'full-restore':'critical-or-journal-restore');
      if(peerRestoredNow||!fullRestored||journalRepaired||scienceRebuilt)await reseedCanonicalFullSnapshot(client,peerRestoredNow?'peer-newest':journalRepaired?'journal-repair':scienceRebuilt?'science-ledger-rebuild':'critical-recovery');
      try{
        const ar=await client.query("SELECT payload,updated_at FROM pump_lab_state WHERE id='archive:season2-2026-10-01'");
        if(ar.rows[0]?.payload){archiveMonsterExportCache=buildArchiveMonsterExport(ar.rows[0].payload,ar.rows[0].updated_at);console.log('ARCHIVE_MONSTER_CACHE '+JSON.stringify(archiveMonsterExportCache.counts));}
      }catch(e){console.warn('Archive monster preload warning:',e.message);}
      if(db!==client)throw new Error('Postgres disconnected during restore');
      if(RESET_SEASON)await archiveAndResetSeason(RESET_SEASON);
      dbStateRestored=true;lastDurableRestoreAt=now();
      console.log('STATE_LOCK unlocked · Postgres connected');
      logStrategyDiagnostics();
    }
    if(db!==client)throw new Error('Postgres disconnected before readiness');
    setHealth('research-memory','ok','Postgres durable memory online · failover armed',{truth:'observed'});
    if(lifecyclePhase==='DEGRADED'&&!shuttingDown&&durableTradingReady()&&systemPressure!=='CRITICAL')setLifecycle('READY','Postgres reconnected');
    console.log('Postgres durable memory online');
    if(pendingTradeJournal.length)await flushTradeJournal(db);
    validateStateIntegrity({repair:true});
    if(stateVersionTs)await saveCritical();
  }catch(e){
    if(db===client)db=null;
    try{await client?.end();}catch{}
    const msg=String(e?.message||e);lastDbFailure=msg;dbReconnectAttempt++;
    const dnsFailure=/ENOTFOUND|EAI_AGAIN|ECONNREFUSED|timeout/i.test(msg);
    const backoff=dnsFailure?Math.min(DB_RECONNECT_MAX_MS,30000*Math.pow(2,Math.min(4,dbReconnectAttempt-1))):Math.min(DB_RECONNECT_MAX_MS,5000*Math.pow(2,Math.min(6,dbReconnectAttempt-1)));
    dbDisabledUntil=now()+backoff;
    if(pendingDbEvents.length>250){const drop=pendingDbEvents.length-250;pendingDbEvents.splice(0,drop);backpressureDrops.dbEvents+=drop;}
    setHealth('research-memory','warn','Postgres unavailable · failover active · next retry in '+Math.ceil(backoff/1000)+'s: '+msg,{truth:'observed'});
    console.warn('POSTGRES_BACKOFF '+JSON.stringify({attempt:dbReconnectAttempt,backoffMs:backoff,error:msg}));
    scheduleDbReconnect(backoff);
  }finally{dbConnecting=false;}
}
async function tryPeerRecovery(){
  if(!PEER_RECOVERY_URLS.length)return false;
  lastPeerAttemptAt=now();const started=now(),errors=[];
  for(const url of PEER_RECOVERY_URLS){
    const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),PEER_RECOVERY_TIMEOUT_MS),peerStarted=now();
    try{
      const r=await fetch(url,{headers:{accept:'application/json','cache-control':'no-cache','user-agent':'pump-lab-peer-recovery/2.0'},cache:'no-store',signal:controller.signal});
      if(!r.ok){
        const retryAfter=Number(r.headers.get('retry-after')||0);
        errors.push({url,error:'HTTP '+r.status,retryAfter});
        console.warn('PEER_RECOVERY_SOURCE_FAILED '+JSON.stringify({url,status:r.status,elapsedMs:now()-peerStarted}));
        continue;
      }
      const j=await r.json(),state=j?.state||j,ts=num(state?.stateMeta?.savedAt)||num(j?.savedAt)||0;
      const ageMs=now()-ts;
      if(!ts||ageMs>PEER_RECOVERY_MAX_AGE_MS){
        errors.push({url,error:'stale '+Math.max(0,ageMs)+'ms'});
        console.warn('PEER_RECOVERY_SOURCE_FAILED '+JSON.stringify({url,error:'stale',ageMs,elapsedMs:now()-peerStarted}));
        continue;
      }
      const restored=restoreCriticalFromSource(state,'peer',ts);
      peerFailureCount=0;peerRetryNotBefore=0;
      if(restored){
        setHealth('recovery-peer','ok','Redundant recovery peer accepted',{truth:'observed'});
        console.log('PEER_RECOVERY_ACCEPTED '+JSON.stringify({url,savedAt:ts,ageMs:now()-ts,fetchMs:now()-peerStarted,totalMs:now()-started,stateVersionTs}));
      }else console.warn('PEER_RECOVERY_NOT_APPLIED '+JSON.stringify({url,savedAt:ts,ageMs:now()-ts,fetchMs:now()-peerStarted,stateVersionTs}));
      return restored;
    }catch(e){
      const msg=String(e?.name==='AbortError'?'timeout after '+PEER_RECOVERY_TIMEOUT_MS+'ms':e?.message||e);
      errors.push({url,error:msg});
      console.warn('PEER_RECOVERY_SOURCE_FAILED '+JSON.stringify({url,elapsedMs:now()-peerStarted,error:msg}));
    }finally{clearTimeout(timer);}
  }
  peerFailureCount++;
  const retryAfterSec=Math.max(0,...errors.map(x=>Number(x.retryAfter||0)));
  const cooldownMs=Math.max(30000,retryAfterSec>0?retryAfterSec*1000:Math.min(300000,30000*Math.pow(2,Math.min(3,peerFailureCount-1))));
  peerRetryNotBefore=now()+cooldownMs;
  const msg=errors.map(x=>x.url+': '+x.error).join(' | ')||'all recovery peers unavailable';
  setHealth('recovery-peer','warn','All recovery peers unavailable: '+msg,{truth:'observed'});
  console.warn('PEER_RECOVERY_FAILED '+JSON.stringify({urls:PEER_RECOVERY_URLS,elapsedMs:now()-started,error:msg,failureCount:peerFailureCount,retryAt:peerRetryNotBefore}));
  return false;
}
async function waitForInitialDurableRestore(maxMs=90000){
  if(!DATABASE_URL&&!REDIS_URL&&!PEER_RECOVERY_URL)return true;
  const deadline=now()+maxMs;
  while(!(dbStateRestored||kvStateRestored||localStateRestored||peerStateRestored)&&now()<deadline){
    if(REDIS_URL&&!kvReady&&!kvConnecting)await initKv(true);
    if(PEER_RECOVERY_URL&&now()>=peerRetryNotBefore&&now()-lastPeerAttemptAt>=5000)await tryPeerRecovery();
    if(dbStateRestored||kvStateRestored||localStateRestored||peerStateRestored)break;
    await new Promise(r=>setTimeout(r,1000));
  }
  if(dbStateRestored||kvStateRestored||localStateRestored||peerStateRestored)return true;
  console.error('FATAL_STATE_RESTORE_TIMEOUT · refusing to serve fresh defaults');
  return false;
}

function serialize(){reconcileAuthoritativeExperimentState({repair:true,source:'serialize'});return{stateMeta:{version:6,authority:STATE_AUTHORITY_VERSION,savedAt:now(),era:STRATEGY_ERA,exitCount:currentExitTotal(),tradeCount:trades.length},auditVersion:AUDIT_VERSION,season:seasonInfo,forensicLedgerGaps,forensicRecovery,alphaOS:alphaOS.serialize(),science:science.serialize(),strategies:strategyDefs.map(stripTrader),challengers:challengers.map(stripTrader),positions:positions.filter(p=>!p.closed),trades,activity,decisions,opportunities:[...opportunities],research,timeline,replayFrames,autopsies,promotions,graveyard,walletEvents:walletEvents.slice(0,1200),marketEvents:marketEvents.slice(-1000),discoveryLedger:discoveryLedger.slice(-1500),dnaArchive:[...dnaArchive],creators:[...creators].map(([k,v])=>[k,{...v,tokens:[...v.tokens]}])};}
function stripTrader(d){return{id:d.id,name:d.name,icon:d.icon,risk:d.risk,type:d.type,parentId:d.parentId,mutation:d.mutation,auto:d.auto,bornAt:d.bornAt,cash:d.cash,peak:d.peak,dd:d.dd,auditPeak:d.auditPeak,auditDd:d.auditDd,wins:d.wins,losses:d.losses,n:d.n,version:d.version,min:d.min,stop:d.stop,take:d.take,size:d.size,maxOpen:d.maxOpen,riskCap:d.riskCap,exitMode:d.exitMode,sizeBias:d.sizeBias,promotionCandidateAt:d.promotionCandidateAt,promotedAt:d.promotedAt,graveyardAt:d.graveyardAt,hypothesisCandidateAt:d.hypothesisCandidateAt,hypothesisRetiredAt:d.hypothesisRetiredAt,hypothesisReason:d.hypothesisReason};}
function criticalRecoveryTrades(){
  const seasonStart=num(seasonInfo?.startedAt)||0,primaryIds=new Set(strategyDefs.map(d=>d.id)),picked=[],seen=new Set();
  const add=t=>{if(!t||picked.length>=250)return;if(t.id&&seen.has(t.id))return;picked.push(t);if(t.id)seen.add(t.id);};
  // Preserve every clean-season strategy/control trade first so high-volume R&D samplers cannot crowd out the experiment ledger.
  for(const t of trades)if(primaryIds.has(t.strategy)&&num(t.closedAt)>=seasonStart)add(t);
  for(const t of trades)if(primaryIds.has(t.strategy))add(t);
  for(const t of trades)add(t);
  return picked.slice(0,250);
}
function serializeCritical(){reconcileAuthoritativeExperimentState({repair:true,source:'serialize-critical'});return{stateMeta:{version:6,authority:STATE_AUTHORITY_VERSION,savedAt:now(),era:STRATEGY_ERA,scope:'critical',exitCount:currentExitTotal(),tradeCount:trades.length},season:seasonInfo,forensicLedgerGaps,forensicRecovery,scienceEvidence:science.serializeCriticalEvidence(),alphaCritical:alphaOS.serializeCritical(),strategies:strategyDefs.map(stripTrader),challengers:challengers.map(stripTrader),positions:positions.filter(p=>!p.closed),trades:criticalRecoveryTrades(),decisions:decisions.filter(x=>x.era===STRATEGY_ERA).slice(0,Math.min(750,MAX_DECISIONS)),activity:activity.slice(0,80),autopsies:autopsies.slice(0,80)};}
function restoreCritical(s){try{
  if(!s||typeof s!=='object')return false;if(s.season)seasonInfo={...seasonInfo,...s.season};
  if(s.forensicLedgerGaps)forensicLedgerGaps={...forensicLedgerGaps,...s.forensicLedgerGaps};
  if(s.forensicRecovery)forensicRecovery={...forensicRecovery,...s.forensicRecovery};
  if(s.scienceEvidence)science.restoreCriticalEvidence(s.scienceEvidence);
  if(s.alphaCritical)alphaOS.restoreCritical(s.alphaCritical);
  for(const x of s.strategies||[]){const d=strategyDefs.find(q=>q.id===x.id);if(!d)continue;for(const k of ['cash','peak','dd','auditPeak','auditDd','wins','losses','n','promotionCandidateAt','promotedAt','graveyardAt','bornAt','auto','hypothesisCandidateAt','hypothesisRetiredAt','hypothesisReason'])if(x[k]!==undefined)d[k]=x[k];}
  for(const x of s.challengers||[]){const d=challengers.find(q=>q.id===x.id);if(!d)continue;for(const k of ['cash','peak','dd','wins','losses','n','promotedAt','graveyardAt','bornAt','auto'])if(x[k]!==undefined)d[k]=x[k];}
  if(Array.isArray(s.positions))positions.splice(0,positions.length,...s.positions.filter(p=>!p.closed));
  if(Array.isArray(s.trades)){const seen=new Set(),merged=[];for(const t of [...s.trades,...trades]){const k=t?.id||[t?.strategy,t?.mint,t?.opened,t?.closedAt].join(':');if(seen.has(k))continue;seen.add(k);merged.push(t);}trades.splice(0,trades.length,...merged.slice(0,MAX_TRADES));}
  if(Array.isArray(s.decisions)&&s.decisions.length){const seen=new Set(),merged=[];for(const x of [...s.decisions,...decisions]){const k=[x?.era,x?.strategy,x?.mint,x?.ts,x?.action].join(':');if(seen.has(k))continue;seen.add(k);merged.push(x);}decisions.splice(0,decisions.length,...merged.slice(0,MAX_DECISIONS));entryPolicyCache.clear();}
  if(Array.isArray(s.activity)&&s.activity.length)activity.splice(0,activity.length,...s.activity,...activity.filter(x=>!s.activity.some(y=>y.ts===x.ts&&y.text===x.text)).slice(0,MAX_ACTIVITY-s.activity.length));
  if(Array.isArray(s.autopsies)&&s.autopsies.length)autopsies.splice(0,autopsies.length,...s.autopsies,...autopsies.filter(x=>!s.autopsies.some(y=>y.id&&y.id===x.id)).slice(0,250-s.autopsies.length));
  return true;
}catch(e){console.warn('Critical state restore warning:',e.message);return false;}}
function recoveryExitTotal(s){return[...(s?.strategies||[]),...(s?.challengers||[])].reduce((z,x)=>z+Math.max(0,num(x?.n)),0);}
function currentExitTotal(){return allTraders().reduce((z,d)=>z+Math.max(0,num(d?.n)),0);}
function recoverySeasonKey(s){return String(s?.season?.archiveId||s?.season?.label||'');}
function sameSeasonRecovery(s){const a=recoverySeasonKey(s),b=String(seasonInfo?.archiveId||seasonInfo?.label||'');return !a||!b||a===b;}
function recoveryMetricsFromState(s){
  const prodIds=new Set(strategyDefs.filter(d=>d.risk!=='CONTROL'&&!d.specialist).map(d=>d.id)),strategyN={};
  for(const x of [...(s?.strategies||[]),...(s?.challengers||[])])if(x?.id)strategyN[x.id]=Math.max(0,num(x.n));
  const productionExits=(s?.strategies||[]).filter(x=>prodIds.has(x.id)).reduce((z,x)=>z+Math.max(0,num(x.n)),0);
  const detailed=Array.isArray(s?.trades)?s.trades.length:Math.max(0,num(s?.stateMeta?.tradeCount));
  const recovered=Math.max(0,num(s?.forensicLedgerGaps?.total));
  return{seasonKey:recoverySeasonKey(s),ledgerRows:detailed+recovered,productionExits,exitTotal:recoveryExitTotal(s),strategyN};
}
function currentRecoveryMetrics(){
  const prodIds=new Set(strategyDefs.filter(d=>d.risk!=='CONTROL'&&!d.specialist).map(d=>d.id)),strategyN=Object.fromEntries(allTraders().map(d=>[d.id,Math.max(0,num(d.n))]));
  return{seasonKey:String(seasonInfo?.archiveId||seasonInfo?.label||''),ledgerRows:trades.length+Math.max(0,num(forensicLedgerGaps.total)),productionExits:strategyDefs.filter(d=>prodIds.has(d.id)).reduce((z,d)=>z+Math.max(0,num(d.n)),0),exitTotal:currentExitTotal(),strategyN};
}
function applyRecoveryHighWater(h,source='unknown'){
  if(!h||typeof h!=='object')return false;const incomingKey=String(h.seasonKey||''),currentKey=String(recoveryHighWater.seasonKey||'');
  if(currentKey&&incomingKey&&incomingKey!==currentKey)return false;
  if(!recoveryHighWater.seasonKey&&incomingKey)recoveryHighWater.seasonKey=incomingKey;
  recoveryHighWater.ledgerRows=Math.max(num(recoveryHighWater.ledgerRows),num(h.ledgerRows));
  recoveryHighWater.productionExits=Math.max(num(recoveryHighWater.productionExits),num(h.productionExits));
  recoveryHighWater.exitTotal=Math.max(num(recoveryHighWater.exitTotal),num(h.exitTotal));
  recoveryHighWater.strategyN=recoveryHighWater.strategyN||{};
  for(const [id,n] of Object.entries(h.strategyN||{}))recoveryHighWater.strategyN[id]=Math.max(num(recoveryHighWater.strategyN[id]),num(n));
  recoveryHighWater.updatedAt=Math.max(num(recoveryHighWater.updatedAt),num(h.updatedAt));recoveryHighWater.source=source||h.source||recoveryHighWater.source;
  return true;
}
function recoveryHighWaterAllows(s,source='unknown'){
  if(!s||typeof s!=='object')return false;const m=recoveryMetricsFromState(s),same=!m.seasonKey||!recoveryHighWater.seasonKey||m.seasonKey===recoveryHighWater.seasonKey;
  if(!same)return true;
  const reasons=[],critical=s?.stateMeta?.scope==='critical';
  // Critical checkpoints intentionally retain a bounded detailed ledger. Judge
  // them by strategy counters, not historical row count. Full snapshots must
  // still satisfy the detailed-ledger high-water.
  if(!critical&&num(recoveryHighWater.ledgerRows)>0&&m.ledgerRows<num(recoveryHighWater.ledgerRows))reasons.push('ledger '+m.ledgerRows+' < '+recoveryHighWater.ledgerRows);
  if(num(recoveryHighWater.productionExits)>0&&m.productionExits<num(recoveryHighWater.productionExits))reasons.push('production '+m.productionExits+' < '+num(recoveryHighWater.productionExits));
  for(const [id,n] of Object.entries(recoveryHighWater.strategyN||{})){if(num(n)>0&&num(m.strategyN?.[id])<num(n)){reasons.push(id+' '+num(m.strategyN?.[id])+' < '+num(n));if(reasons.length>=5)break;}}
  if(reasons.length){console.warn('RECOVERY_HIGH_WATER_REJECTED '+JSON.stringify({source,critical,seasonKey:m.seasonKey,ledgerRows:m.ledgerRows,productionExits:m.productionExits,reasons}));return false;}
  return true;
}
function advanceRecoveryHighWater(source='runtime'){
  const m=currentRecoveryMetrics(),same=!recoveryHighWater.seasonKey||!m.seasonKey||m.seasonKey===recoveryHighWater.seasonKey;
  if(!same)return false;
  applyRecoveryHighWater({...m,updatedAt:now()},source);return true;
}
function restoreCriticalFromSource(s,source,sourceTs=0){
  const ts=num(s?.stateMeta?.savedAt)||num(sourceTs)||0,incomingExits=recoveryExitTotal(s),currentExits=currentExitTotal();
  if(!recoveryHighWaterAllows(s,source))return false;
  if(stateVersionTs&&ts&&ts<stateVersionTs){
    console.warn('CRITICAL_STATE_VERSION_REGRESSION_REJECTED '+JSON.stringify({source,savedAt:ts,current:stateVersionTs,incomingExits,currentExits}));
    return false;
  }
  // Timestamp + same-season high-water are the authority. A newer critical
  // checkpoint must not be rejected because an older full snapshot happens to
  // contain larger aggregate counters or more historical rows.
  if(!restoreCritical(s))return false;stateVersionTs=Math.max(stateVersionTs,ts);markRestoreSource(source);reconcileAuthoritativeExperimentState({repair:true,source:'critical:'+source});console.log('CRITICAL_STATE_RESTORE '+JSON.stringify({source,savedAt:ts,current:stateVersionTs,trades:trades.length,open:positions.length,exits:currentExitTotal(),authority:STATE_AUTHORITY_VERSION}));return true;
}
function restoreCriticalIfNewer(s,sourceTs=0){return restoreCriticalFromSource(s,'postgres',sourceTs);}
function restore(s){try{if(s.season)seasonInfo={...seasonInfo,...s.season};if(s.forensicLedgerGaps)forensicLedgerGaps={...forensicLedgerGaps,...s.forensicLedgerGaps};if(s.forensicRecovery)forensicRecovery={...forensicRecovery,...s.forensicRecovery};alphaOS.restore(s.alphaOS);science.restore(s.science);
  for(const x of s.strategies||[]){
    const d=strategyDefs.find(q=>q.id===x.id);if(!d)continue;
    const codeVersion=num(d.version)||1;
    for(const k of ['cash','peak','dd','auditPeak','auditDd','wins','losses','n','promotionCandidateAt','promotedAt','graveyardAt','bornAt','auto','hypothesisCandidateAt','hypothesisRetiredAt','hypothesisReason'])if(x[k]!==undefined)d[k]=x[k];
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
  positions.splice(0,positions.length,...(s.positions||[]).filter(p=>!p.closed));trades.splice(0,trades.length,...(s.trades||[]));activity.splice(0,activity.length,...(s.activity||[]));decisions.splice(0,decisions.length,...(s.decisions||[]));opportunities.clear();for(const [k,v] of s.opportunities||[])opportunities.set(k,v);rebuildOpportunityIndex();pruneOpportunities();research=s.research||research;timeline.splice(0,timeline.length,...(s.timeline||[]));replayFrames.splice(0,replayFrames.length,...(s.replayFrames||[]));autopsies.splice(0,autopsies.length,...(s.autopsies||[]));promotions.splice(0,promotions.length,...(s.promotions||[]));graveyard.splice(0,graveyard.length,...(s.graveyard||[]));walletEvents.splice(0,walletEvents.length,...(s.walletEvents||[]));marketEvents.splice(0,marketEvents.length,...(s.marketEvents||[]));discoveryLedger.splice(0,discoveryLedger.length,...(s.discoveryLedger||[]));discoveryFirstByMint.clear();for(const x of discoveryLedger)if(x?.mint)discoveryFirstByMint.set(x.mint,x);dnaArchive.clear();for(const [k,v] of s.dnaArchive||[])dnaArchive.set(k,v);creators.clear();for(const [k,v] of s.creators||[])creators.set(k,{...v,tokens:new Set(v.tokens||[])});
}catch(e){console.warn('State restore warning:',e.message)}finally{reconcileAuthoritativeExperimentState({repair:true,source:'full-restore'});}}
function drainDbWrites(){
  if(dbWriteBusy)return;const item=dbWriteHigh.shift()||dbWriteNormal.shift()||dbWriteLow.shift();if(!item)return;
  dbWriteBusy=true;
  Promise.resolve().then(item.fn).then(item.resolve,item.reject).finally(()=>{dbWriteBusy=false;queueMicrotask(drainDbWrites);});
}
function queueDbWrite(fn,priority='normal'){
  return new Promise((resolve,reject)=>{
    const item={fn,resolve,reject,ts:now()};
    (priority==='high'?dbWriteHigh:priority==='low'?dbWriteLow:dbWriteNormal).push(item);
    drainDbWrites();
  });
}
function traderJournalSnapshot(d){return{id:d.id,cash:d.cash,peak:d.peak,dd:d.dd,auditPeak:d.auditPeak,auditDd:d.auditDd,wins:d.wins,losses:d.losses,n:d.n};}
function applyTraderJournalSnapshot(x){if(!x?.id)return;const d=allTraders().find(q=>q.id===x.id);if(!d)return;for(const k of ['cash','peak','dd','auditPeak','auditDd','wins','losses','n'])if(Number.isFinite(Number(x[k])))d[k]=Number(x[k]);}
function queueTradeJournal(kind,d,p,t,extra={}){
  if(!p?.id||!d?.id)return;
  const ts=now(),eventId=kind+':'+p.id+':'+(kind==='PARTIAL'?String(p.partialExits?.at(-1)?.ts||ts):kind==='SELL'?String(p.closedAt||ts):String(p.opened||ts));
  const terminal=kind==='SELL'||kind==='VOID';
  const row={eventId,ts,kind,strategy:d.id,mint:p.mint,trader:traderJournalSnapshot(d),position:terminal?null:{...p},trade:kind==='SELL'?{...p,name:t?.name||p.name||'',narrative:t?.narrative||p.narrative||''}:null,extra};
  pendingTradeJournal.push(row);if(pendingTradeJournal.length>1000){pendingTradeJournal.shift();backpressureDrops.journal++;}
  if(db)queueDbWrite(()=>flushTradeJournal(db),'high').catch(()=>{});
}
async function flushTradeJournal(client=db){
  if(!client||!pendingTradeJournal.length)return 0;const batch=pendingTradeJournal.splice(0,Math.min(200,pendingTradeJournal.length));
  try{
    await client.query("INSERT INTO pump_lab_trade_journal(event_id,ts,kind,strategy,mint,payload) SELECT x->>'eventId',(x->>'ts')::bigint,x->>'kind',x->>'strategy',x->>'mint',x FROM jsonb_array_elements($1::jsonb) x ON CONFLICT(event_id) DO NOTHING",[JSON.stringify(batch)]);
    lastTradeJournalFlush=now();journalEventsWritten+=batch.length;return batch.length;
  }catch(e){pendingTradeJournal.unshift(...batch);pendingTradeJournal.splice(1000);throw e;}
}
function validateStateIntegrity({repair=true}={}){
  const issues=[],seenPos=new Set(),seenTrades=new Set(),cleanPos=[],cleanTrades=[];
  for(const p of positions){if(!p||!p.id||p.closed){issues.push('invalid/closed open position');continue;}if(seenPos.has(p.id)){issues.push('duplicate position '+p.id);continue;}if(!allTraders().some(d=>d.id===p.strategy)){issues.push('orphan position '+p.id);continue;}seenPos.add(p.id);cleanPos.push(p);}
  for(const t of trades){if(!t||!t.id){issues.push('trade missing id');continue;}if(seenTrades.has(t.id)){issues.push('duplicate trade '+t.id);continue;}seenTrades.add(t.id);cleanTrades.push(t);}
  let serious=false;for(const d of allTraders()){if(!Number.isFinite(Number(d.cash))||Number(d.cash)<0){issues.push('invalid cash '+d.id);serious=true;}markEquity(d);if(!Number.isFinite(Number(d.equity))){issues.push('invalid equity '+d.id);serious=true;}}
  if(repair){positions.splice(0,positions.length,...cleanPos);trades.splice(0,trades.length,...cleanTrades.slice(0,MAX_TRADES));}
  stateIntegrityOk=!serious;lastIntegrityReport={ts:now(),ok:!serious,repaired:repair,issues:issues.slice(0,50),positions:positions.length,trades:trades.length};
  if(issues.length)console.warn('STATE_INTEGRITY '+JSON.stringify(lastIntegrityReport));else console.log('STATE_INTEGRITY '+JSON.stringify(lastIntegrityReport));
  return stateIntegrityOk;
}
function journalRegressionCutoff(rows){
  const maxN=new Map();let cutoff=0;
  for(const row of rows){
    const e=row.payload||{},id=e?.trader?.id||row.strategy,n=Number(e?.trader?.n);
    if(!id||!Number.isFinite(n))continue;
    const prev=maxN.get(id);
    if(Number.isFinite(prev)&&n<prev){cutoff=num(row.ts);break;}
    maxN.set(id,Math.max(Number.isFinite(prev)?prev:0,n));
  }
  return cutoff;
}
async function repairCurrentSeasonFromJournal(client=db){
  if(!client)return false;
  try{
    const ar=await client.query("SELECT payload,updated_at FROM pump_lab_state WHERE id='archive:season2-2026-10-01'");
    const archive=ar.rows[0]?.payload||null,seasonStart=num(archive?.archivedAt)||new Date(ar.rows[0]?.updated_at||0).getTime()||0;
    if(!seasonStart)return false;
    const jr=await client.query("SELECT event_id,ts,kind,strategy,payload FROM pump_lab_trade_journal WHERE ts>$1 ORDER BY ts ASC LIMIT 10000",[seasonStart]);
    const allRows=jr.rows||[],cutoff=journalRegressionCutoff(allRows),rows=cutoff?allRows.filter(x=>num(x.ts)<cutoff):allRows;
    const sellRows=rows.filter(x=>x.kind==='SELL'&&x.payload?.trade?.id),uniqueSellIds=new Set(sellRows.map(x=>x.payload.trade.id));
    const journalExits=uniqueSellIds.size,currentExits=currentExitTotal();
    console.log('TRADE_JOURNAL_AUDIT '+JSON.stringify({seasonStart,rows:allRows.length,authoritativeRows:rows.length,journalExits,currentExits,regressionCutoff:cutoff||null}));
    if(journalExits<RECOVERY_MIN_EXITS||journalExits<currentExits+JOURNAL_REPAIR_MIN_GAP)return false;

    const traderSnapshots=new Map(),posMap=new Map(),tradeMap=new Map();
    for(const row of rows){
      const e=row.payload||{},snap=e.trader;
      if(snap?.id){
        const prior=traderSnapshots.get(snap.id),pn=num(prior?.n),nn=num(snap.n);
        if(!prior||nn>=pn)traderSnapshots.set(snap.id,{...snap,_ts:num(row.ts)});
      }
      if(row.kind==='BUY'||row.kind==='PARTIAL'){
        const p=e.position;if(p?.id&&!tradeMap.has(p.id))posMap.set(p.id,p);
      }else if(row.kind==='SELL'){
        const tr=e.trade;if(tr?.id){posMap.delete(tr.id);tradeMap.set(tr.id,tr);}
      }else if(row.kind==='VOID'){
        const id=e.extra?.positionId||e.extra?.id;if(id)posMap.delete(id);
      }
    }
    const baseline=FORENSIC_BASELINE,baselineTs=num(baseline?.capturedAtMs),useBaseline=!!baseline&&baselineTs>seasonStart&&baselineTs<(cutoff||Infinity);
    for(const d of allTraders())resetTraderRuntime(d);
    if(useBaseline){
      for(const b of baseline.traders||[]){
        const d=allTraders().find(x=>x.id===b.id);if(!d)continue;
        d.cash=num(b.cash);d.n=num(b.n);d.wins=num(b.wins);d.losses=num(b.losses);d.peak=Math.max(START,num(b.equity),d.cash);d.auditPeak=d.peak;d.dd=0;d.auditDd=0;
      }
      for(const row of rows.filter(x=>num(x.ts)>baselineTs)){
        const snap=row.payload?.trader,d=snap?.id&&allTraders().find(x=>x.id===snap.id);
        if(d&&num(snap.n)>=num(d.n))applyTraderJournalSnapshot(snap);
      }
    }else{
      for(const snap of traderSnapshots.values())applyTraderJournalSnapshot(snap);
    }
    const rebuiltTrades=[...tradeMap.values()].sort((a,b)=>num(b.closedAt)-num(a.closedAt)).slice(0,MAX_TRADES);
    const rebuiltPositions=[...posMap.values()].filter(p=>p&&!p.closed);
    trades.splice(0,trades.length,...rebuiltTrades);positions.splice(0,positions.length,...rebuiltPositions);
    for(const d of allTraders())markEquity(d);

    if(useBaseline){
      const prodIds=new Set(strategyDefs.filter(d=>d.risk!=='CONTROL'&&!d.specialist).map(d=>d.id)),cohortIds=new Set(specialistStrategies().map(d=>d.id)),controlIds=new Set(strategyDefs.filter(d=>d.risk==='CONTROL').map(d=>d.id));
      const countCats=ts=>{let production=0,cohort=0,control=0,other=0;for(const t of ts){if(prodIds.has(t.strategy))production++;else if(cohortIds.has(t.strategy))cohort++;else if(controlIds.has(t.strategy))control++;else other++;}return{production,cohort,control,other,total:ts.length};};
      const preBaseline=[...tradeMap.values()].filter(t=>num(t.closedAt)<=baselineTs),detailBase=countCats(preBaseline),b=baseline.dashboard||{};
      forensicLedgerGaps={
        total:Math.max(0,num(b.ledgerRows)-detailBase.total),
        production:Math.max(0,num(b.ledgerProductionRows)-detailBase.production),
        cohort:Math.max(0,num(b.cohortRows)-detailBase.cohort),
        control:Math.max(0,num(b.controlRows)-detailBase.control),
        other:Math.max(0,num(b.otherRows)-detailBase.other),
        baselineAt:baselineTs,source:'Render observed pre-incident checkpoint'
      };
    }
    forensicRecovery={active:true,lastRepairAt:now(),regressionCutoff:cutoff||0,journalRows:rows.length,detailedTrades:rebuiltTrades.length,observedLedgerRows:rebuiltTrades.length+num(forensicLedgerGaps.total)};
    if(archive){seasonInfo={label:archive.label||'season2-2026-10-01',startedAt:seasonStart,archiveId:'archive:season2-2026-10-01',resetApplied:true};}
    science.rebuildFromTradeLedger(rebuiltTrades);
    stateVersionTs=now();journalReplayedAt=stateVersionTs;validateStateIntegrity({repair:true});
    console.warn('TRADE_JOURNAL_REPAIR '+JSON.stringify({restoredDetailedTrades:trades.length,observedLedgerRows:forensicRecovery.observedLedgerRows,aggregateRecoveredRows:forensicLedgerGaps.total,restoredOpen:positions.length,restoredExits:currentExitTotal(),regressionCutoff:cutoff||null,baselineAt:useBaseline?baselineTs:null,rows:rows.length}));
    return true;
  }catch(e){console.warn('Trade journal repair warning:',e.message);return false;}
}
async function replayTradeJournal(client=db,afterTs=0){
  if(!client)return 0;const r=await client.query("SELECT event_id,ts,kind,payload FROM pump_lab_trade_journal WHERE ts>$1 ORDER BY ts ASC LIMIT 5000",[Math.max(0,num(afterTs))]);let applied=0,maxTs=afterTs;
  for(const row of r.rows){const e=row.payload||{};maxTs=Math.max(maxTs,num(row.ts));
    const current=allTraders().find(q=>q.id===e?.trader?.id);if(!current||num(e?.trader?.n)>=num(current.n))applyTraderJournalSnapshot(e.trader);
    if(row.kind==='BUY'||row.kind==='PARTIAL'){const p=e.position;if(p?.id&&!trades.some(t=>t.id===p.id)){const i=positions.findIndex(x=>x.id===p.id);if(i>=0)positions[i]=p;else positions.push(p);applied++;}}
    if(row.kind==='SELL'){const tr=e.trade;if(tr?.id){const i=positions.findIndex(x=>x.id===tr.id);if(i>=0)positions.splice(i,1);if(!trades.some(t=>t.id===tr.id)){trades.unshift(tr);applied++;}}}
    if(row.kind==='VOID'){const id=e.extra?.positionId||e.extra?.id;const i=id?positions.findIndex(x=>x.id===id):-1;if(i>=0){positions.splice(i,1);applied++;}}
  }
  if(r.rows.length){stateVersionTs=Math.max(stateVersionTs,maxTs);journalReplayedAt=now();console.log('TRADE_JOURNAL_REPLAY '+JSON.stringify({rows:r.rows.length,applied,afterTs,maxTs}));}
  validateStateIntegrity({repair:true});return applied;
}
async function flushMarketEvents(client=db){
  if(!client||!pendingDbEvents.length)return;const batch=pendingDbEvents.splice(0,Math.min(750,pendingDbEvents.length));
  try{await client.query("INSERT INTO pump_lab_market_events(ts,mint,payload) SELECT (x->>'ts')::bigint,x->>'mint',x FROM jsonb_array_elements($1::jsonb) x",[JSON.stringify(batch)]);lastDbEventFlush=now();}
  catch(e){pendingDbEvents.unshift(...batch);pendingDbEvents.splice(1500);setHealth('research-memory','warn','Event ledger flush failed: '+e.message);throw e;}
}
async function writeLocalAtomic(s){
  try{
    const tmp=STATE_FILE+'.tmp',bak=STATE_FILE+'.bak',json=JSON.stringify(s);
    try{await fs.promises.copyFile(STATE_FILE,bak);}catch(e){if(e?.code!=='ENOENT')console.warn('Local checkpoint backup warning:',e.message);}
    await fs.promises.writeFile(tmp,json);await fs.promises.rename(tmp,STATE_FILE);return true;
  }catch(e){console.warn('Local checkpoint write warning:',e.message);return false;}
}
async function writeLocalCriticalAtomic(s){
  const file=STATE_FILE+'.critical';
  try{
    const tmp=file+'.tmp',bak=file+'.bak',json=JSON.stringify(s);
    try{await fs.promises.copyFile(file,bak);}catch(e){if(e?.code!=='ENOENT')console.warn('Local critical backup warning:',e.message);}
    await fs.promises.writeFile(tmp,json);await fs.promises.rename(tmp,file);return true;
  }catch(e){console.warn('Local critical checkpoint write warning:',e.message);return false;}
}
function restorePinnedOffsite(){
  try{
    const archive=new URL('./recovery/pump-lab-v6-pinned-offsite.json.gz',import.meta.url);
    const snapshot=JSON.parse(gunzipSync(fs.readFileSync(archive)).toString('utf8'));
    const state=snapshot?.state&&typeof snapshot.state==='object'?snapshot.state:snapshot;
    const meta=state?.stateMeta||{},savedAt=Number(meta.savedAt)||0;
    const age=now()-savedAt;
    if(meta.version!==6||meta.authority!==STATE_AUTHORITY_VERSION||meta.era!==STRATEGY_ERA||
       state?.season?.label!==CLEAN_SEASON_LABEL||!Number.isFinite(age)||age<0||age>12*3600000||
       !Array.isArray(state.strategies)||state.strategies.length<50||!Array.isArray(state.trades)){
      console.error('PINNED_OFFSITE_REJECTED invalid, incompatible or older than 12 hours');return false;
    }
    if(Number(meta.exitCount)||0 < currentExitTotal())return false;
    if(!restoreIfNewer(state,'local'))return false;
    emergencyOffsiteRestored=true;emergencyOffsiteSavedAt=savedAt;
    setHealth('pinned-offsite','warn','Validated last-known offsite state restored; all new paper entries locked until Postgres checkpoints',{truth:'observed'});
    console.warn('PINNED_OFFSITE_READ_ONLY '+JSON.stringify({savedAt,ageMin:Math.round(age/60000),trades:trades.length,positions:positions.length,exits:meta.exitCount}));
    return true;
  }catch(e){console.warn('PINNED_OFFSITE_UNAVAILABLE '+String(e?.message||e).slice(0,180));return false;}
}
function loadLocal(){
  let restored=false;
  for(const file of [STATE_FILE,STATE_FILE+'.bak']){
    try{
      if(!fs.existsSync(file))continue;
      const stat=fs.statSync(file),age=now()-stat.mtimeMs;if(age>LOCAL_RECOVERY_MAX_AGE_MS)continue;
      const s=JSON.parse(fs.readFileSync(file,'utf8'));restored=restoreIfNewer(s,'local',stat.mtimeMs)||restored;
    }catch(e){console.warn('Local checkpoint restore warning:',e.message);}
  }
  for(const file of [STATE_FILE+'.critical',STATE_FILE+'.critical.bak']){
    try{
      if(!fs.existsSync(file))continue;
      const stat=fs.statSync(file),age=now()-stat.mtimeMs;if(age>LOCAL_RECOVERY_MAX_AGE_MS)continue;
      const s=JSON.parse(fs.readFileSync(file,'utf8'));restored=restoreCriticalFromSource(s,'local',stat.mtimeMs)||restored;
    }catch(e){console.warn('Local critical restore warning:',e.message);}
  }
  return restored;
}
async function save(){
  if(saveInProgress){saveQueued=true;return;}
  saveInProgress=true;
  try{
    pruneRuntimeMemory();
    advanceRecoveryHighWater('full-save');const s=serialize();stateVersionTs=num(s.stateMeta?.savedAt)||stateVersionTs;await writeLocalAtomic(s);
    if(kvReady&&kv){
      try{await Promise.all([kv.set('pump-lab:state:main',JSON.stringify(s)),kv.set('pump-lab:state:highwater',JSON.stringify(recoveryHighWater))]);lastKvSaveAt=now();setHealth('research-failover','ok','Free Key Value failover synchronized',{truth:'observed'});}
      catch(e){kvReady=false;setHealth('research-failover','warn','Key Value checkpoint failed: '+e.message,{truth:'observed'});initKv(false);}
    }
    if(db){
      try{
        const wrote=await queueDbWrite(async()=>{const client=db;if(!client)return false;await flushMarketEvents(client);await client.query('BEGIN');try{await client.query("INSERT INTO pump_lab_state(id,payload,updated_at) VALUES('main',$1,now()) ON CONFLICT(id) DO UPDATE SET payload=$1,updated_at=now()",[s]);await client.query("INSERT INTO pump_lab_state(id,payload,updated_at) VALUES('main:highwater',$1,now()) ON CONFLICT(id) DO UPDATE SET payload=$1,updated_at=now()",[recoveryHighWater]);await client.query('COMMIT');}catch(e){try{await client.query('ROLLBACK')}catch{}throw e;}return true;},'low');
        if(wrote){lastDurableSaveAt=now();setHealth('research-memory','ok','Postgres durable memory online · failover synchronized',{truth:'observed'});}
      }catch(e){
        setHealth('research-memory','warn','Postgres save failed · failover checkpoint retained: '+e.message,{truth:'observed'});
        const bad=db;db=null;try{await bad?.end();}catch{}scheduleDbReconnect(5000);
      }
    }
  }finally{
    saveInProgress=false;
    if(saveQueued){saveQueued=false;const timer=setTimeout(()=>save(),0);timer.unref?.();}
  }
}

async function saveCritical(){
  if(criticalSaveInProgress){criticalSaveQueued=true;return;}
  criticalSaveInProgress=true;
  try{
    advanceRecoveryHighWater('critical-save');const s=serializeCritical(),savedAt=num(s.stateMeta?.savedAt)||now();stateVersionTs=Math.max(stateVersionTs,savedAt);
    const localOk=await writeLocalCriticalAtomic(s);
    let kvOk=false;
    if(kvReady&&kv){
      try{await Promise.all([kv.set('pump-lab:state:critical',JSON.stringify(s)),kv.set('pump-lab:state:highwater',JSON.stringify(recoveryHighWater))]);kvOk=true;lastKvSaveAt=now();}
      catch(e){kvReady=false;setHealth('research-failover','warn','Critical Key Value checkpoint failed: '+e.message,{truth:'observed'});initKv(false);}
    }
    if(localOk||kvOk)lastCriticalSaveAt=now();
    if(!db){setHealth('research-memory','warn','Postgres critical checkpoint unavailable · local/Key Value emergency checkpoint retained',{truth:'observed'});return;}
    const wrote=await queueDbWrite(async()=>{const client=db;if(!client)return false;await client.query('BEGIN');try{await client.query("INSERT INTO pump_lab_state(id,payload,updated_at) VALUES('main:critical',$1,now()) ON CONFLICT(id) DO UPDATE SET payload=$1,updated_at=now()",[s]);await client.query("INSERT INTO pump_lab_state(id,payload,updated_at) VALUES('main:highwater',$1,now()) ON CONFLICT(id) DO UPDATE SET payload=$1,updated_at=now()",[recoveryHighWater]);await client.query('COMMIT');}catch(e){try{await client.query('ROLLBACK')}catch{}throw e;}return true;},'high');
    if(!wrote)return;lastCriticalSaveAt=now();lastDurableSaveAt=lastCriticalSaveAt;
    setHealth('research-memory','ok','Postgres critical trader state synchronized · emergency checkpoints retained',{truth:'observed'});
  }catch(e){
    setHealth('research-memory','warn','Critical trader checkpoint failed: '+e.message,{truth:'observed'});
    const bad=db;db=null;try{await bad?.end();}catch{}scheduleDbReconnect(5000);
  }finally{
    criticalSaveInProgress=false;
    if(criticalSaveQueued){criticalSaveQueued=false;const timer=setTimeout(()=>saveCritical(),0);timer.unref?.();}
  }
}

function scheduleCriticalSave(delay=750){
  stateVersionTs=Math.max(stateVersionTs,now());if(typeof stateJsonCache==='object')stateJsonCache.ts=0;
  if(criticalSaveTimer)return;
  criticalSaveTimer=setTimeout(()=>{criticalSaveTimer=null;saveCritical();},delay);
  criticalSaveTimer.unref?.();
}

function strategyDiagnostics(){
  return strategyDefs.map(d=>{
    markEquity(d);
    const rows=decisions.filter(x=>x.strategy===d.id);const rejects=rows.filter(x=>x.action==='REJECT'),buys=rows.filter(x=>x.action==='BUY');
    const scores=rejects.map(x=>num(x.score));const riskVetos=rejects.filter(x=>x.why==='risk veto').length;
    const maxScore=scores.length?Math.max(...scores):null;const avgScore=scores.length?avg(scores):null;
    const ep=entryPolicy(d),h=strategyHealth(d);const near=rejects.filter(x=>num(x.score)>=ep.min-5).length;
    return{id:d.id,name:d.name,postEntryProfile:d.postEntryProfile||null,n:d.n,wins:d.wins,losses:d.losses,open:openCount(d.id),equity:d.equity,pnl:d.equity-START,recentAvg:h.avg,recentN:h.n,threshold:d.min,effectiveMin:ep.min,relief:ep.relief,p90:ep.p90,riskLimit:d.id==='sniper'?ep.sniperRiskLimit:d.risk==='LOW'?ep.lowRiskLimit:ep.customRiskLimit,buys:buys.length,rejects:rejects.length,maxRejectScore:maxScore,avgRejectScore:avgScore,nearMisses:near,riskVetos,cash:d.cash};
  });
}
function logPerformanceSnapshot(){
  allTraders().forEach(markEquity);const core=strategyDefs.filter(d=>d.risk!=='CONTROL'&&!d.specialist),controls=strategyDefs.filter(d=>d.risk==='CONTROL'),spec=specialistStrategies();
  const pack=rows=>({count:rows.length,capital:rows.reduce((a,d)=>a+d.equity,0),start:rows.length*START,pnl:rows.reduce((a,d)=>a+d.equity-START,0),green:rows.filter(d=>d.equity>=START).length,red:rows.filter(d=>d.equity<START).length,trades:rows.reduce((a,d)=>a+d.n,0),open:rows.reduce((a,d)=>a+openCount(d.id),0)});
  console.log('PERFORMANCE_SNAPSHOT '+JSON.stringify({ts:now(),version:'3.3 Alpha OS · Future Lab UI',weather:marketWeather(),core:pack(core),controls:pack(controls),specialists:pack(spec)}));
}
function logStrategyDiagnostics(){
  console.log('STRATEGY_DIAGNOSTICS '+JSON.stringify(strategyDiagnostics()));
}
function coreRejectionSummary(){
  return strategyDefs.filter(d=>d.risk!=='CONTROL'&&!d.specialist&&!d.minuteSampler).map(d=>{
    const rows=decisions.filter(x=>x.era===STRATEGY_ERA&&x.strategy===d.id).slice(0,250),rejects=rows.filter(x=>x.action==='REJECT'),counts={};
    for(const r of rejects){const k=r.why||'unknown';counts[k]=(counts[k]||0)+1;}
    const topReasons=Object.entries(counts).sort((a,b)=>b[1]-a[1]).slice(0,4).map(([reason,n])=>({reason,n}));
    const ep=entryPolicy(d),scores=rejects.map(x=>num(x.score)).filter(Number.isFinite);
    return{id:d.id,name:d.name,buys:rows.filter(x=>x.action==='BUY').length,rejects:rejects.length,effectiveMin:ep.min,relief:ep.relief,p90:ep.p90,maxScore:scores.length?Math.max(...scores):null,topReasons};
  });
}
function logCoreRejectionSummary(){console.log('CORE_REJECTION_SUMMARY '+JSON.stringify({ts:now(),rows:coreRejectionSummary()}));}
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
async function logFullPostmortem(){
  const rows=allTraders(),chunkSize=8;
  for(let i=0;i<rows.length;i+=chunkSize){
    if(shouldDeferNonCritical())return false;
    for(const d of rows.slice(i,i+chunkSize))console.log('TRADER_POSTMORTEM_ITEM '+JSON.stringify(traderPostmortem(d)));
    if(i+chunkSize<rows.length)await new Promise(r=>setImmediate(r));
  }
  return true;
}
function systemAudit(){
  allTraders().forEach(markEquity);
  const open=positions.filter(p=>!p.closed),markDetails=open.map(p=>({p,d:positionMarkDetail(p)})),stale=markDetails.filter(x=>x.d.stale),unexecutable=markDetails.filter(x=>!x.d.executable),duplicateTickers=duplicateTickerAudit(),impossibleLosses=trades.filter(t=>t.policyVersion===STRATEGY_ERA&&t.integrity?.impossibleLoss);
  const providers=providerAudit(),stats=strategyStatistics(),qualified=stats.filter(s=>s.holdoutN>=50&&s.holdoutMean>0&&s.holdoutProfitFactor>1.30&&s.dd<PAPER_MAX_DRAWDOWN_PCT);
  const critical=[],warnings=[],passes=[];
  if((DATABASE_URL||REDIS_URL||PEER_RECOVERY_URL)&&!(dbStateRestored||kvStateRestored||localStateRestored||peerStateRestored))critical.push('no recovery source has restored state');
  if((DATABASE_URL||REDIS_URL||PEER_RECOVERY_URL)&&!durableTradingReady())critical.push('all persistence layers are outside the safe recovery window');
  if(DATABASE_URL&&!db&&(kvReady||peerStateRestored||localStateRestored))warnings.push('Postgres temporarily offline; emergency recovery layers are carrying protected state');
  if(REDIS_URL&&!kvReady&&db)warnings.push('Key Value failover offline; Postgres remains canonical');
  if(unexecutable.length)critical.push(`${unexecutable.length} open positions lack a fresh executable quote; exits are quarantined and never written off`);
  if(impossibleLosses.length)critical.push(`${impossibleLosses.length} new-era trades violated the loss-vs-MAE integrity bound`);
  if(duplicateTickers.length)warnings.push(`${duplicateTickers.length} duplicate ticker symbol(s) observed; mint address remains canonical identity`);
  if(lastStateBuildMs>5000)warnings.push(`dashboard state build is slow at ${lastStateBuildMs} ms`);
  if(lastStateBytes>1500000)warnings.push(`dashboard state payload is large at ${Math.round(lastStateBytes/1024)} KB`);
  if(stale.length)warnings.push(`${stale.length} open positions are using stale-mark haircuts`);
  if(!PUMP_KEY)warnings.push('PumpPortal realtime feed/API key is not connected');
  if(SOLANA_RPC_HTTP.includes('api.mainnet-beta.solana.com')||SOLANA_RPC_HTTP.includes('api.mainnet.solana.com'))warnings.push('using public Solana RPC rather than a production-grade dedicated RPC');
  if(providers.stale?.length)warnings.push('stale providers: '+providers.stale.join(', '));
  if(!qualified.length)warnings.push('no core strategy yet meets minimum holdout profitability evidence');
  if(ALLOW_AUTO_PROMOTION)warnings.push('automatic strategy promotion is enabled');
  if(!SHADOW_EXECUTION_VALIDATED)critical.push('live shadow-execution validation has not been completed');
  const alphaSnap=alphaOS.snapshot(true);
  if(!alphaSnap.shadow.routeQuoteConnected)warnings.push('Alpha OS shadow twin is measuring paper-vs-next-tick execution but exact route quote adapter is not connected');
  passes.push('Alpha OS ten-subsystem decision layer active');passes.push('Season 2 twelve-system science layer active');
  if(dbStateRestored)passes.push('durable state restore verified');
  if(num(recoveryHighWater.ledgerRows)>0)passes.push('same-season monotonic recovery high-water active');
  if(forensicRecovery.active)passes.push('forensic history coverage preserved without synthetic ledger rows');
  if(!ALLOW_AUTO_PROMOTION)passes.push('production strategy auto-promotion disabled');
  passes.push('deterministic 80/20 holdout split active');
  passes.push('dynamic fee + slippage + fixed transaction friction modeled');
  passes.push('strategy drawdown and 24h loss circuits active');
  passes.push('stale marks are quarantined at last verified price; synthetic zero write-offs are disabled');passes.push('mint address is canonical token identity; duplicate tickers are audited separately');passes.push('frozen experiment slate is 6 selective strategies + Random + Every Launch controls until 30+ new-era trades each');
  const liveReady=critical.length===0&&qualified.length>0&&providers.overall>=70&&stale.length===0;
  return{auditVersion:AUDIT_VERSION,status:liveReady?'LIVE GATE PASSED':'PAPER RESEARCH ONLY',liveReady,critical,warnings,passes,
    launchCriteria:{holdoutTrades:50,holdoutMeanPositive:true,holdoutProfitFactorMin:1.30,maxDrawdownPct:PAPER_MAX_DRAWDOWN_PCT,providerHealthMin:70,shadowExecutionRequired:true},
    qualifiedStrategies:qualified.map(x=>({id:x.id,name:x.name,holdoutN:x.holdoutN,holdoutMean:x.holdoutMean,holdoutProfitFactor:x.holdoutProfitFactor,dd:x.dd})),
    runtime:{tokens:tokens.size,openPositions:open.length,stalePositions:stale.length,unexecutablePositions:unexecutable.length,impossibleLosses:impossibleLosses.length,duplicateTickers:duplicateTickers.length,activeExperiment:[...ACTIVE_EXPERIMENT_IDS],freezeMinTrades:FROZEN_EXPERIMENT_MIN_TRADES,opportunities:opportunities.size,stateBytes:lastStateBytes,stateBuildMs:lastStateBuildMs,deepResearchAt:deepResearchCache.ts,deepResearchBuildMs:deepResearchCache.data?.deepResearchBuildMs||0,dbConnected:!!db,tradingUnlocked:durableTradingReady()}};
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
  if(ALLOW_AUTO_PROMOTION)issues.push('governance: auto promotion explicitly enabled');
  if(typeof deterministicScore('selftest')!=='number')issues.push('deterministic control unavailable');
  return{pass:issues.length===0,era:STRATEGY_ERA,auditVersion:AUDIT_VERSION,production:production.length,controls:strategyDefs.filter(d=>d.risk==='CONTROL').length,
    copyModels:strategyDefs.filter(d=>d.copyLab).map(d=>d.id),issues};
}
function logV3SelfTest(){console.log('V3_SELFTEST '+JSON.stringify(v3SelfTest()));}

function emptyDeepResearchSnapshot(){
  return{
    missed:[],saved:[],hall:[],worst:[],autopsies:[],calibration:[],entryLab:{score:[],risk:[],age:[]},
    exitLab:{n:0,actual:0,avgMfe:0,capture:0,oneMin:0,fiveMin:0,fifteenMin:0,leftOnTable:0},sizingLab:[],
    executionLab:{n:0,easyAvg:0,realisticAvg:0,nightmareAvg:0,easyTotal:0,realisticTotal:0,nightmareTotal:0},
    benchmarks:[],godBot:{capture:0,avgAvailable:0,bestTheoretical:null,biggestMiss:null},archetypes:[],
    evolution:{family:[],promotions:[],graveyard:[]},holdTime:[],coalitions:[],correlation:[],regimeMatrix:[],phaseMatrix:[],
    masterAllocation:{regime:'',weights:[]},dynamicAllocation:{regime:'',weights:[]},statistics:[],
    exitOptimizer:{n:0,direction:'COLLECTING'},opportunityCost:{},scientist:[],replayLab:{events:0,archive:0,strategies:[]},
    specialistCohorts:{groups:[],capital:0,start:0,trades:0,open:0,count:0},hypothesisArena:{rows:[],count:0,promising:0,retired:0,collecting:0,capital:0,start:0},walletGraph:{nodes:[],edges:[],clusters:0},
    riskBoard:[],tournament:[],providerAudit:{overall:0,stale:[],rows:[]},noTrade:{n:0,falseRejects:0,correctAvoids:0,falseRejectRate:0,saveRate:0},
    chaos:{n:0,normal:0,doubleFees:0,latencyShock:0,missBest:0,missedTrades:0},walletBoard:[],discoveryLab:{n:0,sources:[]},monsterPatterns:{monsters:0,features:[],timeline:[]},edgeFocus:{count:0,strategies:[]},deepResearchAt:0,deepResearchBuildMs:0
  };
}
let deepResearchCache={ts:0,data:emptyDeepResearchSnapshot(),json:''};
function deepResearchSnapshot(){
  const started=Date.now();
  const data={
    missed:missedMonsters(),saved:savedMyAss(),hall:hallOfFame(),worst:worstTrades(),autopsies:autopsies.slice(0,30),
    calibration:confidenceCalibration(),entryLab:entryLab(),exitLab:exitLab(),sizingLab:sizingLab(),executionLab:executionLab(),
    benchmarks:benchmarkStats(),godBot:godBot(),archetypes:archetypeMemory(),evolution:{family:familyTree(),promotions:promotions.slice(0,20),graveyard:graveyard.slice(0,20)},
    holdTime:holdTimeLab(),coalitions:coalitionStats(),correlation:strategyCorrelation().slice(0,20),regimeMatrix:regimeMatrix(),phaseMatrix:phaseMatrix(),
    masterAllocation:masterAllocation(),dynamicAllocation:dynamicAllocator(),statistics:strategyStatistics(),exitOptimizer:exitOptimizer(),
    opportunityCost:opportunityCostLab(),scientist:scientistInsights(),replayLab:replayLab(),specialistCohorts:specialistCohortStats(),hypothesisArena:hypothesisArenaSnapshot(),
    walletGraph:walletGraphSnapshot(),riskBoard:riskScoreboard(),tournament:tournament(),providerAudit:providerAudit(),noTrade:noTradeAlpha(),memeChartLab:memeChartLabSnapshot(),
    chaos:chaosLab(),walletBoard:walletLeaderboard(),discoveryLab:discoveryLab(),monsterPatterns:monsterPatternLab(),edgeFocus:edgeResearchFocus(),season2Science:science.snapshot(strategyDefs.map(d=>d.id))
  };
  data.deepResearchAt=now();data.deepResearchBuildMs=Date.now()-started;return data;
}
function getDeepResearchJson(){
  if(deepResearchCache.json&&now()-deepResearchCache.ts<300000)return deepResearchCache.json;
  const data=deepResearchSnapshot(),json=JSON.stringify(data);
  deepResearchCache={ts:now(),data,json};
  console.log('DEEP_RESEARCH_SNAPSHOT '+JSON.stringify({bytes:json.length,ms:data.deepResearchBuildMs}));
  return json;
}

function compactAlphaSnapshot(){
  const a=alphaOS.snapshot(true);
  return{version:a.version,subsystems:a.subsystems||[],master:{cash:a.master?.cash||0,equity:a.master?.equity||0,peak:a.master?.peak||0,dd:a.master?.dd||0,open:a.master?.open||0,trades:a.master?.trades||0,proposalCount:a.master?.proposalCount||0},shadow:a.shadow||{},forecasts:{total:a.forecasts?.total||0,settledTrain:a.forecasts?.settledTrain||0,up25Rate:a.forecasts?.up25Rate||0,down15Rate:a.forecasts?.down15Rate||0},wallets:{nodes:a.wallets?.nodes||0,edges:a.wallets?.edges||0},world:{snapshots:a.world?.snapshots||0,settled:a.world?.settled||0,current:a.world?.current||null},execution:a.execution||{},counters:a.counters||{}};
}
function uiResearchSnapshot(){
  const d=deepResearchCache.data||{};
  return{missed:d.missed||[],saved:d.saved||[],hall:d.hall||[],autopsies:d.autopsies||[],calibration:d.calibration||[],entryLab:d.entryLab||{score:[],risk:[],age:[]},exitLab:d.exitLab||{},sizingLab:d.sizingLab||[],executionLab:d.executionLab||{},benchmarks:d.benchmarks||[],godBot:d.godBot||{},archetypes:d.archetypes||[],evolution:d.evolution||{family:[],promotions:[],graveyard:[]},holdTime:d.holdTime||[],coalitions:d.coalitions||[],correlation:d.correlation||[],regimeMatrix:d.regimeMatrix||[],masterAllocation:d.masterAllocation||{regime:'',weights:[]},specialistCohorts:d.specialistCohorts||{groups:[],capital:0,start:0,trades:0,open:0,count:0},hypothesisArena:d.hypothesisArena||{rows:[],count:0,promising:0,retired:0,collecting:0,capital:0,start:0},riskBoard:d.riskBoard||[],tournament:d.tournament||[],providerAudit:d.providerAudit||{overall:0,stale:[],rows:[]},noTrade:d.noTrade||{},chaos:d.chaos||{},walletBoard:d.walletBoard||[],memeChartLab:d.memeChartLab||{traders:[]}};
}
function snapshot(){
  reconcileAuthoritativeExperimentState({repair:true,source:'api-snapshot'});
  allTraders().filter(d=>!isFrozenExperimentStrategy(d)).forEach(markEquity);
  const prod=strategyDefs.filter(d=>d.risk!=='CONTROL'&&!d.specialist),cohort=specialistStrategies(),latestReplay=replayFrames.at(-1),weather=latestReplay?.weather||marketWeather();
  const prodIds=new Set(prod.map(d=>d.id)),cohortIds=new Set(cohort.map(d=>d.id)),controlIds=new Set(strategyDefs.filter(d=>d.risk==='CONTROL').map(d=>d.id));
  const cleanStartedAt=num(seasonInfo?.startedAt)||0,detailedProductionTrades=trades.filter(t=>prodIds.has(t.strategy)).length,detailedCohortTrades=trades.filter(t=>cohortIds.has(t.strategy)).length,detailedControlTrades=trades.filter(t=>controlIds.has(t.strategy)).length,detailedOtherTrades=Math.max(0,trades.length-detailedProductionTrades-detailedCohortTrades-detailedControlTrades),eraDetailedProductionTrades=trades.filter(t=>prodIds.has(t.strategy)&&t.policyVersion===STRATEGY_ERA).length,cleanDetailedProductionTrades=trades.filter(t=>prodIds.has(t.strategy)&&num(t.closedAt)>=cleanStartedAt).length;
  const ledgerProductionTrades=detailedProductionTrades+num(forensicLedgerGaps.production),ledgerCohortTrades=detailedCohortTrades+num(forensicLedgerGaps.cohort),ledgerControlTrades=detailedControlTrades+num(forensicLedgerGaps.control),ledgerOtherTrades=detailedOtherTrades+num(forensicLedgerGaps.other),ledgerTrades=trades.length+num(forensicLedgerGaps.total);
  const active=[...tokens.values()].filter(t=>now()-t.updatedAt<900000).sort((a,b)=>b.updatedAt-a.updatedAt).slice(0,16).map(t=>{
    const f=features(t),con=consensus(t,weather.regime),q=tokenDataQuality(t);
    return{mint:t.mint,symbol:t.symbol,name:t.name,price:t.price,mc:t.mc,liq:t.liq,narrative:t.narrative,creator:t.creator||'',sources:t.sources||[],
      history:(t.history||[]).slice(-24).map(x=>({ts:x.ts,price:x.price})),features:f,detective:detective(t,f),
      consensus:{yes:con.yes,total:con.total,pct:con.pct,weightedPct:con.weightedPct,hardVeto:con.hardVeto,votes:(con.votes||[]).sort((a,b)=>(b.yes-a.yes)||(b.score-a.score)).slice(0,12)},dna:creatorDNA(t),quality:q};
  });
  return{now:now(),startedAt,paperOnly:true,stateAuthority:{version:STATE_AUTHORITY_VERSION,stateVersionTs,season:CLEAN_SEASON_LABEL,audit:lastAuthorityAudit},alphaOS:compactAlphaSnapshot(),profitAccelerator:profitAccelerator.snapshot({strategies:strategyDefs,trades,regime:weather.regime,era:STRATEGY_ERA,correlations:strategyCorrelation(),noTrade:noTradeAlpha()}),executionAssumptions:{fallbackFeeRate:FEE_RATE,fixedTxCostUsd:PAPER_FIXED_TX_COST_USD,feeSource:'pump.fun docs 2026-05-20',maxModeledSlippagePct:8},researchGovernance:{partition:'deterministic 80/20 by mint',learningSet:'train only',autoPromotion:ALLOW_AUTO_PROMOTION,minPromotionTrades:60,minHoldoutTrades:20},stateLock:storageStatus(),mode:'LIVE PAPER + V5.0 SEASON 3 CLEAN EXECUTION + ALPHA OS + AUDITED HOLDOUT RESEARCH',version:'5.0 Season 3 Clean Execution',target:TARGET,weather,providers:[...health.values()],
    summary:{capital:prod.reduce((a,d)=>a+d.equity,0),start:prod.length*START,trades:prod.reduce((a,d)=>a+d.n,0),open:positions.filter(p=>!p.closed&&prod.some(d=>d.id===p.strategy)).length,cohortCapital:cohort.reduce((a,d)=>a+d.equity,0),cohortStart:cohort.length*START,cohortTrades:cohort.reduce((a,d)=>a+d.n,0),cohortOpen:positions.filter(p=>!p.closed&&cohort.some(d=>d.id===p.strategy)).length,tokens:tokens.size,decisions:decisions.length,ledgerTrades,ledgerDetailedTrades:trades.length,ledgerRecoveredAggregateRows:num(forensicLedgerGaps.total),ledgerProductionTrades,ledgerEraProductionTrades:eraDetailedProductionTrades,ledgerCleanProductionTrades:cleanDetailedProductionTrades,ledgerCohortTrades,ledgerControlTrades,ledgerOtherTrades,scienceTrades:num(science.counters?.trades)},
    strategies:strategyDefs.map(d=>{const base=authoritativeStrategyView(d),ep=entryPolicy(d),pb=strategyPlaybook(d),eraTrades=cleanStrategyTrades(d.id);return{...base,winRate:base.n?base.wins/base.n*100:0,open:openCount(d.id),effectiveMin:ep.min,coldStart:ep.coldStart,entryRejects:ep.rejects,thresholdRelief:ep.relief,playbook:pb.instruction,era:STRATEGY_ERA,eraN:eraTrades.length,eraWinRate:eraTrades.length?eraTrades.filter(t=>t.pnl>0).length/eraTrades.length*100:0,eraPnl:eraTrades.reduce((a,t)=>a+num(t.pnl),0),eraAvgPnl:eraTrades.length?avg(eraTrades.map(t=>t.pnlPct)):0}}),experiments:experimentSnapshot(),tokens:active,
    narratives:(latestReplay?.narratives||[]).slice(0,12),creators:creatorLeaderboard().slice(0,20),activity:activity.slice(0,100),research,...uiResearchSnapshot(),timeline:timeline.slice(-80),decisions:decisions.slice(0,120),replay:replayFrames.slice(-3),
    fomoWatchlist:fomoWatchlistSnapshot(),fomoEvents:walletEvents.filter(e=>e.watchlist).slice(0,60),audit:systemAudit(),eventLedger:{memory:marketEvents.length,pending:pipelineSafe(pendingDbEvents.length),lastFlush:lastDbEventFlush,dnaArchive:dnaArchive.size},discovery:discoveryLab(),solana:{observed:solanaObserved,resolved:solanaResolved,createSignals:solanaCreateSignals,priorityQueued:solanaPriorityQueue.length,queued:solanaQueue.length,watchedWallets:WATCHED_WALLET_LOOKUP.size,subscriptionAcks:solanaSubAcks}};
}
let stateJsonCache={ts:0,json:''};
let recoveryJsonCache={version:0,json:''};
function getRecoveryJsonCached(){
  const version=stateVersionTs;
  if(recoveryJsonCache.json&&recoveryJsonCache.version===version)return recoveryJsonCache.json;
  const snapshot=serializeCritical(),json=JSON.stringify({ok:true,recoverable:true,generatedAt:now(),sourceVersionTs:version,state:snapshot});
  recoveryJsonCache={version,json};
  return json;
}
function getStateJsonCached(){
  const ts=now(),age=ts-stateJsonCache.ts;
  const memory=memoryReport(process.memoryUsage(),RUNTIME_MEMORY_BUDGET_MIB);
  if(reuseSnapshotUnderPressure({ageMs:age,hasSnapshot:!!stateJsonCache.json,pressure:memory.pressure}) ||
      (stateJsonCache.json&&shouldDeferNonCritical()&&age<120000))return stateJsonCache.json;
  pruneRuntimeMemory();
  const started=Date.now(),json=JSON.stringify(snapshot());
  stateJsonCache={ts,json};
  const ms=Date.now()-started;lastStateBuildMs=ms;lastStateBytes=json.length;lastStateBuildAt=now();
  if(ms>250||json.length>750000)console.log('STATE_SNAPSHOT '+JSON.stringify({bytes:json.length,ms,tokens:tokens.size,positions:positions.filter(p=>!p.closed).length,trades:trades.length}));
  return json;
}
function stateSelfTest(){
  try{
    const started=Date.now(),json=JSON.stringify(snapshot()),ms=Date.now()-started;lastStateBuildMs=ms;lastStateBytes=json.length;lastStateBuildAt=now();
    stateJsonCache={ts:now(),json};
    console.log('STATE_SELFTEST '+JSON.stringify({ok:true,bytes:json.length,ms,tokens:tokens.size,positions:positions.filter(p=>!p.closed).length,trades:trades.length}));
    setHealth('dashboard-api','ok','Dashboard state API healthy · '+Math.round(json.length/1024)+' KB',{truth:'observed'});
  }catch(e){
    console.error('STATE_SELFTEST_FAIL '+(e?.stack||e));
    setHealth('dashboard-api','warn','Dashboard state serialization failed: '+e.message,{truth:'observed'});
  }
}

let HTML=`<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>PUMP LAB / LIVE</title><style>
:root{--bg:#07090d;--card:#0f141d;--card2:#121925;--line:#253045;--muted:#8ea0bc;--text:#f4f7fb;--green:#4ff5a2;--red:#ff6d86;--blue:#7588ff;--amber:#ffcc66}*{box-sizing:border-box}body{margin:0;background:radial-gradient(circle at 50% -20%,#182136 0,#080b11 35%,#06080c 72%);color:var(--text);font:14px Inter,ui-sans-serif,system-ui,-apple-system,sans-serif}.wrap{max-width:1560px;margin:auto;padding:22px 28px 60px}.top{display:flex;justify-content:space-between;gap:18px;align-items:center}.brand{font-size:27px;font-weight:950;letter-spacing:-1.1px}.sub{color:#8bb0e8;font-size:13px;margin-top:2px}.badges{display:flex;gap:8px;flex-wrap:wrap;justify-content:flex-end}.badge,.pill{font-size:11px;border:1px solid #2c394f;padding:5px 8px;border-radius:99px;background:#111827}.live{border-color:#00dc70;color:#64f9aa;background:#071a13}.hero{margin-top:18px;padding:20px;border:1px solid #2a3850;border-radius:18px;background:linear-gradient(135deg,#121a27,#0d1119);display:grid;grid-template-columns:1.4fr 1fr;gap:18px}.big{font-size:28px;font-weight:900;letter-spacing:-.6px}.muted{color:var(--muted)}.green{color:var(--green)}.red{color:var(--red)}.amber{color:var(--amber)}.grid4{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin:14px 0}.card{background:linear-gradient(180deg,#10151e,#0c1119);border:1px solid var(--line);border-radius:14px;padding:14px;box-shadow:0 12px 30px #0002}.card h3{margin:0 0 9px;font-size:13px;color:#cbd6e8}.health{display:flex;gap:7px;flex-wrap:wrap}.health span{border:1px solid #29354a;padding:6px 9px;border-radius:8px;background:#0c121b}.tabs{display:flex;gap:8px;margin:16px 0;flex-wrap:wrap}.tab{padding:9px 13px;border-radius:9px;background:#111824;border:1px solid #293349;cursor:pointer}.tab.on{background:#f7f9fd;color:#080b10;border-color:#fff}.pane{display:none}.pane.on{display:block}.strategies{display:grid;grid-template-columns:repeat(3,1fr);gap:10px}.strategy{cursor:pointer;transition:.15s}.strategy:hover{transform:translateY(-2px);border-color:#405373}.strategy .topline{display:flex;align-items:center;justify-content:space-between}.strategy .money{font-size:24px;font-weight:900;margin:7px 0}.mini{font-size:12px;color:#91a7c9}.two{display:grid;grid-template-columns:1.5fr 1fr;gap:12px}.three{display:grid;grid-template-columns:repeat(3,1fr);gap:12px}.feed{max-height:510px;overflow:auto}.feedrow{display:grid;grid-template-columns:95px 1fr;gap:10px;padding:9px 2px;border-bottom:1px solid #1c2534}.table{width:100%;border-collapse:collapse}.table th,.table td{padding:9px 7px;text-align:left;border-bottom:1px solid #1d2737;font-size:12px}.table th{color:#8fa4c3;font-weight:650;position:sticky;top:0;background:#0f141d}.scroll{max-height:560px;overflow:auto}.heatwrap{display:flex;gap:10px;flex-wrap:wrap;align-items:flex-end;min-height:190px}.bubble{display:flex;align-items:center;justify-content:center;border-radius:50%;border:1px solid #3a4967;background:radial-gradient(circle at 35% 30%,#26365b,#121827);text-align:center;font-size:11px;padding:9px}.meter{height:7px;background:#182131;border-radius:99px;overflow:hidden}.meter>i{display:block;height:100%;background:linear-gradient(90deg,#667cff,#4ff5a2)}.token{cursor:pointer}.token:hover{background:#141c29}.drawer{position:fixed;right:0;top:0;height:100vh;width:min(560px,96vw);background:#0a0f17;border-left:1px solid #2b3850;z-index:20;padding:20px;transform:translateX(102%);transition:.2s;overflow:auto;box-shadow:-25px 0 60px #0007}.drawer.on{transform:none}.close{float:right;border:1px solid #37445b;border-radius:9px;background:#111824;color:white;padding:6px 10px;cursor:pointer}.vote{display:inline-flex;gap:4px;align-items:center;padding:4px 7px;border-radius:7px;margin:3px;background:#121a27;border:1px solid #26354c}.vote.y{border-color:#16683f;color:#77f8ae}.vote.n{color:#a1aec2}.spark{width:100%;height:90px}.world{min-height:270px;display:flex;gap:12px;flex-wrap:wrap;align-items:center;justify-content:center}.worldGrid{display:grid;grid-template-columns:repeat(auto-fit,minmax(235px,1fr));gap:12px}.ecosystem{background:#0b111a;border:1px solid #253249;border-radius:14px;padding:12px;min-height:150px}.nodes{display:flex;gap:6px;flex-wrap:wrap;margin-top:9px}.worldNode{cursor:pointer;border:1px solid #2c3a51;background:#121b29;color:#dce8fa;border-radius:999px;padding:6px 9px;font-size:11px}.worldNode.hot{border-color:#1b7f50;color:#78f8b0}.worldNode.risky{border-color:#7b3043;color:#ff91a7}.worldNode:hover{transform:translateY(-1px);background:#182338}.smallcard{padding:10px;border:1px solid #253249;background:#0c121b;border-radius:10px}.sectionTitle{display:flex;justify-content:space-between;align-items:end;margin:18px 0 9px}.sectionTitle h2{margin:0;font-size:17px}.sectionTitle p{margin:0;color:#8497b4;font-size:12px}.truth{font-size:10px;text-transform:uppercase;letter-spacing:.5px;color:#8094b2}.controls{display:flex;gap:8px;align-items:center}select{background:#0f1621;color:white;border:1px solid #2a3850;border-radius:8px;padding:7px} @media(max-width:1050px){.strategies{grid-template-columns:1fr 1fr}.grid4,.three{grid-template-columns:1fr 1fr}.two,.hero{grid-template-columns:1fr}}@media(max-width:680px){.wrap{padding:16px}.strategies,.grid4,.three{grid-template-columns:1fr}.big{font-size:22px}.top{align-items:flex-start}.hideMobile{display:none}}

/* ─────────────────────────────────────────────────────────────
   PUMP LAB / LIVE — LIGHT BRUTALIST FUTURE LAB / UI v1
   Visual-only layer. Trading / research hooks stay untouched.
───────────────────────────────────────────────────────────── */
:root{
  --bg:#f1f2f2;--paper:#fafafa;--paper2:#f6f7f7;--ink:#0a0c0f;--text:#111318;
  --muted:#747b83;--line:#d7dadd;--line2:#c7cbd0;--green:#19c965;--red:#e14759;
  --blue:#6577ff;--amber:#c48916;--card:#f9fafa;--card2:#f3f5f5;
  --shadow:0 18px 55px rgba(22,29,36,.08);--softshadow:0 8px 28px rgba(22,29,36,.06);
}
*{scrollbar-color:#bcc1c6 transparent}
html{scroll-behavior:smooth;background:var(--bg)}
body{
  background:
    radial-gradient(circle at 72% 7%,rgba(255,255,255,.96) 0 13%,transparent 34%),
    radial-gradient(circle at 12% 22%,rgba(255,255,255,.72),transparent 32%),
    linear-gradient(180deg,#f8f9f9 0,#eef0f0 46%,#f7f8f8 100%);
  color:var(--text);font-family:Arial,"Helvetica Neue",ui-sans-serif,system-ui,-apple-system,sans-serif;
  letter-spacing:-.01em;min-height:100vh
}
body:before{
  content:"";position:fixed;inset:0;pointer-events:none;z-index:-1;opacity:.23;
  background-image:radial-gradient(rgba(10,12,15,.13) .55px,transparent .7px);
  background-size:5px 5px;mix-blend-mode:multiply
}
.wrap{max-width:1640px;margin:auto;padding:0 34px 80px}
.top{
  position:sticky;top:0;z-index:15;margin:0 -34px;padding:17px 34px;
  background:rgba(248,249,249,.84);backdrop-filter:blur(22px) saturate(140%);
  border-bottom:1px solid rgba(24,30,36,.09);box-shadow:0 7px 24px rgba(15,20,28,.025)
}
.brand{font-size:18px;letter-spacing:-.5px;font-weight:900;color:#080a0d;text-transform:uppercase}
.brand span{color:#a4abb2!important;font-weight:700}
.sub{font-size:10px;text-transform:uppercase;letter-spacing:.16em;color:#8a9199;margin-top:4px}
.badges{align-items:center}
.badge,.pill{
  color:#30363c;border:1px solid #d4d7da;background:rgba(255,255,255,.78);
  padding:6px 10px;border-radius:999px;font-size:9px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;
  box-shadow:0 4px 16px rgba(10,15,20,.035)
}
.live{border-color:#aeecc7;color:#118944;background:#f0fff6}
.masthead{
  min-height:430px;margin:0 -34px;padding:58px 34px 36px;display:grid;grid-template-columns:1.18fr .82fr;gap:38px;
  position:relative;overflow:hidden;border-bottom:1px solid #dfe1e3
}
.masthead:after{
  content:"";position:absolute;left:58%;top:0;bottom:0;width:1px;background:#d7dade
}
.mastcopy{position:relative;z-index:2;display:flex;flex-direction:column;justify-content:center;max-width:880px}
.kicker{font-size:10px;letter-spacing:.32em;text-transform:uppercase;color:#9299a1;margin-bottom:18px}
.masttitle{
  margin:0;font-weight:950;letter-spacing:-.075em;line-height:.84;text-transform:uppercase;
  font-size:clamp(64px,7.6vw,126px);color:#060709
}
.masttitle span{font-weight:580;color:#aab0b6}
.mastlede{max-width:650px;margin:22px 0 0;font-size:15px;line-height:1.55;color:#687078}
.statusrail{display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin-top:26px}
.statusswitch{
  display:flex;align-items:center;gap:10px;padding:9px 13px;border-radius:999px;background:white;border:1px solid #dadde0;
  box-shadow:inset 0 1px white,var(--softshadow);font-size:9px;font-weight:900;letter-spacing:.08em;text-transform:uppercase
}
.statusswitch i{width:10px;height:10px;border-radius:50%;background:#1fd66d;box-shadow:0 0 0 5px rgba(31,214,109,.12)}
.statusnote{font-size:10px;color:#7f878f;text-transform:uppercase;letter-spacing:.12em}
.mastart{position:relative;min-height:340px;isolation:isolate}
.mastart:before{
  content:"";position:absolute;width:min(29vw,420px);aspect-ratio:1;left:46%;top:49%;transform:translate(-50%,-50%);
  border-radius:44% 56% 63% 37% / 42% 36% 64% 58%;
  background:
    radial-gradient(circle at 36% 31%,rgba(255,255,255,.98),rgba(240,242,243,.95) 26%,rgba(177,184,190,.72) 48%,rgba(32,36,42,.92) 72%,#050608 100%);
  filter:blur(.2px);box-shadow:-28px 42px 80px rgba(20,25,30,.18),inset 30px -35px 80px rgba(255,255,255,.58);
  transform-origin:center;animation:floatOrb 9s ease-in-out infinite
}
.mastart:after{
  content:"";position:absolute;width:330px;height:115px;left:43%;top:49%;transform:translate(-50%,-50%) rotate(-8deg);
  background:linear-gradient(90deg,rgba(248,249,249,.98),rgba(24,28,34,.62),rgba(248,249,249,.96));
  filter:blur(12px);opacity:.88;mix-blend-mode:normal
}
@keyframes floatOrb{0%,100%{transform:translate(-50%,-50%) rotate(-2deg)}50%{transform:translate(-50%,-54%) rotate(3deg)}}
@keyframes orbMotion{
  0%{transform:translate(-50%,-50%) rotate(0deg) translateX(0) translateY(0) scale(1)}
  20%{transform:translate(-49.3%,-50.7%) rotate(2.5deg) translateX(2px) translateY(-2px) scale(1.006)}
  40%{transform:translate(-50.7%,-49.5%) rotate(5.5deg) translateX(-2px) translateY(1px) scale(.997)}
  60%{transform:translate(-49.7%,-50.4%) rotate(8.5deg) translateX(2px) translateY(-1px) scale(1.007)}
  80%{transform:translate(-50.6%,-49.7%) rotate(11.5deg) translateX(-2px) translateY(2px) scale(.999)}
  100%{transform:translate(-50%,-50%) rotate(14deg) translateX(0) translateY(0) scale(1)}
}
@keyframes orbMorph{
  0%{border-radius:44% 56% 63% 37% / 42% 36% 64% 58%}
  25%{border-radius:47% 53% 59% 41% / 39% 43% 57% 61%}
  50%{border-radius:42% 58% 55% 45% / 46% 35% 65% 54%}
  75%{border-radius:46% 54% 60% 40% / 38% 45% 55% 62%}
  100%{border-radius:43% 57% 61% 39% / 44% 36% 64% 56%}
}
@keyframes orbBreath{
  0%,100%{filter:blur(.18px) saturate(1)}
  50%{filter:blur(.38px) saturate(1.015)}
}
@keyframes orbVeil{
  0%{transform:translate(-50%,-50%) rotate(-8deg) scale(1);opacity:.86;filter:blur(12px)}
  50%{transform:translate(-49%,-51%) rotate(-5.5deg) scale(1.02);opacity:.77;filter:blur(13.5px)}
  100%{transform:translate(-51%,-49%) rotate(-9.5deg) scale(.99);opacity:.88;filter:blur(11.5px)}
}
.mastindex{position:absolute;left:0;top:20px;font:10px/1.55 ui-monospace,SFMono-Regular,Menlo,monospace;color:#858c94;letter-spacing:.12em}
.mastwords{position:absolute;right:12px;top:56px;font:10px/1.25 ui-monospace,SFMono-Regular,Menlo,monospace;color:#80878f;text-align:right;text-transform:uppercase}
.maststatement{position:absolute;right:0;bottom:40px;width:170px;font-size:16px;font-weight:900;line-height:1.02;text-transform:uppercase}
.mastline{position:absolute;right:0;bottom:18px;width:118px;height:1px;background:#0d0f12}
.magicOrb{cursor:pointer;outline:none;user-select:none}
.oracleHint{display:none!important}
.magicOrb:focus-visible{outline:1px solid #8d949b;outline-offset:-8px}
.magicOrb:active:before{transform:translate(-50%,-48%) scale(.985)!important}
.magicOrb:before{z-index:1;transition:transform .38s cubic-bezier(.2,.8,.2,1),filter .38s,box-shadow .38s}
.magicOrb:after{z-index:2}
.magicOrb:hover:before{filter:blur(.2px) brightness(1.035);box-shadow:-34px 48px 88px rgba(20,25,30,.22),inset 30px -35px 80px rgba(255,255,255,.62)}
.oracleAnswer{
  position:absolute;left:46%;top:49%;transform:translate(-50%,-50%) scale(.82);z-index:4;
  min-width:210px;max-width:290px;text-align:center;color:rgba(255,255,255,.98);
  font-size:clamp(24px,2.35vw,42px);font-weight:950;line-height:.92;letter-spacing:-.055em;text-transform:uppercase;
  opacity:0;filter:blur(18px);text-shadow:0 2px 18px rgba(0,0,0,.58);pointer-events:none;
  transition:opacity 1.05s ease,filter 1.15s ease,transform 1.15s cubic-bezier(.18,.75,.22,1)
}
.oracleAnswer.show{opacity:1;filter:blur(0);transform:translate(-50%,-50%) scale(1)}
.oracleHint{
  position:absolute;left:46%;bottom:15px;transform:translateX(-50%);z-index:5;white-space:nowrap;
  font:8px/1 ui-monospace,SFMono-Regular,Menlo,monospace;letter-spacing:.18em;text-transform:uppercase;color:#969da4;
  opacity:.72;transition:opacity .2s
}
.magicOrb:hover .oracleHint{opacity:1;color:#545b62}
.magicOrb.answered .oracleHint{opacity:.42}

.hero{
  margin:22px 0 16px;padding:0;border:0;border-radius:0;background:none;display:grid;grid-template-columns:1.35fr 1fr;gap:12px
}
.hero>div{
  background:rgba(255,255,255,.72);border:1px solid var(--line);border-radius:20px;padding:17px 18px;
  box-shadow:var(--softshadow);backdrop-filter:blur(16px);position:relative;overflow:hidden
}
.hero>div:before{content:"";position:absolute;inset:0;pointer-events:none;background:radial-gradient(circle at var(--mx,85%) var(--my,20%),rgba(101,119,255,.09),transparent 38%)}
.big{font-size:27px;font-weight:900;letter-spacing:-.055em;color:#090b0d}
.muted{color:#7d858d}.green{color:#15b65a}.red{color:#d94152}.amber{color:#b57a13}
.grid4{gap:11px;margin:14px 0}
.card,.smallcard,.ecosystem{
  --mx:50%;--my:50%;background:rgba(250,251,251,.86)!important;border:1px solid var(--line)!important;
  color:#14171a;border-radius:18px;box-shadow:var(--softshadow);position:relative;overflow:hidden
}
.card{padding:16px}
.card:before,.smallcard:before{
  content:"";position:absolute;inset:0;pointer-events:none;opacity:0;transition:opacity .2s;
  background:radial-gradient(260px circle at var(--mx) var(--my),rgba(101,119,255,.075),transparent 58%)
}
.card:hover:before,.smallcard:hover:before{opacity:1}
.card h3{color:#171a1e;font-size:10px;font-weight:900;letter-spacing:.12em;text-transform:uppercase}
.grid4>.card{min-height:112px;display:flex;flex-direction:column;justify-content:space-between}
.grid4>.card .muted{font-size:9px;font-weight:800;letter-spacing:.12em;text-transform:uppercase}
.grid4>.card .big{margin-top:9px}
.health{
  border-radius:999px!important;padding:7px!important;background:rgba(255,255,255,.72)!important;box-shadow:none!important;
  display:flex;gap:5px;align-items:center;overflow-x:auto
}
.health span{color:#60676f;border:1px solid #dadde0;padding:6px 10px;border-radius:999px;background:#fbfcfc;white-space:nowrap;font-size:9px}
.tabs{
  position:sticky;top:68px;z-index:12;margin:17px 0;padding:5px;display:inline-flex;max-width:100%;overflow:auto;
  background:rgba(244,245,245,.88);border:1px solid #d8dbde;border-radius:999px;backdrop-filter:blur(22px);box-shadow:var(--softshadow)
}
.tab{
  padding:9px 15px;border:0;background:transparent;color:#656d75;border-radius:999px;font-size:10px;font-weight:800;
  letter-spacing:.03em;white-space:nowrap;transition:.2s
}
.tab:hover{color:#0e1114;background:#fff}
.tab.on{background:#090b0e;color:white;border:0;box-shadow:0 6px 15px rgba(8,10,13,.13)}
.sectionTitle{margin:27px 0 12px;align-items:flex-end}
.sectionTitle:before{content:"";width:26px;height:1px;background:#101316;position:absolute;margin-top:-12px}
.sectionTitle h2{font-size:22px;letter-spacing:-.045em;text-transform:uppercase}
.sectionTitle p{color:#8b9299;font-size:11px}
.strategies{grid-template-columns:repeat(auto-fit,minmax(238px,1fr));gap:10px}
.strategy{
  min-height:375px;padding:10px!important;border-radius:22px!important;transition:transform .24s cubic-bezier(.2,.8,.2,1),box-shadow .24s,border-color .24s!important;
  background:#fafbfb!important
}
.strategy:hover{transform:translateY(-7px) scale(1.008);border-color:#8e98ff!important;box-shadow:0 25px 60px rgba(22,30,42,.12)}
.strategy:active{transform:translateY(-3px) scale(.995)}
.agentVisual{
  height:164px;border-radius:15px;border:1px solid #d9dcdf;margin-bottom:12px;position:relative;overflow:hidden;
  background:#eceeee;isolation:isolate
}
.agentVisual:before,.agentVisual:after{content:"";position:absolute}
.agentVisual:before{
  width:118px;height:118px;border-radius:42% 58% 45% 55%;left:50%;top:49%;transform:translate(-50%,-50%);
  background:radial-gradient(circle at 32% 28%,#fff 0,#e9ebec 28%,#9ba1a6 53%,#14171a 77%,#030405 100%);
  box-shadow:20px 22px 55px rgba(0,0,0,.24),inset -16px 16px 33px rgba(255,255,255,.45)
}
.agentVisual:after{
  height:30px;width:200px;top:62%;left:50%;transform:translate(-50%,-50%) rotate(-8deg);
  filter:blur(9px);background:linear-gradient(90deg,#f4f5f5,#272b30,#f3f4f4);opacity:.88
}
.agentVisual.v1:before{border-radius:8px;clip-path:polygon(50% 0,86% 18%,100% 58%,70% 100%,24% 91%,0 44%,17% 13%);background:linear-gradient(145deg,#f8f8f8,#aeb3b6 42%,#303338 72%,#eceeef);box-shadow:none}
.agentVisual.v1:after{width:1px;height:170px;left:31%;top:0;transform:none;filter:none;background:#171a1d;opacity:.7}
.agentVisual.v2:before{width:150px;height:190px;top:57%;filter:blur(10px);border-radius:46%;background:linear-gradient(180deg,#191b1f,#5a5f65 45%,#050607);opacity:.93}
.agentVisual.v2:after{width:208px;height:48px;top:47%;filter:blur(11px);transform:translate(-50%,-50%);background:linear-gradient(90deg,#f4f5f5,#111316,#f4f5f5)}
.agentVisual.v3:before{width:34px;height:120px;border-radius:50%;left:38%;top:48%;background:linear-gradient(#050607,#52575c);filter:blur(2px);box-shadow:96px 20px 0 -7px #141719,48px -40px 0 -11px #090b0c}
.agentVisual.v3:after{display:none}
.agentVisual.v4:before{
  width:190px;height:106px;left:50%;top:65%;border-radius:0;clip-path:polygon(0 100%,0 76%,20% 59%,30% 73%,49% 26%,61% 54%,72% 41%,100% 88%,100% 100%);
  background:linear-gradient(180deg,#bfc3c5,#191c20);box-shadow:none
}
.agentVisual.v4:after{width:270px;height:90px;top:78%;background:rgba(255,255,255,.76);filter:blur(16px)}
.agentIndex{
  position:absolute!important;left:10px;top:10px;z-index:4;font:9px ui-monospace,SFMono-Regular,monospace;color:#787f86;letter-spacing:.15em
}
.agentLive{position:absolute!important;right:10px;top:10px;z-index:4;width:7px;height:7px;border-radius:50%;background:#18d66b;box-shadow:0 0 0 5px rgba(24,214,107,.12)}
/* TRADER ART SYSTEM · 25 UNIQUE IDENTITIES */
.agentVisual{--a:#121417;--b:#a7adb2;--c:#f8f9f9}
.agentVisual .shapeA,.agentVisual .shapeB,.agentVisual .shapeC{position:absolute;display:block;pointer-events:none;transform-origin:center}
.agentVisual .shapeA{z-index:1}.agentVisual .shapeB{z-index:2}.agentVisual .shapeC{z-index:3}
.agentVisual.art-banker:before,.agentVisual.art-banker:after,
.agentVisual.art-quant:before,.agentVisual.art-quant:after,
.agentVisual.art-smart:before,.agentVisual.art-smart:after,
.agentVisual.art-social:before,.agentVisual.art-social:after,
.agentVisual.art-momentum:before,.agentVisual.art-momentum:after,
.agentVisual.art-graduation:before,.agentVisual.art-graduation:after,
.agentVisual.art-dip:before,.agentVisual.art-dip:after,
.agentVisual.art-swing:before,.agentVisual.art-swing:after,
.agentVisual.art-degen:before,.agentVisual.art-degen:after,
.agentVisual.art-smartmom:before,.agentVisual.art-smartmom:after,
.agentVisual.art-culture:before,.agentVisual.art-culture:after,
.agentVisual.art-contrarian:before,.agentVisual.art-contrarian:after,
.agentVisual.art-sniper:before,.agentVisual.art-sniper:after,
.agentVisual.art-champion:before,.agentVisual.art-champion:after,
.agentVisual.art-professional:before,.agentVisual.art-professional:after,
.agentVisual.art-adaptive:before,.agentVisual.art-adaptive:after,
.agentVisual.art-unipcs:before,.agentVisual.art-unipcs:after,
.agentVisual.art-frank:before,.agentVisual.art-frank:after,
.agentVisual.art-orangie:before,.agentVisual.art-orangie:after,
.agentVisual.art-rasmr:before,.agentVisual.art-rasmr:after,
.agentVisual.art-consensus:before,.agentVisual.art-consensus:after,
.agentVisual.art-runner:before,.agentVisual.art-runner:after,
.agentVisual.art-asym:before,.agentVisual.art-asym:after,
.agentVisual.art-megga:before,.agentVisual.art-megga:after,
.agentVisual.art-scout:before,.agentVisual.art-scout:after{display:none}

/* 01 Banker · liquid oracle */
.art-banker .shapeA{width:118px;height:118px;left:50%;top:51%;transform:translate(-50%,-50%);border-radius:47% 53% 58% 42%/42% 38% 62% 58%;background:radial-gradient(circle at 31% 25%,#fff,#e7e9ea 29%,#8f969c 57%,#15181c 81%,#030405);box-shadow:18px 20px 43px rgba(0,0,0,.23);animation:artMorph 13s ease-in-out infinite alternate,artFloat 18s ease-in-out infinite}
.art-banker .shapeB{width:145px;height:28px;left:50%;top:59%;transform:translate(-50%,-50%) rotate(-7deg);background:linear-gradient(90deg,transparent,#f4f5f5 18%,#2c3034 49%,#f5f6f6 82%,transparent);filter:blur(8px);opacity:.78}

/* 02 Quant · concentric calculation rings */
.art-quant .shapeA{width:118px;height:118px;left:50%;top:51%;transform:translate(-50%,-50%);border:1px solid #25292d;border-radius:50%;box-shadow:0 0 0 17px #f3f4f4,0 0 0 18px #9ba1a6,0 0 0 33px #eceeee,0 0 0 34px #c8ccd0}
.art-quant .shapeB{width:1px;height:142px;background:#16191c;left:50%;top:16px;animation:artRotate 19s linear infinite}
.art-quant .shapeC{width:8px;height:8px;border-radius:50%;background:#0b0d0f;left:50%;top:50%;transform:translate(-50%,-50%);box-shadow:45px 0 0 #8e9499,-45px 0 0 #c4c8cb}

/* 03 Smart Money · connected intelligence */
.art-smart .shapeA{width:112px;height:112px;left:50%;top:50%;transform:translate(-50%,-50%);border-radius:50%;background:radial-gradient(circle,#fbfbfb 0 12%,#a9afb4 13% 16%,transparent 17%),radial-gradient(circle at 18% 24%,#191c1f 0 5px,transparent 6px),radial-gradient(circle at 78% 22%,#555b60 0 7px,transparent 8px),radial-gradient(circle at 25% 79%,#8c9297 0 8px,transparent 9px),radial-gradient(circle at 82% 72%,#15181b 0 5px,transparent 6px)}
.art-smart .shapeB{width:130px;height:1px;background:#8e959a;left:50%;top:50%;transform:translate(-50%,-50%) rotate(32deg);box-shadow:0 22px 0 #b6bbc0,0 -19px 0 #ced1d3}
.art-smart .shapeC{width:92px;height:1px;background:#a1a7ac;left:50%;top:50%;transform:translate(-50%,-50%) rotate(-48deg);animation:artPulse 5s ease-in-out infinite}

/* 04 Social Alpha · broadcast sculpture */
.art-social .shapeA{width:14px;height:112px;left:50%;top:48%;transform:translate(-50%,-50%);background:linear-gradient(#0b0d0f,#8d9398);border-radius:20px}
.art-social .shapeB{width:82px;height:82px;border:1px solid #61676d;border-left-color:transparent;border-bottom-color:transparent;border-radius:50%;left:50%;top:48%;transform:translate(-50%,-50%) rotate(45deg);box-shadow:0 0 0 17px #eef0f0,0 0 0 18px #b9bec2,0 0 0 34px #eef0f0,0 0 0 35px #d2d5d7}
.art-social .shapeC{width:7px;height:7px;border-radius:50%;background:#0b0d0f;left:50%;top:24%;transform:translateX(-50%);animation:artPulse 3.6s ease-in-out infinite}

/* 05 Momentum · speed ribbon */
.art-momentum .shapeA{width:160px;height:72px;left:51%;top:53%;transform:translate(-50%,-50%) skewX(-18deg) rotate(-9deg);background:linear-gradient(135deg,#f7f8f8 0,#c2c6c9 27%,#1f2327 48%,#858c92 62%,#f4f5f5 86%);clip-path:polygon(0 63%,18% 30%,42% 50%,67% 0,100% 23%,78% 66%,53% 45%,25% 100%);filter:drop-shadow(13px 18px 13px rgba(0,0,0,.16));animation:artDriftX 7s ease-in-out infinite}
.art-momentum .shapeB{width:180px;height:1px;left:48%;top:74%;background:linear-gradient(90deg,transparent,#858b90,transparent);transform:translateX(-50%)}

/* 06 Graduation · threshold portal */
.art-graduation .shapeA{width:110px;height:118px;left:50%;top:52%;transform:translate(-50%,-50%);border:17px solid #c9cdd0;border-bottom:0;border-radius:62px 62px 0 0;box-shadow:inset 12px 0 22px rgba(255,255,255,.95),12px 16px 25px rgba(0,0,0,.08)}
.art-graduation .shapeB{width:52px;height:88px;left:50%;top:61%;transform:translate(-50%,-50%);background:linear-gradient(180deg,#fafafa,#6d7378 69%,#181b1e);border-radius:30px 30px 0 0}
.art-graduation .shapeC{width:148px;height:1px;background:#202326;left:50%;top:82%;transform:translateX(-50%)}

/* 07 Dip Buyer · valley basin */
.art-dip .shapeA{width:170px;height:94px;left:50%;top:62%;transform:translate(-50%,-50%);background:linear-gradient(145deg,#c7cbce,#272b2f);clip-path:polygon(0 20%,16% 40%,30% 68%,44% 79%,56% 48%,67% 61%,83% 34%,100% 8%,100% 100%,0 100%)}
.art-dip .shapeB{width:74px;height:74px;border:1px solid rgba(255,255,255,.75);border-radius:50%;left:44%;top:57%;filter:blur(2px);opacity:.75;animation:artRise 10s ease-in-out infinite}
.art-dip .shapeC{width:190px;height:35px;left:50%;bottom:5px;transform:translateX(-50%);background:rgba(255,255,255,.7);filter:blur(13px)}

/* 08 Swing · pendulum wave */
.art-swing .shapeA{width:2px;height:112px;left:50%;top:8px;background:#202326;transform-origin:50% 0;animation:artSwing 8s ease-in-out infinite}
.art-swing .shapeB{width:60px;height:60px;border-radius:50%;left:50%;top:101px;transform:translate(-50%,-50%);background:radial-gradient(circle at 35% 28%,#fff,#b8bdc1 42%,#1b1e21 88%);box-shadow:12px 15px 25px rgba(0,0,0,.16)}
.art-swing .shapeC{width:160px;height:38px;left:50%;bottom:13px;transform:translateX(-50%);border-bottom:1px solid #90969b;border-radius:50%}

/* 09 Early Degen · unstable ember */
.art-degen .shapeA{width:94px;height:126px;left:50%;top:52%;transform:translate(-50%,-50%) rotate(9deg);background:linear-gradient(155deg,#fafafa 0,#c6cace 28%,#24282c 59%,#070809 85%);clip-path:polygon(51% 0,68% 21%,93% 36%,76% 55%,89% 81%,56% 100%,34% 78%,7% 66%,22% 40%,13% 20%);filter:drop-shadow(18px 22px 16px rgba(0,0,0,.18));animation:artJitter 5.5s ease-in-out infinite}
.art-degen .shapeB{width:120px;height:30px;left:50%;top:57%;transform:translate(-50%,-50%) rotate(-16deg);background:#f3f4f4;filter:blur(10px);opacity:.6}

/* 10 Smart Momentum · double helix */
.art-smartmom .shapeA,.art-smartmom .shapeB{width:112px;height:46px;left:50%;border:10px solid #2b2f33;border-left-color:transparent;border-right-color:transparent;border-radius:50%;animation:artHelix 8s ease-in-out infinite}
.art-smartmom .shapeA{top:35%;transform:translate(-50%,-50%) rotate(14deg)}.art-smartmom .shapeB{top:65%;transform:translate(-50%,-50%) rotate(-14deg);animation-delay:-4s}
.art-smartmom .shapeC{width:1px;height:126px;background:linear-gradient(transparent,#aeb3b7,transparent);left:50%;top:16px}

/* 11 Culture Hybrid · stacked totem */
.art-culture .shapeA{width:82px;height:82px;left:50%;top:34%;transform:translate(-50%,-50%) rotate(45deg);background:linear-gradient(135deg,#f7f8f8,#7d848a);border-radius:15px}
.art-culture .shapeB{width:108px;height:46px;left:50%;top:67%;transform:translate(-50%,-50%) rotate(-8deg);background:#1c2024;border-radius:52% 48% 39% 61%}
.art-culture .shapeC{width:42px;height:42px;left:38%;top:53%;border:1px solid #f8f8f8;border-radius:50%;box-shadow:46px 10px 0 -7px #bdc1c4}

/* 12 Contrarian · mirror split */
.art-contrarian .shapeA,.art-contrarian .shapeB{width:60px;height:112px;top:50%;background:linear-gradient(90deg,#f8f8f8,#4a5055);clip-path:polygon(0 0,100% 13%,78% 100%,5% 83%)}
.art-contrarian .shapeA{left:38%;transform:translate(-50%,-50%) rotate(-8deg)}
.art-contrarian .shapeB{right:38%;transform:translate(50%,-50%) scaleX(-1) rotate(-8deg);filter:brightness(.73)}
.art-contrarian .shapeC{width:1px;height:142px;background:#17191c;left:50%;top:10px}

/* 13 Patient Sniper · aperture / target */
.art-sniper .shapeA{width:120px;height:120px;border:1px solid #5f666c;border-radius:50%;left:50%;top:51%;transform:translate(-50%,-50%);box-shadow:inset 0 0 0 23px #eef0f0,inset 0 0 0 24px #858b90}
.art-sniper .shapeB{width:48px;height:48px;border-radius:50%;background:#121518;left:50%;top:51%;transform:translate(-50%,-50%);box-shadow:0 0 0 9px #b8bdc1}
.art-sniper .shapeC{width:154px;height:1px;background:#151719;left:50%;top:51%;transform:translate(-50%,-50%);box-shadow:0 -58px 0 #b6bbc0,0 58px 0 #b6bbc0}

/* 14 Champion · crown monolith */
.art-champion .shapeA{width:118px;height:125px;left:50%;top:55%;transform:translate(-50%,-50%);background:linear-gradient(160deg,#fbfbfb,#8c9297 48%,#15181b);clip-path:polygon(0 26%,19% 44%,34% 9%,51% 43%,69% 0,82% 42%,100% 20%,90% 100%,10% 100%);filter:drop-shadow(14px 18px 13px rgba(0,0,0,.16))}
.art-champion .shapeB{width:84px;height:1px;background:#fff;left:50%;top:68%;transform:translateX(-50%)}

/* 15 Professional · shield slab */
.art-professional .shapeA{width:108px;height:128px;left:50%;top:53%;transform:translate(-50%,-50%);background:linear-gradient(135deg,#fafafa,#b2b7bb 47%,#34383c);clip-path:polygon(50% 0,94% 18%,86% 70%,50% 100%,14% 70%,6% 18%);box-shadow:inset 8px 8px 18px rgba(255,255,255,.8)}
.art-professional .shapeB{width:1px;height:105px;background:#f9f9f9;left:50%;top:31px;opacity:.8}

/* 16 Adaptive Master · morphing frame */
.art-adaptive .shapeA{width:126px;height:104px;left:50%;top:52%;transform:translate(-50%,-50%);border:11px solid #8e9499;border-radius:22% 78% 31% 69%/68% 28% 72% 32%;animation:artMorph 9s ease-in-out infinite alternate,artRotateSoft 22s ease-in-out infinite}
.art-adaptive .shapeB{width:52px;height:52px;left:50%;top:52%;transform:translate(-50%,-50%);background:#1b1e22;border-radius:50%;filter:blur(1px)}

/* 17 Unipcs · faceted conviction crystal */
.art-unipcs .shapeA{width:118px;height:124px;left:50%;top:52%;transform:translate(-50%,-50%) rotate(-7deg);clip-path:polygon(50% 0,88% 20%,100% 60%,70% 100%,25% 91%,0 43%,18% 12%);background:linear-gradient(145deg,#f9f9f9 0,#d0d3d5 30%,#8a9095 52%,#25292d 74%,#eceeef 100%);filter:drop-shadow(14px 17px 14px rgba(0,0,0,.15));animation:artRotateSoft 17s ease-in-out infinite}
.art-unipcs .shapeB{width:1px;height:160px;background:#1b1e21;left:31%;top:0}

/* 18 Frank · consistency apparition */
.art-frank .shapeA{width:136px;height:168px;left:50%;top:58%;transform:translate(-50%,-50%);border-radius:46% 54% 44% 56%;background:linear-gradient(180deg,#111418,#5d6368 42%,#171a1e 88%);filter:blur(10px);opacity:.93;animation:artBreath 8.5s ease-in-out infinite}
.art-frank .shapeB{width:194px;height:45px;left:50%;top:50%;transform:translate(-50%,-50%);background:linear-gradient(90deg,#f4f5f5,#16191d,#f4f5f5);filter:blur(11px);opacity:.82}

/* 19 Orangie · diversified droplets */
.art-orangie .shapeA{width:18px;height:92px;background:#171a1d;border-radius:55%;left:37%;top:54%;transform:translate(-50%,-50%) rotate(4deg);filter:blur(1px);animation:artDropA 11s ease-in-out infinite}
.art-orangie .shapeB{width:13px;height:116px;background:#050607;border-radius:50%;left:56%;top:34%;transform:translate(-50%,-50%) rotate(2deg);filter:blur(1px);animation:artDropB 13s ease-in-out infinite}
.art-orangie .shapeC{width:20px;height:83px;background:#272b2f;border-radius:50%;left:70%;top:59%;transform:translate(-50%,-50%) rotate(-3deg);filter:blur(1px);animation:artDropA 9s ease-in-out infinite reverse}

/* 20 Rasmr · velocity ridge */
.art-rasmr .shapeA{width:178px;height:93px;left:50%;bottom:4px;transform:translateX(-50%);clip-path:polygon(0 100%,0 72%,20% 53%,31% 68%,51% 15%,63% 48%,76% 34%,100% 80%,100% 100%);background:linear-gradient(180deg,#c8cccf,#202428);animation:artDriftX 5.5s ease-in-out infinite}
.art-rasmr .shapeB{width:150px;height:2px;background:linear-gradient(90deg,transparent,#fff,transparent);left:49%;top:44%;transform:translateX(-50%) rotate(-14deg);opacity:.65;animation:artPulse 3s ease-in-out infinite}

/* 21 Smart Wallet Consensus · node convergence */
.art-consensus .shapeA{width:44px;height:44px;border-radius:50%;background:radial-gradient(circle at 30% 25%,#fff,#858b90 56%,#15181b);left:50%;top:50%;transform:translate(-50%,-50%);box-shadow:-55px -30px 0 -9px #4d5358,54px -28px 0 -7px #a8adb1,-45px 39px 0 -12px #16191c,48px 42px 0 -10px #73797e}
.art-consensus .shapeB{width:135px;height:1px;background:#a1a7ac;left:50%;top:50%;transform:translate(-50%,-50%) rotate(28deg);box-shadow:0 34px 0 #c1c5c8,0 -31px 0 #858b90}
.art-consensus .shapeC{width:94px;height:1px;background:#7d8489;left:50%;top:50%;transform:translate(-50%,-50%) rotate(-39deg);animation:artPulse 5s ease-in-out infinite}

/* 22 Confirmed Runner · ascending track */
.art-runner .shapeA{width:18px;height:136px;left:46%;top:54%;transform:translate(-50%,-50%) rotate(29deg);background:linear-gradient(#202327,#dfe1e2);border-radius:20px}
.art-runner .shapeB{width:18px;height:136px;left:60%;top:50%;transform:translate(-50%,-50%) rotate(29deg);background:linear-gradient(#b3b8bc,#15181b);border-radius:20px}
.art-runner .shapeC{width:19px;height:19px;border-radius:50%;background:#0b0d0f;left:71%;top:16%;box-shadow:-23px 37px 0 -5px #9fa5aa;animation:artRun 4s ease-in-out infinite}

/* 23 Asymmetric Swing · unequal balance */
.art-asym .shapeA{width:140px;height:2px;background:#171a1d;left:50%;top:48%;transform:translate(-50%,-50%) rotate(-8deg)}
.art-asym .shapeB{width:74px;height:74px;border-radius:50%;background:radial-gradient(circle at 32% 27%,#fff,#969ca1 52%,#171a1d);left:30%;top:62%;box-shadow:98px -35px 0 -23px #5d6368}
.art-asym .shapeC{width:2px;height:105px;background:#8b9196;left:50%;top:35px}

/* 24 Megga Direct Copy · game token / stacked disk */
.art-megga .shapeA{width:124px;height:124px;border-radius:50%;left:50%;top:51%;transform:translate(-50%,-50%);background:conic-gradient(from 35deg,#f9f9f9,#6e7479,#171a1d,#c6cace,#f9f9f9);box-shadow:inset 0 0 0 15px #eceeee,inset 0 0 0 17px #5e6469}
.art-megga .shapeB{width:68px;height:68px;border-radius:50%;left:50%;top:51%;transform:translate(-50%,-50%);background:#f5f6f6;box-shadow:inset 9px 9px 17px #fff,inset -8px -8px 16px #aeb3b7}
.art-megga .shapeC{width:12px;height:12px;border-radius:50%;background:#111418;left:50%;top:51%;transform:translate(-50%,-50%);animation:artPulse 2.8s ease-in-out infinite}

/* 25 Megga Scout · satellite probe */
.art-scout .shapeA{width:69px;height:69px;border-radius:50%;left:52%;top:47%;transform:translate(-50%,-50%);background:radial-gradient(circle at 31% 25%,#fff,#a9aeb2 55%,#23272b);box-shadow:0 0 0 1px #797f84}
.art-scout .shapeB{width:150px;height:50px;border:1px solid #858b90;border-left-color:transparent;border-right-color:transparent;border-radius:50%;left:52%;top:47%;transform:translate(-50%,-50%) rotate(-17deg);animation:artRotate 16s linear infinite}
.art-scout .shapeC{width:10px;height:10px;border-radius:50%;background:#15181b;left:78%;top:23%;box-shadow:-117px 73px 0 -2px #9da3a8;animation:artScout 7s ease-in-out infinite}

/* deterministic future-agent fallback remains unique through CSS variables */
.agentVisual.art-future .shapeA{width:var(--aw,105px);height:var(--ah,105px);left:var(--ax,50%);top:var(--ay,52%);transform:translate(-50%,-50%) rotate(var(--rot,0deg));border-radius:var(--r1,45%) var(--r2,55%) var(--r3,60%) var(--r4,40%);background:linear-gradient(var(--grad,145deg),#fafafa,#a8adb1 48%,#1a1d20);clip-path:polygon(var(--poly,50% 0,93% 28%,82% 84%,50% 100%,10% 75%,4% 28%));animation:artMorph var(--dur,13s) ease-in-out infinite alternate}
.agentVisual.art-future .shapeB{width:var(--bw,130px);height:1px;background:#747b81;left:50%;top:50%;transform:translate(-50%,-50%) rotate(var(--brot,22deg));opacity:.7}
.agentVisual.art-future .shapeC{width:var(--dot,11px);height:var(--dot,11px);border-radius:50%;background:#14171a;left:var(--cx,70%);top:var(--cy,28%);animation:artPulse 4s ease-in-out infinite}

@keyframes artMorph{0%{border-radius:44% 56% 61% 39%/42% 36% 64% 58%}100%{border-radius:53% 47% 42% 58%/35% 58% 42% 65%}}
@keyframes artFloat{0%,100%{transform:translate(-50%,-50%) translate(0,0) rotate(0)}50%{transform:translate(-50%,-50%) translate(3px,-5px) rotate(4deg)}}
@keyframes artRotate{to{transform:translate(-50%,-50%) rotate(360deg)}}
@keyframes artRotateSoft{0%,100%{transform:translate(-50%,-50%) rotate(-7deg)}50%{transform:translate(-50%,-53%) rotate(5deg)}}
@keyframes artPulse{0%,100%{opacity:.42}50%{opacity:1}}
@keyframes artDriftX{0%,100%{translate:-3px 0}50%{translate:4px -2px}}
@keyframes artRise{0%,100%{transform:translate(-50%,-45%) scale(.92)}50%{transform:translate(-50%,-62%) scale(1.05)}}
@keyframes artSwing{0%,100%{transform:rotate(-11deg)}50%{transform:rotate(11deg)}}
@keyframes artJitter{0%,100%{transform:translate(-50%,-50%) rotate(7deg)}40%{transform:translate(-52%,-51%) rotate(12deg)}70%{transform:translate(-48%,-48%) rotate(4deg)}}
@keyframes artHelix{0%,100%{scale:1 1;filter:blur(0)}50%{scale:.86 1.08;filter:blur(.4px)}}
@keyframes artBreath{0%,100%{filter:blur(10px);opacity:.88;scale:.96}50%{filter:blur(13px);opacity:1;scale:1.04}}
@keyframes artDropA{0%,100%{translate:0 -3px;scale:1 .97}50%{translate:3px 5px;scale:.93 1.06}}
@keyframes artDropB{0%,100%{translate:0 4px;scale:.96 1.04}50%{translate:-2px -5px;scale:1.05 .94}}
@keyframes artRun{0%,100%{translate:0 8px;opacity:.55}50%{translate:8px -7px;opacity:1}}
@keyframes artScout{0%,100%{translate:-2px 3px}50%{translate:8px -7px}}

.strategy .topline{padding:0 4px}
.strategy .topline b{font-size:15px;letter-spacing:-.03em}
.strategy .money{font-size:30px;color:#0d1013!important;padding:0 4px;margin:12px 0 6px}
.strategy .mini,.strategy .truth{padding:0 4px}
.strategy .truth{color:#6f777e;font-size:10px;line-height:1.45;min-height:43px;text-transform:none;letter-spacing:.02em}
.strategy .pill{background:#f0f1f2;border-color:#d7dade;color:#5c636b}
.feed{max-height:525px}
.feedrow{grid-template-columns:90px 1fr;border-bottom:1px solid #e1e3e5;padding:11px 4px}
.table th,.table td{border-bottom:1px solid #e1e3e5;color:#22262b;padding:10px 8px}
.table th{background:rgba(249,250,250,.95);color:#858d95;text-transform:uppercase;letter-spacing:.08em;font-size:9px}
.token:hover{background:#eef0f1}
.meter{background:#e4e6e8;height:5px}.meter>i{background:linear-gradient(90deg,#6d7cff,#20d470)}
.bubble{border:1px solid #d0d4d7;background:radial-gradient(circle at 35% 30%,#fff,#e5e7e8 46%,#8c9298);color:#111;box-shadow:0 12px 26px rgba(20,26,32,.08)}
.worldNode{
  color:#454c53;background:#f5f6f6;border-color:#d8dbde;transition:.18s;box-shadow:0 3px 10px rgba(10,15,20,.035)
}
.worldNode:hover{background:#111;color:white;transform:translateY(-2px)}
.worldNode.hot{border-color:#7fe5a9;color:#148c47}.worldNode.risky{border-color:#f0aab3;color:#cb3e4f}
.ecosystem{padding:15px!important}
.smallcard{padding:12px;border-radius:14px!important;transition:transform .18s,box-shadow .18s}
.smallcard:hover{transform:translateY(-2px);box-shadow:0 12px 28px rgba(20,26,32,.08)}
.drawer{
  width:min(650px,96vw);background:rgba(248,249,249,.98);color:#111;border-left:1px solid #d1d5d8;
  padding:24px;box-shadow:-25px 0 70px rgba(25,32,40,.16);backdrop-filter:blur(24px)
}
.close{background:#fff;color:#1d2228;border-color:#d1d5d8;border-radius:999px;padding:8px 13px}
.controls select,select{background:white;color:#222;border-color:#d4d7da}
.vote{background:#f5f6f6;border-color:#d8dbde;color:#697078}.vote.y{border-color:#80dba5;color:#168c49}
.spark{filter:grayscale(.25)}
hr{border-color:#e0e3e5!important}

/* PUMP LAB X SIGNAL FEED */
.xFeedHero{display:grid;grid-template-columns:1.15fr .85fr;gap:12px;margin-bottom:12px}
.xFeedIntro{min-height:220px;display:flex;flex-direction:column;justify-content:space-between;padding:22px!important}
.xFeedTitle{font-size:clamp(46px,5.4vw,88px);font-weight:950;line-height:.84;letter-spacing:-.075em;text-transform:uppercase;margin:0}
.xFeedTitle span{color:#a7adb2;font-weight:600}
.xFeedIntro p{max-width:620px;color:#737b83;font-size:13px;line-height:1.55;margin:18px 0 0}
.xFeedStatus{display:flex;gap:7px;align-items:center;flex-wrap:wrap;margin-top:20px}
.xFeedStatus .dot{width:8px;height:8px;border-radius:50%;background:#20d470;box-shadow:0 0 0 5px rgba(32,212,112,.12)}
.xFeedAccounts{padding:18px!important;display:flex;flex-direction:column;justify-content:space-between}
.xHandleCloud{display:flex;gap:7px;flex-wrap:wrap;margin-top:14px}
.xHandle{border:1px solid #d6dade;background:#fbfcfc;color:#343a40;border-radius:999px;padding:7px 10px;font-size:9px;font-weight:850}
.xFeedGrid{display:grid;grid-template-columns:minmax(0,1fr) 310px;gap:12px;align-items:start}
.xTimeline{display:grid;gap:9px}.xPost{padding:16px!important;border-radius:18px!important;transition:transform .18s,box-shadow .18s,border-color .18s}
.xPost:hover{transform:translateY(-3px);border-color:#a8b0ff!important;box-shadow:0 18px 38px rgba(22,30,42,.09)}
.xPostHead{display:flex;align-items:center;gap:10px;margin-bottom:11px}.xAvatar{width:38px;height:38px;border-radius:50%;object-fit:cover;background:#e7e9ea;border:1px solid #d4d8db}
.xWho{min-width:0;flex:1}.xName{font-weight:900;font-size:12px}.xUser{font-size:10px;color:#8a9198;margin-top:2px}.xWhen{font:9px ui-monospace,SFMono-Regular,Menlo,monospace;color:#9aa0a6;white-space:nowrap}
.xText{font-size:14px;line-height:1.48;color:#15181b;white-space:pre-wrap;overflow-wrap:anywhere}
.xMedia{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:6px;margin-top:12px}.xMedia img{width:100%;max-height:330px;object-fit:cover;border-radius:12px;border:1px solid #d9dcdf;background:#eef0f0}
.xMetrics{display:flex;gap:14px;align-items:center;margin-top:12px;padding-top:10px;border-top:1px solid #e2e4e6;color:#7f878f;font-size:9px;font-weight:750}
.xOpen{margin-left:auto;color:#343a40;font-weight:900;text-decoration:none}.xOpen:hover{text-decoration:underline}
.xSidebar{position:sticky;top:126px;display:grid;gap:10px}.xPulse{height:170px;position:relative;overflow:hidden}
.xPulse:before{content:"";position:absolute;width:150px;height:150px;border-radius:44% 56% 61% 39%/45% 38% 62% 55%;left:50%;top:53%;transform:translate(-50%,-50%);background:radial-gradient(circle at 33% 27%,#fff,#d8dbde 37%,#8d949a 61%,#171a1e 85%);animation:artMorph 12s ease-in-out infinite alternate,artRotateSoft 25s ease-in-out infinite;box-shadow:18px 24px 45px rgba(0,0,0,.11)}
.xPulse:after{content:"SIGNAL";position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);font:900 11px ui-monospace,SFMono-Regular,Menlo,monospace;letter-spacing:.22em;color:white;text-shadow:0 2px 12px rgba(0,0,0,.65)}
.xEmpty{padding:34px;text-align:center;border:1px dashed #cfd3d6;border-radius:18px;color:#777f87;background:rgba(255,255,255,.55)}.xEmpty b{display:block;color:#14171a;font-size:17px;margin-bottom:7px}
.xRefresh{appearance:none;border:1px solid #d5d9dc;background:white;border-radius:999px;padding:8px 12px;font-size:9px;font-weight:900;letter-spacing:.06em;text-transform:uppercase;cursor:pointer}.xRefresh:hover{background:#111;color:white}
.xKeyword{display:inline-block;padding:2px 5px;border-radius:6px;background:#eceeff;color:#5262d8;font-size:9px;font-weight:800}
.xProfileGrid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}
.xProfileCard{background:rgba(250,251,251,.9);border:1px solid #d7dade;border-radius:18px;overflow:hidden;box-shadow:0 8px 28px rgba(22,29,36,.05);min-height:430px}
.xProfileHead{display:flex;align-items:center;justify-content:space-between;padding:12px 14px;border-bottom:1px solid #e0e3e5;background:rgba(255,255,255,.88)}
.xProfileName{font-weight:950;font-size:12px;letter-spacing:-.02em}.xProfileMode{font:8px ui-monospace,SFMono-Regular,Menlo,monospace;color:#939aa1;letter-spacing:.12em;text-transform:uppercase}
.xProfileOpen{font-size:9px;font-weight:900;color:#171a1d;text-decoration:none}.xProfileOpen:hover{text-decoration:underline}
.xProfilePosts{display:grid;gap:0;background:#fff}
.xProfilePost{padding:15px 16px;border-bottom:1px solid #eceeef}.xProfilePost:last-child{border-bottom:0}
.xProfilePost:hover{background:#fafbfb}
.xProfilePost .xPostHead{margin-bottom:9px}.xProfilePost .xAvatar{width:32px;height:32px}.xProfilePost .xText{font-size:13px;line-height:1.5}
.xProfilePost .xMetrics{margin-top:10px;padding-top:8px;gap:12px}
.xFeedSource{padding:10px 12px;border:1px solid #d7dade;border-radius:12px;background:#fafafa;color:#727a82;font-size:10px;line-height:1.45;margin-bottom:10px}
@media(max-width:980px){.xProfileGrid{grid-template-columns:1fr}}

@media(max-width:900px){.xFeedHero,.xFeedGrid{grid-template-columns:1fr}.xSidebar{position:static}.xFeedIntro{min-height:180px}}
.pane{animation:paneIn .28s ease}
@keyframes paneIn{from{opacity:0;transform:translateY(7px)}to{opacity:1;transform:none}}
@media(max-width:1050px){
  .masthead{grid-template-columns:1fr;min-height:auto}.masthead:after{display:none}.mastart{min-height:300px}.masttitle{font-size:clamp(60px,13vw,105px)}
}
@media(max-width:680px){
  .wrap{padding:0 15px 60px}.top{margin:0 -15px;padding:13px 15px}.sub{display:none}.masthead{margin:0 -15px;padding:38px 18px 26px}
  .mastart{min-height:240px}.maststatement{font-size:12px;width:130px}.hero{grid-template-columns:1fr}.tabs{top:57px;width:100%}
  .strategy{min-height:345px}.agentVisual{height:150px}.drawer{padding:16px}.grid4{grid-template-columns:1fr 1fr}
}
</style></head><body><div class="wrap"><div class="top"><div><div class="brand">PUMP LAB <span style="color:var(--blue)">/ LIVE</span></div><div class="sub">Autonomous Pump.fun & Solana paper-trading research laboratory</div></div><div class="badges"><span class="badge live">● REAL MARKET DATA</span><span class="badge">PAPER ONLY</span><span class="badge" id="version">LOADING</span></div></div>
<section class="masthead">
  <div class="mastcopy">
    <div class="kicker">Autonomous Trading Research Laboratory · 001</div>
    <h1 class="masttitle">PUMP LAB<span>/LIVE</span></h1>
    <p class="mastlede">A living market laboratory where autonomous agents study Pump.fun and Solana, compete for edge, learn from mistakes, and evolve in public.</p>
    <div class="statusrail"><div class="statusswitch"><i></i> Live market data</div><div class="statusswitch">Paper only</div><span class="statusnote">AI agents · market memory · shadow execution · evolution</span></div>
  </div>
  <div class="mastart magicOrb" id="magicOrb" role="button" tabindex="0" aria-label="Ask the Pump Lab oracle" title="Ask the Pump Lab oracle">
    <div class="mastindex">01 / SYSTEM<br>02 / AGENTS<br>03 / MARKETS<br>04 / MEMORY</div>
    <div class="mastwords">DATA<br>AGENTS<br>MARKETS<br>IDEAS<br>SIMULATION<br>EVOLUTION</div>
    <div class="oracleAnswer" id="oracleAnswer" aria-live="polite"></div>
<div class="maststatement">Trading the next generation of tokens.</div><div class="mastline"></div>
  </div>
</section>
<div class="hero"><div><div class="muted">CHAMPION CHALLENGE</div><div class="big" id="champ">Loading…</div><div class="muted" id="champMeta"></div><div class="meter" style="margin-top:12px"><i id="champBar"></i></div></div><div><div class="muted">MARKET WEATHER</div><div class="big" id="weather">Loading…</div><div class="mini" id="weatherMeta"></div></div></div>
<div class="grid4"><div class="card"><div class="muted">LAB CAPITAL</div><div class="big" id="capital">Loading…</div><div class="mini" id="capitalDelta"></div></div><div class="card"><div class="muted">PAPER EXITS</div><div class="big" id="tradeCount">—</div><div class="mini" id="decisionCount"></div></div><div class="card"><div class="muted">OPEN POSITIONS</div><div class="big" id="open">—</div><div class="mini">across production agents</div></div><div class="card"><div class="muted">TOKENS OBSERVED</div><div class="big" id="tokenCount">—</div><div class="mini" id="uptime"></div></div></div>
<div class="card health" id="health"><span>Dashboard: <b class="amber">loading state…</b></span></div><div class="tabs" id="tabs"><div class="tab on" data-p="war">War Room</div><div class="tab" data-p="radar">Token Lab</div><div class="tab" data-p="intel">Intelligence</div><div class="tab" data-p="planet">The World</div><div class="tab" data-p="research">Research Lab</div><div class="tab" data-p="time">Time Machine</div><div class="tab" data-p="xfeed">X Feed</div></div>
<div class="pane on" id="war"><div class="sectionTitle"><h2>Autonomous Traders</h2><p>Same market. Same $1,000 start. Different personalities.</p></div><div class="strategies" id="strats"></div><div class="two" style="margin-top:12px"><div class="card"><h3>LIVE ACTIVITY</h3><div class="feed" id="feed"></div></div><div class="card"><h3>NARRATIVE RADAR</h3><div id="narrMini"></div></div></div></div>
<div class="pane" id="radar"><div class="two"><div class="card scroll"><table class="table"><thead><tr><th>Token</th><th>MC</th><th>Liq</th><th>Score</th><th>Risk</th><th>Quality</th><th>Consensus</th><th>Source</th></tr></thead><tbody id="tokenRows"></tbody></table></div><div class="card"><h3>DETECTIVE WATCH</h3><div id="detectiveList"></div></div></div></div>
<div class="pane" id="intel"><div class="card"><div class="sectionTitle"><h2>🌎 Narrative World</h2><p>Heat = momentum + buyer pressure + volume + fresh launches − saturation</p></div><div class="world" id="world"></div></div><div class="two" style="margin-top:12px"><div class="card scroll"><h3>CREATOR DNA · OBSERVED BY PUMP LAB</h3><table class="table"><thead><tr><th>Creator</th><th>Launches</th><th>Best X</th><th>Collapses</th><th>Graduations</th></tr></thead><tbody id="creators"></tbody></table></div><div class="card"><h3>DATA TRUTH</h3><div id="truth"></div></div></div><div class="card" style="margin-top:12px"><h3>👀 FOMO SMART-WALLET WATCHLIST</h3><div class="mini">Requested Fomo identities. Only corroborated public Solana mappings are subscribed; unresolved identities stay labeled resolving instead of being guessed.</div><div class="scroll"><table class="table"><thead><tr><th>Trader</th><th>Status</th><th>Wallets</th><th>Events</th><th>Buys</th><th>Sells</th><th>Tokens</th><th>Marked</th><th>Last</th></tr></thead><tbody id="fomoWatchlist"></tbody></table></div></div>
<div class="two" style="margin-top:12px"><div class="card"><h3>⚡ FOMO WATCHLIST · RECENT ON-CHAIN ACTIVITY</h3><div class="mini">BUY/SELL requires Pump.fun evidence or token + native SOL direction. Otherwise PUMP LAB reports TOKEN IN/OUT rather than inventing a trade.</div><div class="scroll"><table class="table"><thead><tr><th>Trader</th><th>Action</th><th>Token</th><th>Token Δ</th><th>SOL Δ</th><th>When</th></tr></thead><tbody id="fomoEvents"></tbody></table></div></div><div class="card"><h3>🔭 GLOBAL WALLET ACTIVITY · ON-CHAIN OBSERVED</h3><div class="mini">Direct Solana observations. Marked return is inferred from token price when first observed, not a claim of realized wallet P&L.</div><div class="scroll"><table class="table"><thead><tr><th>Wallet</th><th>Events</th><th>Buys</th><th>Sells</th><th>Tokens</th><th>Marked</th><th>Score</th></tr></thead><tbody id="walletBoard"></tbody></table></div></div></div></div>
<div class="pane" id="planet"><div class="card"><div class="sectionTitle"><h2>🌎 THE WORLD</h2><p>A live map of the token economy PUMP LAB can actually observe.</p></div><div id="worldStats" class="grid4"></div><div id="tokenWorld" class="worldGrid" style="margin-top:12px"></div></div><div class="two" style="margin-top:12px"><div class="card"><h3>🔥 WORLD LEADERS</h3><div id="worldLeaders"></div></div><div class="card"><h3>⚠️ WORLD RISKS</h3><div id="worldRisks"></div></div></div></div>
<div class="pane" id="research"><div class="three"><div class="card"><h3>🧪 CHALLENGERS</h3><div id="experiments"></div></div><div class="card"><h3>🚀 MISSED MONSTERS</h3><div id="missed"></div></div><div class="card"><h3>🛟 SAVED MY ASS</h3><div id="saved"></div></div></div><div class="two" style="margin-top:12px"><div class="card"><h3>🏆 HALL OF FAME</h3><div id="hall"></div></div><div class="card"><h3>🧬 TRADE AUTOPSIES</h3><div id="autopsies"></div></div></div><div class="card" style="margin-top:12px"><h3>RESEARCH DIRECTOR</h3><div id="researchText"></div></div><div class="card" style="margin-top:12px"><h3>🧯 PROCESS AUDIT & LIVE LAUNCH GATE</h3><div id="auditBoard"></div></div>
<div class="card" style="margin-top:12px"><div class="sectionTitle"><h2>🧠 ALPHA OS · 12 SYSTEM STACK</h2><p>Wallet profitability/copyability, independent consensus, safety filtering, execution reality, probability, capital allocation and adaptive exits. Paper/shadow only.</p></div><div id="alphaOSBoard"></div></div>
<div class="card" style="margin-top:12px"><div class="sectionTitle"><h2>MEME / CHART THEORY LAB</h2><p>Path quality, lifecycle and meme-market structure research. Paper only.</p></div><div id="memeChartLab"></div></div>
<div class="card" style="margin-top:12px"><div class="sectionTitle"><h2>⚗️ HYPOTHESIS ARENA</h2><p>10 falsifiable momentum experiments. Separate paper bankrolls. 80/20 holdout. Bad ideas retire; promising ideas remain paper-only candidates.</p></div><div id="hypothesisArena"></div></div>
<div class="card" style="margin-top:12px"><div class="sectionTitle"><h2>🧪 SPECIALIST COHORT LAB</h2><p>Isolated cohort traders testing market cap, age, liquidity, flow, metadata, creator DNA, regime and lifecycle populations.</p></div><div id="specialistCohorts"></div></div>
<div class="three" style="margin-top:12px"><div class="card"><h3>🎯 CONFIDENCE CALIBRATION</h3><div id="calibration"></div></div><div class="card"><h3>🆚 BENCHMARKS</h3><div id="benchmarks"></div></div><div class="card"><h3>🧬 EVOLUTION</h3><div id="evolution"></div></div></div>
<div class="grid4" style="margin-top:12px"><div class="card"><h3>ENTRY LAB</h3><div id="entryLab"></div></div><div class="card"><h3>EXIT LAB</h3><div id="exitLab"></div></div><div class="card"><h3>SIZING LAB</h3><div id="sizingLab"></div></div><div class="card"><h3>EXECUTION STRESS</h3><div id="executionLab"></div></div></div>
<div class="two" style="margin-top:12px"><div class="card"><h3>👁 GOD BOT · UPPER BOUND</h3><div id="godBot"></div></div><div class="card"><h3>🧠 MARKET ARCHETYPE MEMORY</h3><div id="archetypes"></div></div></div>
<div class="card" style="margin-top:12px"><h3>☠️ STRATEGY GRAVEYARD / PROMOTIONS</h3><div id="graveyard"></div></div>
<div class="three" style="margin-top:12px"><div class="card"><h3>🧭 ADAPTIVE MASTER ALLOCATION</h3><div id="masterAllocation"></div></div><div class="card"><h3>🤝 SIGNAL COALITIONS</h3><div id="coalitions"></div></div><div class="card"><h3>⏱ HOLD-TIME LAB</h3><div id="holdTime"></div></div></div>
<div class="two" style="margin-top:12px"><div class="card"><h3>🌦 REGIME LEADERBOARD</h3><div id="regimeMatrix"></div></div><div class="card"><h3>🏁 24H GRAND PRIX / RISK BOARD</h3><div id="tournament"></div><hr style="border-color:#223047"><div id="riskBoard"></div></div></div>
<div class="three" style="margin-top:12px"><div class="card"><h3>🧬 SIGNAL INDEPENDENCE</h3><div id="correlation"></div></div><div class="card"><h3>🛡 NO-TRADE ALPHA</h3><div id="noTrade"></div></div><div class="card"><h3>🌪 CHAOS LAB</h3><div id="chaos"></div></div></div>
<div class="card" style="margin-top:12px"><h3>📡 DATA INTEGRITY</h3><div id="providerAudit"></div></div></div>
<div class="pane" id="time"><div class="card"><div class="sectionTitle"><h2>⏪ Time Machine</h2><p>Immutable periodic snapshots of what the lab knew then.</p></div><div class="controls"><select id="timeSelect"></select><span class="muted" id="timeView"></span></div><div id="timeCards" class="grid4"></div></div><div class="card" style="margin-top:12px"><h3>🎞 ROLLING MARKET REPLAY</h3><div id="marketReplay"></div></div><div class="card" style="margin-top:12px"><h3>TRUTH LEDGER · RECENT DECISIONS</h3><div class="scroll"><table class="table"><thead><tr><th>Time</th><th>Agent</th><th>Token</th><th>Decision</th><th>Score</th><th>Risk</th><th>Why</th></tr></thead><tbody id="ledger"></tbody></table></div></div></div>

<div class="pane" id="xfeed">
  <div class="xFeedHero">
    <div class="card xFeedIntro">
      <div><div class="kicker">CURATED INTELLIGENCE · X / TWITTER</div><h2 class="xFeedTitle">SIGNAL<span>/FEED</span></h2><p>A private market-intelligence wall made only from the X accounts you choose. Public live timelines work without an API key; richer merged intelligence can layer on later.</p></div>
      <div class="xFeedStatus"><span class="dot"></span><b id="xFeedState">WAITING FOR CONFIG</b><span class="muted" id="xFeedUpdated"></span><button class="xRefresh" onclick="loadXFeed(true)">Refresh</button></div>
    </div>
    <div class="card xFeedAccounts"><div><div class="muted" style="font-size:9px;font-weight:900;letter-spacing:.13em">WATCHING</div><div class="xHandleCloud" id="xFeedHandles"><span class="xHandle">Add your accounts</span></div></div><div class="mini">Public embed mode requires no API key. If API access is connected later, Pump Lab automatically upgrades to a merged newest-first intelligence feed.</div></div>
  </div>
  <div class="xFeedGrid">
    <div class="xTimeline" id="xTimeline"><div class="xEmpty"><b>X Signal Feed is ready.</b>Add your chosen accounts and X API credentials to switch the stream on.</div></div>
    <div class="xSidebar"><div class="card xPulse"></div><div class="card"><h3>FEED RULES</h3><div class="mini">Selected accounts only · official X embeds · no API required · direct links back to X · merged feed upgrade ready.</div></div><div class="card"><h3>LIVE SIGNALS</h3><div id="xSignalSummary" class="mini">No feed data yet.</div></div></div>
  </div>
</div></div><div class="drawer" id="drawer"><button class="close" onclick="closeDrawer()">Close</button><div id="drawerBody"></div></div><script>
const $=x=>document.getElementById(x);const money=n=>'$'+Number(n||0).toLocaleString(undefined,{maximumFractionDigits:0});const one=n=>Number(n||0).toFixed(1);let S=null;
const BROWSER_STATE_KEY='pump-lab:last-good-state:v2',LIVE_BACKEND_ORIGIN='https://pump-lab-live.onrender.com';let showingCachedState=false;
function age(ms){const m=Math.max(0,Date.now()-ms)/60000;if(m<60)return m.toFixed(0)+'m';return(m/60).toFixed(1)+'h'}function esc(x){return String(x??'').replace(/[&<>]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[c]))}
function saveBrowserState(state){try{localStorage.setItem(BROWSER_STATE_KEY,JSON.stringify({savedAt:Date.now(),state}))}catch{}}
function restoreBrowserState(){try{const raw=localStorage.getItem(BROWSER_STATE_KEY);if(!raw)return false;const row=JSON.parse(raw);if(!row?.state?.summary||!Array.isArray(row.state.strategies))return false;render(row.state);showingCachedState=true;$('version').textContent='CACHED SNAPSHOT';const h=$('health');if(h)h.innerHTML='<span class="amber">LAST GOOD SNAPSHOT · waking the live engine now…</span>';return true}catch{return false}}
function wakeLiveBackend(){if(location.hostname==='pump-lab-live.onrender.com')return;try{fetch(LIVE_BACKEND_ORIGIN+'/api/health?wake='+Date.now(),{mode:'no-cors',cache:'no-store',keepalive:true}).catch(()=>{})}catch{}}

const TRADER_ART_PROFILES={
  banker:'art-banker',quant:'art-quant',smart:'art-smart',social:'art-social',momentum:'art-momentum',
  graduation:'art-graduation',dip:'art-dip',swing:'art-swing',degen:'art-degen',smartmom:'art-smartmom',
  culture:'art-culture',contrarian:'art-contrarian',sniper:'art-sniper',champion:'art-champion',
  professional:'art-professional',adaptive:'art-adaptive',copy_unipcs:'art-unipcs',copy_frank:'art-frank',
  copy_orangie:'art-orangie',copy_rasmr:'art-rasmr',wallet_consensus:'art-consensus',
  confirmed_runner:'art-runner',asym_swing:'art-asym',copy_megga:'art-megga',megga_scout:'art-scout'
};
function traderArt(id){
  const fixed=TRADER_ART_PROFILES[id];if(fixed)return{cls:fixed,style:''};
  let h=2166136261>>>0;for(const ch of String(id||'')){h^=ch.charCodeAt(0);h=Math.imul(h,16777619)>>>0;}
  const n=(shift,min,max)=>min+((h>>>shift)%1000)/999*(max-min);
  const style=[
    '--aw:'+n(0,76,138).toFixed(0)+'px','--ah:'+n(3,72,139).toFixed(0)+'px',
    '--ax:'+n(6,39,61).toFixed(1)+'%','--ay:'+n(9,42,60).toFixed(1)+'%',
    '--rot:'+n(12,-23,23).toFixed(1)+'deg','--brot:'+n(15,-70,70).toFixed(1)+'deg',
    '--grad:'+n(18,105,230).toFixed(0)+'deg','--dur:'+n(21,8,19).toFixed(1)+'s',
    '--bw:'+n(5,88,168).toFixed(0)+'px','--dot:'+n(11,7,17).toFixed(0)+'px',
    '--cx:'+n(16,22,80).toFixed(1)+'%','--cy:'+n(20,18,74).toFixed(1)+'%',
    '--r1:'+n(2,28,68).toFixed(0)+'%','--r2:'+n(7,32,72).toFixed(0)+'%',
    '--r3:'+n(13,30,70).toFixed(0)+'%','--r4:'+n(19,27,73).toFixed(0)+'%'
  ].join(';');
  return{cls:'art-future',style};
}
function traderArtMarkup(x,i){
  const a=traderArt(x.id),idx=String(i+1).padStart(2,'0');
  return '<div class="agentVisual '+a.cls+'" data-art="'+esc(x.id)+'" style="'+a.style+'"><i class="shapeA"></i><i class="shapeB"></i><i class="shapeC"></i><span class="agentIndex">'+idx+' / AGENT</span><span class="agentLive"></span></div>';
}
function render(s){S=s;$('version').textContent=s.version;$('capital').textContent=money(s.summary.capital);$('capitalDelta').textContent=(s.summary.capital>=s.summary.start?'+':'')+money(s.summary.capital-s.summary.start)+' vs start';$('tradeCount').textContent=s.summary.trades;$('decisionCount').textContent=s.summary.decisions+' immutable decisions recorded';$('open').textContent=s.summary.open;$('tokenCount').textContent=s.summary.tokens;$('uptime').textContent='engine up '+age(s.startedAt);const c=s.strategies.find(x=>x.id==='champion');$('champ').textContent=money(c.equity)+' → $100,000 ('+(c.equity/100000*100).toFixed(2)+'%)';$('champMeta').textContent='P&L '+(c.equity>=1000?'+':'')+money(c.equity-1000)+' · max DD '+one(c.dd)+'% · '+c.n+' exits';$('champBar').style.width=Math.min(100,c.equity/100000*100)+'%';$('weather').textContent=s.weather.regime+' · '+one(s.weather.temperature)+'/100';$('weatherMeta').textContent='buy pressure '+one(s.weather.buyPressure)+'% · launch velocity '+one(s.weather.launchVelocity)+'/min · collapse rate '+one(s.weather.collapseRate)+'%';
$('health').innerHTML=s.providers.map(x=>'<span>'+esc(x.component)+': <b class="'+(x.status==='ok'?'green':x.status==='warn'?'amber':'')+'">'+esc(x.status)+'</b><small class="muted"> · '+esc(x.detail)+'</small></span>').join('');
$('strats').innerHTML=s.strategies.filter(x=>x.risk!=='CONTROL'&&(!x.specialist||['hyp_grad_fortress','hyp_grad_rebound','hyp_grad_outlier','velocity_scalper','minute_sub100','minute_100_250','minute_500_1m'].includes(x.id))).map((x,i)=>'<div class="card strategy" data-bot="'+esc(x.id)+'" onclick="openBotProfile(this.dataset.bot)">'+traderArtMarkup(x,i)+'<div class="topline"><b>'+x.icon+' '+esc(x.name)+'</b><span class="pill">'+esc(x.risk)+'</span></div><div class="money '+(x.equity>=1000?'green':'red')+'">'+money(x.equity)+'</div><div class="mini">'+x.n+' exits · '+one(x.winRate)+'% wins · '+one(x.dd)+'% max DD · '+x.open+' open</div><div class="mini">entry gate '+one(x.effectiveMin)+(x.coldStart&&x.thresholdRelief?' <span class="amber">(cold-start −'+one(x.thresholdRelief)+')</span>':'')+' · '+x.entryRejects+' rejects</div><div class="truth" style="margin-top:8px">'+esc(x.playbook||x.thesis)+'</div><div class="mini" style="margin-top:6px">'+esc(x.era||'current era')+' exits '+(x.eraN||0)+' · '+one(x.eraWinRate||0)+'% wins · era P&L '+((x.eraPnl||0)>=0?'+':'')+money(x.eraPnl||0)+' · avg '+one(x.eraAvgPnl||0)+'%</div></div>').join('');
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

const au=s.audit||{};$('auditBoard').innerHTML='<div class="big '+(au.liveReady?'green':'amber')+'">'+esc(au.status||'AUDITING')+'</div><div class="mini" style="margin:8px 0">Audit '+esc(au.auditVersion||'')+' · live gate is intentionally stricter than paper profitability.</div>'+
    ((au.critical||[]).length?'<div class="red"><b>BLOCKERS</b><br>'+au.critical.map(x=>'• '+esc(x)).join('<br>')+'</div>':'<div class="green">No critical system blockers.</div>')+
    ((au.warnings||[]).length?'<div class="amber" style="margin-top:8px"><b>WARNINGS</b><br>'+au.warnings.map(x=>'• '+esc(x)).join('<br>')+'</div>':'')+
    '<div class="mini" style="margin-top:8px">'+(au.qualifiedStrategies||[]).length+' strategies currently meet the minimum holdout gate · '+(au.runtime?.stalePositions||0)+' stale positions · state '+Math.round((au.runtime?.stateBytes||0)/1024)+' KB / '+one(au.runtime?.stateBuildMs||0)+' ms</div>';const aos=s.alphaOS||{subsystems:[],master:{},shadow:{},forecasts:{},wallets:{},world:{},execution:{}};
const walletQ=(aos.wallets?.qualityLeaderboard||[]).slice(0,8);$('alphaOSBoard').innerHTML='<div class="grid4"><div class="smallcard"><span class="muted">CIO EQUITY</span><div class="big">'+money(aos.master?.equity||0)+'</div><div class="mini">'+(aos.master?.trades||0)+' exits · '+(aos.master?.open||0)+' open</div></div><div class="smallcard"><span class="muted">SHADOW INTENTS</span><div class="big">'+(aos.shadow?.intents||0)+'</div><div class="mini">5s execution drift '+one(aos.shadow?.avg5s||0)+'%</div></div><div class="smallcard"><span class="muted">FORECAST MEMORY</span><div class="big">'+(aos.forecasts?.settledTrain||0)+'</div><div class="mini">settled training forecasts</div></div><div class="smallcard"><span class="muted">WALLET GRAPH</span><div class="big">'+(aos.wallets?.nodes||0)+'</div><div class="mini">'+(aos.wallets?.closedProxyTrades||0)+' realized proxy closes</div></div></div><div class="smallcard" style="margin-top:10px"><b>SMART WALLET QUALITY</b><div class="mini">Only repeatable, copyable behavior earns trust. PROVEN requires 200 evidence samples.</div>'+((walletQ.length?walletQ.map((w,i)=>'<div class="mini" style="margin-top:6px"><b>'+(i+1)+'. '+esc(w.wallet.slice(0,6))+'…'+esc(w.wallet.slice(-4))+'</b> · Q'+one(w.score)+' · '+esc(w.evidenceTier)+' · copy '+one(w.copyability)+' · PF '+one(w.profitFactor)+' · '+w.uniqueMints+' tokens'+(w.excluded?' · <span class="red">EXCLUDED</span>':'')+'</div>').join(''):'<div class="muted" style="margin-top:6px">Collecting realized wallet evidence.</div>'))+'</div><div class="worldGrid" style="margin-top:10px">'+(aos.subsystems||[]).map(x=>'<div class="smallcard"><b>'+x.id+'. '+esc(x.name)+'</b><span style="float:right" class="'+(x.active?'green':'amber')+'">'+(x.active?'ACTIVE':'COLLECTING')+'</span><div class="mini" style="margin-top:6px">'+esc(x.detail)+'</div></div>').join('')+'</div>';
const mcl=s.memeChartLab||{traders:[]};
$('memeChartLab').innerHTML=(mcl.traders||[]).map(x=>'<div class="smallcard" style="margin:7px 0"><b>'+esc(x.name)+'</b><span style="float:right">'+money(x.equity)+'</span><div class="mini">'+x.n+' exits · '+one(x.winRate)+'% wins · '+x.eligibleNow+' eligible now</div><div class="truth">'+esc(x.thesis)+'</div></div>').join('')||'<div class="muted">Collecting chart and meme-structure evidence.</div>';
const ha=s.hypothesisArena||{rows:[],count:0,promising:0,retired:0,collecting:0,capital:0,start:0};
$('hypothesisArena').innerHTML='<div class="grid4"><div class="smallcard"><span class="muted">EXPERIMENTS</span><div class="big">'+ha.count+'</div></div><div class="smallcard"><span class="muted">COLLECTING</span><div class="big">'+ha.collecting+'</div></div><div class="smallcard"><span class="muted">PROMISING</span><div class="big green">'+ha.promising+'</div></div><div class="smallcard"><span class="muted">RETIRED</span><div class="big red">'+ha.retired+'</div></div></div><div class="worldGrid" style="margin-top:10px">'+ha.rows.map(x=>'<div class="smallcard"><div><b>'+esc(x.icon)+' '+esc(x.name)+'</b><span style="float:right" class="'+(x.status.includes('PROMISING')?'green':x.status.includes('RETIR')?'red':'amber')+'">'+esc(x.status)+'</span></div><div class="mini" style="margin-top:6px">'+x.n+' exits · '+x.holdoutN+' holdout · '+one(x.dd)+'% DD · '+x.eligibleNow+' eligible now</div><div class="mini">equity '+money(x.equity)+' · holdout avg '+(x.holdoutMean>=0?'+':'')+one(x.holdoutMean)+'% · PF '+one(x.holdoutPF)+'</div><div class="truth" style="margin-top:7px">'+esc(x.thesis)+'</div><div class="mini" style="margin-top:5px">'+esc(x.reason)+'</div></div>').join('')+'</div>';
const sc=s.specialistCohorts||{groups:[],capital:0,start:0,trades:0,open:0,count:0};
$('specialistCohorts').innerHTML='<div class="grid4"><div class="smallcard"><span class="muted">SPECIALISTS</span><div class="big">'+sc.count+'</div></div><div class="smallcard"><span class="muted">COHORT CAPITAL</span><div class="big">'+money(sc.capital)+'</div><div class="mini">'+(sc.capital>=sc.start?'+':'')+money(sc.capital-sc.start)+' vs cohort start</div></div><div class="smallcard"><span class="muted">COHORT EXITS</span><div class="big">'+sc.trades+'</div></div><div class="smallcard"><span class="muted">OPEN</span><div class="big">'+sc.open+'</div></div></div>'+sc.groups.map(g=>'<div class="ecosystem" style="margin-top:10px"><div><b>'+esc(g.name)+'</b><span style="float:right" class="'+(g.capital>=g.start?'green':'red')+'">'+money(g.capital)+' / '+money(g.start)+'</span></div><div class="mini">'+g.closed+' exits · '+g.open+' open</div><div class="worldGrid" style="margin-top:9px">'+g.traders.map(x=>'<div class="smallcard"><div><b>'+x.icon+' '+esc(x.name)+'</b><span style="float:right" class="'+(x.equity>=1000?'green':'red')+'">'+money(x.equity)+'</span></div><div class="mini">'+x.n+' exits · '+one(x.winRate)+'% wins · '+one(x.dd)+'% DD · '+x.eligibleNow+' eligible now</div><div class="truth" style="margin-top:6px">'+esc(x.thesis)+'</div></div>').join('')+'</div></div>').join('');
renderTime(s.timeline);$('ledger').innerHTML=s.decisions.slice(0,120).map(d=>'<tr><td>'+new Date(d.ts).toLocaleTimeString()+'</td><td>'+esc(d.strategyName)+'</td><td>$'+esc(d.symbol)+'</td><td class="'+(d.action==='BUY'?'green':'muted')+'">'+d.action+'</td><td>'+one(d.score)+'</td><td>'+one(d.risk)+'</td><td class="muted">'+esc(d.why)+'</td></tr>').join('');}
function listOpp(a,key,positive,empty){return a.slice(0,10).map(o=>'<div class="smallcard" style="margin:7px 0"><b>$'+esc(o.symbol)+' · '+esc(o.strategyName)+'</b><span style="float:right" class="'+(positive?'green':'red')+'">'+(o[key]>=0?'+':'')+one(o[key])+'%</span><div class="mini">rejected: '+esc(o.why)+'</div></div>').join('')||'<div class="muted">'+empty+'</div>'}
function openToken(mint){const t=S.tokens.find(x=>x.mint===mint);if(!t)return;const hist=t.history||[];const pts=hist.slice(-45).map(x=>x.price).concat(t.price);const min=Math.min(...pts),max=Math.max(...pts);const path=pts.map((p,i)=>{const x=pts.length<2?0:i/(pts.length-1)*500;const y=80-((p-min)/(max-min||1))*70;return x+','+y}).join(' ');$('drawerBody').innerHTML='<h2>$'+esc(t.symbol)+'</h2><div class="muted">'+esc(t.name)+'</div><svg class="spark" viewBox="0 0 500 90"><polyline fill="none" stroke="#63f4a4" stroke-width="3" points="'+path+'"/></svg><div class="grid4" style="grid-template-columns:1fr 1fr"><div class="smallcard">MC<br><b>'+money(t.mc)+'</b></div><div class="smallcard">Liquidity<br><b>'+money(t.liq)+'</b></div><div class="smallcard">Data Quality<br><b>'+one(t.quality.score)+' · '+esc(t.quality.level)+'</b></div><div class="smallcard">Detective<br><b>'+esc(t.detective.verdict)+' '+one(t.detective.score)+'</b></div><div class="smallcard">Consensus<br><b>'+t.consensus.yes+'/'+t.consensus.total+'</b></div></div><h3>Agent Consensus</h3>'+t.consensus.votes.map(v=>'<span class="vote '+(v.yes?'y':'n')+'">'+v.icon+' '+esc(v.name)+' '+one(v.score)+'</span>').join('')+'<h3>AI Detective</h3><p>'+esc((t.detective.flags||[]).join(' · ')||'No major observed red flags.')+'</p><div class="muted">Unknown until deeper streams are connected: '+esc((t.detective.unknown||[]).join(', '))+'</div><h3>Creator DNA</h3><p>'+t.dna.launches+' observed launches · best observed '+one(t.dna.bestPeakX)+'× · '+t.dna.collapses+' collapses · '+t.dna.graduates+' graduations</p><h3>Signal Breakdown</h3><p>Momentum '+one(t.features.momentum)+' · Flow '+one(t.features.flow)+' · Volume '+one(t.features.volScore)+' · Liquidity '+one(t.features.liqScore)+' · Social metadata '+one(t.features.social)+' · Source quality '+one(t.features.sourceQuality)+'</p>';$('drawer').classList.add('on')}
async function openBotProfile(id){
  $('drawerBody').innerHTML='<h2>Loading bot profile...</h2><div class="muted">Pulling full retained trade ledger.</div>';
  $('drawer').classList.add('on');
  try{
    const r=await fetch('/api/bot?id='+encodeURIComponent(id)+'&format=html',{cache:'no-store'});
    if(!r.ok)throw new Error('bot profile HTTP '+r.status);
    $('drawerBody').innerHTML=await r.text();
  }catch(e){
    $('drawerBody').innerHTML='<h2>Bot profile unavailable</h2><p class="red">'+esc(e&&e.message?e.message:e)+'</p>';
  }
}
function closeDrawer(){$('drawer').classList.remove('on')}function renderTime(tl){const sel=$('timeSelect');const old=sel.value;sel.innerHTML=tl.slice().reverse().map((x,i)=>'<option value="'+(tl.length-1-i)+'">'+new Date(x.ts).toLocaleTimeString()+' · '+x.regime+'</option>').join('');if(old)sel.value=old;sel.onchange=showTime;showTime()}function showTime(){if(!S||!S.timeline.length)return;const i=Number($('timeSelect').value||S.timeline.length-1);const t=S.timeline[i]||S.timeline.at(-1);$('timeView').textContent=new Date(t.ts).toLocaleString();$('timeCards').innerHTML='<div class="card"><div class="muted">LAB CAPITAL</div><div class="big">'+money(t.capital)+'</div></div><div class="card"><div class="muted">CHAMPION</div><div class="big">'+money(t.champion)+'</div></div><div class="card"><div class="muted">REGIME</div><div class="big">'+esc(t.regime)+'</div></div><div class="card"><div class="muted">TOP NARRATIVE</div><div class="big">'+esc(t.topNarrative)+'</div></div>'}
let stateLoading=false,stateFailures=0;
async function go(){
  if(stateLoading)return;stateLoading=true;
  const firstLoad=!S,controller=new AbortController(),timer=setTimeout(()=>controller.abort(),firstLoad?60000:20000);
  if(firstLoad){$('version').textContent='WAKING ENGINE';const h=document.getElementById('health');if(h)h.innerHTML='<span class="amber">ENGINE WAKING · restoring the latest durable paper-trading state…</span>';}
  try{
    const r=await fetch('/api/state',{cache:'no-store',signal:controller.signal});
    const payload=await r.json().catch(()=>({}));
    if(!r.ok)throw new Error(payload?.error||('state HTTP '+r.status));
    render(payload);showingCachedState=false;saveBrowserState(payload);stateFailures=0;
  }catch(e){
    stateFailures++;console.error('PUMP LAB render error',e);wakeLiveBackend();
    const h=document.getElementById('health');
    if(showingCachedState&&S){$('version').textContent='CACHED SNAPSHOT';if(h)h.innerHTML='<span class="amber">LAST GOOD SNAPSHOT · LIVE ENGINE WAKING · retry '+stateFailures+'</span>';}
    else{$('version').textContent=firstLoad?'WAKING ENGINE':'RETRYING';if(h)h.innerHTML='<span class="bad">DASHBOARD DATA RETRYING · '+esc(e?.message||e)+' · attempt '+stateFailures+'</span>';}
  }finally{clearTimeout(timer);stateLoading=false;}
}
restoreBrowserState();wakeLiveBackend();go();setInterval(go,15000);const es=new EventSource('/api/events');es.addEventListener('tick',()=>go());let deepLoading=false,deepLoadedAt=0;
async function loadDeepResearch(){
  if(deepLoading||Date.now()-deepLoadedAt<300000)return;deepLoading=true;
  try{
    const r=await fetch('/api/research',{cache:'no-store'});if(!r.ok)throw new Error('research HTTP '+r.status);
    const deep=await r.json();if(S){Object.assign(S,deep);render(S);saveBrowserState(S);}deepLoadedAt=Date.now();
  }catch(e){console.error('PUMP LAB deep research error',e);}
  finally{deepLoading=false;}
}

let xFeedTimer=null,xFeedLoading=false;
function xNum(n){n=Number(n||0);if(n>=1000000)return(n/1000000).toFixed(1)+'M';if(n>=1000)return(n/1000).toFixed(1)+'K';return String(n)}
function xHighlight(t){return esc(t||'').replace(/(\$[A-Za-z][A-Za-z0-9]{1,12}|#[A-Za-z0-9_]{2,30})/g,'<span class="xKeyword">$1</span>')}

function xPostHtml(p,compact=false){
  const m=p.metrics||{},media=p.media||[],author=p.author||{},avatar=author.profileImage?'<img class="xAvatar" src="'+esc(author.profileImage)+'" alt="">':'<div class="xAvatar"></div>',mediaHtml=media.length?'<div class="xMedia">'+media.slice(0,4).filter(x=>x.url).map(x=>'<img src="'+esc(x.url)+'" alt="">').join('')+'</div>':'';
  return '<article class="'+(compact?'xProfilePost':'card xPost')+'"><div class="xPostHead">'+avatar+'<div class="xWho"><div class="xName">'+esc(author.name||author.username||'')+'</div><div class="xUser">@'+esc(author.username||'')+'</div></div><div class="xWhen">'+(p.createdAt?new Date(p.createdAt).toLocaleString():'')+'</div></div><div class="xText">'+xHighlight(p.text)+'</div>'+mediaHtml+'<div class="xMetrics"><span>♡ '+xNum(m.like_count)+'</span><span>↻ '+xNum(m.retweet_count)+'</span><span>◌ '+xNum(m.reply_count)+'</span><span>◈ '+xNum(m.quote_count)+'</span><a class="xOpen" href="'+esc(p.url)+'" target="_blank" rel="noopener">OPEN ↗</a></div></article>';
}
function renderXFeed(data){
  const handles=data.handles||[],posts=data.posts||[],source=data.source||'';
  $('xFeedHandles').innerHTML=handles.length?handles.map(h=>'<span class="xHandle">@'+esc(h)+'</span>').join(''):'<span class="xHandle">No accounts configured</span>';
  $('xFeedState').textContent=data.configured?(data.ok?'LIVE · '+posts.length+' POSTS':'FEED RETRYING'):'WAITING FOR CONFIG';
  $('xFeedState').className=data.ok?'green':data.configured?'amber':'amber';
  $('xFeedUpdated').textContent=data.fetchedAt?' · refreshed '+age(data.fetchedAt):'';
  if(!data.configured){$('xTimeline').innerHTML='<div class="xEmpty"><b>No accounts configured.</b>Add X handles to start the Pump Lab feed.</div>';$('xSignalSummary').textContent='No watched accounts configured.';return}
  if(!posts.length){$('xTimeline').innerHTML='<div class="xEmpty"><b>Feed is warming up.</b>Pump Lab will retry the public timeline automatically. OPEN X remains available in each profile once posts arrive.</div>';$('xSignalSummary').textContent='Watching '+handles.length+' accounts · waiting for cached posts.';return}
  const groups=handles.map(h=>{const hp=posts.filter(p=>String((p.author||{}).username||'').toLowerCase()===String(h).toLowerCase()).slice(0,5);return{h,posts:hp}});
  $('xTimeline').innerHTML='<div class="xFeedSource"><b>PUMP LAB RENDER</b> · tweets are fetched server-side, cached, and drawn in Pump Lab’s own interface. '+(source==='x-api'?'Official X API source.':'Public timeline cache source.')+'</div><div class="xProfileGrid">'+groups.map(g=>'<section class="xProfileCard"><div class="xProfileHead"><div><div class="xProfileName">@'+esc(g.h)+'</div><div class="xProfileMode">'+g.posts.length+' RECENT POSTS · LIVE CACHE</div></div><a class="xProfileOpen" href="https://x.com/'+encodeURIComponent(g.h)+'" target="_blank" rel="noopener">OPEN X ↗</a></div><div class="xProfilePosts">'+(g.posts.length?g.posts.map(p=>xPostHtml(p,true)).join(''):'<div class="xEmpty" style="margin:14px"><b>No original posts cached yet.</b>Pump Lab will keep checking this account.</div>')+'</div></section>').join('')+'</div>';
  const totalLikes=posts.reduce((s,p)=>s+Number((p.metrics||{}).like_count||0),0),byAuthor={};posts.forEach(p=>{const u=(p.author||{}).username||'unknown';byAuthor[u]=(byAuthor[u]||0)+1});
  const top=Object.entries(byAuthor).sort((a,b)=>b[1]-a[1]).slice(0,5);
  $('xSignalSummary').innerHTML='<b>'+posts.length+' cached posts</b><br>'+handles.length+' watched accounts · '+xNum(totalLikes)+' visible likes<br><span class="muted">'+esc(source==='x-api'?'X API':'public timeline cache')+' · custom Pump Lab render</span>'+(top.length?'<br><br>'+top.map(x=>'@'+esc(x[0])+' · '+x[1]).join('<br>'):'');
}
async function loadXFeed(force){
  if(xFeedLoading)return;xFeedLoading=true;
  try{const r=await fetch('/api/x-feed'+(force?'?refresh=1':''),{cache:'no-store'});renderXFeed(await r.json())}
  catch(e){$('xFeedState').textContent='FEED UNAVAILABLE';$('xFeedState').className='red';$('xTimeline').innerHTML='<div class="xEmpty"><b>X feed unavailable.</b>'+esc(e&&e.message?e.message:e)+'</div>'}
  finally{xFeedLoading=false}
  clearTimeout(xFeedTimer);xFeedTimer=setTimeout(()=>{if($('xfeed')&&$('xfeed').classList.contains('on'))loadXFeed(false)},30000);
}
document.querySelectorAll('.tab').forEach(t=>t.onclick=()=>{document.querySelectorAll('.tab,.pane').forEach(x=>x.classList.remove('on'));t.classList.add('on');$(t.dataset.p).classList.add('on');if(['intel','research','time'].includes(t.dataset.p))loadDeepResearch();if(t.dataset.p==='xfeed')loadXFeed(false);});document.addEventListener('pointermove',e=>{const el=e.target.closest('.card,.smallcard,.hero>div');if(!el)return;const r=el.getBoundingClientRect();el.style.setProperty('--mx',((e.clientX-r.left)/Math.max(1,r.width)*100)+'%');el.style.setProperty('--my',((e.clientY-r.top)/Math.max(1,r.height)*100)+'%');}); // PUMP LAB tactile pointer lighting
const ORACLE_ANSWERS=['YES','NO','MAYBE','IDK','ASK AGAIN','VERY LIKELY','DOUBTFUL','ABSOLUTELY','NOT YET','SIGNS POINT YES',"DON'T COUNT ON IT",'OUTLOOK GOOD','UNCLEAR','TRY LATER','WITHOUT A DOUBT','BETTER NOT TELL YOU'];
function askMagicOrb(){
  const orb=$('magicOrb'),answer=$('oracleAnswer');if(!orb||!answer)return;
  const next=ORACLE_ANSWERS[Math.floor(Math.random()*ORACLE_ANSWERS.length)];
  answer.classList.remove('show');orb.classList.remove('answered');
  window.clearTimeout(orb._oracleTimer);
  orb._oracleTimer=window.setTimeout(()=>{answer.textContent=next;answer.classList.add('show');orb.classList.add('answered');},180);
}
const magicOrb=$('magicOrb');
if(magicOrb){
  magicOrb.addEventListener('click',askMagicOrb);
  magicOrb.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();askMagicOrb();}});
}
</script></body></html>`;
const dashboardScriptStart=HTML.lastIndexOf('<script>'),dashboardScriptEnd=HTML.lastIndexOf('</script>');if(dashboardScriptStart<0||dashboardScriptEnd<=dashboardScriptStart)throw Error('dashboard script extraction failed');
const DASHBOARD_JS=HTML.slice(dashboardScriptStart+'<script>'.length,dashboardScriptEnd);new Function(DASHBOARD_JS);
HTML=HTML.slice(0,dashboardScriptStart)+'<script src="/dashboard.js?v=20261003-hardening"></script>'+HTML.slice(dashboardScriptEnd+'</script>'.length);

const server=http.createServer(async (req,res)=>{
  const requestUrl=new URL(req.url,'http://pump-lab.local'),corsPath=requestUrl.pathname;
  if(corsPath.startsWith('/api/')||corsPath==='/livez'||corsPath==='/readyz'){res.setHeader('access-control-allow-origin','*');res.setHeader('access-control-allow-methods','GET,OPTIONS');res.setHeader('access-control-allow-headers','content-type,cache-control');if(req.method==='OPTIONS'){res.writeHead(204);return res.end();}}
  {const u=requestUrl;
  if(u.pathname==='/dashboard.js'){res.writeHead(200,{'content-type':'application/javascript; charset=utf-8','cache-control':'no-store, no-cache, must-revalidate','content-length':Buffer.byteLength(DASHBOARD_JS)});return res.end(DASHBOARD_JS);}
  if(u.pathname==='/api/x-feed'){try{const out=await refreshXFeed(u.searchParams.get('force')==='1');const body=JSON.stringify(out);res.writeHead(out.ok?200:503,{'content-type':'application/json','cache-control':'no-store','content-length':Buffer.byteLength(body)});return res.end(body);}catch(e){const body=JSON.stringify({ok:false,configured:true,handles:X_FEED_HANDLES,posts:xFeedCache,fetchedAt:xFeedLastFetch||null,error:String(e?.message||e)});res.writeHead(xFeedCache.length?200:502,{'content-type':'application/json','cache-control':'no-store','content-length':Buffer.byteLength(body)});return res.end(body);}}
  if(u.pathname==='/api/bot'){
    const id=u.searchParams.get('id')||'',d=allTraders().find(x=>x.id===id);
    if(!d){res.writeHead(404,{'content-type':'application/json','cache-control':'no-store'});return res.end(JSON.stringify({ok:false,error:'bot not found'}));}
    markEquity(d);
    const botTrades=trades.filter(t=>t.strategy===id).slice().sort((a,b)=>num(b.closedAt)-num(a.closedAt));
    const wins=botTrades.filter(t=>num(t.pnl)>0),losses=botTrades.filter(t=>num(t.pnl)<=0),grossWin=wins.reduce((s,t)=>s+num(t.pnl),0),grossLoss=Math.abs(losses.reduce((s,t)=>s+num(t.pnl),0));
    const openPositions=positions.filter(p=>!p.closed&&p.strategy===id).map(p=>{const mark=positionMarkPrice(p);return{...p,mark,unrealizedPct:p.entry>0?pct(mark,p.entry):0};});
    const ep=entryPolicy(d),pb=strategyPlaybook(d),eraTrades=botTrades.filter(t=>t.policyVersion===STRATEGY_ERA);
    const payload={ok:true,era:STRATEGY_ERA,bot:{...stripTrader(d),equity:d.equity,open:openPositions.length,effectiveMin:ep.min,playbook:pb.instruction,thesis:d.thesis||''},
      stats:{trades:botTrades.length,wins:wins.length,losses:losses.length,winRate:botTrades.length?wins.length/botTrades.length*100:0,totalPnl:botTrades.reduce((s,t)=>s+num(t.pnl),0),avgPnlPct:botTrades.length?avg(botTrades.map(t=>num(t.pnlPct))):0,profitFactor:grossLoss?grossWin/grossLoss:grossWin>0?9.99:0,eraTrades:eraTrades.length,bestTrade:botTrades.length?botTrades.reduce((a,b)=>num(b.pnlPct)>num(a.pnlPct)?b:a):null,worstTrade:botTrades.length?botTrades.reduce((a,b)=>num(b.pnlPct)<num(a.pnlPct)?b:a):null},
      openPositions,trades:botTrades};
    if(u.searchParams.get('format')==='html'){
      const html=renderBotProfileHtml(payload);res.writeHead(200,{'content-type':'text/html; charset=utf-8','cache-control':'no-store','content-length':Buffer.byteLength(html)});return res.end(html);
    }
    const json=JSON.stringify(payload);res.writeHead(200,{'content-type':'application/json','cache-control':'no-store','content-length':Buffer.byteLength(json)});return res.end(json);
  }}
  if(req.url==='/api/archives'){
    if(!db){res.writeHead(503,{'content-type':'application/json','cache-control':'no-store'});return res.end(JSON.stringify({ok:false,error:'durable archive store unavailable'}));}
    try{
      const r=await db.query("SELECT id,updated_at,payload->>'label' AS label,(payload->'summary'->>'completedTrades')::int AS trades,(payload->'summary'->>'openPositions')::int AS open_positions FROM pump_lab_state WHERE id LIKE 'archive:%' ORDER BY updated_at DESC");
      const body=JSON.stringify({ok:true,season:seasonInfo,archives:r.rows});res.writeHead(200,{'content-type':'application/json','cache-control':'no-store','content-length':Buffer.byteLength(body)});return res.end(body);
    }catch(e){res.writeHead(500,{'content-type':'application/json','cache-control':'no-store'});return res.end(JSON.stringify({ok:false,error:e.message}));}
  }
  if(req.url==='/api/archive-monster-export'){
    try{
      if(!archiveMonsterExportCache){res.writeHead(503,{'content-type':'application/json','cache-control':'no-store'});return res.end(JSON.stringify({ok:false,error:'archive cache not ready'}));}
      const body=JSON.stringify(archiveMonsterExportCache);console.log('ARCHIVE_MONSTER_EXPORT '+JSON.stringify(archiveMonsterExportCache.counts));
      res.writeHead(200,{'content-type':'application/json','cache-control':'no-store','content-length':Buffer.byteLength(body),'x-robots-tag':'noindex, nofollow'});return res.end(body);
    }catch(e){
      console.error('ARCHIVE_MONSTER_EXPORT_ERROR '+(e?.stack||e));res.writeHead(500,{'content-type':'application/json','cache-control':'no-store'});return res.end(JSON.stringify({ok:false,error:'archive monster export unavailable'}));
    }
  }
  if(req.url==='/api/recovery-snapshot'){
    try{
      const recoverable=stateIntegrityOk&&stateVersionTs>0&&(dbStateRestored||kvStateRestored||localStateRestored||peerStateRestored);
      if(!recoverable){res.writeHead(503,{'content-type':'application/json','cache-control':'no-store'});return res.end(JSON.stringify({ok:false,error:'recovery snapshot not yet trusted',phase:lifecyclePhase}));}
      const json=getRecoveryJsonCached();
      res.writeHead(200,{'content-type':'application/json','cache-control':'private, max-age=10','content-length':Buffer.byteLength(json),'x-robots-tag':'noindex, nofollow'});
      return res.end(json);
    }catch(e){
      res.writeHead(500,{'content-type':'application/json','cache-control':'no-store'});
      return res.end(JSON.stringify({ok:false,error:'recovery snapshot unavailable'}));
    }
  }
  if(req.url==='/api/state'){
    try{
      const json=getStateJsonCached();
      res.writeHead(200,{'content-type':'application/json','cache-control':'no-store','content-length':Buffer.byteLength(json)});
      return res.end(json);
    }catch(e){
      console.error('STATE_API_ERROR '+(e?.stack||e));
      res.writeHead(500,{'content-type':'application/json','cache-control':'no-store'});
      return res.end(JSON.stringify({ok:false,error:'dashboard state unavailable',detail:String(e?.message||e)}));
    }
  }
  if(req.url==='/api/research'){
    try{
      const json=getDeepResearchJson();
      res.writeHead(200,{'content-type':'application/json','cache-control':'no-store','content-length':Buffer.byteLength(json)});
      return res.end(json);
    }catch(e){
      console.error('DEEP_RESEARCH_API_ERROR '+(e?.stack||e));
      res.writeHead(500,{'content-type':'application/json','cache-control':'no-store'});
      return res.end(JSON.stringify({ok:false,error:'deep research unavailable',detail:String(e?.message||e)}));
    }
  }
  {const routePath=new URL(req.url,'http://pump-lab.local').pathname;
  if(routePath==='/livez'){const body=JSON.stringify({ok:true,phase:lifecyclePhase,uptimeSec:Math.round(process.uptime()),pressure:systemPressure,eventLoopLagMs});res.writeHead(200,{'content-type':'application/json','cache-control':'no-store','content-length':Buffer.byteLength(body)});return res.end(body);}
  if(routePath==='/readyz'){const r=readinessStatus(),body=JSON.stringify(r);res.writeHead(r.ready?200:503,{'content-type':'application/json','cache-control':'no-store','content-length':Buffer.byteLength(body)});return res.end(body);}
  if(routePath==='/api/health'){const body=JSON.stringify({ok:true,paperOnly:true,version:'5.0 Season 3 Clean Execution',runtime:readinessStatus(),memory:memoryReport(process.memoryUsage(),RUNTIME_MEMORY_BUDGET_MIB),sseClients:clients.size,storage:storageStatus(),weather:marketWeather(),providers:[...health.values()]});res.writeHead(200,{'content-type':'application/json','cache-control':'no-store','content-length':Buffer.byteLength(body)});return res.end(body);}}
  if(req.url==='/api/events'){
    if(clients.size>=MAX_SSE_CLIENTS){res.writeHead(503,{'content-type':'application/json','cache-control':'no-store','retry-after':'5'});return res.end(JSON.stringify({ok:false,error:'event stream capacity reached; retry later'}));}
    res.writeHead(200,{'content-type':'text/event-stream','cache-control':'no-cache','connection':'keep-alive','x-accel-buffering':'no'});
    res.write('data: {}\n\n');clients.add(res);
    const cleanup=()=>clients.delete(res);req.on('close',cleanup);res.on('close',cleanup);
    return;
  }
  res.writeHead(200,{'content-type':'text/html; charset=utf-8','cache-control':'no-store'});res.end(HTML);
});

setLifecycle('RESTORING','restoring durable state');
console.log('RUNTIME_CONFIG_PRESENCE '+JSON.stringify({databaseUrl:!!DATABASE_URL,redisUrl:!!REDIS_URL,peerRecovery:PEER_RECOVERY_URLS.length>0,stateFile:!!STATE_FILE}));
loadLocal();
await initKv(true);
await initDb(true);
// Always perform one final peer freshness check. restoreCriticalFromSource is
// monotonic, so this is harmless when Postgres/local is newer and essential
// when the independent peer is newer.
if(PEER_RECOVERY_URL)await tryPeerRecovery();
if((DATABASE_URL||REDIS_URL||PEER_RECOVERY_URL)&&!(dbStateRestored||kvStateRestored||localStateRestored||peerStateRestored)){
  console.log('STARTUP_STATE_GATE waiting for Postgres / Key Value / local / peer recovery before accepting traffic');
  // Prefer newer Postgres/local/peer recovery. Only then fall back to the pinned,
  // monotonic, read-only GitHub snapshot so the dashboard can return without fabricated defaults.
  const restored=restorePinnedOffsite()||await waitForInitialDurableRestore();
  if(!restored)process.exit(1);
}
await beginCleanExecutionEraIfNeeded();
reconcileAuthoritativeExperimentState({repair:true,source:'startup-final'});
if(!validateStateIntegrity({repair:true})){console.error('FATAL_STATE_INTEGRITY · refusing to bind public port');process.exit(1);}
if(dbStateRestored||kvStateRestored||localStateRestored||peerStateRestored)logStrategyDiagnostics();
setLifecycle('WARMING','state restored; initializing market loops');
logV3SelfTest();
setHealth('engine','ok','v3.1 evidence playbooks + Megga copy/scout lab + 31 specialist cohorts + controls online',{truth:'observed'});
setHealth('learning-core','ok','era-separated allocator + DNA memory + replay + exit optimizer + counterfactual lab online',{truth:'inferred'});
setHealth('alpha-os','ok','Alpha OS v2 online · wallet profitability/copyability + independent consensus + safety/cadence/expectancy controls · PAPER/SHADOW ONLY',{truth:'inferred'});
setHealth('season3-science','ok','Integrity Freeze science online · corrected marks + timed momentum + fresh evidence only',{truth:'inferred'});
setHealth('profit-accelerator','ok','Profit Accelerator v1 · pruning + champion weighting + regime veto + MAE/MFE exits + execution quality + social proof + no-trade + expectancy + correlation + postmortems',{truth:'inferred'});
setHealth('x-social','standby','Full X stream not connected · social agent uses token social metadata only',{truth:'not connected'});
setHealth('wallet-intel','standby','Connecting Solana stream + verified Fomo wallet watchlist…',{truth:'not connected'});setHealth('fomo-watchlist','standby','Preparing verified public wallet subscriptions',{truth:'not connected'});
if((DATABASE_URL||REDIS_URL)&&!durableTradingReady())console.log('STATE_LOCK engaged · trading paused until a recovery source is healthy');
log('system','🚀 PUMP LAB v5.1 Integrity Freeze started · PAPER ONLY','system');connectPumpPortal();connectSolanaStream();pumpPoll();dexPoll();console.log('PUMP LAB v5.1 Integrity Freeze runtime online · PAPER ONLY');
setTimeout(stateSelfTest,5000).unref?.();setInterval(()=>alphaOS.runCapitalAuction(m=>tokens.get(m),executionQuote),2000).unref?.();
setInterval(()=>{alphaOS.observeWorld({weather:marketWeather(),tokens:[...tokens.values()].filter(t=>now()-t.updatedAt<900000),strategyEquity:Object.fromEntries(allTraders().map(d=>[d.id,d.equity]))});alphaOS.prune();},60000).unref?.();
setInterval(()=>runScheduled('alpha-external',()=>alphaOS.pollExternal(),{budgetMs:5000}),30000).unref?.();
setInterval(()=>runScheduled('stale-sweep',()=>stalePositionSweep(),{budgetMs:250,critical:true}),15000).unref?.();
setInterval(()=>runScheduled('runtime-prune',()=>pruneRuntimeMemory(),{budgetMs:300}),300000).unref?.();
setInterval(()=>runScheduled('solana-drain',()=>drainSolanaQueue(),{budgetMs:1500,critical:true}),700).unref?.();
setInterval(()=>runScheduled('pump-poll',()=>pumpPoll(),{budgetMs:6000,critical:true}),7000).unref?.();
setInterval(()=>runScheduled('dex-poll',()=>dexPoll(),{budgetMs:9000,critical:true}),20000).unref?.();
setInterval(()=>runScheduled('pump-open-marks',()=>pumpOpenPositionPoll(),{budgetMs:4500,critical:true}),4000).unref?.();
setTimeout(()=>runScheduled('minute-samplers',()=>minuteSamplerTick(),{budgetMs:18000,critical:true}),15000).unref?.();
setInterval(()=>runScheduled('minute-samplers',()=>minuteSamplerTick(),{budgetMs:18000,critical:true}),50000).unref?.();
setInterval(()=>runScheduled('open-marks',()=>openPositionPoll(),{budgetMs:9000,critical:true}),15000).unref?.();
setInterval(()=>runScheduled('timeline',()=>takeTimeline(),{budgetMs:150}),30000).unref?.();
setInterval(()=>runScheduled('replay',()=>takeReplay(),{budgetMs:250}),30000).unref?.();
setInterval(()=>runScheduled('research',()=>researchCycle(),{budgetMs:15000}),3600000).unref?.();
setInterval(()=>runScheduled('critical-save',()=>saveCritical(),{budgetMs:3000,critical:true}),15000).unref?.();
setInterval(()=>runScheduled('journal-flush',()=>db?queueDbWrite(()=>flushTradeJournal(db),'high'):false,{budgetMs:2000,critical:true}),2000).unref?.();
setInterval(()=>runScheduled('event-flush',()=>db?queueDbWrite(()=>flushMarketEvents(db),'normal'):false,{budgetMs:5000}),60000).unref?.();
setInterval(()=>runScheduled('full-save',()=>save(),{budgetMs:15000}),300000).unref?.();
setInterval(()=>{pruneRuntimeMemory();reconcileAuthoritativeExperimentState({repair:true,source:'periodic'});},30000).unref?.();
const runDiagnostics=()=>runScheduled('diagnostics',async()=>{
  logStrategyDiagnostics();
  await new Promise(r=>setImmediate(r));
  logPerformanceSnapshot();
  await new Promise(r=>setImmediate(r));
  await logFullPostmortem();
},{budgetMs:5000});
const diagTimer=setTimeout(runDiagnostics,45000);diagTimer.unref?.();
const diagLoop=setInterval(runDiagnostics,300000);diagLoop.unref?.();
const coreRejectTimer=setTimeout(logCoreRejectionSummary,25000);coreRejectTimer.unref?.();
const coreRejectLoop=setInterval(logCoreRejectionSummary,60000);coreRejectLoop.unref?.();
let loopExpected=Date.now()+1000;setInterval(()=>{const ts=Date.now(),lag=Math.max(0,ts-loopExpected);loopExpected=ts+1000;eventLoopLagMs=lag;eventLoopSamples.push(lag);if(eventLoopSamples.length>30)eventLoopSamples.shift();eventLoopLagP95=percentile(eventLoopSamples,.95)||0;systemPressure=runtimePressure();if(lag>500)setHealth('event-loop','warn','Event loop lag '+lag+'ms · pressure '+systemPressure,{truth:'observed'});else if(health.get('event-loop')?.status!=='ok')setHealth('event-loop','ok','Event loop responsive · p95 '+Math.round(eventLoopLagP95)+'ms',{truth:'observed'});},1000).unref?.();
setInterval(watchdogTick,10000).unref?.();
setInterval(()=>{
  const m=memoryReport(process.memoryUsage(),RUNTIME_MEMORY_BUDGET_MIB);
  if(m.pressure==='HIGH'||m.pressure==='CRITICAL'){
    // Prune only regenerable caches and market-discovery windows.
    // Do not delete open positions, completed trades, journal events, or checkpoints.
    featureCache.clear();entryPolicyCache.clear();regimeWeightCache.clear();dnaSimilarityCache.clear();
    pruneRuntimeMemory();alphaOS.prune();
  }
  setHealth('runtime-memory',m.pressure==='CRITICAL'?'warn':m.pressure==='HIGH'?'warn':'ok',
    'RSS '+m.rssMiB+'/'+m.budgetMiB+' MiB · heap '+m.heapUsedMiB+' MiB · '+m.pressure,{truth:'observed'});
},30000).unref?.();
takeTimeline();takeReplay();alphaOS.observeWorld({weather:marketWeather(),tokens:[...tokens.values()],strategyEquity:Object.fromEntries(allTraders().map(d=>[d.id,d.equity]))});alphaOS.pollExternal();pumpOpenPositionPoll();openPositionPoll();
setLifecycle(emergencyOffsiteRestored&&!durableTradingReady()?'DEGRADED':'READY',emergencyOffsiteRestored&&!durableTradingReady()?'offsite recovery visible; paper entry locked pending durable Postgres':'market loops initialized');
server.listen(PORT,'0.0.0.0',()=>{console.log('PUMP LAB HTTP port bound on '+PORT+' · READY after trusted state recovery');});
runScheduled('x-feed-warmup',()=>refreshXFeed(false).then(x=>console.log('X_FEED_WARMUP '+JSON.stringify({ok:x.ok,source:x.source,posts:x.posts?.length||0,handles:x.handles,errors:x.errors||[]}))),{budgetMs:30000}).catch(()=>{});
setInterval(()=>runScheduled('x-feed-refresh',()=>refreshXFeed(false),{budgetMs:30000}),120000).unref?.();
async function gracefulShutdown(signal){
  if(shuttingDown)return;shuttingDown=true;setLifecycle('DRAINING',signal+' received; blocking new entries and draining journal/state');
  const hard=setTimeout(()=>{console.error('FORCED_SHUTDOWN after drain timeout '+JSON.stringify({journal:pendingTradeJournal.length,events:pendingDbEvents.length,dbHigh:dbWriteHigh.length}));process.exit(1);},18000);hard.unref?.();
  try{
    validateStateIntegrity({repair:true});
    if(db){
      await queueDbWrite(async()=>{await flushTradeJournal(db);return true;},'high');
      if(pendingTradeJournal.length)throw new Error('trade journal did not fully drain: '+pendingTradeJournal.length);
    }
    await saveCritical();
    if(db)await queueDbWrite(async()=>{await flushMarketEvents(db);return true;},'normal');
    await writeLocalAtomic(serialize());
    console.log('DRAIN_COMPLETE '+JSON.stringify({journal:pendingTradeJournal.length,events:pendingDbEvents.length,lastCriticalSaveAt,stateVersionTs,integrity:lastIntegrityReport?.ok!==false}));
    try{await kv?.quit();}catch{}
    try{await db?.end();}catch{}
    server.close(()=>{clearTimeout(hard);process.exit(0);});
  }catch(e){
    console.error('GRACEFUL_SHUTDOWN_ERROR '+String(e?.stack||e));
    try{await writeLocalAtomic(serialize());}catch{}
    clearTimeout(hard);process.exit(1);
  }
}
process.on('SIGTERM',()=>gracefulShutdown('SIGTERM'));process.on('SIGINT',()=>gracefulShutdown('SIGINT'));
