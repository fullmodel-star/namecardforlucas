// 100 名片管理 資料存取測試（2026-10-24 建立）
//   node _tools/data_test.mjs [App 資料夾]
//   不給參數＝測本資料夾（_tools 的上一層）；給參數＝測別的副本（例如故意改壞的副本）。
// 自帶本機靜態伺服器（埠號 0＝系統配發），結束只關自己開的伺服器與瀏覽器。
// 網路：Chrome 以 host-resolver-rules 把本機以外的網域全部解析失敗，且攔截所有請求——
//       本機放行；Google Drive API 由測試回假資料（假 token「TEST-FAKE-TOKEN」）；其他外部一律中止。不用任何真實帳號或金鑰。
// 每條斷言都印樣本數；樣本數 0 一律算 FAIL（空集合不算通過）。
// 「疑似BUG」＝依程式碼行為推得的可疑處，另列，不影響結束碼；FAIL 才讓結束碼≠0。
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const puppeteer = require('C:/Users/c0787/Desktop/App專案/02_其他App/700_學習計畫日曆/node_modules/puppeteer-core');
const HERE = path.dirname(fileURLToPath(import.meta.url));
const APP_DIR = path.resolve(process.argv[2] || path.join(HERE, '..'));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---------- 斷言 ----------
let pass = 0, fail = 0; const suspects = [];
function check(name, cond, n, detail = '') {
  const ok = !!cond && n > 0;
  if (ok) pass++; else fail++;
  console.log(`  ${ok ? 'PASS' : 'FAIL'} ${name}（樣本 ${n}）${n > 0 ? '' : '［樣本 0 不算通過］'}${detail ? ' ' + detail : ''}`);
}
function suspect(name, cond, n, detail = '') {
  const ok = !!cond && n > 0;
  if (ok) { pass++; console.log(`  PASS ${name}（樣本 ${n}）${detail ? ' ' + detail : ''}`); }
  else { suspects.push(name); console.log(`  疑似BUG ${name}（樣本 ${n}）${detail ? ' ' + detail : ''}`); }
}
const stable = (v) => JSON.stringify(v, (k, x) => (x && typeof x === 'object' && !Array.isArray(x)) ? Object.keys(x).sort().reduce((o, kk) => { o[kk] = x[kk]; return o; }, {}) : x);

// ---------- 本機伺服器（埠 0） ----------
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.woff': 'font/woff', '.ico': 'image/x-icon', '.webmanifest': 'application/manifest+json' };
const server = http.createServer((req, res) => {
  let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (p.endsWith('/')) p += 'index.html';
  const f = path.join(APP_DIR, p);
  if (!f.startsWith(APP_DIR) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end('nf'); }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(f).toLowerCase()] || 'application/octet-stream', 'Cache-Control': 'no-store' });
  fs.createReadStream(f).pipe(res);
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const ORIGIN = `http://127.0.0.1:${server.address().port}`;
console.log('App 資料夾：', APP_DIR, '\n伺服器：', ORIGIN);
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'bizcard_data_test_'));

const browser = await puppeteer.launch({
  executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: 'new',
  args: ['--no-sandbox', '--host-resolver-rules=MAP * ~NOTFOUND , EXCLUDE 127.0.0.1'],
});

// ---------- 假 Google Drive ----------
const FAKE_TOKEN = 'TEST-FAKE-TOKEN';
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');
const DRIVE_FILES = [
  { id: 'drv_A', name: 'a.jpg', mimeType: 'image/jpeg' },
  { id: 'drv_B', name: 'b.jpg', mimeType: 'image/jpeg' },
  { id: 'drv_C', name: 'c.png', mimeType: 'image/png' },
  { id: 'drv_P', name: 'x.pdf', mimeType: 'application/pdf' },
];
const CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*', 'Access-Control-Allow-Methods': 'GET,POST,PATCH,DELETE,OPTIONS' };

async function newPage(ctx) {
  const p = await ctx.newPage();
  const st = { external: [], drive: [], errs: [], dialogs: [], dialogMode: 'accept' };
  p._st = st;
  await p.setBypassServiceWorker(true); // SW 不攔請求，所有請求都經過下面的攔截器
  await p.setRequestInterception(true);
  p.on('request', (r) => {
    const u = r.url();
    if (u.startsWith(ORIGIN) || /^(data|blob):/.test(u)) return r.continue();
    if (/^https:\/\/www\.googleapis\.com\/drive\//.test(u)) {
      st.drive.push({ url: u, method: r.method(), auth: (r.headers()['authorization'] || '') });
      if (r.method() === 'OPTIONS') return r.respond({ status: 204, headers: CORS, body: '' });
      const m = u.match(/\/files\/([^/?]+)\?alt=media/);
      if (m) return r.respond({ status: 200, headers: CORS, contentType: 'image/png', body: PNG });
      if (/\/files\?q=/.test(u) && decodeURIComponent(u).includes("'fu' in parents")) return r.respond({ status: 200, headers: CORS, contentType: 'application/json', body: JSON.stringify({ files: DRIVE_FILES }) });
      return r.respond({ status: 200, headers: CORS, contentType: 'application/json', body: JSON.stringify({ files: [] }) });
    }
    st.external.push(u); return r.abort();
  });
  p.on('pageerror', (e) => st.errs.push(String(e).slice(0, 200)));
  p.on('dialog', async (d) => { st.dialogs.push({ type: d.type(), msg: d.message() }); if (d.type() === 'confirm' && st.dialogMode === 'dismiss') await d.dismiss(); else await d.accept(); });
  await p.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
  return p;
}
async function ready(p) {
  await p.waitForFunction(() => typeof db !== 'undefined' && db && typeof cardsList !== 'undefined' && document.readyState === 'complete', { timeout: 20000, polling: 100 });
  await sleep(700);
}
async function gotoApp(p) { await p.goto(ORIGIN + '/', { waitUntil: 'networkidle0' }); await ready(p); }
async function reloadApp(p) { await p.reload({ waitUntil: 'networkidle0' }); await ready(p); }
const clickText = (p, re, scope = 'body') => p.evaluate((src, sc) => {
  const rx = new RegExp(src);
  const b = [...document.querySelector(sc).querySelectorAll('button, fluent-button')].find((x) => x.offsetParent !== null && rx.test(x.textContent));
  if (!b) return false; b.click(); return true;
}, re.source, scope);
async function waitUntil(fn, ms = 10000) { const t0 = Date.now(); while (Date.now() - t0 < ms) { if (await fn()) return true; await sleep(150); } return false; }

// 讀原始資料（不經 App 的 sanitize）：BizCardDB cards/images、CrmDB crm/manual_cards/cards_snapshot、localStorage
const rawState = (p) => p.evaluate(async () => {
  const names = (await indexedDB.databases()).map((d) => d.name);
  const all = (dbName, store) => new Promise((res) => {
    if (!names.includes(dbName)) return res([]);
    const q = indexedDB.open(dbName);
    q.onsuccess = (e) => { const d = e.target.result; if (!d.objectStoreNames.contains(store)) { d.close(); return res([]); }
      const g = d.transaction([store], 'readonly').objectStore(store).getAll(); g.onsuccess = () => { d.close(); res(g.result || []); }; g.onerror = () => { d.close(); res([]); }; };
    q.onerror = () => res([]);
  });
  const ls = (k) => { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return localStorage.getItem(k); } };
  return { cards: await all('BizCardDB', 'cards'), images: await all('BizCardDB', 'images'), queue: (await all('BizCardDB', 'scan_queue')).map((q) => ({ id: q.id, driveId: q.driveId, status: q.status })),
    crm: await all('CrmDB', 'crm'), manual: await all('CrmDB', 'manual_cards'), snap: await all('CrmDB', 'cards_snapshot'),
    groups: ls('bizcard_custom_groups'), tags: ls('bizcard_custom_tags'), myCard: ls('bizcard_user_mycard') };
});
const byId = (arr, key = 'id') => Object.fromEntries(arr.map((x) => [x[key], x]));

// 透過「手動新增」表單輸入一張名片
const FORM_FIELDS = ['name', 'title', 'org', 'dept', 'phone', 'phoneExt', 'mobile', 'fax', 'email', 'website', 'zip', 'addr', 'note'];
async function addViaForm(p, card) {
  await p.evaluate(() => openFormModal()); await sleep(300);
  for (const f of FORM_FIELDS) if (card[f]) await p.type('#f-' + f, card[f]);
  const ok = await clickText(p, /儲存名片/, '#form-modal-bg'); await sleep(700);
  return ok;
}
async function setField(p, f, v) { await p.$eval('#f-' + f, (el) => { el.value = ''; }); if (v) await p.type('#f-' + f, v); }
async function openCrmFrame(p, minCount = 1) {
  await p.click('#btab-crm');
  let fr = null;
  await waitUntil(async () => { fr = p.frames().find((f) => /crm\.html/.test(f.url())); if (!fr) return false;
    try { return await fr.evaluate((n) => typeof mergedCache !== 'undefined' && typeof crmDb !== 'undefined' && crmDb && mergedCache.length >= n, minCount); } catch (e) { return false; } }, 12000);
  await sleep(300);
  return fr;
}

const SAMPLES = [
  { name: '王小明', title: '業務經理', org: '青山顧問股份有限公司', dept: '業務部', phone: '02-2345-6789', phoneExt: '123', mobile: '0912-345-678', email: 'ming.wang@example.com', website: 'https://example.com', zip: '100', addr: '臺北市中正區重慶南路一段 100 號', note: '下週三拜訪，帶型錄' },
  { name: '陳美玲', title: '採購主任', org: '台灣綠能科技', mobile: '0988 111 222', email: 'meiling@example.tw', note: '備註含 "引號" & <角括號> 與 \'單引號\'' },
  { name: '林志豪', title: '工程師', org: '星辰資訊', phone: '(04)2222-3333', mobile: '+886 933 444 555', email: 'Zhihao.Lin@Example.COM', addr: '臺中市西屯區', note: '' },
];

// =====================================================================
console.log('\n1 新增／重新整理／編輯／刪除（手機 390，手動輸入表單）');
const ctx1 = await browser.createBrowserContext();
const p1 = await newPage(ctx1);
await gotoApp(p1);
let okClicks = 0;
for (const s of SAMPLES) if (await addViaForm(p1, s)) okClicks++;
check('三張名片都按得到「儲存名片」', okClicks === 3, SAMPLES.length, `按到 ${okClicks}`);
await reloadApp(p1);
let st = await rawState(p1);
const idOf = (name, cards) => (cards.find((c) => c.name === name) || {}).id;
const ids = { A: idOf('王小明', st.cards), B: idOf('陳美玲', st.cards), C: idOf('林志豪', st.cards) };
check('重新整理後資料庫有 3 張', st.cards.length === 3, st.cards.length);
{
  let cmp = 0, bad = [];
  for (const s of SAMPLES) { const c = st.cards.find((x) => x.name === s.name); for (const f of FORM_FIELDS) { cmp++; if (!c || (c[f] || '') !== (s[f] || '')) bad.push(`${s.name}.${f}=${c ? JSON.stringify(c[f]) : '無此卡'}`); } }
  check('重新整理後每個欄位與輸入一致（中文姓名／公司／電話／Email／備註…）', bad.length === 0, cmp, bad.slice(0, 4).join('；'));
}
check('每張都有 card_ 開頭的唯一 id', new Set(Object.values(ids).filter((x) => /^card_/.test(x || ''))).size === 3, 3, JSON.stringify(ids));
await p1.evaluate(() => switchTab('cards')); await sleep(400);
{
  const rows = await p1.evaluate(() => [...document.querySelectorAll('#card-grid .biz-card-row')].map((r) => r.textContent));
  check('名片列表顯示 3 張且姓名都在', rows.length === 3 && SAMPLES.every((s) => rows.some((r) => r.includes(s.name))), rows.length);
}
// 給 A 一張照片，之後確認編輯不會弄掉照片
await p1.evaluate((id) => new Promise((r) => { const t = db.transaction(['images'], 'readwrite'); t.objectStore('images').put({ id, image: 'data:image/png;base64,TESTIMG' }); t.oncomplete = r; }), ids.A);
const before = byId(st.cards);
// 編輯 B：改公司與備註
await p1.evaluate((id) => editCard(id), ids.B); await sleep(300);
const prefill = await p1.evaluate(() => ({ name: document.getElementById('f-name').value, org: document.getElementById('f-org').value, note: document.getElementById('f-note').value }));
check('編輯表單帶入原值', prefill.name === '陳美玲' && prefill.org === '台灣綠能科技' && prefill.note === SAMPLES[1].note, 3, JSON.stringify(prefill));
await setField(p1, 'org', '台灣綠能科技（新竹分公司）'); await setField(p1, 'note', '改過的備註：10/30 回覆報價');
check('按得到「儲存名片」（編輯）', await clickText(p1, /儲存名片/, '#form-modal-bg'), 1); await sleep(700);
// 編輯 A（只改職稱），有照片
await p1.evaluate((id) => editCard(id), ids.A); await sleep(300);
await setField(p1, 'title', '資深業務經理'); await clickText(p1, /儲存名片/, '#form-modal-bg'); await sleep(700);
await reloadApp(p1);
st = await rawState(p1);
{
  const m = byId(st.cards);
  const b = m[ids.B], a = m[ids.A];
  check('編輯後重新整理：張數不變（3）、id 不變', st.cards.length === 3 && !!b && !!a, st.cards.length);
  check('編輯後重新整理：B 公司與備註是新值', b && b.org === '台灣綠能科技（新竹分公司）' && b.note === '改過的備註：10/30 回覆報價', 2, b ? `${b.org}｜${b.note}` : '');
  const keep = ['name', 'title', 'mobile', 'email', 'createdAtTs', 'createdAt', 'group'];
  const diffs = keep.filter((f) => stable(b && b[f]) !== stable(before[ids.B][f]));
  check('編輯後重新整理：B 其他欄位與建立時間沒變', diffs.length === 0, keep.length, diffs.join(','));
  check('編輯後：A 職稱更新、其他欄位不變', a && a.title === '資深業務經理' && FORM_FIELDS.filter((f) => f !== 'title').every((f) => (a[f] || '') === (before[ids.A][f] || '')), FORM_FIELDS.length);
  check('編輯 A 沒有弄掉 A 的照片', st.images.some((i) => i.id === ids.A && i.image === 'data:image/png;base64,TESTIMG'), st.images.length);
  check('C 完全沒被動到', stable(m[ids.C]) === stable(before[ids.C]), 1);
}
// 編輯時表單沒有的欄位（Google 通訊錄連結、LINE ID）會不會掉
await p1.evaluate(() => new Promise((r) => { const t = db.transaction(['cards'], 'readwrite');
  t.objectStore('cards').put({ id: 'card_seedD', name: '趙先生', org: '甲公司', mobile: '0911-000-000', googleContactId: 'people/c_TEST', lineId: 'zhao_line', processed: true, group: '其他', tags: [], createdAt: '2026/10/1', createdAtTs: 1000, theme: 'indigo' }); t.oncomplete = r; }));
await reloadApp(p1);
await p1.evaluate(() => editCard('card_seedD')); await sleep(300);
await setField(p1, 'title', '協理'); await clickText(p1, /儲存名片/, '#form-modal-bg'); await sleep(700);
await reloadApp(p1);
st = await rawState(p1);
{
  const d = byId(st.cards).card_seedD || {};
  check('編輯 D 後職稱已存', d.title === '協理', 1);
  suspect('編輯名片後保留 googleContactId（Google 通訊錄連結）', d.googleContactId === 'people/c_TEST', 1, `編輯後=${JSON.stringify(d.googleContactId)}`);
  suspect('編輯名片後保留 lineId（表單沒有此欄）', d.lineId === 'zhao_line', 1, `編輯後=${JSON.stringify(d.lineId)}`);
}
// 刪除：先按取消、再按確定
const beforeDel = byId(st.cards);
p1._st.dialogMode = 'dismiss';
await p1.evaluate((id) => deleteCard(id), ids.B); await sleep(400);
p1._st.dialogMode = 'accept';
await reloadApp(p1);
st = await rawState(p1);
check('刪除按「取消」：重新整理後仍 4 張、B 還在', st.cards.length === 4 && st.cards.some((c) => c.id === ids.B), st.cards.length);
await p1.evaluate((id) => deleteCard(id), ids.B); await sleep(500);
await reloadApp(p1);
st = await rawState(p1);
{
  const m = byId(st.cards);
  check('刪除 B 後重新整理：剩 3 張、B 不在', st.cards.length === 3 && !m[ids.B], st.cards.length);
  const others = [ids.A, ids.C, 'card_seedD'];
  check('刪除 B 沒有誤刪／改到別張（逐欄位比對）', others.every((id) => stable(m[id]) === stable(beforeDel[id])), others.length);
  check('A 的照片仍在（刪 B 不影響別張照片）', st.images.some((i) => i.id === ids.A), st.images.length);
}

// =====================================================================
console.log('\n2 客戶追蹤（crm.html iframe）與名片的關聯');
let fr = await openCrmFrame(p1, 3);
check('CRM iframe 讀到全部名片當客戶', !!fr && (await fr.evaluate(() => mergedCache.length)) === 3, fr ? await fr.evaluate(() => mergedCache.length) : 0);
const remindDate = await fr.evaluate(async (a, c) => {
  openDetail(a); openLogSheet(); pickLogNote('已聯絡上'); await saveLog();
  await new Promise((r) => { getCrm(a).then(() => r()); });
  openRemindSheet(); await new Promise((r) => setTimeout(r, 300)); setRemindIn(7); pickRemindReason('追報價'); const d = document.getElementById('remindDate').value; await saveRemind();
  openDetail(c); openLogSheet(); showLogCustom(); document.getElementById('logText').value = '中文紀錄：報價 NT$12,000，下月回覆'; pickType('visit'); await saveLog();
  document.getElementById('nc-name').value = '黃手動'; document.getElementById('nc-org').value = '手動建立社'; document.getElementById('nc-mobile').value = '0900-123-456'; await saveNewCustomer();
  closeDetail();
  return d;
}, ids.A, ids.C);
await reloadApp(p1);
fr = await openCrmFrame(p1, 4);
st = await rawState(p1);
{
  const crm = byId(st.crm, 'cardId');
  const a = crm[ids.A], c = crm[ids.C];
  check('重開後 A 的互動紀錄還在、cardId＝名片 id', a && a.logs.length === 1 && a.logs[0].text === '已聯絡上' && a.logs[0].type === 'phone', st.crm.length);
  check('重開後 A 的提醒日期與事由還在', a && a.nextRemind === remindDate && a.remindNote === '追報價', 1, `${a && a.nextRemind}／${remindDate}`);
  check('重開後 C 的自訂中文紀錄還在', c && c.logs.length === 1 && c.logs[0].text === '中文紀錄：報價 NT$12,000，下月回覆' && c.logs[0].type === 'visit', 1);
  check('每筆 CRM 紀錄的 cardId 都對得到一張名片', st.crm.length > 0 && st.crm.every((r) => st.cards.some((x) => x.id === r.cardId)), st.crm.length);
  check('手動客戶存在 CRM 自己的 manual_cards，沒寫進名片庫', st.manual.length === 1 && st.manual[0].name === '黃手動' && !st.cards.some((x) => x.name === '黃手動') && st.cards.length === 3, st.manual.length);
  const v = await fr.evaluate((a) => { const m = mergedCache.find((x) => x.card.id === a); return { name: m && m.card.name, logs: m && m.crm && m.crm.logs.length, list: document.getElementById('list').innerText }; }, ids.A);
  check('CRM 畫面上 A＝王小明、帶 1 筆紀錄', v.name === '王小明' && v.logs === 1 && /王小明/.test(v.list) && /黃手動/.test(v.list), 1);
}
// 主頁改 A 的公司 → CRM 仍對得上（靠 id）
await p1.click('#btab-cards').catch(() => {}); await p1.evaluate(() => switchTab('cards')); await sleep(300);
await p1.evaluate((id) => editCard(id), ids.A); await sleep(300);
await setField(p1, 'org', '青山顧問（改名）'); await clickText(p1, /儲存名片/, '#form-modal-bg'); await sleep(700);
fr = await openCrmFrame(p1, 4); await sleep(800);
{
  const v = await fr.evaluate((a) => { const m = mergedCache.find((x) => x.card.id === a); return { org: m && m.card.org, logs: m && m.crm && m.crm.logs.length }; }, ids.A);
  check('主頁改公司後，CRM 同一位客戶顯示新公司且紀錄仍在', v.org === '青山顧問（改名）' && v.logs === 1, 1, JSON.stringify(v));
}
// 主頁刪 C → CRM 保留歷史、標「名片已刪」
await p1.evaluate(() => switchTab('cards')); await sleep(300);
await p1.evaluate((id) => deleteCard(id), ids.C); await sleep(500);
await reloadApp(p1);
fr = await openCrmFrame(p1, 3);
{
  const v = await fr.evaluate((c, a) => { const mc = mergedCache.find((x) => x.card.id === c), ma = mergedCache.find((x) => x.card.id === a);
    return { cDel: mc && mc.card._deletedCard, cLogs: mc && mc.crm && mc.crm.logs.length, aLogs: ma && ma.crm && ma.crm.logs.length, list: document.getElementById('list').innerText }; }, ids.C, ids.A);
  check('刪名片後 CRM 仍顯示該客戶、標「名片已刪」、紀錄保留', v.cDel === true && v.cLogs === 1 && /名片已刪/.test(v.list), 1, JSON.stringify({ cDel: v.cDel, cLogs: v.cLogs }));
  check('刪 C 不影響 A 的 CRM 紀錄', v.aLogs === 1, 1);
}

// =====================================================================
console.log('\n3 完整備份：匯出→清空→匯入，以及格式錯誤的檔');
await p1.evaluate(() => { localStorage.setItem('bizcard_custom_groups', JSON.stringify(['學校委員', '企業客戶', '其他', '展會名單']));
  localStorage.setItem('bizcard_custom_tags', JSON.stringify(['重要', 'VIP測試']));
  localStorage.setItem('bizcard_user_mycard', JSON.stringify({ name: '測試本人', org: '稜線測試', mobile: '0900-000-000', theme: 'indigo' })); });
await reloadApp(p1);
const snapBefore = await rawState(p1);
const exported = await p1.evaluate(async () => {
  const blobs = []; const o = URL.createObjectURL; URL.createObjectURL = (b) => { blobs.push(b); return o.call(URL, b); };
  await exportFullJsonBackup(); URL.createObjectURL = o;
  return blobs.length ? await blobs[blobs.length - 1].text() : null;
});
let bk = null; try { bk = JSON.parse(exported); } catch (e) {}
check('匯出得到 JSON（_format=bizcard-backup）', bk && bk._format === 'bizcard-backup', bk ? 1 : 0);
check('匯出含全部名片＋照片', bk && bk.cards.length === snapBefore.cards.length && bk.cards.some((x) => x.card.id === ids.A && x.image === 'data:image/png;base64,TESTIMG'), bk ? bk.cards.length : 0);
check('匯出含客戶追蹤（crm＋手動客戶）', bk && bk.crm && bk.crm.crm.length === snapBefore.crm.length && bk.crm.manual_cards.length === 1, bk && bk.crm ? bk.crm.crm.length : 0);
const bkPath = path.join(TMP, 'backup.json'); fs.writeFileSync(bkPath, exported || '');
// 清空：換到同源的另一頁，刪掉三個資料庫與 localStorage
await p1.goto(ORIGIN + '/privacy.html', { waitUntil: 'networkidle0' });
await p1.evaluate(async () => { for (const n of ['BizCardDB', 'CrmDB', 'DealDB']) await new Promise((r) => { const q = indexedDB.deleteDatabase(n); q.onsuccess = q.onerror = q.onblocked = () => r(); }); localStorage.clear(); });
await gotoApp(p1);
st = await rawState(p1);
check('清空後名片 0、CRM 0', st.cards.length === 0 && st.crm.length === 0 && st.manual.length === 0, snapBefore.cards.length, `清空前 ${snapBefore.cards.length} 張／CRM ${snapBefore.crm.length} 筆`);
await (await p1.$('#import-backup-file')).uploadFile(bkPath);
await waitUntil(() => p1.evaluate((n) => cardsList.length === n, snapBefore.cards.length), 10000); await sleep(800);
st = await rawState(p1);
check('匯入後名片逐欄位完全還原', stable(byId(st.cards)) === stable(byId(snapBefore.cards)), snapBefore.cards.length);
check('匯入後照片還原', stable(byId(st.images)) === stable(byId(snapBefore.images)), snapBefore.images.length);
check('匯入後客戶追蹤紀錄（logs／提醒）還原', stable(byId(st.crm, 'cardId')) === stable(byId(snapBefore.crm, 'cardId')), snapBefore.crm.length);
check('匯入後手動客戶還原', stable(byId(st.manual)) === stable(byId(snapBefore.manual)), snapBefore.manual.length);
check('匯入後自訂群組／標籤／個人名片還原', stable([st.groups, st.tags, st.myCard]) === stable([snapBefore.groups, snapBefore.tags, snapBefore.myCard]), 3, JSON.stringify(st.tags));
fr = await openCrmFrame(p1, 2);
{
  const v = await fr.evaluate((c) => ({ list: document.getElementById('list').innerText, hasC: mergedCache.some((x) => x.card.id === c) }), ids.C);
  check('匯入後 CRM 畫面看得到王小明與手動客戶', /王小明/.test(v.list) && /黃手動/.test(v.list), 2);
  suspect('還原後「名片已刪但有紀錄」的客戶（林志豪）仍出現在 CRM', v.hasC, 1, `CRM 有紀錄 ${snapBefore.crm.length} 筆，畫面有林志豪=${v.hasC}`);
}
// 同一份再匯入一次：不應變多
await p1.evaluate(() => switchTab('myprofile')); await sleep(300);
await (await p1.$('#import-backup-file')).uploadFile(bkPath); await sleep(2000);
st = await rawState(p1);
check('同一份備份匯入兩次不會變多（id 相同覆蓋）', st.cards.length === snapBefore.cards.length && st.crm.length === snapBefore.crm.length, st.cards.length);
// 格式錯誤的檔
const goodState = stable(await rawState(p1));
const BAD = [['not_json.json', '這不是 JSON {'], ['empty.json', ''], ['null.json', 'null'], ['no_cards.json', '{"foo":1}'], ['cards_string.json', '{"cards":"abc"}'],
  ['cards_garbage.json', '{"cards":[{"nope":1},{"card":{"name":"沒有id"}}]}'], ['number.json', '12345']];
let badOk = 0; const badDetail = [];
for (const [fn, body] of BAD) {
  const fp = path.join(TMP, fn); fs.writeFileSync(fp, body);
  const nd = p1._st.dialogs.length;
  await (await p1.$('#import-backup-file')).uploadFile(fp); await sleep(1200);
  const now = stable(await rawState(p1));
  const msgs = p1._st.dialogs.slice(nd).map((d) => d.msg.slice(0, 20));
  if (now === goodState) badOk++; else badDetail.push(fn);
  badDetail.push(`${fn}:${msgs.join('/') || '無提示'}`);
}
check('匯入格式錯誤的檔：名片／照片／CRM／設定全都不變', badOk === BAD.length, BAD.length, badDetail.join('；'));
// CRM 分頁自己的匯入：格式錯誤也不能動到資料
fr = await openCrmFrame(p1, 2);
const crmBefore = stable((await rawState(p1)).crm);
const crmBadRes = await fr.evaluate(async () => { const out = [];
  for (const body of ['{"x":1}', 'not json', '{"crm":"oops"}']) { const t0 = document.getElementById('toast').textContent; await importBackup({ target: { files: [new File([body], 'b.json')], value: '' } }); out.push(document.getElementById('toast').textContent); }
  return out; });
check('CRM 分頁匯入格式錯誤：CRM 紀錄不變', stable((await rawState(p1)).crm) === crmBefore, 3, crmBadRes.join('／'));
check('第 1～3 節沒有頁面例外', p1._st.errs.length === 0, 1, p1._st.errs.join(';'));
await ctx1.close();

// =====================================================================
console.log('\n4 重複偵測與合併（規則依程式 normField：去頭尾空白、轉小寫、去掉 - 與空白；姓名或 Email 相同就算同一組）');
const ctx2 = await browser.createBrowserContext();
const p2 = await newPage(ctx2);
await gotoApp(p2);
const C = (id, o) => ({ id: 'card_' + id, processed: true, group: '其他', tags: [], createdAt: '2026/10/1', theme: 'indigo', createdAtTs: 1, ...o });
const DUP = [
  // [案例, 預期 merge|separate|unclear, 卡片們]
  ['m1 英文姓名大小寫不同', 'merge', [C('m1a', { name: 'David Lee', org: 'ACME', title: '經理', createdAtTs: 100 }), C('m1b', { name: 'david lee', org: 'acme', email: 'david@acme.com', tags: ['VIP'], createdAtTs: 200 })]],
  ['m2 中文姓名中間有空白', 'merge', [C('m2a', { name: '張 大 偉', org: '甲公司' }), C('m2b', { name: '張大偉', org: '甲公司' })]],
  ['m3 姓名不同但 Email 大小寫／前後空白不同', 'merge', [C('m3a', { name: '林小芬', email: '  Fen.Lin@ACME.com ', org: 'ACME' }), C('m3b', { name: 'Fen Lin', email: 'fen.lin@acme.com', org: 'ACME' })]],
  ['m4 同名、電話格式不同（0912-… vs +886 …）', 'merge', [C('m4a', { name: '周杰', mobile: '0912-000-111', org: '乙公司' }), C('m4b', { name: '周杰', mobile: '+886 912 000 111', org: '乙公司' })]],
  ['m5 同名不同公司（設計：歸「疑似換工作」）', 'merge', [C('m5a', { name: '何志明', org: '舊公司', createdAtTs: 1 }), C('m5b', { name: '何志明', org: '新公司', createdAtTs: 2 })]],
  ['n1 手機完全相同、姓名 Email 都不同（設計：共用總機不算）', 'separate', [C('n1a', { name: '吳一', mobile: '0933-222-333', email: 'wu1@x.com' }), C('n1b', { name: '吳二', mobile: '0933-222-333', email: 'wu2@x.com' })]],
  ['n2 手機同號不同格式、姓名不同', 'separate', [C('n2a', { name: '甲一', mobile: '0912-000-999' }), C('n2b', { name: '乙二', mobile: '0912 000 999' })]],
  ['n3 同公司不同人', 'separate', [C('n3a', { name: '鄭小華', org: '丙公司', email: 'a@c.com' }), C('n3b', { name: '鄭小英', org: '丙公司', email: 'b@c.com' })]],
  ['u1 全形英文 vs 半形英文（ＫＥＶＩＮ　ＣＨＥＮ vs kevin chen）', 'unclear', [C('u1a', { name: 'ＫＥＶＩＮ　ＣＨＥＮ' }), C('u1b', { name: 'kevin chen' })]],
  ['u2 全形數字 Email（ｊｏｈｎ＠ｘ．ｃｏｍ vs john@x.com）', 'unclear', [C('u2a', { name: '約翰甲', email: 'ｊｏｈｎ＠ｘ．ｃｏｍ' }), C('u2b', { name: '約翰乙', email: 'john@x.com' })]],
  ['u3 繁簡不同（陳建國 vs 陈建国）', 'unclear', [C('u3a', { name: '陳建國' }), C('u3b', { name: '陈建国' })]],
  ['u4 姓名含點號（Mary.Wu vs Mary Wu）', 'unclear', [C('u4a', { name: 'Mary.Wu' }), C('u4b', { name: 'Mary Wu' })]],
];
await p2.evaluate(async (list) => { for (const c of list) await new Promise((r) => { const t = db.transaction(['cards'], 'readwrite'); t.objectStore('cards').put(c); t.oncomplete = r; }); }, DUP.flatMap((d) => d[2]));
await reloadApp(p2);
const groups = await p2.evaluate(() => detectAllDuplicateGroups().map((g) => ({ ids: g.map((c) => c.id), kind: classifyDupGroup(g) })));
const together = (a, b) => groups.some((g) => g.ids.includes(a) && g.ids.includes(b));
{
  const merges = DUP.filter((d) => d[1] === 'merge'), seps = DUP.filter((d) => d[1] === 'separate');
  const mBad = merges.filter((d) => !together(d[2][0].id, d[2][1].id)).map((d) => d[0]);
  check('設計上該歸同一組的有歸在一起', mBad.length === 0, merges.length, mBad.join('；'));
  const sBad = seps.filter((d) => together(d[2][0].id, d[2][1].id)).map((d) => d[0]);
  check('設計上不該合併的沒被歸在一起', sBad.length === 0, seps.length, sBad.join('；'));
  const caseOf = (id) => id.replace(/^card_/, '').slice(0, 2);
  const impure = groups.filter((g) => new Set(g.ids.map(caseOf)).size > 1);
  check('每一組只含同一個案例的卡（沒有跨案例亂併）', impure.length === 0, groups.length, JSON.stringify(impure));
  const kindOf = (id) => (groups.find((g) => g.ids.includes(id)) || {}).kind;
  check('同公司歸「完全重複」、不同公司歸「疑似換工作」', kindOf('card_m1a') === 'duplicate' && kindOf('card_m2a') === 'duplicate' && kindOf('card_m5a') === 'jobchange', 3, `m1=${kindOf('card_m1a')} m5=${kindOf('card_m5a')}`);
  for (const d of DUP.filter((x) => x[1] === 'unclear')) console.log(`  規則不明 ${d[0]} → 實際：${together(d[2][0].id, d[2][1].id) ? '歸同一組' : '不歸同一組'}`);
}
// 合併 m1（以建立時間最新的 m1b 為主體，補 m1a 的職稱、聯集標籤），其他卡不受影響
const beforeMerge = byId((await rawState(p2)).cards);
await p2.evaluate(() => switchTab('dups')); await sleep(300);
const mergeIdx = await p2.evaluate(() => { renderDupsTab(); return (window._dupGroups.dup || []).findIndex((g) => g.some((c) => c.id === 'card_m1a')); });
await p2.evaluate((i) => mergeDupGroup('dup', i), mergeIdx); await sleep(600);
await reloadApp(p2);
st = await rawState(p2);
{
  const m = byId(st.cards);
  check('合併 m1 後剩主體 m1b、m1a 被刪', !!m.card_m1b && !m.card_m1a && st.cards.length === Object.keys(beforeMerge).length - 1, st.cards.length);
  check('合併後主體補齊缺漏欄位（職稱）且保留自己的 Email／標籤', m.card_m1b && m.card_m1b.title === '經理' && m.card_m1b.email === 'david@acme.com' && stable(m.card_m1b.tags) === stable(['VIP']), 3);
  const others = Object.keys(beforeMerge).filter((id) => !/^card_m1/.test(id));
  check('合併 m1 沒有動到其他卡', others.every((id) => stable(m[id]) === stable(beforeMerge[id])), others.length);
}
check('第 4 節沒有頁面例外', p2._st.errs.length === 0, 1, p2._st.errs.join(';'));
await ctx2.close();

// =====================================================================
console.log('\n5 Google Drive 匯入去重（假 Drive、假 token，不連真網路）');
const ctx3 = await browser.createBrowserContext();
const p3 = await newPage(ctx3);
await gotoApp(p3);
// 未登入：按匯入不應發出任何 Drive 請求、佇列不變
const noTok = await p3.evaluate(async () => { const t = setTimeout(() => {}, 0); await Promise.race([importDriveImages(), new Promise((r) => setTimeout(r, 15000))]); return scanQueue.length; });
check('未登入時按「從雲端匯入」：0 個 Drive 請求、佇列 0', p3._st.drive.length === 0 && noTok === 0, 1, `提示：${p3._st.dialogs.map((d) => d.msg.slice(0, 18)).join('/')}`);
// 帳本已有 drv_B
await p3.evaluate(() => localStorage.setItem('bizcard_processed_drive_ids', JSON.stringify(['drv_B'])));
await reloadApp(p3);
const login = (p) => p.evaluate((tok) => { gdriveToken = tok; driveFolderCache = { root: 'fr', unparsed: 'fu', parsed: 'fp', failed: 'ff' }; }, FAKE_TOKEN);
await login(p3);
let nd = p3._st.dialogs.length;
await p3.evaluate(() => importDriveImages()); await sleep(500);
st = await rawState(p3);
{
  const q = st.queue.map((x) => x.driveId).sort();
  check('雲端 4 個檔（3 張圖＋1 PDF），帳本有 drv_B：只匯入 drv_A、drv_C', stable(q) === stable(['drv_A', 'drv_C']), DRIVE_FILES.length, JSON.stringify(q));
  const media = p3._st.drive.filter((d) => d.method !== 'OPTIONS' && /alt=media/.test(d.url)).map((d) => d.url.match(/files\/([^?]+)/)[1]);
  check('帳本裡的 drv_B 與 PDF 根本沒被下載', !media.includes('drv_B') && !media.includes('drv_P') && media.length === 2, media.length, JSON.stringify(media));
  const msg = p3._st.dialogs.slice(nd).map((d) => d.msg).join('\n');
  check('完成提示寫出「略過 1 張先前已辨識過」', /略過 1 張先前已辨識過/.test(msg), 1);
}
await reloadApp(p3); await login(p3);
nd = p3._st.drive.filter((d) => d.method !== 'OPTIONS' && /alt=media/.test(d.url)).length;
await p3.evaluate(() => importDriveImages()); await sleep(500);
st = await rawState(p3);
{
  const q = st.queue.map((x) => x.driveId).sort();
  check('重新整理後再匯入一次：佇列仍是 drv_A、drv_C 各 1 筆，沒有重複', stable(q) === stable(['drv_A', 'drv_C']), q.length, JSON.stringify(q));
  check('第二次匯入沒有再下載任何檔', p3._st.drive.filter((d) => d.method !== 'OPTIONS' && /alt=media/.test(d.url)).length === nd, nd);
}
// 帳本 FIFO 上限 8000
const fifo = await p3.evaluate(() => {
  localStorage.setItem('bizcard_processed_drive_ids', JSON.stringify(Array.from({ length: 8000 }, (_, i) => 'old_' + i)));
  markDriveIdProcessed('old_5'); const same = JSON.parse(localStorage.getItem('bizcard_processed_drive_ids')).length;
  markDriveIdProcessed('new_1'); const arr = JSON.parse(localStorage.getItem('bizcard_processed_drive_ids'));
  markDriveIdProcessed(''); const afterEmpty = JSON.parse(localStorage.getItem('bizcard_processed_drive_ids')).length;
  return { same, len: arr.length, hasNew: arr.includes('new_1'), hasOldest: arr.includes('old_0'), last: arr[arr.length - 1], afterEmpty };
});
check('帳本：已存在的不重複加、滿 8000 時汰掉最舊、空 id 不寫入', fifo.same === 8000 && fifo.len === 8000 && fifo.hasNew && !fifo.hasOldest && fifo.last === 'new_1' && fifo.afterEmpty === 8000, 8000, JSON.stringify(fifo));
const auths = p3._st.drive.filter((d) => d.method !== 'OPTIONS').map((d) => d.auth);
check('所有 Drive 請求都只帶測試假 token、都由測試回應', auths.length > 0 && auths.every((a) => a === 'Bearer ' + FAKE_TOKEN), auths.length);
console.log(`  （被擋下的外部請求 ${[p1, p2, p3].reduce((s, p) => s + p._st.external.length, 0)} 個，例：${[...new Set(p3._st.external.map((u) => new URL(u).host))].slice(0, 4).join(', ') || '無'}）`);
check('第 5 節沒有頁面例外', p3._st.errs.length === 0, 1, p3._st.errs.join(';'));
await ctx3.close();

await browser.close();
await new Promise((r) => server.close(r));
fs.rmSync(TMP, { recursive: true, force: true });
console.log(`\nPASS ${pass} / FAIL ${fail} / 疑似BUG ${suspects.length}${suspects.length ? '：' + suspects.join('；') : ''}`);
process.exit(fail ? 1 : 0);
