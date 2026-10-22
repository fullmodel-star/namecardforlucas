// 100 名片管理 搜尋與配色測試（2026-10-22）
//   node _tools/search_test.mjs <網址> [截圖資料夾]
// 名片頁：電話不管有沒有 - ( ) 空格 +886 都比得到、空格分詞 AND、全形半形；CRM 頁：含數字的詞不再亂比電話。
import { createRequire } from 'node:module';
const require = createRequire('C:/Users/c0787/Desktop/App專案/04_管理工具/體驗評分/package.json');
const puppeteer = require('puppeteer-core');
const url = process.argv[2];
const out = process.argv[3];
const browser = await puppeteer.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true, args: ['--no-sandbox'] });
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log('  ok  ', m); } else { fail++; console.log('  FAIL', m); } };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const ctx = await browser.createBrowserContext();
const p = await ctx.newPage();
const errs = []; p.on('pageerror', (e) => errs.push(String(e)));
await p.setViewport({ width: 450, height: 1000, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
await p.goto(url, { waitUntil: 'networkidle0' });
await p.evaluate(() => {
  localStorage.setItem('bizcard_user_mycard', JSON.stringify({ name: '王小明', title: '研發長', org: '青山顧問股份有限公司', dept: '技術支援中心', phone: '', mobile: '0912-345678', email: 'demo@example.com', website: '', zip: '', addr: '', theme: 'indigo', image: '', lineId: '' }));
});
await p.reload({ waitUntil: 'networkidle0' }); await sleep(1500);
if (out) await p.screenshot({ path: out + '/home_dark.png' });
// 加測試名片
const cards = [
  { name: '陳大文', org: '台積電', mobile: '0920-235196', phone: '(02)2700-1234' },
  { name: '林美玲', org: '3M 台灣', mobile: '+886 933 111 222' },
  { name: '王志強', org: '中衛發展中心', title: '經理', mobile: '0955 000 333' },
  { name: '張三', org: 'ＡＢＣ公司', mobile: '0911333444' },
];
for (const c of cards) {
  await p.evaluate(() => openAddForm ? openAddForm() : null).catch(() => {});
  await p.evaluate(() => { const b = [...document.querySelectorAll('button, fluent-button')].find((x) => x.offsetParent && /手動輸入/.test(x.textContent)); b && b.click(); });
  await sleep(400);
  for (const [k, v] of Object.entries(c)) { const el = await p.$('#f-' + k); if (el) { await el.click({ clickCount: 3 }); await el.type(v); } }
  await p.evaluate(() => { const b = [...document.querySelector('#form-modal-bg').querySelectorAll('button')].find((x) => /儲存名片/.test(x.textContent)); b.click(); });
  await sleep(700);
  await p.evaluate(() => { try { switchTab('myprofile'); } catch (e) {} });
}
await p.evaluate(() => switchTab('cards')); await sleep(500);
const total = await p.evaluate(() => cardsList.length);
ok(total === 4, '建立 4 張測試名片 ' + total);
const q = async (s) => { await p.evaluate((s) => { const i = document.getElementById('search-input'); i.value = s; filterCards(); }, s); await sleep(100); return p.evaluate(() => [...document.querySelectorAll('#card-grid .biz-card-row .bcr-name')].map((x) => x.textContent)); };
const cases = [
  ['0920235196', ['陳大文']], ['0920-235196', ['陳大文']], ['235196', ['陳大文']],
  ['0933111222', ['林美玲']], ['27001234', ['陳大文']],
  ['3M', ['林美玲']], ['王 中衛', ['王志強']], ['中衛 經理', ['王志強']],
  ['abc', ['張三']], ['ＡＢＣ', ['張三']], ['台積電', ['陳大文']], ['qzxv', []],
];
for (const [s, exp] of cases) { const r = (await q(s)).sort(); ok(JSON.stringify(r) === JSON.stringify(exp.sort()), `名片搜尋「${s}」→ ${JSON.stringify(r)}`); }
await q('');
// 公司頁
await p.evaluate(() => { try { switchTab('graph'); } catch (e) {} }); await sleep(400);
// CRM
await p.evaluate(() => switchTab('crm')); await sleep(2000);
const fr = p.frames().find((f) => /crm\.html/.test(f.url()));
ok(!!fr, 'CRM iframe');
if (fr) {
  for (let i = 0; i < 15; i++) { if (/陳大文/.test(await fr.evaluate(() => document.body.innerText))) break; await sleep(300); }
  const cq = async (s) => { await fr.evaluate((s) => { const i = document.getElementById('q'); i.value = s; render(); }, s); await sleep(100); return fr.evaluate(() => { const t = document.getElementById('list').innerText; return ['陳大文', '林美玲', '王志強', '張三'].filter((n) => t.includes(n)); }); };
  for (const [s, exp] of [['3M', ['林美玲']], ['0920235196', ['陳大文']], ['王 中衛', ['王志強']], ['ＡＢＣ', ['張三']], ['2', []]]) {
    const r = (await cq(s)).sort(); ok(JSON.stringify(r) === JSON.stringify(exp.sort()), `CRM 搜尋「${s}」→ ${JSON.stringify(r)}`);
  }
}
await p.evaluate(() => switchTab('myprofile')); await sleep(600);
await p.evaluate(() => window.scrollTo(0, 0)); await sleep(300);
if (out) await p.screenshot({ path: out + '/home_dark_after_cards.png' });
await p.evaluate(() => { document.documentElement.setAttribute('data-theme', 'light'); }); await sleep(400);
if (out) await p.screenshot({ path: out + '/home_light.png' });
ok(errs.length === 0, 'pageerror 0 ' + errs.join(' | '));
console.log(`\n${pass} pass / ${fail} fail`);
await browser.close();
process.exit(fail ? 1 : 0);
