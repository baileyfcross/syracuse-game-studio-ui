// Run with: node tests/browser-worker-startup.mjs
// A delayed IndexedDB open simulates startup, so an early state message must
// still receive a reply instead of disappearing before listener registration.
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import { join } from 'node:path';
const messages = [];
const listeners = new Map();
globalThis.self = {
  addEventListener(type, callback) { listeners.set(type, callback); },
  postMessage(value) { messages.push(value); }
};
const db = {
  createObjectStore() {},
  transaction() {
    return {objectStore() {return {get() {
      const req = {};
      setTimeout(() => {req.result = undefined; req.onsuccess?.();}, 20);
      return req;
    }};}};
  }
};
globalThis.indexedDB = {open() {
  const req = {};
  setTimeout(() => {
    req.result = db;
    req.onupgradeneeded?.();
    req.onsuccess?.();
  }, 300);
  return req;
}};
const worker = join(process.cwd(), 'public/ProFootballDynasty/browser-worker.js');
await import(pathToFileURL(worker));
assert.equal(typeof listeners.get('message'), 'function', 'The handler must be registered before storage completes');
listeners.get('message')({data: {id: 1,type: 'state',args: {teamId: 'T01'}}});
const until = Date.now() + 7000;
while (!messages.some(m => m.id === 1) && Date.now() < until) await new Promise(r => setTimeout(r, 25));
assert.ok(messages.some(m => m.type === 'worker-ready'), 'Ready signal missing');
const reply = messages.find(m => m.id === 1);
assert.ok(reply, 'Initial request was lost');
assert.equal(reply.error, undefined, 'Initial request failed');
assert.equal(reply.result.teams.length, 32);
assert.equal(reply.result.phase,'regular');
console.log('PASS: Early state request survives delayed IndexedDB initialization');
