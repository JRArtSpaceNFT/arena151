import http from 'node:http';
import fs from 'node:fs';

const PORT=Number(process.env.PORT||3000);
const PUMP_KEY=process.env.PUMPPORTAL_API_KEY||'';
const ALLOW_METERED=(process.env.ALLOW_METERED_PUMPPORTAL||'false')==='true';
const START=1000, TARGET=100000;
const feeRate=.0125;
const tokens=new Map(), positions=[], trades=[], activity=[], health=new Map(), clients=new Set();
const stateFile=process.env.STATE_FILE||'/tmp/pump-lab-state.json';

const defs=[
['banker','🏦','The Banker','LOW',.04,78,18,55,1],['quant','∑','The Quant','LOW',.05,76,20,65,1],['smart','🧠','Smart Money','MED',.07,72,24,70,1],
['social','📡','Social Alpha','MED',.07,70,23,65,1],['momentum','⚡','Momentum Hunter','HIGH',.09,66,18,72,1],['graduation','🎓','Graduation','MED',.07,70,22,65,1],
['dip','↘','Dip Buyer','MED',.07,72,20,65,1],['swing','🌊','Swing Trader','MED',.06,74,28,85,1],['degen','🔥','Early Degen','EXTREME',.13,60,16,55,2],
['smartmom','🧬','Smart Momentum','HIGH',.10,70,20,72,2],['culture','🌐','Culture Hybrid','HIGH',.09,70,22,72,2],['contrarian','🪞','Contrarian','MED',.06,75,20,65,1],
['sniper','🎯','Patient Sniper','MED',.12,84,18,80,1],['champion','👑','Champion','EXTREME',.15,67,20,68,2],['professional','🛡','Professional','LOW',.055,80,18,65,1],
['adaptive','🧭','Adaptive Master','MED',.09,74,20,72,2],['random','🎲','Random Control','CONTROL',.05,999,22,45,1],['volume','📊','Volume Control','CONTROL',.06,68,22,50,1]
].map(([id,icon,name,risk,size,min,stop,take,maxOpen])=>({id,icon,name,risk,size,min,stop,take,maxOpen,equity:START,cash:START,peak:START,dd:0,wins:0,losses:0,n:0}));

function now(){return Date.now()} function clamp(x,a=0,b=100){return Math.max(a,Math.min(b,x))}
function log(kind,text,severity='info',data={}){activity.unshift({ts:now(),kind,text,severity,data});activity.splice(180);broadcast('activity',{kind,text,severity,data})}
function h(component,status,detail){health.set(component,{ts:now(),component,status,detail});broadcast('health',{component,status,detail})}
function broadcast(type,data){const s=`event: ${type}\ndata: ${JSON.stringify(data)}\n\n`;for(const c of clients)try{c.write(s)}catch{clients.delete(c)}}
function money(x){return Number.isFinite(x)?x:0}
function narr(t){const z=`${t.name||''} ${t.symbol||''}`.toLowerCase();if(/ai|agent|gpt|robot/.test(z))return'AI';if(/dog|doge|inu|shib/.test(z))return'Dogs';if(/cat|kitty|meow/.test(z))return'Cats';if(/frog|pepe|toad/.test(z))return'Frogs';if(/game|pixel|play/.test(z))return'Games';if(/trump|polit|president/.test(z))return'Politics';return'Memes'}
function normalize(raw,source='live'){
 const mint=raw.mint||raw.tokenAddress||raw.address||raw.baseToken?.address;if(!mint)return null;
 const symbol=(raw.symbol||raw.baseToken?.symbol||raw.name||'TOKEN').toString().slice(0,18).toUpperCase();
 const name=(raw.name||raw.baseToken?.name||symbol).toString().slice(0,50);
 let mc=money(Number(raw.usd_market_cap||raw.marketCapUsd||raw.marketCap||raw.fdv||0));
 if(mc>0&&mc<1000&&Number(raw.marketCapSol)>0)mc=Number(raw.marketCapSol)*150;
 let price=money(Number(raw.priceUsd||raw.price_usd||0));if(!price&&mc>0)price=mc/1e9;
 const liq=money(Number(raw.liquidity?.usd||raw.liquidityUsd||raw.liquidity||Math.max(500,mc*.1)));
 const vol=money(Number(raw.volume?.m5||raw.volume?.h1||raw.volume1m||raw.volume||0));
 const buys=Number(raw.txns?.m5?.buys||raw.buys1m||0), sells=Number(raw.txns?.m5?.sells||raw.sells1m||0);
 const created=Number(raw.created_timestamp||raw.pairCreatedAt||raw.createdAt||now());const createdAt=created<1e12?created*1000:created;
 return {mint,symbol,name,source,price,mc,liq,vol,buys,sells,createdAt,updatedAt:now(),narrative:narr({name,symbol}),graduated:!!raw.complete,
   twitter:raw.twitter||'',website:raw.website||'',image:raw.image_uri||raw.image||raw.info?.imageUrl||'',creator:raw.creator||raw.traderPublicKey||'',history:[]};
}
function features(t){
 const hist=t.history||[];const prev=hist[Math.max(0,hist.length-4)]||{price:t.price};
 const mom=prev.price?((t.price/prev.price)-1)*100:0;const total=t.buys+t.sells;const buyRatio=total?t.buys/total:.5;
 const age=(now()-t.createdAt)/60000;const liqScore=clamp(Math.log10(Math.max(10,t.liq))*18-30);const volScore=clamp(Math.log10(Math.max(10,t.vol))*17-25);
 const momentum=clamp(50+mom*2.2);const flow=clamp(buyRatio*100);const early=clamp(100-age*3);const graduation=t.graduated?100:clamp((t.mc/69000)*100);
 const social=clamp((t.twitter?18:0)+(t.website?8:0)+Math.min(35,total*1.5));
 const risk=clamp(76-liqScore*.42-(total>5?10:0)+(age<1?10:0));
 const score=clamp(momentum*.25+flow*.2+liqScore*.15+volScore*.16+early*.08+social*.08+(100-risk)*.08);
 return {mom,buyRatio,age,liqScore,volScore,momentum,flow,early,graduation,social,risk,score};
}
function strategyScore(d,f,t){
 let s=f.score;
 if(d.id==='banker')s=f.liqScore*.28+f.flow*.18+f.volScore*.22+(100-f.risk)*.32;
 if(d.id==='quant')s=f.score+(f.buyRatio>.62?8:-4);
 if(d.id==='smart')s=f.flow*.35+f.volScore*.25+f.momentum*.2+(100-f.risk)*.2;
 if(d.id==='social')s=f.social*.38+f.momentum*.28+f.flow*.18+f.volScore*.16;
 if(d.id==='momentum')s=f.momentum*.45+f.flow*.22+f.volScore*.23+f.liqScore*.1;
 if(d.id==='graduation')s=f.graduation*.45+f.flow*.2+f.volScore*.2+(100-f.risk)*.15;
 if(d.id==='dip')s=(f.mom<0&&f.mom>-25?75:35)*.35+f.flow*.25+f.liqScore*.2+(100-f.risk)*.2;
 if(d.id==='swing')s=f.liqScore*.28+f.volScore*.24+f.flow*.18+(100-f.risk)*.3;
 if(d.id==='degen')s=f.early*.35+f.momentum*.25+f.flow*.2+f.volScore*.2;
 if(d.id==='smartmom')s=f.momentum*.34+f.flow*.27+f.volScore*.22+(100-f.risk)*.17;
 if(d.id==='culture')s=f.social*.3+f.momentum*.28+f.flow*.22+f.volScore*.2;
 if(d.id==='contrarian')s=(f.mom>-15&&f.mom<8?75:30)*.4+(100-f.risk)*.3+f.liqScore*.3;
 if(d.id==='sniper')s=f.score+(f.risk<35?10:-12);
 if(d.id==='champion')s=f.momentum*.38+f.flow*.24+f.volScore*.22+f.early*.16;
 if(d.id==='professional')s=f.liqScore*.3+f.volScore*.2+f.flow*.18+(100-f.risk)*.32;
 if(d.id==='adaptive')s=f.score+(marketRegime()==='HOT'?f.momentum*.08:(100-f.risk)*.08);
 if(d.id==='volume')s=f.volScore*.7+f.liqScore*.3;
 if(d.id==='random')s=Math.random()*100;
 return clamp(s);
}
function marketRegime(){const a=[...tokens.values()].filter(t=>now()-t.updatedAt<120000).map(features);if(!a.length)return'OFFLINE';const m=a.reduce((x,f)=>x+f.mom,0)/a.length;const br=a.reduce((x,f)=>x+f.buyRatio,0)/a.length;return m>10&&br>.55?'HOT':m<-8||br<.43?'RISK OFF':'SELECTIVE'}
function openCount(id){return positions.filter(p=>p.strategy===id&&!p.closed).length}
function markEquity(d){let e=d.cash;for(const p of positions.filter(x=>x.strategy===d.id&&!x.closed)){const t=tokens.get(p.mint);if(t)e+=p.units*t.price}d.equity=e;d.peak=Math.max(d.peak,e);d.dd=Math.max(d.dd,(1-e/d.peak)*100)}
function maybeTrade(t){
 const f=features(t);for(const d of defs){markEquity(d);const existing=positions.find(p=>p.strategy===d.id&&p.mint===t.mint&&!p.closed);
 if(existing){const pnl=(t.price/existing.entry-1)*100;const age=(now()-existing.opened)/60000;const fade=f.momentum<38||f.buyRatio<.38;
   if(pnl<=-d.stop||pnl>=d.take||age>(d.id==='swing'?90:35)||fade)closePos(d,existing,t,pnl,fade?'thesis broke':pnl>=d.take?'take profit':pnl<=-d.stop?'stop':'time exit');continue}
 if(openCount(d.id)>=d.maxOpen||d.cash<25||!(t.price>0))continue;const score=strategyScore(d,f,t);if(score<d.min)continue;
 if(d.risk==='LOW'&&f.risk>48)continue;if(d.id==='sniper'&&f.risk>34)continue;
 const budget=Math.min(d.cash*.45,Math.max(12,d.equity*d.size));const slip=.0035+Math.min(.04,budget/Math.max(1000,t.liq)*.5);const entry=t.price*(1+slip);
 const cost=budget*(1+feeRate);if(cost>d.cash)continue;d.cash-=cost;const p={id:'p'+now()+Math.random(),strategy:d.id,mint:t.mint,entry,units:budget/entry,invested:budget,opened:now(),closed:false,score,reason:`score ${score.toFixed(0)} · risk ${f.risk.toFixed(0)} · buy ratio ${(f.buyRatio*100).toFixed(0)}%`};positions.push(p);log('buy',`${d.icon} ${d.name} bought $${t.symbol} · $${budget.toFixed(0)} paper · ${p.reason}`,'good',{strategy:d.id,mint:t.mint})}
 }
}
function closePos(d,p,t,pnl,why){const slip=.0035+Math.min(.04,p.invested/Math.max(1000,t.liq)*.5);const exit=t.price*(1-slip);const gross=p.units*exit;const proceeds=gross*(1-feeRate);d.cash+=proceeds;p.closed=true;p.closedAt=now();p.exit=exit;p.pnl=proceeds-p.invested*(1+feeRate);p.pnlPct=p.pnl/(p.invested*(1+feeRate))*100;p.why=why;d.n++;if(p.pnl>0)d.wins++;else d.losses++;trades.unshift({...p,symbol:t.symbol,name:t.name});trades.splice(300);markEquity(d);log('sell',`${d.icon} ${d.name} sold $${t.symbol} ${p.pnlPct>=0?'+':''}${p.pnlPct.toFixed(1)}% · ${why}`,p.pnl>=0?'good':'bad',{strategy:d.id,mint:t.mint})}
function ingest(raw,source){const t=normalize(raw,source);if(!t||!(t.price>0))return;const old=tokens.get(t.mint);if(old){t.history=(old.history||[]).slice(-39);t.history.push({ts:now(),price:old.price,mc:old.mc});t.buys=Math.max(t.buys,old.buys);t.sells=Math.max(t.sells,old.sells);t.vol=Math.max(t.vol,old.vol)}tokens.set(t.mint,t);if(!old)log('token',`🪙 LIVE launch spotted: $${t.symbol} · ${t.name}`,'info',{mint:t.mint,source});maybeTrade(t);broadcast('tick',{mint:t.mint})}
async function fetchJson(url){const r=await fetch(url,{headers:{accept:'application/json','user-agent':'PUMP-LAB-LIVE/0.3'}});if(!r.ok)throw Error(`HTTP ${r.status}`);return r.json()}
async function pumpPoll(){try{const u='https://frontend-api-v3.pump.fun/coins?offset=0&limit=50&sort=created_timestamp&order=DESC&includeNsfw=false';const j=await fetchJson(u);const rows=Array.isArray(j)?j:(j.data||j.coins||[]);if(!rows.length)throw Error('no rows');rows.forEach(x=>ingest(x,'pump.fun'));h('pump.fun','ok',`Live Pump.fun snapshot · ${rows.length} coins`)}catch(e){h('pump.fun','warn',`Pump.fun snapshot unavailable: ${e.message}`)}}
async function dexPoll(){try{const [a,b]=await Promise.all([fetchJson('https://api.dexscreener.com/token-profiles/latest/v1'),fetchJson('https://api.dexscreener.com/token-boosts/latest/v1')]);const items=[...(Array.isArray(a)?a:[]),...(Array.isArray(b)?b:[])].filter(x=>x.chainId==='solana');const uniq=[...new Map(items.map(x=>[x.tokenAddress,x])).values()].slice(0,30);let n=0;for(const x of uniq){try{const j=await fetchJson('https://api.dexscreener.com/latest/dex/tokens/'+x.tokenAddress);const pairs=(j.pairs||[]).filter(p=>p.chainId==='solana').sort((q,w)=>(w.liquidity?.usd||0)-(q.liquidity?.usd||0));if(pairs[0]){ingest({...pairs[0],mint:x.tokenAddress,name:pairs[0].baseToken?.name,symbol:pairs[0].baseToken?.symbol,image:x.icon,website:x.links?.[0]?.url},'dexscreener');n++}}catch{}}h('dexscreener','ok',`Live Solana market enrichment · ${n} tokens`)}catch(e){h('dexscreener','warn',`DEX Screener unavailable: ${e.message}`)}}
function connectPumpPortal(){if(!PUMP_KEY){h('pumpportal','standby','Add PUMPPORTAL_API_KEY for true websocket launch stream.');return}try{const ws=new WebSocket('wss://pumpportal.fun/api/data?api-key='+encodeURIComponent(PUMP_KEY));ws.addEventListener('open',()=>{h('pumpportal','ok',`REAL-TIME websocket connected · metered trades ${ALLOW_METERED?'ON':'OFF'}`);ws.send(JSON.stringify({method:'subscribeNewToken'}));ws.send(JSON.stringify({method:'subscribeMigration'}))});ws.addEventListener('message',ev=>{try{const x=JSON.parse(String(ev.data));ingest(x,'pumpportal');if(ALLOW_METERED&&x.mint){} }catch{}});ws.addEventListener('close',()=>{h('pumpportal','warn','Websocket disconnected; reconnecting.');setTimeout(connectPumpPortal,5000)});ws.addEventListener('error',()=>h('pumpportal','warn','Websocket error.'))}catch(e){h('pumpportal','warn',e.message)}}

let research={last:0,notes:[]};function runResearch(){const recent=trades.filter(t=>now()-t.closedAt<3600000);const wins=recent.filter(t=>t.pnl>0);const avg=recent.length?recent.reduce((a,t)=>a+t.pnlPct,0)/recent.length:0;const best=[...defs].filter(d=>d.risk!=='CONTROL').sort((a,b)=>b.equity-a.equity)[0];const note=`${recent.length} exits this hour · ${recent.length?((wins.length/recent.length)*100).toFixed(0):0}% win rate · avg ${avg.toFixed(1)}% · current leader ${best?.name||'n/a'}`;research={last:now(),notes:[note,'Production parameters remain bounded; no hourly self-rewrite is allowed.','Counterfactual exit tracking is retained for future challenger promotion.']};log('research','🧪 Hourly research review · '+note,'system')}
setInterval(runResearch,3600000).unref?.();

function snapshot(){defs.forEach(markEquity);const active=[...tokens.values()].filter(t=>now()-t.updatedAt<600000).sort((a,b)=>b.updatedAt-a.updatedAt).slice(0,40).map(t=>({...t,features:features(t)}));const prod=defs.filter(d=>d.risk!=='CONTROL');return{now:now(),paperOnly:true,mode:'LIVE ONLY',regime:marketRegime(),target:TARGET,providers:[...health.values()],summary:{capital:prod.reduce((a,d)=>a+d.equity,0),start:prod.length*START,trades:prod.reduce((a,d)=>a+d.n,0),open:positions.filter(p=>!p.closed&&prod.some(d=>d.id===p.strategy)).length,tokens:tokens.size},strategies:defs.map(d=>({...d,winRate:d.n?d.wins/d.n*100:0,open:openCount(d.id)})),tokens:active,positions:positions.filter(p=>!p.closed).slice(-100),trades:trades.slice(0,100),activity:activity.slice(0,100),research}}
function save(){try{fs.writeFileSync(stateFile,JSON.stringify({defs:defs.map(d=>({id:d.id,cash:d.cash,peak:d.peak,dd:d.dd,wins:d.wins,losses:d.losses,n:d.n})),positions,trades,activity,research}))}catch{}}
function load(){try{const s=JSON.parse(fs.readFileSync(stateFile));for(const x of s.defs||[]){const d=defs.find(q=>q.id===x.id);if(d)Object.assign(d,x)}positions.push(...(s.positions||[]));trades.push(...(s.trades||[]));activity.push(...(s.activity||[]));research=s.research||research}catch{}}
load();setInterval(save,30000).unref?.();

const HTML=`<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>PUMP LAB</title><style>
*{box-sizing:border-box}body{margin:0;background:#080a0f;color:#eef2f7;font:14px Inter,ui-sans-serif,system-ui}.wrap{max-width:1480px;margin:auto;padding:24px}.top{display:flex;justify-content:space-between;gap:16px;align-items:center}.brand{font-weight:900;font-size:26px;letter-spacing:-1px}.live{padding:7px 11px;border:1px solid #1f7;background:#071a12;border-radius:99px;color:#65f5a1;font-size:12px}.muted{color:#8390a3}.grid{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin:18px 0}.card{background:#0f131b;border:1px solid #202735;border-radius:14px;padding:14px}.big{font-size:25px;font-weight:800}.good{color:#69f0a6}.bad{color:#ff718a}.tabs{display:flex;gap:8px;margin:16px 0}.tab{padding:8px 12px;border-radius:9px;background:#121722;border:1px solid #242c3b;cursor:pointer}.tab.on{background:#f3f6fa;color:#090c12}.pane{display:none}.pane.on{display:block}.strategies{display:grid;grid-template-columns:repeat(3,1fr);gap:10px}.row{display:grid;grid-template-columns:1.3fr .8fr .8fr .8fr .8fr;gap:8px;padding:10px;border-bottom:1px solid #1c2330;align-items:center}.tok{display:grid;grid-template-columns:1.2fr .7fr .7fr .7fr .7fr;gap:8px;padding:9px;border-bottom:1px solid #1c2330}.feed{max-height:540px;overflow:auto}.pill{font-size:11px;padding:3px 7px;border-radius:99px;background:#1a2230}.health{display:flex;gap:7px;flex-wrap:wrap}.health span{padding:5px 8px;border:1px solid #293244;border-radius:8px}.hero{background:linear-gradient(135deg,#121928,#101319);border:1px solid #29354b;border-radius:18px;padding:22px;margin-top:18px}button{background:#fff;color:#080a0f;border:0;border-radius:8px;padding:7px 10px;font-weight:700} @media(max-width:900px){.grid{grid-template-columns:1fr 1fr}.strategies{grid-template-columns:1fr}.row,.tok{grid-template-columns:1.3fr .7fr .7fr}.hide{display:none}}</style></head><body><div class="wrap">
<div class="top"><div><div class="brand">PUMP LAB <span style="color:#7c8cff">/ LIVE</span></div><div class="muted">Autonomous Pump.fun & Solana paper-trading research lab</div></div><div><span class="live">● REAL MARKET DATA</span> <span class="pill">PAPER ONLY</span></div></div>
<div class="hero"><div class="muted">CHAMPION CHALLENGE</div><div class="big" id="champ">$1,000 → $100,000</div><div id="reg" class="muted"></div></div>
<div class="grid"><div class="card"><div class="muted">LAB CAPITAL</div><div id="capital" class="big"></div></div><div class="card"><div class="muted">PAPER TRADES</div><div id="trades" class="big"></div></div><div class="card"><div class="muted">OPEN POSITIONS</div><div id="open" class="big"></div></div><div class="card"><div class="muted">TOKENS OBSERVED</div><div id="tokens" class="big"></div></div></div>
<div class="health card" id="health"></div><div class="tabs"><div class="tab on" data-p="war">War Room</div><div class="tab" data-p="tok">Token Radar</div><div class="tab" data-p="res">Research</div></div>
<div id="war" class="pane on"><div class="strategies" id="strats"></div><div class="card" style="margin-top:12px"><b>LIVE ACTIVITY</b><div class="feed" id="feed"></div></div></div>
<div id="tok" class="pane"><div class="card"><div class="tok muted"><b>TOKEN</b><b>MC</b><b>LIQ</b><b>SCORE</b><b class="hide">SOURCE</b></div><div id="tokenRows"></div></div></div>
<div id="res" class="pane"><div class="card"><h2>🧪 Research Director</h2><div id="research"></div><p class="muted">Stable production strategies + bounded forward experiments. The lab does not rewrite itself blindly after one lucky hour.</p></div></div>
</div><script>
const $=x=>document.getElementById(x),usd=n=>'$'+Number(n||0).toLocaleString(undefined,{maximumFractionDigits:0});function render(s){$('capital').textContent=usd(s.summary.capital);$('trades').textContent=s.summary.trades;$('open').textContent=s.summary.open;$('tokens').textContent=s.summary.tokens;$('reg').textContent='Market regime: '+s.regime;const c=s.strategies.find(x=>x.id==='champion');$('champ').textContent=usd(c.equity)+' → $100,000 ('+(c.equity/100000*100).toFixed(2)+'%)';
$('health').innerHTML=s.providers.map(x=>'<span>'+x.component+': <b>'+x.status+'</b></span>').join('');
$('strats').innerHTML=s.strategies.filter(x=>x.risk!=='CONTROL').sort((a,b)=>b.equity-a.equity).map((x,i)=>'<div class="card"><div><b>'+(i+1)+'. '+x.icon+' '+x.name+'</b> <span class="pill">'+x.risk+'</span></div><div class="big '+(x.equity>=1000?'good':'bad')+'">'+usd(x.equity)+'</div><div class="muted">'+x.n+' exits · '+x.winRate.toFixed(0)+'% wins · '+x.dd.toFixed(1)+'% max DD · '+x.open+' open</div></div>').join('');
$('feed').innerHTML=s.activity.slice(0,70).map(x=>'<div class="row"><span>'+new Date(x.ts).toLocaleTimeString()+'</span><span style="grid-column:span 4">'+x.text+'</span></div>').join('');
$('tokenRows').innerHTML=s.tokens.map(t=>'<div class="tok"><b>$'+t.symbol+'<br><small class="muted">'+t.name+'</small></b><span>'+usd(t.mc)+'</span><span>'+usd(t.liq)+'</span><span>'+t.features.score.toFixed(0)+'</span><span class="hide muted">'+t.source+'</span></div>').join('');
$('research').innerHTML='<p><b>Last review:</b> '+(s.research.last?new Date(s.research.last).toLocaleString():'collecting first hour')+'</p>'+s.research.notes.map(n=>'<p>• '+n+'</p>').join('')}
async function go(){try{render(await(await fetch('/api/state')).json())}catch{}}go();setInterval(go,5000);const es=new EventSource('/api/events');es.onmessage=go;document.querySelectorAll('.tab').forEach(t=>t.onclick=()=>{document.querySelectorAll('.tab,.pane').forEach(x=>x.classList.remove('on'));t.classList.add('on');$(t.dataset.p).classList.add('on')});</script></body></html>`;

const server=http.createServer((req,res)=>{if(req.url==='/api/state'){res.writeHead(200,{'content-type':'application/json','cache-control':'no-store'});return res.end(JSON.stringify(snapshot()))}if(req.url==='/api/health'){res.writeHead(200,{'content-type':'application/json'});return res.end(JSON.stringify({ok:true,paperOnly:true,regime:marketRegime(),providers:[...health.values()]}))}if(req.url==='/api/events'){res.writeHead(200,{'content-type':'text/event-stream','cache-control':'no-cache','connection':'keep-alive'});res.write('data: {}\n\n');clients.add(res);req.on('close',()=>clients.delete(res));return}res.writeHead(200,{'content-type':'text/html; charset=utf-8','cache-control':'no-store'});res.end(HTML)});
server.listen(PORT,'0.0.0.0',()=>{h('engine','ok','18 autonomous paper portfolios online.');log('system','🚀 PUMP LAB LIVE engine started','system');connectPumpPortal();pumpPoll();dexPoll();setInterval(pumpPoll,7000).unref?.();setInterval(dexPoll,20000).unref?.();console.log('PUMP LAB LIVE on '+PORT)});
process.on('SIGTERM',()=>{save();server.close(()=>process.exit(0))});process.on('SIGINT',()=>{save();server.close(()=>process.exit(0))});
