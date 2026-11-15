// Small joys: confetti, a toast, the secret omelette and the packing list.
// Everything here is optional (see `fun` in config.js) and respects
// "reduce motion": no confetti for people who asked their device for calm.
import { ui } from './ui.js';

const reduceMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
const COLORS = ['#a4844c', '#8e9c82', '#55624b', '#e2d2ac', '#c7643a', '#262a21'];
const store = {
  get(k) { try { return localStorage.getItem(k); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch { /* private mode */ } },
  del(k) { try { localStorage.removeItem(k); } catch { /* private mode */ } },
};

/** A short shower of paper confetti in the site's colours. */
export function confetti({ count = 150, duration = 4200 } = {}) {
  if (reduceMotion() || typeof document === 'undefined') return false;
  document.querySelector('canvas.confetti')?.remove();
  const canvas = document.createElement('canvas');
  canvas.className = 'confetti';
  canvas.setAttribute('aria-hidden', 'true');
  document.body.append(canvas);
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const W = window.innerWidth;
  const H = window.innerHeight;
  canvas.width = W * dpr;
  canvas.height = H * dpr;
  const ctx = canvas.getContext('2d');
  if (!ctx) { canvas.remove(); return false; }
  ctx.scale(dpr, dpr);
  const pieces = Array.from({ length: count }, (_, i) => ({
    x: Math.random() * W,
    y: -20 - Math.random() * H * 0.6,
    vx: (Math.random() - 0.5) * 2.4,
    vy: 1.6 + Math.random() * 2.6,
    a: Math.random() * Math.PI * 2,
    va: (Math.random() - 0.5) * 0.25,
    w: 6 + Math.random() * 6,
    h: 9 + Math.random() * 9,
    round: i % 7 === 0,
    color: COLORS[i % COLORS.length],
    sway: Math.random() * Math.PI * 2,
  }));
  const t0 = performance.now();
  const frame = (now) => {
    const age = now - t0;
    ctx.clearRect(0, 0, W, H);
    ctx.globalAlpha = age > duration - 700 ? Math.max(0, (duration - age) / 700) : 1;
    for (const p of pieces) {
      p.vy += 0.035;
      p.x += p.vx + Math.sin(now / 420 + p.sway) * 0.7;
      p.y += p.vy;
      p.a += p.va;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.a);
      ctx.fillStyle = p.color;
      if (p.round) {
        ctx.beginPath();
        ctx.arc(0, 0, p.w / 2, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.fillRect(-p.w / 2, -p.h / 2 * Math.abs(Math.cos(p.a * 1.7)), p.w, p.h * Math.abs(Math.cos(p.a * 1.7)) + 1);
      }
      ctx.restore();
    }
    if (age < duration) requestAnimationFrame(frame);
    else canvas.remove();
  };
  requestAnimationFrame(frame);
  return true;
}

/** A small message in the corner that closes itself. */
export function toast(title, body, closeLabel) {
  document.querySelector('.toast')?.remove();
  const el = document.createElement('div');
  el.className = 'toast';
  el.setAttribute('role', 'status');
  el.innerHTML = `
    <p class="toast__title"></p>
    <p class="toast__body"></p>
    <button type="button" class="toast__close"><span aria-hidden="true">×</span><span class="sr"></span></button>`;
  document.body.append(el);
  // fill after insertion so screen readers announce it
  requestAnimationFrame(() => {
    el.querySelector('.toast__title').textContent = title;
    el.querySelector('.toast__body').textContent = body;
    el.querySelector('.toast__close .sr').textContent = closeLabel;
  });
  const close = () => el.remove();
  el.querySelector('.toast__close').addEventListener('click', close);
  setTimeout(close, 8000);
  return el;
}

/* ---------- the secret omelette ---------- */
let eggLang = 'es';
let eggWired = false;
const SECRET = 'tortilla';

export function initEasterEgg(cfg, lang) {
  eggLang = lang;
  if (eggWired || !cfg.fun?.easterEgg) return;
  eggWired = true;
  let typed = '';
  document.addEventListener('keydown', (e) => {
    const el = e.target;
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (el && (el.isContentEditable || /^(input|textarea|select)$/i.test(el.tagName))) return;
    if (e.key.length !== 1) return;
    typed = (typed + e.key.toLowerCase()).slice(-SECRET.length);
    if (typed === SECRET) {
      typed = '';
      const u = ui[eggLang].egg;
      confetti();
      toast(`🥔 ${u.title}`, u.body, u.close);
    }
  });
}

/* ---------- packing list ---------- */
const PACK_KEY = 'maleta';

export function initPacking(root, lang) {
  const list = root.querySelector('[data-pack]');
  if (!list) return;
  const u = ui[lang].packing;
  const boxes = [...list.querySelectorAll('[data-pack-item]')];
  const progress = root.querySelector('[data-pack-progress]');
  const reset = root.querySelector('[data-pack-reset]');
  let saved = [];
  try { saved = JSON.parse(store.get(PACK_KEY) || '[]'); } catch { saved = []; }
  boxes.forEach((b) => { b.checked = saved.includes(Number(b.dataset.packItem)); });

  let wasComplete = boxes.length > 0 && boxes.every((b) => b.checked);
  const update = (fromUser) => {
    const done = boxes.filter((b) => b.checked);
    const complete = done.length === boxes.length;
    progress.textContent = complete ? u.done : u.progress(done.length, boxes.length);
    progress.classList.toggle('is-done', complete);
    reset.hidden = done.length === 0;
    if (done.length) store.set(PACK_KEY, JSON.stringify(done.map((b) => Number(b.dataset.packItem))));
    else store.del(PACK_KEY);
    if (fromUser && complete && !wasComplete) confetti({ count: 90, duration: 3000 });
    wasComplete = complete;
  };
  boxes.forEach((b) => b.addEventListener('change', () => update(true)));
  reset.addEventListener('click', () => {
    boxes.forEach((b) => { b.checked = false; });
    update(true);
    boxes[0]?.focus();
  });
  update(false);
}
