// Browser adaptation: same core command protocol, with no remote game server.
const gameWorker = new Worker(new URL('./browser-worker.js?v=1.1.1', import.meta.url), {type:'module'});
const pending = new Map();
const queued = [];
let sequence = 0;
let workerReady = false;
let workerError = null;
// An unavailable worker or blocked IndexedDB must not leave the page spinning forever.
const startupTimeout = setTimeout(() => fatal(Error(
  'League startup timed out. Check that browser-worker.js and the game modules load correctly, and allow IndexedDB/site storage for this page.'
)), 20000);
function fatal(error) {
  if (workerError) return;
  workerError = error instanceof Error ? error : Error(String(error));
  clearTimeout(startupTimeout);
  console.error('Pro Football Dynasty startup failure:', workerError);
  for (const {reject, timeout} of pending.values()) {
    clearTimeout(timeout);
    reject(workerError);
  }
  pending.clear();
  queued.length = 0;
}
gameWorker.addEventListener('message', event => {
  const {id, type, result, error} = event.data || {};
  if (type === 'worker-startup-error') {
    fatal(Error(`Unable to initialize league: ${error || 'unknown worker failure'}`));
    return;
  }
  if (type === 'worker-ready') {
    if (workerError) return;
    workerReady = true;
    clearTimeout(startupTimeout);
    for (const request of queued) gameWorker.postMessage(request);
    queued.length = 0;
    return;
  }
  const item = pending.get(id);
  if (!item) return;
  pending.delete(id);
  clearTimeout(item.timeout);
  error ? item.reject(Error(error)) : item.resolve(result);
});
gameWorker.addEventListener('error', event => fatal(Error(`Game worker could not load: ${event.message || 'unknown error'}`)));
gameWorker.addEventListener('messageerror', () => fatal(Error('Game worker returned an unreadable response')));
function call(type, args = {}) {
  if (workerError) return Promise.reject(workerError);
  return new Promise((resolve, reject) => {
    const id = ++sequence;
    // Keep slow game-day simulations possible, but surface a stalled request.
    const timeout = setTimeout(() => {
      pending.delete(id);
      reject(Error(`The ${type} operation timed out. Check the browser console for errors.`));
    }, type === 'advance' ? 120000 : 45000);
    pending.set(id, {resolve, reject, timeout});
    const request = {id, type, args};
    if (workerReady) gameWorker.postMessage(request);
    else queued.push(request);
  });
}
function jsonResponse(data,status = 200) {
  return new Response(JSON.stringify(data), {status, headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store'}});
}
export async function gameFetch(input, init = {}) {
  const url = new URL(input instanceof Request ? input.url : String(input), location.href);
  // Other requests, if introduced later, follow ordinary browser fetch semantics.
  if (url.origin !== location.origin || !url.pathname.startsWith('/api/')) return window.fetch(input, init);
  try {
    const route=url.pathname;
    if (route === '/api/slots') return jsonResponse(await call('slotsList'));
    if (route === '/api/league-template' || route === '/api/export') {
      const file = route === '/api/export' ? 'pro-football-dynasty-career.json' : 'pfd-league-template.json';
      const value = await call(route === '/api/export' ? 'exportSave' : 'exportLeagueTemplate');
      return new Response(value, {status:200,headers:{'content-type':'application/json; charset=utf-8','content-disposition':`attachment; filename="${file}"`}});
    }
    if (route === '/api/state') return jsonResponse(await call('state',{teamId:url.searchParams.get('team')||'T01'}));
    if (route === '/api/game') return jsonResponse(await call('gameDetail',{gameId:url.searchParams.get('id')}));
    if (route === '/api/trade-target') return jsonResponse(await call('tradeTarget',{teamId:url.searchParams.get('id')}));
    if (route === '/api/rules') return jsonResponse(await call('rules'));
    if (route === '/api/directory') return jsonResponse(await call('directory'));
    if (route === '/api/player') return jsonResponse(await call('playerProfile',{playerId:url.searchParams.get('id')}));
    if (route === '/api/action') {
      if ((init.method||'GET').toUpperCase() !== 'POST') return jsonResponse({error:'POST required'},405);
      const body=JSON.parse(init.body||'{}');
      return jsonResponse(await call(body.type,body.args||{}));
    }
    return jsonResponse({error:'Unknown endpoint'},404);
  } catch(error) {
    return jsonResponse({error:error.message || 'Unknown error'},400);
  }
}
// Ordinary anchor navigation cannot access virtual API endpoints, so provide file downloads.
document.addEventListener('click', async event => {
  const a = event.target.closest('a[href="/api/export"], a[href="/api/league-template"]');
  if(!a) return;
  event.preventDefault();
  try {
    const response = await gameFetch(a.getAttribute('href'));
    if(!response.ok) throw Error((await response.json()).error);
    const filename = a.getAttribute('href').endsWith('/export') ? 'pro-football-dynasty-career.json' : 'pfd-league-template.json';
    const href=URL.createObjectURL(await response.blob());
    const link=document.createElement('a');link.href=href;link.download=filename;document.body.append(link);link.click();link.remove();
    setTimeout(()=>URL.revokeObjectURL(href),2000);
  } catch(error) {
    alert('Export failed: ' + error.message);
  }
}, true);
