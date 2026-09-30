import fs from 'node:fs';
import zlib from 'node:zlib';
const parts=['00','01','02','03','04'].map(n=>fs.readFileSync(new URL('./runtime/chunk'+n+'.b64',import.meta.url),'utf8').trim()).join('');
let source=zlib.gunzipSync(Buffer.from(parts,'base64')).toString('utf8');

// Browser hotfix: avoid quote escaping inside the generated Token Lab onclick handler.
source=source.split('\n').map(line=>line.includes("$('tokenRows').innerHTML=s.tokens.map")
  ? `$('tokenRows').innerHTML=s.tokens.map(t=>'<tr class="token" data-mint="'+esc(t.mint)+'" onclick="openToken(this.dataset.mint)"><td><b>$'+esc(t.symbol)+'</b><br><span class="muted">'+esc(t.name)+'</span></td><td>'+money(t.mc)+'</td><td>'+money(t.liq)+'</td><td>'+one(t.features.score)+'</td><td class="'+(t.detective.score>65?'red':t.detective.score>45?'amber':'green')+'">'+one(t.detective.score)+'</td><td>'+t.consensus.yes+'/'+t.consensus.total+'</td><td class="muted">'+esc((t.sources||[]).join(' + '))+'</td></tr>').join('');`
  : line
).join('\n');

// Never silently swallow a future browser render failure.
source=source.replace(
  "async function go(){try{render(await(await fetch('/api/state',{cache:'no-store'})).json())}catch(e){}}",
  "async function go(){try{render(await(await fetch('/api/state',{cache:'no-store'})).json())}catch(e){console.error('PUMP LAB render error',e);const h=document.getElementById('health');if(h)h.innerHTML='<span class=\\\"bad\\\">CLIENT ERROR · refresh or check system health</span>';}}"
);

const target='/tmp/pump-lab-v05.mjs';
fs.writeFileSync(target,source);
await import('file://'+target+'?v='+Date.now());
