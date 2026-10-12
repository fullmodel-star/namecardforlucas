# -*- coding: utf-8 -*-
"""
Tabler Icons 子集化（2026-10-12 體驗評分 B1 減重）

原本首載要下載整份 Tabler 字型 tabler-icons.woff2（865KB，5,718 個圖示），實際只用到約 100 個。
這支工具掃 index.html／crm.html 裡所有 `ti-xxx` class，產出：
  vendor/tabler-icons/tabler-icons.subset.css         （只留用到的圖示規則＋.ti 基本樣式）
  vendor/tabler-icons/fonts/tabler-icons.subset.woff2 （只留用到的字形）
原始檔 tabler-icons.min.css／fonts/tabler-icons.woff2 原封不動保留，作為重產來源。

★ 新增或改用任何 Tabler 圖示（`ti ti-新名字`）後，一定要重跑：
    python -I _tools/subset_tabler.py
  否則新圖示會顯示成空白。腳本找不到對應圖示（拼錯）會直接報錯停止。
需要 fontTools＋brotli：pip install fonttools brotli（可用 --target 裝到暫存資料夾，再設 PYTHONPATH）。
"""
import re
import sys
from pathlib import Path

from fontTools import subset
from fontTools.ttLib import TTFont

ROOT = Path(__file__).resolve().parent.parent
VENDOR = ROOT / "vendor" / "tabler-icons"
SRC_CSS = VENDOR / "tabler-icons.min.css"
SRC_FONT = VENDOR / "fonts" / "tabler-icons.woff2"
OUT_CSS = VENDOR / "tabler-icons.subset.css"
OUT_FONT = VENDOR / "fonts" / "tabler-icons.subset.woff2"
SCAN = [ROOT / "index.html", ROOT / "crm.html"]

css = SRC_CSS.read_text(encoding="utf-8")
rules = dict(re.findall(r'\.(ti-[a-z0-9-]+):before\{content:"\\([0-9a-f]+)"\}', css))
if len(rules) < 5000:
    sys.exit(f"原始 CSS 只解析到 {len(rules)} 條圖示規則，格式可能變了，停止")

used = set()
for f in SCAN:
    if f.exists():
        used |= set(re.findall(r"\bti-[a-z0-9-]+", f.read_text(encoding="utf-8")))
used = sorted(used)
missing = [u for u in used if u not in rules]
if missing:
    sys.exit("以下 class 在 Tabler 3.19.0 找不到對應圖示（拼錯或不是圖示）：" + ", ".join(missing))

# 基本樣式：@font-face 與 .ti{...}（第一條圖示規則之前的全部內容），字型網址改指子集檔
head = css[: css.index(".ti-a-b:before")]
head = re.sub(r"src:url\([^}]*\}", 'src:url("./fonts/tabler-icons.subset.woff2?v3.19.0") format("woff2")}', head, count=1)
if "tabler-icons.subset.woff2" not in head or ".ti{" not in head:
    sys.exit("基本樣式改寫失敗，停止")
body = "".join(f'.{u}:before{{content:"\\{rules[u]}"}}' for u in used)
OUT_CSS.write_text(
    "/* 子集：由 _tools/subset_tabler.py 產生，勿手改（新增圖示後重跑腳本）。原檔＝tabler-icons.min.css */\n" + head + body + "\n",
    encoding="utf-8", newline="\n")

opts = subset.Options()
opts.flavor = "woff2"
opts.layout_features = []
opts.name_IDs = ["*"]
opts.notdef_outline = True
font = TTFont(str(SRC_FONT))
# 原字型的 GSUB（連字表）fontTools 讀不了（長度不對齊），而網頁是用 :before 碼位顯示、不用連字，直接拿掉
for tag in ("GSUB", "GPOS", "GDEF"):
    if tag in font:
        del font[tag]
sub = subset.Subsetter(opts)
sub.populate(unicodes=[int(rules[u], 16) for u in used])
sub.subset(font)
font.flavor = "woff2"
font.save(str(OUT_FONT))

# 讀回驗證：每個用到的碼位都在子集字型的 cmap 裡
chk = TTFont(str(OUT_FONT)).getBestCmap()
lost = [u for u in used if int(rules[u], 16) not in chk]
if lost:
    sys.exit("子集字型缺字形：" + ", ".join(lost))
print(f"圖示 {len(used)} 個；CSS {OUT_CSS.stat().st_size:,} bytes；字型 {OUT_FONT.stat().st_size:,} bytes（原 {SRC_FONT.stat().st_size:,}）")
