// -----------------------------------------------------------------------------
// Dashboard widgets (keys declared in the manifest, never renamed). Built from
// what the integration knows, never bound to device features: they work
// before the devices are added on the Discovery screen.
//
//   - batteries  every battery from the most urgent: counters (to replace,
//                soon, to buy), one row per battery, a "Battery replaced"
//                button with a form (which one, which day).
//   - battery    one battery: level gauge, days left and since, type, dates,
//                life (set, learned or default), stock, "Replaced" button.
//   - shopping   the batteries to buy by type, the stock, an "Update stock"
//                button with a form and a "Bought" button that puts the list
//                in stock.
//
// Every text in the language of the request; the content changes at
// midnight, and every change asks Gladys to fetch the widgets again.
// -----------------------------------------------------------------------------

import { WIDGET_COLORS as COLORS } from '@gladysassistant/integration-sdk';
import { t, all, formatDay, formatShortDay, relativeDays } from './i18n.js';
import { byUrgency, URGENCY } from './batteries.js';
import { modelOf } from './device.js';
import { STOCK_OPERATIONS } from './registry.js';

const WIDGETS = { BATTERIES: 'batteries', BATTERY: 'battery', SHOPPING: 'shopping' };
const WIDGET_ACTIONS = {
  REPLACED: 'replaced',
  STOCK: 'stock',
  BOUGHT: 'bought',
};
const MAX_ROWS = 10;
const MAX_OPTIONS = 100;
const OPTION_MAX = 40;
// Types offered by the stock form when the house knows none yet.
const COMMON_TYPES = ['AA', 'AAA', 'CR2032', 'CR2450', 'CR123A', 'CR2', '9V'];

const URGENCY_ICONS = {
  [URGENCY.REPLACE]: 'alert-triangle',
  [URGENCY.SOON]: 'clock',
  [URGENCY.OK]: 'battery',
};
const URGENCY_COLORS = {
  [URGENCY.REPLACE]: COLORS.DANGER,
  [URGENCY.SOON]: COLORS.WARNING,
  [URGENCY.OK]: COLORS.SUCCESS,
};

/**
 * @description The TTL of a content: until midnight, an hour at most.
 * @param {number} secondsToMidnight - Seconds until the next local midnight.
 * @returns {number} Seconds, 60 to 3600.
 */
const ttlUntil = (secondsToMidnight) => Math.max(60, Math.min(3600, secondsToMidnight));

/**
 * @description The value of the row of a battery: when, then the model.
 * @param {object} status - statusOf().
 * @param {string} language - Language.
 * @returns {string} At most 40 characters.
 */
function rowValue(status, language) {
  const when = status.levelLow
    ? `${status.level} %`
    : relativeDays(status.daysRemaining, language, 'short');
  return `${when} · ${modelOf(status.entry)}`.slice(0, 40);
}

/**
 * @description The color of a level.
 * @param {object} status - statusOf().
 * @returns {string} A widget color.
 */
const levelColor = (status) => URGENCY_COLORS[status.urgency];

/**
 * @description The option of a battery in a form: "Name (2 × AA)", the name
 * shortened so that it fits the 40 characters of an option.
 * @param {object} entry - The battery.
 * @returns {string} The label.
 */
function optionLabel(entry) {
  const model = ` (${modelOf(entry)})`;
  const room = OPTION_MAX - model.length;
  const name = entry.name.length > room ? `${entry.name.slice(0, room - 1)}…` : entry.name;
  return `${name}${model}`.slice(0, OPTION_MAX);
}

/**
 * @description The form of the "Battery replaced" button.
 * @param {object[]} sorted - Statuses, most urgent first.
 * @returns {object[]} The fields.
 */
const replacedFields = (sorted) => [
  {
    key: 'battery',
    type: 'select',
    required: true,
    label: all('formBattery'),
    default: sorted[0].entry.id,
    options: sorted.slice(0, MAX_OPTIONS).map((status) => ({
      value: status.entry.id,
      label: { en: optionLabel(status.entry) },
    })),
  },
  {
    key: 'day',
    type: 'string',
    required: false,
    label: all('formDay'),
    placeholder: all('formDayPlaceholder'),
  },
];

/**
 * @description The "batteries" widget.
 * @param {object} input - Input.
 * @param {object[]} input.statuses - statusOf() of every battery.
 * @param {object[]} input.shopping - shoppingList().
 * @param {object} input.settings - Widget settings (`show`, `show_button`).
 * @param {string} input.language - Language.
 * @param {number} input.ttl - TTL in seconds.
 * @returns {object} The content.
 */
function buildBatteriesWidget({ statuses, shopping, settings = {}, language, ttl }) {
  if (statuses.length === 0) {
    return {
      ttl_seconds: ttl,
      components: [{ type: 'text', variant: 'body', text: t('widgetEmpty', language) }],
    };
  }
  const sorted = byUrgency(statuses);
  const replace = statuses.filter((status) => status.urgency === URGENCY.REPLACE).length;
  const soon = statuses.filter((status) => status.urgency === URGENCY.SOON).length;
  const toBuy = shopping.reduce((sum, row) => sum + row.toBuy, 0);
  const shown = settings.show === 'due' ? sorted.filter((status) => status.due) : sorted;
  const components = [
    {
      type: 'value',
      value: replace,
      label: t('tileReplace', language),
      icon: 'alert-triangle',
      color: replace > 0 ? COLORS.DANGER : COLORS.SUCCESS,
    },
    {
      type: 'value',
      value: soon,
      label: t('tileSoon', language),
      icon: 'clock',
      color: soon > 0 ? COLORS.WARNING : COLORS.NEUTRAL,
    },
    {
      type: 'value',
      value: toBuy,
      label: t('tileToBuy', language),
      icon: 'shopping-cart',
      color: toBuy > 0 ? COLORS.INFO : COLORS.NEUTRAL,
    },
  ];
  if (shown.length === 0) {
    components.push({ type: 'text', variant: 'caption', text: t('widgetNothingDue', language) });
  } else {
    components.push({
      type: 'status',
      items: shown.slice(0, MAX_ROWS).map((status) => ({
        label: status.entry.name.slice(0, 40),
        value: rowValue(status, language),
        icon: URGENCY_ICONS[status.urgency],
        color: URGENCY_COLORS[status.urgency],
      })),
    });
    if (shown.length > MAX_ROWS) {
      components.push({
        type: 'text',
        variant: 'caption',
        text: t('widgetMore', language, { count: shown.length - MAX_ROWS }),
      });
    }
  }
  if (settings.show_button !== false) {
    components.push({
      type: 'button',
      label: t('buttonReplaced', language),
      icon: 'refresh-cw',
      style: 'primary',
      action: { key: WIDGET_ACTIONS.REPLACED, fields: replacedFields(sorted) },
    });
  }
  return { ttl_seconds: ttl, components };
}

/**
 * @description The life of a battery, written.
 * @param {object} life - lifeOf().
 * @param {string} language - Language.
 * @returns {string} The text.
 */
function lifeText(life, language) {
  const months = Math.round(life.days / (365.25 / 12));
  const value =
    life.days < 60
      ? t('daysCount', language, { n: life.days })
      : t('monthsCount', language, { n: months });
  return `${value} (${t(`life_${life.source}`, language)})`;
}

/**
 * @description The "battery" widget, for one battery.
 * @param {object} input - Input.
 * @param {object|null} input.status - statusOf() of the chosen battery.
 * @param {boolean} input.chosen - Whether a battery is chosen in the settings.
 * @param {number|null} input.stock - Spare batteries of its type (null: not tracked).
 * @param {string} input.language - Language.
 * @param {number} input.ttl - TTL in seconds.
 * @returns {object} The content.
 */
function buildBatteryWidget({ status, chosen, stock, language, ttl }) {
  if (!status) {
    return {
      ttl_seconds: ttl,
      components: [
        {
          type: 'text',
          variant: 'body',
          text: t(chosen ? 'widgetBatteryGone' : 'widgetChooseBattery', language),
        },
      ],
    };
  }
  const { entry } = status;
  const items = [
    { label: t('rowType', language), value: modelOf(entry), icon: 'battery' },
    {
      label: t('rowReplaced', language),
      value: formatDay(entry.replacedOn, language, 'short'),
      icon: 'calendar',
    },
    {
      label: t('rowEnd', language),
      value: formatDay(status.endDay, language, 'short'),
      icon: 'flag',
      color: URGENCY_COLORS[status.urgency],
    },
    { label: t('rowLife', language), value: lifeText(status.life, language), icon: 'activity' },
    {
      label: t('rowLevelSource', language),
      value:
        status.levelSource === 'reported'
          ? t('levelReported', language, { day: formatShortDay(status.reportDay, language) })
          : t('levelEstimated', language),
      icon: status.levelSource === 'reported' ? 'radio' : 'trending-down',
    },
  ];
  if (stock !== null) {
    items.push({
      label: t('rowStock', language),
      value: t('stockCount', language, { n: stock }),
      icon: 'package',
      color: stock >= entry.quantity ? COLORS.SUCCESS : COLORS.WARNING,
    });
  }
  const components = [
    { type: 'text', variant: 'heading', text: entry.name.slice(0, 40) },
    {
      type: 'gauge',
      value: status.level,
      min: 0,
      max: 100,
      unit: '%',
      label: t(status.levelSource === 'reported' ? 'tileLevel' : 'tileLevelEstimated', language),
      color: levelColor(status),
    },
    {
      type: 'value',
      value: status.daysRemaining,
      unit: t('unitDays', language),
      label: t(status.daysRemaining < 0 ? 'tileLate' : 'tileDaysLeft', language),
      icon: 'clock',
      color: URGENCY_COLORS[status.urgency],
    },
    {
      type: 'value',
      value: status.daysSince,
      unit: t('unitDays', language),
      label: t('tileDaysSince', language),
      icon: 'rotate-ccw',
      color: COLORS.NEUTRAL,
    },
    { type: 'status', items },
    {
      type: 'button',
      label: t('buttonReplacedToday', language),
      icon: 'refresh-cw',
      style: status.due ? 'primary' : 'secondary',
      action: { key: WIDGET_ACTIONS.REPLACED, params: { battery: entry.id }, confirm: true },
    },
  ];
  return { ttl_seconds: ttl, components };
}

/**
 * @description The battery types offered by the stock form.
 * @param {object[]} shopping - shoppingList().
 * @param {object[]} statuses - statusOf() of every battery.
 * @returns {string[]} The types.
 */
function knownTypes(shopping, statuses) {
  const types = [];
  const seen = new Set();
  [
    ...shopping.map((row) => row.type),
    ...statuses.map((s) => s.entry.type),
    ...COMMON_TYPES,
  ].forEach((type) => {
    const key = type.toLowerCase().replace(/[\s.-]/g, '');
    if (!seen.has(key)) {
      seen.add(key);
      types.push(type);
    }
  });
  return types.slice(0, MAX_OPTIONS);
}

/**
 * @description The "shopping" widget.
 * @param {object} input - Input.
 * @param {object[]} input.shopping - shoppingList().
 * @param {object[]} input.statuses - statusOf() of every battery.
 * @param {number} input.horizonDays - Horizon of the list.
 * @param {string} input.language - Language.
 * @param {number} input.ttl - TTL in seconds.
 * @returns {object} The content.
 */
function buildShoppingWidget({ shopping, statuses, horizonDays, language, ttl }) {
  const toBuy = shopping.reduce((sum, row) => sum + row.toBuy, 0);
  const inStock = shopping.reduce((sum, row) => sum + row.stock, 0);
  const types = knownTypes(shopping, statuses);
  const components = [
    {
      type: 'value',
      value: toBuy,
      label: t('tileToBuy', language),
      icon: 'shopping-cart',
      color: toBuy > 0 ? COLORS.WARNING : COLORS.SUCCESS,
    },
    {
      type: 'value',
      value: inStock,
      label: t('tileInStock', language),
      icon: 'package',
      color: COLORS.INFO,
    },
  ];
  if (shopping.length === 0) {
    components.push({
      type: 'text',
      variant: 'body',
      text: t('widgetShoppingEmpty', language, { days: horizonDays }),
    });
  } else {
    components.push({
      type: 'status',
      items: shopping.slice(0, MAX_ROWS).map((row) => ({
        label: row.type.slice(0, 40),
        value: (row.toBuy > 0
          ? t('rowToBuy', language, { buy: row.toBuy, stock: row.stock })
          : t('rowEnough', language, { stock: row.stock, needed: row.needed })
        ).slice(0, 40),
        icon: row.toBuy > 0 ? 'shopping-cart' : 'check',
        color: row.toBuy > 0 ? COLORS.WARNING : COLORS.SUCCESS,
      })),
    });
    components.push({
      type: 'text',
      variant: 'caption',
      text: t('widgetHorizon', language, { days: horizonDays }),
    });
  }
  components.push({
    type: 'button',
    label: t('buttonStock', language),
    icon: 'package',
    style: 'secondary',
    action: {
      key: WIDGET_ACTIONS.STOCK,
      fields: [
        {
          key: 'battery_type',
          type: 'select',
          required: true,
          label: all('formType'),
          default: types[0],
          options: types.map((type) => ({ value: type, label: { en: type } })),
        },
        {
          key: 'operation',
          type: 'select',
          required: true,
          label: all('formOperation'),
          default: 'add',
          options: STOCK_OPERATIONS.map((operation) => ({
            value: operation,
            label: all(`operation_${operation}`),
          })),
        },
        {
          key: 'count',
          type: 'number',
          required: true,
          min: 0,
          max: 999,
          default: 1,
          label: all('formCount'),
        },
      ],
    },
  });
  if (toBuy > 0) {
    components.push({
      type: 'button',
      label: t('buttonBought', language),
      icon: 'check',
      style: 'primary',
      action: { key: WIDGET_ACTIONS.BOUGHT, confirm: true },
    });
  }
  return { ttl_seconds: ttl, components };
}

export {
  WIDGETS,
  optionLabel,
  WIDGET_ACTIONS,
  COMMON_TYPES,
  ttlUntil,
  rowValue,
  buildBatteriesWidget,
  buildBatteryWidget,
  buildShoppingWidget,
};
