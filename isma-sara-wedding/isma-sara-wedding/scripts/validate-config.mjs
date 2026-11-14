// Checks site/config.js for mistakes before publishing. Messages are in Spanish
// because they are meant for the couple. Run: npm run check
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

const isRealDate = (s) => DATE.test(s) && !Number.isNaN(Date.parse(s + 'T00:00:00Z'))
  && new Date(s + 'T00:00:00Z').toISOString().startsWith(s);
const bi = (v) => v && typeof v === 'object' && typeof v.es === 'string' && typeof v.en === 'string';

export function validateConfig(c) {
  const errors = [];
  const warnings = [];
  const err = (path, msg) => errors.push(`config.${path}: ${msg}`);
  const warn = (path, msg) => warnings.push(`config.${path}: ${msg}`);
  const optBi = (path, v) => { if (v != null && !bi(v)) err(path, "debe ser null o { es: '…', en: '…' }"); };

  if (!c || typeof c !== 'object') return { errors: ['No se encuentra «export const config» en site/config.js'], warnings };
  if (!c.couple?.first || !c.couple?.second) err('couple', 'faltan los nombres');

  const w = c.wedding || {};
  if (!isRealDate(w.date)) err('wedding.date', "debe ser una fecha real con formato 'AAAA-MM-DD'");
  try { new Intl.DateTimeFormat('es', { timeZone: w.timeZone }); } catch { err('wedding.timeZone', 'zona horaria no válida (p. ej. Europe/Madrid)'); }
  for (const k of ['ceremonyTime', 'receptionTime']) if (w[k] != null && !TIME.test(w[k])) err(`wedding.${k}`, "debe ser null o 'HH:MM'");
  if (w.countdownFallbackTime && !TIME.test(w.countdownFallbackTime)) err('wedding.countdownFallbackTime', "debe ser 'HH:MM'");
  if (!w.ceremonyTime) warn('wedding.ceremonyTime', 'sin hora de ceremonia: oculta; la cuenta atrás usa ' + (w.countdownFallbackTime || '00:00'));

  const v = c.venue || {};
  if (!v.name || !v.town) err('venue', 'faltan nombre o localidad');
  if (v.mapUrl && !/^https:\/\//.test(v.mapUrl)) err('venue.mapUrl', 'debe empezar por https://');
  optBi('venue.landmark', v.landmark);
  if (v.map != null) {
    const m = v.map;
    if (!(Math.abs(m.lat) <= 90 && Math.abs(m.lng) <= 180)) err('venue.map', 'lat y lng deben ser números (p. ej. lat: 38.97, lng: -5.78)');
    if (m.zoom != null && !(Number.isInteger(m.zoom) && m.zoom >= 3 && m.zoom <= 21)) err('venue.map.zoom', 'debe ser un número entero entre 3 y 21');
    if (typeof m.askFirst !== 'boolean') err('venue.map.askFirst', 'debe ser true o false');
    if (m.embedUrl != null && !/^https:\/\/(www\.)?google\.[a-z.]+\/maps\/embed\?/.test(m.embedUrl)) err('venue.map.embedUrl', "debe ser null o la dirección src de «Insertar un mapa» (https://www.google.com/maps/embed?…)");
  }

  try { const u = new URL(c.siteUrl); if (!u.pathname.endsWith('/')) err('siteUrl', 'debe terminar en /'); } catch { err('siteUrl', 'URL no válida'); }

  for (const k of ['welcome', 'story', 'closing']) if (!bi(c.messages?.[k])) err(`messages.${k}`, "necesita { es: '…', en: '…' }");

  const checkPhoto = (path, p) => {
    if (!p.src || !Number.isInteger(p.width) || !Number.isInteger(p.height)) err(path, 'necesita src, width y height (números enteros)');
    if (!bi(p.alt)) err(`${path}.alt`, 'necesita descripción { es, en }');
    if (p.caption != null && !bi(p.caption)) err(`${path}.caption`, 'debe ser null o { es, en }');
    if (p.position != null && !/^\d{1,3}% \d{1,3}%$/.test(p.position)) err(`${path}.position`, "debe ser como '50% 70%'");
    if (/^https?:/.test(p.src || '')) warn(path, 'mejor guardar la foto en site/assets/img/ que enlazarla desde otra web');
  };
  for (const k of ['hero', 'story']) if (c.photos?.[k] != null) checkPhoto(`photos.${k}`, c.photos[k]);
  if (c.photos?.gallery != null && !Array.isArray(c.photos.gallery)) err('photos.gallery', 'debe ser una lista [ … ]');
  (c.photos?.gallery || []).forEach((p, i) => checkPhoto(`photos.gallery[${i}]`, p));

  const r = c.rsvp || {};
  if (r.endpoint && !/^https:\/\/script\.google\.com\/macros\/s\/[\w-]+\/exec$/.test(r.endpoint)) {
    err('rsvp.endpoint', 'debe ser la URL /exec de Apps Script (https://script.google.com/macros/s/…/exec)');
  }
  if (!r.endpoint) warn('rsvp.endpoint', 'vacío: el formulario aparece como «aún no activo»');
  if (r.deadline != null) {
    if (!isRealDate(r.deadline)) err('rsvp.deadline', "debe ser null o 'AAAA-MM-DD'");
    else if (isRealDate(w.date) && r.deadline > w.date) err('rsvp.deadline', 'es posterior a la boda');
  } else warn('rsvp.deadline', 'sin fecha límite (POR CONFIRMAR)');
  if (r.celebration != null) {
    const cg = r.celebration;
    if (!/^https:\/\//.test(cg.gif || '')) err('rsvp.celebration.gif', 'debe ser una URL https del GIF (o poned celebration: null)');
    if (cg.still && !/^https:\/\//.test(cg.still)) err('rsvp.celebration.still', 'debe ser una URL https');
    if (!/^https:\/\//.test(cg.source || '')) err('rsvp.celebration.source', 'debe ser la página https del GIF (para el crédito)');
    if (!cg.alt?.es || !cg.alt?.en) err('rsvp.celebration.alt', 'necesita texto alternativo en es y en');
  }
  if (!Number.isInteger(r.maxPartySize) || r.maxPartySize < 1 || r.maxPartySize > 100) err('rsvp.maxPartySize', 'debe ser un número entero entre 1 y 100');
  for (const k of ['allowCompanions', 'allowChildren', 'allowUpdates', 'askDietary', 'askAccessibility']) {
    if (typeof r[k] !== 'boolean') err(`rsvp.${k}`, 'debe ser true o false');
  }

  const d = c.details || {};
  ['dressCode', 'parking', 'transport'].forEach((k) => optBi(`details.${k}`, d[k]));
  (d.notes || []).forEach((n, i) => { if (!bi(n)) err(`details.notes[${i}]`, "necesita { es, en }"); });

  (c.schedule || []).forEach((s, i) => {
    if (!TIME.test(s.time || '')) err(`schedule[${i}].time`, "debe ser 'HH:MM'");
    if (!bi(s.title)) err(`schedule[${i}].title`, 'necesita { es, en }');
    optBi(`schedule[${i}].description`, s.description);
  });

  optBi('travel.intro', c.travel?.intro);
  optBi('travel.routesNote', c.travel?.routesNote);
  if (c.stay != null) {
    optBi('stay.intro', c.stay.intro);
    (c.stay.groups || []).forEach((g, i) => {
      if (!bi(g.title)) err(`stay.groups[${i}].title`, 'necesita { es, en }');
      (g.places || []).forEach((p, j) => {
        const path = `stay.groups[${i}].places[${j}]`;
        if (!p.name) err(`${path}.name`, 'falta el nombre');
        if (p.url && !/^https:\/\//.test(p.url)) err(`${path}.url`, 'debe empezar por https://');
        optBi(`${path}.note`, p.note);
        optBi(`${path}.distance`, p.distance);
      });
    });
    (c.stay.platforms || []).forEach((p, i) => {
      if (!p.name || !/^https:\/\//.test(p.url || '')) err(`stay.platforms[${i}]`, 'necesita name y url https://');
    });
  }
  (c.curiosities || []).forEach((q, i) => {
    if (!bi(q.q) || !bi(q.a)) err(`curiosities[${i}]`, 'necesita q y a con { es, en }');
  });
  const MODES = ['car', 'train', 'bus', 'plane'];
  (c.travel?.routes || []).forEach((r, i) => {
    if (!bi(r.from)) err(`travel.routes[${i}].from`, 'necesita { es, en }');
    if (!Array.isArray(r.options) || !r.options.length) err(`travel.routes[${i}].options`, 'necesita al menos una opción');
    (r.options || []).forEach((o, j) => {
      const p = `travel.routes[${i}].options[${j}]`;
      if (!MODES.includes(o.mode)) err(`${p}.mode`, `debe ser uno de: ${MODES.join(', ')}`);
      optBi(`${p}.time`, o.time);
      optBi(`${p}.text`, o.text);
      if (o.directions != null && typeof o.directions.from !== 'string') err(`${p}.directions`, "debe ser null o { from: 'Ciudad' }");
    });
  });
  (c.travel?.accommodation || []).forEach((a, i) => {
    if (!a.name) err(`travel.accommodation[${i}].name`, 'falta el nombre');
    if (a.url && !/^https:\/\//.test(a.url)) err(`travel.accommodation[${i}].url`, 'debe empezar por https://');
    optBi(`travel.accommodation[${i}].note`, a.note);
  });

  (c.faq || []).forEach((q, i) => {
    if (!bi(q.q)) err(`faq[${i}].q`, 'necesita { es, en }');
    if (q.a != null && !bi(q.a)) err(`faq[${i}].a`, 'debe ser null (oculta) o { es, en }');
  });

  const p = c.privacy || {};
  if (p.contactEmail != null && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(p.contactEmail)) err('privacy.contactEmail', 'email no válido');
  if (p.contactEmail == null) warn('privacy.contactEmail', 'sin email de contacto (POR CONFIRMAR)');
  if (p.retainUntil != null && !isRealDate(p.retainUntil)) err('privacy.retainUntil', "debe ser 'AAAA-MM-DD'");

  return { errors, warnings };
}
