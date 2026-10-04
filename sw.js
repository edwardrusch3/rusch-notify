// Rusch Notify service worker: shows pushed alerts and keeps a short history.
const DB = 'rusch-notify', STORE = 'alerts', KEEP = 50;

function db() {
  return new Promise((res, rej) => {
    const r = indexedDB.open(DB, 1);
    r.onupgradeneeded = () => r.result.createObjectStore(STORE, { keyPath: 'at' });
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
}
async function save(a) {
  try {
    const d = await db();
    await new Promise((res) => {
      const tx = d.transaction(STORE, 'readwrite'), st = tx.objectStore(STORE);
      st.put(a);
      const all = st.getAllKeys();
      all.onsuccess = () => { const k = all.result; for (let i = 0; i < k.length - KEEP; i++) st.delete(k[i]); };
      tx.oncomplete = res; tx.onerror = res;
    });
  } catch (e) { /* history is a convenience; never block the alert */ }
}

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));

self.addEventListener('push', (e) => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch (_) { d = { body: e.data && e.data.text() }; }
  const a = {
    at: Date.now(),
    title: d.title || 'Rusch house',
    body: d.body || '',
    level: d.level || 'info',
    source: d.source || 'house',
    url: d.url || './'
  };
  e.waitUntil(Promise.all([
    self.registration.showNotification(a.title, {
      body: a.body, icon: 'icon-192.png', badge: 'icon-192.png',
      tag: d.tag || undefined, data: { url: a.url }
    }),
    save(a),
    self.clients.matchAll({ type: 'window' }).then((cs) => cs.forEach((c) => c.postMessage({ type: 'alert', alert: a })))
  ]));
});

self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const url = (e.notification.data && e.notification.data.url) || './';
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((cs) => {
    for (const c of cs) { if ('focus' in c) return c.focus(); }
    return self.clients.openWindow(url);
  }));
});
