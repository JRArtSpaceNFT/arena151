import http from 'node:http';
import {PaperEngine} from '../lib/pump-lab-v2-paper-engine.mjs';
import fs from 'node:fs';
import path from 'node:path';
const PORT=Number(process.env.PORT||10000), KEY=process.env.PUMPPORTAL_API_KEY||'';
const METERED=process.env.ALLOW_METERED_PUMPPORTAL==='true';
const PAPER_ONLY=true;
const engine=new PaperEngine({databaseUrl:process.env.DATABASE_URL});
engine.init().catch(e=>console.warn('V2_ENGINE_INIT_FAILED',e.message));
setInterval(()=>engine.cycle([...tokens.keys()]).catch(e=>console.warn('V2_ENGINE_CYCLE_FAILED',e.message)),15000).unref?.();
const DIR=process.env.V2_DATA_DIR||'/tmp/pump-lab-v2';
fs.mkdirSync(DIR,{recursive:true});
const JOURNAL=path.join(DIR,'events.jsonl');
let seq=0,ws=null,lastEvent=0,connected=false,tradeStream=false;
const tokens=new Map(),positions=[],events=[],strategies=['Fortress','Second Chance','Velocity','Vetted Sampler','Meta-Gate'];
const balances=Object.fromEntries(strategies.map(x=>[x,1000]));
const append=e=>{const item={seq:++seq,at:new Date().toISOString(),...e};events.push(item);if(events.length>250)events.shift();fs.appendFileSync(JOURNAL,JSON.stringify(item)+'\n');return item;};
const safeNum=n=>Number.isFinite(Number(n))?Number(n):null;
const now=()=>Date.now();
function snapshot(){const e=engine.state();return{paperEngine:e,status:connected?'connected':'disconnected',tradeStream,canPaperTrade:e.ready,realMoney:false,marketEvents:seq,trackedTokens:tokens.size,openPositions:e.openPositions,trades:e.trades,events:events.slice(-40).reverse(),bots:strategies.map(name=>({name,bankroll:(e.bots.find(b=>b.name===name)?.cash??balances[name]),open:e.bots.find(b=>b.name===name)?.open??0,enabled:e.ready,role:name==='Vetted Sampler'?'baseline':name==='Meta-Gate'?'research-gated':name==='Velocity'?'latency-only':'strategy'})),warnings: [...e.warnings,!KEY?'PumpPortal API key missing: only free new-token discovery available.':null,!METERED?'PumpPortal tick stream disabled: DexScreener polling is used for paper quote estimates.':null,'Paper trades use modeled costs, not executable venue quotes; token-holder/bundle risk checks are not yet verified.',!e.ready?'Persistent PostgreSQL connection required; trades are disabled until it is healthy.':null].filter(Boolean)};}
function newToken(x){const mint=x.mint;if(typeof mint!=='string'||mint.length<32)return;tokens.set(mint,{mint,name:String(x.name||'').slice(0,80),created:now(),observations:[],migration:false});if(tokens.size>1000){let key=tokens.keys().next().value;tokens.delete(key)}append({type:'new_token',mint});}
function onTrade(x){const t=tokens.get(x.mint);if(!t)return;const vSol=safeNum(x.vSolInBondingCurve),vTokens=safeNum(x.vTokensInBondingCurve);
if(!(vSol>0&&vTokens>0))return;
const priceSol=vSol/vTokens,stamp=now();
if(!Number.isFinite(priceSol)||priceSol<=0)return;
t.observations.push({ts:stamp,priceSol,side:x.txType||null,volumeSol:safeNum(x.solAmount)});
if(t.observations.length>300)t.observations.shift();
lastEvent=stamp;
evaluate(t);
}
function evaluate(t){ // Fail closed until independent vetoes, fee model and persistence are built.
const obs=t.observations, n=obs.length;if(n<3)return;
const latest=obs[n-1],age=now()-latest.ts;
if(age>5000)return;
const first=obs[0],change=latest.priceSol/first.priceSol-1;
if(n===3)append({type:'signal_observed',mint:t.mint,returnPct:+(change*100).toFixed(2),status:'RESEARCH_ONLY',reason:'Safety gates incomplete: no simulated fills'});
}
function startFeed(){
const url='wss://pumpportal.fun/api/data'+(KEY?'?api-key='+encodeURIComponent(KEY):'');
try{ws=new WebSocket(url)}catch(e){append({type:'feed_error',message:String(e.message)});setTimeout(startFeed,15000);return;}
ws.addEventListener('open',()=>{connected=true;append({type:'feed_connected'});ws.send(JSON.stringify({method:'subscribeNewToken'}));});
ws.addEventListener('message',ev=>{let data;try{data=JSON.parse(ev.data)}catch{return}if(data.txType==='create'&&data.mint)newToken(data);else if(data.mint&&data.txType==='migrate'){const t=tokens.get(data.mint);if(t)t.migration=true;append({type:'migration',mint:data.mint})}else if(data.mint&&data.txType)onTrade(data);});
ws.addEventListener('close',()=>{connected=false;tradeStream=false;append({type:'feed_disconnected'});setTimeout(startFeed,15000)});
ws.addEventListener('error',()=>append({type:'feed_socket_error'}));
}
function tradeRows(list,escape){
 const money=n=>Number.isFinite(Number(n))?String.fromCharCode(36)+Number(n).toFixed(2):'—';
 return list.slice(0,40).map(t=>{
 const buy=t.kind==='BUY',pnl=buy?null:t.pnl,amount=buy?t.entryCost:t.proceeds,price=buy?t.entryPrice:t.priceUsd;
 const ts=t.at?new Date(t.at).toLocaleString('en-US',{timeZone:'America/Los_Angeles',month:'short',day:'numeric',hour:'numeric',minute:'2-digit'}):'—';
 const mint=String(t.mint||'');
 return '<tr><td>'+escape(ts)+'</td><td>'+escape(t.bot)+'</td><td title="'+escape(mint)+'">'+escape(mint.slice(0,6)+'…'+mint.slice(-4))+'</td><td class="'+(buy?'good':'warn')+'">'+t.kind+'</td><td>'+money(amount)+'</td><td>'+money(price)+'</td><td>'+(buy?'Open / entry':pnl>=0?'Profit':'Loss')+'</td><td class="'+(pnl===null?'muted':pnl>=0?'good':'warn')+'">'+(pnl===null?'—':(pnl>=0?'+':'')+money(pnl))+'</td></tr>';
 }).join('');
}
const page=`<!doctype html><html lang="en"><head><meta name="viewport" content="width=device-width,initial-scale=1"><meta charset="utf-8"><title>Pump Lab V2 · Research Monitor</title><style>body{margin:0 auto;max-width:1000px;padding:24px;background:#0a101b;color:#eff5ff;font:15px system-ui}h1{font-size:36px}.muted{color:#9db0ca}.cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:12px}.card{padding:18px;border:1px solid #293e53;background:#142033;border-radius:14px;margin-bottom:13px}b{font-size:24px}.warn{color:#ffc983}.good{color:#8ae2b5}table{width:100%;border-collapse:collapse}td,th{text-align:left;border-bottom:1px solid #2b3b4e;padding:12px 8px;font-size:13px}th{color:#9db0ca}.scroll{overflow:auto}small{color:#8ca0b9}</style></head><body><small>PUMP LAB / RESEARCH ONLY / NO REAL FUNDS</small><h1>V2 Market Observatory</h1><p class="muted">Auto-refreshing every 10 seconds. Trades appear only after execution is validated.</p><div class="cards"><div class="card">Feed<br><b id="feed">—</b></div><div class="card">Observed events<br><b id="events">—</b></div><div class="card">Tracked tokens<br><b id="tokens">—</b></div><div class="card">Paper trade fills<br><b id="fills">—</b></div></div><div class="card"><h2>System notices</h2><div id="warnings">Loading...</div></div><div class="card"><h2>Five bot research roles</h2><div class="scroll"><table><thead><tr><th>Bot</th><th>Paper capital</th><th>Open</th><th>State</th></tr></thead><tbody id="bots"></tbody></table></div></div><div class="card"><h2>Paper trade activity</h2><div class="scroll"><table><thead><tr><th>Time (PT)</th><th>Bot</th><th>Token</th><th>Action</th><th>Value</th><th>Price</th><th>Result</th><th>Realized P&amp;L</th></tr></thead><tbody id="trades"><tr><td colspan="8">Loading…</td></tr></tbody></table></div><small>BUY opens a paper position; SELL closes it. P&amp;L shows realized simulated profit or loss after modeled costs.</small></div><div class="card"><h2>Market feed events</h2><div id="timeline"></div></div><small>This deployment does not use private keys, submit on-chain transactions, or generate fabricated P&L. Runtime event journal on ephemeral disk; not a permanent database.</small><script>
function tradeRows(list,escape){
 const money=n=>Number.isFinite(Number(n))?String.fromCharCode(36)+Number(n).toFixed(2):'—';
 return list.slice(0,40).map(t=>{
 const buy=t.kind==='BUY',pnl=buy?null:t.pnl,amount=buy?t.entryCost:t.proceeds,price=buy?t.entryPrice:t.priceUsd;
 const ts=t.at?new Date(t.at).toLocaleString('en-US',{timeZone:'America/Los_Angeles',month:'short',day:'numeric',hour:'numeric',minute:'2-digit'}):'—';
 const mint=String(t.mint||'');
 return '<tr><td>'+escape(ts)+'</td><td>'+escape(t.bot)+'</td><td title="'+escape(mint)+'">'+escape(mint.slice(0,6)+'…'+mint.slice(-4))+'</td><td class="'+(buy?'good':'warn')+'">'+t.kind+'</td><td>'+money(amount)+'</td><td>'+money(price)+'</td><td>'+(buy?'Open / entry':pnl>=0?'Profit':'Loss')+'</td><td class="'+(pnl===null?'muted':pnl>=0?'good':'warn')+'">'+(pnl===null?'—':(pnl>=0?'+':'')+money(pnl))+'</td></tr>';
 }).join('');
}
const esc=s=>String(s??'—').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
async function refresh(){try{const d=await(await fetch('/api/status',{cache:'no-store'})).json();document.getElementById('feed').textContent=d.status;document.getElementById('events').textContent=d.marketEvents;document.getElementById('tokens').textContent=d.trackedTokens;document.getElementById('fills').textContent=d.paperEngine.closedTrades+' closed / '+d.paperEngine.openPositions+' open';document.getElementById('warnings').innerHTML=d.warnings.map(w=>'<p class="warn">'+esc(w)+'</p>').join('')||'<p class="good">No warnings</p>';document.getElementById('bots').innerHTML=d.bots.map(b=>'<tr><td>'+esc(b.name)+'</td><td>$'+b.bankroll+'</td><td>'+b.open+'</td><td>'+esc(b.enabled?'Observation':'Research gated')+'</td></tr>').join('');document.getElementById('trades').innerHTML=d.trades.length?tradeRows(d.trades,esc):'<tr><td colspan="8">No trades recorded yet.</td></tr>';document.getElementById('timeline').innerHTML=d.events.slice(0,20).map(e=>'<p><small>'+esc(e.at)+'</small> · '+esc(e.type)+' · '+esc((e.mint||'').slice(0,10))+'</p>').join('')}catch(e){document.getElementById('feed').textContent='offline'}}refresh();setInterval(refresh,10000)
</script></body></html>`;
http.createServer((req,res)=>{const url=new URL(req.url,'http://localhost');if(url.pathname==='/api/status'||url.pathname==='/health'){res.setHeader('content-type','application/json');res.setHeader('cache-control','no-store');return res.end(JSON.stringify(url.pathname==='/health'?{ok:true,connected,canPaperTrade:engine.state().ready,databaseReady:engine.state().ready}:snapshot()))}res.setHeader('content-type','text/html; charset=utf-8');res.setHeader('cache-control','no-store');
const state=snapshot(),escHtml=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const first=page
.replace('<b id="feed">—</b>','<b id="feed">'+escHtml(state.status)+'</b>')
.replace('<b id="events">—</b>','<b id="events">'+state.marketEvents+'</b>')
.replace('<b id="tokens">—</b>','<b id="tokens">'+state.trackedTokens+'</b>')
.replace('<b id="fills">—</b>','<b id="fills">'+state.paperEngine.closedTrades+' closed / '+state.paperEngine.openPositions+' open</b>')
.replace('<div id="warnings">Loading...</div>','<div id="warnings">'+state.warnings.map(x=>'<p class="warn">'+escHtml(x)+'</p>').join('')+'</div>')
.replace('<tbody id="bots"></tbody>','<tbody id="bots">'+state.bots.map(b=>'<tr><td>'+escHtml(b.name)+'</td><td>'+String(b.bankroll)+'</td><td>'+String(b.open)+'</td><td>'+escHtml(b.enabled?'Tracking':'Storage blocked')+'</td></tr>').join('')+'</tbody>')
.replace('<tbody id="trades"><tr><td colspan="8">Loading…</td></tr></tbody>','<tbody id="trades">'+(state.trades.length?tradeRows(state.trades,escHtml):'<tr><td colspan="8">No trades recorded yet.</td></tr>')+'</tbody>')
.replace('<div id="timeline"></div>','<div id="timeline">'+state.events.slice(0,20).map(e=>'<p><small>'+escHtml(e.at)+'</small> · '+escHtml(e.type)+' · '+escHtml((e.mint||'').slice(0,10))+'</p>').join('')+'</div>');
res.end(first)}).listen(PORT,'0.0.0.0',()=>{console.log('V2 observatory listening on '+PORT);startFeed()});
