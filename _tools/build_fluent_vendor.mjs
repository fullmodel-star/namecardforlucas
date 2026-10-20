/**
 * 重產 vendor/fluent-ui/（Fluent UI Web Components 只打包用到的 <fluent-button>，離線自帶，不走 CDN）
 *
 *   node _tools/build_fluent_vendor.mjs
 *
 * 2026-10-20 首頁視覺改版建立（外部免費資源清單「二之一」：商務工具類預設 Fluent UI Web Components）。
 * 做的事：在系統暫存資料夾 npm 安裝指定版本 → esbuild 把 button 定義＋全域主題（webLightTheme 的 CSS 變數）
 * 打成一支 IIFE → 寫授權檔。App 再用 CSS 把品牌色變數（--colorBrandBackground 等）蓋成自己的主題色。
 * - 套件：@fluentui/web-components 3.1.3（MIT，Microsoft）＋ @microsoft/fast-element（MIT）
 *   ＋ @fluentui/tokens（MIT）＋ tslib（0BSD）。2026-10-20 npm 核過授權與維護（最後更新 2026-08）。
 * - 產物沒有任何對外網址（腳本最後會檢查）。
 * - 沒載入（舊瀏覽器、檔案壞掉）時 <fluent-button> 只是普通元素：App 的 .btn 樣式照樣套上、onclick 照樣能按。
 * ⚠ 升版或加元件後要：升 sw.js 版號、跑測試、確認沒有對外請求。
 */
import { execSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const FLUENT_VERSION = '3.1.3';
const ESBUILD_VERSION = '0.24';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'vendor', 'fluent-ui');
const tmp = mkdtempSync(path.join(tmpdir(), 'fluent-vendor-'));
const run = (cmd) => execSync(cmd, { cwd: tmp, stdio: 'inherit' });

writeFileSync(path.join(tmp, 'package.json'), '{"name":"fluent-vendor","private":true}');
run(`npm i @fluentui/web-components@${FLUENT_VERSION} esbuild@${ESBUILD_VERSION} --silent --no-audit --no-fund --prefix .`);
writeFileSync(path.join(tmp, 'entry.js'), [
  "import '@fluentui/web-components/button.js';",
  "import { setTheme } from '@fluentui/web-components/theme/set-theme.js';",
  "import { webLightTheme } from '@fluentui/tokens';",
  'setTheme(webLightTheme);',
  '',
].join('\n'));
mkdirSync(OUT, { recursive: true });
const outJs = path.join(OUT, 'fluent-button.min.js');
const esb = path.join(tmp, 'node_modules', '.bin', 'esbuild');
run(`"${esb}" entry.js --bundle --minify --format=iife --legal-comments=eof --outfile="${outJs}"`);

const js = readFileSync(outJs, 'utf8');
const urls = js.match(/https?:\/\/[^\s"'`)]+/g) || [];
if (urls.length) { console.error('[FAIL] 產物含對外網址：', urls.slice(0, 5)); process.exit(1); }

const ver = (p) => JSON.parse(readFileSync(path.join(tmp, 'node_modules', p, 'package.json'), 'utf8')).version;
const mit = readFileSync(path.join(tmp, 'node_modules', '@fluentui', 'tokens', 'LICENSE'), 'utf8');
const tslib = readFileSync(path.join(tmp, 'node_modules', 'tslib', 'LICENSE.txt'), 'utf8');
writeFileSync(path.join(OUT, 'LICENSE.txt'), [
  'vendor/fluent-ui/fluent-button.min.js 由下列套件打包（只含 <fluent-button> 與全域主題變數）：',
  `- @fluentui/web-components ${FLUENT_VERSION}（MIT，Copyright (c) Microsoft Corporation）`,
  `- @microsoft/fast-element ${ver('@microsoft/fast-element')}（MIT，Copyright (c) Microsoft Corporation）`,
  `- @fluentui/tokens ${ver('@fluentui/tokens')}（MIT，Copyright (c) Microsoft Corporation）`,
  `- tslib ${ver('tslib')}（0BSD，Copyright (c) Microsoft Corporation）`,
  '',
  '==== MIT License（@fluentui/web-components、@microsoft/fast-element、@fluentui/tokens 同一份條款）====',
  mit.replace('@fluentui/tokens', 'Fluent UI').trim(),
  '',
  '==== tslib（0BSD）====',
  tslib.trim(),
  '',
].join('\n'));
rmSync(tmp, { recursive: true, force: true });
console.log(`OK vendor/fluent-ui 已重產（@fluentui/web-components ${FLUENT_VERSION}：fluent-button，${(js.length / 1024).toFixed(1)} KB）`);
