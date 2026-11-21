// The discovered devices, checked against what Gladys expects and does not
// say (feedback of the community, thread 11005): ranges and flags on every
// feature, valid category/type pairs, no polling, stable external ids.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  DEVICE_FEATURE_CATEGORIES as CATEGORIES,
  DEVICE_FEATURE_TYPES as TYPES,
  DEVICE_FEATURE_UNITS as UNITS,
} from '@gladysassistant/integration-sdk';
import { createFakeGladys } from '@gladysassistant/integration-sdk/testing';
import {
  buildDevice,
  buildStates,
  idFromExternalId,
  featureKeyOf,
  FEATURES,
} from '../src/device.js';
import { statusOf } from '../src/batteries.js';
import { normalizeConfig } from '../src/config.js';
import { LANGUAGES } from '../src/i18n.js';

const gladys = createFakeGladys({ selector: 'battery-tracker' });
const entry = {
  id: 'a1b2c3d4',
  name: 'Smoke detector — hall',
  type: '9V',
  quantity: 1,
  lifeMonths: null,
  replacedOn: '2026-01-01',
  history: [],
  taken: 0,
  model: 'Acme SD-1',
};

test('one device per battery: name, model, params, no polling', () => {
  const device = buildDevice(gladys, entry, 'fr');
  assert.equal(device.name, 'Smoke detector — hall');
  assert.equal(device.external_id, 'ext:battery-tracker:battery:a1b2c3d4');
  assert.equal(device.model, '1 × 9V');
  assert.equal(device.should_poll, false);
  assert.equal(device.poll_frequency, undefined, 'no onPoll, no poll_frequency');
  assert.deepEqual(device.params, [
    { name: 'BATTERY_TYPE', value: '9V' },
    { name: 'BATTERY_QUANTITY', value: '1' },
    { name: 'MODEL', value: 'Acme SD-1' },
  ]);
  assert.deepEqual(
    device.features.map((feature) => feature.name),
    [
      'Niveau des piles',
      'Jours avant remplacement',
      'Jours depuis le remplacement',
      'Piles remplacées',
      'Dernier remplacement',
    ],
  );
});

test('every feature: min, max, read_only, has_feedback, a valid category/type pair and unit', () => {
  for (const language of LANGUAGES) {
    for (const feature of buildDevice(gladys, entry, language).features) {
      for (const key of ['min', 'max', 'read_only', 'has_feedback']) {
        assert.notEqual(feature[key], undefined, `${feature.external_id}.${key}`);
      }
      assert.ok(feature.min <= feature.max, feature.external_id);
      const category = Object.entries(CATEGORIES).find(([, value]) => value === feature.category);
      assert.ok(category, feature.category);
      assert.ok(
        Object.values(TYPES[category[0]]).includes(feature.type),
        `${feature.category}/${feature.type}`,
      );
      if (feature.unit) {
        assert.ok(
          Object.values(UNITS).includes(feature.unit),
          `${feature.category} ${feature.unit}`,
        );
      }
      assert.ok(feature.name.length > 0 && feature.name.length <= 50);
    }
  }
  const replaced = FEATURES.find((spec) => spec.key === 'replaced');
  assert.deepEqual(
    [replaced.shape.category, replaced.shape.type, replaced.shape.read_only],
    ['button', 'push', false],
  );
});

test('states: level, days, last replacement; nothing for the button', () => {
  const status = statusOf(entry, '2026-07-02', normalizeConfig({}));
  const states = buildStates(gladys, status, 'en');
  assert.deepEqual(
    states.map((state) => [
      featureKeyOf(state.device_feature_external_id),
      state.state ?? state.text,
    ]),
    [
      ['level', 50],
      ['days_remaining', 183],
      ['days_since', 182],
      ['last_replaced', 'Thursday, January 1, 2026'],
    ],
  );
});

test('external ids give back the battery and the feature', () => {
  assert.equal(idFromExternalId('ext:battery-tracker:battery:a1b2c3d4'), 'a1b2c3d4');
  assert.equal(idFromExternalId('ext:battery-tracker:battery:a1b2c3d4:level'), 'a1b2c3d4');
  assert.equal(idFromExternalId('ext:other:plug:a1b2c3d4'), null);
  assert.equal(featureKeyOf('ext:battery-tracker:battery:a1b2c3d4:replaced'), 'replaced');
  assert.equal(featureKeyOf('ext:battery-tracker:battery:a1b2c3d4'), null);
});

test('the discovery batch is accepted by the fake Gladys', async () => {
  const fake = createFakeGladys();
  await fake.connect();
  await fake.publishDiscoveredDevices([buildDevice(fake, entry, 'de')]);
  assert.equal(fake.fake.discoveredDevices.length, 1);
  assert.ok(fake.fake.requests.every((request) => request.status === 200));
});
