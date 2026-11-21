// -----------------------------------------------------------------------------
// The batteries the user declared with the configuration buttons, and the
// spare batteries in stock. No JSON to type: plain forms whose fields are
// checked here.
//
// Stored through setConfig() under INTERNAL_KEYS.registry and
// INTERNAL_KEYS.stock, keys outside the config_schema: the configuration
// lives in the Gladys database, so the batteries follow the Gladys backups
// (/data does not). A change is applied in memory only once Gladys saved it,
// and changes run one after the other: two quick buttons never lose a change.
//
// Each battery gets a random identifier at creation (8 hex digits), kept for
// ever: it builds the external ids of its device, never its name.
//
// A battery record:
//   { id, name, type, quantity, lifeMonths (null = learned or default),
//     replacedOn (YYYY-MM-DD), history (previous replacement days, oldest
//     first, 10 at most), taken (batteries taken from the stock at the last
//     replacement, given back by an undo), model (where the type came from,
//     informative) }
// -----------------------------------------------------------------------------

import { randomBytes } from 'node:crypto';
import { INTERNAL_KEYS, LIFE_MONTHS } from './config.js';
import { isIsoDay, parseTypedDay, daysBetween } from './dates.js';
import { normalizeType, typeKey } from './batteries.js';
import { lookupModel, singleBattery } from './library.js';

// Far beyond a house, and a scene event per battery stays far under the
// 300 events per minute of the host API.
const MAX_BATTERIES = 300;
const MAX_TYPES = 50;
const NAME_MAX = 60;
const TYPE_MAX = 30;
const MODEL_MAX = 80;
const QUANTITY = { min: 1, max: 24 };
const STOCK_MAX = 9999;
const HISTORY_MAX = 10;
const ID_PATTERN = /^[0-9a-f]{8}$/;
// Library answers that are not a battery to buy.
const NOT_A_TYPE = ['manual', 'irreplaceable'];
const STOCK_OPERATIONS = ['add', 'remove', 'set'];

class RegistryError extends Error {
  /**
   * @param {string} key - The TEXTS key of the message.
   * @param {object} [params] - Its substitutions.
   */
  constructor(key, params = {}) {
    super(key);
    this.key = key;
    this.params = params;
  }
}

const isEmpty = (value) => value === undefined || value === null || String(value).trim() === '';
const clean = (value) =>
  String(value ?? '')
    .trim()
    .replace(/\s+/g, ' ');

/**
 * @description Read a whole number of a form (numbers can come as strings).
 * @param {unknown} raw - The value.
 * @returns {number|null|undefined} The number, null when empty, undefined when invalid.
 */
function readInteger(raw) {
  if (isEmpty(raw)) {
    return null;
  }
  const value = Number(typeof raw === 'string' ? raw.trim().replace(',', '.') : raw);
  return Number.isInteger(value) ? value : undefined;
}

/**
 * @description Read the day of a replacement: empty or "today" is today, a
 * day in the future is refused.
 * @param {unknown} raw - The typed text.
 * @param {string} today - YYYY-MM-DD.
 * @returns {string} YYYY-MM-DD.
 * @throws {RegistryError} When it is not a day, or in the future.
 */
function readDay(raw, today) {
  if (isEmpty(raw) || /^(today|aujourd'?hui|heute|hoy)$/i.test(String(raw).trim())) {
    return today;
  }
  const day = parseTypedDay(raw);
  if (day === null) {
    throw new RegistryError('errorDay', { value: clean(raw) });
  }
  if (daysBetween(today, day) > 0) {
    throw new RegistryError('errorFutureDay');
  }
  return day;
}

/**
 * @description Check a complete battery and return its normalized form.
 * @param {object} entry - The candidate.
 * @returns {object} The battery.
 * @throws {RegistryError} When a field is invalid.
 */
function validateEntry(entry) {
  const name = clean(entry.name);
  if (name.length === 0 || name.length > NAME_MAX) {
    throw new RegistryError('errorName', { max: NAME_MAX });
  }
  const type = normalizeType(entry.type);
  if (type.length === 0 || type.length > TYPE_MAX) {
    throw new RegistryError('errorType', { max: TYPE_MAX });
  }
  if (
    !Number.isInteger(entry.quantity) ||
    entry.quantity < QUANTITY.min ||
    entry.quantity > QUANTITY.max
  ) {
    throw new RegistryError('errorQuantity', QUANTITY);
  }
  const lifeMonths = entry.lifeMonths ?? null;
  if (
    lifeMonths !== null &&
    (!Number.isInteger(lifeMonths) || lifeMonths < LIFE_MONTHS.min || lifeMonths > LIFE_MONTHS.max)
  ) {
    throw new RegistryError('errorLife', LIFE_MONTHS);
  }
  if (!isIsoDay(entry.replacedOn)) {
    throw new RegistryError('errorDay', { value: String(entry.replacedOn ?? '') });
  }
  const history = (Array.isArray(entry.history) ? entry.history : [])
    .filter((day) => isIsoDay(day) && daysBetween(day, entry.replacedOn) > 0)
    .sort()
    .slice(-HISTORY_MAX);
  return {
    id: entry.id,
    name,
    type,
    quantity: entry.quantity,
    lifeMonths,
    replacedOn: entry.replacedOn,
    history,
    taken: Number.isInteger(entry.taken) && entry.taken > 0 ? entry.taken : 0,
    model: clean(entry.model).slice(0, MODEL_MAX),
  };
}

/**
 * @description The battery type and count of a new battery: typed, or
 * found in the device library from the manufacturer and the model.
 * @param {object} fields - The form values.
 * @returns {{ type: string, quantity: number|null, model: string }} What was found.
 * @throws {RegistryError} When nothing usable was typed or found.
 */
function resolveBattery(fields) {
  const typed = normalizeType(fields.battery_type);
  const model = [clean(fields.manufacturer), clean(fields.model)].filter(Boolean).join(' ');
  if (typed) {
    return { type: typed, quantity: null, model };
  }
  if (!model) {
    throw new RegistryError('errorTypeMissing');
  }
  const { matches, total } = lookupModel(fields.manufacturer, fields.model);
  if (total === 0) {
    throw new RegistryError('errorModelUnknown', { model });
  }
  const battery = singleBattery(matches);
  if (battery === null || total > matches.length) {
    throw new RegistryError('errorModelAmbiguous', {
      model,
      count: total,
      types: [...new Set(matches.map((match) => `${match.quantity} × ${match.type}`))].join(', '),
    });
  }
  if (NOT_A_TYPE.includes(battery.type.toLowerCase())) {
    throw new RegistryError(`errorModel_${battery.type.toLowerCase()}`, { model });
  }
  const [first] = matches;
  return {
    type: battery.type,
    quantity: battery.quantity,
    model: first.label,
  };
}

/**
 * @description A new battery from the fields of the "Add a battery" form.
 * @param {object} fields - The form values.
 * @param {string} id - Its identifier.
 * @param {string} today - YYYY-MM-DD.
 * @returns {object} The battery.
 * @throws {RegistryError} When a field is invalid.
 */
function entryFromFields(fields, id, today) {
  const battery = resolveBattery(fields);
  const quantity = readInteger(fields.quantity);
  const lifeMonths = readInteger(fields.life_months);
  if (quantity === undefined) throw new RegistryError('errorQuantity', QUANTITY);
  if (lifeMonths === undefined) throw new RegistryError('errorLife', LIFE_MONTHS);
  return validateEntry({
    id,
    name: fields.name,
    type: battery.type,
    quantity: quantity ?? battery.quantity ?? 1,
    lifeMonths: lifeMonths === 0 ? null : lifeMonths,
    replacedOn: readDay(fields.replaced_on, today),
    history: [],
    taken: 0,
    model: battery.model,
  });
}

/**
 * @description A battery changed by the fields of the "Edit a battery"
 * form: an empty field keeps the current value, a life of 0 goes back to the
 * learned or default life.
 * @param {object} current - The current battery.
 * @param {object} fields - The form values.
 * @param {string} today - YYYY-MM-DD.
 * @returns {object} The new battery.
 * @throws {RegistryError} When a field is invalid.
 */
function editedEntry(current, fields, today) {
  const next = { ...current };
  if (!isEmpty(fields.name)) next.name = fields.name;
  if (!isEmpty(fields.battery_type)) next.type = fields.battery_type;
  const quantity = readInteger(fields.quantity);
  if (quantity === undefined) throw new RegistryError('errorQuantity', QUANTITY);
  if (quantity !== null) next.quantity = quantity;
  const lifeMonths = readInteger(fields.life_months);
  if (lifeMonths === undefined) throw new RegistryError('errorLife', LIFE_MONTHS);
  if (lifeMonths !== null) next.lifeMonths = lifeMonths === 0 ? null : lifeMonths;
  if (!isEmpty(fields.replaced_on)) next.replacedOn = readDay(fields.replaced_on, today);
  return validateEntry(next);
}

/**
 * @description Read the stored batteries, dropping what is not valid.
 * @param {*} stored - The stored value (an array, or its JSON).
 * @param {object} [logger] - Logger.
 * @returns {object[]} The batteries.
 */
function parseRegistry(stored, logger) {
  let list = stored;
  if (typeof stored === 'string') {
    try {
      list = JSON.parse(stored);
    } catch {
      logger?.warn('Battery Tracker: the stored batteries are not valid JSON, ignored');
      return [];
    }
  }
  if (!Array.isArray(list)) {
    return [];
  }
  const seen = new Set();
  const entries = [];
  for (const raw of list) {
    try {
      if (!raw || !ID_PATTERN.test(raw.id) || seen.has(raw.id)) {
        throw new RegistryError('invalid');
      }
      entries.push(validateEntry(raw));
      seen.add(raw.id);
    } catch {
      logger?.warn(
        `Battery Tracker: stored battery ignored: ${JSON.stringify(raw)?.slice(0, 200)}`,
      );
    }
  }
  return entries.slice(0, MAX_BATTERIES);
}

/**
 * @description Read the stored stock: whole counts from 0, by type.
 * @param {*} stored - The stored value (an object, or its JSON).
 * @returns {object} `{ [type]: count }`.
 */
function parseStock(stored) {
  let value = stored;
  if (typeof stored === 'string') {
    try {
      value = JSON.parse(stored);
    } catch {
      return {};
    }
  }
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }
  const stock = {};
  Object.entries(value).forEach(([type, count]) => {
    const name = normalizeType(type);
    if (name && name.length <= TYPE_MAX && Number.isInteger(count) && count >= 0) {
      stock[name] = Math.min(STOCK_MAX, count);
    }
  });
  return stock;
}

/**
 * @description The name a type is stored under in the stock: the existing
 * spelling when the same battery is already there.
 * @param {object} stock - The stock.
 * @param {string} type - A type.
 * @returns {string|undefined} The stored name.
 */
const stockName = (stock, type) =>
  Object.keys(stock).find((name) => typeKey(name) === typeKey(type));

/**
 * @description The registry of the batteries and of the stock.
 * @param {object} gladys - SDK client (setConfig).
 * @param {object} [options] - Options.
 * @param {object} [options.logger] - Logger.
 * @param {Function} [options.newId] - `() => string`, 8 hex digits (tests).
 * @returns {object} The registry.
 */
function createRegistry(gladys, { logger, newId = () => randomBytes(4).toString('hex') } = {}) {
  let entries = [];
  let stock = {};
  let writing = Promise.resolve();

  // One change at a time, computed from the previous one once it is saved.
  const serial = (change) => {
    const run = writing.then(async () => {
      const { next = entries, nextStock = stock, result } = change(entries, stock);
      const values = {};
      if (next !== entries) values[INTERNAL_KEYS.registry] = next;
      if (nextStock !== stock) values[INTERNAL_KEYS.stock] = nextStock;
      if (Object.keys(values).length > 0) {
        await gladys.setConfig(values);
      }
      entries = next;
      stock = nextStock;
      return result;
    });
    writing = run.catch(() => {});
    return run;
  };

  /**
   * @description The stock after a replacement takes its batteries.
   * @param {object} current - The stock.
   * @param {object} entry - The battery.
   * @param {boolean} decrement - Whether the stock is used.
   * @returns {{ nextStock: object, taken: number, left: number|null, short: boolean }} The change.
   */
  const takeFromStock = (current, entry, decrement) => {
    const name = decrement ? stockName(current, entry.type) : undefined;
    if (name === undefined) {
      return { nextStock: current, taken: 0, left: null, short: false };
    }
    const taken = Math.min(current[name], entry.quantity);
    return {
      nextStock: { ...current, [name]: current[name] - taken },
      taken,
      left: current[name] - taken,
      short: taken < entry.quantity,
    };
  };

  const registry = {
    /** @param {object} config - `gladys.config`. @returns {object[]} The batteries. */
    load(config) {
      entries = parseRegistry(config?.[INTERNAL_KEYS.registry], logger);
      stock = parseStock(config?.[INTERNAL_KEYS.stock]);
      return entries;
    },

    list: () => entries,
    stock: () => stock,

    /** @param {string} id - Identifier. @returns {object|undefined} The battery. */
    byId: (id) => entries.find((entry) => entry.id === id),

    /**
     * @description Find a battery by its number in the list (#2 or 2), its
     * name (any case) or its identifier.
     * @param {string} query - What the user typed.
     * @returns {object} The battery.
     * @throws {RegistryError} When none or several match.
     */
    find(query) {
      const value = clean(query);
      if (!value) {
        throw new RegistryError('errorTarget');
      }
      const number = /^#?(\d{1,4})$/.exec(value);
      if (number) {
        const entry = entries[Number(number[1]) - 1];
        if (entry) return entry;
      }
      const lower = value.toLocaleLowerCase();
      const byName = entries.filter((entry) => entry.name.toLocaleLowerCase() === lower);
      if (byName.length === 1) return byName[0];
      if (byName.length > 1) {
        throw new RegistryError('errorAmbiguous', {
          query: value,
          numbers: byName.map((entry) => `#${entries.indexOf(entry) + 1}`).join(', '),
        });
      }
      const byId = entries.find((entry) => entry.id === lower);
      if (byId) return byId;
      throw new RegistryError('errorNotFound', { query: value });
    },

    /**
     * @description Add a battery from the "Add a battery" form.
     * @param {object} fields - The form values.
     * @param {string} today - YYYY-MM-DD.
     * @returns {Promise<object>} The new battery.
     */
    add(fields, today) {
      return serial((current) => {
        if (current.length >= MAX_BATTERIES) {
          throw new RegistryError('errorFull', { max: MAX_BATTERIES });
        }
        let id = newId();
        while (current.some((entry) => entry.id === id)) {
          id = newId();
        }
        const entry = entryFromFields(fields, id, today);
        return { next: [...current, entry], result: entry };
      });
    },

    /**
     * @description Change a battery from the "Edit a battery" form.
     * @param {object} fields - The form values (`battery`: which one).
     * @param {string} today - YYYY-MM-DD.
     * @returns {Promise<{ before: object, after: object }>} The change.
     */
    edit(fields, today) {
      return serial((current) => {
        const before = registry.find(fields.battery);
        const after = editedEntry(before, fields, today);
        return {
          next: current.map((entry) => (entry.id === before.id ? after : entry)),
          result: { before, after },
        };
      });
    },

    /**
     * @description Remove a battery.
     * @param {string} query - Its number, name or identifier.
     * @returns {Promise<object>} The removed battery.
     */
    remove(query) {
      return serial((current) => {
        const entry = registry.find(query);
        return { next: current.filter((other) => other.id !== entry.id), result: entry };
      });
    },

    /**
     * @description Record a replacement: the previous day goes to the history,
     * the batteries are taken from the stock when it holds this type.
     * @param {string} id - The battery.
     * @param {string} day - YYYY-MM-DD of the replacement.
     * @param {object} [options] - Options.
     * @param {boolean} [options.decrement] - Take the batteries from the stock.
     * @returns {Promise<object>} `{ entry, previous, daysUsed, stockLeft, short }`.
     */
    replace(id, day, { decrement = true } = {}) {
      return serial((current, currentStock) => {
        const before = current.find((entry) => entry.id === id);
        if (!before) {
          throw new RegistryError('errorNotFound', { query: id });
        }
        if (daysBetween(before.replacedOn, day) < 0) {
          throw new RegistryError('errorBeforeLast');
        }
        const { nextStock, taken, left, short } = takeFromStock(currentStock, before, decrement);
        const history =
          before.replacedOn === day ? before.history : [...before.history, before.replacedOn];
        const after = validateEntry({ ...before, replacedOn: day, history, taken });
        return {
          next: current.map((entry) => (entry.id === id ? after : entry)),
          nextStock,
          result: {
            entry: after,
            previous: before.replacedOn,
            daysUsed: daysBetween(before.replacedOn, day),
            stockLeft: left,
            short,
          },
        };
      });
    },

    /**
     * @description Undo the last replacement of a battery: its previous day
     * comes back, and the batteries it took go back to the stock.
     * @param {string} query - Its number, name or identifier.
     * @returns {Promise<{ entry: object, returned: number }>} The battery and the batteries given back.
     */
    undo(query) {
      return serial((current, currentStock) => {
        const before = registry.find(query);
        if (before.history.length === 0) {
          throw new RegistryError('errorNothingToUndo', { name: before.name });
        }
        const replacedOn = before.history.at(-1);
        const after = validateEntry({
          ...before,
          replacedOn,
          history: before.history.slice(0, -1),
          taken: 0,
        });
        const name = stockName(currentStock, before.type);
        const returned = name !== undefined ? before.taken : 0;
        const nextStock =
          returned > 0
            ? { ...currentStock, [name]: Math.min(STOCK_MAX, currentStock[name] + returned) }
            : currentStock;
        return {
          next: current.map((entry) => (entry.id === before.id ? after : entry)),
          nextStock,
          result: { entry: after, returned },
        };
      });
    },

    /**
     * @description Change the stock of a type: add, remove or set a count.
     * A count of 0 set on a type no battery uses removes the type.
     * @param {object} fields - `{ battery_type, operation, count }`.
     * @returns {Promise<{ type: string, before: number, after: number }>} The change.
     */
    setStock(fields) {
      return serial((current, currentStock) => {
        const typed = normalizeType(fields.battery_type);
        if (!typed || typed.length > TYPE_MAX) {
          throw new RegistryError('errorType', { max: TYPE_MAX });
        }
        const operation = isEmpty(fields.operation) ? 'add' : fields.operation;
        if (!STOCK_OPERATIONS.includes(operation)) {
          throw new RegistryError('errorChoice', { value: String(operation) });
        }
        const count = readInteger(fields.count);
        if (count === undefined || count === null || count < 0 || count > STOCK_MAX) {
          throw new RegistryError('errorCount', { max: STOCK_MAX });
        }
        const existing = stockName(currentStock, typed);
        const type =
          existing ?? current.find((e) => typeKey(e.type) === typeKey(typed))?.type ?? typed;
        if (existing === undefined && Object.keys(currentStock).length >= MAX_TYPES) {
          throw new RegistryError('errorTypes', { max: MAX_TYPES });
        }
        const before = currentStock[existing] ?? 0;
        let after = count;
        if (operation === 'add') after = Math.min(STOCK_MAX, before + count);
        if (operation === 'remove') after = Math.max(0, before - count);
        const nextStock = { ...currentStock };
        delete nextStock[existing];
        const used = current.some((entry) => typeKey(entry.type) === typeKey(type));
        if (after > 0 || used) nextStock[type] = after;
        return { nextStock, result: { type, before, after } };
      });
    },
  };
  return registry;
}

export {
  MAX_BATTERIES,
  NAME_MAX,
  TYPE_MAX,
  QUANTITY,
  STOCK_MAX,
  HISTORY_MAX,
  STOCK_OPERATIONS,
  RegistryError,
  readDay,
  validateEntry,
  resolveBattery,
  entryFromFields,
  editedEntry,
  parseRegistry,
  parseStock,
  stockName,
  createRegistry,
};
