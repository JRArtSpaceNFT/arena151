import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {createServer} from 'node:net';
import {mkdtempSync, rmSync} from 'node:fs';
import os from 'node:os';
import path from 'node:path';

async function port(){
 return new Promise((resolve,reject)=>{
  const x=createServer();x.on('error',reject);
  x.listen(0,'127.0.0.1',()=>{const n=x.address().port;x.close(()=>resolve(n))});
 });
}
test('read-only pinned recovery boots when DB, Key Value and peers are down', {timeout:55000}, async()=>{
 const p=await port(),folder=mkdtempSync(path.join(os.tmpdir(),'pump-lab-rescue-'));
 let stderr='';
 const child=spawn(process.execPath,['server.mjs'],{
  cwd:process.cwd(),stdio:['ignore','ignore','pipe'],
  env:{...process.env,PORT:String(p),DATABASE_URL:'postgresql://bad:bad@127.0.0.1:2/bad',
   REDIS_URL:'',PEER_RECOVERY_URLS:'disabled',STATE_FILE:path.join(folder,'saved.json'),
   PUMPPORTAL_API_KEY:'',ALLOW_METERED_PUMPPORTAL:'false',ALLOW_SEASON_MIGRATION:'true',
   SOLANA_RPC_HTTP:'http://127.0.0.1:2',SOLANA_RPC_WSS:'ws://127.0.0.1:2',
   NODE_OPTIONS:'--max-old-space-size=300'}});
 child.stderr.on('data',b=>{stderr+=String(b).slice(0,1200);if(stderr.length>5000)stderr=stderr.slice(-5000)});
 try{
  let health=null,error='';
  for(let i=0;i<100;i++){
   if(child.exitCode!==null)throw Error('Engine unexpectedly exited: '+stderr);
   try{
    const ctrl=new AbortController(),timer=setTimeout(()=>ctrl.abort(),900);
    const res=await fetch('http://127.0.0.1:'+p+'/api/health',{signal:ctrl.signal});
    clearTimeout(timer);
    if(res.ok){health=await res.json();break}
   }catch(e){error=e.message}
   await new Promise(r=>setTimeout(r,170));
  }
  assert.ok(health,'Health endpoint failed to boot: '+error+' '+stderr);
  assert.equal(health.paperOnly,true);
  assert.equal(health.storage?.pinnedOffsite?.restored,true);
  assert.equal(health.storage?.pinnedOffsite?.paperEntryLocked,true);
  assert.equal(health.storage?.detailLedger?.missing,0,'Clean Five Brain era must not inherit legacy ledger gaps');
  assert.equal(health.storage?.detailLedger?.canonicalWriteLocked,false);
  assert.equal(health.storage?.tradingUnlocked,false);
  assert.equal(health.runtime?.dbConnected,false);
  const res=await fetch('http://127.0.0.1:'+p+'/api/state');
  assert.equal(res.status,200);
  const s=await res.json();
  assert.equal(s?.summary?.ledgerTrades||0,0,'Active Five Brain ledger must start clean; legacy history lives only in the immutable archive');
    assert.equal(s?.strategies?.length,5,'Five Brain migration must expose exactly five active bots');
  for(const d of s.strategies){
    assert.equal(d.cash,1000,'Each Five Brain bot must reset cash to $1,000');
    assert.equal(d.n,0,'Each Five Brain bot must reset completed-trade count');
  }
 }finally{child.kill('SIGKILL');rmSync(folder,{recursive:true,force:true})}
});