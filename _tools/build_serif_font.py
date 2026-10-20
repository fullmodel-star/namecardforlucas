"""把 Noto Serif TC（思源宋體）裁成「只含本 App 介面文字」的粗體小字型 → vendor/serif-ui/bc-serif.woff2

    python _tools/build_serif_font.py [NotoSerifTC-VF.ttf 的路徑，預設 C:/Windows/Fonts/NotoSerifTC-VF.ttf]
    （需要 fonttools＋brotli：pip install fonttools brotli）

2026-10-20 首頁視覺改版「青瓷名片匣」建立（以 601 的同名腳本為範本）；收字範圍＝index.html＋crm.html（CRM 在 iframe 裡，標題同一套字型）。
- 來源：Noto Serif TC 2.002（Adobe／Google，SIL OFL-1.1，全文在 vendor/serif-ui/LICENSE.txt）。
  2026-10-19 讀過 name 表：版權欄 nameID 0 沒有宣告 Reserved Font Name；仍照 OFL 對「修改版」的慣例改名，
  字型內部名稱改成「BC Serif」、CSS 用 font-family BCSerif；版權（0）、商標（7）、授權（13、14）原樣保留。
- 只取一個字重：可變字型先固定在 wght=700 再裁子集（多字重會讓檔案變好幾倍）。
- 收字範圍：index.html 全部中文字＋全形標點＋英文字母與標點。**不收阿拉伯數字**：
  這個字型的數字是比例寬，金額要用等寬數字，所以 CSS 的 unicode-range 也排除 0–9，數字一律走系統字＋tabular-nums。
- **改介面文字後要重跑**（缺的字會退回系統字，不會變豆腐，但字型會混）。
"""
import io
import re
import sys
from pathlib import Path

from fontTools import subset
from fontTools.ttLib import TTFont
from fontTools.varLib import instancer

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "vendor" / "serif-ui" / "bc-serif.woff2"
SRC = Path(sys.argv[1]) if len(sys.argv) > 1 else Path("C:/Windows/Fonts/NotoSerifTC-VF.ttf")
FAMILY = "BC Serif"
PS = "BCSerif-Bold"
RESERVED = re.compile(r"noto", re.I)
NAME_FIELDS = {1, 3, 4, 6, 16, 17, 18, 20, 21, 22, 25}


def wanted(ch: str) -> bool:
    cp = ord(ch)
    return (0x3000 <= cp <= 0x303F or 0x3400 <= cp <= 0x9FFF or 0xFF01 <= cp <= 0xFFEF
            or 0x2010 <= cp <= 0x2027) and not (0xFF10 <= cp <= 0xFF19)


def chars_needed() -> str:
    keep = {chr(c) for c in range(0x20, 0x7F) if not chr(c).isdigit()}
    for name in ("index.html", "crm.html"):
        html = (ROOT / name).read_text(encoding="utf-8-sig")
        html = html[: html.find("<!--RIDGELINE_BIZ_FOOT-->")] if "<!--RIDGELINE_BIZ_FOOT-->" in html else html  # 頁尾是家族區塊，字型照舊
        keep |= {ch for ch in html if wanted(ch)}
    return "".join(sorted(keep))


def main() -> None:
    text = chars_needed()
    base = TTFont(str(SRC))
    if "fvar" in base:
        base = instancer.instantiateVariableFont(base, {"wght": 700})
    buf = io.BytesIO(); base.save(buf)
    font = TTFont(io.BytesIO(buf.getvalue()))
    opts = subset.Options()
    opts.flavor = "woff2"
    opts.layout_features = ["*"]
    opts.name_IDs = ["*"]
    opts.notdef_outline = True
    sub = subset.Subsetter(options=opts)
    sub.populate(text=text)
    sub.subset(font)
    name = font["name"]
    for rec in list(name.names):
        if rec.nameID in (1, 16, 21):
            rec.string = FAMILY
        elif rec.nameID in (2, 17, 22):
            rec.string = "Bold"
        elif rec.nameID == 4:
            rec.string = FAMILY + " Bold"
        elif rec.nameID in (6, 20):
            rec.string = PS
        elif rec.nameID == 3:
            rec.string = PS + ";subset-100"
        elif rec.nameID == 25:
            rec.string = "BCSerif"
    left = [(r.nameID, r.toUnicode()) for r in name.names
            if r.nameID in NAME_FIELDS and RESERVED.search(r.toUnicode())]
    if left:
        print("[FAIL] name 表仍含原字型名稱：", left[:5]); sys.exit(1)
    OUT.parent.mkdir(parents=True, exist_ok=True)
    font.flavor = "woff2"
    font.save(OUT)
    cjk = sum(1 for c in text if ord(c) > 0x7F)
    print(f"[OK] {OUT.relative_to(ROOT)}：{OUT.stat().st_size / 1024:.0f} KB，收 {cjk} 個非 ASCII 字＋ASCII（不含數字）")


if __name__ == "__main__":
    main()
