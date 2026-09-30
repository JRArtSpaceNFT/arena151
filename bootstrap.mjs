import fs from 'node:fs';
import zlib from 'node:zlib';
import path from 'node:path';
const parts=['00','01','02','03','04'].map(n=>fs.readFileSync(new URL('./runtime/chunk'+n+'.b64',import.meta.url),'utf8').trim()).join('');
const source=zlib.gunzipSync(Buffer.from(parts,'base64')).toString('utf8');
const target='/tmp/pump-lab-v05.mjs';
fs.writeFileSync(target,source);
await import('file://'+target+'?v='+Date.now());
