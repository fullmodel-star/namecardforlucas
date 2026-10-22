// 100 名片管理 髒資料搜尋測試（2026-10-22）：1355 張，混入數字郵遞區號／數字手機（掉開頭 0）／標籤是字串。
//   node _tools/search_dirty_test.mjs <網址>
// 以前任一張型別不對，搜尋就整個丟例外、畫面停在原清單；第一筆結果也要在鍵盤上方（y<420）。
import { createRequire } from 'node:module';
const require = createRequire('C:/Users/c0787/Desktop/App專案/04_管理工具/體驗評分/package.json');
const puppeteer = require('puppeteer-core');
const url = process.argv[2];
const browser = await puppeteer.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true, args: ['--no-sandbox'] });
let fails = 0;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const p = await (await browser.createBrowserContext()).newPage();
const errs = []; p.on('pageerror', (e) => errs.push(String(e).slice(0, 200)));
await p.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
await p.goto(url, { waitUntil: 'networkidle0' }); await sleep(800);
// 1355 張，故意混入怪型別（數字郵遞區號、tags 是字串、null 欄位、電話是數字）
await p.evaluate(async () => {
  const orgs = ['財團法人中衛發展中心', '台積電', '3M 台灣', '鴻海精密', 'ABC Corp'];
  const list = [];
  for (let i = 0; i < 1355; i++) list.push({ id: 'card_t' + i, name: (i === 7 ? '王瑋誠' : '測試' + i), org: orgs[i % 5], title: i % 3 ? '經理' : null,
    mobile: i % 4 === 0 ? 912000000 + i : '0912-' + String(100000 + i), zip: i % 2 ? 106 : '100', tags: i % 10 === 0 ? '客戶' : ['客戶'],
    processed: true, group: '其他', createdAt: '2026/1/1', createdAtTs: i, theme: 'indigo' });
  for (const c of list) await new Promise((res) => { const t = db.transaction(['cards'], 'readwrite'); t.objectStore('cards').put(c); t.oncomplete = res; });
});
await p.reload({ waitUntil: 'networkidle0' }); await sleep(1500);
await p.evaluate(() => switchTab('cards')); await sleep(800);
console.log('cards', await p.evaluate(() => cardsList.length));
for (const s of ['王瑋誠', '中衛', '台積', '0912', 'abc']) {
  await p.click('#search-input', { clickCount: 3 }); await p.keyboard.press('Backspace');
  await p.type('#search-input', s); await sleep(600);
  const r = await p.evaluate(() => { const rows = document.querySelectorAll('#card-grid .biz-card-row'); const f = rows[0]; return { n: rows.length, label: document.getElementById('cards-count-label').textContent, firstY: f ? Math.round(f.getBoundingClientRect().top) : null, inputY: Math.round(document.getElementById('search-input').getBoundingClientRect().top) }; });
  console.log(s, JSON.stringify(r));
  const exp = { '王瑋誠': '1 張', '中衛': '271 張', '台積': '271 張', '0912': '1355 張', 'abc': '271 張' }[s];
  if (r.label !== exp || !(r.firstY < 420)) { fails++; console.log('  FAIL 預期', exp); }
}
// 群組篩選停在別的群組時，打字仍要搜全部名片（老闆 10-22 截圖：群組停在「企業客戶」搜「工業技術」0 筆）
await p.click('#search-input', { clickCount: 3 }); await p.keyboard.press('Backspace'); await sleep(400);
await p.evaluate(() => { setGroupFilter('企業客戶'); setTagFilter('客戶'); setProcessedFilter('unprocessed'); });
await p.type('#search-input', '王瑋誠'); await sleep(600);
const g = await p.evaluate(() => ({ label: document.getElementById('cards-count-label').textContent, note: document.getElementById('search-scope-note').innerText, firstY: Math.round((document.querySelector('#card-grid .biz-card-row') || document.body).getBoundingClientRect().top) }));
console.log('篩選中搜尋', JSON.stringify(g));
if (g.label !== '1 張' || !/企業客戶/.test(g.note) || !(g.firstY < 420)) { fails++; console.log('  FAIL 篩選中搜尋應搜全部'); }
await p.click('#search-input', { clickCount: 3 }); await p.keyboard.press('Backspace'); await sleep(600);
const back = await p.evaluate(() => document.getElementById('cards-count-label').textContent);
console.log('清掉搜尋字恢復篩選', back);
if (back !== '0 張（共 1355 張）') { fails++; console.log('  FAIL 清掉搜尋字應恢復篩選'); }
console.log('errors', errs);
if (errs.length) fails++;
console.log(fails ? 'FAIL ' + fails : 'PASS');
await browser.close();
process.exit(fails ? 1 : 0);
