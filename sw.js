// ポケダンス なわとび — オフライン用 Service Worker
// アプリ本体（HTML/マニフェスト/アイコン）をキャッシュし、ネットが無くても起動できるようにする。
// ※ 曲データはここではなく IndexedDB に保存される（アプリ側）。
const CACHE = 'pdn-v2';
const ASSETS = ['./', './index.html', './manifest.webmanifest', './icon.svg'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  e.respondWith(
    caches.match(req).then(hit => hit || fetch(req).then(res => {
      try {
        const url = new URL(req.url);
        if (url.origin === location.origin) {
          const copy = res.clone();
          caches.open(CACHE).then(c => c.put(req, copy));
        }
      } catch (_) {}
      return res;
    }).catch(() => caches.match('./index.html')))   // オフライン時のナビゲーションは本体を返す
  );
});
