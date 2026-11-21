// -----------------------------------------------------------------------------
// Calendar days as `YYYY-MM-DD` strings: a replacement happens on a day of
// the house (the timezone of Gladys, see time.js), never at an instant, so
// the arithmetic works on UTC midnights and is free of DST.
// -----------------------------------------------------------------------------

const DAY_MS = 24 * 3600 * 1000;
const ISO_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
// A replacement date older than this is a typing mistake.
const MIN_YEAR = 1990;

/**
 * @description UTC midnight of a day.
 * @param {string} iso - YYYY-MM-DD.
 * @returns {number} Milliseconds since the epoch.
 */
const toUtc = (iso) => {
  const [, y, m, d] = ISO_PATTERN.exec(iso);
  return Date.UTC(Number(y), Number(m) - 1, Number(d));
};

/**
 * @description True for an existing day written YYYY-MM-DD.
 * @param {unknown} value - The value.
 * @returns {boolean} True when valid.
 * @example
 * isIsoDay('2026-02-29'); // -> false
 */
function isIsoDay(value) {
  if (typeof value !== 'string' || !ISO_PATTERN.test(value)) {
    return false;
  }
  const date = new Date(toUtc(value));
  return date.toISOString().slice(0, 10) === value && date.getUTCFullYear() >= MIN_YEAR;
}

/**
 * @description Days from one day to another (negative when `to` is before).
 * @param {string} from - YYYY-MM-DD.
 * @param {string} to - YYYY-MM-DD.
 * @returns {number} Whole days.
 * @example
 * daysBetween('2026-01-01', '2026-01-31'); // -> 30
 */
const daysBetween = (from, to) => Math.round((toUtc(to) - toUtc(from)) / DAY_MS);

/**
 * @description A day moved by a number of days.
 * @param {string} iso - YYYY-MM-DD.
 * @param {number} days - Days to add (negative to go back).
 * @returns {string} YYYY-MM-DD.
 * @example
 * addDays('2026-12-31', 1); // -> '2027-01-01'
 */
const addDays = (iso, days) => new Date(toUtc(iso) + days * DAY_MS).toISOString().slice(0, 10);

/**
 * @description Read a day typed by the user, day first as in Europe
 * (24/12/2026, 24.12.2026, 24-12-2026) or ISO (2026-12-24). The words
 * "today" and an empty text are handled by the caller.
 * @param {unknown} raw - The typed text.
 * @returns {string|null} YYYY-MM-DD, or null when it is not an existing day.
 * @example
 * parseTypedDay('3/9/2026'); // -> '2026-09-03'
 */
function parseTypedDay(raw) {
  const text = String(raw ?? '').trim();
  const iso = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(text);
  const dayFirst = /^(\d{1,2})\s*[/.-]\s*(\d{1,2})\s*[/.-]\s*(\d{4})$/.exec(text);
  let parts = null;
  if (iso) parts = [iso[1], iso[2], iso[3]];
  if (dayFirst) parts = [dayFirst[3], dayFirst[2], dayFirst[1]];
  if (!parts) {
    return null;
  }
  const day = `${parts[0]}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`;
  return isIsoDay(day) ? day : null;
}

export { DAY_MS, MIN_YEAR, isIsoDay, daysBetween, addDays, parseTypedDay };
