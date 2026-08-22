// ポケダンス なわとび — オフライン用 Service Worker
// アプリ本体（HTML/マニフェスト/アイコン）をキャッシュし、ネットが無くても起動できるようにする。
// ※ 曲データはここではなく IndexedDB に保存される（アプリ側）。
//
// v4 の変更点:
//  ・アプリ本体（ページ）は「ネットが 2秒以内に応答すれば新しい方、だめならキャッシュ」に変更。
//    → 修正した index.html が iPad のホーム画面アプリにも確実に届く（オフラインでも起動はできる）。
//  ・200 以外の応答（GitHub Pages の 404 HTML など）をキャッシュしないようにした。
const CACHE = 'pdn-v4';
const ASSETS = ['./', './index.html', './manifest.webmanifest', './icon.svg'];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE)
      .then(c => c.addAll(ASSETS.map(u => new Request(u, { cache: 'reload' }))))
      .then(() => self.skipWaiting())
  );
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

  let url;
  try { url = new URL(req.url); } catch (_) { return; }
  if (url.origin !== location.origin) return;              // よそのサイトには さわらない

  // ── アプリ本体（ページ）: ネットさきどり（2秒でタイムアウト）→ だめなら キャッシュ ──
  if (req.mode === 'navigate') {
    e.respondWith(caches.open(CACHE).then(async cache => {
      const cached = await cache.match('./index.html') || await cache.match('./');
      const net = fetch(req).then(res => {
        if (res && res.ok) { cache.put('./index.html', res.clone()); cache.put('./', res.clone()); }
        return res;
      });
      if (!cached) return net;                             // はじめての 起動
      return Promise.race([
        net.catch(() => cached),
        new Promise(r => setTimeout(() => r(cached), 2000))
      ]);
    }));
    return;
  }

  // ── そのほか: キャッシュさきどり → 無ければ ネット（200 の ふつうの こたえだけ ためる）──
  e.respondWith(
    caches.match(req).then(hit => hit || fetch(req).then(res => {
      if (res && res.ok && res.type === 'basic') {
        const copy = res.clone();
        caches.open(CACHE).then(c => c.put(req, copy)).catch(() => {});
      }
      return res;
    }).catch(() => new Response('', { status: 504, statusText: 'offline' })))
  );
});
