import http from 'node:http';
import https from 'node:https';
import fs from 'node:fs';

const PORT = Number(process.env.PORT || 10000);
const BACKEND_ORIGIN = process.env.BACKEND_ORIGIN || 'https://pump-lab-live.onrender.com';
const X_BEARER_TOKEN = process.env.X_BEARER_TOKEN || '';
const X_FEED_HANDLES = (process.env.X_FEED_HANDLES || '').split(',').map(x=>x.trim().replace(/^@/,'')).filter(Boolean);
const X_REFRESH_MS = Math.max(30000, Number(process.env.X_REFRESH_MS || 45000));
const X_MAX_CACHE = Math.max(20, Math.min(200, Number(process.env.X_MAX_CACHE || 100)));
let xFeedCache = [];
let xFeedLastFetch = 0;
let xFeedSinceId = null;
let xFeedInFlight = null;
const source = fs.readFileSync(new URL('./server.mjs', import.meta.url), 'utf8');
const start = source.indexOf('const HTML=`');
const end = source.indexOf('</html>`', start);
if (start < 0 || end < 0) throw new Error('Unable to extract Pump Lab HTML from server.mjs');
const HTML = source.slice(start + 'const HTML=`'.length, end + '</html>'.length);

const EXPECTATIONS = {
  uniqueTraderArt: HTML.includes('TRADER_ART_PROFILES'),
  oldFiveArtRendererGone: !HTML.includes("agentVisual v'+(i%5)"),
  oracleMorph: HTML.includes('@keyframes orbMorph'),
  oracleMotion: HTML.includes('@keyframes orbMotion'),
  oracleHintGone: !HTML.includes('Click the object · ask anything'),
  botClickPromptGone: !HTML.includes('Click for full bot profile'),
  xSignalFeed: HTML.includes('id="xfeed"') && HTML.includes('loadXFeed')
};
if (!Object.values(EXPECTATIONS).every(Boolean)) {
  throw new Error('Frontend safety check failed: ' + JSON.stringify(EXPECTATIONS));
}


function xJson(res,status,payload){
  const body=JSON.stringify(payload);
  res.writeHead(status,{'content-type':'application/json','cache-control':'no-store','content-length':Buffer.byteLength(body),'x-pump-lab-ui':'future-lab'});
  res.end(body);
}
function xHandleChunks(handles){
  const chunks=[];let cur=[],len=0;
  for(const h of handles){
    const piece='from:'+h;
    if(cur.length && len+piece.length+4>430){chunks.push(cur);cur=[];len=0;}
    cur.push(h);len+=piece.length+4;
  }
  if(cur.length)chunks.push(cur);
  return chunks;
}
function xNormalizeResponse(j){
  const users=new Map((j.includes?.users||[]).map(u=>[u.id,u]));
  const media=new Map((j.includes?.media||[]).map(m=>[m.media_key,m]));
  return (j.data||[]).map(t=>{
    const u=users.get(t.author_id)||{};
    const ms=(t.attachments?.media_keys||[]).map(k=>media.get(k)).filter(Boolean).map(m=>({
      type:m.type,url:m.url||m.preview_image_url||null,width:m.width||null,height:m.height||null
    }));
    return {
      id:t.id,text:t.text||'',createdAt:t.created_at||null,conversationId:t.conversation_id||null,
      metrics:t.public_metrics||{},author:{id:u.id||t.author_id,name:u.name||'',username:u.username||'',verified:!!u.verified,profileImage:u.profile_image_url||''},
      media:ms,url:u.username?'https://x.com/'+u.username+'/status/'+t.id:'https://x.com/i/web/status/'+t.id
    };
  });
}
async function fetchXChunk(handles,sinceId){
  const q='('+handles.map(h=>'from:'+h).join(' OR ')+') -is:retweet';
  const u=new URL('https://api.x.com/2/tweets/search/recent');
  u.searchParams.set('query',q);
  u.searchParams.set('max_results','50');
  u.searchParams.set('tweet.fields','created_at,public_metrics,attachments,entities,conversation_id,referenced_tweets');
  u.searchParams.set('expansions','author_id,attachments.media_keys');
  u.searchParams.set('user.fields','name,username,profile_image_url,verified');
  u.searchParams.set('media.fields','type,url,preview_image_url,width,height');
  if(sinceId)u.searchParams.set('since_id',sinceId);
  const r=await fetch(u,{headers:{authorization:'Bearer '+X_BEARER_TOKEN,accept:'application/json'}});
  const j=await r.json().catch(()=>({}));
  if(!r.ok)throw new Error('X API '+r.status+': '+(j.detail||j.title||j.error||'request failed'));
  return {posts:xNormalizeResponse(j),newestId:j.meta?.newest_id||null};
}
async function refreshXFeed(force=false){
  const configured=!!X_BEARER_TOKEN&&X_FEED_HANDLES.length>0;
  if(!configured)return{ok:true,configured:false,handles:X_FEED_HANDLES,posts:[],fetchedAt:xFeedLastFetch||null};
  const now=Date.now();
  if(!force&&xFeedCache.length&&now-xFeedLastFetch<X_REFRESH_MS)return{ok:true,configured:true,handles:X_FEED_HANDLES,posts:xFeedCache,fetchedAt:xFeedLastFetch,cached:true};
  if(xFeedInFlight)return xFeedInFlight;
  xFeedInFlight=(async()=>{
    const chunks=xHandleChunks(X_FEED_HANDLES),fresh=[];let newest=xFeedSinceId;
    for(const chunk of chunks){
      const out=await fetchXChunk(chunk,xFeedSinceId);
      fresh.push(...out.posts);
      if(out.newestId&&(!newest||BigInt(out.newestId)>BigInt(newest)))newest=out.newestId;
    }
    const merged=new Map(xFeedCache.map(p=>[p.id,p]));
    for(const p of fresh)merged.set(p.id,p);
    xFeedCache=[...merged.values()].sort((a,b)=>String(b.id).localeCompare(String(a.id),undefined,{numeric:true})).slice(0,X_MAX_CACHE);
    xFeedLastFetch=Date.now();if(newest)xFeedSinceId=newest;
    return{ok:true,configured:true,handles:X_FEED_HANDLES,posts:xFeedCache,fetchedAt:xFeedLastFetch,cached:false,newCount:fresh.length};
  })();
  try{return await xFeedInFlight}finally{xFeedInFlight=null}
}
function proxy(req, res) {
  const target = new URL(req.url, BACKEND_ORIGIN);
  const lib = target.protocol === 'https:' ? https : http;
  const upstream = lib.request(target, {
    method: req.method,
    headers: {
      accept: req.headers.accept || '*/*',
      'user-agent': 'pump-lab-ui-proxy/1.0',
      'cache-control': 'no-cache'
    }
  }, up => {
    const headers = {...up.headers};
    headers['cache-control'] = 'no-store';
    headers['x-pump-lab-ui'] = 'future-lab';
    res.writeHead(up.statusCode || 502, headers);
    up.pipe(res);
  });
  upstream.on('error', err => {
    if (!res.headersSent) res.writeHead(502, {'content-type':'application/json','cache-control':'no-store'});
    res.end(JSON.stringify({ok:false,error:'Pump Lab backend unavailable',detail:err.message}));
  });
  req.pipe(upstream);
}

const server = http.createServer(async (req,res) => {
  const u = new URL(req.url, 'http://pump-lab-ui.local');
  if (u.pathname === '/api/x-feed') {
    try{return xJson(res,200,await refreshXFeed(u.searchParams.get('refresh')==='1'))}
    catch(err){return xJson(res,502,{ok:false,configured:true,handles:X_FEED_HANDLES,posts:xFeedCache,fetchedAt:xFeedLastFetch||null,error:String(err?.message||err)})}
  }
  if (u.pathname === '/ui-health') {
    const body = JSON.stringify({ok:true,frontend:'future-lab',backend:BACKEND_ORIGIN,expectations:EXPECTATIONS});
    res.writeHead(200, {'content-type':'application/json','cache-control':'no-store','content-length':Buffer.byteLength(body)});
    return res.end(body);
  }
  if (u.pathname.startsWith('/api/')) return proxy(req,res);
  res.writeHead(200, {
    'content-type':'text/html; charset=utf-8',
    'cache-control':'no-store, no-cache, must-revalidate',
    'pragma':'no-cache',
    'expires':'0',
    'x-pump-lab-ui':'future-lab'
  });
  res.end(HTML);
});

server.listen(PORT,'0.0.0.0',()=>{
  console.log('PUMP LAB UI proxy live on '+PORT+' -> '+BACKEND_ORIGIN);
  console.log('UI_SELFTEST '+JSON.stringify(EXPECTATIONS));
});
