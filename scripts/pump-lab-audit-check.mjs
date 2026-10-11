import fs from 'node:fs';

const src = fs.readFileSync(new URL('../server.mjs', import.meta.url), 'utf8');
const scienceSrc = fs.readFileSync(new URL('../lib/pump-lab-season2-science.mjs', import.meta.url), 'utf8');
const alphaSrc = fs.readFileSync(new URL('../lib/pump-lab-alpha-os.mjs', import.meta.url), 'utf8');
const failures = [];

const must = (name, needle, hay=src) => { if (!hay.includes(needle)) failures.push(name); };

must('Five Brain strategy era', "v7-five-brain-2026-10-11");
must('Five Brain clean season', "season4-five-brain-2026-10-11");
must('Sentinel strategy', "'banker','🛡️','The Sentinel'");
must('Surge strategy', "'momentum','⚡','The Surge'");
must('Rebound strategy', "'dip','↗️','The Rebound'");
must('Runner strategy', "'champion','🏃','The Runner'");
must('Flow strategy', "'smartmom','🧠','The Flow'");
must('exact active five IDs', "new Set(['banker','momentum','dip','champion','smartmom'])");
must('legacy challengers disabled', 'const challengers = [];');
must('five brain marker', 'fiveBrain:true');
must('strict price path integrity', 'function executionPathIntegrity(t)');
must('cross-source discontinuity block', "cross-source price discontinuity");
must('feed disagreement block', "price ping-pong / feed disagreement");
must('stagnant price block', "stagnant quote");
must('entry path integrity gate', "if(!pathIntegrity.ok)return fail('abstain: '+pathIntegrity.reason)");
must('chart quality gate', "abstain: chart quality");
must('path continuity gate', "abstain: path continuity");
must('spike risk gate', "abstain: spike/chase risk");
must('chart structure gate', "abstain: chart structure");
must('exit price integrity block', 'EXIT_PRICE_INTEGRITY_BLOCK');
must('entry price source capture', 'entryPriceSource:t.priceSource');
must('source-aware token history', 'priceSource:old.priceSource');
must('current-era risk watermark', 'function currentEraRiskWatermark(d)');
must('risk circuit', 'function strategyRiskCircuit(d)');
must('five brain controlled sizing', 'isFive?.12');
must('five brain stop-risk budget', 'isFive?.015');
must('five brain scale out levels', 'd.fiveBrain?[15,30,60,120]');
must('adaptive five brain exits', 'if(d.fiveBrain&&d.exitBrain)');
must('winner confirmation state', 'p.winnerConfirmed');
must('hard failure cut', "hard risk cut");
must('early thesis failure exit', "thesis failed to prove itself");
must('winner trail exit', "winner trail protected");
must('flow fade exit', "momentum/flow thesis faded");
must('no minute samplers active work', 'if(!activeMinuteSamplers.length)return;');
must('durable startup gate', 'STARTUP_STATE_GATE waiting for Postgres / Key Value / local / peer recovery');
must('durable trading gate', 'durableTradingReady()');
must('strict state version rejection', 'STATE_VERSION_REGRESSION_REJECTED');
must('critical state version rejection', 'CRITICAL_STATE_VERSION_REGRESSION_REJECTED');
must('recovery high water', 'recoveryHighWater');
must('ledger reconciliation', 'reconcileAuthoritativeExperimentState(');
must('state integrity validation', 'validateStateIntegrity({repair:true})');
must('season migration fail closed', "Season migration required but ALLOW_SEASON_MIGRATION is false");
must('fresh Alpha OS reset', 'freshAlpha=createPumpLabAlphaOS');
must('science reset', 'science.reset()');
must('five brain clean reset telemetry', 'FIVE_BRAIN_CLEAN_START');
must('paper execution quote', "executionQuote(t,budget,'buy')");
must('execution simulator', 'science.executionSimulation');
must('Alpha OS candidate evaluation', 'alphaOS.evaluateCandidate');
must('Alpha OS exit plan', 'alphaOS.exitPlan');
must('stale-position quarantine', 'STALE_POSITION_QUARANTINE');
must('synthetic zero writeoffs disabled', 'synthetic zero write-offs disabled');
must('impossible-loss detector', 'IMPOSSIBLE_LOSS_FLAG');
must('meme universe eligibility', 'memeUniverseEligibility(t)');
must('same-mint cooldown', 'PAPER_SAME_MINT_COOLDOWN_MS');
must('anti-overtrade cadence', 'function tradeCadenceGuard(d,t)');
must('holdout partition', 'partitionForMint(mint)');
must('paper only science safeguard', 'paperOnly:true', scienceSrc);
must('science auto promotion disabled', 'autoPromotion:false', scienceSrc);
must('wallet quality scoring', 'walletQuality(wallet,mc=0)', alphaSrc);
must('wallet consensus', 'walletConsensus(t,windowMin=15)', alphaSrc);
must('pre-trade safety', 'preTradeSafety(token,c={}', alphaSrc);

const strategyBlock = src.slice(src.indexOf('const strategyDefs = ['), src.indexOf('const challengers = [];'));
const activeRows = [...strategyBlock.matchAll(/^\s*\['(banker|momentum|dip|champion|smartmom)'/gm)].map(m=>m[1]);
if (activeRows.length !== 5 || new Set(activeRows).size !== 5) failures.push('strategyDefs must contain exactly five active primary rows');
for (const legacy of ['minute_sub100','minute_100_250','minute_500_1m','winner1','winner2','launchctl','random']) {
  if (strategyBlock.includes("'"+legacy+"'")) failures.push('retired active strategy still present: '+legacy);
}

if (failures.length) {
  console.error('PUMP LAB FIVE BRAIN AUDIT FAILED');
  for (const name of failures) console.error(' - ' + name);
  process.exit(1);
}
console.log('PUMP LAB Five Brain audit passed: exactly five active bots + integrity-first execution + clean-era safeguards');
