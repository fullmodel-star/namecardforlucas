"""下載 Microsoft Fluent Emoji 的 3D 圖（MIT），縮成 128px PNG → vendor/fluent-3d/<key>.png

    python _tools/build_fluent3d.py
    （需要 Pillow：pip install pillow）

2026-10-20 首頁視覺改版「青瓷名片匣」建立（以 605 為範本）：首屏主視覺、名片庫統計格、洞察入口用 3D 立體圖。
- 來源：https://github.com/microsoft/fluentui-emoji （MIT，全文寫到 vendor/fluent-3d/LICENSE.txt）。
- 顯示最大 64px，存 128px 給高解析螢幕；原圖 256px 約 30–45KB，縮完約一半。
- 下載後檢查是 PNG 檔頭（不是錯誤頁），不合格就停。
"""
import io
import sys
import urllib.parse
import urllib.request
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "vendor" / "fluent-3d"
BASE = "https://raw.githubusercontent.com/microsoft/fluentui-emoji/main"
SIZE = 128

# key → Fluent 資料夾名（大小寫要完全一樣，例 Globe showing europe-africa；檔名＝資料夾名小寫、空白換底線＋_3d.png）
ICONS = {
    # 首屏主視覺
    "cardindex": "Card index", "camera": "Camera with flash",
    # 統計格／入口
    "filebox": "Card file box", "hourglass": "Hourglass not done", "idcard": "Identification card",
    # CRM（客戶）
    "handshake": "Handshake",
}


def fetch(url: str) -> bytes:
    req = urllib.request.Request(url, headers={"User-Agent": "curl/8"})
    with urllib.request.urlopen(req, timeout=30) as r:
        return r.read()


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    for key, folder in ICONS.items():
        fname = folder.lower().replace(" ", "_") + "_3d.png"
        url = f"{BASE}/assets/{urllib.parse.quote(folder)}/3D/{urllib.parse.quote(fname)}"
        raw = fetch(url)
        if not raw.startswith(b"\x89PNG"):
            print(f"[FAIL] {key}：{url} 不是 PNG"); sys.exit(1)
        im = Image.open(io.BytesIO(raw)).convert("RGBA")
        im = im.resize((SIZE, SIZE), Image.LANCZOS)
        dst = OUT / f"{key}.png"
        im.save(dst, optimize=True)
        print(f"OK {key:10s} {dst.stat().st_size // 1024} KB  ← {folder}")
    (OUT / "LICENSE.txt").write_bytes(fetch(f"{BASE}/LICENSE"))
    print("OK LICENSE.txt")


if __name__ == "__main__":
    main()
