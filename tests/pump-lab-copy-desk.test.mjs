import test from 'node:test';
import assert from 'node:assert/strict';
import {CopyDesk,screenCopyTrader,assessCopyToken,normalizeRugcheck} from '../lib/pump-lab-copy-desk.mjs';
const ts=Date.UTC(2026,9,12,21);
const wallet='B'.repeat(43),mint='C'.repeat(43);
const closed=Array.from({length:24},(_,i)=>({wallet,ts:ts-(i+1)*3600000,mint:'m'+i,pnlUsd:i%5===0?-5:15,holdSeconds:120}));
const quality={wallet,copyability:74,excluded:false};
const report={score_normalised:24,token:{mintAuthority:null,freezeAuthority:null},risks:[],topHolders:[{pct:8},{pct:6},{pct:6},{pct:4}],insiderNetworks:[],lpLockedPct:100};
test('trader requires diversified recent closes and realistic holding periods',()=>{
 const r=screenCopyTrader({wallet,closed,quality,ts});assert.equal(r.status,'CANDIDATE');assert.equal(r.sample,24);
 const concentrated=closed.map(x=>({...x,mint:'same'}));assert.ok(screenCopyTrader({wallet,closed:concentrated,quality,ts}).reasons.includes('one_coin_concentration'));
});
test('trader with unknown PnL does not accidentally pass',()=>{
 assert.equal(screenCopyTrader({wallet,quality,closed:[{wallet,ts,pnlUsd:null}],ts}).status,'REJECT');
});
test('risk report flags dangerous authorities and critical flags',()=>{
 const r=assessCopyToken({...report,token:{mintAuthority:'open',freezeAuthority:null},risks:[{level:'critical',name:'control'}]});
 assert.equal(r.status,'SKIP');assert.ok(r.reasons.includes('authority_open'));
});
test('unknown token schema and pool-lock evidence fail closed',()=>{
 assert.ok(assessCopyToken({...report,score_normalised:undefined}).reasons.includes('missing_normalized_risk_score'));
 assert.ok(assessCopyToken({...report,lpLockedPct:undefined},{graduated:true}).reasons.includes('missing_pool_lock_evidence'));
 assert.equal(normalizeRugcheck({score:1,token:{mintAuthority:null,freezeAuthority:null}}).score,null);
});
test('verified token facts permit qualified paper copy only',async()=>{
 const d=new CopyDesk({clock:()=>ts,fetchReport:async()=>report});
 const event={action:'BUY',confidence:'verified',watchlist:true,traderId:'leader',wallet,mint,signature:'sig-1',symbol:'MOON'};
 const q={mint,symbol:'MOON',price:1,liq:50000,updatedAt:ts,verified:true,graduated:true};
 assert.equal(await d.inspectBuy({event,closed,quality,quote:()=>q}),true);
 assert.equal(d.positions.length,1);assert.equal(d.cash<1000,true);assert.equal(d.decisions[0].action,'PAPER_BUY');
 assert.equal(d.mark({...q,price:1.4,updatedAt:ts+120000},{verified:true,ts:ts+120000}),true);
 assert.equal(d.positions.length,0);assert.equal(d.trades.length,1);assert.equal(d.trades[0].why,'take_profit');
});
test('missing quote and report failures never fabricate fills',async()=>{
 const e={action:'BUY',confidence:'verified',watchlist:true,traderId:'leader',wallet,mint,signature:'sig-2'};
 const d=new CopyDesk({clock:()=>ts,fetchReport:async()=>{throw Error('unavailable')}});
 assert.equal(await d.inspectBuy({event:e,closed,quality,quote:()=>null}),true);
 assert.equal(d.positions.length,0);assert.match(d.decisions[0].reason,/rugcheck_unavailable/);
 const d2=new CopyDesk({clock:()=>ts,fetchReport:async()=>report});
 await d2.inspectBuy({event:e,closed,quality,quote:()=>({price:1,liq:50000,updatedAt:ts,verified:false})});
 assert.equal(d2.positions.length,0);assert.equal(d2.decisions[0].stage,'PRICE');
});
test('no approval for unknown or unverified wallet source',async()=>{
 const d=new CopyDesk({clock:()=>ts,fetchReport:async()=>report});
 assert.equal(await d.inspectBuy({event:{action:'BUY',watchlist:true,confidence:'associated'},closed,quality}),false);
 assert.equal(d.requestCount,0);
});
test('copy desk checkpoint roundtrip restores independent paper history',async()=>{
 const d=new CopyDesk({clock:()=>ts,fetchReport:async()=>report});
 const e={action:'BUY',confidence:'verified',watchlist:true,traderId:'leader',wallet,mint,signature:'sig-3'};
 await d.inspectBuy({event:e,closed,quality,quote:()=>({mint,price:1,liq:100000,updatedAt:ts,verified:true})});
 const copied=new CopyDesk({clock:()=>ts});assert.equal(copied.restore(d.serialize()),true);assert.equal(copied.positions.length,d.positions.length);assert.equal(copied.cash,d.cash);
});
