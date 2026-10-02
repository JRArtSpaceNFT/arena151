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
let xPublicFailures = new Map();
let stateCache=null;
let stateCacheAt=0;
let stateRefreshInFlight=null;
let backendWakeFailures=0;
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
function xPublicNormalizeTweet(t,fallbackHandle=''){
  if(!t)return null;
  const u=t.user||{},id=String(t.id_str||t.id||'').trim(),username=u.screen_name||fallbackHandle;
  if(!id)return null;
  const media=(t.mediaDetails||t.photos||[]).map(m=>({
    type:m.type||'photo',
    url:m.media_url_https||m.url||m.preview_image_url||null,
    width:m.original_info?.width||m.width||null,
    height:m.original_info?.height||m.height||null
  })).filter(m=>m.url);
  return{
    id,
    text:t.full_text||t.text||'',
    createdAt:t.created_at||null,
    conversationId:t.conversation_id_str||null,
    metrics:{like_count:Number(t.favorite_count||0),retweet_count:Number(t.retweet_count||0),reply_count:Number(t.reply_count||0),quote_count:Number(t.quote_count||0)},
    author:{id:String(u.id_str||u.id||''),name:u.name||username,username,verified:!!(u.verified||u.is_blue_verified),profileImage:u.profile_image_url_https||u.profile_image_url||''},
    media,
    url:t.permalink?('https://x.com'+t.permalink.replace(/^https?:\/\/[^/]+/,'')):'https://x.com/'+username+'/status/'+id
  };
}
async function fetchPublicTimeline(handle){
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),9000);
  try{
    const r=await fetch('https://syndication.twitter.com/srv/timeline-profile/screen-name/'+encodeURIComponent(handle),{
      headers:{'user-agent':'Mozilla/5.0 (compatible; PumpLab/1.0)','accept':'text/html,application/xhtml+xml'},
      signal:controller.signal
    });
    if(!r.ok)throw new Error('X public timeline '+r.status);
    const html=await r.text(),marker='<script id="__NEXT_DATA__" type="application/json">';
    const start=html.indexOf(marker);if(start<0)throw new Error('X public timeline payload missing');
    const end=html.indexOf('</script>',start);if(end<0)throw new Error('X public timeline payload incomplete');
    const data=JSON.parse(html.slice(start+marker.length,end)),entries=data?.props?.pageProps?.timeline?.entries||[];
    return entries.map(e=>xPublicNormalizeTweet(e?.content?.tweet,handle)).filter(Boolean).slice(0,8);
  }finally{clearTimeout(timer)}
}
function xFxNormalizeStatus(t,fallbackHandle=''){
  if(!t||t.type!=='status')return null;const a=t.author||{},username=a.screen_name||fallbackHandle,id=String(t.id||'').trim();if(!id)return null;
  const photos=(t.media?.photos||[]).map(m=>({type:m.type||'photo',url:m.url||null,width:m.width||null,height:m.height||null})),videos=(t.media?.videos||[]).map(m=>({type:m.type||'video',url:m.thumbnail_url||null,width:m.width||null,height:m.height||null}));
  return{id,text:t.text||'',createdAt:t.created_at||null,conversationId:null,metrics:{like_count:Number(t.likes||0),retweet_count:Number(t.reposts||0),reply_count:Number(t.replies||0),quote_count:Number(t.quotes||0)},author:{id:String(a.id||''),name:a.name||username,username,verified:!!a.verification?.verified,profileImage:a.avatar_url||''},media:[...photos,...videos].filter(m=>m.url),url:t.url||('https://x.com/'+username+'/status/'+id)};
}
async function fetchFxTimeline(handle){
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),9000);
  try{
    const u='https://api.fxtwitter.com/2/profile/'+encodeURIComponent(handle)+'/statuses?count=8';
    const r=await fetch(u,{headers:{accept:'application/json','user-agent':'PumpLab/1.0'},signal:controller.signal});
    const j=await r.json().catch(()=>({}));
    if(!r.ok||Number(j.code||r.status)>=400)throw new Error('FxTwitter timeline '+(j.code||r.status)+' '+(j.message||''));
    return (j.results||[]).map(t=>xFxNormalizeStatus(t,handle)).filter(Boolean).slice(0,8);
  }finally{clearTimeout(timer)}
}

async function refreshPublicXFeed(force=false){
  const configured=X_FEED_HANDLES.length>0,now=Date.now();
  if(!configured)return{ok:true,configured:false,source:'none',handles:[],posts:[],fetchedAt:xFeedLastFetch||null};
  if(!force&&xFeedCache.length&&now-xFeedLastFetch<Math.max(X_REFRESH_MS,120000))return{ok:true,configured:true,source:'cached-public-feed',handles:X_FEED_HANDLES,posts:xFeedCache,fetchedAt:xFeedLastFetch,cached:true};
  if(xFeedInFlight)return xFeedInFlight;
  xFeedInFlight=(async()=>{
    const fresh=[],errors=[],sources=new Set();
    for(let i=0;i<X_FEED_HANDLES.length;i++){
      const h=X_FEED_HANDLES[i],blockedUntil=xPublicFailures.get(h)||0;
      if(blockedUntil>Date.now())continue;
      try{
        let rows=[],primaryError=null;
        try{rows=await fetchPublicTimeline(h)}catch(e){primaryError=e}
        if(!rows.length){
          try{rows=await fetchFxTimeline(h);if(rows.length)sources.add('fxtwitter-public-api')}
          catch(fxErr){throw new Error((primaryError?String(primaryError?.message||primaryError)+' · ':'')+String(fxErr?.message||fxErr))}
        }else sources.add('x-public-syndication');
        fresh.push(...rows);xPublicFailures.delete(h);
      }catch(e){errors.push('@'+h+': '+String(e?.message||e));xPublicFailures.set(h,Date.now()+180000)}
      if(i<X_FEED_HANDLES.length-1)await new Promise(r=>setTimeout(r,250));
    }
    const merged=new Map(xFeedCache.map(p=>[p.id,p]));for(const p of fresh)merged.set(p.id,p);
    xFeedCache=[...merged.values()].sort((a,b)=>new Date(b.createdAt||0)-new Date(a.createdAt||0)).slice(0,X_MAX_CACHE);
    if(fresh.length)xFeedLastFetch=Date.now();
    return{ok:xFeedCache.length>0,configured:true,source:sources.has('fxtwitter-public-api')?'fxtwitter-public-api':'x-public-syndication',sources:[...sources],handles:X_FEED_HANDLES,posts:xFeedCache,fetchedAt:xFeedLastFetch||null,cached:false,newCount:fresh.length,errors};
  })();
  try{return await xFeedInFlight}finally{xFeedInFlight=null}
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
  if(!X_BEARER_TOKEN)return refreshPublicXFeed(force);
  const configured=X_FEED_HANDLES.length>0;
  if(!configured)return{ok:true,configured:false,source:'none',handles:[],posts:[],fetchedAt:xFeedLastFetch||null};
  const now=Date.now();
  if(!force&&xFeedCache.length&&now-xFeedLastFetch<X_REFRESH_MS)return{ok:true,configured:true,source:'x-api',handles:X_FEED_HANDLES,posts:xFeedCache,fetchedAt:xFeedLastFetch,cached:true};
  if(xFeedInFlight)return xFeedInFlight;
  xFeedInFlight=(async()=>{
    const chunks=xHandleChunks(X_FEED_HANDLES),fresh=[];let newest=xFeedSinceId;
    for(const chunk of chunks){
      const out=await fetchXChunk(chunk,xFeedSinceId);fresh.push(...out.posts);
      if(out.newestId&&(!newest||BigInt(out.newestId)>BigInt(newest)))newest=out.newestId;
    }
    const merged=new Map(xFeedCache.map(p=>[p.id,p]));for(const p of fresh)merged.set(p.id,p);
    xFeedCache=[...merged.values()].sort((a,b)=>String(b.id).localeCompare(String(a.id),undefined,{numeric:true})).slice(0,X_MAX_CACHE);
    xFeedLastFetch=Date.now();if(newest)xFeedSinceId=newest;
    return{ok:true,configured:true,source:'x-api',handles:X_FEED_HANDLES,posts:xFeedCache,fetchedAt:xFeedLastFetch,cached:false,newCount:fresh.length};
  })();
  try{return await xFeedInFlight}finally{xFeedInFlight=null}
}
async function fetchBackendJson(pathname,timeoutMs=45000){
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),timeoutMs);
  try{
    const r=await fetch(new URL(pathname,BACKEND_ORIGIN),{headers:{accept:'application/json','user-agent':'pump-lab-ui-state-cache/1.0','cache-control':'no-cache'},cache:'no-store',signal:controller.signal});
    if(!r.ok)throw new Error(pathname+' HTTP '+r.status);
    return await r.json();
  }finally{clearTimeout(timer)}
}
async function refreshStateCache(force=false){
  if(!force&&stateCache&&Date.now()-stateCacheAt<12000)return stateCache;
  if(stateRefreshInFlight)return stateRefreshInFlight;
  stateRefreshInFlight=(async()=>{
    let lastErr=null;
    const delays=[0,2500,5000,7500,10000,10000,10000,10000];
    for(let i=0;i<delays.length;i++){
      const attempt=i+1;if(delays[i])await new Promise(r=>setTimeout(r,delays[i]));
      try{
        const state=await fetchBackendJson('/api/state',20000);
        stateCache=state;stateCacheAt=Date.now();backendWakeFailures=0;
        console.log('STATE_CACHE_REFRESH '+JSON.stringify({ok:true,attempt,version:state?.version||null,trades:state?.summary?.trades||0,tokens:state?.summary?.tokens||0,bytes:Buffer.byteLength(JSON.stringify(state))}));
        return state;
      }catch(e){
        lastErr=e;backendWakeFailures++;console.warn('STATE_CACHE_REFRESH_FAILED '+JSON.stringify({attempt,error:String(e?.message||e),coldStartWindow:true}));
      }
    }
    throw lastErr||new Error('backend state unavailable after cold-start window');
  })();
  try{return await stateRefreshInFlight}finally{stateRefreshInFlight=null}
}
function serveState(res,state,{stale=false,warming=false}={}){
  const body=JSON.stringify(state);
  res.writeHead(200,{'content-type':'application/json','cache-control':'no-store','content-length':Buffer.byteLength(body),'x-pump-state-cache':stale?'stale':'fresh','x-pump-state-age-ms':String(stateCacheAt?Date.now()-stateCacheAt:0),'x-pump-backend-warming':warming?'1':'0'});
  res.end(body);
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
  if (u.pathname === '/api/state') {
    const age=stateCacheAt?Date.now()-stateCacheAt:Infinity;
    if(stateCache&&age<30000)return serveState(res,stateCache,{stale:false});
    if(stateCache){refreshStateCache(true).catch(()=>{});return serveState(res,stateCache,{stale:true,warming:true});}
    try{return serveState(res,await refreshStateCache(true),{stale:false})}
    catch(err){return xJson(res,503,{ok:false,warming:true,error:'Pump Lab engine is waking',detail:String(err?.message||err),retryAfterMs:5000})}
  }
  if (u.pathname === '/api/x-feed') {
    try{return xJson(res,200,await refreshXFeed(u.searchParams.get('refresh')==='1'))}
    catch(err){return xJson(res,502,{ok:xFeedCache.length>0,configured:X_FEED_HANDLES.length>0,source:X_BEARER_TOKEN?'x-api':'public-fallback',handles:X_FEED_HANDLES,posts:xFeedCache,fetchedAt:xFeedLastFetch||null,error:String(err?.message||err)})}
  }
  if (u.pathname === '/ui-health') {
    const body = JSON.stringify({ok:true,frontend:'future-lab',backend:BACKEND_ORIGIN,expectations:EXPECTATIONS,stateCache:{ready:!!stateCache,ageMs:stateCacheAt?Date.now()-stateCacheAt:null,lastRefresh:stateCacheAt||null,wakeFailures:backendWakeFailures}});
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
  refreshXFeed(false).then(x=>console.log('X_FEED_WARMUP '+JSON.stringify({ok:x.ok,configured:x.configured,source:x.source,sources:x.sources||[],handles:x.handles,posts:x.posts?.length||0,authors:[...new Set((x.posts||[]).map(p=>p.author?.username).filter(Boolean))],errors:x.errors||[]}))).catch(e=>console.warn('X_FEED_WARMUP_FAILED '+String(e?.message||e)));
  refreshStateCache(true).then(s=>console.log('BACKEND_WARMUP '+JSON.stringify({ok:true,version:s?.version||null,trades:s?.summary?.trades||0,tokens:s?.summary?.tokens||0}))).catch(e=>console.warn('BACKEND_WARMUP_FAILED '+String(e?.message||e)));
  setInterval(()=>refreshStateCache(true).catch(()=>{}),60000).unref?.();
});
