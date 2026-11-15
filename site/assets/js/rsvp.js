// RSVP form: guest, partner and other people (each with name, surname and
// allergies), validation, submission to the Apps Script backend, success and
// edit flows. The server re-validates everything.
import { ui } from './ui.js';
import { esc, personCard, maxParty } from './render.js';
import { localDate } from './time.js';
import { confetti } from './fun.js';

const TIMEOUT_MS = 20000;
const EDIT_KEY = 'rsvp-edit';
const session = {
  get(k) { try { return sessionStorage.getItem(k); } catch { return null; } },
  set(k, v) { try { sessionStorage.setItem(k, v); } catch { /* ignore */ } },
};

/* Outbox: a reply is written to this device BEFORE it is sent and only removed
   once the server confirms it was saved. If the connection drops or the server
   is busy, it is resent automatically (same requestId, so never duplicated),
   while the page is open and the next time the guest opens the site. */
const OUTBOX_KEY = 'rsvp-outbox';
const outbox = {
  get() { try { return JSON.parse(localStorage.getItem(OUTBOX_KEY) || 'null'); } catch { return null; } },
  save(v) { try { localStorage.setItem(OUTBOX_KEY, JSON.stringify(v)); return true; } catch { return false; } },
  clear() { try { localStorage.removeItem(OUTBOX_KEY); } catch { /* ignore */ } },
};
// Errors worth retrying; anything else needs the guest to change something.
const TRANSIENT = new Set(['network', 'busy', 'rate_limited', 'server_error', 'generic']);
const RETRY_S = [5, 15, 30, 60, 120, 300];

const uuid = () => (crypto.randomUUID ? crypto.randomUUID()
  : '10000000-1000-4000-8000-100000000000'.replace(/[018]/g, (c) =>
    (c ^ (crypto.getRandomValues(new Uint8Array(1))[0] & (15 >> (c / 4)))).toString(16)));

let current = null; // { cfg, lang } of the form on the page
let uidSeq = 0;

/* ------------------------------------------------------------------ */
/* Reading and writing the form (also used across a language switch)   */
/* ------------------------------------------------------------------ */

const val = (el) => (el ? el.value.trim().replace(/\s+/g, ' ') : '');
function readDiet(scope) {
  if (!scope) return { diet: [], dietOther: '' };
  const diet = [...scope.querySelectorAll('[data-diet]:checked')].map((i) => i.value);
  return { diet, dietOther: diet.includes('otra') ? val(scope.querySelector('[data-diet-other]')) : '' };
}

/** Everything the guest has entered, in the shape the server expects. */
export function readForm(form) {
  const q = (s) => form.querySelector(s);
  const attending = q('[name="attending"]:checked')?.value || '';
  const yes = attending === 'yes';
  const withPartner = q('[name="withPartner"]:checked')?.value || '';
  const people = [{
    role: 'guest',
    firstName: val(q('#f-g-firstName')),
    lastName: val(q('#f-g-lastName')),
    child: false,
    ...(yes ? readDiet(q('[data-guest-diet]')) : { diet: [], dietOther: '' }),
  }];
  if (yes) {
    form.querySelectorAll('[data-person]').forEach((card) => {
      if (card.dataset.role === 'partner' && withPartner !== 'yes') return;
      people.push({
        role: card.dataset.role,
        firstName: val(card.querySelector('[data-name="firstName"]')),
        lastName: val(card.querySelector('[data-name="lastName"]')),
        child: !!card.querySelector('[data-child]')?.checked,
        ...readDiet(card),
      });
    });
  }
  const anyDiet = people.some((p) => p.diet.length);
  const accessibility = yes ? val(q('[name="accessibility"]')) : '';
  return {
    attending,
    withPartner: yes ? withPartner : '',
    people,
    accessibility,
    healthConsent: (anyDiet || !!accessibility) && !!q('[name="healthConsent"]')?.checked,
    comments: (q('[name="comments"]')?.value || '').trim(),
    privacyAck: !!q('[name="privacyAck"]')?.checked,
    website: q('[name="website"]')?.value || '',
  };
}

function writeDiet(scope, p) {
  if (!scope) return;
  scope.querySelectorAll('[data-diet]').forEach((i) => { i.checked = (p.diet || []).includes(i.value); });
  const other = scope.querySelector('[data-diet-other]');
  if (other) other.value = p.dietOther || '';
}

/** Adds a companion card (or returns the existing partner card). */
function addCard(form, role) {
  const { cfg, lang } = current;
  if (role === 'partner') {
    const existing = form.querySelector('[data-person][data-role="partner"]');
    if (existing) return existing;
  }
  const slot = form.querySelector(role === 'partner' ? '[data-partner-slot]' : '[data-others-list]');
  if (!slot) return null;
  uidSeq += 1;
  slot.insertAdjacentHTML('beforeend', personCard(cfg, lang, `p${uidSeq}`, role));
  return slot.lastElementChild;
}

/** Puts saved/loaded data back into the form. */
export function writeForm(form, d) {
  if (!form || !d) return;
  const q = (s) => form.querySelector(s);
  const people = d.people || [];
  const guest = people[0] || {};
  q('#f-g-firstName').value = guest.firstName || '';
  q('#f-g-lastName').value = guest.lastName || '';
  form.querySelectorAll('[name="attending"]').forEach((i) => { i.checked = i.value === d.attending; });
  writeDiet(q('[data-guest-diet]'), guest);
  const partner = people.find((p) => p.role === 'partner');
  const withPartner = d.withPartner || (partner ? 'yes' : (d.attending === 'yes' && people.length ? 'no' : ''));
  form.querySelectorAll('[name="withPartner"]').forEach((i) => { i.checked = i.value === withPartner; });
  form.querySelectorAll('[data-person][data-role="extra"]').forEach((c) => c.remove());
  const fillCard = (card, p) => {
    if (!card) return;
    card.querySelector('[data-name="firstName"]').value = p.firstName || '';
    card.querySelector('[data-name="lastName"]').value = p.lastName || '';
    const child = card.querySelector('[data-child]');
    if (child) child.checked = !!p.child;
    writeDiet(card, p);
  };
  if (partner) fillCard(addCard(form, 'partner'), partner);
  people.filter((p) => p.role === 'extra').forEach((p) => fillCard(addCard(form, 'extra'), p));
  const acc = q('[name="accessibility"]');
  if (acc) acc.value = d.accessibility || '';
  const com = q('[name="comments"]');
  if (com) com.value = d.comments || '';
  const hc = q('[name="healthConsent"]');
  if (hc) hc.checked = !!d.healthConsent;
  const pa = q('[name="privacyAck"]');
  if (pa) pa.checked = !!d.privacyAck;
  form.dispatchEvent(new Event('rsvp:sync'));
}

export function snapshotForm(root) {
  const form = root?.querySelector('[data-rsvp-form]');
  return form ? readForm(form) : null;
}
export function restoreForm(root, values) {
  writeForm(root?.querySelector('[data-rsvp-form]'), values);
}

/* ------------------------------------------------------------------ */
/* Main                                                                */
/* ------------------------------------------------------------------ */

export function initRsvp(panel, cfg, lang, state) {
  if (!panel) return;
  current = { cfg, lang };
  const u = ui[lang];
  const r = cfg.rsvp;
  const max = maxParty(cfg);
  const form = panel.querySelector('[data-rsvp-form]');
  const notice = panel.querySelector('[data-rsvp-notice]');
  const status = panel.querySelector('[data-rsvp-status]');
  const submit = panel.querySelector('[data-rsvp-submit]');
  const done = panel.querySelector('[data-rsvp-done]');
  const gifBox = panel.querySelector('[data-rsvp-gif]');

  // Celebration GIF: loaded from GIPHY only when a valid reply is sent.
  const showGif = () => {
    const c = r.celebration;
    if (!c || !gifBox) return;
    if (!gifBox.hidden) return;
    const alt = c.alt?.[lang] || c.alt?.es || '';
    gifBox.innerHTML = `
      <picture>
        ${c.still ? `<source media="(prefers-reduced-motion: reduce)" srcset="${esc(c.still)}">` : ''}
        <img src="${esc(c.gif)}" alt="${esc(alt)}" width="480" height="270" decoding="async" referrerpolicy="no-referrer">
      </picture>
      <figcaption>${esc(u.gifCredit(c.credit || ''))} <a href="${esc(c.source)}" target="_blank" rel="noopener noreferrer">GIPHY</a></figcaption>`;
    gifBox.hidden = false;
  };
  const hideGif = () => { if (gifBox) { gifBox.hidden = true; gifBox.innerHTML = ''; } };
  const yesBlock = form.querySelector('[data-when="yes"]');
  const noBlock = form.querySelector('[data-when="no"]');
  const consent = form.querySelector('[data-consent]');
  const addBtn = form.querySelector('[data-add]');
  const countEl = form.querySelector('[data-count]');

  const showNotice = (text) => { notice.textContent = text; notice.hidden = !text; };
  state.deliver = deliver; // retries always use the current (possibly re-rendered) form

  if (!state.onlineWired) {
    state.onlineWired = true;
    window.addEventListener('online', () => { if (outbox.get()) state.deliver?.({ auto: true }); });
  }

  /* --- edit link in the address bar: #editar=<token> --- */
  const m = location.hash.match(/^#editar=([a-f0-9]{64})$/);
  if (m) {
    state.token = m[1];
    session.set(EDIT_KEY, m[1]);
    history.replaceState(null, '', location.pathname + location.search + '#confirmar');
    state.mode = 'update';
    state.needsLoad = true;
  } else if (!state.token && session.get(EDIT_KEY)) {
    state.token = session.get(EDIT_KEY);
    state.mode = 'update';
    state.needsLoad = !state.loaded;
  }

  const closed = r.deadline && localDate(Date.now(), cfg.wedding.timeZone) > r.deadline;
  if (!r.endpoint) {
    showNotice(u.rsvpInactive);
    submit.disabled = true;
  } else if (closed) {
    const d = new Intl.DateTimeFormat(lang === 'en' ? 'en-GB' : 'es-ES', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' })
      .format(new Date(r.deadline + 'T12:00:00Z'));
    showNotice(u.rsvpClosed(d));
    form.hidden = true;
    return;
  }

  /* --- people: partner card, others added one by one --- */
  if (max > 1) addCard(form, 'partner');

  const partnerOn = () => form.querySelector('[name="withPartner"]:checked')?.value === 'yes';
  const total = () => 1 + (partnerOn() ? 1 : 0) + form.querySelectorAll('[data-person][data-role="extra"]').length;

  /** Gives every visible person their position (people.N.*) for error messages, and numbers the titles. */
  function renumber() {
    let i = 1;
    let n = 0;
    form.querySelectorAll('[data-person]').forEach((card) => {
      const counted = card.dataset.role !== 'partner' || partnerOn();
      card.querySelectorAll('[data-part]').forEach((box) => {
        if (counted) box.dataset.field = `people.${i}.${box.dataset.part}`;
        else delete box.dataset.field;
      });
      if (card.dataset.role === 'extra') {
        n += 1;
        card.querySelector('.person__title').textContent = u.f.personTitle(n);
      }
      if (counted) i += 1;
    });
  }

  const syncOther = (scope) => {
    const box = scope.querySelector('.diet__other');
    if (box) box.hidden = !scope.querySelector('[data-diet][value="otra"]')?.checked;
  };
  const syncConsent = () => {
    const d = readForm(form);
    consent.hidden = yesBlock.hidden || !(d.people.some((p) => p.diet.length) || d.accessibility);
  };
  const sync = () => {
    const choice = form.querySelector('[name="attending"]:checked')?.value;
    yesBlock.hidden = choice !== 'yes';
    if (noBlock) noBlock.hidden = choice !== 'no';
    const partnerCard = form.querySelector('[data-person][data-role="partner"]');
    if (partnerCard) partnerCard.hidden = !partnerOn();
    form.querySelectorAll('.diet').forEach(syncOther);
    renumber();
    if (addBtn) {
      const n = total();
      addBtn.disabled = n >= max;
      countEl.textContent = n >= max ? `${u.f.count(n, max)}. ${u.f.full}` : u.f.count(n, max);
    }
    syncConsent();
  };

  form.addEventListener('change', (e) => {
    if (e.target.matches('[data-diet]')) {
      const scope = e.target.closest('.diet');
      syncOther(scope);
      if (e.target.value === 'otra' && e.target.checked) scope.querySelector('[data-diet-other]')?.focus();
    }
    sync();
  });
  form.addEventListener('input', (e) => {
    state.dirty = true;
    if (e.target.name === 'accessibility') syncConsent();
    clearError(e.target.closest('[data-field]'));
  });
  form.addEventListener('click', (e) => {
    if (e.target.closest('[data-add]')) {
      if (total() >= max) return;
      const card = addCard(form, 'extra');
      state.dirty = true;
      sync();
      card?.querySelector('[data-name="firstName"]')?.focus();
    }
    const rm = e.target.closest('[data-remove]');
    if (rm) {
      rm.closest('[data-person]').remove();
      sync();
      addBtn?.focus();
    }
  });
  form.addEventListener('rsvp:sync', sync);
  sync();

  if (state.mode === 'update') {
    submit.textContent = u.f.save;
    if (!state.needsLoad) showNotice(u.rsvpEditing);
  }

  /* --- errors --- */
  function setError(fieldName, msg) {
    const box = form.querySelector(`[data-field="${fieldName}"]`);
    if (!box) return null;
    const err = [...box.querySelectorAll('.field__err')].find((p) => p.closest('[data-field]') === box);
    err.textContent = msg;
    err.hidden = false;
    box.classList.add('has-error');
    if (box.tagName === 'FIELDSET') box.setAttribute('aria-invalid', 'true');
    const ctl = box.querySelector('input:not([type=hidden]), select, textarea');
    if (box.tagName !== 'FIELDSET') ctl?.setAttribute('aria-invalid', 'true');
    return ctl;
  }
  function clearError(box) {
    if (!box || !box.classList.contains('has-error')) return;
    box.classList.remove('has-error');
    [...box.querySelectorAll('.field__err')].filter((p) => p.closest('[data-field]') === box).forEach((p) => { p.hidden = true; });
    box.removeAttribute('aria-invalid');
    box.querySelectorAll(':scope > input[aria-invalid], :scope > textarea[aria-invalid]').forEach((el) => el.removeAttribute('aria-invalid'));
  }
  const clearAll = () => form.querySelectorAll('.has-error').forEach(clearError);

  function validate(d) {
    const errs = [];
    d.people.forEach((p, i) => {
      if (!p.firstName) errs.push([`people.${i}.firstName`, i === 0 ? u.err.name : u.err.firstName]);
      if (!p.lastName) errs.push([`people.${i}.lastName`, u.err.lastName]);
      if (p.diet.includes('otra') && p.dietOther.length < 2) errs.push([`people.${i}.dietOther`, u.err.dietOther]);
    });
    if (!d.attending) errs.push(['attending', u.err.attending]);
    if (d.attending === 'yes' && max > 1 && !d.withPartner) errs.push(['withPartner', u.err.withPartner]);
    if (d.attending === 'yes' && d.people.length > max) errs.push(['people', u.err.too_many]);
    if ((d.people.some((p) => p.diet.length) || d.accessibility) && !d.healthConsent) errs.push(['healthConsent', u.err.consent_required]);
    if (!d.privacyAck) errs.push(['privacyAck', u.err.privacy_required]);
    return errs;
  }

  async function send(body) {
    const ctrl = new AbortController();
    const to = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
    try {
      // text/plain keeps this a "simple" CORS request (no preflight), which is
      // what Google Apps Script web apps support.
      const res = await fetch(r.endpoint, {
        method: 'POST',
        body: JSON.stringify(body),
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        redirect: 'follow',
        signal: ctrl.signal,
      });
      if (!res.ok) throw new Error('http ' + res.status);
      return await res.json();
    } finally {
      clearTimeout(to);
    }
  }

  /* --- submit --- */
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (state.sending || state.result || !r.endpoint) return;
    clearAll();
    status.textContent = '';
    const data = { ...readForm(form), lang };
    const errs = validate(data);
    if (errs.length) {
      const shown = errs.map(([k, msg]) => setError(k, msg));
      status.textContent = shown.some(Boolean) ? u.err.summary : errs[0][1];
      shown.find(Boolean)?.focus();
      return;
    }
    // One requestId per intended reply: retries and later corrections reuse it,
    // so the server keeps exactly one row for it.
    state.requestId = state.requestId || uuid();
    const body = state.mode === 'update'
      ? { ...data, action: 'update', token: state.token }
      : { ...data, action: 'submit', requestId: state.requestId, startedAt: state.startedAt };
    outbox.save({ body, savedAt: Date.now() });
    showGif();
    await deliver();
  });

  /* --- send what is in the outbox --- */
  async function deliver({ auto = false } = {}) {
    const entry = outbox.get();
    if (!entry || state.sending || !r.endpoint) return;
    clearTimeout(state.retryTimer);
    const data = entry.body;
    const updating = data.action === 'update';
    state.sending = true;
    submit.disabled = true;
    submit.setAttribute('aria-busy', 'true');
    submit.textContent = updating ? u.f.saving : u.f.sending;
    let res;
    try {
      res = await send(data);
    } catch {
      res = { ok: false, error: 'network' };
    }
    state.sending = false;
    // the form may have been re-rendered (language switch) while waiting
    if (panel.isConnected) {
      submit.disabled = false;
      submit.removeAttribute('aria-busy');
      submit.textContent = updating ? u.f.save : u.f.submit;
    }

    if (res && res.ok) {
      outbox.clear();
      state.retries = 0;
      state.dirty = false;
      state.requestId = null;
      const guest = data.people[0];
      state.result = {
        ...res,
        firstName: guest.firstName,
        attending: data.attending,
        partySize: data.attending === 'yes' ? data.people.length : 0,
        updated: updating,
      };
      if (res.token) {
        state.token = res.token;
        session.set(EDIT_KEY, res.token);
      }
      if (panel.isConnected) showDone(!auto);
      else state.deliverDoneLater = true;
      if (data.attending === 'yes' && cfg.fun?.confetti) confetti();
      return;
    }
    const code = res?.error || 'generic';
    if (TRANSIENT.has(code) || !(code in u.err)) {
      // Keep it on this device and try again later; tell the guest honestly.
      const wait = RETRY_S[Math.min(state.retries || 0, RETRY_S.length - 1)];
      state.retries = (state.retries || 0) + 1;
      state.retryTimer = setTimeout(() => state.deliver?.({ auto: true }), wait * 1000);
      if (panel.isConnected) status.textContent = u.err.queued;
      return;
    }
    outbox.clear(); // the server answered: this version cannot be accepted as is
    if (!panel.isConnected) return;
    hideGif();
    if (res?.field) {
      const part = res.field.split('.').pop();
      const msg = code === 'required' && u.err[part] ? u.err[part] : (u.err[code] || u.err.generic);
      const ctl = setError(res.field, msg);
      if (ctl) { status.textContent = u.err.summary; ctl.focus(); return; }
    }
    status.textContent = u.err[code] || u.err.generic;
  }

  /* --- success view --- */
  function showDone(focus = true) {
    const s = state.result;
    const link = state.token ? `${location.origin}${location.pathname}#editar=${state.token}` : '';
    done.innerHTML = `
      <h3 class="done__title">${esc(s.updated ? u.ok.updatedTitle(s.firstName) : u.ok.title(s.firstName))}</h3>
      <p>${esc(s.attending === 'yes' ? u.ok.yes(s.partySize) : u.ok.no)}</p>
      <p class="done__ref">${esc(u.ok.ref(s.id))}</p>
      ${link ? `
        <div class="done__edit">
          <p>${esc(u.ok.editIntro)}</p>
          <div class="copy">
            <label class="sr" for="edit-link">${esc(u.ok.copy)}</label>
            <input id="edit-link" type="text" readonly value="${esc(link)}" spellcheck="false">
            <button type="button" class="btn btn--small" data-copy>${esc(u.ok.copy)}</button>
          </div>
          <p class="copy__status" role="status" aria-live="polite"></p>
        </div>` : ''}
      <p><button type="button" class="link link--btn" data-again>${esc(u.ok.again)}</button></p>`;
    form.hidden = true;
    notice.hidden = true;
    showGif();
    done.hidden = false;
    if (focus) done.focus();
    done.querySelector('[data-copy]')?.addEventListener('click', async () => {
      const input = done.querySelector('#edit-link');
      try { await navigator.clipboard.writeText(input.value); }
      catch { input.select(); document.execCommand?.('copy'); }
      done.querySelector('.copy__status').textContent = u.ok.copied;
    });
    done.querySelector('[data-again]').addEventListener('click', () => {
      state.result = null;
      state.mode = 'submit';
      state.token = null;
      state.loaded = false;
      try { sessionStorage.removeItem(EDIT_KEY); } catch { /* ignore */ }
      state.startedAt = Date.now();
      state.requestId = null;
      form.reset();
      form.querySelectorAll('[data-person][data-role="extra"]').forEach((c) => c.remove());
      submit.textContent = u.f.submit;
      sync();
      hideGif();
      done.hidden = true;
      form.hidden = false;
      showNotice('');
      form.querySelector('#f-g-firstName').focus();
    });
  }

  if (state.result) { showDone(!state.deliverDoneLater); state.deliverDoneLater = false; return; }

  /* --- a reply saved on this device that has not been confirmed yet --- */
  const pending = r.endpoint ? outbox.get() : null;
  if (pending && !state.sending) {
    const d = pending.body;
    if (d.action === 'update') { state.mode = 'update'; state.token = d.token; state.needsLoad = false; }
    else { state.requestId = d.requestId; state.startedAt = d.startedAt; }
    writeForm(form, d);
    showNotice(u.rsvpPending(`${d.people?.[0]?.firstName || ''} ${d.people?.[0]?.lastName || ''}`.trim()));
    deliver({ auto: true });
  } else if (pending && state.sending) {
    showNotice(u.rsvpPending(`${pending.body.people?.[0]?.firstName || ''}`));
  }

  /* --- load existing response for editing --- */
  if (state.needsLoad && r.endpoint && state.token) {
    state.needsLoad = false;
    showNotice(u.rsvpLoading);
    submit.disabled = true;
    send({ action: 'load', token: state.token }).then((res) => {
      submit.disabled = false;
      if (!res.ok) {
        showNotice(u.err[res.error] || u.err.generic);
        state.mode = 'submit';
        state.token = null;
        try { sessionStorage.removeItem(EDIT_KEY); } catch { /* ignore */ }
        submit.textContent = u.f.submit;
        return;
      }
      state.loaded = true;
      const d = res.data;
      writeForm(form, {
        ...d,
        healthConsent: d.people.some((p) => p.diet.length) || !!d.accessibility,
        privacyAck: false,
      });
      showNotice(res.closed ? u.err.closed : u.rsvpEditing);
      if (res.closed) form.hidden = true;
    }).catch(() => {
      submit.disabled = false;
      showNotice(u.err.network);
    });
  }

  if (!state.unloadWired) {
    state.unloadWired = true;
    window.addEventListener('beforeunload', (e) => {
      if (state.dirty && !state.result) { e.preventDefault(); e.returnValue = ''; }
    });
  }
}
