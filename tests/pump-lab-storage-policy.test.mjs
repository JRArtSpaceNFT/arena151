import test from 'node:test';import assert from 'node:assert/strict';import {canonicalStorageReady} from '../lib/pump-lab-storage-policy.mjs';
test('fresh recovery peer cannot authorize paper buys while postgres disconnected',()=>assert.equal(canonicalStorageReady({databaseConfigured:true,connected:false,restored:true,lastRestoreAt:Date.now()}),false));
test('connection alone cannot authorize entries before canonical restore',()=>assert.equal(canonicalStorageReady({databaseConfigured:true,connected:true,restored:false,lastRestoreAt:Date.now()}),false));
test('restored connected canonical storage authorizes trading',()=>assert.equal(canonicalStorageReady({databaseConfigured:true,connected:true,restored:true,lastRestoreAt:Date.now()}),true));
test('unconfirmed checkpoint cannot authorize entries',()=>assert.equal(canonicalStorageReady({databaseConfigured:true,connected:true,restored:true}),false));
