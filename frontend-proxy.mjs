import http from 'node:http';
import https from 'node:https';
import fs from 'node:fs';

const PORT = Number(process.env.PORT || 10000);
const BACKEND_ORIGIN = process.env.BACKEND_ORIGIN || 'https://pump-lab-live.onrender.com';
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
  botClickPromptGone: !HTML.includes('Click for full bot profile')
};
if (!Object.values(EXPECTATIONS).every(Boolean)) {
  throw new Error('Frontend safety check failed: ' + JSON.stringify(EXPECTATIONS));
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

const server = http.createServer((req,res) => {
  const u = new URL(req.url, 'http://pump-lab-ui.local');
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
