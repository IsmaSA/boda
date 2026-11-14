"""
Generates favicon.svg, favicon-32.png, apple-touch-icon.png and og.png
(the social-sharing preview). Run after changing names or artwork:
    python3 scripts/make_icons.py      (needs: pip install playwright && playwright install chromium)
"""
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parent.parent
IMG = ROOT / "site/assets/img"
FONTS = ROOT / "site/assets/fonts"

# Holm oak on deep olive: reads at 16 px, ties to the hero illustration.
FAVICON = """<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <rect width="64" height="64" rx="12" fill="#262a21"/>
  <g fill="#e2d2ac">
    <path d="M29.5 50 L30.6 38 L33.4 38 L34.5 50 Z"/>
    <circle cx="20" cy="34" r="8"/><circle cx="26" cy="27" r="10"/><circle cx="34" cy="24" r="11"/>
    <circle cx="42" cy="28" r="9.5"/><circle cx="46" cy="34" r="7.5"/>
    <ellipse cx="33" cy="36" rx="17" ry="5"/>
  </g>
  <rect x="12" y="49" width="40" height="2" rx="1" fill="#8e9c82"/>
</svg>"""

OG = f"""<!doctype html><html><head><style>
@font-face {{ font-family: F; src: url('{(FONTS / "fraunces-var.woff2").as_uri()}'); font-weight: 100 900; }}
@font-face {{ font-family: A; src: url('{(FONTS / "fraunces-amp-italic.woff2").as_uri()}'); font-style: italic; }}
@font-face {{ font-family: S; src: url('{(FONTS / "instrument-sans-var.woff2").as_uri()}'); font-weight: 400 700; }}
html,body {{ margin:0; width:1200px; height:630px; background:#f4eee2; overflow:hidden; }}
img {{ position:absolute; left:0; bottom:0; width:1200px; height:430px; object-fit:cover; object-position:50% 100%; }}
.t {{ position:absolute; left:80px; top:70px; color:#262a21; }}
h1 {{ margin:0; font:300 150px/0.9 F; font-variation-settings:'opsz' 144,'SOFT' 100; letter-spacing:-0.035em; }}
h1 span {{ font-family:A; font-style:italic; color:#a4844c; font-size:.86em; margin:0 .08em; }}
p {{ margin:22px 0 0; font:400 34px/1.2 F; font-variation-settings:'opsz' 36,'SOFT' 100; }}
</style></head><body>
<img src="{(IMG / "dehesa.svg").as_uri()}">
<div class="t"><h1>Isma <span>&amp;</span> Sara</h1><p>18 de septiembre de 2027 · Villanueva de la Serena</p></div>
</body></html>"""

(IMG / "favicon.svg").write_text(FAVICON, encoding="utf-8")
tmp = ROOT / "scripts/.og.html"
tmp.write_text(OG, encoding="utf-8")
with sync_playwright() as p:
    b = p.chromium.launch()
    pg = b.new_page(viewport={"width": 1200, "height": 630})
    pg.goto(tmp.as_uri())
    pg.wait_for_timeout(400)
    pg.screenshot(path=str(IMG / "og.png"))
    for size, name in [(32, "favicon-32.png"), (180, "apple-touch-icon.png")]:
        pg.set_viewport_size({"width": size, "height": size})
        pg.set_content(f"<html><body style='margin:0'>{FAVICON.replace('<svg ', f'<svg width={size} height={size} ')}</body></html>")
        pg.screenshot(path=str(IMG / name), omit_background=True)
    b.close()
tmp.unlink()
print("icons + og.png written")
