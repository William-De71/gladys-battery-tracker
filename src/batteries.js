// -----------------------------------------------------------------------------
// What the integration knows about a battery on a given day, computed from
// its record (registry.js), the last level a scene reported for it
// (state.js) and the configuration. Pure functions: no clock, no storage.
//
// - Life: the life set on the battery, else the life learned from its past
//   replacements (average of the last three intervals of 14 days or more),
//   else the default life of the configuration.
// - Level: the last reported level when it is less than 14 days old (the
//   sensor still talks), else an estimate from the age, linear over the life.
//   The estimate says nothing about the real chemistry: it is labelled so.
// - Due: the end is within the reminder days, or the reported level is at or
//   under the low level. "Replace" when the end is reached or the reported
//   level is low, "soon" before.
// - Shopping list: for each type, the batteries due within the horizon minus
//   the spare ones in stock.
// -----------------------------------------------------------------------------

import { daysBetween, addDays } from './dates.js';

const DAYS_PER_MONTH = 365.25 / 12;
const REPORT_MAX_AGE_DAYS = 14;
const LEARN_MIN_DAYS = 14;
const LEARN_LAST = 3;
// A reported level rising this much is a new battery (Battery Notes uses 25).
const REPLACE_RISE = 25;
const URGENCY = { OK: 'ok', SOON: 'soon', REPLACE: 'replace' };
const URGENCY_ORDER = { [URGENCY.REPLACE]: 0, [URGENCY.SOON]: 1, [URGENCY.OK]: 2 };

/**
 * @description The display form of a battery type: short codes in capitals
 * (aa -> AA, cr2032 -> CR2032), longer names as typed, spaces collapsed.
 * @param {unknown} raw - The typed type.
 * @returns {string} The type ('' when empty).
 * @example
 * normalizeType(' cr 2032 '); // -> 'CR 2032'
 */
function normalizeType(raw) {
  const text = String(raw ?? '')
    .trim()
    .replace(/\s+/g, ' ');
  return text.length <= 10 && /^[a-z0-9 .-]+$/i.test(text) ? text.toUpperCase() : text;
}

/**
 * @description The key two types are compared by: "CR 2032" and "cr2032"
 * are the same battery.
 * @param {string} type - A type.
 * @returns {string} The key.
 */
const typeKey = (type) =>
  String(type ?? '')
    .toLowerCase()
    .replace(/[\s.-]/g, '');

/**
 * @description Days of a number of months.
 * @param {number} months - Months.
 * @returns {number} Whole days.
 */
const monthsToDays = (months) => Math.round(months * DAYS_PER_MONTH);

/**
 * @description The life learned from the past replacements of a battery.
 * @param {object} entry - The battery.
 * @returns {number|null} Days, or null with less than one usable interval.
 */
function learnedLife(entry) {
  const days = [...(entry.history ?? []), entry.replacedOn];
  const intervals = [];
  for (let i = 1; i < days.length; i += 1) {
    const interval = daysBetween(days[i - 1], days[i]);
    if (interval >= LEARN_MIN_DAYS) intervals.push(interval);
  }
  if (intervals.length === 0) {
    return null;
  }
  const last = intervals.slice(-LEARN_LAST);
  return Math.round(last.reduce((sum, value) => sum + value, 0) / last.length);
}

/**
 * @description The life used for a battery, and where it comes from.
 * @param {object} entry - The battery.
 * @param {object} config - normalizeConfig().
 * @returns {{ days: number, source: 'set'|'learned'|'default' }} The life.
 */
function lifeOf(entry, config) {
  if (entry.lifeMonths) {
    return { days: monthsToDays(entry.lifeMonths), source: 'set' };
  }
  const learned = learnedLife(entry);
  if (learned !== null) {
    return { days: learned, source: 'learned' };
  }
  return { days: monthsToDays(config.lifeMonths), source: 'default' };
}

/**
 * @description The state of a battery on a day.
 * @param {object} entry - The battery.
 * @param {string} today - YYYY-MM-DD.
 * @param {object} config - normalizeConfig().
 * @param {{ level: number, day: string }|null} [report] - Last reported level.
 * @returns {object} The status.
 * @example
 * statusOf(entry, '2026-11-21', config, { level: 64, day: '2026-11-20' });
 */
function statusOf(entry, today, config, report = null) {
  const life = lifeOf(entry, config);
  const daysSince = Math.max(0, daysBetween(entry.replacedOn, today));
  const daysRemaining = life.days - daysSince;
  const estimate = Math.min(100, Math.max(0, Math.round(100 * (1 - daysSince / life.days))));
  const reported =
    report &&
    Number.isFinite(report.level) &&
    daysBetween(report.day, today) <= REPORT_MAX_AGE_DAYS &&
    daysBetween(report.day, today) >= 0;
  const level = reported ? report.level : estimate;
  const levelLow = Boolean(reported) && level <= config.lowLevel;
  let urgency = URGENCY.OK;
  if (daysRemaining <= 0 || levelLow) urgency = URGENCY.REPLACE;
  else if (daysRemaining <= config.reminderDays) urgency = URGENCY.SOON;
  return {
    entry,
    life,
    daysSince,
    daysRemaining,
    endDay: addDays(entry.replacedOn, life.days),
    level,
    estimate,
    levelSource: reported ? 'reported' : 'estimated',
    reportDay: reported ? report.day : null,
    levelLow,
    urgency,
    due: urgency !== URGENCY.OK,
    reason: levelLow ? 'level' : 'age',
  };
}

/**
 * @description Statuses sorted from the most urgent: replace, soon, ok, then
 * by days remaining and name.
 * @param {object[]} statuses - statusOf() results.
 * @returns {object[]} A sorted copy.
 */
function byUrgency(statuses) {
  return [...statuses].sort(
    (a, b) =>
      URGENCY_ORDER[a.urgency] - URGENCY_ORDER[b.urgency] ||
      (a.levelLow ? a.level - 100 : a.daysRemaining) -
        (b.levelLow ? b.level - 100 : b.daysRemaining) ||
      a.entry.name.localeCompare(b.entry.name),
  );
}

/**
 * @description The shopping list: for each battery type, how many are needed
 * within the horizon (due now, or ending within the horizon), how many are in
 * stock and how many to buy. Types with neither need nor stock are left out.
 * @param {object[]} statuses - statusOf() results.
 * @param {object} stock - Spare batteries by type.
 * @param {number} horizonDays - Horizon of the list.
 * @returns {object[]} `{ type, key, needed, stock, toBuy, installed }`, most to buy first.
 */
function shoppingList(statuses, stock, horizonDays) {
  const rows = new Map();
  const row = (type) => {
    const key = typeKey(type);
    if (!rows.has(key)) rows.set(key, { type, key, needed: 0, stock: 0, installed: 0 });
    return rows.get(key);
  };
  Object.entries(stock ?? {}).forEach(([type, count]) => {
    row(type).stock += count;
  });
  statuses.forEach((status) => {
    const item = row(status.entry.type);
    item.installed += status.entry.quantity;
    if (status.due || status.daysRemaining <= horizonDays) {
      item.needed += status.entry.quantity;
    }
  });
  return [...rows.values()]
    .map((item) => ({ ...item, toBuy: Math.max(0, item.needed - item.stock) }))
    .filter((item) => item.needed > 0 || item.stock > 0)
    .sort((a, b) => b.toBuy - a.toBuy || b.needed - a.needed || a.type.localeCompare(b.type));
}

/**
 * @description Whether a newly reported level means the battery was
 * replaced: it rose by REPLACE_RISE points or more since the last report.
 * @param {{ level: number }|null} previous - The last report.
 * @param {number} level - The new level.
 * @returns {boolean} True for a replacement.
 */
const isReplacementRise = (previous, level) =>
  Boolean(previous) && Number.isFinite(previous.level) && level - previous.level >= REPLACE_RISE;

/**
 * @description Read a reported level: a number from 0 to 100, also typed
 * with a comma or a percent sign ("64,5 %"); rounded.
 * @param {unknown} raw - The value the scene sent.
 * @returns {number|null} The level, or null when it is not one.
 * @example
 * parseLevel('64,5 %'); // -> 65
 */
function parseLevel(raw) {
  if (typeof raw === 'number') {
    return Number.isFinite(raw) && raw >= 0 && raw <= 100 ? Math.round(raw) : null;
  }
  const text = String(raw ?? '')
    .trim()
    .replace(/\s*%$/, '')
    .replace(',', '.');
  if (!/^\d+(\.\d+)?$/.test(text)) {
    return null;
  }
  const value = Number(text);
  return value <= 100 ? Math.round(value) : null;
}

export {
  DAYS_PER_MONTH,
  REPORT_MAX_AGE_DAYS,
  REPLACE_RISE,
  URGENCY,
  normalizeType,
  typeKey,
  monthsToDays,
  learnedLife,
  lifeOf,
  statusOf,
  byUrgency,
  shoppingList,
  isReplacementRise,
  parseLevel,
};
