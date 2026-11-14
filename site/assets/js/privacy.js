// Language switch for the privacy notice page.
import { config } from '../../config.js';
import { ui } from './ui.js';
import { renderPrivacy } from './render.js';

const article = document.querySelector('[data-privacy]');
const back = document.querySelector('[data-back]');
const store = {
  get(k) { try { return localStorage.getItem(k); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch { /* ignore */ } },
};

function apply(lang) {
  document.documentElement.lang = lang;
  article.innerHTML = renderPrivacy(config, lang);
  back.textContent = ui[lang].backHome;
  back.href = lang === 'en' ? './?lang=en' : './';
  document.title = `${lang === 'en' ? 'Privacy notice' : 'Aviso de privacidad'} · ${config.couple.first} & ${config.couple.second}`;
  document.querySelectorAll('[data-lang]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.lang === lang)));
}

const q = new URLSearchParams(location.search).get('lang');
const initial = q === 'en' || q === 'es' ? q : store.get('lang') === 'en' ? 'en' : 'es';
if (initial !== 'es') apply(initial);
document.querySelectorAll('[data-lang]').forEach((b) => b.addEventListener('click', () => {
  store.set('lang', b.dataset.lang);
  apply(b.dataset.lang);
}));
