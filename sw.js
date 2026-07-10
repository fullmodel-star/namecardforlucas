const CACHE_NAME = 'bizcard-pwa-v25';
const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './crm.html',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png',
  'https://cdn.jsdelivr.net/npm/@tabler/icons-webfont@3.19.0/dist/tabler-icons.min.css',
  'https://accounts.google.com/gsi/client'
];

// [PWA sw.js] 安裝階段：將靜態資源快取起來
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('[PWA SW] 正在快取靜態資源...');
        return cache.addAll(ASSETS_TO_CACHE);
      })
      // 不在此 skipWaiting：新版先進入 waiting，等使用者在畫面點「立即更新」再接管
  );
});

// [PWA sw.js] 接收頁面指令：使用者按下「立即更新」時才讓新版 SW 立刻接管
self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// [PWA sw.js] 啟用階段：清理舊版本的快取資料
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cache) => {
          if (cache !== CACHE_NAME) {
            console.log('[PWA SW] 清理舊快取：', cache);
            return caches.delete(cache);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// [PWA sw.js] 請求攔截階段：採用 Network-First (網路優先) 策略，斷網時回退使用本機快取
self.addEventListener('fetch', (event) => {
  // 只處理 GET 請求，避開 Google 登入或 Gemini API 的 POST/PATCH 請求
  if (event.request.method !== 'GET') return;

  // 排除即時 API（匯率、QR Code）— 不快取，直接走網路
  const url = event.request.url;
  if (url.includes('er-api.com') || url.includes('frankfurter') ||
      url.includes('qrserver.com') || url.includes('googleapis.com')) {
    return; // 交給瀏覽器原生處理，不攔截、不快取
  }

  event.respondWith(
    fetch(event.request)
      .then((networkResponse) => {
        // 如果網路正常，複製一份結果存入快取，並返回網路資料
        const responseToCache = networkResponse.clone();
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(event.request, responseToCache);
        });
        return networkResponse;
      })
      .catch(() => {
        // 如果斷網，嘗試從本機快取中讀取對應的資源
        console.log('[PWA SW] 網路連線失敗，改由本機快取載入：', event.request.url);
        return caches.match(event.request);
      })
  );
});
