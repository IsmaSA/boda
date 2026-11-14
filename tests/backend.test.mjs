// Unit tests for apps-script/Code.gs, run against the in-memory emulator.
// Run: npm run test:backend
import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { createBackend } from './gas-emulator.mjs';

const person = (firstName, lastName, extra = {}) => ({ role: 'extra', firstName, lastName, child: false, diet: [], dietOther: '', ...extra });
const base = (over = {}) => ({
  action: 'submit',
  requestId: crypto.randomUUID(),
  startedAt: Date.now() - 10_000,
  website: '',
  privacyAck: true,
  lang: 'es',
  attending: 'yes',
  people: [
    person('Lucía', 'Fernández Ruiz', { role: 'guest' }),
    person('Pablo', 'Gómez', { role: 'partner' }),
  ],
  accessibility: '',
  comments: '',
  ...over,
});
const withDiet = (diet, dietOther = '') => base({
  people: [person('Lucía', 'Fernández Ruiz', { role: 'guest', diet, dietOther })],
  healthConsent: true,
});

test('health check never exposes data', () => {
  const b = createBackend();
  assert.deepEqual(b.get(), { ok: true, service: 'rsvp' });
});

test('guest + partner stored in Respuestas and one row per person in Personas', () => {
  const b = createBackend();
  const r = b.post(base());
  assert.equal(r.ok, true);
  assert.match(r.id, /^R-\d{6}-[0-9A-F]{6}$/);
  assert.match(r.token, /^[a-f0-9]{64}$/);
  const [row] = b.rows();
  assert.equal(b.col(row, 'nombre'), 'Lucía');
  assert.equal(b.col(row, 'apellidos'), 'Fernández Ruiz');
  assert.equal(b.col(row, 'asistencia'), 'Sí');
  assert.equal(b.col(row, 'personas'), 2);
  assert.equal(b.col(row, 'pareja'), 'Pablo Gómez');
  assert.equal(b.col(row, 'acompanantes'), '');
  assert.equal(b.col(row, 'estado'), 'Nueva');
  assert.notEqual(b.col(row, 'token_hash'), r.token, 'raw token must never be stored');
  const people = b.people();
  assert.equal(people.length, 2);
  assert.deepEqual(people.map((p) => [b.pcol(p, 'id_respuesta'), b.pcol(p, 'nombre'), b.pcol(p, 'apellidos'), b.pcol(p, 'rol')]),
    [[r.id, 'Lucía', 'Fernández Ruiz', 'Invitado/a'], [r.id, 'Pablo', 'Gómez', 'Pareja']]);
});

test('others added one by one, each with their own allergies', () => {
  const b = createBackend({ ALLOW_CHILDREN: 'true' });
  const r = b.post(base({
    healthConsent: true,
    people: [
      person('Lucía', 'Fernández', { role: 'guest', diet: ['gluten'] }),
      person('Pablo', 'Gómez', { role: 'partner', diet: ['marisco', 'otra'], dietOther: 'Kiwi' }),
      person('Leo', 'Gómez Fernández', { child: true, diet: ['lactosa'] }),
      person('Carmen', 'Ruiz'),
    ],
  }));
  assert.equal(r.ok, true);
  const [row] = b.rows();
  assert.equal(b.col(row, 'personas'), 4);
  assert.equal(b.col(row, 'ninos'), 1);
  assert.equal(b.col(row, 'acompanantes'), 'Leo Gómez Fernández (niño/a); Carmen Ruiz');
  assert.equal(b.col(row, 'alergias'),
    'Lucía Fernández: Sin gluten (celiaquía); Pablo Gómez: Marisco, Otra: Kiwi; Leo Gómez Fernández: Sin lactosa');
  const people = b.people();
  assert.equal(people.length, 4);
  assert.equal(b.pcol(people[1], 'alergias'), 'Marisco, Otra');
  assert.equal(b.pcol(people[1], 'otra_alergia'), 'Kiwi');
  assert.equal(b.pcol(people[2], 'nino'), 'Sí');
  assert.equal(b.pcol(people[3], 'alergias'), '');
});

test('decline stores the guest only, with no people rows or allergies', () => {
  const b = createBackend();
  const r = b.post(base({ attending: 'no', people: [person('Ana', 'Sanz', { role: 'guest', diet: ['gluten'] }), person('X', 'Y')] }));
  assert.equal(r.ok, true);
  const [row] = b.rows();
  assert.equal(b.col(row, 'asistencia'), 'No');
  assert.equal(b.col(row, 'personas'), 0);
  assert.equal(b.col(row, 'pareja'), '');
  assert.equal(b.col(row, 'alergias'), '');
  assert.equal(b.people().length, 0);
});

test('server-side validation rejects bad input', () => {
  const b = createBackend();
  const g = (o) => person('Lucía', 'Fernández', { role: 'guest', ...o });
  assert.deepEqual(b.post(base({ people: [g({ firstName: ' ' })] })), { ok: false, error: 'required', field: 'people.0.firstName' });
  assert.deepEqual(b.post(base({ people: [g({ lastName: '' })] })), { ok: false, error: 'required', field: 'people.0.lastName' });
  assert.equal(b.post(base({ people: [g({ firstName: 'x'.repeat(61) })] })).error, 'too_long');
  assert.equal(b.post(base({ people: [] })).error, 'required');
  assert.equal(b.post(base({ people: [person('A', 'B')] })).field, 'people.0.firstName', 'first person must be the guest');
  assert.equal(b.post(base({ attending: 'maybe' })).error, 'required');
  assert.deepEqual(b.post(base({ people: [g(), person('P', 'Q', { role: 'partner' }), person('R', 'S', { role: 'partner' })] })),
    { ok: false, error: 'invalid', field: 'people.2.firstName' }, 'only one partner');
  assert.equal(b.post(base({ people: [g(), person('P', 'Q', { role: 'boss' })] })).error, 'invalid');
  assert.deepEqual(b.post(base({ people: [g(), person('Ana', '')] })), { ok: false, error: 'required', field: 'people.1.lastName' });
  assert.equal(b.post(base({ people: [g({ diet: ['pizza'] })], healthConsent: true })).error, 'invalid');
  assert.deepEqual(b.post(base({ people: [g({ diet: ['otra'] })], healthConsent: true })),
    { ok: false, error: 'required', field: 'people.0.dietOther' }, '"Otra" needs the detail');
  assert.equal(b.post(base({ privacyAck: false })).error, 'privacy_required');
  assert.equal(b.post(base({ people: [g({ diet: ['gluten'] })] })).error, 'consent_required');
  assert.equal(b.post(base({ comments: 'x'.repeat(1001) })).error, 'too_long');
  assert.equal(b.post(base({ requestId: 'nope' })).error, 'bad_request');
  assert.equal(b.post('not json').error, 'bad_request');
  assert.equal(b.rows().length, 0);
  assert.equal(b.people().length, 0);
});

test('party size limit (MAX_PARTY, default 50) and companions switch', () => {
  const b = createBackend();
  const g = person('Lucía', 'Fernández', { role: 'guest' });
  const tooMany = [g, ...Array.from({ length: 50 }, (_, i) => person(`P${i}`, 'X'))];
  assert.deepEqual(b.post(base({ people: tooMany })), { ok: false, error: 'too_many', field: 'people' });
  assert.equal(b.post(base({ people: tooMany.slice(0, 50) })).ok, true);

  const two = createBackend({ MAX_PARTY: '2' });
  assert.equal(two.post(base({ people: [g, person('A', 'B'), person('C', 'D')] })).error, 'too_many');

  const solo = createBackend({ ALLOW_COMPANIONS: 'false' });
  assert.equal(solo.post(base()).error, 'too_many');
  assert.equal(solo.post(base({ people: [g] })).ok, true);

  const noKids = createBackend();
  noKids.post(base({ people: [g, person('Leo', 'Gómez', { child: true })] }));
  assert.equal(noKids.col(noKids.rows()[0], 'ninos'), 0, 'child flag ignored when children are disabled');
});

test('allergies accepted only with explicit consent; duplicates in a list are ignored', () => {
  const b = createBackend();
  const r = b.post(withDiet(['gluten', 'gluten', 'vegano']));
  assert.equal(r.ok, true);
  const [row] = b.rows();
  assert.equal(b.col(row, 'consentimiento_salud'), 'Sí');
  assert.equal(b.pcol(b.people()[0], 'alergias'), 'Sin gluten (celiaquía), Vegano');
  const other = createBackend();
  other.post(withDiet(['gluten'], 'ignored when Otra is not ticked'));
  assert.equal(other.pcol(other.people()[0], 'otra_alergia'), '');
});

test('bot signals never lose a reply: stored, flagged, kept out of totals', () => {
  const b = createBackend();
  const r1 = b.post(base({ startedAt: Date.now() }));
  const r2 = b.post(base({ website: 'http://spam', people: [person('Campo', 'Oculto', { role: 'guest' })] }));
  assert.equal(r1.ok, true);
  assert.equal(r2.ok, true);
  assert.equal(b.rows().length, 2);
  assert.ok(b.rows().every((r) => b.col(r, 'estado') === 'Revisar: posible spam'));
  b.run('setup');
  const summary = b.sheets.get('Resumen').data;
  const totals = summary.find((r) => r[0] === 'Personas confirmadas (total)')[1];
  assert.match(totals, /<>Revisar: posible spam/);
  assert.match(totals, /<>Anulada/);
  assert.match(totals, /SUMIFS\(Respuestas!G2:G,Respuestas!F2:F,"Sí"/, 'formulas follow the column layout');
  const gluten = summary.find((r) => r[0] === 'Sin gluten (celiaquía)')[1];
  assert.equal(gluten, '=COUNTIF(Personas!F2:F,"*Sin gluten (celiaquía)*")');
});

test('same requestId twice creates one row (idempotent retries)', () => {
  const b = createBackend();
  const body = base();
  const a = b.post(body);
  const c = b.post(body);
  assert.deepEqual(a, c);
  assert.equal(b.rows().length, 1);
  assert.equal(b.people().length, 2);
  b.cache.clear(); // even after the cache expires, the sheet column catches it
  assert.equal(b.post(body).duplicate, true);
  assert.equal(b.rows().length, 1);
  assert.equal(b.people().length, 2);
});

test('a write that does not land is never reported as saved; the retry stores it once', () => {
  const b = createBackend();
  const body = base();
  b.faults.dropNextAppend = true;
  assert.deepEqual(b.post(body), { ok: false, error: 'server_error' });
  assert.equal(b.rows().length, 0);
  const retry = b.post(body);
  assert.equal(retry.ok, true);
  assert.equal(b.post(body).id, retry.id);
  assert.equal(b.rows().length, 1);
});

test('retry with changed content (same requestId) updates the row and its people', () => {
  const b = createBackend();
  const body = base();
  const first = b.post(body);
  const changed = b.post({ ...body, healthConsent: true, people: [body.people[0], person('Pablo', 'Gómez', { role: 'partner', diet: ['huevo'] }), person('Ana', 'Gómez')] });
  assert.equal(changed.ok, true);
  assert.equal(changed.id, first.id);
  assert.equal(changed.token, first.token, 'guest keeps the same edit link');
  assert.equal(b.rows().length, 1);
  assert.equal(b.col(b.rows()[0], 'personas'), 3);
  assert.equal(b.people().length, 3, 'old people rows replaced, not added to');
  assert.equal(b.pcol(b.people()[1], 'alergias'), 'Huevo');
  assert.equal(b.history().length, 1);
});

test('same name from a different request is flagged, never overwritten', () => {
  const b = createBackend();
  b.post(base());
  const r = b.post(base({ people: [person('lucia', 'fernandez  ruiz', { role: 'guest' })] }));
  assert.equal(r.ok, true);
  assert.equal(b.rows().length, 2);
  assert.equal(b.col(b.rows()[1], 'estado'), 'Revisar: posible duplicado');
  assert.equal(b.col(b.rows()[0], 'nombre'), 'Lucía');
});

test('formula injection is neutralised', () => {
  const b = createBackend();
  b.post(base({ comments: '+cmd', people: [person('=HYPERLINK("http://evil","x")', '@x', { role: 'guest' })] }));
  const [row] = b.rows();
  assert.ok(b.col(row, 'nombre').startsWith("'="));
  assert.ok(b.col(row, 'apellidos').startsWith("'@"));
  assert.ok(b.col(row, 'comentarios').startsWith("'+"));
  assert.ok(b.pcol(b.people()[0], 'nombre').startsWith("'="));
});

test('deadline is enforced server-side', () => {
  assert.equal(createBackend({ RSVP_DEADLINE: '2020-01-01' }).post(base()).error, 'closed');
  assert.equal(createBackend({ RSVP_DEADLINE: '2099-12-31' }).post(base()).ok, true);
});

test('rate limit caps accepted submissions', () => {
  const b = createBackend({ RATE_10MIN: '2' });
  const g = (n) => [person(n, 'Uno', { role: 'guest' })];
  assert.equal(b.post(base({ people: g('Uno') })).ok, true);
  assert.equal(b.post(base({ people: g('Dos') })).ok, true);
  assert.equal(b.post(base({ people: g('Tres') })).error, 'rate_limited');
});

test('guest can load and update only their own response with the token', () => {
  const b = createBackend();
  const mine = b.post(base({ healthConsent: true, people: [person('Lucía', 'Fernández', { role: 'guest', diet: ['otra'], dietOther: 'Kiwi' }), person('Pablo', 'Gómez', { role: 'partner' })] }));
  const other = b.post(base({ people: [person('Otro', 'Invitado', { role: 'guest' })] }));

  const loaded = b.post({ action: 'load', token: mine.token });
  assert.equal(loaded.ok, true);
  assert.equal(loaded.data.attending, 'yes');
  assert.deepEqual(loaded.data.people, [
    { role: 'guest', firstName: 'Lucía', lastName: 'Fernández', child: false, diet: ['otra'], dietOther: 'Kiwi' },
    { role: 'partner', firstName: 'Pablo', lastName: 'Gómez', child: false, diet: [], dietOther: '' },
  ]);

  const upd = b.post({ ...base({ attending: 'no', people: [person('Lucía', 'Fernández', { role: 'guest' })] }), action: 'update', token: mine.token });
  assert.equal(upd.ok, true);
  assert.equal(upd.id, mine.id);
  assert.equal(b.rows().length, 2, 'update must not add a row');
  assert.equal(b.col(b.rows()[0], 'asistencia'), 'No');
  assert.equal(b.col(b.rows()[0], 'estado'), 'Actualizada');
  assert.equal(b.col(b.rows()[1], 'nombre'), 'Otro', 'other guest untouched');
  assert.equal(b.people().length, 1, 'declining removes this response’s people');
  assert.equal(b.pcol(b.people()[0], 'nombre'), 'Otro');
  assert.equal(b.history().length, 1, 'previous version kept in Historial');

  const declined = b.post({ action: 'load', token: mine.token });
  assert.deepEqual(declined.data.people.map((p) => p.firstName), ['Lucía']);

  assert.equal(b.post({ action: 'load', token: 'f'.repeat(64) }).error, 'not_found');
  assert.equal(b.post({ action: 'load', token: mine.id }).error, 'not_found');
  assert.equal(b.post({ action: 'load' }).error, 'not_found');
  assert.ok(other.token);
});

test('updates can be disabled', () => {
  const b = createBackend({ ALLOW_UPDATES: 'false' });
  const r = b.post(base());
  assert.equal(r.editable, false);
  assert.equal(r.token, undefined);
  assert.equal(b.post({ action: 'load', token: 'a'.repeat(64) }).error, 'updates_disabled');
});

test('purge clears allergy and accessibility data in all sheets', () => {
  const b = createBackend();
  const r = b.post({ ...withDiet(['marisco']), accessibility: 'Silla de ruedas' });
  b.post({ ...withDiet(['huevo']), accessibility: 'Silla de ruedas', action: 'update', token: r.token });
  b.run('borrarDatosSensibles');
  const [row] = b.rows();
  assert.equal(b.col(row, 'alergias'), '');
  assert.equal(b.col(row, 'accesibilidad'), '');
  const h = b.history()[0];
  assert.equal(h[2 + 10], '');
  assert.equal(h[2 + 11], '');
  assert.equal(b.pcol(b.people()[0], 'alergias'), '');
  assert.equal(b.pcol(b.people()[0], 'nombre'), 'Lucía', 'names are kept');
});

test('email copy lists every person with their allergies', () => {
  const b = createBackend({ NOTIFY_EMAIL: 'boda@example.com' });
  const r = b.post(base({ healthConsent: true, people: [person('Lucía', 'Fernández', { role: 'guest', diet: ['gluten'] }), person('Pablo', 'Gómez', { role: 'partner' })] }));
  b.post({ ...base({ attending: 'no', people: [person('Lucía', 'Fernández', { role: 'guest' })] }), action: 'update', token: r.token });
  b.post({ ...base({ attending: 'no', people: [person('Lucía', 'Fernández', { role: 'guest' })] }), action: 'update', token: r.token }); // no change → no email
  assert.equal(b.mails.length, 2);
  assert.equal(b.mails[0].to, 'boda@example.com');
  assert.match(b.mails[0].subject, /Nueva respuesta: Lucía Fernández \(Sí, 2 personas\)/);
  assert.match(b.mails[0].body, /Invitado\/a: Lucía Fernández — Sin gluten \(celiaquía\)/);
  assert.match(b.mails[0].body, /Pareja: Pablo Gómez/);
  assert.match(b.mails[1].subject, /Respuesta actualizada: .*\(No\)/);
});

test('a failing email never fails the reply', () => {
  const b = createBackend({ NOTIFY_EMAIL: 'boda@example.com' });
  b.faults.mailThrows = true;
  assert.equal(b.post(base()).ok, true);
  assert.equal(b.rows().length, 1);
});
