import test from 'node:test';
import assert from 'node:assert/strict';
import {MIB, memoryReport, rejectSlowStream, reuseSnapshotUnderPressure}
  from '../lib/pump-lab-runtime-guard.mjs';

test('memory pressure thresholds correspond to Render 512 MiB container',()=>{
 assert.equal(memoryReport({rss:200*MIB,heapUsed:120*MIB}).pressure,'NORMAL');
 assert.equal(memoryReport({rss:370*MIB}).pressure,'ELEVATED');
 assert.equal(memoryReport({rss:440*MIB}).pressure,'HIGH');
 assert.equal(memoryReport({rss:480*MIB}).pressure,'CRITICAL');
 assert.equal(memoryReport({rss:440*MIB}).rssMiB,440);
});
test('slow or disconnected SSE consumers are evicted',()=>{
 assert.equal(rejectSlowStream({writableLength:0}),false);
 assert.equal(rejectSlowStream({writableLength:600_000}),true);
 assert.equal(rejectSlowStream({destroyed:true,writableLength:0}),true);
 assert.equal(rejectSlowStream({writableEnded:true,writableLength:0}),true);
});
test('dashboard snapshot is reused longer under pressure but not forever',()=>{
 assert.equal(reuseSnapshotUnderPressure({ageMs:40_000,hasSnapshot:true,pressure:'NORMAL'}),false);
 assert.equal(reuseSnapshotUnderPressure({ageMs:40_000,hasSnapshot:true,pressure:'HIGH'}),true);
 assert.equal(reuseSnapshotUnderPressure({ageMs:180_000,hasSnapshot:true,pressure:'CRITICAL'}),true);
 assert.equal(reuseSnapshotUnderPressure({ageMs:600_000,hasSnapshot:true,pressure:'CRITICAL'}),false);
 assert.equal(reuseSnapshotUnderPressure({ageMs:0,hasSnapshot:false,pressure:'CRITICAL'}),false);
});
