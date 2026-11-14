"""
Visual review: full-page screenshots at phone, tablet and desktop widths,
plus console-error and horizontal-overflow checks.
    python3 tests/screens.py [base_url] [out_dir] [lang]
"""
import sys
from pathlib import Path
from playwright.sync_api import sync_playwright

BASE = sys.argv[1] if len(sys.argv) > 1 else "http://localhost:8080/"
OUT = Path(sys.argv[2] if len(sys.argv) > 2 else "screens")
LANG = sys.argv[3] if len(sys.argv) > 3 else "es"
OUT.mkdir(parents=True, exist_ok=True)
SIZES = {"phone": (390, 844), "phone-small": (320, 640), "tablet": (820, 1180), "laptop": (1366, 800), "desktop": (1920, 1080)}

problems = []
with sync_playwright() as p:
    b = p.chromium.launch()
    for name, (w, h) in SIZES.items():
        ctx = b.new_context(viewport={"width": w, "height": h}, device_scale_factor=1, reduced_motion="reduce")
        pg = ctx.new_page()
        errs = []
        pg.on("console", lambda m: errs.append(m.text) if m.type == "error" else None)
        pg.on("pageerror", lambda e: errs.append(str(e)))
        pg.on("requestfailed", lambda r: errs.append("failed: " + r.url))
        pg.goto(f"{BASE}?lang={LANG}")
        pg.wait_for_load_state("networkidle")
        pg.screenshot(path=str(OUT / f"{name}-fold.png"))
        # scroll through so lazy-loaded photos appear in the full-page capture
        pg.evaluate("async () => { for (let y = 0; y < document.body.scrollHeight; y += 400) { scrollTo(0, y); await new Promise(r => setTimeout(r, 60)); } scrollTo(0, 0); }")
        pg.wait_for_load_state("networkidle")
        broken = pg.evaluate("[...document.images].filter(i => i.complete && i.getAttribute('src') && i.naturalWidth === 0).map(i => i.src)")
        if broken:
            problems.append(f"{name}: broken images {broken}")
        pg.screenshot(path=str(OUT / f"{name}-full.png"), full_page=True)
        overflow = pg.evaluate("document.documentElement.scrollWidth - document.documentElement.clientWidth")
        wide = pg.evaluate("""() => [...document.querySelectorAll('body *')].filter(e => {
            const r = e.getBoundingClientRect(); return r.width && r.right > innerWidth + 1 && getComputedStyle(e).position !== 'fixed'
              && !e.closest('.hero__art') && !e.closest('.hp');
          }).slice(0, 5).map(e => e.tagName + '.' + e.className)""")
        if overflow > 0 or wide:
            problems.append(f"{name}: horizontal overflow {overflow}px {wide}")
        if errs:
            problems.append(f"{name}: console errors {errs}")
        ctx.close()
    b.close()

print("\n".join(problems) if problems else "OK: no overflow, no console errors")
sys.exit(1 if problems else 0)
