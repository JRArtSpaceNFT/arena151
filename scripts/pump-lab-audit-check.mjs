import fs from 'node:fs';

const src = fs.readFileSync(new URL('../server.mjs', import.meta.url), 'utf8');
const scienceSrc = fs.readFileSync(new URL('../lib/pump-lab-season2-science.mjs', import.meta.url), 'utf8');
const alphaSrc = fs.readFileSync(new URL('../lib/pump-lab-alpha-os.mjs', import.meta.url), 'utf8');
const lifecycleSrc = fs.readFileSync(new URL('../lib/pump-lab-lifecycle-research.mjs', import.meta.url), 'utf8');
const checks = [
  ['durable startup gate', "STARTUP_STATE_GATE waiting for Postgres / Key Value / local recovery"],
  ['durable trading gate', 'durableTradingReady()'],
  ['deterministic control', "deterministicScore('random-control:'"],
  ['holdout partition', "partitionForMint(mint)"],
  ['auto promotion off by default', "process.env.ALLOW_AUTO_PROMOTION || 'false'"],
  ['Alpha OS EV sizing', "sizingMode:'alpha-os-ev-v1'"],
  ['stale mark decay', 'STALE_MARK_ZERO_MS'],
  ['stale position sweep', 'stalePositionSweep()'],
  ['execution quote model', "executionQuote(t,budget,'buy')"],
  ['lifecycle fee model', 'platformFeeRate(t)'],
  ['risk circuit', 'strategyRiskCircuit(d)'],
  ['live launch audit gate', 'function systemAudit()'],
  ['lazy deep research endpoint', "req.url==='/api/research'"],
  ['serialized state writes', 'if(saveInProgress){saveQueued=true;return;}'],
  ['Lifecycle analytical era', "v4.1-coin-lifecycle"],
  ['Alpha OS integration', 'alphaOS.evaluateCandidate'],
  ['CIO capital auction', 'alphaOS.runCapitalAuction'],
  ['adaptive exit intelligence', 'alphaOS.exitPlan'],
  ['shadow execution twin', 'alphaOS.recordShadowEntry'],
  ['Season 2 science import', 'createPumpLabSeason2Science'],
  ['Season 2 global entry gate', 'science.evaluateEntry'],
  ['Season 2 entry replay', 'science.recordEntry'],
  ['Season 2 position path tracking', 'science.observePosition'],
  ['Season 2 completed-trade learning', 'science.recordTrade'],
  ['Season 2 persistence', 'science:science.serialize()'],
  ['Season 2 restore', 'science.restore(s.science)'],
  ['Season 2 fresh-season reset', 'science.reset()'],
  ['Season 2 dashboard state', 'season2Science:science.snapshot'],
  ['free Key Value failover', 'initKv(true)'],
  ['atomic local checkpoint', 'writeLocalAtomic(s)'],
  ['newest-state restore guard', 'restoreIfNewer'],
  ['Postgres reconnect scheduler', 'scheduleDbReconnect'],
  ['multi-layer storage status', 'storageStatus()'],
  ['Lifecycle research import', 'createPumpLabLifecycleResearch'],
  ['Lifecycle token observation', 'observeResearchLayers(t)'],
  ['Lifecycle wallet events', 'lifecycle.observeWalletEvent'],
  ['Lifecycle decision tracking', 'lifecycle.recordDecision'],
  ['Lifecycle entry advisory', 'lifecycleEntry'],
  ['Lifecycle exit advisory', 'lifecycleExit'],
  ['Lifecycle trade decomposition', 'lifecycle.recordTrade'],
  ['Lifecycle persistence', 'lifecycle:lifecycle.serialize()'],
  ['Lifecycle restore', 'lifecycle.restore(s.lifecycle)'],
  ['Lifecycle season reset', 'lifecycle.reset()'],
  ['Lifecycle dashboard state', 'lifecycleResearch:lifecycle.snapshot'],
  ['pre-buy context cache', 'researchContextCache'],
  ['audit latency telemetry', 'fastAuditSnapshot()'],
  ['cached market weather', 'weatherCache'],
  ['cached lifecycle advisory', 'lifecycleState=fresh?cached.lifecycleState'],
  ['adaptive Pump.fun polling guard', 'pumpPollInFlight'],
  ['3-second launch fallback cadence', 'setInterval(pumpPoll,3000)'],
  ['5-second open-position mark cadence', 'setInterval(openPositionPoll,5000)'],
  ['priority watched-wallet Solana queue', 'solanaPriorityQueue'],
  ['Solana RPC adaptive backoff', 'solanaRpcBackoffUntil'],
  ['launch discovery latency telemetry', 'recordDiscoveryLatency'],
  ['discovery latency percentile telemetry', 'discoveryP95Ms'],
  ['isolated checkpoint namespace', 'KV_STATE_KEY'],
  ['late discovery backfill separation', 'lateDiscoveryBackfill'],
  ['event-driven Pump wake', 'wakePumpPoll'],
  ['processed Pump program subscription', "commitment:'processed'"],
  ['fast lifecycle advisory', 'lifecycle.fastAdvisory'],
  ['deferred deep research', 'setImmediate(()=>{try{observeResearchLayers(t,fastCtx)'],
  ['allocator cache', 'allocatorCache'],
  ['reused Alpha evaluation', 'proposeCapital({strategy:d,token:t,features:f,score,threshold:activeGuard.requiredScore||policy.min,quality,similar,regime},alpha)'],
  ['create-only Pump log detector', "Instruction:\\s*Create"],
  ['priority Pump create queue', 'solanaCreateQueue'],
  ['on-chain initialized mint extraction', 'initializedMintsFromTx'],
  ['direct launch mint hydration', 'hydrateLaunchMint'],
  ['bounded create confirmation retry', 'solanaCreateAttempts'],
  ['200ms launch resolver cadence', 'setInterval(drainSolanaQueue,200)'],
  ['deferred rejection batch', 'flushDeferredRejects'],
  ['pending rejection dedupe', 'pendingRejectKeys'],
  ['first audited buy latency', 'firstBuyP95Ms'],
  ['first buy timing hook', 'firstBuyMs=performance.now()-auditStarted'],
  ['on-chain launch metrics', 'onchainLaunch'],
  ['processed launch wake subscription', "id:901,method:'logsSubscribe'"],
  ['confirmed launch resolver subscription', "id:902,method:'logsSubscribe'"],
  ['nonblocking launch hydration', 'void hydrateLaunchMint'],
  ['extended launch hydration retries', '3000'],
  ['bounded KV connect', 'reconnectStrategy:false'],
  ['KV reconnect scheduler', 'scheduleKvReconnect'],
  ['KV reconnect backoff', 'kvReconnectAttempt'],
  ['explicit fresh-state gate', 'ALLOW_FRESH_EMPTY_STATE'],
  ['fresh-state audit marker', "source:'explicit-fresh-empty'"]
];

const failures = checks.filter(([, needle]) => !src.includes(needle)).map(([name])=>name);
const scienceSystems=[
  'Walk Forward Testing','Bayesian Strategy Confidence','Meme Coin Survival Model','Creator + Wallet Cluster DNA',
  'Copycat / Narrative Saturation','Execution Reality Simulator','Entry Timing Counterfactuals','Exit Counterfactuals',
  'Feature Drift Alarm','Evidence Strategy Kill Switch','Market Relative Performance','Ultimate Do Nothing Model'
];
for(const name of scienceSystems)if(!scienceSrc.includes("'"+name+"'"))failures.push('Season 2 science subsystem missing '+name);
if(!scienceSrc.includes("paperOnly:true"))failures.push('Season 2 science paper-only marker missing');
if(!scienceSrc.includes("autoPromotion:false"))failures.push('Season 2 manual-promotion safeguard missing');
const lifecycleStages=[
  'Universe Capture','Creator Quality','First Buyer DNA','Organic Demand','Manipulation Detection','Attention Quality',
  'Market Cap Journey','Bonding Curve Journey','Entry Opportunity','Waiting Model','Execution Reality Link',
  'Evidence Position Sizing','Hold Time Model','Holder Profit Overhang','Sell Pressure Forecast','Exit Decision',
  'Post Graduation Model','Market Environment','Missed Winner Research','Avoided Loser Research',
  'Decision Decomposition','Perfect Coin Fingerprint'
];
for(const name of lifecycleStages)if(!lifecycleSrc.includes("'"+name+"'"))failures.push('Lifecycle stage missing '+name);
if(!lifecycleSrc.includes("paperOnly:true"))failures.push('Lifecycle paper-only marker missing');
const tradeStart=src.indexOf('function maybeTrade(t)');
const tradeEnd=src.indexOf('function stalePositionSweep',tradeStart);
const criticalPath=tradeStart>=0&&tradeEnd>tradeStart?src.slice(tradeStart,tradeEnd):'';
if(!criticalPath)failures.push('pre-buy critical path could not be isolated');
if(/\bawait\b/.test(criticalPath))failures.push('pre-buy critical path contains await');
if(/\bfetch\s*\(/.test(criticalPath))failures.push('pre-buy critical path contains network fetch');
if(!criticalPath.includes('recordFastAudit'))failures.push('pre-buy latency recording missing');
if(!scienceSrc.includes('evidenceDecisionCached'))failures.push('science evidence cache missing');
if(!scienceSrc.includes('survivalStats'))failures.push('constant-time survival hazard index missing');
if(!lifecycleSrc.includes('decisionLookup'))failures.push('lifecycle decision index missing');
if(!lifecycleSrc.includes('empiricalCache'))failures.push('lifecycle competing-risk cache missing');
if(!lifecycleSrc.includes('fastAdvisory'))failures.push('lifecycle fast advisory missing');
if(!lifecycleSrc.includes('cacheOnly:true')||!lifecycleSrc.includes('cacheOnly=false'))failures.push('lifecycle cache-only historical path missing');
if(!alphaSrc.includes('worldContextCache'))failures.push('Alpha world context cache missing');
if(!alphaSrc.includes('settled.length<40'))failures.push('bounded Alpha nearest-neighbor scan missing');
if(!alphaSrc.includes('proposeCapital(c,evaluated=null)'))failures.push('Alpha evaluation reuse hook missing');

// Hypothesis Arena regression guards.
const hypothesisIds=[
  'hyp_bal_1_3','hyp_bal_3_6','hyp_transition','hyp_accel','hyp_liqrunner',
  'hyp_lowrisk','hyp_rebound','hyp_quality','hyp_hotbalanced','hyp_riskoff'
];
for(const id of hypothesisIds){
  if(!src.includes("'"+id+"'"))failures.push('Hypothesis Arena missing '+id);
}
if(!src.includes('function hypothesisArenaSnapshot()'))failures.push('Hypothesis Arena snapshot missing');
if(!src.includes('function evaluateHypothesisArena()'))failures.push('Hypothesis Arena lifecycle missing');
if(!src.includes("hold.n>=10"))failures.push('Hypothesis holdout retirement gate missing');
if(!src.includes("d.hypothesis&&d.hypothesisRetiredAt"))failures.push('Retired hypotheses can still open new positions');
if(!src.includes("hypothesisArena:hypothesisArenaSnapshot()"))failures.push('Hypothesis Arena missing from live state');


// Meme/chart theory regression guards.
for(const id of ['meme_smooth_curve','meme_retest','meme_compression','meme_postgrad','meme_survival']){
  if(!src.includes("'"+id+"'"))failures.push('Meme/chart theory bot missing '+id);
}
if(!src.includes('function chartTheory(t)'))failures.push('Chart theory engine missing');
if(!src.includes('function memeTheory(t,f,chart)'))failures.push('Meme theory engine missing');
if(!src.includes("structure='BREAKOUT_RETEST'"))failures.push('Breakout/retest classifier missing');
if(!src.includes("structure='COMPRESSION'"))failures.push('Compression classifier missing');
if(!src.includes('manipulationSuspicion'))failures.push('Manipulation suspicion proxy missing');
if(!src.includes("meme chart thesis broke"))failures.push('Chart-aware meme exit missing');
if(!src.includes('function memeChartLabSnapshot()'))failures.push('Meme/chart expectancy lab missing');
if(!src.includes('memeChartLab:memeChartLabSnapshot()'))failures.push('Meme/chart lab missing from deep research state');


// Season reset/archive invariants.
if(!src.includes('async function archiveAndResetSeason'))failures.push('atomic season archive/reset missing');
if(!src.includes("archiveId='archive:'"))failures.push('season archive durable id missing');
if(!src.includes("await db.query('BEGIN')"))failures.push('season reset transaction BEGIN missing');
if(!src.includes("await db.query('COMMIT')"))failures.push('season reset transaction COMMIT missing');
if(!src.includes("await db.query('ROLLBACK')"))failures.push('season reset rollback missing');
if(!src.includes("if(RESET_SEASON)await archiveAndResetSeason(RESET_SEASON)"))failures.push('season reset startup gate missing');
if(!src.includes("req.url==='/api/archives'"))failures.push('season archive metadata endpoint missing');
if(!src.includes("freshAlpha=createPumpLabAlphaOS"))failures.push('Alpha OS fresh-season reset missing');

if (failures.length) {
  console.error('PUMP LAB AUDIT STATIC CHECK FAILED');
  for (const name of failures) console.error(' - ' + name);
  process.exit(1);
}
if (/sid==='random'\)s=Math\.random\(\)\*100/.test(src)) {
  console.error('PUMP LAB AUDIT STATIC CHECK FAILED\n - nondeterministic random-control regression');
  process.exit(1);
}

// Visual identity regression: all 25 primary traders must keep unique fixed art profiles.
const artMapMatch = src.match(/const TRADER_ART_PROFILES=\{([\s\S]*?)\};/);
if (!artMapMatch) {
  console.error('PUMP LAB AUDIT STATIC CHECK FAILED\n - trader art profile map missing');
  process.exit(1);
}
const artPairs = [...artMapMatch[1].matchAll(/([A-Za-z0-9_]+):'([^']+)'/g)].map(m=>[m[1],m[2]]);
if (artPairs.length !== 25 || new Set(artPairs.map(x=>x[1])).size !== 25) {
  console.error('PUMP LAB AUDIT STATIC CHECK FAILED\n - unique trader visual identities must remain 25/25');
  process.exit(1);
}
if (src.includes("agentVisual v'+(i%5)")) {
  console.error('PUMP LAB AUDIT STATIC CHECK FAILED\n - recycled five-card art renderer returned');
  process.exit(1);
}

console.log('PUMP LAB audit static checks passed: ' + checks.length + ' core checks + 12 Season 2 systems + 22 lifecycle stages + fast-path no-network audit + 25 unique trader visuals');
