/**
 * Isma & Sara — RSVP backend (Google Apps Script, bound to a PRIVATE Google Sheet)
 * ---------------------------------------------------------------------------
 * Deploy:   Extensions → Apps Script → paste this file → run `setup` once →
 *           Deploy → New deployment → Web app
 *             Execute as:      Me
 *             Who has access:  Anyone
 * Then copy the /exec URL into site/config.js → rsvp.endpoint
 *
 * Sheets created by `setup`:
 *   Resumen     totals, people per allergy
 *   Respuestas  one row per response (the guest who filled the form)
 *   Personas    one row per attending person (guest, partner, others) with
 *               name, surname and allergies — the list for the restaurant
 *   Historial   previous versions of changed responses
 *
 * Security model (read docs/RSVP-BACKEND.md):
 *  - The spreadsheet is never shared or published. The web app only WRITES new
 *    responses and lets a guest read/update THEIR OWN response with a secret,
 *    unguessable edit token (only its SHA-256 hash is stored).
 *  - There is NO endpoint that lists responses.
 *  - Every reply is kept: rows are read back before the guest is told they were
 *    saved; retries never duplicate; suspicious replies are stored and flagged,
 *    never discarded; optional email copy (NOTIFY_EMAIL).
 *  - Anyone who knows the /exec URL can submit (that is inherent to a public
 *    form). Mitigations: server-side validation, honeypot and minimum fill time
 *    (flag for review), global rate limits, idempotency keys, duplicate-name
 *    flagging, and formula-injection neutralisation. Apps Script does not expose
 *    client IPs, so per-visitor rate limiting is not possible.
 *
 * Settings live in Project Settings → Script properties (all optional):
 *   RSVP_DEADLINE     YYYY-MM-DD (inclusive, Europe/Madrid). Empty = no deadline.
 *   MAX_PARTY         Max people per response incl. the guest (default 50).
 *   ALLOW_COMPANIONS  true/false (default true): partner and other people
 *   ALLOW_CHILDREN    true/false (default false)
 *   ALLOW_UPDATES     true/false (default true)
 *   RATE_10MIN        Max accepted submissions per 10 min, all guests (default 40)
 *   RATE_DAY          Max accepted submissions per day, all guests (default 400)
 *   NOTIFY_EMAIL      If set, every new or changed reply is also emailed here (backup copy)
 *   PURGE_DATE        YYYY-MM-DD for the automatic deletion of allergy data
 * Keep these consistent with site/config.js — the server is the authority.
 */

var SHEET_RESPONSES = 'Respuestas';
var SHEET_PEOPLE = 'Personas';
var SHEET_HISTORY = 'Historial';
var SHEET_SUMMARY = 'Resumen';
var TZ = 'Europe/Madrid';

var HEADERS = [
  'id', 'recibido', 'actualizado', 'nombre', 'apellidos', 'asistencia', 'personas',
  'pareja', 'acompanantes', 'ninos', 'alergias', 'accesibilidad', 'comentarios',
  'idioma', 'estado', 'consentimiento_salud', 'request_id', 'token_hash'
];
var COL = {};
HEADERS.forEach(function (h, i) { COL[h] = i; });

var PEOPLE_HEADERS = ['id_respuesta', 'nombre', 'apellidos', 'rol', 'nino', 'alergias', 'otra_alergia'];
var PCOL = {};
PEOPLE_HEADERS.forEach(function (h, i) { PCOL[h] = i; });

// Allergy / diet options. Codes must match DIET_CODES in site/assets/js/render.js.
var DIETS = {
  gluten: 'Sin gluten (celiaquía)',
  lactosa: 'Sin lactosa',
  frutos_secos: 'Frutos secos',
  marisco: 'Marisco',
  pescado: 'Pescado',
  huevo: 'Huevo',
  vegetariano: 'Vegetariano',
  vegano: 'Vegano',
  otra: 'Otra'
};
var ROLES = { guest: 'Invitado/a', partner: 'Pareja', extra: 'Acompañante' };

var LIMITS = { first: 60, last: 80, dietOther: 200, accessibility: 500, comments: 1000 };
var MIN_FILL_MS = 3000;
var STATUS_SPAM = 'Revisar: posible spam';
var STATUS_DUP = 'Revisar: posible duplicado';

/* ------------------------------------------------------------------ */
/* HTTP entry points                                                   */
/* ------------------------------------------------------------------ */

function doGet() {
  // Health check only. Never returns guest data.
  return json_({ ok: true, service: 'rsvp' });
}

function doPost(e) {
  var body;
  try {
    body = JSON.parse((e && e.postData && e.postData.contents) || '');
  } catch (err) {
    return json_({ ok: false, error: 'bad_request' });
  }
  if (!body || typeof body !== 'object') return json_({ ok: false, error: 'bad_request' });

  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(20000);
  } catch (err) {
    return json_({ ok: false, error: 'busy' });
  }
  try {
    var action = String(body.action || 'submit');
    if (action === 'submit') return json_(handleSubmit_(body));
    if (action === 'load') return json_(handleLoad_(body));
    if (action === 'update') return json_(handleUpdate_(body));
    return json_({ ok: false, error: 'bad_request' });
  } catch (err) {
    console.error(err && err.stack ? err.stack : err);
    return json_({ ok: false, error: 'server_error' });
  } finally {
    lock.releaseLock();
  }
}

/* ------------------------------------------------------------------ */
/* Actions                                                             */
/* ------------------------------------------------------------------ */

function handleSubmit_(body) {
  var settings = settings_();

  var requestId = String(body.requestId || '');
  if (!/^[a-f0-9-]{36}$/i.test(requestId)) return { ok: false, error: 'bad_request' };

  var v = validate_(body, settings);
  if (!v.ok) return v;

  var cache = CacheService.getScriptCache();
  var cached = cache.get('req:' + requestId);
  var sheet = responsesSheet_();
  var rows = dataRows_(sheet);

  // Same requestId = the same guest retrying (double click, lost connection,
  // a timeout after the row was already written). Never a second row:
  // identical content returns the original result, changed content updates it.
  for (var i = 0; i < rows.length; i++) {
    if (rows[i][COL.request_id] !== requestId) continue;
    var prev = cached ? JSON.parse(cached) : { ok: true, id: rows[i][COL.id], editable: false, duplicate: true };
    if (sameContent_(rows[i], toRow_(v.data))) return prev;
    if (deadlinePassed_(settings)) return { ok: false, error: 'closed' };
    writeUpdate_(sheet, i + 2, rows[i], v.data);
    notify_(settings, 'actualizada', rows[i][COL.id], v.data, rows[i][COL.estado]);
    return prev;
  }

  if (deadlinePassed_(settings)) return { ok: false, error: 'closed' };
  if (!rateAllow_(settings)) return { ok: false, error: 'rate_limited' };

  // Bot signals (hidden field filled, sent in under 3 s) never discard a reply:
  // it is stored and flagged so you can check it. A real guest is never lost.
  var started = Number(body.startedAt);
  var suspicious = !!body.website || !started || Date.now() - started < MIN_FILL_MS;
  var status = suspicious ? STATUS_SPAM : 'Nueva';
  if (!suspicious) {
    var key = normaliseName_(v.data.name);
    for (var j = 0; j < rows.length; j++) {
      if (normaliseName_(fullName_(rows[j][COL.nombre], rows[j][COL.apellidos])) === key) { status = STATUS_DUP; break; }
    }
  }

  var now = new Date();
  var id = 'R-' + Utilities.formatDate(now, TZ, 'yyMMdd') + '-' + Utilities.getUuid().slice(0, 6).toUpperCase();
  var token = settings.allowUpdates ? newToken_() : '';
  var row = toRow_(v.data);
  row[COL.id] = id;
  row[COL.recibido] = now;
  row[COL.actualizado] = '';
  row[COL.estado] = status;
  row[COL.request_id] = requestId;
  row[COL.token_hash] = token ? sha256_(token) : '';
  sheet.appendRow(row);
  writePeople_(id, v.data);

  // Only answer "saved" after reading the rows back from the sheets.
  SpreadsheetApp.flush();
  var written = sheet.getRange(sheet.getLastRow(), 1, 1, HEADERS.length).getValues()[0];
  if (written[COL.request_id] !== requestId || written[COL.id] !== id) {
    throw new Error('Write verification failed for ' + requestId);
  }
  verifyPeople_(id, v.data);

  var result = { ok: true, id: id, editable: !!token };
  if (token) result.token = token;
  cache.put('req:' + requestId, JSON.stringify(result), 21600); // 6 h
  rateCount_();
  notify_(settings, 'nueva', id, v.data, status);
  return result;
}

function handleLoad_(body) {
  var settings = settings_();
  if (!settings.allowUpdates) return { ok: false, error: 'updates_disabled' };
  var found = findByToken_(body.token);
  if (!found) return { ok: false, error: 'not_found' };
  var r = found.row;
  var attending = r[COL.asistencia] === 'Sí' ? 'yes' : 'no';
  var people = peopleFor_(r[COL.id]).map(function (p) {
    var diet = String(p[PCOL.alergias] || '').split(', ').map(dietCode_).filter(Boolean);
    return {
      role: roleCode_(p[PCOL.rol]),
      firstName: unescape_(p[PCOL.nombre]),
      lastName: unescape_(p[PCOL.apellidos]),
      child: p[PCOL.nino] === 'Sí',
      diet: diet,
      dietOther: unescape_(p[PCOL.otra_alergia])
    };
  });
  if (!people.length) {
    people = [{ role: 'guest', firstName: unescape_(r[COL.nombre]), lastName: unescape_(r[COL.apellidos]), child: false, diet: [], dietOther: '' }];
  }
  return {
    ok: true,
    id: r[COL.id],
    closed: deadlinePassed_(settings),
    data: {
      attending: attending,
      people: people,
      accessibility: unescape_(r[COL.accesibilidad]),
      comments: unescape_(r[COL.comentarios])
    }
  };
}

function handleUpdate_(body) {
  var settings = settings_();
  if (!settings.allowUpdates) return { ok: false, error: 'updates_disabled' };
  if (deadlinePassed_(settings)) return { ok: false, error: 'closed' };
  var found = findByToken_(body.token);
  if (!found) return { ok: false, error: 'not_found' };

  var v = validate_(body, settings);
  if (!v.ok) return v;

  if (!sameContent_(found.row, toRow_(v.data))) {
    writeUpdate_(responsesSheet_(), found.index, found.row, v.data);
    notify_(settings, 'actualizada', found.row[COL.id], v.data, found.row[COL.estado]);
  }
  return { ok: true, id: found.row[COL.id], editable: true, updated: true };
}

/** Saves the previous version in Historial, then overwrites the row (and its people) and verifies it. */
function writeUpdate_(sheet, index, old, data) {
  historySheet_().appendRow([new Date(), 'actualizada'].concat(old.slice(0, COL.request_id)));
  var row = toRow_(data);
  row[COL.id] = old[COL.id];
  row[COL.recibido] = old[COL.recibido];
  row[COL.actualizado] = new Date();
  // Keep a "Revisar…" flag until you clear it yourself.
  row[COL.estado] = /^Revisar/.test(String(old[COL.estado])) ? old[COL.estado] : 'Actualizada';
  row[COL.request_id] = old[COL.request_id];
  row[COL.token_hash] = old[COL.token_hash];
  sheet.getRange(index, 1, 1, HEADERS.length).setValues([row]);
  deletePeople_(old[COL.id]);
  writePeople_(old[COL.id], data);
  SpreadsheetApp.flush();
  var check = sheet.getRange(index, 1, 1, HEADERS.length).getValues()[0];
  if (check[COL.id] !== old[COL.id] || !sameContent_(check, row)) throw new Error('Update verification failed');
  verifyPeople_(old[COL.id], data);
}

/** True when the guest-entered columns are identical. */
function sameContent_(a, b) {
  var cols = [COL.nombre, COL.apellidos, COL.asistencia, COL.personas, COL.pareja, COL.acompanantes, COL.ninos,
    COL.alergias, COL.accesibilidad, COL.comentarios, COL.idioma, COL.consentimiento_salud];
  for (var i = 0; i < cols.length; i++) {
    if (String(a[cols[i]]) !== String(b[cols[i]])) return false;
  }
  return true;
}

/**
 * Optional second record: an email to NOTIFY_EMAIL for every new or changed reply.
 * A failed email never fails the reply (the sheet is the record).
 */
function notify_(settings, kind, id, d, status) {
  if (!settings.notifyEmail) return;
  try {
    var yes = d.attending === 'yes';
    var subject = 'Boda · ' + (kind === 'nueva' ? 'Nueva respuesta' : 'Respuesta actualizada') + ': ' + d.name +
      ' (' + (yes ? 'Sí, ' + d.partySize + (d.partySize === 1 ? ' persona' : ' personas') : 'No') + ')';
    var lines = [
      'Referencia: ' + id,
      'Estado: ' + (status || ''),
      'Asistencia: ' + (yes ? 'Sí' : 'No'),
      'Personas: ' + d.partySize,
      ''
    ];
    d.people.forEach(function (p) {
      var diet = dietText_(p);
      lines.push('· ' + ROLES[p.role] + ': ' + p.firstName + ' ' + p.lastName + (p.child ? ' (niño/a)' : '') +
        (diet ? ' — ' + diet : ''));
    });
    lines.push('', 'Accesibilidad: ' + d.accessibility, 'Comentarios: ' + d.comments, 'Idioma: ' + d.lang, '',
      'Esta copia es un respaldo. La lista completa está en las hojas «Respuestas» y «Personas».');
    MailApp.sendEmail(settings.notifyEmail, subject, lines.join('\n'));
  } catch (err) {
    console.error('notify failed: ' + err);
  }
}

/* ------------------------------------------------------------------ */
/* Validation                                                          */
/* ------------------------------------------------------------------ */

function validate_(b, s) {
  function fail(error, field) { return { ok: false, error: error, field: field }; }
  function text(v, max) {
    if (v === undefined || v === null) return '';
    if (typeof v !== 'string') return null;
    // strip control characters, normalise whitespace
    v = v.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '').replace(/\r\n?/g, '\n').trim();
    return v.length > max ? null : v;
  }
  function oneLine(v, max) {
    var t = text(v, max);
    return t === null ? null : t.replace(/\s+/g, ' ');
  }

  if (b.privacyAck !== true) return fail('privacy_required', 'privacyAck');

  var attending = b.attending;
  var list = Array.isArray(b.people) ? b.people : [];
  if (!list.length || !list[0] || list[0].role !== 'guest') return fail('required', 'people.0.firstName');

  var lang = b.lang === 'en' ? 'en' : 'es';
  var comments = text(b.comments, LIMITS.comments);
  if (comments === null) return fail('too_long', 'comments');

  var max = s.allowCompanions ? s.maxParty : 1;
  if (attending === 'yes' && list.length > max) return fail('too_many', 'people');

  var people = [];
  var partners = 0;
  var children = 0;
  var anyDiet = false;
  var count = attending === 'yes' ? list.length : 1; // a decline only records the guest
  for (var i = 0; i < count; i++) {
    var p = list[i] || {};
    var f = 'people.' + i + '.';
    var role = i === 0 ? 'guest' : p.role;
    if (i > 0 && role !== 'partner' && role !== 'extra') return fail('invalid', f + 'firstName');
    if (role === 'partner') partners++;
    if (i > 0 && !s.allowCompanions) return fail('too_many', 'people');
    if (partners > 1) return fail('invalid', f + 'firstName');

    var first = oneLine(p.firstName, LIMITS.first);
    if (first === null) return fail('too_long', f + 'firstName');
    if (!first) return fail('required', f + 'firstName');
    var last = oneLine(p.lastName, LIMITS.last);
    if (last === null) return fail('too_long', f + 'lastName');
    if (!last) return fail('required', f + 'lastName');

    var diet = [];
    var other = '';
    if (attending === 'yes') {
      var raw = Array.isArray(p.diet) ? p.diet : [];
      for (var k = 0; k < raw.length; k++) {
        if (!DIETS.hasOwnProperty(raw[k])) return fail('invalid', f + 'diet');
        if (diet.indexOf(raw[k]) < 0) diet.push(raw[k]);
      }
      other = oneLine(p.dietOther, LIMITS.dietOther);
      if (other === null) return fail('too_long', f + 'dietOther');
      if (diet.indexOf('otra') >= 0 && other.length < 2) return fail('required', f + 'dietOther');
      if (diet.indexOf('otra') < 0) other = '';
      if (diet.length) anyDiet = true;
    }
    var child = attending === 'yes' && role === 'extra' && s.allowChildren && p.child === true;
    if (child) children++;
    people.push({ role: role, firstName: first, lastName: last, child: child, diet: diet, dietOther: other });
  }

  if (attending !== 'yes' && attending !== 'no') return fail('required', 'attending');

  var access = attending === 'yes' ? text(b.accessibility, LIMITS.accessibility) : '';
  if (access === null) return fail('too_long', 'accessibility');
  if ((anyDiet || access) && b.healthConsent !== true) return fail('consent_required', 'healthConsent');

  var guest = people[0];
  return {
    ok: true,
    data: {
      name: guest.firstName + ' ' + guest.lastName,
      firstName: guest.firstName,
      lastName: guest.lastName,
      attending: attending,
      people: people,
      partySize: attending === 'yes' ? people.length : 0,
      children: children,
      accessibility: access,
      comments: comments,
      lang: lang,
      healthConsent: !!(anyDiet || access)
    }
  };
}

function toRow_(d) {
  var row = new Array(HEADERS.length).fill('');
  var yes = d.attending === 'yes';
  var partner = d.people.filter(function (p) { return p.role === 'partner'; })[0];
  var extras = d.people.filter(function (p) { return p.role === 'extra'; });
  row[COL.nombre] = safe_(d.firstName);
  row[COL.apellidos] = safe_(d.lastName);
  row[COL.asistencia] = yes ? 'Sí' : 'No';
  row[COL.personas] = d.partySize;
  row[COL.pareja] = partner ? safe_(partner.firstName + ' ' + partner.lastName) : '';
  row[COL.acompanantes] = safe_(extras.map(function (p) {
    return p.firstName + ' ' + p.lastName + (p.child ? ' (niño/a)' : '');
  }).join('; '));
  row[COL.ninos] = d.children;
  row[COL.alergias] = safe_(d.people.filter(function (p) { return p.diet.length; }).map(function (p) {
    return p.firstName + ' ' + p.lastName + ': ' + dietText_(p);
  }).join('; '));
  row[COL.accesibilidad] = safe_(d.accessibility);
  row[COL.comentarios] = safe_(d.comments);
  row[COL.idioma] = d.lang;
  row[COL.consentimiento_salud] = d.healthConsent ? 'Sí' : '';
  return row;
}

function dietText_(p) {
  return p.diet.map(function (c) { return c === 'otra' ? 'Otra: ' + p.dietOther : DIETS[c]; }).join(', ');
}
function dietCode_(label) {
  for (var c in DIETS) if (DIETS[c] === label) return c;
  return '';
}
function roleCode_(label) {
  for (var c in ROLES) if (ROLES[c] === label) return c;
  return 'extra';
}

/* ------------------------------------------------------------------ */
/* Personas sheet: one row per attending person                        */
/* ------------------------------------------------------------------ */

function peopleRows_(id, d) {
  if (d.attending !== 'yes') return [];
  return d.people.map(function (p) {
    var r = new Array(PEOPLE_HEADERS.length).fill('');
    r[PCOL.id_respuesta] = id;
    r[PCOL.nombre] = safe_(p.firstName);
    r[PCOL.apellidos] = safe_(p.lastName);
    r[PCOL.rol] = ROLES[p.role];
    r[PCOL.nino] = p.child ? 'Sí' : '';
    r[PCOL.alergias] = p.diet.map(function (c) { return DIETS[c]; }).join(', ');
    r[PCOL.otra_alergia] = safe_(p.dietOther);
    return r;
  });
}
function writePeople_(id, d) {
  var sh = peopleSheet_();
  peopleRows_(id, d).forEach(function (r) { sh.appendRow(r); });
}
function peopleFor_(id) {
  var sh = peopleSheet_();
  var last = sh.getLastRow();
  if (last < 2) return [];
  return sh.getRange(2, 1, last - 1, PEOPLE_HEADERS.length).getValues()
    .filter(function (r) { return r[PCOL.id_respuesta] === id; });
}
function deletePeople_(id) {
  var sh = peopleSheet_();
  var last = sh.getLastRow();
  if (last < 2) return;
  var ids = sh.getRange(2, 1, last - 1, 1).getValues();
  for (var i = ids.length - 1; i >= 0; i--) {
    if (ids[i][0] === id) sh.deleteRow(i + 2);
  }
}
function verifyPeople_(id, d) {
  var want = peopleRows_(id, d);
  var got = peopleFor_(id);
  if (got.length !== want.length) throw new Error('People verification failed for ' + id);
  for (var i = 0; i < want.length; i++) {
    if (String(got[i][PCOL.nombre]) !== String(want[i][PCOL.nombre]) ||
        String(got[i][PCOL.alergias]) !== String(want[i][PCOL.alergias])) {
      throw new Error('People verification failed for ' + id);
    }
  }
}

/** Neutralise spreadsheet formula injection (=, +, -, @ at the start). */
function safe_(v) {
  v = String(v || '');
  return /^[=+\-@\t\r]/.test(v) ? "'" + v : v;
}
function unescape_(v) {
  v = String(v || '');
  return /^'[=+\-@\t\r]/.test(v) ? v.slice(1) : v;
}
function fullName_(first, last) {
  return unescape_(first) + ' ' + unescape_(last);
}
function normaliseName_(v) {
  return unescape_(v).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim();
}

/* ------------------------------------------------------------------ */
/* Settings, tokens, limits                                            */
/* ------------------------------------------------------------------ */

function settings_() {
  var p = PropertiesService.getScriptProperties().getProperties();
  function bool(v, d) { return v === undefined || v === '' ? d : String(v).toLowerCase() === 'true'; }
  function num(v, d) { var n = parseInt(v, 10); return isFinite(n) && n > 0 ? n : d; }
  return {
    deadline: (p.RSVP_DEADLINE || '').trim(),
    maxParty: num(p.MAX_PARTY, 50),
    allowCompanions: bool(p.ALLOW_COMPANIONS, true),
    allowChildren: bool(p.ALLOW_CHILDREN, false),
    allowUpdates: bool(p.ALLOW_UPDATES, true),
    rate10: num(p.RATE_10MIN, 40),
    rateDay: num(p.RATE_DAY, 400),
    notifyEmail: /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(p.NOTIFY_EMAIL || '') ? p.NOTIFY_EMAIL.trim() : ''
  };
}

function deadlinePassed_(s) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s.deadline)) return false;
  var today = Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd');
  return today > s.deadline; // lexical compare works for ISO dates; deadline day is inclusive
}

function newToken_() {
  return (Utilities.getUuid() + Utilities.getUuid()).replace(/-/g, '');
}
function sha256_(s) {
  var bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, s, Utilities.Charset.UTF_8);
  return bytes.map(function (b) { return ('0' + (b & 0xff).toString(16)).slice(-2); }).join('');
}
function findByToken_(token) {
  token = String(token || '');
  if (!/^[a-f0-9]{64}$/.test(token)) return null;
  var hash = sha256_(token);
  var sheet = responsesSheet_();
  var rows = dataRows_(sheet);
  for (var i = 0; i < rows.length; i++) {
    if (rows[i][COL.token_hash] === hash) return { row: rows[i], index: i + 2 };
  }
  return null;
}

function rateAllow_(s) {
  var cache = CacheService.getScriptCache();
  var tenMin = Number(cache.get('rate10') || 0);
  var day = Number(cache.get('rateDay') || 0);
  return tenMin < s.rate10 && day < s.rateDay;
}
function rateCount_() {
  var cache = CacheService.getScriptCache();
  // Fixed windows: the counter expires 10 min / 6 h (cache max) after first write.
  var t = Number(cache.get('rate10') || 0);
  cache.put('rate10', String(t + 1), 600);
  var d = Number(cache.get('rateDay') || 0);
  cache.put('rateDay', String(d + 1), 21600);
}

/* ------------------------------------------------------------------ */
/* Sheets                                                              */
/* ------------------------------------------------------------------ */

function responsesSheet_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(SHEET_RESPONSES);
  if (!sh) { setup(); sh = ss.getSheetByName(SHEET_RESPONSES); }
  return sh;
}
function peopleSheet_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(SHEET_PEOPLE);
  if (!sh) { setup(); sh = ss.getSheetByName(SHEET_PEOPLE); }
  return sh;
}
function historySheet_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  return ss.getSheetByName(SHEET_HISTORY) || ss.insertSheet(SHEET_HISTORY);
}
function dataRows_(sheet) {
  var last = sheet.getLastRow();
  if (last < 2) return [];
  return sheet.getRange(2, 1, last - 1, HEADERS.length).getValues();
}
/** Column letter for a 0-based index (A, B, … Z, AA …). */
function letter_(i) {
  var s = '';
  for (i = i + 1; i > 0; i = Math.floor((i - 1) / 26)) s = String.fromCharCode(65 + ((i - 1) % 26)) + s;
  return s;
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

/* ------------------------------------------------------------------ */
/* Admin — run from the editor or the "Boda" menu                      */
/* ------------------------------------------------------------------ */

/** Run once. Creates the sheets with headers, filters and totals. */
function setup() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var r = ss.getSheetByName(SHEET_RESPONSES) || ss.insertSheet(SHEET_RESPONSES, 0);
  if (r.getLastRow() === 0) {
    r.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]).setFontWeight('bold');
    r.setFrozenRows(1);
    r.getRange('B:C').setNumberFormat('dd/mm/yyyy hh:mm');
    r.setColumnWidth(COL.acompanantes + 1, 260);
    r.setColumnWidth(COL.alergias + 1, 300);
    r.hideColumns(COL.request_id + 1, 2); // request_id + token_hash: internal
    if (!r.getFilter()) r.getRange(1, 1, r.getMaxRows(), HEADERS.length).createFilter();
  }

  var p = ss.getSheetByName(SHEET_PEOPLE) || ss.insertSheet(SHEET_PEOPLE, 1);
  if (p.getLastRow() === 0) {
    p.getRange(1, 1, 1, PEOPLE_HEADERS.length).setValues([PEOPLE_HEADERS]).setFontWeight('bold');
    p.setFrozenRows(1);
    p.setColumnWidth(PCOL.alergias + 1, 280);
    if (!p.getFilter()) p.getRange(1, 1, p.getMaxRows(), PEOPLE_HEADERS.length).createFilter();
  }

  var h = ss.getSheetByName(SHEET_HISTORY) || ss.insertSheet(SHEET_HISTORY);
  if (h.getLastRow() === 0) {
    h.getRange(1, 1, 1, 2 + COL.request_id)
      .setValues([['fecha_cambio', 'tipo'].concat(HEADERS.slice(0, COL.request_id))]).setFontWeight('bold');
    h.setFrozenRows(1);
  }

  var s = ss.getSheetByName(SHEET_SUMMARY) || ss.insertSheet(SHEET_SUMMARY, 0);
  var R = SHEET_RESPONSES + '!';
  var c = function (name) { var L = letter_(COL[name]); return R + L + '2:' + L; };
  // Rows marked "Anulada" or flagged as possible spam are left out of the totals.
  var NA = ',' + c('estado') + ',"<>Anulada",' + c('estado') + ',"<>' + STATUS_SPAM + '"';
  var PA = SHEET_PEOPLE + '!' + letter_(PCOL.alergias) + '2:' + letter_(PCOL.alergias);
  var rows = [
    ['Resumen de asistencia', ''],
    ['Respuestas recibidas', '=COUNTIFS(' + c('id') + ',"<>"' + NA + ')'],
    ['Respuestas que asisten', '=COUNTIFS(' + c('asistencia') + ',"Sí"' + NA + ')'],
    ['Respuestas que no asisten', '=COUNTIFS(' + c('asistencia') + ',"No"' + NA + ')'],
    ['Personas confirmadas (total)', '=SUMIFS(' + c('personas') + ',' + c('asistencia') + ',"Sí"' + NA + ')'],
    ['de ellas, niños/as', '=SUMIFS(' + c('ninos') + ',' + c('asistencia') + ',"Sí"' + NA + ')'],
    ['Respuestas con necesidades de accesibilidad', '=COUNTIFS(' + c('asistencia') + ',"Sí",' + c('accesibilidad') + ',"<>"' + NA + ')'],
    ['Pendientes de revisar (duplicados o posible spam)', '=COUNTIF(' + c('estado') + ',"Revisar*")'],
    ['', ''],
    ['Personas por alergia o dieta (hoja «Personas»)', '']
  ];
  Object.keys(DIETS).forEach(function (code) {
    rows.push([DIETS[code], '=COUNTIF(' + PA + ',"*' + DIETS[code] + '*")']);
  });
  rows.push(['', '']);
  rows.push(['Las «posible spam» no se cuentan hasta que cambiéis su estado (p. ej. a «OK»).', '']);
  rows.push(['Para anular una respuesta escribid «Anulada» en su columna estado y borrad sus filas en «Personas».', '']);
  s.getRange(1, 1, rows.length, 2).setValues(rows);
  s.getRange('A1').setFontWeight('bold').setFontSize(14);
  s.setColumnWidth(1, 380);
}

function onOpen() {
  SpreadsheetApp.getUi().createMenu('Boda')
    .addItem('Preparar hojas (setup)', 'setup')
    .addItem('Borrar alergias y accesibilidad ahora', 'borrarDatosSensibles')
    .addItem('Programar borrado automático (fecha en propiedad PURGE_DATE)', 'programarBorrado')
    .addToUi();
}

/** Clears allergy/accessibility data in Respuestas, Historial and Personas (GDPR minimisation). */
function borrarDatosSensibles() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  // alergias and accesibilidad are adjacent columns in Respuestas (and Historial, shifted by 2)
  [[SHEET_RESPONSES, 0], [SHEET_HISTORY, 2]].forEach(function (p) {
    var sh = ss.getSheetByName(p[0]);
    if (!sh || sh.getLastRow() < 2) return;
    sh.getRange(2, p[1] + COL.alergias + 1, sh.getLastRow() - 1, 2).clearContent();
  });
  var pe = ss.getSheetByName(SHEET_PEOPLE);
  if (pe && pe.getLastRow() >= 2) pe.getRange(2, PCOL.alergias + 1, pe.getLastRow() - 1, 2).clearContent();
}

/** Creates a one-off trigger that runs borrarDatosSensibles on PURGE_DATE (YYYY-MM-DD). */
function programarBorrado() {
  var d = PropertiesService.getScriptProperties().getProperty('PURGE_DATE');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d || '')) throw new Error('Define la propiedad PURGE_DATE como AAAA-MM-DD');
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'borrarDatosSensibles') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('borrarDatosSensibles').timeBased().at(new Date(d + 'T09:00:00')).create();
}
