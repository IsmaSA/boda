// Renders the page from config + interface strings. Pure string functions so the
// same code pre-renders the Spanish page at build time (fast first paint, works
// without JavaScript, good for search engines) and re-renders on language change.
import { ui } from './ui.js';
import { formatDate, formatTime } from './time.js';
import { climateFigure } from './climachart.js';

const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ESC[c]);
/** Pick a language from a { es, en } value; tolerate plain strings. */
export const t = (v, lang) => (v == null ? '' : typeof v === 'string' ? v : v[lang] ?? v.es ?? '');
const has = (v) => v != null && v !== '' && !(Array.isArray(v) && v.length === 0);
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
const nb = (s) => esc(s).replace(/ /g, '&nbsp;');

/** Google Maps embed address for the venue (or the one pasted in config). */
export function mapEmbedUrl(cfg, lang) {
  const m = cfg.venue.map;
  if (!m) return '';
  if (m.embedUrl) return m.embedUrl;
  return `https://maps.google.com/maps?q=${m.lat},${m.lng}&z=${m.zoom || 16}&hl=${lang}&output=embed`;
}

export function venueLines(cfg) {
  const v = cfg.venue;
  return [v.street, [v.postalCode, v.town].filter(Boolean).join(' '), [v.province, v.region].filter(Boolean).join(', ')]
    .filter(Boolean);
}

/* ---------------- header ---------------- */
export function renderHeader(cfg, lang) {
  const u = ui[lang];
  const links = [
    ['nosotros', u.nav.story], ['boda', u.nav.details], ['programa', u.nav.schedule],
    ['como-llegar', u.nav.travel], ...(cfg.stay ? [['alojamiento', u.nav.stay]] : []), ['preguntas', u.nav.faq],
  ];
  return `
  <a class="skip" href="#contenido">${esc(u.skip)}</a>
  <div class="bar${cfg.photos?.hero ? ' bar--on-photo' : ''}">
    <a class="mono" href="#inicio" aria-label="${esc(u.homeLabel)}" translate="no">${esc(cfg.couple.first[0])}<span class="mono__amp" aria-hidden="true">&amp;</span>${esc(cfg.couple.second[0])}</a>
    <nav class="nav" id="nav" aria-label="${lang === 'en' ? 'Main' : 'Principal'}">
      <ul class="nav__list">
        ${links.map(([id, label]) => `<li><a href="#${id}">${esc(label)}</a></li>`).join('')}
        <li class="nav__cta-item"><a class="btn btn--small" href="#confirmar">${esc(u.nav.rsvp)}</a></li>
      </ul>
    </nav>
    <div class="bar__tools">
      <div class="lang" role="group" aria-label="${esc(u.langLabel)}">
        <button type="button" data-lang="es" aria-pressed="${lang === 'es'}" lang="es">ES</button>
        <button type="button" data-lang="en" aria-pressed="${lang === 'en'}" lang="en">EN</button>
      </div>
      <button type="button" class="menu-btn" aria-expanded="false" aria-controls="nav">
        <span class="menu-btn__icon" aria-hidden="true"></span><span class="sr">${esc(u.menuOpen)}</span>
      </button>
    </div>
  </div>`;
}

/* ---------------- main ---------------- */
export function renderMain(cfg, lang) {
  return [hero, story, gallery, details, schedule, travel, stay, packing, rsvp, faq, closing, viewer].map((f) => f(cfg, lang)).join('\n');
}

/** A photo is either one file ('…/foto.jpg') or a base name with -640/-1280.webp versions. */
export function photoFiles(photo) {
  if (/\.(jpe?g|png|webp|avif|gif)$/i.test(photo.src)) return { src: photo.src, srcset: '' };
  const big = Math.min(1280, photo.width);
  return { src: `${photo.src}-1280.webp`, srcset: `${photo.src}-640.webp ${Math.min(640, photo.width)}w, ${photo.src}-1280.webp ${big}w` };
}

function picture(photo, lang, cls, { eager = false, sizes = '100vw' } = {}) {
  const f = photoFiles(photo);
  const pos = photo.position ? ` style="object-position:${esc(photo.position)}"` : '';
  return `<img class="${cls}" src="${esc(f.src)}"${f.srcset ? ` srcset="${esc(f.srcset)}" sizes="${sizes}"` : ''} width="${photo.width}" height="${photo.height}" alt="${esc(t(photo.alt, lang))}"${pos} ${eager ? 'fetchpriority="high"' : 'loading="lazy"'} decoding="async">`;
}

/** All photos that open in the viewer, in order: story photo first, then the gallery. */
export function viewerPhotos(cfg) {
  return [cfg.photos?.story, ...(cfg.photos?.gallery || [])].filter(Boolean);
}

function hero(cfg, lang) {
  const u = ui[lang];
  const date = formatDate(cfg.wedding.date, lang, { day: 'numeric', month: 'long', year: 'numeric' });
  const photo = cfg.photos?.hero;
  const art = photo
    ? picture(photo, lang, 'hero__photo', { eager: true })
    : `<img class="hero__art-img" src="assets/img/dehesa.svg" width="1600" height="1000" alt="" fetchpriority="high">`;
  return `
<section class="hero${photo ? ' hero--photo' : ''}" id="inicio" aria-labelledby="hero-title">
  <div class="hero__inner">
    <h1 class="names" id="hero-title" translate="no">
      <span class="names__a">${esc(cfg.couple.first)}</span>
      <span class="names__amp" aria-label="${lang === 'en' ? 'and' : 'y'}">&amp;</span>
      <span class="names__b">${esc(cfg.couple.second)}</span>
    </h1>
    <p class="hero__date"><time datetime="${esc(cfg.wedding.date)}">${esc(date)}</time><br>${esc(cfg.venue.town)}</p>
    <p class="hero__welcome">${esc(t(cfg.messages.welcome, lang))}</p>
    <p class="hero__actions"><a class="btn" href="#confirmar">${esc(u.cta)}</a></p>
    <div class="countdown" data-countdown role="timer" aria-label="${esc(u.countdown.label)}">
      <noscript><p>${esc(date)}</p></noscript>
    </div>
    ${cfg.fun?.siestas ? '<p class="cd__aside" data-siestas hidden></p>' : ''}
  </div>
  <div class="hero__art">${art}</div>
</section>`;
}

function story(cfg, lang) {
  const u = ui[lang];
  const photo = cfg.photos?.story;
  return `
<section class="story${photo ? ' story--photo' : ''}" id="nosotros" aria-labelledby="story-title">
  ${photo ? `<figure class="story__photo"><button type="button" class="ph" data-photo="0">${picture(photo, lang, 'story__img', { sizes: '(min-width: 56rem) 38vw, 92vw' })}<span class="sr"> ${esc(u.photoOpen)}</span></button></figure>` : ''}
  <div class="story__text">
    <h2 id="story-title" class="h2 story__title">${esc(u.storyTitle)}</h2>
    <p class="story__body">${esc(t(cfg.messages.story, lang))}</p>
    <p class="story__sign" translate="no">${esc(cfg.couple.first)} <span aria-hidden="true">&amp;</span><span class="sr">${lang === 'en' ? 'and' : 'y'}</span> ${esc(cfg.couple.second)}</p>
  </div>
</section>`;
}

function gallery(cfg, lang) {
  const u = ui[lang];
  const list = cfg.photos?.gallery || [];
  if (!list.length) return '';
  const offset = cfg.photos?.story ? 1 : 0;
  return `
<section class="gallery" id="fotos" aria-labelledby="gallery-title">
  <h2 class="h2 gallery__title" id="gallery-title">${esc(u.galleryTitle)}</h2>
  <ul class="gallery__grid" role="list">
    ${list.map((p, i) => `
    <li class="gallery__item${p.width > p.height ? ' gallery__item--wide' : ''}">
      <figure>
        <button type="button" class="ph" data-photo="${i + offset}">${picture(p, lang, 'gallery__img', { sizes: '(min-width: 48rem) 30vw, 46vw' })}<span class="sr"> ${esc(u.photoOpen)}</span></button>
        ${has(t(p.caption, lang)) ? `<figcaption>${esc(t(p.caption, lang))}</figcaption>` : ''}
      </figure>
    </li>`).join('')}
  </ul>
</section>`;
}

function viewer(cfg, lang) {
  const u = ui[lang];
  if (!viewerPhotos(cfg).length) return '';
  return `
  <dialog class="viewer" data-viewer aria-label="${esc(u.viewer.label)}">
    <div class="viewer__stage">
      <img class="viewer__img" data-viewer-img alt="">
    </div>
    <p class="viewer__count" data-viewer-count aria-live="polite"></p>
    <button type="button" class="viewer__btn viewer__btn--prev" data-viewer-prev aria-label="${esc(u.viewer.prev)}"><span aria-hidden="true">‹</span></button>
    <button type="button" class="viewer__btn viewer__btn--next" data-viewer-next aria-label="${esc(u.viewer.next)}"><span aria-hidden="true">›</span></button>
    <button type="button" class="viewer__btn viewer__btn--close" data-viewer-close aria-label="${esc(u.viewer.close)}"><span aria-hidden="true">×</span></button>
  </dialog>`;
}

function details(cfg, lang) {
  const u = ui[lang];
  const w = cfg.wedding;
  const weekday = cap(formatDate(w.date, lang, { weekday: 'long' }));
  const dayMonth = formatDate(w.date, lang, { day: 'numeric', month: 'long' });
  const year = w.date.slice(0, 4);
  const rows = [];
  if (w.ceremonyTime) rows.push([u.ceremony, formatTime(w.ceremonyTime, lang)]);
  if (w.receptionTime) rows.push([u.reception, formatTime(w.receptionTime, lang)]);
  const d = cfg.details || {};
  if (has(d.dressCode)) rows.push([u.dressCode, t(d.dressCode, lang)]);
  return `
<section class="sec details" id="boda" aria-labelledby="details-title">
  <h2 class="h2 sec__title" id="details-title">${esc(u.detailsTitle)}</h2>
  <div class="sec__body">
    <p class="bigdate"><time datetime="${esc(w.date)}"><span class="bigdate__wd">${esc(weekday)}</span>
      <span class="bigdate__dm">${nb(dayMonth)}</span>
      <span class="bigdate__y">${lang === 'en' ? '' : 'de '}${year}</span></time></p>
    <div class="venue${cfg.venue.map ? ' venue--map' : ''}">
      <div class="venue__text">
        <p class="venue__name" translate="no">${esc(cfg.venue.name)}</p>
        ${has(t(cfg.venue.landmark, lang)) ? `<p class="venue__landmark">${esc(t(cfg.venue.landmark, lang))}</p>` : ''}
        <address class="venue__addr">${venueLines(cfg).map(esc).join('<br>')}</address>
        ${cfg.venue.mapUrl ? `<p><a class="btn btn--ghost" href="${esc(cfg.venue.mapUrl)}" target="_blank" rel="noopener">${esc(u.directions)}<span class="sr"> ${esc(u.directionsHint)}</span></a></p>` : ''}
      </div>
      ${mapBlock(cfg, lang)}
    </div>
    ${rows.length ? `<dl class="facts">${rows.map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join('')}</dl>` : ''}
    ${(d.notes || []).length ? `<ul class="notes">${d.notes.map((n) => `<li>${esc(t(n, lang))}</li>`).join('')}</ul>` : ''}
    ${calendarBlock(cfg, lang)}
  </div>
</section>`;
}

/* ---------------- add to calendar ---------------- */
const icsText = (s) => String(s).replace(/\\/g, '\\\\').replace(/([,;])/g, '\\$1').replace(/\n/g, '\\n');
const ymd = (iso) => iso.replace(/-/g, '');
const nextDay = (iso) => {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + 1)).toISOString().slice(0, 10);
};

/** Google Calendar link and an .ics file (as a data: URL) for the wedding day, all day. */
export function calendarLinks(cfg, lang) {
  const u = ui[lang].calendar;
  const w = cfg.wedding;
  const start = ymd(w.date);
  const end = ymd(nextDay(w.date));
  const where = [cfg.venue.name, ...venueLines(cfg)].join(', ');
  const details = u.details(cfg.siteUrl);
  const google = 'https://calendar.google.com/calendar/render?' + new URLSearchParams({
    action: 'TEMPLATE', text: u.event, dates: `${start}/${end}`, location: where, details,
  });
  const ics = [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Isma y Sara//Boda//ES', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:boda-${start}@isma-sara`,
    'DTSTAMP:20261115T000000Z',
    `DTSTART;VALUE=DATE:${start}`,
    `DTEND;VALUE=DATE:${end}`,
    `SUMMARY:${icsText(u.event)}`,
    `LOCATION:${icsText(where)}`,
    `DESCRIPTION:${icsText(details)}`,
    `URL:${cfg.siteUrl}`,
    'END:VEVENT', 'END:VCALENDAR', '',
  ].join('\r\n');
  return { google, ics: 'data:text/calendar;charset=utf-8,' + encodeURIComponent(ics) };
}

function calendarBlock(cfg, lang) {
  const u = ui[lang].calendar;
  const c = calendarLinks(cfg, lang);
  return `
    <div class="cal">
      <p class="cal__title">${esc(u.title)}</p>
      <p class="cal__note">${esc(u.note)}</p>
      <p class="cal__links">
        <a class="btn btn--small btn--ghost" href="${esc(c.google)}" target="_blank" rel="noopener" data-cal="google">${esc(u.google)}</a>
        <a class="btn btn--small btn--ghost" href="${esc(c.ics)}" download="boda-isma-sara.ics" data-cal="ics">${esc(u.ics)}</a>
      </p>
    </div>`;
}

function mapBlock(cfg, lang) {
  const m = cfg.venue.map;
  if (!m) return '';
  const u = ui[lang].map;
  return `
      <div class="map" data-map data-src="${esc(mapEmbedUrl(cfg, lang))}" data-ask="${m.askFirst === false ? '' : '1'}" data-title="${esc(u.title(cfg.venue.name))}">
        <div class="map__placeholder" data-map-placeholder>
          <svg class="map__pin" viewBox="0 0 24 34" aria-hidden="true" focusable="false"><path d="M12 0C5.4 0 0 5.3 0 11.9 0 20.8 12 34 12 34s12-13.2 12-22.1C24 5.3 18.6 0 12 0z"/><circle cx="12" cy="12" r="4.4"/></svg>
          <p class="map__place" translate="no">${esc(cfg.venue.name)}</p>
          <button type="button" class="btn btn--small" data-map-load>${esc(u.show)}</button>
          <p class="map__note">${esc(u.note)}</p>
        </div>
      </div>`;
}

function schedule(cfg, lang) {
  const u = ui[lang];
  const items = (cfg.schedule || []).filter((i) => i.time && has(t(i.title, lang)));
  const body = items.length
    ? `<ol class="timeline">${items.map((i) => `
        <li class="timeline__item">
          <time class="timeline__time" datetime="${esc(i.time)}">${esc(formatTime(i.time, lang))}</time>
          <div><h3 class="timeline__title">${esc(t(i.title, lang))}</h3>
          ${has(t(i.description, lang)) ? `<p>${esc(t(i.description, lang))}</p>` : ''}</div>
        </li>`).join('')}</ol>`
    : `<p class="soon">${esc(u.scheduleSoon)}</p>`;
  return `
<section class="sec schedule" id="programa" aria-labelledby="schedule-title">
  <h2 class="h2 sec__title" id="schedule-title">${esc(u.scheduleTitle)}</h2>
  <div class="sec__body">${body}</div>
</section>`;
}

function travel(cfg, lang) {
  const u = ui[lang];
  const d = cfg.details || {};
  const acc = cfg.travel?.accommodation || [];
  const blocks = [];
  blocks.push(`<div class="tblock"><h3 class="h3">${esc(u.travelVenue)}</h3>
    <p><span translate="no">${esc(cfg.venue.name)}</span><br>${venueLines(cfg).map(esc).join('<br>')}</p>
    ${cfg.venue.mapUrl ? `<p><a class="link" href="${esc(cfg.venue.mapUrl)}" target="_blank" rel="noopener">${esc(u.directions)}<span class="sr"> ${esc(u.directionsHint)}</span></a></p>` : ''}</div>`);
  if (has(d.parking)) blocks.push(`<div class="tblock"><h3 class="h3">${esc(u.parking)}</h3><p>${esc(t(d.parking, lang))}</p></div>`);
  if (has(d.transport)) blocks.push(`<div class="tblock"><h3 class="h3">${esc(u.transport)}</h3><p>${esc(t(d.transport, lang))}</p></div>`);
  if (acc.length) {
    blocks.push(`<div class="tblock tblock--wide"><h3 class="h3">${esc(u.accommodation)}</h3><ul class="stays">${acc.map((a) => `
      <li><span class="stays__name">${a.url ? `<a class="link" href="${esc(a.url)}" target="_blank" rel="noopener">${esc(a.name)}</a>` : esc(a.name)}</span>
      ${has(t(a.note, lang)) ? `<span class="stays__note">${esc(t(a.note, lang))}</span>` : ''}</li>`).join('')}</ul></div>`);
  }
  return `
<section class="sec travel" id="como-llegar" aria-labelledby="travel-title">
  <h2 class="h2 sec__title" id="travel-title">${esc(u.travelTitle)}</h2>
  <div class="sec__body">
    ${has(t(cfg.travel?.intro, lang)) ? `<p class="lede">${esc(t(cfg.travel.intro, lang))}</p>` : ''}
    <div class="tgrid">${blocks.join('')}</div>
    ${routes(cfg, lang)}
  </div>
</section>`;
}

const MODE_ICONS = {
  car: '<path d="M5 16.5h14M3.5 16.5V12l2-5h13l2 5v4.5"/><path d="M3.5 12h17"/><circle cx="7.5" cy="16.5" r="1.8"/><circle cx="16.5" cy="16.5" r="1.8"/>',
  train: '<rect x="6" y="3" width="12" height="13" rx="2.5"/><path d="M6 10h12M9.5 6.5h5"/><circle cx="9" cy="13" r=".9"/><circle cx="15" cy="13" r=".9"/><path d="M8.5 16l-2.5 4M15.5 16l2.5 4"/>',
  bus: '<rect x="4.5" y="3.5" width="15" height="14" rx="2"/><path d="M4.5 11h15M4.5 7h15"/><circle cx="8" cy="14.5" r=".9"/><circle cx="16" cy="14.5" r=".9"/><path d="M7 17.5V20M17 17.5V20"/>',
  plane: '<path d="M10.5 20.5l2-6.5-6 .5-1.5 2H3.5L5 13l-1.5-3.5H5l1.5 2 6 .5-2-6.5h2l4 6.5h4.5a1.5 1.5 0 0 1 0 3H16.5l-4 6.5z"/>',
};

/** Google Maps directions from a place to the venue (uses the venue's Google place). */
export function directionsUrl(cfg, from) {
  const q = new URLSearchParams({ api: '1', origin: from, destination: `${cfg.venue.name}, ${cfg.venue.town}`, travelmode: 'driving' });
  if (/query_place_id=([\w-]+)/.test(cfg.venue.mapUrl || '')) q.set('destination_place_id', cfg.venue.mapUrl.match(/query_place_id=([\w-]+)/)[1]);
  return `https://www.google.com/maps/dir/?${q}`;
}

function routes(cfg, lang) {
  const list = (cfg.travel?.routes || []).filter((r) => has(t(r.from, lang)) && (r.options || []).length);
  if (!list.length) return '';
  const u = ui[lang].routes;
  const icon = (m) => `<svg class="route__icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">${MODE_ICONS[m] || ''}</svg>`;
  return `
    <div class="routes" data-routes>
      <h3 class="h3 routes__title">${esc(u.title)}</h3>
      <div class="routes__tabs" role="tablist" aria-label="${esc(u.tabsLabel)}">
        ${list.map((r, i) => `<button type="button" role="tab" id="rt-${i}" aria-controls="rp-${i}" aria-selected="${i === 0}" tabindex="${i === 0 ? 0 : -1}">${esc(t(r.from, lang))}</button>`).join('')}
      </div>
      ${list.map((r, i) => `
      <div class="routes__panel" role="tabpanel" id="rp-${i}" aria-labelledby="rt-${i}" tabindex="0" data-route-panel>
        <h4 class="routes__city">${esc(t(r.from, lang))}</h4>
        <ul class="routes__list">
          ${r.options.map((o) => `
          <li class="route">
            <span class="route__mode">${icon(o.mode)}${esc(u.modes[o.mode] || o.mode)}</span>
            <div class="route__body">
              ${has(t(o.time, lang)) ? `<p class="route__time">${esc(t(o.time, lang))}</p>` : ''}
              ${has(t(o.text, lang)) ? `<p class="route__text">${esc(t(o.text, lang))}</p>` : ''}
              ${o.directions?.from ? `<p class="route__link"><a class="link" href="${esc(directionsUrl(cfg, o.directions.from))}" target="_blank" rel="noopener">${esc(u.directions)}<span class="sr"> (${esc(o.directions.from)})</span></a></p>` : ''}
            </div>
          </li>`).join('')}
        </ul>
      </div>`).join('')}
      ${has(t(cfg.travel?.routesNote, lang)) ? `<p class="routes__note">${esc(t(cfg.travel.routesNote, lang))}</p>` : ''}
    </div>`;
}

/* ---------------- RSVP form ---------------- */
// Allergy / diet options. Codes must match DIETS in apps-script/Code.gs.
export const DIET_CODES = ['gluten', 'lactosa', 'frutos_secos', 'marisco', 'pescado', 'huevo', 'vegetariano', 'vegano', 'otra'];

/** Largest party allowed per response (1 = only the guest). */
export function maxParty(cfg) {
  const r = cfg.rsvp;
  return r.allowCompanions ? Math.max(1, r.maxPartySize) : 1;
}

function errP(id) { return `<p class="field__err" id="${id}-err" hidden></p>`; }

/** One text field for a person. `part` is firstName or lastName; data-field is set later by renumbering. */
function nameField(uid, part, label, ph, auto, field) {
  const id = `f-${uid}-${part}`;
  return `
        <div class="field" data-part="${part}"${field ? ` data-field="${field}"` : ''}>
          <label for="${id}">${esc(label)}</label>
          <input id="${id}" type="text" data-name="${part}" maxlength="${part === 'firstName' ? 60 : 80}" autocomplete="${auto}" spellcheck="false" placeholder="${esc(ph)}" aria-describedby="${id}-err">
          ${errP(id)}
        </div>`;
}

/** Allergy / diet picker for one person. */
export function dietPicker(lang, uid, legend, fieldBase = '') {
  const f = ui[lang].f;
  const id = `f-${uid}-diet`;
  const oid = `f-${uid}-dietOther`;
  return `
        <fieldset class="field diet" data-part="diet"${fieldBase ? ` data-field="${fieldBase}diet"` : ''} aria-describedby="${id}-hint ${id}-err">
          <legend>${esc(legend)}</legend>
          <p class="hint" id="${id}-hint">${esc(f.dietHint)}</p>
          <div class="diet__opts">
            ${DIET_CODES.map((c) => `<label class="chip"><input type="checkbox" value="${c}" data-diet><span>${esc(f.diets[c])}</span></label>`).join('')}
          </div>
          ${errP(id)}
          <div class="field diet__other" data-part="dietOther"${fieldBase ? ` data-field="${fieldBase}dietOther"` : ''} hidden>
            <label for="${oid}">${esc(f.dietOther)}</label>
            <input id="${oid}" type="text" maxlength="200" data-diet-other autocomplete="off" placeholder="${esc(f.dietOtherPh)}" aria-describedby="${oid}-err">
            ${errP(oid)}
          </div>
        </fieldset>`;
}

/** A companion card (partner or another person). Built in the browser as people are added. */
export function personCard(cfg, lang, uid, role) {
  const f = ui[lang].f;
  const r = cfg.rsvp;
  const title = role === 'partner' ? f.partnerTitle : f.personTitle(1);
  return `
      <div class="person" data-person data-role="${role}" data-uid="${uid}">
        <div class="person__head">
          <h3 class="person__title" id="f-${uid}-title">${esc(title)}</h3>
          ${role === 'extra' ? `<button type="button" class="person__remove" data-remove aria-describedby="f-${uid}-title">${esc(f.removePerson)}</button>` : ''}
        </div>
        <div class="name-pair">
          ${nameField(uid, 'firstName', f.firstName, f.firstPh, 'off')}
          ${nameField(uid, 'lastName', f.lastName, f.lastPh, 'off')}
        </div>
        ${role === 'extra' && r.allowChildren ? `<label class="check__label check__label--inline"><input type="checkbox" data-child><span>${esc(f.child)}</span></label>` : ''}
        ${r.askDietary ? dietPicker(lang, uid, f.diet) : ''}
      </div>`;
}

function rsvp(cfg, lang) {
  const u = ui[lang];
  const f = u.f;
  const r = cfg.rsvp;
  const max = maxParty(cfg);
  const deadline = r.deadline ? formatDate(r.deadline, lang, { day: 'numeric', month: 'long', year: 'numeric' }) : '';
  const field = (id, label, control, hint = '') => `
      <div class="field" data-field="${id}">
        <label for="f-${id}">${label}</label>
        ${hint ? `<p class="hint" id="f-${id}-hint">${esc(hint)}</p>` : ''}
        ${control}
        <p class="field__err" id="f-${id}-err" hidden></p>
      </div>`;
  const area = (id, max, hintOn) =>
    `<textarea id="f-${id}" name="${id}" rows="3" maxlength="${max}" autocomplete="off" aria-describedby="${hintOn ? `f-${id}-hint ` : ''}f-${id}-err"></textarea>`;
  const radios = (name, opts) => `
        <div class="choice__opts">
          ${opts.map(([v, label]) => `<label class="choice__opt"><input type="radio" name="${name}" value="${v}"><span>${esc(label)}</span></label>`).join('')}
        </div>`;
  return `
<section class="rsvp" id="confirmar" aria-labelledby="rsvp-title">
  <div class="rsvp__intro">
    <h2 class="h2" id="rsvp-title">${esc(u.rsvpTitle)}</h2>
    <p>${esc(u.rsvpIntro)}</p>
    ${deadline ? `<p class="rsvp__deadline" data-deadline="${esc(r.deadline)}">${esc(u.rsvpDeadline(deadline))}</p>` : ''}
  </div>
  <div class="rsvp__panel" data-rsvp>
    <p class="notice" data-rsvp-notice role="status" aria-live="polite" hidden></p>
    <form class="form" novalidate data-rsvp-form data-max="${max}">
      <div class="name-pair">
        ${nameField('g', 'firstName', f.firstName, f.firstPh, 'given-name', 'people.0.firstName')}
        ${nameField('g', 'lastName', f.lastName, f.lastPh, 'family-name', 'people.0.lastName')}
      </div>

      <fieldset class="field choice" data-field="attending" aria-describedby="f-attending-err">
        <legend>${esc(f.attending)}</legend>
        ${radios('attending', [['yes', f.yes], ['no', f.no]])}
        <p class="field__err" id="f-attending-err" hidden></p>
      </fieldset>
      <p class="cond rsvp__no" data-when="no" hidden>${esc(u.rsvpNoNote)}</p>

      <div class="cond" data-when="yes" hidden>
        ${r.askDietary ? `<div data-guest-diet>${dietPicker(lang, 'g', f.yourDiet, 'people.0.')}</div>` : ''}
        ${max > 1 ? `
        <fieldset class="field choice" data-field="withPartner" aria-describedby="f-withPartner-err">
          <legend>${esc(f.withPartner)}</legend>
          ${radios('withPartner', [['yes', f.partnerYes], ['no', f.partnerNo]])}
          <p class="field__err" id="f-withPartner-err" hidden></p>
        </fieldset>
        <div class="partner-slot" data-partner-slot></div>
        <div class="others" data-others>
          <h3 class="others__title">${esc(f.othersTitle)}</h3>
          <p class="hint">${esc(f.othersHint(max))}</p>
          <div class="others__list" data-others-list></div>
          <div class="others__bar">
            <button type="button" class="btn btn--ghost btn--small" data-add><span aria-hidden="true">+</span> ${esc(f.addPerson)}</button>
            <p class="others__count" data-count aria-live="polite"></p>
          </div>
        </div>` : ''}
        ${r.askAccessibility ? field('accessibility', esc(f.accessibility), area('accessibility', 500, true), f.accessibilityHint) : ''}
        <div class="field check" data-field="healthConsent" data-consent hidden>
          <label class="check__label"><input type="checkbox" name="healthConsent" id="f-healthConsent" aria-describedby="f-healthConsent-err"><span>${esc(f.healthConsent)}</span></label>
          <p class="field__err" id="f-healthConsent-err" hidden></p>
        </div>
      </div>

      ${field('comments', esc(f.comments), area('comments', 1000, true), f.commentsHint)}

      <div class="hp" aria-hidden="true">
        <label for="f-website">${esc(f.honeypot)}</label>
        <input id="f-website" name="website" type="text" tabindex="-1" autocomplete="off">
      </div>

      <div class="field check" data-field="privacyAck">
        <label class="check__label"><input type="checkbox" name="privacyAck" id="f-privacyAck" required aria-describedby="f-privacyAck-err"><span>${f.privacy}</span></label>
        <p class="field__err" id="f-privacyAck-err" hidden></p>
      </div>

      <p class="form__status" role="status" aria-live="polite" data-rsvp-status></p>
      <button class="btn btn--submit" type="submit" data-rsvp-submit>${esc(f.submit)}</button>
    </form>
    <figure class="celebrate" data-rsvp-gif hidden></figure>
    <div class="done" data-rsvp-done hidden tabindex="-1"></div>
  </div>
</section>`;
}

/* ---------------- FAQ ---------------- */
export function faqItems(cfg, lang) {
  const u = ui[lang].faqAuto;
  const r = cfg.rsvp;
  const items = [];
  const date = formatDate(cfg.wedding.date, lang);
  const whereA = lang === 'en'
    ? `On ${date}, at ${cfg.venue.name} in ${cfg.venue.town} (${cfg.venue.province}).`
    : `El ${date}, en el ${cfg.venue.name}, en ${cfg.venue.town} (${cfg.venue.province}).`;
  items.push([u.whenWhereQ, whereA]);
  if (r.endpoint) items.push([u.howRsvpQ, u.howRsvpA]);
  if (r.deadline) items.push([u.deadlineQ, ui[lang].rsvpDeadline(formatDate(r.deadline, lang, { day: 'numeric', month: 'long', year: 'numeric' }))]);
  if (r.endpoint) items.push([u.companionQ, r.allowCompanions && r.maxPartySize > 1 ? u.companionA(r.maxPartySize) : u.companionNoA]);
  if (r.endpoint && r.askDietary) items.push([u.dietaryQ, u.dietaryA]);
  if (r.endpoint && r.allowUpdates) items.push([u.changeQ, u.changeA]);
  if (has(cfg.details?.dressCode)) items.push([u.dressQ, t(cfg.details.dressCode, lang)]);
  const acc = cfg.travel?.accommodation || [];
  if (cfg.stay) items.push([u.stayQ, u.stayA]);
  else if (acc.length) items.push([u.stayQ, acc.map((a) => a.name).join(', ') + '.']);
  if (cfg.venue.mapUrl) items.push([u.howGetQ, u.howGetA]);
  for (const q of cfg.faq || []) {
    if (has(t(q.q, lang)) && has(t(q.a, lang))) items.push([t(q.q, lang), t(q.a, lang)]);
  }
  return items;
}

function faq(cfg, lang) {
  const u = ui[lang];
  const items = faqItems(cfg, lang);
  const curios = (cfg.curiosities || []).filter((c) => has(t(c.q, lang)) && (has(t(c.a, lang)) || c.chart));
  const funFaq = (cfg.fun?.faq || []).filter((c) => has(t(c.q, lang)) && has(t(c.a, lang)));
  return `
<section class="sec faq" id="preguntas" aria-labelledby="faq-title">
  <h2 class="h2 sec__title" id="faq-title">${esc(u.faqTitle)}</h2>
  <div class="sec__body">
    ${items.map(([q, a]) => qa(q, a)).join('')}
    ${curios.length ? `
    <h3 class="h3 faq__sub">${esc(u.curiositiesTitle)}</h3>
    ${curios.map((c) => qa(t(c.q, lang), t(c.a, lang), c.chart === 'clima' ? climateFigure(lang) : '')).join('')}` : ''}
    ${funFaq.length ? `
    <h3 class="h3 faq__sub">${esc(u.funFaqTitle)}</h3>
    ${funFaq.map((c) => qa(t(c.q, lang), t(c.a, lang))).join('')}` : ''}
  </div>
</section>`;
}

function qa(q, a, extra = '') {
  return `
    <details class="qa">
      <summary class="qa__q"><span>${esc(q)}</span><span class="qa__mark" aria-hidden="true"></span></summary>
      <div class="qa__a">${a ? `<p>${esc(a)}</p>` : ''}${extra}</div>
    </details>`;
}

function stay(cfg, lang) {
  const s = cfg.stay;
  if (!s) return '';
  const u = ui[lang].stay;
  const groups = (s.groups || []).filter((g) => (g.places || []).length);
  const tel = (p) => p.replace(/[^\d+]/g, '');
  const isMaps = (url) => /google\.[a-z.]+\/maps/.test(url || '');
  return `
<section class="sec stay" id="alojamiento" aria-labelledby="stay-title">
  <h2 class="h2 sec__title" id="stay-title">${esc(u.title)}</h2>
  <div class="sec__body">
    ${has(t(s.intro, lang)) ? `<p class="lede">${esc(t(s.intro, lang))}</p>` : ''}
    ${groups.map((g) => `
    <div class="stay__group">
      <h3 class="h3 stay__group-title">${esc(t(g.title, lang))}</h3>
      <ul class="stay__list">
        ${g.places.map((p) => `
        <li class="place">
          <div class="place__head">
            <p class="place__name">${esc(p.name)}</p>
            ${has(t(p.distance, lang)) ? `<p class="place__dist">${esc(t(p.distance, lang))}</p>` : ''}
          </div>
          ${has(t(p.note, lang)) ? `<p class="place__note">${esc(t(p.note, lang))}</p>` : ''}
          <p class="place__links">
            ${p.url ? `<a class="link" href="${esc(p.url)}" target="_blank" rel="noopener">${esc(isMaps(p.url) ? u.map : u.web)}<span class="sr"> (${esc(p.name)})</span></a>` : ''}
            ${p.phone ? `<a class="link place__phone" href="tel:${esc(tel(p.phone))}"><span class="sr">${esc(u.phone)} ${esc(p.name)}: </span>${esc(p.phone)}</a>` : ''}
          </p>
        </li>`).join('')}
      </ul>
    </div>`).join('')}
    ${(s.platforms || []).length ? `
    <div class="stay__group stay__platforms">
      <h3 class="h3 stay__group-title">${esc(u.other)}</h3>
      <div class="platforms">
        ${s.platforms.map((p) => `
        <a class="platform" href="${esc(p.url)}" target="_blank" rel="noopener">
          <span class="platform__name">${esc(u.search(p.name))}</span>
          ${has(t(p.note, lang)) ? `<span class="platform__note">${esc(t(p.note, lang))}</span>` : ''}
        </a>`).join('')}
      </div>
      <p class="stay__dates">${esc(u.dates)}</p>
    </div>` : ''}
  </div>
</section>`;
}

/* ---------------- packing list ---------------- */
function packing(cfg, lang) {
  const items = (cfg.fun?.packing || []).filter((p) => has(t(p.item, lang)));
  if (!items.length) return '';
  const u = ui[lang].packing;
  return `
<section class="sec packing" id="maleta" aria-labelledby="packing-title">
  <h2 class="h2 sec__title" id="packing-title">${esc(u.title)}</h2>
  <div class="sec__body">
    <p class="lede">${esc(u.intro)}</p>
    <ul class="pack" role="list" data-pack>
      ${items.map((p, i) => `
      <li class="pack__item">
        <label class="pack__label">
          <input type="checkbox" class="pack__box" data-pack-item="${i}">
          <span class="pack__text"><span class="pack__name">${esc(t(p.item, lang))}</span>
          ${has(t(p.note, lang)) ? `<span class="pack__note">${esc(t(p.note, lang))}</span>` : ''}</span>
        </label>
      </li>`).join('')}
    </ul>
    <div class="pack__bar">
      <p class="pack__progress" data-pack-progress role="status" aria-live="polite">${esc(u.progress(0, items.length))}</p>
      <button type="button" class="link link--btn" data-pack-reset hidden>${esc(u.reset)}</button>
    </div>
  </div>
</section>`;
}

function closing(cfg, lang) {
  const u = ui[lang];
  const date = formatDate(cfg.wedding.date, lang, { day: 'numeric', month: 'long', year: 'numeric' });
  return `
<section class="closing">
  <h2 class="closing__names" id="closing-title" translate="no">${esc(cfg.couple.first)} <span class="names__amp" aria-label="${lang === 'en' ? 'and' : 'y'}">&amp;</span> ${esc(cfg.couple.second)}</h2>
  <p class="closing__date"><time datetime="${esc(cfg.wedding.date)}">${esc(date)}</time></p>
  <p class="closing__msg">${esc(t(cfg.messages.closing, lang))}</p>
  <p><a class="btn btn--light" href="#confirmar">${esc(u.closingCta)}</a></p>
</section>`;
}

/* ---------------- footer ---------------- */
export function renderFooter(cfg, lang) {
  const u = ui[lang];
  return `
  <p><a class="link" href="privacidad.html${lang === 'en' ? '?lang=en' : ''}">${esc(u.privacyLink)}</a></p>
  <p class="footer__small">${esc(u.footerArt)}</p>
  <p class="footer__small footer__joke">${esc(u.footerJoke)}</p>`;
}

/* ---------------- privacy notice ---------------- */
export function renderPrivacy(cfg, lang) {
  const c = cfg.couple;
  const contact = cfg.privacy?.contactEmail;
  const until = cfg.privacy?.retainUntil ? formatDate(cfg.privacy.retainUntil, lang, { day: 'numeric', month: 'long', year: 'numeric' }) : null;
  const mail = contact ? `<a class="link" href="mailto:${esc(contact)}">${esc(contact)}</a>` : null;
  if (lang === 'en') {
    return `
  <h1 class="h2">Privacy notice</h1>
  <p class="lede">This notice explains what happens to the information you send through the RSVP form on this website.</p>
  <h2 class="h3">Who is responsible</h2>
  <p>${esc(c.first)} and ${esc(c.second)}, the couple getting married, as private individuals.</p>
  <h2 class="h3">What we collect and why</h2>
  <p>Your name; whether you will attend; how many people are coming and their names; and, only if you choose to tell us, allergies or dietary needs, accessibility needs and comments. We use this solely to organise the wedding: guest numbers, seating, the menu and any help you may need.</p>
  <h2 class="h3">Allergies and accessibility</h2>
  <p>This information can relate to health. We only store it if you give explicit consent in the form. We share the menu-related part with the restaurant, without anything that isn’t needed.</p>
  <h2 class="h3">Who can see it and where it is stored</h2>
  <p>Only ${esc(c.first)} and ${esc(c.second)}. Responses are stored in a private Google Sheets spreadsheet in their Google account; Google acts as the storage provider. They may also receive a copy of each response by email in that same account, as a backup. The spreadsheet is not public and this website cannot display other guests’ responses.</p>
  <h2 class="h3">How long we keep it</h2>
  <p>${until ? `Until ${esc(until)} at the latest. Allergy and accessibility details are deleted after the wedding.` : 'Only as long as needed to organise the wedding. Allergy and accessibility details are deleted after the wedding.'}</p>
  <h2 class="h3">Your rights</h2>
  <p>You can ask to see, correct or delete your information at any time${mail ? ` by writing to ${mail}` : ` by contacting ${esc(c.first)} or ${esc(c.second)} directly`}. You can also change your response with the private link you get after sending the form. If you think your data has been mishandled, you can complain to the Spanish Data Protection Agency (aepd.es).</p>
  <h2 class="h3">Cookies</h2>
  <p>This website uses no cookies and no analytics. It only remembers your language choice in your own browser. If your response cannot be sent because of a connection problem, it is kept in your browser until it has been delivered, and then removed.</p>
  ${cfg.rsvp?.celebration ? `<h2 class="h3">GIPHY</h2>
  <p>When you send the form, a GIF is shown that loads from GIPHY. GIPHY receives your IP address under its own privacy policy (giphy.com/privacy). Nothing from the form is sent to GIPHY.</p>` : ''}
  <h2 class="h3">Google Maps</h2>
  <p>${cfg.venue.map?.askFirst === false ? 'The map next to the venue address is loaded from Google Maps.' : 'The map next to the venue address only loads if you press “Show map”. Your browser then remembers that choice.'} Google may set cookies and receive your IP address under its own privacy policy (policies.google.com). The rest of the website works without it.</p>`;
  }
  return `
  <h1 class="h2">Aviso de privacidad</h1>
  <p class="lede">Este aviso explica qué ocurre con los datos que envías mediante el formulario de confirmación de esta web.</p>
  <h2 class="h3">Quién es responsable</h2>
  <p>${esc(c.first)} y ${esc(c.second)}, los novios, como particulares.</p>
  <h2 class="h3">Qué datos recogemos y para qué</h2>
  <p>Tu nombre; si asistirás; cuántas personas venís y sus nombres; y, solo si decides contárnoslo, alergias o dieta, necesidades de accesibilidad y comentarios. Los usamos únicamente para organizar la boda: número de invitados, mesas, menú y la ayuda que puedas necesitar.</p>
  <h2 class="h3">Alergias y accesibilidad</h2>
  <p>Esta información puede referirse a la salud. Solo la guardamos si das tu consentimiento expreso en el formulario. Al restaurante le trasladamos únicamente lo necesario para el menú.</p>
  <h2 class="h3">Quién los ve y dónde se guardan</h2>
  <p>Solo ${esc(c.first)} y ${esc(c.second)}. Las respuestas se guardan en una hoja de cálculo privada de Google Sheets en su cuenta de Google, que actúa como proveedor de almacenamiento. Como respaldo, pueden recibir además una copia de cada respuesta por correo en esa misma cuenta. La hoja no es pública y esta web no puede mostrar las respuestas de otros invitados.</p>
  <h2 class="h3">Cuánto tiempo los conservamos</h2>
  <p>${until ? `Como máximo hasta el ${esc(until)}. Los datos de alergias y accesibilidad se borran después de la boda.` : 'Solo el tiempo necesario para organizar la boda. Los datos de alergias y accesibilidad se borran después de la boda.'}</p>
  <h2 class="h3">Tus derechos</h2>
  <p>Puedes pedir ver, corregir o borrar tus datos en cualquier momento${mail ? ` escribiendo a ${mail}` : ` contactando directamente con ${esc(c.first)} o ${esc(c.second)}`}. También puedes cambiar tu respuesta con el enlace privado que recibes al enviar el formulario. Si crees que tus datos no se han tratado bien, puedes reclamar ante la Agencia Española de Protección de Datos (aepd.es).</p>
  <h2 class="h3">Cookies</h2>
  <p>Esta web no usa cookies ni analítica. Solo recuerda en tu propio navegador el idioma elegido. Si tu respuesta no puede enviarse por un problema de conexión, se guarda en tu navegador hasta que llega y después se borra.</p>
  ${cfg.rsvp?.celebration ? `<h2 class="h3">GIPHY</h2>
  <p>Al enviar el formulario aparece un GIF que se carga desde GIPHY, que recibe tu dirección IP según su propia política de privacidad (giphy.com/privacy). No se envía a GIPHY ningún dato del formulario.</p>` : ''}
  <h2 class="h3">Google Maps</h2>
  <p>${cfg.venue.map?.askFirst === false ? 'El mapa junto a la dirección del restaurante se carga desde Google Maps.' : 'El mapa junto a la dirección del restaurante solo se carga si pulsas «Mostrar mapa»; tu navegador recuerda esa elección.'} Google puede usar cookies y recibir tu dirección IP según su propia política de privacidad (policies.google.com). El resto de la web funciona sin él.</p>`;
}
