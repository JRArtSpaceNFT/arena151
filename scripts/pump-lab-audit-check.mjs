import fs from 'node:fs';

const src = fs.readFileSync(new URL('../server.mjs', import.meta.url), 'utf8');
const scienceSrc = fs.readFileSync(new URL('../lib/pump-lab-season2-science.mjs', import.meta.url), 'utf8');
const alphaSrc = fs.readFileSync(new URL('../lib/pump-lab-alpha-os.mjs', import.meta.url), 'utf8');
const proxySrc = fs.readFileSync(new URL('../frontend-proxy.mjs', import.meta.url), 'utf8');
const checks = [
  ['critical science evidence', "science.serializeCriticalEvidence()"],
  ['critical science restore', "science.restoreCriticalEvidence(s.scienceEvidence)"],
  ['critical Alpha state', "alphaOS.serializeCritical()"],
  ['critical Alpha restore', "alphaOS.restoreCritical(s.alphaCritical)"],
  ['science ledger continuity', "rebuildScienceFromDetailedLedger("],
  ['science detailed-ledger method', "science.rebuildFromTradeLedger("],
  ['canonical recovery reseed', "async function reseedCanonicalFullSnapshot"],
  ['canonical reseed audit log', "CANONICAL_FULL_RESEED"],
  ['critical recovery full reseed hook', "await reseedCanonicalFullSnapshot(client"],
  ['high-water health diagnostics', "highWater:{seasonKey:recoveryHighWater.seasonKey"],
  ['forensic health diagnostics', "forensic:{active:!!forensicRecovery.active"],
  ['peer-aware system audit', "DATABASE_URL||REDIS_URL||PEER_RECOVERY_URL"],
  ['forensic audit pass', "forensic history coverage preserved without synthetic ledger rows"],
  ['recovery high-water state', "recoveryHighWater"],
  ['recovery high-water gate', "RECOVERY_HIGH_WATER_REJECTED"],
  ['recovery high-water KV key', "pump-lab:state:highwater"],
  ['recovery high-water Postgres row', "main:highwater"],
  ['recovery high-water advance', "advanceRecoveryHighWater("],
  ['strict state version regression rejection', "STATE_VERSION_REGRESSION_REJECTED"],
  ['strict critical version regression rejection', "CRITICAL_STATE_VERSION_REGRESSION_REJECTED"],
  ['single ledger authority', "STATE_AUTHORITY_VERSION"],
  ['ledger reconciliation', "reconcileAuthoritativeExperimentState("],
  ['authoritative strategy cards', "authoritativeStrategyView(d)"],
  ['automatic season migration disabled', "ALLOW_SEASON_MIGRATION"],
  ['forensic observed high-water', "observedHighWater"],
  ['immutable science rebuild', "science.rebuildFromTradeLedger(rebuiltTrades)"],
  ['aggregate recovered coverage', "ledgerRecoveredAggregateRows"],
  ['detailed ledger coverage', "ledgerDetailedTrades"],
  ['forensic recovery metadata', "forensicRecovery"],
  ['forensic ledger coverage', "forensicLedgerGaps"],
  ['forensic baseline source', "FORENSIC_BASELINE"],
  ['durable startup gate', "STARTUP_STATE_GATE waiting for Postgres / Key Value / local / peer recovery"],
  ['durable trading gate', 'durableTradingReady()'],
  ['deterministic control', "deterministicScore('random-control:'"],
  ['holdout partition', "partitionForMint(mint)"],
  ['auto promotion off by default', "process.env.ALLOW_AUTO_PROMOTION || 'false'"],
  ['Alpha OS EV sizing', "sizingMode:'alpha-os-ev-v1'"],
  ['stale mark quarantine', 'STALE_POSITION_QUARANTINE'],
  ['stale position sweep', 'stalePositionSweep()'],
  ['execution quote model', "executionQuote(t,budget,'buy')"],
  ['lifecycle fee model', 'platformFeeRate(t)'],
  ['risk circuit', 'strategyRiskCircuit(d)'],
  ['live launch audit gate', 'function systemAudit()'],
  ['lazy deep research endpoint', "req.url==='/api/research'"],
  ['serialized state writes', 'if(saveInProgress){saveQueued=true;return;}'],
  ['Integrity Freeze era', "v5.1-integrity-freeze"],
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
  ['independent UI peer recovery', 'tryPeerRecovery()'],
  ['critical Key Value checkpoint', "pump-lab:state:critical"],
  ['critical local checkpoint', 'writeLocalCriticalAtomic(s)'],
  ['recovery snapshot endpoint', "req.url==='/api/recovery-snapshot'"],
  ['trusted recovery snapshot gate', 'const recoverable=stateIntegrityOk&&stateVersionTs>0'],
  ['critical recovery monotonicity', 'CRITICAL_STATE_VERSION_REGRESSION_REJECTED'],
  ['recovery high-water quality floor', 'RECOVERY_HIGH_WATER_REJECTED'],
  ['journal regression detector', 'function journalRegressionCutoff(rows)'],
  ['journal season rebuild', 'async function repairCurrentSeasonFromJournal'],
  ['journal repair startup hook (ledger-completeness gated)', 'const journalRepaired=missingDetailedTrades()>0?false:await repairCurrentSeasonFromJournal(client)']
];

const failures = checks.filter(([, needle]) => !src.includes(needle)).map(([name])=>name);


// Integrity Freeze regression guards.
for(const [name,needle] of [
  ['fresh quote age gate','PRICE_QUOTE_MAX_AGE_MS'],
  ['price stagnation tracking','unchangedPriceTicks'],
  ['synthetic zero writeoffs disabled','synthetic zero write-offs disabled'],
  ['stale quarantine log','STALE_POSITION_QUARANTINE'],
  ['impossible loss detector','IMPOSSIBLE_LOSS_FLAG'],
  ['meme universe filter','memeUniverseEligibility(t)'],
  ['tokenized stock blocklist',"NON_MEME_SYMBOLS=new Set(['SPYX','NVDAX','RDDT'])"],
  ['mint duplicate audit','duplicateTickerAudit()'],
  ['frozen strategy slate','ACTIVE_EXPERIMENT_IDS'],
  ['30 trade freeze','FROZEN_EXPERIMENT_MIN_TRADES'],
  ['50 holdout launch gate','holdoutN>=50'],
  ['1.30 profit factor launch gate','holdoutProfitFactor>1.30']
])if(!src.includes(needle))failures.push(name+' missing');

// External-profitability research regression guards.
for(const [name,needle] of [
  ['strategy expectancy sizing','function strategyExpectancyProfile(d)'],
  ['anti-overtrade cadence','function tradeCadenceGuard(d,t)'],
  ['same-token rebuy cooldown','PAPER_SAME_MINT_COOLDOWN_MS'],
  ['production safety gate','function productionSafetyGate(d,t,f,quality,alpha)'],
  ['wallet-consensus production override','sub-$100K requires strong independent wallet consensus']
])if(!src.includes(needle))failures.push(name+' missing');
for(const [name,needle] of [
  ['wallet realized proxy ledger','this.walletClosed=[]'],
  ['wallet quality score','walletQuality(wallet,mc=0)'],
  ['wallet copyability metric','copyability=clamp('],
  ['independent wallet consensus','walletConsensus(t,windowMin=15)'],
  ['MEV-like exclusion','mevLike=realizedN>=3'],
  ['insider-like exclusion','insiderLike=evidenceN>=6'],
  ['200-close proof tier',"evidenceN>=200?'PROVEN'"],
  ['90-day wallet evidence','d90:windowMetrics(90)'],
  ['pre-trade safety model','preTradeSafety(token,c={}'],
  ['wallet quality leaderboard','this.walletLeaderboard(25)']
])if(!alphaSrc.includes(needle))failures.push(name+' missing');
const scienceSystems=[
  'Walk Forward Testing','Bayesian Strategy Confidence','Meme Coin Survival Model','Creator + Wallet Cluster DNA',
  'Copycat / Narrative Saturation','Execution Reality Simulator','Entry Timing Counterfactuals','Exit Counterfactuals',
  'Feature Drift Alarm','Evidence Strategy Kill Switch','Market Relative Performance','Ultimate Do Nothing Model'
];
for(const name of scienceSystems)if(!scienceSrc.includes("'"+name+"'"))failures.push('Season 2 science subsystem missing '+name);
if(!scienceSrc.includes("paperOnly:true"))failures.push('Season 2 science paper-only marker missing');
if(!scienceSrc.includes("autoPromotion:false"))failures.push('Season 2 manual-promotion safeguard missing');
if(!proxySrc.includes("u.pathname === '/api/recovery-snapshot-cache'"))failures.push('UI recovery snapshot cache endpoint missing');
if(!proxySrc.includes('refreshRecoveryCache(true)'))failures.push('UI recovery cache warmup missing');
if(!proxySrc.includes('setInterval(()=>refreshRecoveryCache(true)'))failures.push('UI recovery cache refresh loop missing');
if(!proxySrc.includes('incomingTs<currentTs'))failures.push('UI recovery monotonicity guard missing');
if(!proxySrc.includes("out?.recoverable!==true"))failures.push('UI recovery trust guard missing');

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


// Season-isolated cadence regression guard.
if(!src.includes("trades.filter(x=>x.policyVersion===STRATEGY_ERA)")||!src.includes("same=trades.find(x=>x.policyVersion===STRATEGY_ERA"))failures.push('Season 3 cadence still reads legacy trades');

// Bounded core probe-lane regression guards.
for(const [name,needle] of [
  ['cold-start probe safety lane', "function coldStartProbeSafety"],
  ['probe market-cap hard floor', "market cap below $50K probe floor"],
  ['probe liquidity hard floor', "liquidity below $7.5K probe floor"],
  ['probe toxicity hard veto', "toxic flow veto"],
  ['probe production-safety bypass only when exploratory', "if(!productionSafety.ok&&!exploratory)"],
  ['probe metadata persistence', "coldStartProbe:exploratory"],
  ['probe buys preserve cold-start calibration', "x.action==='BUY'&&!x.exploratory"]
])if(!src.includes(needle))failures.push(name+' missing');

// Cold-start persistence and rejection observability guards.
for(const [name,needle] of [
  ['critical decision persistence', "decisions:decisions.filter(x=>x.era===STRATEGY_ERA).slice(0,Math.min(750,MAX_DECISIONS))"],
  ['critical decision restore', "if(Array.isArray(s.decisions)&&s.decisions.length)"],
  ['20-reject cold-start calibration', "rows.length>=20&&Number.isFinite(p90)"],
  ['core rejection summary', "CORE_REJECTION_SUMMARY "]
])if(!src.includes(needle))failures.push(name+' missing');

// Collection calibration regression guards.
for(const [name,needle] of [
  ['collection score floor', "CORE_COLLECTION_MIN_SCORE_FLOOR"],
  ['collection score relief cap', "CORE_COLLECTION_MAX_SCORE_RELIEF"],
  ['frozen adaptive threshold calibration', "effectiveMin=clamp((Number.isFinite(p75)?p75:p90)+3,adaptiveFloor,d.min)"],
  ['collection percentile calibration', "const p75=percentile(scores,.75),p90=percentile(scores,.90)"],
  ['collection expected-net floor', "PAPER_COLLECTION_MIN_EXPECTED_NET_WIN_USD"],
  ['hard cross-source safety retained', "if(p.requireCross&&quality.sourceCount<2)"],
  ['hard fresh-market-data safety retained', "if(!f.flowFresh||!f.liqFresh)"],
  ['core entry observability', "CORE_ENTRY "],
  ['redundant peer list', "PEER_RECOVERY_URLS"],
  ['peer failover loop', "for(const url of PEER_RECOVERY_URLS)"],
  ['peer source telemetry', "PEER_RECOVERY_SOURCE_FAILED"],
  ['bounded critical trade payload', "return picked.slice(0,250)"],
  ['winner 1 strategy', "'winner1','🏆','Winner 1'"],
  ['winner 2 strategy', "'winner2','🥇','Winner 2'"],
  ['winner deterministic entry one', "deterministicScore('winner1-entry:'"],
  ['winner deterministic entry two', "deterministicScore('winner2-entry:'"],
  ['winner post-entry telemetry', "p.postEntryPath.push("],
  ['winner 1 fast-failure exit', "Winner 1 · no early spark"],
  ['winner 2 confirmation exit', "Winner 2 · did not prove winner shape"],
  ['winner alpha override protection', "postEntryExperiment=!!d.postEntryProfile"],
  ['postgres restore captured client', "repairCurrentSeasonFromJournal(client)"],
  ['postgres restore ownership gate', "Postgres disconnected during restore"],
  ['postgres readiness ownership gate', "Postgres disconnected before readiness"]
])if(!src.includes(needle))failures.push(name+' missing');

// Dedicated market-cap discovery regression guards.
for(const [name,needle] of [
  ['minute sampler universe discovery', "async function refreshMinuteSamplerUniverse"],
  ['market-cap sorted Pump discovery', "sort=market_cap&order=DESC"],
  ['minute sampler DEX enrichment', "dexscreener-minute-universe"],
  ['sampler tick awaits universe refresh', "await refreshMinuteSamplerUniverse(false)"]
])if(!src.includes(needle))failures.push(name+' missing');

// Forced minute market-cap sampler regression guards.
for(const [name,needle] of [
  ['Sub $100K minute sampler', "'minute_sub100','⏱️','Sub $100K Minute Trader'"],
  ['$100K-$250K minute sampler', "'minute_100_250','⏱️','$100K–$250K Minute Trader'"],
  ['$500K-$1M minute sampler', "'minute_500_1m','⏱️','$500K–$1M Minute Trader'"],
  ['minute sampler exact sub100 ceiling', "minute_sub100:{cohort:'MINUTE MARKET CAP',minuteSampler:true,fixedStakeUsd:100,mcMin:0,mcMax:100000"],
  ['minute sampler exact 100-250 band', "minute_100_250:{cohort:'MINUTE MARKET CAP',minuteSampler:true,fixedStakeUsd:100,mcMin:100000,mcMax:250000"],
  ['minute sampler exact 500-1m band', "minute_500_1m:{cohort:'MINUTE MARKET CAP',minuteSampler:true,fixedStakeUsd:100,mcMin:500000,mcMax:1000000"],
  ['minute sampler forced engine', "function minuteSamplerTick()"],
  ['minute sampler forced opener', "function openMinuteSamplerTrade"],
  ['minute sampler 50 second cadence', "'minute-samplers',()=>minuteSamplerTick(),{budgetMs:18000,critical:true}),50000"],
  ['minute sampler recycle exit', "minute sampler scheduled recycle"],
  ['minute sampler normal-stack bypass', "if(d.minuteSampler)continue;"],
  ['minute sampler UI exposure', "'minute_sub100','minute_100_250','minute_500_1m'"]
])if(!src.includes(needle))failures.push(name+' missing');

// Fast scalp experiment regression guards.
for(const [name,needle] of [
  ['Velocity Scalper strategy', "'velocity_scalper','⚡','Velocity Scalper'"],
  ['Velocity Scalper fixed stake', "fixedStakeUsd:100"],
  ['Velocity Scalper fast profile', "fastScalp:true"],
  ['Velocity Scalper velocity score', "mode==='velocity'"],
  ['Velocity Scalper sustained burst gate', "minMediumRet"],
  ['Velocity Scalper faster cadence', "d.fastScalp?30000"],
  ['Velocity Scalper quick take', "velocity scalp quick take"],
  ['Velocity Scalper hard stop', "velocity scalp hard stop"],
  ['Velocity Scalper timeout', "velocity scalp timeout"],
  ['Velocity Scalper soft science bypass', "fastScalpSoftBypass"],
  ['Velocity Scalper timed return history', "timedCoverageSec"],
  ['Velocity Scalper 5s return', "ret5s"],
  ['Velocity Scalper 20s return', "ret20s"],
  ['Velocity Scalper fixed final stake', "d.fastScalp?Math.min(sizing.budget"],
  ['Fast Pump open marks', "async function pumpOpenPositionPoll()"],
  ['Fast Pump mark cadence', "'pump-open-marks',()=>pumpOpenPositionPoll()"]
])if(!src.includes(needle))failures.push(name+' missing');


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

const liveReadyAnchor="setLifecycle('READY','market loops initialized')";
const rescueReadyAnchor="setLifecycle(emergencyOffsiteRestored&&!durableTradingReady()?'DEGRADED':'READY'";
const readyAt=Math.max(src.indexOf(liveReadyAnchor),src.indexOf(rescueReadyAnchor));
if(readyAt<0||src.indexOf("server.listen(PORT,'0.0.0.0'")<readyAt)failures.push('public port must bind only after validated ready/degraded recovery lifecycle');
if(!src.includes("FATAL_STATE_INTEGRITY · refusing to bind public port"))failures.push('startup integrity fence missing');

if(src.includes("forensic-placeholder-trade"))failures.push('forensic recovery must not synthesize placeholder trades');
if(!src.includes("source:'Render observed pre-incident checkpoint'"))failures.push('forensic checkpoint provenance missing');

if(!src.includes("kv.set('pump-lab:state:highwater'")&&!src.includes("kv.set(\'pump-lab:state:highwater\'"))failures.push('high-water must be persisted independently');
if(!src.includes("VALUES('main:highwater'"))failures.push('Postgres high-water row missing');

// Single-authority anti-regression guards.
// Recovery source selection must be freshness-first.
if(!src.includes("peerRetryNotBefore"))failures.push('peer retry cooldown state missing');
if(!src.includes("retry-after"))failures.push('peer Retry-After handling missing');
if(!src.includes("peerFailureCount"))failures.push('peer exponential failure backoff missing');

if(!src.includes("PEER_RECOVERY_TIMEOUT_MS"))failures.push('bounded peer recovery timeout missing');
if(!src.includes("PEER_RECOVERY_ACCEPTED"))failures.push('peer recovery success telemetry missing');
if(!src.includes("PEER_RECOVERY_FAILED"))failures.push('peer recovery failure telemetry missing');

if(src.includes("sameSeasonRecovery(s)&&currentExits>=RECOVERY_MIN_EXITS&&incomingExits<currentExits"))failures.push('legacy exit-count richness veto still active');
if(!src.includes("const peerRestoredNow=PEER_RECOVERY_URL?await tryPeerRecovery():false"))failures.push('peer is not evaluated before canonical repair/reseed');
if(!src.includes("if(PEER_RECOVERY_URL)await tryPeerRecovery();"))failures.push('final peer freshness check missing');
if(!src.includes("const reasons=[],critical=s?.stateMeta?.scope==='critical'"))failures.push('critical high-water scope awareness missing');

if(src.includes("ts<stateVersionTs&&!richer"))failures.push('older richer snapshots can still overwrite newer state');
if(src.includes("if(!isFrozenExperimentStrategy(d)&&rows.length>=20"))failures.push('frozen experiment still bypasses adaptive collection calibration');
if(!src.includes("throw new Error('Season migration required but ALLOW_SEASON_MIGRATION is false; refusing automatic reset')"))failures.push('season migration fail-closed guard missing');
if(!src.includes("stateAuthority:{version:STATE_AUTHORITY_VERSION"))failures.push('state authority metadata missing');
if(!src.includes("cleanStrategyTrades(d.id)"))failures.push('clean-season strategy ledger view missing');
if(!src.includes("STATE_AUTHORITY_RECONCILE"))failures.push('state authority reconciliation observability missing');

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

console.log('PUMP LAB audit static checks passed: ' + checks.length + ' core checks + 12 Season 2 systems + recovery peer + 25 unique trader visuals');
