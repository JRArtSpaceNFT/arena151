import fs from 'node:fs';

const src = fs.readFileSync(new URL('../server.mjs', import.meta.url), 'utf8');
const scienceSrc = fs.readFileSync(new URL('../lib/pump-lab-season2-science.mjs', import.meta.url), 'utf8');
const proxySrc = fs.readFileSync(new URL('../frontend-proxy.mjs', import.meta.url), 'utf8');
const checks = [
  ['durable startup gate', "STARTUP_STATE_GATE waiting for Postgres / Key Value / local / peer recovery"],
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
  ['Season 2 analytical era', "v4.0-season2-science"],
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
  ['critical recovery monotonicity', 'CRITICAL_STATE_REGRESSION_REJECTED'],
  ['recovery quality floor', 'CRITICAL_STATE_QUALITY_REJECTED'],
  ['journal regression detector', 'function journalRegressionCutoff(rows)'],
  ['journal season rebuild', 'async function repairCurrentSeasonFromJournal'],
  ['journal repair startup hook', 'const journalRepaired=await repairCurrentSeasonFromJournal(db)']
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

if(src.indexOf("setLifecycle('READY','market loops initialized')")<0||src.indexOf("server.listen(PORT,'0.0.0.0'")<src.indexOf("setLifecycle('READY','market loops initialized')"))failures.push('public port must bind only after READY');
if(!src.includes("FATAL_STATE_INTEGRITY · refusing to bind public port"))failures.push('startup integrity fence missing');

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
