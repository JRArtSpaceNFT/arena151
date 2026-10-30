// Isolated research health endpoint. No trading, credentials or database access.
import http from 'node:http';
import { execFileSync } from 'node:child_process';
import { V2_INTEGRITY_VERSION } from '../lib/pump-lab-v2-integrity.mjs';
let testsPassed = false;
let failure = null;
try { execFileSync(process.execPath, ['scripts/pump-lab-v2-integrity-check.mjs'], { stdio: 'pipe', timeout: 15000 }); testsPassed = true; }
catch(e) { failure = String(e?.stderr || e?.message || e).slice(0, 500); }
const port = Number(process.env.PORT || 10000);
http.createServer((req,res) => {
  const path = new URL(req.url, 'http://localhost').pathname;
  if (path !== '/health' && path !== '/') { res.writeHead(404); return res.end(); }
  res.writeHead(testsPassed ? 200 : 503, {'content-type':'application/json','cache-control':'no-store'});
  res.end(JSON.stringify({service:'pump-lab-v2-integrity',version:V2_INTEGRITY_VERSION,status:testsPassed?'checks_passed':'checks_failed',paperTrading:false,liveTrading:false,integratedWithLegacyEngine:false,testsPassed,...(failure?{failure}:{})}));
}).listen(port,'0.0.0.0',()=>console.log('V2 integrity research service listening',port, testsPassed));
