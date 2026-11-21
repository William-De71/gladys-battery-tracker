// -----------------------------------------------------------------------------
// Configuration of the Battery Tracker integration.
//
// Fields of the config_schema:
//   - `default_life_months`  life of a battery with no life of its own and no
//                            learned one (months);
//   - `reminder_days`        a battery is "to replace soon" this many days
//                            before its estimated end;
//   - `low_level`            a reported level at or under it (%) makes the
//                            battery due, whatever its age;
//   - `auto_replace`         a reported level rising by 25 points or more
//                            counts as a replacement;
//   - `decrement_stock`      a replacement takes its batteries from the stock;
//   - `horizon_days`         the shopping list covers the batteries due within
//                            this many days;
//   - `event_hour`           local hour the scene events of the day may start
//                            at (a battery reaching its end at midnight waits
//                            for it);
//   - `language`             language of the texts Gladys does not ask for in
//                            a language (feature names, last replacement,
//                            scene texts, messages of the configuration
//                            buttons): `auto` follows the language of the
//                            last widget request, guessed from the timezone
//                            until a widget is shown.
//
// Internal keys, outside the config_schema (stored by setConfig in the Gladys
// database, so they follow the Gladys backups):
//   - `batteries`      the batteries (see registry.js);
//   - `battery_stock`  the spare batteries by type;
//   - `last_language`  language of the last widget request.
// -----------------------------------------------------------------------------

import { isLanguage } from './i18n.js';

const LIFE_MONTHS = { min: 1, max: 240, default: 12 };
const REMINDER_DAYS = { min: 0, max: 180, default: 14 };
const LOW_LEVEL = { min: 1, max: 99, default: 20 };
const HORIZON_DAYS = { min: 0, max: 365, default: 30 };
const EVENT_HOUR = { min: 0, max: 23, default: 9 };
const AUTO_LANGUAGE = 'auto';
const INTERNAL_KEYS = { registry: 'batteries', stock: 'battery_stock', language: 'last_language' };

/**
 * @description Read a bounded whole number, falling back to its default.
 * @param {unknown} raw - The raw value (the form can send numbers as strings).
 * @param {{ min: number, max: number, default: number }} bounds - The bounds.
 * @returns {number} The value.
 * @example
 * readNumber('8', EVENT_HOUR); // -> 8
 */
function readNumber(raw, bounds) {
  if (raw === '' || raw === null || raw === undefined) {
    return bounds.default;
  }
  const value = Number(raw);
  if (!Number.isFinite(value)) {
    return bounds.default;
  }
  return Math.min(bounds.max, Math.max(bounds.min, Math.round(value)));
}

/**
 * @description Read a boolean, falling back to its default.
 * @param {unknown} raw - The raw value.
 * @param {boolean} fallback - The default.
 * @returns {boolean} The value.
 */
function readBoolean(raw, fallback) {
  if (raw === true || raw === 'true' || raw === 1 || raw === '1') return true;
  if (raw === false || raw === 'false' || raw === 0 || raw === '0') return false;
  return fallback;
}

/**
 * @description Normalize the raw config object from the host API.
 * @param {object} [rawConfig] - The raw config values.
 * @returns {object} The config.
 * @example
 * normalizeConfig({ reminder_days: 7 });
 */
function normalizeConfig(rawConfig = {}) {
  const config = rawConfig ?? {};
  return {
    lifeMonths: readNumber(config.default_life_months, LIFE_MONTHS),
    reminderDays: readNumber(config.reminder_days, REMINDER_DAYS),
    lowLevel: readNumber(config.low_level, LOW_LEVEL),
    autoReplace: readBoolean(config.auto_replace, true),
    decrementStock: readBoolean(config.decrement_stock, true),
    horizonDays: readNumber(config.horizon_days, HORIZON_DAYS),
    eventHour: readNumber(config.event_hour, EVENT_HOUR),
    language: isLanguage(config.language) ? config.language : AUTO_LANGUAGE,
  };
}

// Timezones of the countries speaking one of the languages of the
// integration; any other one is English. A guess for the first devices only:
// the first widget shown gives the real language.
const TIMEZONE_LANGUAGES = {
  fr: [
    'Europe/Paris',
    'Europe/Monaco',
    'Europe/Brussels',
    'Europe/Luxembourg',
    'Indian/Reunion',
    'Indian/Mayotte',
    'America/Guadeloupe',
    'America/Martinique',
    'America/Cayenne',
    'America/Miquelon',
    'Pacific/Noumea',
    'Pacific/Tahiti',
    'America/Montreal',
    'Africa/Abidjan',
    'Africa/Dakar',
    'Africa/Casablanca',
    'Africa/Algiers',
    'Africa/Tunis',
  ],
  de: ['Europe/Berlin', 'Europe/Busingen', 'Europe/Vienna', 'Europe/Zurich', 'Europe/Vaduz'],
  es: [
    'Europe/Madrid',
    'Atlantic/Canary',
    'Africa/Ceuta',
    'America/Mexico_City',
    'America/Bogota',
    'America/Lima',
    'America/Santiago',
    'America/Caracas',
    'America/Montevideo',
    'America/Asuncion',
    'America/La_Paz',
    'America/Guayaquil',
    'America/Havana',
    'America/Panama',
    'America/Costa_Rica',
    'America/Guatemala',
    'America/Santo_Domingo',
    'America/Puerto_Rico',
  ],
};

/**
 * @description The language of the texts guessed from a timezone, before
 * any widget was shown.
 * @param {string} timezone - IANA timezone of Gladys.
 * @returns {string} en, fr, de or es.
 * @example
 * guessLanguage('Europe/Paris'); // -> 'fr'
 */
function guessLanguage(timezone) {
  const zone = String(timezone ?? '');
  if (zone.startsWith('America/Argentina/')) return 'es';
  const found = Object.entries(TIMEZONE_LANGUAGES).find(([, zones]) => zones.includes(zone));
  return found ? found[0] : 'en';
}

/**
 * @description Read the stored language of the last widget request.
 * @param {object} [rawConfig] - The raw config values.
 * @param {string} fallback - The language to keep when nothing valid is stored.
 * @returns {string} The language.
 */
function readLanguage(rawConfig, fallback) {
  const language = (rawConfig ?? {})[INTERNAL_KEYS.language];
  return isLanguage(language) ? language : fallback;
}

export {
  LIFE_MONTHS,
  REMINDER_DAYS,
  LOW_LEVEL,
  HORIZON_DAYS,
  EVENT_HOUR,
  AUTO_LANGUAGE,
  INTERNAL_KEYS,
  readNumber,
  readBoolean,
  normalizeConfig,
  guessLanguage,
  readLanguage,
};
