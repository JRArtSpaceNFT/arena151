import fs from 'node:fs';

const src = fs.readFileSync(new URL('../server.mjs', import.meta.url), 'utf8');
const checks = [
  ['durable startup gate', "STARTUP_STATE_GATE waiting for durable restore"],
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
  ['Alpha OS analytical era', "v3.3-alpha-os"],
  ['Alpha OS integration', 'alphaOS.evaluateCandidate'],
  ['CIO capital auction', 'alphaOS.runCapitalAuction'],
  ['adaptive exit intelligence', 'alphaOS.exitPlan'],
  ['shadow execution twin', 'alphaOS.recordShadowEntry']
];

const failures = checks.filter(([, needle]) => !src.includes(needle));

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

if (failures.length) {
  console.error('PUMP LAB AUDIT STATIC CHECK FAILED');
  for (const [name] of failures) console.error(' - ' + name);
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

console.log('PUMP LAB audit static checks passed: ' + checks.length + ' + 25 unique trader visuals');
