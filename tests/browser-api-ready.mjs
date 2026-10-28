import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import { join } from 'node:path';
let worker;
class MockWorker {
  listeners = new Map();
  requests = [];
  constructor() {worker = this;}
  addEventListener(kind, listener) {this.listeners.set(kind, listener);}
  postMessage(request) {
    this.requests.push(request);
    queueMicrotask(() => this.emit({id: request.id, result: {season: 2026, phase: 'regular'}}));
  }
  emit(data) {this.listeners.get('message')?.({data});}
}
globalThis.Worker = MockWorker;
globalThis.document = {addEventListener() {}};
globalThis.location = {href:'https://example.org/ProFootballDynasty/index.html', origin:'https://example.org'};
const {gameFetch} = await import(pathToFileURL(join(process.cwd(),'public/ProFootballDynasty/browser-api.js')));
const result = gameFetch('/api/state?team=T01');
assert.equal(worker.requests.length, 0, 'Must wait for ready before posting');
worker.emit({type: 'worker-ready'});
const response = await result;
assert.equal(response.status, 200);
assert.equal((await response.json()).season, 2026);
assert.equal(worker.requests.length, 1);
console.log('PASS: Browser API waits for the ready signal, then resolves the initial request');
