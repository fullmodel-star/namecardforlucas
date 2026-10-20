// 100 名片管理 瀏覽器測試（2026-10-20 首頁視覺改版時建立；本 App 以前沒有自動測試）
//   node _tools/ui_test.mjs <網址> [--flow-only]
// 第 1 節＝主要流程（改版前後都要過）：手動輸入新增名片→名片列表→搜尋（有結果／沒結果）→開客戶 CRM（iframe）→拍照掃名片（沒金鑰提示）。
// 第 2 節起＝改版「青瓷名片匣」的呈現檢查（--flow-only 時略過）。
// 需要 Chrome 與 puppeteer-core（借用 04_管理工具\體驗評分\node_modules）。
import { createRequire } from 'node:module';
const require = createRequire('C:/Users/c0787/Desktop/App專案/04_管理工具/體驗評分/package.json');
const puppeteer = require('puppeteer-core');
const url = process.argv[2] || 'http://127.0.0.1:8930/';
const flowOnly = process.argv.includes('--flow-only');
const origin = new URL(url).origin;
const browser = await puppeteer.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true, args: ['--no-sandbox'] });
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log('  ok  ', m); } else { fail++; console.log('  FAIL', m); } };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const EMOJI = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B50}\u{2705}\u{274C}\u{2795}]/u;
// Google 登入（GSI）本來就會在第一次點畫面時載入（2026-10-12 起的既有行為），不算這次改版引入的外部連線
const ALLOWED_EXT = /^https:\/\/accounts\.google\.com\//;

async function open(w, h) {
  const ctx = await browser.createBrowserContext();
  const p = await ctx.newPage();
  const ext = [], errs = [];
  p.on('request', (r) => { const u = r.url(); if (!u.startsWith(origin) && !/^(data|blob):/.test(u) && !ALLOWED_EXT.test(u)) ext.push(u); });
  p.on('pageerror', (e) => errs.push(String(e)));
  await p.setViewport({ width: w, height: h, isMobile: w < 800, hasTouch: w < 800 });
  await p.goto(url, { waitUntil: 'networkidle0' });
  await sleep(800);
  return { ctx, p, ext, errs };
}
const clickText = (p, re, scope = 'body') => p.evaluate((src, sc) => {
  const rx = new RegExp(src);
  const b = [...document.querySelector(sc).querySelectorAll('button, fluent-button')].find((x) => x.offsetParent !== null && rx.test(x.textContent));
  if (!b) return false; b.click(); return true;
}, re.source, scope);

console.log('1 主要流程（手機 390）');
let { ctx, p, ext, errs } = await open(390, 844);
ok(await clickText(p, /手動輸入/), '首頁有「手動輸入」可按');
await sleep(500);
ok(await p.evaluate(() => getComputedStyle(document.getElementById('form-modal-bg')).display !== 'none'), '手動新增表單打開');
await p.type('#f-name', '王小明'); await p.type('#f-org', '青山顧問股份有限公司'); await p.type('#f-mobile', '0912345678');
ok(await clickText(p, /儲存名片/, '#form-modal-bg'), '按「儲存名片」');
await sleep(900);
await p.evaluate(() => switchTab('cards')); await sleep(500);
let rows = await p.evaluate(() => [...document.querySelectorAll('#card-grid .biz-card-row')].map((r) => r.textContent.replace(/\s+/g, ' ')));
ok(rows.length === 1 && /王小明/.test(rows[0]) && /青山顧問/.test(rows[0]), '名片列表有剛存的王小明 ' + rows.length);
await p.type('#search-input', '青山'); await sleep(700);
rows = await p.evaluate(() => document.querySelectorAll('#card-grid .biz-card-row').length);
ok(rows === 1, '搜尋「青山」找到 1 張');
await p.evaluate(() => { const i = document.getElementById('search-input'); i.value = ''; }); await p.type('#search-input', 'qzxv'); await sleep(700);
const none = await p.evaluate(() => document.getElementById('card-grid').textContent);
ok(/找不到符合「qzxv」的名片/.test(none), '搜尋沒結果時有提示');
await p.evaluate(() => clearCardSearch()); await sleep(300);
await p.click('#btab-crm'); await sleep(1800);
const fr = p.frames().find((f) => /crm\.html/.test(f.url()));
ok(!!fr, 'CRM iframe 載入 crm.html');
let crmText = fr ? await fr.evaluate(() => document.body.innerText) : '';
for (let i = 0; i < 10 && fr && !/王小明/.test(crmText); i++) { await sleep(300); crmText = await fr.evaluate(() => document.body.innerText); }
ok(/王小明/.test(crmText), 'CRM 客戶清單有王小明（名片自動成為客戶）');
await p.click('#btab-myprofile'); await sleep(400);
ok(await clickText(p, /拍照掃名片/, '#view-myprofile'), '首頁「拍照掃名片」可按');
await sleep(500);
const batch = await p.evaluate(() => { const v = document.getElementById('view-batch'); return { vis: v && getComputedStyle(v).display !== 'none', txt: v ? v.innerText : '' }; });
ok(batch.vis && /金鑰/.test(batch.txt), '進到掃名片分頁、沒金鑰時有提示（流程未改）');
ok(errs.length === 0, '0 例外 ' + errs.join(';'));
await ctx.close();

if (!flowOnly) {
  console.log('2 首屏主視覺與字型（手機 390、首訪）');
  ({ ctx, p, ext, errs } = await open(390, 844));
  let r = await p.evaluate(() => {
    const box = document.querySelector('#view-myprofile > div');
    const hero = box.firstElementChild; const hb = hero.getBoundingClientRect();
    const solid = [...document.querySelectorAll('#view-myprofile .btn-primary, #view-myprofile fluent-button[appearance="primary"]')]
      .filter((b) => { const r = b.getBoundingClientRect(); return b.offsetParent !== null && r.top < innerHeight && r.bottom > 0; });
    return { id: hero.id, h: (hero.querySelector('.bc-h') || {}).textContent, bottom: hb.bottom, sticky: !!hero.closest('.rl-appbar'),
      solid: solid.map((b) => b.textContent.trim()), imgs: hero.querySelectorAll('.bc-art img').length };
  });
  ok(r.id === 'mp-hero', '「我的」頁第一個區塊是主視覺');
  ok(r.h === '收到名片，拍一下就存好', '主視覺大標：' + r.h);
  ok(r.solid.length === 1 && /拍照掃名片/.test(r.solid[0]), '首屏只有一顆實心主要行動 ' + JSON.stringify(r.solid));
  ok(r.bottom < 844 && !r.sticky && r.imgs === 2, '主視覺在首屏內、不在黏住的頁首、有 2 張 3D 圖');
  ok(await p.evaluate(() => !!customElements.get('fluent-button') && document.querySelector('#mp-hero fluent-button').getBoundingClientRect().height >= 48), 'Fluent UI <fluent-button> 已定義、主鈕高 ≥48');
  r = await p.evaluate(async () => {
    await document.fonts.ready;
    const fam = (sel) => getComputedStyle(document.querySelector(sel)).fontFamily;
    return { loaded: [...document.fonts].some((f) => f.family.replace(/"/g, '') === 'BCSerif' && f.status === 'loaded'),
      fams: [fam('.rl-appbar .rl-title'), fam('.bc-h'), fam('.btab span'), fam('.db-section h3'), fam('.mp-stat span')], num: fam('.mp-stat b') };
  });
  ok(r.loaded, 'BCSerif 宋體子集已載入');
  ok(r.fams.every((f) => /BCSerif/.test(f)), 'App 名／大標／分頁／區塊標題／統計標籤用宋體');
  ok(!/BCSerif/.test(r.num), '數字走系統字');
  const keys = ['cardindex', 'camera', 'filebox', 'hourglass', 'idcard', 'handshake'];
  const loads = await p.evaluate(async (ks) => Promise.all(ks.map((k) => new Promise((res) => { const i = new Image(); i.onload = () => res(i.naturalWidth); i.onerror = () => res(0); i.src = `vendor/fluent-3d/${k}.png`; }))), keys);
  ok(loads.every((w) => w === 128), '6 種 3D 圖都載得出來 ' + loads.join(','));
  r = await p.evaluate((src) => { const rx = new RegExp(src, 'u'); return [...document.querySelectorAll('#mp-hero button, #mp-hero fluent-button, .bottom-tab-bar .btab, .mp-stat, #view-myprofile h3')].filter((e) => rx.test(e.textContent)).map((e) => e.textContent.trim().slice(0, 20)); }, EMOJI.source);
  ok(r.length === 0, '主視覺／分頁／統計格／區塊標題沒有 emoji ' + JSON.stringify(r));
  ok(await p.evaluate(() => [...document.querySelectorAll('.bottom-tab-bar .btab')].every((b) => b.querySelector('i.ti'))), '底部 5 個分頁都是線條圖示');
  // 解釋句收進 ⓘ：預設收合、點開看得到、全文在 DOM
  r = await p.evaluate(() => { const d = document.querySelector('.mp-why'); return d ? { open: d.open, txt: d.textContent } : null; });
  ok(r && !r.open && /存好的名片會自動成為「客戶」/.test(r.txt) && /需 AI 金鑰/.test(r.txt), '首訪說明：「需 AI 金鑰」直接可見，「自動成為客戶」收在 ⓘ、全文在 DOM');
  for (const w of [360, 390]) {
    await p.setViewport({ width: w, height: 800, isMobile: true, hasTouch: true }); await sleep(250);
    ok(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${w} 寬不左右滑`);
  }
  // 對比（兩個主題）
  for (const th of ['graphite', 'light']) {
    await p.evaluate((t) => { if (document.documentElement.getAttribute('data-theme') !== t) toggleTheme(); }, th); await sleep(250);
    r = await p.evaluate(() => {
      const lum = (rgb) => { const v = rgb.match(/[\d.]+/g).slice(0, 3).map(Number).map((x) => { x /= 255; return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4; }); return 0.2126 * v[0] + 0.7152 * v[1] + 0.0722 * v[2]; };
      const cr = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
      const cs = (s) => getComputedStyle(document.querySelector(s));
      const hero2 = getComputedStyle(document.documentElement).getPropertyValue('--hero2').trim().replace(/^#(..)(..)(..)$/, (m, a, b, c) => `rgb(${parseInt(a, 16)},${parseInt(b, 16)},${parseInt(c, 16)})`);
      return { h: cr(cs('.bc-h').color, hero2), main: cr(cs('#mp-hero .bc-main').color, cs('#mp-hero .bc-main').backgroundColor),
        stat: cr(cs('.mp-stat span').color, cs('.mp-stat').backgroundColor), first: cr(cs('.mp-first-t').color, cs('.mp-first').backgroundColor),
        scan: cr('rgb(255,255,255)', cs('.btab-scan .btab-pip').backgroundColor) };
    });
    ok(Object.values(r).every((v) => v >= 4.5), `${th}：對比 ${Object.entries(r).map(([k, v]) => k + ' ' + v.toFixed(1)).join('／')} 都 ≥4.5`);
  }
  ok(errs.length === 0, '0 例外 ' + errs.join(';'));
  ok(ext.length === 0, '沒有新的外部連線（只連本機；Google 登入照舊） ' + JSON.stringify(ext.slice(0, 3)));
  await ctx.close();

  console.log('3 桌機 1440');
  ({ ctx, p, ext, errs } = await open(1440, 900));
  r = await p.evaluate(() => {
    const box = document.querySelector('#view-myprofile > div');
    const a = document.getElementById('myprofile-card-section').getBoundingClientRect(), q = document.querySelector('.mp-qr').getBoundingClientRect();
    return { grid: getComputedStyle(box).display, side: q.left > a.right && Math.abs(q.top - a.top) < 30, w: box.getBoundingClientRect().width };
  });
  ok(r.grid === 'grid' && r.side && r.w <= 1180, '桌機「我的」頁兩欄（左個人名片／右掃碼交流），內容寬 ≤1180');
  r = await p.evaluate(async () => {
    window.scrollTo(0, document.documentElement.scrollHeight); await new Promise((res) => setTimeout(res, 300));
    const navTop = document.querySelector('.bottom-tab-bar').getBoundingClientRect().top;
    const cards = [...document.querySelectorAll('#view-myprofile .db-section, #view-myprofile .tool-card, #view-myprofile .mp-stat, #mp-hero')].filter((c) => c.offsetParent !== null).map((c) => c.getBoundingClientRect());
    return cards.filter((c) => c.bottom > navTop + 1 && c.top < innerHeight).length;
  });
  ok(r === 0, '捲到底時底部分頁不蓋任何卡片');
  ok(errs.length === 0 && ext.length === 0, '桌機 0 例外、沒有新的外部連線');
  await ctx.close();

  console.log('4 CRM（iframe）跟首頁協調');
  ({ ctx, p, ext, errs } = await open(390, 844));
  await p.click('#btab-crm'); await sleep(1500);
  const f2 = p.frames().find((f) => /crm\.html/.test(f.url()));
  r = f2 ? await f2.evaluate(async () => {
    await document.fonts.ready;
    return { h1: getComputedStyle(document.querySelector('.top h1')).fontFamily, fab: getComputedStyle(document.querySelector('.fab')).backgroundColor,
      gear: !!document.querySelector('.icon-btn i.ti-settings'), search: !!document.querySelector('.search i.ti-search'),
      big: (() => { const i = document.querySelector('.empty .big img'); return i ? i.naturalWidth : -1; })() };
  }) : {};
  ok(/BCSerif/.test(r.h1), 'CRM 標題用同一套宋體');
  ok(r.fab === 'rgb(31, 114, 104)' || r.fab === 'rgb(30, 107, 98)', 'CRM 主鈕是青瓷綠 ' + r.fab);
  ok(r.gear && r.search, 'CRM 的 ⚙ 🔍 換成線條圖示');
  ok(r.big === 128, 'CRM 空狀態用 3D 圖');
  ok(errs.length === 0, 'CRM 0 例外 ' + errs.join(';'));
  await ctx.close();
}

await browser.close();
console.log(`PASS ${pass} / FAIL ${fail}`);
process.exit(fail ? 1 : 0);
