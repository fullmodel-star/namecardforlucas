const CACHE_NAME = 'bizcard-pwa-v33';
// 只預快取「同源」核心檔；跨網域資源(tabler/gsi)交給 runtime 快取，避免 addAll 單一失敗拖垮整個 install
const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './crm.html',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png'
];

// [PWA sw.js] 安裝階段：逐檔快取，單一資源失敗不拖垮整個 install
self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    const results = await Promise.allSettled(ASSETS_TO_CACHE.map(async (url) => {
      const res = await fetch(url, { cache: 'reload' });
      if (res && res.ok) await cache.put(url, res);
      else throw new Error('bad response ' + url);
    }));
    const failed = results.filter(r => r.status === 'rejected').length;
    if (failed) console.warn('[PWA SW] 有 ' + failed + ' 個核心資源未快取（不影響安裝）');
    // 不 skipWaiting：新版先進 waiting，等使用者按「立即更新」再接管
  })());
});

// [PWA sw.js] 使用者按「立即更新」時才讓新版 SW 立刻接管
self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
});

// [PWA sw.js] 啟用階段：清理舊版快取
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((names) => Promise.all(
      names.map((c) => c !== CACHE_NAME ? caches.delete(c) : null)
    )).then(() => self.clients.claim())
  );
});

// [PWA sw.js] Network-First：斷網回退本機快取；只快取成功的同源/CORS 回應
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  const url = event.request.url;
  // 即時 API 與登入/AI：不攔截、不快取，交給瀏覽器原生處理
  if (url.includes('er-api.com') || url.includes('frankfurter') ||
      url.includes('qrserver.com') || url.includes('googleapis.com') ||
      url.includes('generativelanguage') || url.includes('accounts.google.com')) {
    return;
  }
  event.respondWith((async () => {
    try {
      const net = await fetch(event.request);
      // 僅快取成功且非錯誤/重導的回應，避免把 4xx/5xx 壞頁回放
      if (net && net.ok && (net.type === 'basic' || net.type === 'cors')) {
        const copy = net.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
      }
      return net;
    } catch (e) {
      // 斷網：查詢字串無關比對（start_url 帶 ?source=pwa 也命中）
      const cached = await caches.match(event.request, { ignoreSearch: true });
      if (cached) return cached;
      // 導覽請求離線回退到首頁，避免白畫面
      if (event.request.mode === 'navigate') {
        return (await caches.match('./index.html')) || (await caches.match('./')) || Response.error();
      }
      return Response.error();
    }
  })());
});
