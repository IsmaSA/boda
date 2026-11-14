// Minimal in-memory emulation of the Google Apps Script services used by
// apps-script/Code.gs, so the REAL backend code can be unit-tested and driven
// end-to-end from a browser test. It does not prove the Google deployment works
// (CORS redirects, quotas, permissions) — that must be checked once deployed.
import fs from 'node:fs';
import vm from 'node:vm';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const CODE = fs.readFileSync(fileURLToPath(new URL('../apps-script/Code.gs', import.meta.url)), 'utf8');

const noop = () => chain;
const chain = new Proxy({}, { get: (_t, k) => (k === 'then' ? undefined : noop) });

function makeSheet(name, faults = {}) {
  const data = [];
  const sheet = {
    name,
    data,
    getLastRow: () => data.length,
    getMaxRows: () => 1000,
    getFilter: () => null,
    deleteRow: (r) => { data.splice(r - 1, 1); return sheet; },
    appendRow: (row) => {
      // faults.dropNextAppend simulates a write that silently never lands
      if (faults.dropNextAppend) { faults.dropNextAppend = false; return sheet; }
      data.push(row.slice());
      return sheet;
    },
    getRange(a, b, c = 1, d = 1) {
      if (typeof a === 'string') return chain;
      const r0 = a - 1, c0 = b - 1;
      const range = {
        getValues: () => Array.from({ length: c }, (_, i) =>
          Array.from({ length: d }, (_, j) => (data[r0 + i] || [])[c0 + j] ?? '')),
        setValues(vals) {
          vals.forEach((row, i) => {
            data[r0 + i] = data[r0 + i] || [];
            row.forEach((v, j) => { data[r0 + i][c0 + j] = v; });
          });
          return proxy;
        },
        clearContent() {
          for (let i = 0; i < c; i++) for (let j = 0; j < d; j++) if (data[r0 + i]) data[r0 + i][c0 + j] = '';
          return proxy;
        },
      };
      const proxy = new Proxy(range, { get: (t, k) => (k in t ? t[k] : () => proxy) });
      return proxy;
    },
  };
  return new Proxy(sheet, { get: (t, k) => (k in t ? t[k] : noop) });
}

export function createBackend(properties = {}) {
  const sheets = new Map();
  const cache = new Map();
  const mails = [];
  const faults = { dropNextAppend: false, mailThrows: false };
  const ss = {
    getSheetByName: (n) => sheets.get(n) || null,
    insertSheet: (n) => { const s = makeSheet(n, faults); sheets.set(n, s); return s; },
  };
  const fmt = (date, tz, pattern) => {
    const p = Object.fromEntries(new Intl.DateTimeFormat('en-CA', {
      timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit',
    }).formatToParts(date).map((x) => [x.type, x.value]));
    return pattern.replace('yyyy', p.year).replace('yy', p.year.slice(2)).replace('MM', p.month).replace('dd', p.day);
  };
  const ctx = {
    console,
    SpreadsheetApp: { getActiveSpreadsheet: () => ss, getUi: () => chain, flush() {} },
    MailApp: {
      sendEmail(to, subject, body) {
        if (faults.mailThrows) throw new Error('Service invoked too many times: email');
        mails.push({ to, subject, body });
      },
    },
    LockService: { getScriptLock: () => ({ waitLock() {}, releaseLock() {} }) },
    CacheService: { getScriptCache: () => ({ get: (k) => cache.get(k) ?? null, put: (k, v) => cache.set(k, v) }) },
    PropertiesService: { getScriptProperties: () => ({ getProperties: () => ({ ...properties }), getProperty: (k) => properties[k] ?? null }) },
    Utilities: {
      getUuid: () => crypto.randomUUID(),
      formatDate: fmt,
      DigestAlgorithm: { SHA_256: 'sha256' },
      Charset: { UTF_8: 'utf8' },
      computeDigest: (_alg, s) => [...crypto.createHash('sha256').update(s, 'utf8').digest()].map((b) => (b > 127 ? b - 256 : b)),
    },
    ContentService: {
      MimeType: { JSON: 'application/json' },
      createTextOutput: (content) => ({ content, setMimeType() { return this; } }),
    },
    ScriptApp: chain,
  };
  vm.createContext(ctx);
  vm.runInContext(CODE, ctx, { filename: 'Code.gs' });
  return {
    properties,
    cache,
    sheets,
    mails,
    faults,
    post(body) {
      const raw = typeof body === 'string' ? body : JSON.stringify(body);
      return JSON.parse(ctx.doPost({ postData: { contents: raw } }).content);
    },
    get: () => JSON.parse(ctx.doGet().content),
    rows: () => (sheets.get('Respuestas')?.data || []).slice(1),
    people: () => (sheets.get('Personas')?.data || []).slice(1),
    get headers() { return [...ctx.HEADERS]; },
    get peopleHeaders() { return [...ctx.PEOPLE_HEADERS]; },
    /** Value of a named column in a Respuestas row. */
    col: (row, name) => row[ctx.HEADERS.indexOf(name)],
    pcol: (row, name) => row[ctx.PEOPLE_HEADERS.indexOf(name)],
    history: () => (sheets.get('Historial')?.data || []).slice(1),
    run: (fn) => ctx[fn](),
  };
}
