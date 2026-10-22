/* RL_FRESH_START — 2026-10-19 全家族「離線要有，但不能擋更新」（母版：04_管理工具\PWA新鮮度\rl_fresh_sw.js，用 apply.py 重新套用，不要在這裡手改）
   問題：原本 fetch 對網頁本身也是 cache-first → 重整先畫舊畫面、發新版要開兩次才看得到。
   做法：這段排在 sw.js 最前面、最先註冊 fetch：網頁／程式／樣式／資料（.html .js .mjs .css .json 與導覽）一律先拿線上最新的，
   4 秒沒回應或離線才用快取；成功時存一份到 rl-fresh 快取，離線也有最新版可用。
   圖片、字型、地圖圖磚等其他檔案不攔，交給原本的 handler（照舊 cache-first）。
   攔下的請求呼叫 stopImmediatePropagation()，原本的 fetch handler 不會再處理同一個請求。 */
(function(){
  var FRESH = 'rl-fresh';
  var CODE = /\.(?:html?|m?js|css|json|webmanifest)$/i;
  function fromCache(req){
    return caches.match(req).then(function(r){
      if (r) return r;
      return caches.match(req, { ignoreSearch: true }).then(function(r2){
        if (r2 || req.mode !== 'navigate') return r2;
        return caches.match('./').then(function(r3){ return r3 || caches.match('./index.html') || caches.match('index.html'); });
      });
    });
  }
  function fresh(e, req){
    var net = fetch(req).then(function(res){
      if (res && res.ok && res.type === 'basic'){
        var copy = res.clone();
        e.waitUntil(caches.open(FRESH).then(function(c){ return c.put(req, copy); }).catch(function(){}));
      }
      return res;
    });
    var timer = new Promise(function(resolve){ setTimeout(function(){ resolve(null); }, 4000); });
    return Promise.race([net.catch(function(){ return null; }), timer]).then(function(res){
      if (res && (res.ok || res.status === 304 || res.type === 'opaqueredirect')) return res;
      return fromCache(req).then(function(c){
        if (c) return c;
        return net.catch(function(){ return Response.error(); });   /* 快取也沒有：再等網路（可能只是慢） */
      });
    });
  }
  self.addEventListener('fetch', function(e){
    var req = e.request;
    if (req.method !== 'GET') return;
    var url; try { url = new URL(req.url); } catch (x) { return; }
    if (url.origin !== self.location.origin) return;
    if (url.pathname.indexOf('/api/') === 0) return;          /* 有自己 API 的 App（Worker）交給原本邏輯 */
    var isDoc = req.mode === 'navigate' || url.pathname.slice(-1) === '/' || CODE.test(url.pathname);
    if (!isDoc) return;
    if (url.pathname.slice(-6) === '/sw.js' || url.pathname === '/sw.js') return;
    e.stopImmediatePropagation();
    e.respondWith(fresh(e, req));
  });
})();
/* RL_FRESH_END */
const CACHE_NAME = 'bizcard-pwa-v72';
// 只預快取「同源」核心檔；跨網域資源(tabler/gsi)交給 runtime 快取，避免 addAll 單一失敗拖垮整個 install
const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './crm.html',
  './manifest.json',
  './ridgeline-ui.css',
  './favicon.svg',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png',
  // 2026-10-03：原本從 jsDelivr 載入的三個函式庫改自帶，預先快取才能離線
  // 2026-10-12：Tabler 改用子集（_tools/subset_tabler.py 產生；原整份 865KB 字型不再載入）
  './vendor/tabler-icons/tabler-icons.subset.css',
  './vendor/tabler-icons/fonts/tabler-icons.subset.woff2',
  './favicon-32.png',
  // html2canvas／pdf-lib 改成按功能才載入，但仍預先快取，離線照常可用
  './vendor/html2canvas/html2canvas.min.js',
  './vendor/pdf-lib/pdf-lib.min.js',
  // 2026-10-20 首頁視覺改版：宋體子集、Fluent UI 按鈕、3D 圖（離線也要有）
  './vendor/serif-ui/bc-serif.woff2',
  './vendor/fluent-ui/fluent-button.min.js',
  './vendor/fluent-3d/cardindex.png',
  './vendor/fluent-3d/camera.png',
  './vendor/fluent-3d/filebox.png',
  './vendor/fluent-3d/hourglass.png',
  './vendor/fluent-3d/idcard.png',
  './vendor/fluent-3d/handshake.png'
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
