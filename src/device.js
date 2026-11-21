// -----------------------------------------------------------------------------
// One device per battery record, offered on the Discovery screen, named after
// the thing it powers ("Smoke detector — hall"), model "2 × CR2032".
//
// Features (category / type pairs of the SDK constants, with an icon and the
// unit in the Gladys front):
//   - level           battery / integer, %: the reported level, or the
//                     estimate from the age (see batteries.js). Being a
//                     battery feature, it also feeds the native low battery
//                     warning of Gladys — the point for things no sensor
//                     watches (remotes, clocks, smoke detectors).
//   - days_remaining  duration / integer, days: until the estimated end
//                     (negative once passed)
//   - days_since      duration / integer, days: since the last replacement
//   - replaced        button / push: "I just replaced it" (today)
//   - last_replaced   text / text: day of the last replacement, written in
//                     the language of the integration
//
// External ids: `battery:<id>`, the random identifier given at creation:
// never the name. The values change once a day (midnight in the timezone of
// Gladys) or when something happens, on the integration's own timer:
// `should_poll` is false.
// -----------------------------------------------------------------------------

import {
  DEVICE_FEATURE_CATEGORIES as CATEGORIES,
  DEVICE_FEATURE_TYPES as TYPES,
  DEVICE_FEATURE_UNITS as UNITS,
} from '@gladysassistant/integration-sdk';
import { t, formatDay } from './i18n.js';

const DEVICE_TYPE = 'battery';
const MAX_DAYS = 36600;

const days = (min) => ({
  category: CATEGORIES.DURATION,
  type: TYPES.DURATION.INTEGER,
  unit: UNITS.DAYS,
  min,
  max: MAX_DAYS,
  read_only: true,
  has_feedback: false,
  keep_history: true,
});

const FEATURES = [
  {
    key: 'level',
    name: 'featureLevel',
    shape: {
      category: CATEGORIES.BATTERY,
      type: TYPES.BATTERY.INTEGER,
      unit: UNITS.PERCENT,
      min: 0,
      max: 100,
      read_only: true,
      has_feedback: false,
      keep_history: true,
    },
    state: (status) => ({ state: status.level }),
  },
  {
    key: 'days_remaining',
    name: 'featureDaysRemaining',
    shape: days(-MAX_DAYS),
    state: (status) => ({ state: status.daysRemaining }),
  },
  {
    key: 'days_since',
    name: 'featureDaysSince',
    shape: days(0),
    state: (status) => ({ state: status.daysSince }),
  },
  {
    key: 'replaced',
    name: 'featureReplaced',
    shape: {
      category: CATEGORIES.BUTTON,
      type: TYPES.BUTTON.PUSH,
      min: 0,
      max: 1,
      read_only: false,
      has_feedback: false,
      keep_history: false,
    },
    state: () => null,
  },
  {
    key: 'last_replaced',
    name: 'featureLastReplaced',
    shape: {
      category: CATEGORIES.TEXT,
      type: TYPES.TEXT.TEXT,
      min: 0,
      max: 0,
      read_only: true,
      has_feedback: false,
      keep_history: false,
    },
    state: (status, language) => ({ text: formatDay(status.entry.replacedOn, language) }),
  },
];

/**
 * @description The external ids of a battery.
 * @param {object} gladys - The GladysIntegration instance.
 * @param {string} id - The identifier of the battery.
 * @returns {{ device: string, feature: Function }} The ids.
 */
const idsOf = (gladys, id) => gladys.externalIds(DEVICE_TYPE, id);

/**
 * @description The identifier of a battery from a device (or feature)
 * external id.
 * @param {string} externalId - `ext:<selector>:battery:<id>[:<feature>]`.
 * @returns {string|null} The identifier.
 */
function idFromExternalId(externalId) {
  const match = /:battery:([0-9a-f]{8})(?::[a-z_]+)?$/.exec(String(externalId ?? ''));
  return match ? match[1] : null;
}

/**
 * @description The feature key of a feature external id.
 * @param {string} externalId - `ext:<selector>:battery:<id>:<feature>`.
 * @returns {string|null} The key.
 */
function featureKeyOf(externalId) {
  const match = /:battery:[0-9a-f]{8}:([a-z_]+)$/.exec(String(externalId ?? ''));
  return match ? match[1] : null;
}

/**
 * @description "2 × CR2032".
 * @param {object} entry - The battery.
 * @returns {string} The model.
 */
const modelOf = (entry) => `${entry.quantity} × ${entry.type}`;

/**
 * @description The device of a battery.
 * @param {object} gladys - The GladysIntegration instance.
 * @param {object} entry - The battery.
 * @param {string} [language] - Language of the feature names.
 * @returns {object} The discovered device.
 * @example
 * buildDevice(gladys, entry, 'fr');
 */
function buildDevice(gladys, entry, language = 'en') {
  const ids = idsOf(gladys, entry.id);
  const params = [
    { name: 'BATTERY_TYPE', value: entry.type },
    { name: 'BATTERY_QUANTITY', value: String(entry.quantity) },
  ];
  if (entry.model) params.push({ name: 'MODEL', value: entry.model });
  return {
    name: entry.name,
    external_id: ids.device,
    model: modelOf(entry),
    should_poll: false,
    params,
    features: FEATURES.map((spec) => ({
      name: t(spec.name, language),
      external_id: ids.feature(spec.key),
      ...spec.shape,
    })),
  };
}

/**
 * @description The states of a battery.
 * @param {object} gladys - The GladysIntegration instance.
 * @param {object} status - statusOf().
 * @param {string} language - Language of the texts.
 * @returns {object[]} The states.
 */
function buildStates(gladys, status, language) {
  const ids = idsOf(gladys, status.entry.id);
  return FEATURES.flatMap((spec) => {
    const value = spec.state(status, language);
    return value === null ? [] : [{ device_feature_external_id: ids.feature(spec.key), ...value }];
  });
}

export {
  DEVICE_TYPE,
  FEATURES,
  idsOf,
  idFromExternalId,
  featureKeyOf,
  modelOf,
  buildDevice,
  buildStates,
};
