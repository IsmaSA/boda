// Date helpers that work in an explicit time zone, independent of the
// visitor's own clock settings. Pure functions: also used by the build and tests.

/** Offset (ms) of `tz` from UTC at instant `ms`. */
function tzOffset(ms, tz) {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', {
      timeZone: tz, hourCycle: 'h23', year: 'numeric', month: 'numeric', day: 'numeric',
      hour: 'numeric', minute: 'numeric', second: 'numeric',
    }).formatToParts(new Date(ms)).map((x) => [x.type, Number(x.value)]),
  );
  return Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second) - Math.floor(ms / 1000) * 1000;
}

/** '2027-09-18' + '12:30' in 'Europe/Madrid' → UTC milliseconds. */
export function zonedToUtc(date, time, tz) {
  const [y, m, d] = date.split('-').map(Number);
  const [hh, mm] = (time || '00:00').split(':').map(Number);
  const guess = Date.UTC(y, m - 1, d, hh, mm);
  let t = guess - tzOffset(guess, tz);
  t = guess - tzOffset(t, tz); // second pass handles DST boundaries
  return t;
}

/** Calendar date (YYYY-MM-DD) of instant `ms` in `tz`. */
export function localDate(ms, tz) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' })
    .format(new Date(ms));
}

/**
 * Countdown state for the wedding.
 *  before: counting down to the target
 *  today:  target reached, still the wedding day (local time)
 *  after:  the day has passed
 * Never returns negative numbers.
 */
export function countdown(nowMs, wedding) {
  const time = wedding.ceremonyTime || wedding.countdownFallbackTime || '00:00';
  const target = zonedToUtc(wedding.date, time, wedding.timeZone);
  const today = localDate(nowMs, wedding.timeZone);
  if (today > wedding.date) return { phase: 'after' };
  if (nowMs >= target) return { phase: 'today' };
  let s = Math.floor((target - nowMs) / 1000);
  const days = Math.floor(s / 86400); s -= days * 86400;
  const hours = Math.floor(s / 3600); s -= hours * 3600;
  const minutes = Math.floor(s / 60);
  return { phase: 'before', days, hours, minutes, seconds: s - minutes * 60, target };
}

/** Long, localised date for an ISO calendar date, e.g. «sábado, 18 de septiembre de 2027». */
export function formatDate(iso, lang, opts = { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }) {
  const [y, m, d] = iso.split('-').map(Number);
  const s = new Intl.DateTimeFormat(lang === 'en' ? 'en-GB' : 'es-ES', { ...opts, timeZone: 'UTC' })
    .format(new Date(Date.UTC(y, m - 1, d, 12)));
  return s;
}

/** Localised clock time from 'HH:MM'. */
export function formatTime(hhmm, lang) {
  const [h, m] = hhmm.split(':').map(Number);
  return new Intl.DateTimeFormat(lang === 'en' ? 'en-GB' : 'es-ES', { hour: '2-digit', minute: '2-digit', timeZone: 'UTC' })
    .format(new Date(Date.UTC(2000, 0, 1, h, m)));
}
