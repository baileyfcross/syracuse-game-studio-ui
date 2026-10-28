// This is a local-browser replacement for Node file persistence. No career is uploaded.
const DB_NAME = 'syracusegamestudio-pro-football-dynasty';
const STORE = 'files';
let pendingDb;
function database() {
  if (!pendingDb) pendingDb = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => { req.result.createObjectStore(STORE); };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error || Error('Unable to open browser save storage'));
    req.onblocked = () => reject(Error('Browser save storage is blocked by another tab'));
  });
  return pendingDb;
}
function notFound(file) {
  const error = new Error(`Save file not found: ${file}`);
  error.code = 'ENOENT'; return error;
}
async function read(key) {
  const db = await database();
  return new Promise((resolve, reject) => {
    const req = db.transaction(STORE, 'readonly').objectStore(STORE).get(key);
    req.onsuccess = () => req.result === undefined ? reject(notFound(key)) : resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
async function write(key, value) {
  const db = await database();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put(value, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error || Error('Browser storage write failed'));
  });
}
async function remove(key, {force = false} = {}) {
  const db = await database();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    const store = tx.objectStore(STORE);
    const req = store.get(key);
    req.onsuccess = () => {
      if (req.result === undefined && !force) { tx.abort(); reject(notFound(key)); return; }
      store.delete(key);
    };
    req.onerror = () => { reject(req.error); tx.abort(); };
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => { /* Missing key error handled above */ };
  });
}
async function rename(from, to) {
  const db = await database();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    const store = tx.objectStore(STORE);
    const req = store.get(from);
    req.onsuccess = () => {
      if (req.result === undefined) { reject(notFound(from)); tx.abort(); return; }
      store.put(req.result, to); store.delete(from);
    };
    req.onerror = () => { reject(req.error); tx.abort(); };
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => { /* Error handled by request or transaction */ };
  });
}
async function readdir(prefix) {
  const db = await database();
  return new Promise((resolve, reject) => {
    const req = db.transaction(STORE, 'readonly').objectStore(STORE).getAllKeys();
    req.onsuccess = () => resolve(req.result.filter(k => typeof k === 'string' && k.startsWith(prefix + '/') && !k.slice(prefix.length + 1).includes('/')).map(k => k.slice(prefix.length + 1)));
    req.onerror = () => reject(req.error);
  });
}
export const fs = {
  readFile: read,
  writeFile: write,
  rename,
  mkdir: async () => undefined,
  rm: remove,
  unlink: key => remove(key),
  access: async key => { await read(key); },
  readdir
};
export const path = {
  join: (...parts) => parts.join('/').replace(/\/+/g,'/'),
  dirname: value => value.slice(0, Math.max(0, value.lastIndexOf('/')))
};
