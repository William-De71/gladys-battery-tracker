// -----------------------------------------------------------------------------
// Scene triggers and scene actions of the integration (keys declared in the
// manifest, never renamed).
//
// Triggers, one event per transition, flat scalar data, declared keys only:
//   - replacement_due   a battery becomes due (its end is within the reminder
//                       days, or a reported level is low); fired again only
//                       after a replacement. Waits for the event hour.
//   - battery_replaced  a replacement recorded from the device button, a
//                       widget or a configuration button. Never after a scene
//                       action (report_level, mark_replaced): a scene bound
//                       to it would loop through the integration.
//   - stock_short       a battery type has something to buy (needed within
//                       the horizon > spare ones); fired again once nothing
//                       is to buy. Waits for the event hour.
// Actions:
//   - report_level   the level a scene read on the real sensor ({{…}}): kept
//                    as the level of the battery, a rise of 25 points or
//                    more counts as a replacement (auto_replace).
//   - mark_replaced  record a replacement today.
//   - get_report     a text of the batteries to replace and to buy, for a
//                    notification.
// -----------------------------------------------------------------------------

import { t, formatDay, relativeDays } from './i18n.js';
import { byUrgency } from './batteries.js';
import { modelOf } from './device.js';

const SCENE_TRIGGERS = {
  DUE: 'replacement_due',
  REPLACED: 'battery_replaced',
  SHORT: 'stock_short',
};
const SCENE_ACTIONS = {
  REPORT: 'report_level',
  MARK: 'mark_replaced',
  REPORT_TEXT: 'get_report',
};
const ORIGINS = { DEVICE: 'device', WIDGET: 'widget', CONFIGURATION: 'configuration' };
const REPORT_CONTENTS = ['due', 'all', 'shopping'];
const TEXT_MAX = 10000;

/**
 * @description Data of a replacement_due event.
 * @param {string} deviceExternalId - The device of the battery.
 * @param {object} status - statusOf().
 * @param {string} language - Language of the texts.
 * @returns {object} The flat data.
 */
const dueData = (deviceExternalId, status, language) => ({
  battery: deviceExternalId,
  reason: status.reason,
  name: status.entry.name,
  battery_type: status.entry.type,
  quantity: status.entry.quantity,
  days_remaining: status.daysRemaining,
  level: status.level,
  level_source: status.levelSource,
  end_date: formatDay(status.endDay, language),
});

/**
 * @description Data of a battery_replaced event.
 * @param {string} deviceExternalId - The device of the battery.
 * @param {object} result - registry.replace() result.
 * @param {string} origin - ORIGINS value.
 * @returns {object} The flat data.
 */
const replacedData = (deviceExternalId, result, origin) => ({
  battery: deviceExternalId,
  origin,
  name: result.entry.name,
  battery_type: result.entry.type,
  quantity: result.entry.quantity,
  days_used: result.daysUsed,
  stock_left: result.stockLeft,
});

/**
 * @description Data of a stock_short event.
 * @param {object} row - A shoppingList() row.
 * @returns {object} The flat data.
 */
const shortData = (row) => ({
  battery_type: row.type,
  stock: row.stock,
  needed: row.needed,
  to_buy: row.toBuy,
});

/**
 * @description One line of a battery in a text.
 * @param {object} status - statusOf().
 * @param {string} language - Language.
 * @returns {string} The line.
 */
function statusLine(status, language) {
  const when = status.levelLow
    ? t('reportLevelLow', language, { level: status.level })
    : relativeDays(status.daysRemaining, language);
  return t('reportLine', language, {
    name: status.entry.name,
    model: modelOf(status.entry),
    when,
  });
}

/**
 * @description The outputs of get_report.
 * @param {object[]} statuses - statusOf() of every battery.
 * @param {object[]} shopping - shoppingList().
 * @param {string} content - due | all | shopping.
 * @param {string} language - Language.
 * @returns {{ text: string, due_count: number, to_buy_count: number }} The outputs.
 */
function reportOutputs(statuses, shopping, content, language) {
  const due = byUrgency(statuses.filter((status) => status.due));
  const toBuy = shopping.filter((row) => row.toBuy > 0);
  const toBuyCount = toBuy.reduce((sum, row) => sum + row.toBuy, 0);
  const shoppingText =
    toBuy.length === 0
      ? t('reportNothingToBuy', language)
      : `${t('reportToBuy', language)}\n${toBuy
          .map((row) => t('reportBuyLine', language, { count: row.toBuy, type: row.type }))
          .join('\n')}`;
  const listed = content === 'all' ? byUrgency(statuses) : due;
  let text;
  if (content === 'shopping') {
    text = shoppingText;
  } else if (statuses.length === 0) {
    text = t('reportEmpty', language);
  } else {
    const head =
      content === 'all'
        ? t('reportAll', language, { count: statuses.length })
        : due.length === 0
          ? t('reportNothingDue', language)
          : t('reportDue', language, { count: due.length });
    text = [head, ...listed.map((status) => statusLine(status, language))].join('\n');
    if (toBuy.length > 0) text += `\n\n${shoppingText}`;
  }
  return { text: text.slice(0, TEXT_MAX), due_count: due.length, to_buy_count: toBuyCount };
}

export {
  SCENE_TRIGGERS,
  SCENE_ACTIONS,
  ORIGINS,
  REPORT_CONTENTS,
  dueData,
  replacedData,
  shortData,
  statusLine,
  reportOutputs,
};
