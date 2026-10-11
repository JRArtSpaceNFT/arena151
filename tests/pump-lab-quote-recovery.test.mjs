import test from 'node:test';
import assert from 'node:assert/strict';
import {bestGeckoExitPool,quoteRecoveryCandidates} from '../lib/pump-lab-quote-recovery.mjs';

const mint='3XEBSNVJS17yfH57ue3LWf24BiKr8C3THyBUk56Mpump';
const pool=(overrides={})=>({
 attributes:{address:'POOL',base_token_price_usd:'0.000002',quote_token_price_usd:'100',
 reserve_in_usd:'15500',market_cap_usd:'20000',volume_usd:{m5:'1200'},
 transactions:{m5:{buys:5,sells:3}},...overrides},
 relationships:{base_token:{data:{id:'solana_'+mint}},quote_token:{data:{id:'solana_SOL'}}}
});
test('only matching token side with active liquidity and prints can supply exit candidate',()=>{
 const x=bestGeckoExitPool({data:[pool()]},mint);
 assert.equal(x.priceUsd,.000002);assert.equal(x.liquidityUsd,15500);assert.equal(x.quoteSide,'base');
 assert.equal(x.evidence,'pool-reported-price-liquidity-and-5m-trades');
 assert.equal(bestGeckoExitPool({data:[pool({reserve_in_usd:'0'})]},mint),null);
 assert.equal(bestGeckoExitPool({data:[pool({transactions:{m5:{buys:0,sells:0}}})]},mint),null);
 assert.equal(bestGeckoExitPool({data:[pool({volume_usd:{m5:'0'}})]},mint),null);
});
test('a quote-side pool must use quote price, not base price',()=>{
 const p=pool();p.relationships.base_token.data.id='solana_SOL';
 p.relationships.quote_token.data.id='solana_'+mint;
 assert.equal(bestGeckoExitPool({data:[p]},mint).priceUsd,100);
});
test('reject pools with missing or mismatched token identity',()=>{
 const p=pool();delete p.relationships;
 assert.equal(bestGeckoExitPool({data:[p]},mint),null);
 assert.equal(bestGeckoExitPool({data:[pool()]},'DIFFERENT'),null);
});
test('prioritize overdue and stale positions without changing original objects',()=>{
 const ts=1800000000000;
 const rows=[{mint,opened:ts-500000,lastMarkedAt:ts-300000,closed:false},
 {mint:'OTHER',opened:ts-60000,lastMarkedAt:ts-60000,closed:false},
 {mint:'OVERDUE',opened:ts-900000,lastMarkedAt:ts-800000,closed:false}];
 assert.deepEqual(quoteRecoveryCandidates(rows,()=>({maxHoldMinutes:1}),ts,1),['OVERDUE']);
 assert.equal(rows[0].lastMarkedAt,ts-300000);
});
