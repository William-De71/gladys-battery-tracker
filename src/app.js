// -----------------------------------------------------------------------------
// The Battery Tracker integration: every handler, registered on a Gladys
// client.
//
// Keeps track of the batteries of the house, in the spirit of the Home
// Assistant integration Battery Notes:
//   - the batteries are declared with the configuration buttons (registry.js),
//     stored in the Gladys configuration, with the help of a device library
//     (library.js) for the type and count of a model;
//   - one device per battery (device.js): level, days remaining, days since
//     the replacement, a "Replaced" button, the day of the last replacement;
//   - the level a scene reads on the real sensor can be reported (scene
//     action report_level): an external integration cannot read the devices
//     of other integrations, the scene does it for it;
//   - spare batteries in stock, taken at each replacement, and a shopping
//     list (batteries.js);
//   - scene triggers and actions (events.js), dashboard widgets (widgets.js).
//
// Transport: local. The integration calls no network service at all.
//
// index.js only creates the SDK client; the tests drive this module with the
// fake Gladys of the SDK (test/app.test.js).
// -----------------------------------------------------------------------------

import { logger as sdkLogger } from '@gladysassistant/integration-sdk';
import {
  normalizeConfig,
  readLanguage,
  guessLanguage,
  INTERNAL_KEYS,
  AUTO_LANGUAGE,
} from './config.js';
import { createRegistry, RegistryError, readDay, stockName } from './registry.js';
import { createState, DEFAULT_PATH } from './state.js';
import { resolveTimezone, localDay, wallClock, secondsUntilMidnight } from './time.js';
import { statusOf, shoppingList, byUrgency, isReplacementRise, parseLevel } from './batteries.js';
import { lookupModel } from './library.js';
import { buildDevice, buildStates, idsOf, idFromExternalId, featureKeyOf } from './device.js';
import {
  SCENE_TRIGGERS,
  SCENE_ACTIONS,
  ORIGINS,
  REPORT_CONTENTS,
  dueData,
  replacedData,
  shortData,
  statusLine,
  reportOutputs,
} from './events.js';
import {
  WIDGETS,
  WIDGET_ACTIONS,
  ttlUntil,
  buildBatteriesWidget,
  buildBatteryWidget,
  buildShoppingWidget,
} from './widgets.js';
import { t, all, formatDay, isLanguage } from './i18n.js';

const ACTIONS = {
  ADD: 'add_battery',
  EDIT: 'edit_battery',
  REMOVE: 'remove_battery',
  MARK: 'mark_replaced',
  UNDO: 'undo_replacement',
  LIST: 'list_batteries',
  STOCK: 'set_stock',
  LOOKUP: 'lookup_model',
};
// The clock is read this often: a day change and the event hour are noticed
// within this delay.
const TICK_MS = 30000;
// Scene events are spaced, far under the 300 events per minute.
const EVENT_SPACING_MS = 250;
const TOAST_MAX = 200;

/**
 * @description Register every handler of the integration on a Gladys client.
 * @param {object} gladys - A GladysIntegration (or the fake Gladys of the SDK).
 * @param {object} [options] - Options.
 * @param {Function} [options.now] - `() => Date` (tests).
 * @param {string} [options.timezone] - IANA timezone (default: TZ).
 * @param {string|null} [options.statePath] - File of the state (null: memory).
 * @param {Function} [options.sleep] - `(ms) => Promise` (tests).
 * @param {Function} [options.newId] - Identifier of a new battery (tests).
 * @param {number} [options.tickMs] - Clock period, 0 for none (tests).
 * @param {object} [options.logger] - Logger.
 * @returns {{ tick: Function, registry: object, state: object, stop: Function }} Handles for the tests.
 * @example
 * createApp(new GladysIntegration());
 */
function createApp(
  gladys,
  {
    now = () => new Date(),
    timezone = resolveTimezone(),
    statePath = DEFAULT_PATH,
    sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
    newId,
    tickMs = TICK_MS,
    logger = sdkLogger,
  } = {},
) {
  let config = normalizeConfig();
  // Language of the last widget request: the language of the texts Gladys
  // does not ask for in a language, when the `language` setting is `auto`.
  let language = guessLanguage(timezone);
  let lastDay = null;
  let timer = null;
  let running = Promise.resolve();
  let lastStatus = null;

  const registry = createRegistry(gladys, { logger, ...(newId ? { newId } : {}) });
  const state = createState({ path: statePath, logger });

  const today = () => localDay(now(), timezone);
  const textLanguage = () => (config.language === AUTO_LANGUAGE ? language : config.language);
  const ttl = () => ttlUntil(secondsUntilMidnight(now(), timezone));
  const deviceId = (id) => idsOf(gladys, id).device;
  const statusOfEntry = (entry, day = today()) =>
    statusOf(entry, day, config, state.level(entry.id));
  const statuses = () => {
    const day = today();
    return registry.list().map((entry) => statusOfEntry(entry, day));
  };
  const shopping = (list = statuses()) => shoppingList(list, registry.stock(), config.horizonDays);

  /**
   * @description Remember the language of a widget request, and store it
   * when it changed.
   * @param {string} next - The language.
   */
  function rememberLanguage(next) {
    if (!isLanguage(next) || next === language) {
      return;
    }
    language = next;
    gladys
      .setConfig({ [INTERNAL_KEYS.language]: next })
      .catch((err) => logger.warn(`Unable to store the language: ${err.message}`));
    if (config.language === AUTO_LANGUAGE) {
      publishDiscovery();
      publishStates();
    }
  }

  /** @description Offer every battery on the Discovery screen. */
  async function publishDiscovery() {
    if (!gladys.connected) return;
    try {
      await gladys.publishDiscoveredDevices(
        registry.list().map((entry) => buildDevice(gladys, entry, textLanguage())),
      );
    } catch (err) {
      logger.error('Unable to publish the discovered batteries', err);
    }
  }

  /**
   * @description Publish the states of the created devices (only the changed
   * values).
   * @param {object[]} [devices] - The devices (default: every created one).
   */
  async function publishStates(devices = gladys.devices ?? []) {
    if (!gladys.connected) return;
    const day = today();
    const states = devices.flatMap((device) => {
      const entry = registry.byId(idFromExternalId(device.external_id));
      return entry ? buildStates(gladys, statusOfEntry(entry, day), textLanguage()) : [];
    });
    if (states.length === 0) return;
    try {
      await gladys.publishChangedStates(states);
    } catch (err) {
      logger.error('Unable to publish the states', err);
    }
  }

  /** @description Ask Gladys to fetch the widgets again. */
  function refreshWidgets() {
    if (!gladys.connected) return;
    Object.values(WIDGETS).forEach((key) => {
      try {
        gladys.requestWidgetRefresh(key);
      } catch (err) {
        logger.warn(`Unable to refresh the widget ${key}: ${err.message}`);
      }
    });
  }

  /** @description Show the number of batteries in the Configuration screen. */
  async function reportStatus() {
    const list = statuses();
    const due = list.filter((status) => status.due).length;
    const message =
      list.length === 0 ? all('statusEmpty') : all('statusOk', { count: list.length, due });
    const signature = JSON.stringify(message);
    if (!gladys.connected || signature === lastStatus) return;
    lastStatus = signature;
    try {
      await gladys.setConnectionStatus(true, message);
    } catch (err) {
      lastStatus = null;
      logger.error('Unable to report the status', err);
    }
  }

  /**
   * @description Fire a scene event; a refusal is logged and reported.
   * @param {string} key - The trigger.
   * @param {object} data - Its data.
   * @returns {Promise<boolean>} True when Gladys accepted it.
   */
  async function fire(key, data) {
    try {
      await gladys.publishSceneEvent(key, data);
      return true;
    } catch (err) {
      logger.warn(`Scene event ${key} refused: ${err.message}`);
      return false;
    }
  }

  /**
   * @description Fire the transitions not fired yet: batteries becoming due,
   * types becoming short. The flags are armed again at once when the
   * condition ends; new events wait for the event hour. A refused event
   * stops the round: it is fired again at the next tick.
   */
  async function evaluate() {
    const list = statuses();
    const rows = shopping(list);
    list.filter((status) => !status.due).forEach((status) => state.setDue(status.entry.id, false));
    const shortKeys = new Set(rows.filter((row) => row.toBuy > 0).map((row) => row.key));
    rows
      .filter((row) => !shortKeys.has(row.key) && state.isShort(row.key))
      .forEach((row) => state.setShort(row.key, false));
    if (!gladys.connected || wallClock(now(), timezone).hour < config.eventHour) return;
    const lang = textLanguage();
    const pending = [
      ...byUrgency(list)
        .filter((status) => status.due && !state.isDue(status.entry.id))
        .map((status) => ({
          key: SCENE_TRIGGERS.DUE,
          data: dueData(deviceId(status.entry.id), status, lang),
          done: () => state.setDue(status.entry.id, true),
        })),
      ...rows
        .filter((row) => row.toBuy > 0 && !state.isShort(row.key))
        .map((row) => ({
          key: SCENE_TRIGGERS.SHORT,
          data: shortData(row),
          done: () => state.setShort(row.key, true),
        })),
    ];
    for (const [index, event] of pending.entries()) {
      if (index > 0) await sleep(EVENT_SPACING_MS);
      if (!(await fire(event.key, event.data))) return;
      event.done();
    }
  }

  /**
   * @description One look at the clock: a new day refreshes the devices and
   * the widgets, then the transitions are fired. Never two at once.
   * @returns {Promise<void>}
   */
  function tick() {
    running = running.then(async () => {
      const day = today();
      if (day !== lastDay) {
        lastDay = day;
        await publishStates();
        refreshWidgets();
        await reportStatus();
      }
      await evaluate();
    });
    running = running.catch((err) => logger.error('Clock round failed', err));
    return running;
  }

  /**
   * @description Everything that follows a change of the batteries.
   * @param {object} [options] - Options.
   * @param {boolean} [options.discovery] - Publish the discovered devices again.
   */
  async function changed({ discovery = true } = {}) {
    if (discovery) await publishDiscovery();
    await publishStates();
    refreshWidgets();
    await reportStatus();
    await tick();
  }

  /**
   * @description Record a replacement and what follows it.
   * @param {string} id - The battery.
   * @param {string} day - YYYY-MM-DD.
   * @param {string|null} origin - ORIGINS value, null for a scene action (no event).
   * @param {{ level: number, day: string }|null} [report] - The report that revealed it.
   * @returns {Promise<object>} registry.replace() result.
   */
  async function recordReplacement(id, day, origin, report = null) {
    const result = await registry.replace(id, day, { decrement: config.decrementStock });
    // An old low level would make the new battery due at once.
    state.setLevel(id, report);
    state.setDue(id, false);
    logger.info(`Battery ${id} replaced on ${day} (${origin ?? 'scene'})`);
    if (origin !== null) {
      await fire(SCENE_TRIGGERS.REPLACED, replacedData(deviceId(id), result, origin));
    }
    await changed({ discovery: false });
    return result;
  }

  /**
   * @description A one-line description of a battery.
   * @param {object} entry - The battery.
   * @param {string} lang - The language.
   * @returns {string} The line.
   */
  function describe(entry, lang) {
    const status = statusOfEntry(entry);
    return t('listLine', lang, {
      n: registry.list().findIndex((other) => other.id === entry.id) + 1,
      line: statusLine(status, lang),
      replaced: formatDay(entry.replacedOn, lang, 'short'),
    });
  }

  /**
   * @description The text of a replacement, with the stock left.
   * @param {object} result - registry.replace() result.
   * @param {string} lang - The language.
   * @returns {string} The text.
   */
  function replacedText(result, lang) {
    let text = t('replaced', lang, {
      name: result.entry.name,
      day: formatDay(result.entry.replacedOn, lang, 'short'),
    });
    if (result.stockLeft !== null) {
      text += ` ${t(result.short ? 'stockShort' : 'stockLeft', lang, { n: result.stockLeft, type: result.entry.type })}`;
    }
    return text;
  }

  /**
   * @description Run a change of the registry, turning its errors into a
   * message in the language of the integration.
   * @param {Function} change - `() => Promise`.
   * @returns {Promise<*>} The result of the change.
   */
  async function guarded(change) {
    try {
      return await change();
    } catch (err) {
      if (err instanceof RegistryError) {
        throw new Error(t(err.key, textLanguage(), err.params), { cause: err });
      }
      throw new Error(t('errorSave', textLanguage(), { message: err.message }), { cause: err });
    }
  }

  /**
   * @description The battery a scene action names (a device of the
   * integration).
   * @param {string} externalId - The chosen device.
   * @returns {object} The battery.
   * @throws {Error} When it is not a battery of the integration.
   */
  function batteryOfDevice(externalId) {
    const entry = registry.byId(idFromExternalId(externalId));
    if (!entry) {
      throw new Error(t('errorDevice', textLanguage()));
    }
    return entry;
  }

  // --- Configuration buttons ------------------------------------------------
  gladys.onAction(ACTIONS.ADD, async (fields = {}) => {
    const entry = await guarded(() => registry.add(fields, today()));
    logger.info(`Battery ${entry.id} added`);
    await changed();
    return all((lang) => t('added', lang, { line: describe(entry, lang) }));
  });

  gladys.onAction(ACTIONS.EDIT, async (fields = {}) => {
    const { before, after } = await guarded(() => registry.edit(fields, today()));
    logger.info(`Battery ${after.id} edited`);
    if (before.replacedOn !== after.replacedOn) state.setLevel(after.id, null);
    await changed();
    return all((lang) => t('edited', lang, { line: describe(after, lang) }));
  });

  gladys.onAction(ACTIONS.REMOVE, async (fields = {}) => {
    const entry = await guarded(() => registry.remove(fields.battery));
    logger.info(`Battery ${entry.id} removed`);
    state.keepOnly(registry.list().map((other) => other.id));
    await changed();
    return all('removed', { name: entry.name });
  });

  gladys.onAction(ACTIONS.MARK, async (fields = {}) => {
    const result = await guarded(async () => {
      const entry = registry.find(fields.battery);
      return recordReplacement(
        entry.id,
        readDay(fields.replaced_on, today()),
        ORIGINS.CONFIGURATION,
      );
    });
    return all((lang) => replacedText(result, lang));
  });

  gladys.onAction(ACTIONS.UNDO, async (fields = {}) => {
    const { entry, returned } = await guarded(() => registry.undo(fields.battery));
    logger.info(`Last replacement of battery ${entry.id} undone`);
    state.setLevel(entry.id, null);
    await changed({ discovery: false });
    return all((lang) =>
      [
        t('undone', lang, { name: entry.name, day: formatDay(entry.replacedOn, lang, 'short') }),
        returned > 0 ? t('stockReturned', lang, { n: returned, type: entry.type }) : '',
      ]
        .filter(Boolean)
        .join(' '),
    );
  });

  gladys.onAction(ACTIONS.LIST, async () => {
    const entries = registry.list();
    const stock = Object.entries(registry.stock());
    return all((lang) => {
      const lines = [];
      if (entries.length === 0) {
        lines.push(t('listEmpty', lang));
      } else {
        lines.push(
          t('listHeader', lang, { count: entries.length, today: formatDay(today(), lang) }),
        );
        entries.forEach((entry) => lines.push(describe(entry, lang)));
      }
      lines.push('');
      lines.push(
        stock.length === 0
          ? t('listNoStock', lang)
          : t('listStock', lang, { stock: stock.map(([type, n]) => `${type} × ${n}`).join(', ') }),
      );
      return lines.join('\n');
    });
  });

  gladys.onAction(ACTIONS.STOCK, async (fields = {}) => {
    const { type, before, after } = await guarded(() => registry.setStock(fields));
    logger.info(`Stock of ${type}: ${before} -> ${after}`);
    await changed({ discovery: false });
    return all('stockChanged', { type, before, after });
  });

  gladys.onAction(ACTIONS.LOOKUP, async (fields = {}) => {
    const { matches, total } = lookupModel(fields.manufacturer, fields.model);
    return all((lang) => {
      if (total === 0) return t('lookupNone', lang);
      const lines = matches.map((match) =>
        t('lookupLine', lang, {
          model: match.label,
          battery: `${match.quantity} × ${match.type}`,
        }),
      );
      return [t('lookupHeader', lang, { count: total, shown: matches.length }), ...lines].join(
        '\n',
      );
    });
  });

  // --- Device button --------------------------------------------------------
  gladys.onSetValue(async (device, deviceFeature) => {
    if (featureKeyOf(deviceFeature?.external_id) !== 'replaced') {
      throw new Error(`Feature ${deviceFeature?.external_id} cannot be set`);
    }
    const entry = batteryOfDevice(device?.external_id);
    await recordReplacement(entry.id, today(), ORIGINS.DEVICE);
  });

  // --- Scene actions --------------------------------------------------------
  gladys.onSceneAction(SCENE_ACTIONS.REPORT, async (fields = {}) => {
    const entry = batteryOfDevice(fields.battery);
    const level = parseLevel(fields.level);
    if (level === null) {
      throw new Error(t('errorLevel', textLanguage(), { value: String(fields.level ?? '') }));
    }
    const day = today();
    const report = { level, day };
    const previous = state.level(entry.id);
    let replaced = false;
    if (config.autoReplace && isReplacementRise(previous, level)) {
      await recordReplacement(entry.id, day, null, report);
      replaced = true;
    } else {
      state.setLevel(entry.id, report);
      if (!previous || previous.level !== level) {
        await changed({ discovery: false });
      }
    }
    const status = statusOfEntry(registry.byId(entry.id));
    return { level, replaced, days_remaining: status.daysRemaining };
  });

  gladys.onSceneAction(SCENE_ACTIONS.MARK, async (fields = {}) => {
    const entry = batteryOfDevice(fields.battery);
    const result = await guarded(() => recordReplacement(entry.id, today(), null));
    return { days_used: result.daysUsed, stock_left: result.stockLeft ?? -1 };
  });

  gladys.onSceneAction(SCENE_ACTIONS.REPORT_TEXT, async (fields = {}) => {
    const content = REPORT_CONTENTS.includes(fields.content) ? fields.content : 'due';
    const list = statuses();
    return reportOutputs(list, shopping(list), content, textLanguage());
  });

  // --- Widgets --------------------------------------------------------------
  const widgetLanguage = (lang) => (isLanguage(lang) ? lang : textLanguage());

  gladys.onWidgetGet(WIDGETS.BATTERIES, async ({ settings = {}, language: lang } = {}) => {
    rememberLanguage(lang);
    const list = statuses();
    return buildBatteriesWidget({
      statuses: list,
      shopping: shopping(list),
      settings,
      language: widgetLanguage(lang),
      ttl: ttl(),
    });
  });

  gladys.onWidgetGet(WIDGETS.BATTERY, async ({ settings = {}, language: lang } = {}) => {
    rememberLanguage(lang);
    const entry = registry.byId(idFromExternalId(settings.battery)) ?? null;
    const name = entry ? stockName(registry.stock(), entry.type) : undefined;
    return buildBatteryWidget({
      status: entry ? statusOfEntry(entry) : null,
      chosen: Boolean(settings.battery),
      stock: name === undefined ? null : registry.stock()[name],
      language: widgetLanguage(lang),
      ttl: ttl(),
    });
  });

  gladys.onWidgetGet(WIDGETS.SHOPPING, async ({ language: lang } = {}) => {
    rememberLanguage(lang);
    const list = statuses();
    return buildShoppingWidget({
      shopping: shopping(list),
      statuses: list,
      horizonDays: config.horizonDays,
      language: widgetLanguage(lang),
      ttl: ttl(),
    });
  });

  /**
   * @description A toast in every language, from a text builder.
   * @param {Function} build - `(lang) => string`.
   * @returns {object} The toast.
   */
  const toast = (build) => all((lang) => build(lang).slice(0, TOAST_MAX));

  /**
   * @description Run a widget action, turning a refusal into a toast: the
   * user reads why, in their language.
   * @param {Function} run - `() => Promise<Function>` resolving a text builder.
   * @returns {Promise<object>} The toast.
   */
  async function widgetGuard(run) {
    try {
      return toast(await run());
    } catch (err) {
      if (err instanceof RegistryError) {
        return toast((lang) => t(err.key, lang, err.params));
      }
      logger.error('Widget action failed', err);
      return toast((lang) => t('errorSave', lang, { message: err.message }));
    }
  }

  /**
   * @description The buttons of the widgets.
   * @param {string} actionKey - The action of the button.
   * @param {object} params - Its params.
   * @param {object} [context] - `{ values }`, the typed form.
   * @returns {Promise<object>} The toast.
   */
  async function widgetAction(actionKey, params = {}, { values } = {}) {
    if (actionKey === WIDGET_ACTIONS.REPLACED) {
      const id = params.battery ?? values?.battery;
      if (!id) return toast((lang) => t('toastNoForm', lang));
      return widgetGuard(async () => {
        const entry = registry.byId(id);
        if (!entry) throw new RegistryError('errorNotFound', { query: id });
        const result = await recordReplacement(
          entry.id,
          readDay(values?.day, today()),
          ORIGINS.WIDGET,
        );
        return (lang) => replacedText(result, lang);
      });
    }
    if (actionKey === WIDGET_ACTIONS.STOCK) {
      if (!values) return toast((lang) => t('toastNoForm', lang));
      return widgetGuard(async () => {
        const { type, before, after } = await registry.setStock(values);
        await changed({ discovery: false });
        return (lang) => t('stockChanged', lang, { type, before, after });
      });
    }
    if (actionKey === WIDGET_ACTIONS.BOUGHT) {
      return widgetGuard(async () => {
        const rows = shopping().filter((row) => row.toBuy > 0);
        for (const row of rows) {
          await registry.setStock({ battery_type: row.type, operation: 'add', count: row.toBuy });
        }
        await changed({ discovery: false });
        const bought = rows.map((row) => `${row.toBuy} × ${row.type}`).join(', ');
        return (lang) =>
          rows.length === 0 ? t('toastNothingToBuy', lang) : t('toastBought', lang, { bought });
      });
    }
    throw new Error(`Unknown widget action ${actionKey}`);
  }
  Object.values(WIDGETS).forEach((key) => gladys.onWidgetAction(key, widgetAction));

  // --- Devices and configuration --------------------------------------------
  gladys.onScanRequest(async () => {
    await publishDiscovery();
  });

  gladys.onDeviceCreated(async (device) => {
    await publishStates([device]);
    refreshWidgets();
  });

  gladys.onDeviceUpdated(async (device) => {
    await publishStates([device]);
  });

  gladys.onConfigUpdated(async (raw) => {
    const previous = textLanguage();
    config = normalizeConfig(raw);
    if (textLanguage() !== previous) {
      await publishDiscovery();
    }
    await publishStates();
    refreshWidgets();
    lastStatus = null;
    await reportStatus();
    await tick();
  });

  gladys.on('connected', async () => {
    const raw = gladys.config ?? {};
    config = normalizeConfig(raw);
    language = readLanguage(raw, language);
    registry.load(raw);
    state.keepOnly(registry.list().map((entry) => entry.id));
    lastDay = null;
    lastStatus = null;
    logger.info(`${registry.list().length} battery record(s), timezone ${timezone}`);
    await publishDiscovery();
    await reportStatus();
    await tick();
    if (tickMs > 0 && timer === null) {
      timer = setInterval(() => tick(), tickMs);
      timer.unref?.();
    }
  });

  const stop = () => {
    if (timer !== null) {
      clearInterval(timer);
      timer = null;
    }
  };

  gladys.handleShutdown(async (signal) => {
    logger.info(`Received ${signal} -> graceful shutdown`);
    stop();
    await running;
  });

  return { tick, registry, state, stop };
}

export { ACTIONS, TICK_MS, createApp };
