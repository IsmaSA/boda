// Page behaviour: language, navigation, countdown and RSVP wiring.
import { config } from '../../config.js';
import { ui } from './ui.js';
import { renderHeader, renderMain, renderFooter } from './render.js';
import { countdown } from './time.js';
import { initRsvp, snapshotForm, restoreForm } from './rsvp.js';
import { initGallery } from './gallery.js';
import { initMap } from './map.js';
import { initRoutes } from './routes.js';
import { initEasterEgg, initPacking } from './fun.js';

// Links (calendar, …) use the address the page is really served from.
config.siteUrl = new URL('./', location.href).href;

const PRERENDERED = document.documentElement.lang || 'es';
const store = {
  get(k) { try { return localStorage.getItem(k); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch { /* private mode */ } },
};

function pickLang() {
  const q = new URLSearchParams(location.search).get('lang');
  if (q === 'es' || q === 'en') return q;
  const saved = store.get('lang');
  if (saved === 'es' || saved === 'en') return saved;
  const pref = (navigator.languages || [navigator.language || 'es'])[0] || 'es';
  return pref.toLowerCase().startsWith('en') ? 'en' : 'es';
}

let lang = pickLang();
let timer = null;
const rsvpState = { startedAt: Date.now() };

const $header = document.querySelector('[data-header]');
const $main = document.getElementById('contenido');
const $footer = document.querySelector('[data-footer]');

function applyMeta() {
  const u = ui[lang];
  document.documentElement.lang = lang;
  document.title = u.htmlTitle;
  document.querySelector('meta[name="description"]')?.setAttribute('content', u.metaDescription);
}

function render() {
  const snap = snapshotForm($main);
  $header.innerHTML = renderHeader(config, lang);
  $main.innerHTML = renderMain(config, lang);
  $footer.innerHTML = renderFooter(config, lang);
  applyMeta();
  wire();
  if (snap) restoreForm($main, snap);
}

function setLang(next) {
  if (next === lang) return;
  const y = window.scrollY;
  const focusedLang = document.activeElement?.dataset?.lang;
  lang = next;
  store.set('lang', lang);
  const url = new URL(location.href);
  url.searchParams.set('lang', lang);
  history.replaceState(null, '', url);
  render();
  window.scrollTo(0, y);
  if (focusedLang) document.querySelector(`[data-lang="${lang}"]`)?.focus();
}

/* ---------- navigation ---------- */
function wireNav() {
  const btn = $header.querySelector('.menu-btn');
  const nav = $header.querySelector('#nav');
  const label = btn.querySelector('.sr');
  const set = (open) => {
    btn.setAttribute('aria-expanded', String(open));
    label.textContent = open ? ui[lang].menuClose : ui[lang].menuOpen;
    $header.classList.toggle('is-open', open);
  };
  btn.addEventListener('click', () => set(btn.getAttribute('aria-expanded') !== 'true'));
  nav.addEventListener('click', (e) => { if (e.target.closest('a')) set(false); });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && $header.classList.contains('is-open')) { set(false); btn.focus(); }
  });
  $header.querySelectorAll('[data-lang]').forEach((b) => b.addEventListener('click', () => setLang(b.dataset.lang)));
}

/* ---------- countdown ---------- */
function wireCountdown() {
  clearInterval(timer);
  const el = $main.querySelector('[data-countdown]');
  if (!el) return;
  const aside = $main.querySelector('[data-siestas]');
  const u = ui[lang].countdown;
  const nf = new Intl.NumberFormat(lang === 'en' ? 'en-GB' : 'es-ES');
  const unit = (n, [one, many], pad) =>
    `<span class="cd__unit"><span class="cd__n">${pad ? String(n).padStart(2, '0') : nf.format(n)}</span><span class="cd__l">${n === 1 ? one : many}</span></span>`;
  const tick = () => {
    const c = countdown(Date.now(), config.wedding);
    if (c.phase === 'before') {
      el.innerHTML = unit(c.days, u.days) + unit(c.hours, u.hours, true) + unit(c.minutes, u.minutes, true) + unit(c.seconds, u.seconds, true);
      if (aside) {
        const text = c.days > 1 ? ui[lang].siestas(nf.format(c.days)) : '';
        if (aside.textContent !== text) aside.textContent = text;
        aside.hidden = !text;
      }
    } else {
      if (aside) aside.hidden = true;
      el.innerHTML = `<p class="cd__msg">${c.phase === 'today' ? u.today : u.after}</p>`;
      clearInterval(timer);
    }
  };
  tick();
  timer = setInterval(tick, 1000);
}

/* ---------- header state ---------- */
function wireHeaderState() {
  const hero = $main.querySelector('.hero');
  if (!hero || !('IntersectionObserver' in window)) return;
  const io = new IntersectionObserver(([e]) => $header.classList.toggle('is-scrolled', !e.isIntersecting), {
    rootMargin: '-72px 0px 0px 0px',
  });
  io.observe(hero.querySelector('.hero__actions') || hero);
}

function wire() {
  wireNav();
  wireCountdown();
  wireHeaderState();
  initRsvp($main.querySelector('[data-rsvp]'), config, lang, rsvpState);
  initGallery($main, config, lang);
  initMap($main);
  initRoutes($main);
  initPacking($main, lang);
  initEasterEgg(config, lang);
}

if (lang !== PRERENDERED) render();
else { applyMeta(); wire(); }
document.documentElement.classList.add('js');
