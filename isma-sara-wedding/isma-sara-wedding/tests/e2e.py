"""
End-to-end browser tests (Playwright, Chromium).
The RSVP endpoint is intercepted and forwarded to the Apps Script emulator,
which runs the REAL apps-script/Code.gs. Run everything with:  npm test

Requires a site built with RSVP_ENDPOINT=https://script.google.com/macros/s/TEST/exec
served at SITE (default http://localhost:8090/) and the emulator at EMU.
"""
import json
import os
import re
import sys
import time
import urllib.request
from pathlib import Path
from playwright.sync_api import sync_playwright, expect

SITE = os.environ.get("SITE", "http://localhost:8090/")
EMU = os.environ.get("EMU", "http://localhost:8788")
AXE = (Path(__file__).resolve().parent.parent / "node_modules/axe-core/axe.min.js").read_text()
ENDPOINT = "https://script.google.com/macros/s/TEST/exec"

results = []


def emu(path, data=None):
    req = urllib.request.Request(EMU + path, data=json.dumps(data).encode() if data is not None else None, method="POST" if data is not None else "GET")
    return json.loads(urllib.request.urlopen(req).read())


def check(name):
    def deco(fn):
        def run(*a):
            try:
                fn(*a)
                results.append((name, True, ""))
            except Exception as e:  # noqa: BLE001
                import traceback
                msg = (str(e).splitlines() or [""])[0][:300] or traceback.format_exc().strip().splitlines()[-2][:300]
                results.append((name, False, msg))
        return run
    return deco


TINY_GIF = bytes.fromhex("47494638396101000100800000000000ffffff21f90401000000002c00000000010001000002024401003b")


def wire(page, fail=None):
    """Forward the Apps Script URL to the emulator (or simulate an outage)."""
    def handler(route):
        if fail == "network":
            return route.abort("internetdisconnected")
        if fail == "500":
            return route.fulfill(status=500, body="error")
        body = route.request.post_data or ""
        assert route.request.headers.get("content-type", "").startswith("text/plain"), "must be a simple CORS request"
        req = urllib.request.Request(EMU + "/exec", data=body.encode(), method="POST")
        resp = urllib.request.urlopen(req).read()
        route.fulfill(status=200, body=resp, headers={"content-type": "application/json", "access-control-allow-origin": "*"})
    page.unroute("**/macros/s/**")
    page.route("**/macros/s/**", handler)


def axe(page, label):
    page.add_script_tag(content=AXE)
    res = page.evaluate("async () => (await axe.run(document, {runOnly: ['wcag2a','wcag2aa','wcag21aa','best-practice']})).violations.map(v => v.id + ' (' + v.nodes.length + '): ' + v.nodes.slice(0,2).map(n => n.target.join(' ')).join(' | '))")
    assert not res, f"{label}: " + "; ".join(res)


def rows():
    """Respuestas rows as dicts keyed by column name."""
    d = emu("/__rows")
    return [dict(zip(d["headers"], r)) for r in d["rows"]]


def people():
    d = emu("/__rows")
    return [dict(zip(d["peopleHeaders"], r)) for r in d["people"]]


PARTNER = "[data-person][data-role=partner]"


def fill_valid(page, name="Lucía Fernández", companion="Pablo Gómez"):
    first, last = name.split(" ", 1)
    page.fill("#f-g-firstName", first)
    page.fill("#f-g-lastName", last)
    page.check("input[name=attending][value=yes]")
    page.check("input[name=withPartner][value=yes]")
    pf, pl = companion.split(" ", 1)
    page.fill(f"{PARTNER} [data-name=firstName]", pf)
    page.fill(f"{PARTNER} [data-name=lastName]", pl)
    page.check("#f-privacyAck")


with sync_playwright() as p:
    browser = p.chromium.launch()

    def new_page(**kw):
        kw.setdefault("locale", "es-ES")
        ctx = browser.new_context(viewport=kw.pop("viewport", {"width": 1366, "height": 860}), reduced_motion="reduce", **kw)
        ctx.grant_permissions(["clipboard-read", "clipboard-write"])
        page = ctx.new_page()
        # the celebration GIF comes from GIPHY: serve a 1x1 GIF instead and record the requests
        page.giphy = []
        def giphy(route):
            page.giphy.append(route.request.url)
            route.fulfill(status=200, body=TINY_GIF, headers={"content-type": "image/gif"})
        page.route("**/media.giphy.com/**", giphy)
        page.errors = []
        page.on("pageerror", lambda e: page.errors.append(str(e)))
        page.on("console", lambda m: page.errors.append(m.text) if m.type == "error" and "internetdisconnected" not in m.text and "Failed to load resource" not in m.text else None)
        return page

    @check("Pre-rendered Spanish page is complete without JavaScript")
    def t_nojs():
        ctx = browser.new_context(java_script_enabled=False)
        pg = ctx.new_page()
        pg.goto(SITE)
        for txt in ["Isma", "Sara", "18 de septiembre", "Restaurante Casablanca", "Confirmar asistencia", "Preguntas frecuentes"]:
            expect(pg.locator("body")).to_contain_text(txt)
        expect(pg.locator("h1")).to_have_count(1)
        ctx.close()
    t_nojs()

    @check("Language switch: ES → EN → ES, URL + <html lang> + persistence")
    def t_lang():
        pg = new_page(locale="es-ES")
        pg.goto(SITE)
        expect(pg.locator("html")).to_have_attribute("lang", "es")
        pg.click("[data-lang=en]")
        expect(pg.locator("html")).to_have_attribute("lang", "en")
        expect(pg.locator("#story-title")).to_have_text("We’re getting married")
        assert "lang=en" in pg.url
        expect(pg.locator("[data-lang=en]")).to_be_focused()
        pg.goto(SITE)  # remembered
        expect(pg.locator("#story-title")).to_have_text("We’re getting married")
        pg.click("[data-lang=es]")
        expect(pg.locator("#story-title")).to_have_text("Nos casamos")
        assert pg.title().startswith("Isma & Sara")
        assert not pg.errors, pg.errors
    t_lang()

    @check("English browser gets English automatically")
    def t_autolang():
        pg = new_page(locale="en-GB")
        pg.goto(SITE)
        expect(pg.locator("html")).to_have_attribute("lang", "en")
    t_autolang()

    @check("Desktop navigation links reach every section")
    def t_nav():
        pg = new_page()
        pg.goto(SITE)
        for href in ["#nosotros", "#boda", "#programa", "#como-llegar", "#preguntas", "#confirmar"]:
            pg.click(f".nav a[href='{href}']")
            pg.wait_for_timeout(150)
            top = pg.evaluate(f"document.querySelector('{href}').getBoundingClientRect().top")
            assert -5 < top < 200, f"{href} top={top}"
    t_nav()

    @check("Mobile menu: open, keyboard Escape, close on link, aria-expanded")
    def t_menu():
        pg = new_page(viewport={"width": 390, "height": 844}, has_touch=True)
        pg.goto(SITE)
        btn = pg.locator(".menu-btn")
        expect(pg.locator(".nav a[href='#boda']")).not_to_be_visible()
        btn.click()
        expect(btn).to_have_attribute("aria-expanded", "true")
        expect(pg.locator(".nav a[href='#boda']")).to_be_visible()
        pg.keyboard.press("Escape")
        expect(btn).to_have_attribute("aria-expanded", "false")
        expect(btn).to_be_focused()
        btn.click()
        pg.click(".nav a[href='#preguntas']")
        expect(btn).to_have_attribute("aria-expanded", "false")
        pg.wait_for_timeout(200)
        assert pg.evaluate("document.querySelector('#preguntas').getBoundingClientRect().top") < 200
        for w in (320, 768):  # tap targets
            pg.set_viewport_size({"width": w, "height": 700})
            h = pg.evaluate("document.querySelector('.menu-btn').getBoundingClientRect().height")
            assert h >= 44, h
    t_menu()

    @check("Countdown: correct value, never negative, 'today' and 'after' states")
    def t_countdown():
        pg = new_page()
        # 2027-09-17 22:00 UTC = 2027-09-18 00:00 Madrid (CEST)
        pg.clock.set_fixed_time("2027-09-16T22:00:00Z")
        pg.goto(SITE)
        nums = pg.locator(".cd__n").all_inner_texts()
        assert nums[:4] == ["1", "00", "00", "00"], nums
        pg.clock.set_fixed_time("2027-09-18T10:00:00Z")
        pg.goto(SITE)
        expect(pg.locator(".cd__msg")).to_have_text("¡Hoy es el día!")
        pg.clock.set_fixed_time("2027-09-19T00:30:00Z")
        pg.goto(SITE)
        expect(pg.locator(".cd__msg")).to_contain_text("casados")
        pg2 = new_page()
        pg2.goto(SITE)
        vals = [int(x) for x in pg2.locator(".cd__n").all_inner_texts()[:4]]
        assert all(v >= 0 for v in vals) and vals[0] > 300, vals
    t_countdown()

    @check("FAQ accordion opens and closes (mouse + keyboard)")
    def t_faq():
        pg = new_page()
        pg.goto(SITE)
        q = pg.locator(".qa").first
        q.locator("summary").click()
        expect(q).to_have_attribute("open", "")
        q.locator("summary").focus()
        pg.keyboard.press("Enter")
        assert q.get_attribute("open") is None
        assert pg.locator(".qa").count() >= 5  # endpoint set → RSVP questions appear
    t_faq()

    @check("Directions link points to Google Maps and opens safely")
    def t_maps():
        pg = new_page()
        pg.goto(SITE)
        a = pg.locator("#boda a.btn")
        assert a.get_attribute("href").startswith("https://www.google.com/maps/")
        assert a.get_attribute("target") == "_blank" and "noopener" in a.get_attribute("rel")
    t_maps()

    @check("Venue map: nothing from Google until 'Mostrar mapa', then Google Maps at the venue, remembered")
    def t_map():
        pg = new_page()
        google = []
        def fake_google(route):
            google.append(route.request.url)
            route.fulfill(status=200, body="<html><body style='margin:0;background:#e5e3df'>Google Maps</body></html>", headers={"content-type": "text/html"})
        pg.route("https://maps.google.com/**", fake_google)
        pg.goto(SITE + "#boda")
        expect(pg.locator(".venue__landmark")).to_have_text("Frente al Palacio de Congresos")
        expect(pg.locator("[data-map-load]")).to_have_text("Mostrar mapa")
        pg.wait_for_timeout(300)
        assert google == [], "Google Maps must not load before the guest asks"
        # map sits beside the address on desktop
        box_a = pg.locator(".venue__addr").bounding_box()
        box_m = pg.locator("[data-map]").bounding_box()
        assert box_m["x"] > box_a["x"] + box_a["width"] - 1 and abs(box_m["y"] - box_a["y"]) < 200, (box_a, box_m)
        axe(pg, "map placeholder")
        pg.click("[data-map-load]")
        frame = pg.locator("iframe.map__frame")
        expect(frame).to_be_visible()
        src = frame.get_attribute("src")
        assert src == "https://maps.google.com/maps?q=38.9696307,-5.783303&z=16&hl=es&output=embed", src
        assert frame.get_attribute("title").startswith("Mapa de Google")
        expect(frame).to_be_focused()
        pg.wait_for_timeout(300)
        assert google, "iframe requested Google Maps"
        # language switch keeps the map and switches its language
        pg.click("[data-lang=en]")
        expect(pg.locator("iframe.map__frame")).to_have_attribute("src", re.compile("hl=en"))
        # remembered on the next visit
        pg.goto(SITE + "?lang=es")
        expect(pg.locator("iframe.map__frame")).to_be_attached()
        expect(pg.locator("[data-map-load]")).to_have_count(0)
        # directions button opens the restaurant's own Google Maps listing
        href = pg.locator("#boda a.btn").get_attribute("href")
        assert "query_place_id=ChIJ2aPI-adZFA0RfFYsNuMl5xw" in href, href
        # phone: map stacks under the address
        m = new_page(viewport={"width": 390, "height": 844})
        m.route("https://maps.google.com/**", fake_google)
        m.goto(SITE + "#boda")
        a2 = m.locator(".venue__addr").bounding_box()
        m2 = m.locator("[data-map]").bounding_box()
        assert m2["y"] > a2["y"] + a2["height"] and m2["width"] > 300, (a2, m2)
        assert not pg.errors, pg.errors
    t_map()

    @check("Routes from 10 places: tabs (mouse + keyboard), content, Google Maps links, no-JS fallback")
    def t_routes():
        pg = new_page()
        pg.goto(SITE + "#como-llegar")
        tabs = pg.locator(".routes [role=tab]")
        assert tabs.all_inner_texts() == ["Mérida", "Sevilla", "Madrid", "Barcelona", "Bilbao", "Almería", "Suiza", "Praga", "Fráncfort", "Florencia"], tabs.all_inner_texts()
        expect(pg.locator("#rp-0")).to_be_visible()
        expect(pg.locator("#rp-2")).to_be_hidden()
        tabs.nth(2).click()
        expect(pg.locator("#rp-2")).to_be_visible()
        expect(pg.locator("#rp-0")).to_be_hidden()
        expect(pg.locator("#rp-2")).to_contain_text("Estación Sur")
        pg.keyboard.press("ArrowRight")
        expect(tabs.nth(3)).to_be_focused()
        expect(tabs.nth(3)).to_have_attribute("aria-selected", "true")
        expect(pg.locator("#rp-3")).to_contain_text("Badajoz")
        pg.keyboard.press("End")
        expect(pg.locator("#rp-9")).to_contain_text("Volotea")
        pg.keyboard.press("ArrowRight")
        expect(tabs.nth(0)).to_be_focused()
        links = pg.locator(".route__link a")
        hrefs = [links.nth(i).get_attribute("href") for i in range(links.count())]
        assert hrefs and all(h.startswith("https://www.google.com/maps/dir/?api=1") and "destination_place_id=ChIJ2aPI-adZFA0RfFYsNuMl5xw" in h for h in hrefs), hrefs
        assert pg.locator(".route__icon").count() >= 16
        axe(pg, "routes")
        # selected city survives a language switch, labels translate
        tabs.nth(5).click()
        expect(pg.locator("#rp-5")).to_contain_text("Granada")
        tabs.nth(6).click()
        expect(pg.locator("#rp-6")).to_contain_text("Ginebra")
        expect(pg.locator("#rp-4")).to_be_hidden()
        tabs.nth(7).click()
        pg.click("[data-lang=en]")
        expect(pg.locator(".routes [role=tab][aria-selected=true]")).to_have_text("Prague")
        expect(pg.locator("#rp-7")).to_contain_text("Smartwings")
        expect(pg.locator(".routes__title")).to_have_text("Getting here from…")
        # without JavaScript every city is listed with its name
        ctx = browser.new_context(java_script_enabled=False)
        nj = ctx.new_page()
        nj.goto(SITE)
        expect(nj.locator(".routes__city")).to_have_count(10)
        expect(nj.locator(".routes__tabs")).to_be_hidden()
        expect(nj.locator("#rp-9")).to_be_visible()
        ctx.close()
        assert not pg.errors, pg.errors
    t_routes()

    @check("September heat: temperature chart with 2027 forecast bands, data table, English")
    def t_climate():
        import json, subprocess
        data = json.loads(subprocess.run(["node", "-e", "import('./site/assets/js/clima.js').then(m => console.log(JSON.stringify(m.clima)))"],
                                         capture_output=True, text=True, check=True).stdout)
        assert len(data["years"]) == 10 and data["target"] == 2027
        for v in ("max", "min"):
            fc = data[v]["forecast"]
            assert fc["pi"][0] < fc["ci"][0] < fc["fit"] < fc["ci"][1] < fc["pi"][1], fc
        pg = new_page()
        pg.goto(SITE + "#preguntas")
        q = pg.locator("details.qa:has(.clima)")
        expect(q).to_have_count(1)
        q.locator("summary.qa__q").click()
        fig = q.locator("figure.clima")
        expect(fig.locator("svg[role=img] title")).to_have_text("Temperaturas del 15 al 21 de septiembre en Villanueva de la Serena")
        expect(fig.locator(".clima__mean")).to_have_count(20)
        expect(fig.locator(".clima__day")).to_have_count(140)
        expect(fig.locator(".clima__ci")).to_have_count(2)
        expect(fig.locator(".clima__pi")).to_have_count(2)
        fit = f"{data['max']['forecast']['fit']:.1f}".replace(".", ",")
        expect(fig.locator(".clima__lead")).to_contain_text(f"máxima de unos {fit} °C")
        expect(fig.locator(".clima__cap")).to_contain_text("Open-Meteo")
        fig.locator(".clima__data summary").click()
        expect(fig.locator("tbody tr")).to_have_count(10)
        expect(fig.locator("tbody tr").first.locator("th")).to_have_text("2017")
        axe(pg, "climate")
        pg.click("[data-lang=en]")
        q = pg.locator("details.qa:has(.clima)")
        if not q.get_attribute("open"):
            q.locator("summary.qa__q").click()
        expect(q.locator(".clima__lead")).to_contain_text(f"high of about {data['max']['forecast']['fit']:.1f} °C")
        assert not pg.errors, pg.errors
    t_climate()

    @check("Where to stay + Villanueva fun facts: content, links, nav, FAQ, English")
    def t_stay():
        pg = new_page()
        pg.goto(SITE)
        pg.click(".nav a[href='#alojamiento']")
        pg.wait_for_timeout(150)
        assert pg.evaluate("document.querySelector('#alojamiento').getBoundingClientRect().top") < 200
        names = pg.locator(".place__name").all_inner_texts()
        assert names[0] == "Hotel AlJardín" and "Parador de Mérida" in names and len(names) == 6, names
        maps = pg.locator(".place__links a.link:not(.place__phone)")
        hrefs = [maps.nth(i).get_attribute("href") for i in range(maps.count())]
        assert all(h.startswith("https://") for h in hrefs) and sum("query_place_id=" in h for h in hrefs) == 5, hrefs
        assert pg.locator(".place__phone").first.get_attribute("href") == "tel:+34924849165"
        plats = pg.locator(".platform")
        assert plats.count() == 2
        assert "checkin=2027-09-18" in plats.nth(0).get_attribute("href") and "checkout=2027-09-19" in plats.nth(1).get_attribute("href")
        # FAQ: the stay question points to the section; fun facts listed under their own heading
        expect(pg.locator(".faq__sub")).to_have_text("Curiosidades de Villanueva")
        tortilla = pg.locator("details.qa", has_text="tortilla")
        tortilla.locator("summary").click()
        expect(tortilla).to_contain_text("27 de febrero de 1798")
        expect(pg.locator("details.qa", has_text="¿Dónde puedo alojarme?")).to_contain_text("Dónde dormir")
        axe(pg, "stay + faq")
        pg.click("[data-lang=en]")
        expect(pg.locator("#stay-title")).to_have_text("Where to stay")
        expect(pg.locator(".faq__sub")).to_have_text("Fun facts about Villanueva")
        expect(pg.locator(".nav a[href='#alojamiento']")).to_have_text("Where to stay")
        assert not pg.errors, pg.errors
    t_stay()

    @check("RSVP: client validation, focus on first error, accessible messages")
    def t_validation():
        emu("/__props", {})
        pg = new_page()
        wire(pg)
        pg.goto(SITE + "#confirmar")
        pg.click("[data-rsvp-submit]")
        expect(pg.locator("#f-g-firstName")).to_be_focused()
        expect(pg.locator("#f-g-firstName")).to_have_attribute("aria-invalid", "true")
        expect(pg.locator("#f-g-firstName-err")).to_have_text("Escribe tu nombre.")
        expect(pg.locator("#f-g-lastName-err")).to_have_text("Escribe los apellidos.")
        expect(pg.locator("[data-rsvp-status]")).to_have_text("Revisa los campos marcados.")
        expect(pg.locator("#f-attending-err")).to_be_visible()
        expect(pg.locator("#f-privacyAck-err")).to_be_visible()
        pg.fill("#f-g-firstName", "Lu")
        expect(pg.locator("#f-g-firstName-err")).to_be_hidden()
        expect(pg.locator("#f-g-lastName-err")).to_be_visible()
        # attending without saying whether a partner comes
        pg.fill("#f-g-lastName", "Fernández")
        pg.check("input[name=attending][value=yes]")
        pg.check("#f-privacyAck")
        pg.click("[data-rsvp-submit]")
        expect(pg.locator("#f-withPartner-err")).to_have_text("Indica si vendrás con pareja.")
        assert emu("/__rows")["rows"] == []
    t_validation()

    @check("RSVP: partner, people added one by one, allergies per person, consent, limits")
    def t_conditional():
        pg = new_page()
        wire(pg)
        pg.goto(SITE + "#confirmar")
        expect(pg.locator("[data-when=yes]")).to_be_hidden()
        pg.check("input[name=attending][value=no]")
        expect(pg.locator("[data-when=yes]")).to_be_hidden()
        pg.check("input[name=attending][value=yes]")
        expect(pg.locator("[data-guest-diet] legend")).to_have_text("Tus alergias o dieta")
        assert pg.locator("[data-guest-diet] .chip").all_inner_texts() == ["Sin gluten (celiaquía)", "Sin lactosa", "Frutos secos", "Marisco", "Pescado", "Huevo", "Vegetariano", "Vegano", "Otra"]
        # partner
        expect(pg.locator(PARTNER)).to_be_hidden()
        pg.check("input[name=withPartner][value=yes]")
        expect(pg.locator(PARTNER)).to_be_visible()
        expect(pg.locator(f"{PARTNER} .person__title")).to_have_text("Tu pareja")
        pg.fill(f"{PARTNER} [data-name=firstName]", "Pablo")
        pg.check("input[name=withPartner][value=no]")
        expect(pg.locator(PARTNER)).to_be_hidden()
        pg.check("input[name=withPartner][value=yes]")
        expect(pg.locator(f"{PARTNER} [data-name=firstName]")).to_have_value("Pablo")  # kept
        expect(pg.locator("[data-count]")).to_have_text("2 de 50 personas")
        # add people one by one
        pg.click("[data-add]")
        cards = pg.locator("[data-person][data-role=extra]")
        expect(cards).to_have_count(1)
        expect(cards.nth(0).locator("[data-name=firstName]")).to_be_focused()
        expect(cards.nth(0).locator(".person__title")).to_have_text("Acompañante 1")
        pg.click("[data-add]")
        pg.click("[data-add]")
        expect(cards).to_have_count(3)
        expect(pg.locator("[data-count]")).to_have_text("5 de 50 personas")
        cards.nth(0).locator("[data-name=firstName]").fill("Leo")
        cards.nth(1).locator("[data-name=firstName]").fill("Carmen")
        cards.nth(1).locator("[data-remove]").click()
        expect(cards).to_have_count(2)
        expect(cards.nth(1).locator(".person__title")).to_have_text("Acompañante 2")  # renumbered
        expect(cards.nth(0).locator("[data-name=firstName]")).to_have_value("Leo")
        for _ in range(46):
            pg.click("[data-add]")
        expect(cards).to_have_count(48)
        expect(pg.locator("[data-count]")).to_contain_text("50 de 50")
        expect(pg.locator("[data-add]")).to_be_disabled()  # 50 = max
        expect(pg.locator("[data-count]")).to_contain_text("máximo")
        expect(cards.nth(47).locator(".person__title")).to_have_text("Acompañante 48")
        for i in range(47, 1, -1):
            cards.nth(i).locator("[data-remove]").click()
        expect(pg.locator("[data-add]")).to_be_enabled()
        expect(cards).to_have_count(2)
        # allergies: "Otra" asks which one; consent appears
        expect(pg.locator("[data-consent]")).to_be_hidden()
        other = cards.nth(0).locator(".diet__other")
        expect(other).to_be_hidden()
        cards.nth(0).locator(".chip", has_text="Otra").click()
        expect(other).to_be_visible()
        expect(other.locator("input")).to_be_focused()
        expect(pg.locator("[data-consent]")).to_be_visible()
        cards.nth(0).locator(".chip", has_text="Marisco").click()
        pg.locator("[data-guest-diet] .chip", has_text="Sin gluten").click()
        axe(pg, "rsvp people")
        # language switch keeps everything
        pg.click("[data-lang=en]")
        expect(pg.locator(f"{PARTNER} [data-name=firstName]")).to_have_value("Pablo")
        expect(pg.locator("[data-person][data-role=extra]")).to_have_count(2)
        expect(pg.locator("[data-person][data-role=extra]").nth(0).locator("[data-name=firstName]")).to_have_value("Leo")
        expect(pg.locator("[data-person][data-role=extra]").nth(0).locator("[data-diet][value=marisco]")).to_be_checked()
        expect(pg.locator("[data-person][data-role=extra]").nth(0).locator(".diet__other")).to_be_visible()
        expect(pg.locator("[data-guest-diet] [data-diet][value=gluten]")).to_be_checked()
        expect(pg.locator("[data-person][data-role=extra]").nth(0).locator(".person__title")).to_have_text("Guest 1")
        # per-person errors point at the right card
        pg.click("[data-lang=es]")
        pg.fill("#f-g-firstName", "Lucía")
        pg.fill("#f-g-lastName", "Fernández")
        pg.check("#f-privacyAck")
        pg.check("#f-healthConsent")
        pg.click("[data-rsvp-submit]")
        x1 = pg.locator("[data-person][data-role=extra]").nth(0)
        expect(x1.locator("[data-part=lastName] .field__err")).to_have_text("Escribe los apellidos.")
        expect(x1.locator("[data-part=dietOther] .field__err")).to_have_text("Indica qué alergia o dieta.")
        expect(pg.locator("[data-rsvp-gif]")).to_be_hidden()
        assert pg.giphy == [], pg.giphy
        expect(pg.locator(f"{PARTNER} [data-part=lastName] .field__err")).to_be_visible()
        expect(pg.locator(f"{PARTNER} [data-name=lastName]")).to_be_focused()
        assert emu("/__rows")["rows"] == []
    t_conditional()

    @check("RSVP: guest, partner and two more people with allergies saved person by person")
    def t_people():
        emu("/__props", {})
        pg = new_page()
        wire(pg)
        pg.goto(SITE + "#confirmar")
        pg.wait_for_timeout(3100)
        fill_valid(pg, "Lucía Fernández Ruiz", "Pablo Gómez")
        pg.locator("[data-guest-diet] .chip", has_text="Sin gluten").click()
        pg.locator(f"{PARTNER} .chip", has_text="Vegano").click()
        for first, last, diets, other in [("Leo", "Gómez Fernández", ["Sin lactosa"], ""), ("Carmen", "Ruiz", ["Otra"], "Kiwi")]:
            pg.click("[data-add]")
            card = pg.locator("[data-person][data-role=extra]").last
            card.locator("[data-name=firstName]").fill(first)
            card.locator("[data-name=lastName]").fill(last)
            for d in diets:
                card.locator(".chip", has_text=d).click()
            if other:
                card.locator("[data-diet-other]").fill(other)
        pg.check("#f-healthConsent")
        pg.check("#f-privacyAck")
        pg.click("[data-rsvp-submit]")
        expect(pg.locator(".done__title")).to_have_text("¡Gracias, Lucía!")
        expect(pg.locator("[data-rsvp-done]")).to_contain_text("4 personas")
        gif = pg.locator("[data-rsvp-gif] img")
        expect(gif).to_be_visible()
        expect(gif).to_have_attribute("alt", "Rayo McQueen celebrándolo")
        assert "B1CrvUCoMxhy8" in gif.get_attribute("src") and any("B1CrvUCoMxhy8" in u for u in pg.giphy), pg.giphy
        expect(pg.locator("[data-rsvp-gif] figcaption a")).to_have_attribute("href", "https://giphy.com/gifs/disneypixar-disney-pixar-B1CrvUCoMxhy8")
        axe(pg, "rsvp-gif")
        assert any(u.endswith("giphy_s.gif") for u in pg.giphy), "reduced motion should get the still frame"
        [r] = rows()
        assert r["nombre"] == "Lucía" and r["apellidos"] == "Fernández Ruiz" and r["personas"] == 4 and r["pareja"] == "Pablo Gómez", r
        assert r["acompanantes"] == "Leo Gómez Fernández; Carmen Ruiz", r
        assert r["alergias"] == "Lucía Fernández Ruiz: Sin gluten (celiaquía); Pablo Gómez: Vegano; Leo Gómez Fernández: Sin lactosa; Carmen Ruiz: Otra: Kiwi", r
        ps = people()
        assert [(p["nombre"], p["apellidos"], p["rol"], p["alergias"], p["otra_alergia"]) for p in ps] == [
            ("Lucía", "Fernández Ruiz", "Invitado/a", "Sin gluten (celiaquía)", ""),
            ("Pablo", "Gómez", "Pareja", "Vegano", ""),
            ("Leo", "Gómez Fernández", "Acompañante", "Sin lactosa", ""),
            ("Carmen", "Ruiz", "Acompañante", "Otra", "Kiwi"),
        ], ps
        # editing brings every person back, then removing one updates Personas
        link = pg.locator("#edit-link").input_value()
        pg2 = new_page()
        wire(pg2)
        pg2.goto(link)
        expect(pg2.locator("[data-rsvp-notice]")).to_contain_text("Estás modificando")
        expect(pg2.locator(f"{PARTNER} [data-name=lastName]")).to_have_value("Gómez")
        cards = pg2.locator("[data-person][data-role=extra]")
        expect(cards).to_have_count(2)
        expect(cards.nth(1).locator("[data-diet-other]")).to_have_value("Kiwi")
        expect(pg2.locator("[data-guest-diet] [data-diet][value=gluten]")).to_be_checked()
        cards.nth(0).locator("[data-remove]").click()
        pg2.check("#f-privacyAck")
        pg2.click("[data-rsvp-submit]")
        expect(pg2.locator(".done__title")).to_have_text("Cambios guardados, Lucía")
        assert [p["nombre"] for p in people()] == ["Lucía", "Pablo", "Carmen"]
        assert rows()[0]["personas"] == 3
        assert not pg.errors and not pg2.errors, (pg.errors, pg2.errors)
    t_people()

    @check("RSVP: very fast reply is still recorded (flagged for review, never lost)")
    def t_fast():
        emu("/__props", {})
        pg = new_page()
        wire(pg)
        pg.goto(SITE + "#confirmar")
        fill_valid(pg, "Rápida Gómez", "Otro Gómez")
        pg.click("[data-rsvp-submit]")
        expect(pg.locator(".done__title")).to_have_text("¡Gracias, Rápida!")
        rs = rows()
        assert len(rs) == 1 and rs[0]["estado"] == "Revisar: posible spam", rs
    t_fast()

    @check("RSVP: real submission persisted, confirmation and private link")
    def t_submit():
        emu("/__props", {})
        pg = new_page()
        wire(pg)
        pg.goto(SITE + "#confirmar")
        pg.wait_for_timeout(3100)
        fill_valid(pg)
        pg.locator("[data-guest-diet] .chip", has_text="Sin gluten").click()
        pg.check("#f-healthConsent")
        pg.click("[data-rsvp-submit]")
        expect(pg.locator(".done__title")).to_have_text("¡Gracias, Lucía!")
        expect(pg.locator("[data-rsvp-done]")).to_be_focused()
        expect(pg.locator("[data-rsvp-done]")).to_contain_text("2 personas")
        rs = rows()
        assert len(rs) == 1, rs
        r = rs[0]
        assert (r["nombre"], r["apellidos"], r["asistencia"], r["personas"], r["pareja"], r["consentimiento_salud"]) == ("Lucía", "Fernández", "Sí", 2, "Pablo Gómez", "Sí"), r
        assert r["alergias"] == "Lucía Fernández: Sin gluten (celiaquía)", r
        link = pg.locator("#edit-link").input_value()
        assert re.search(r"#editar=[a-f0-9]{64}$", link), link
        pg.click("[data-copy]")
        expect(pg.locator(".copy__status")).to_have_text("Enlace copiado")
        assert not pg.errors, pg.errors
    t_submit()

    @check("RSVP: double-click / rapid resubmit stores a single row")
    def t_double():
        emu("/__props", {})
        pg = new_page()
        wire(pg)
        pg.goto(SITE + "#confirmar")
        pg.wait_for_timeout(3100)
        fill_valid(pg, "Ana Ruiz", "Leo Ruiz")
        pg.locator("[data-rsvp-submit]").dblclick()
        pg.evaluate("document.querySelector('[data-rsvp-form]').requestSubmit()")
        expect(pg.locator(".done__title")).to_be_visible()
        n = len(emu("/__rows")["rows"])
        assert n == 1, f"rows={n}"
    t_double()

    @check("RSVP: outage keeps the reply on the device, manual retry stores it once")
    def t_network():
        emu("/__props", {})
        pg = new_page()
        wire(pg, fail="network")
        pg.goto(SITE + "#confirmar")
        pg.wait_for_timeout(3100)
        fill_valid(pg, "Marta Gil", "Juan Gil")
        pg.click("[data-rsvp-submit]")
        expect(pg.locator("[data-rsvp-status]")).to_contain_text("guardada en este dispositivo")
        assert pg.evaluate("JSON.parse(localStorage.getItem('rsvp-outbox')).body.people[1].firstName") == "Juan"
        expect(pg.locator("#f-g-firstName")).to_have_value("Marta")
        expect(pg.locator("[data-rsvp-submit]")).to_be_enabled()
        wire(pg, fail="500")
        pg.click("[data-rsvp-submit]")
        expect(pg.locator("[data-rsvp-status]")).to_contain_text("guardada en este dispositivo")
        wire(pg)
        pg.click("[data-rsvp-submit]")
        expect(pg.locator(".done__title")).to_be_visible()
        assert len(emu("/__rows")["rows"]) == 1
        assert pg.evaluate("localStorage.getItem('rsvp-outbox')") is None, "outbox cleared only after confirmation"
    t_network()

    @check("RSVP: unsent reply is resent automatically (timer, reopening the site, back online)")
    def t_outbox():
        emu("/__props", {})
        # 1) automatic retry while the page stays open
        pg = new_page()
        wire(pg, fail="network")
        pg.goto(SITE + "#confirmar")
        pg.wait_for_timeout(3100)
        fill_valid(pg, "Elena Paz", "Rubén Paz")
        pg.click("[data-rsvp-submit]")
        expect(pg.locator("[data-rsvp-status]")).to_contain_text("guardada")
        wire(pg)  # connection comes back; nobody touches anything
        expect(pg.locator(".done__title")).to_have_text("¡Gracias, Elena!", timeout=9000)
        assert len(emu("/__rows")["rows"]) == 1

        # 2) guest closes the page while offline, comes back later
        emu("/__props", {})
        ctx = browser.new_context(locale="es-ES", reduced_motion="reduce")
        p1 = ctx.new_page()
        wire(p1, fail="network")
        p1.goto(SITE + "#confirmar")
        p1.wait_for_timeout(3100)
        fill_valid(p1, "Nora Vidal", "Hugo Vidal")
        p1.click("[data-rsvp-submit]")
        expect(p1.locator("[data-rsvp-status]")).to_contain_text("guardada")
        p1.close()
        assert emu("/__rows")["rows"] == []
        p2 = ctx.new_page()
        wire(p2)
        p2.goto(SITE)
        expect(p2.locator(".done__title")).to_have_text("¡Gracias, Nora!")
        rs = rows()
        assert len(rs) == 1 and rs[0]["pareja"] == "Hugo Vidal", rs
        assert [p["nombre"] for p in people()] == ["Nora", "Hugo"]
        p2.reload()
        expect(p2.locator("[data-rsvp-notice]")).to_contain_text("Estás modificando")  # own reply, nothing pending
        expect(p2.locator("[data-rsvp-notice]")).not_to_contain_text("Enviándola")
        assert len(emu("/__rows")["rows"]) == 1
        ctx.close()

        # 3) 'online' event triggers a resend
        emu("/__props", {})
        p3 = new_page()
        wire(p3, fail="network")
        p3.goto(SITE + "#confirmar")
        p3.wait_for_timeout(3100)
        fill_valid(p3, "Iris Mora", "Pau Mora")
        p3.click("[data-rsvp-submit]")
        expect(p3.locator("[data-rsvp-status]")).to_contain_text("guardada")
        wire(p3)
        p3.evaluate("dispatchEvent(new Event('online'))")
        expect(p3.locator(".done__title")).to_have_text("¡Gracias, Iris!", timeout=3000)
        assert len(emu("/__rows")["rows"]) == 1
    t_outbox()

    @check("RSVP: correcting a reply after a failed send keeps the latest version, one row")
    def t_correct():
        emu("/__props", {})
        pg = new_page()
        sent = {"n": 0}

        def flaky(route):
            # first request reaches the server but the answer is lost (timeout)
            body = route.request.post_data or ""
            resp = urllib.request.urlopen(urllib.request.Request(EMU + "/exec", data=body.encode(), method="POST")).read()
            sent["n"] += 1
            if sent["n"] == 1:
                return route.abort("timedout")
            route.fulfill(status=200, body=resp, headers={"content-type": "application/json"})
        pg.route("**/macros/s/**", flaky)
        pg.goto(SITE + "#confirmar")
        pg.wait_for_timeout(3100)
        fill_valid(pg, "Carla Ruiz", "Dani Ruiz")
        pg.click("[data-rsvp-submit]")
        expect(pg.locator("[data-rsvp-status]")).to_contain_text("guardada")
        pg.fill(f"{PARTNER} [data-name=firstName]", "Daniel")
        pg.click("[data-rsvp-submit]")
        expect(pg.locator(".done__title")).to_be_visible()
        rs = rows()
        assert len(rs) == 1 and rs[0]["pareja"] == "Daniel Ruiz", rs
        assert [p["nombre"] for p in people()] == ["Carla", "Daniel"]
    t_correct()

    @check("Photos: load, story + gallery open full size, keyboard and buttons navigate")
    def t_photos():
        pg = new_page()
        bad = []
        pg.on("response", lambda r: bad.append(r.url) if r.status >= 400 else None)
        pg.goto(SITE)
        assert pg.locator(".gallery__item").count() == 6
        pg.locator("#fotos").scroll_into_view_if_needed()
        pg.wait_for_load_state("networkidle")
        loaded = pg.evaluate("[...document.querySelectorAll('.gallery__img, .story__img')].every(i => i.complete && i.naturalWidth > 0)")
        assert loaded and not bad, bad
        pg.click(".story__photo .ph")
        dlg = pg.locator("[data-viewer]")
        expect(dlg).to_be_visible()
        expect(pg.locator("[data-viewer-count]")).to_have_text("1 de 7")
        assert "pedida-1280.webp" in pg.locator("[data-viewer-img]").get_attribute("src")
        expect(pg.locator("[data-viewer-close]")).to_be_focused()
        pg.keyboard.press("ArrowRight")
        expect(pg.locator("[data-viewer-count]")).to_have_text("2 de 7")
        pg.click("[data-viewer-prev]")
        pg.click("[data-viewer-prev]")
        expect(pg.locator("[data-viewer-count]")).to_have_text("7 de 7")
        assert pg.locator("[data-viewer-img]").get_attribute("alt").startswith("Sara dormida")
        axe(pg, "viewer")
        pg.keyboard.press("Escape")
        expect(dlg).to_be_hidden()
        expect(pg.locator(".story__photo .ph")).to_be_focused()
        pg.locator(".gallery .ph").nth(2).click()
        expect(pg.locator("[data-viewer-count]")).to_have_text("4 de 7")
        pg.click("[data-viewer-close]")
        # English alt text
        pg.click("[data-lang=en]")
        assert pg.locator(".story__img").get_attribute("alt").startswith("Isma on one knee")
        assert not pg.errors, pg.errors
    t_photos()

    @check("RSVP: private edit link loads and updates the same row only")
    def t_edit():
        emu("/__props", {})
        pg = new_page()
        wire(pg)
        pg.goto(SITE)
        pg.wait_for_timeout(3100)
        fill_valid(pg, "Rosa Díaz", "Iván Díaz")
        pg.click("[data-rsvp-submit]")
        link = pg.locator("#edit-link").input_value()
        pg2 = new_page()
        wire(pg2)
        pg2.goto(link)
        expect(pg2.locator("[data-rsvp-notice]")).to_have_text(re.compile("Estás modificando"))
        assert "editar=" not in pg2.url, "token must be removed from the address bar"
        expect(pg2.locator("#f-g-firstName")).to_have_value("Rosa")
        expect(pg2.locator("#f-g-lastName")).to_have_value("Díaz")
        expect(pg2.locator(f"{PARTNER} [data-name=firstName]")).to_have_value("Iván")
        expect(pg2.locator("input[name=withPartner][value=yes]")).to_be_checked()
        expect(pg2.locator("[data-rsvp-submit]")).to_have_text("Guardar cambios")
        pg2.check("input[name=attending][value=no]")
        pg2.check("#f-privacyAck")
        pg2.click("[data-rsvp-submit]")
        expect(pg2.locator(".done__title")).to_have_text("Cambios guardados, Rosa")
        rs = rows()
        assert len(rs) == 1 and rs[0]["asistencia"] == "No" and rs[0]["estado"] == "Actualizada", rs
        assert len(emu("/__rows")["history"]) == 1
        assert people() == [], "declining removes the people rows"
        bad = new_page()
        wire(bad)
        bad.goto(SITE + "#editar=" + "0" * 64)
        expect(bad.locator("[data-rsvp-notice]")).to_contain_text("no es válido")
        expect(bad.locator("[data-rsvp-submit]")).to_have_text("Enviar respuesta")
    t_edit()

    @check("RSVP: server-side rejection shown (deadline closed on server)")
    def t_closed():
        emu("/__props", {"RSVP_DEADLINE": "2020-01-01"})
        pg = new_page()
        wire(pg)
        pg.goto(SITE + "#confirmar")
        pg.wait_for_timeout(3100)
        fill_valid(pg)
        pg.click("[data-rsvp-submit]")
        expect(pg.locator("[data-rsvp-status]")).to_contain_text("plazo")
        assert emu("/__rows")["rows"] == []
        emu("/__props", {})
    t_closed()

    @check("RSVP in English: labels and success message")
    def t_en():
        emu("/__props", {})
        pg = new_page(locale="en-GB")
        wire(pg)
        pg.goto(SITE + "#confirmar")
        pg.wait_for_timeout(3100)
        expect(pg.locator("label[for=f-g-firstName]")).to_have_text("First name")
        expect(pg.locator("label[for=f-g-lastName]")).to_have_text("Surname(s)")
        pg.fill("#f-g-firstName", "Lucy")
        pg.fill("#f-g-lastName", "Smith")
        pg.check("input[name=attending][value=no]")
        pg.check("#f-privacyAck")
        pg.click("[data-rsvp-submit]")
        expect(pg.locator(".done__title")).to_have_text("Thank you, Lucy!")
        assert rows()[0]["idioma"] == "en"
    t_en()

    @check("Keyboard: skip link first, visible focus ring")
    def t_keyboard():
        pg = new_page()
        pg.goto(SITE)
        pg.keyboard.press("Tab")
        expect(pg.locator(".skip")).to_be_focused()
        assert pg.evaluate("document.querySelector('.skip').getBoundingClientRect().top") >= 0
        pg.keyboard.press("Enter")
        pg.keyboard.press("Tab")
        outline = pg.evaluate("getComputedStyle(document.activeElement).outlineStyle")
        assert outline != "none", outline
    t_keyboard()

    @check("Accessibility (axe-core WCAG 2.1 AA): ES, EN, form errors, success, mobile menu")
    def t_axe():
        emu("/__props", {})
        pg = new_page()
        wire(pg)
        pg.goto(SITE)
        axe(pg, "es")
        pg.click("[data-rsvp-submit]")
        axe(pg, "errors")
        pg.click("[data-lang=en]")
        axe(pg, "en")
        m = new_page(viewport={"width": 390, "height": 844})
        m.goto(SITE)
        m.click(".menu-btn")
        axe(m, "menu")
        pg.wait_for_timeout(3100)
        fill_valid(pg, "Eva Prieto", "Tomás Prieto")
        pg.click("[data-rsvp-submit]")
        expect(pg.locator(".done__title")).to_be_visible()
        axe(pg, "success")
    t_axe()

    @check("Privacy page: ES default, EN switch, linked from form and footer")
    def t_privacy():
        pg = new_page()
        pg.goto(SITE)
        assert pg.locator("footer a[href^='privacidad.html']").count() == 1
        assert pg.locator("#f-privacyAck + span a[href^='privacidad.html']").count() == 1
        pg.goto(SITE + "privacidad.html")
        expect(pg.locator("h1")).to_have_text("Aviso de privacidad")
        expect(pg.locator("body")).to_contain_text("Google Sheets")
        pg.click("[data-lang=en]")
        expect(pg.locator("h1")).to_have_text("Privacy notice")
        axe(pg, "privacy")
        assert not pg.errors, pg.errors
    t_privacy()

    @check("Missing URL serves the custom 404 page with working assets")
    def t_404():
        pg = new_page()
        resp = pg.goto(SITE + "no/existe")
        assert resp.status == 404
        expect(pg.locator("h1")).to_have_text("Esta página no existe")
        bg = pg.evaluate("getComputedStyle(document.body).backgroundColor")
        assert bg == "rgb(244, 238, 226)", f"stylesheet not loaded at depth: {bg}"
    t_404()

    @check("No broken assets or console errors across pages")
    def t_assets():
        pg = new_page()
        failed = []
        pg.on("response", lambda r: failed.append(f"{r.status} {r.url}") if r.status >= 400 else None)
        for path in ["", "privacidad.html", "assets/img/og.png", "assets/img/favicon.svg", "assets/img/apple-touch-icon.png"]:
            pg.goto(SITE + path)
            pg.wait_for_load_state("networkidle")
        assert not failed, failed
        assert not pg.errors, pg.errors
    t_assets()

    browser.close()

w = max(len(n) for n, *_ in results)
for name, ok, msg in results:
    print(f"{'PASS' if ok else 'FAIL'}  {name.ljust(w)}  {msg}")
failed = [r for r in results if not r[1]]
print(f"\n{len(results) - len(failed)}/{len(results)} passed")
sys.exit(1 if failed else 0)
