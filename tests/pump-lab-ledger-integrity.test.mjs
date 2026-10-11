import test from 'node:test';
import assert from 'node:assert/strict';
import {detailedLedgerTarget,detailedLedgerGap,mergeHistoricalTrades,permitCanonicalOverwrite}
 from '../lib/pump-lab-ledger-integrity.mjs';
test('critical 250-row snapshot must not replace 818-row full ledger',()=>{
 const target=detailedLedgerTarget({tradeCount:818},250,2000);
 assert.equal(target,818);
 assert.equal(detailedLedgerGap(target,250),568);
 assert.equal(permitCanonicalOverwrite(target,250),false);
});
test('merge preserves newer fill details and recovers older unique trade records',()=>{
 const latest=[{id:'b',closedAt:30,pnl:33},{id:'a',closedAt:20,pnl:22}];
 const older=[{id:'c',closedAt:10,pnl:11},{id:'b',closedAt:30,pnl:-999}];
 const merged=mergeHistoricalTrades(latest,older,2000);
 assert.equal(merged.added,1);
 assert.deepEqual(merged.trades.map(x=>x.id),['b','a','c']);
 assert.equal(merged.trades[0].pnl,33);
 assert.equal(latest.length,2);
 assert.equal(older.length,2);
 assert.equal(permitCanonicalOverwrite(3,merged.trades.length),true);
});
test('recovery cap and untrustworthy metadata are handled conservatively',()=>{
 assert.equal(detailedLedgerTarget({tradeCount:999999},100,2000),2000);
 assert.equal(detailedLedgerTarget({tradeCount:-4},100),100);
 assert.equal(detailedLedgerTarget({tradeCount:'unknown'},100),100);
 assert.equal(mergeHistoricalTrades([{id:'x'}],[{id:'x'},{id:'y'}],1).added,0);
});