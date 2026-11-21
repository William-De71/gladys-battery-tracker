// The integration end to end, against the fake Gladys of the SDK: the
// configuration buttons, the Discovery list, the states of the created
// devices, the device button, the scene events (event hour, once per
// transition, never after a scene action), the scene actions and the widget
// buttons.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateWidgetContent } from '@gladysassistant/integration-sdk';
import { ACTIONS } from '../src/app.js';
import { SCENE_TRIGGERS, SCENE_ACTIONS } from '../src/events.js';
import { WIDGETS, WIDGET_ACTIONS } from '../src/widgets.js';
import { start, ok, createDevice } from './helpers/start.js';

const SMOKE = { name: 'Smoke detector', battery_type: '9V', replaced_on: '2026-01-01' };
const SENSOR = { name: 'Living room sensor', battery_type: 'CR2032', replaced_on: '2025-11-01' };
const keyOf = (state) => state.device_feature_external_id.split(':').pop();
const events = (gladys, key) => gladys.fake.sceneEvents.filter((event) => event.key === key);
const button = (device) =>
  device.features.find((feature) => feature.external_id.endsWith(':replaced'));

test('no battery: a status that says what to do, an empty list and widget', async () => {
  const { gladys } = await start();
  assert.deepEqual(gladys.fake.discoveredDevices, []);
  assert.equal(gladys.fake.connectionStatus.connected, true);
  assert.match(gladys.fake.connectionStatus.message.fr, /Ajouter une pile/);
  assert.match(
    ok(await gladys.fake.action(ACTIONS.LIST)).en,
    /^No battery yet\.\n\nStock: none recorded\.$/,
  );
  const content = ok(await gladys.fake.widgetGet(WIDGETS.BATTERIES));
  assert.deepEqual(validateWidgetContent(content), []);
  assert.equal(content.components[0].type, 'text');
});

test('add a battery: stored in Gladys, offered on the Discovery screen, explained', async () => {
  const { gladys } = await start({ at: '2026-11-21T05:00:00Z' });
  const message = ok(await gladys.fake.action(ACTIONS.ADD, SMOKE));
  assert.match(
    message.fr,
    /^Pile ajoutée\. Ajoutez son appareil dans l’onglet Découverte\.\n#1 • Smoke detector \(1 × 9V\) : fin dans 41 jours/,
  );
  assert.equal(gladys.fake.config.batteries.length, 1);
  assert.deepEqual(
    gladys.fake.discoveredDevices.map((device) => device.name),
    ['Smoke detector'],
  );
  assert.match(gladys.fake.connectionStatus.message.en, /1 battery record\(s\), 0 to replace soon/);
  const refused = await gladys.fake.action(ACTIONS.ADD, {
    name: 'X',
    battery_type: 'AA',
    quantity: 99,
  });
  assert.equal(refused.success, false);
  assert.match(refused.error, /The number of batteries goes from 1 to 24/);
  const library = ok(
    await gladys.fake.action(ACTIONS.ADD, {
      name: 'Bedroom',
      manufacturer: 'Aqara',
      model: 'WSDCGQ11LM',
    }),
  );
  assert.match(library.en, /Bedroom \(1 × CR2032\)/);
});

test('created device: every state published, then only changes; a new day moves them', async () => {
  const { gladys, app, clock } = await start({ at: '2026-11-21T05:00:00Z' });
  ok(await gladys.fake.action(ACTIONS.ADD, SMOKE));
  const device = await createDevice(gladys, 'b0000001');
  assert.deepEqual(
    gladys.fake.states.map((state) => [keyOf(state), state.state ?? state.text]),
    [
      ['level', 11],
      ['days_remaining', 41],
      ['days_since', 324],
      ['last_replaced', 'Thursday, January 1, 2026'],
    ],
  );
  assert.ok(gladys.fake.widgetRefreshes.includes(WIDGETS.BATTERIES));
  const published = gladys.fake.states.length;
  await app.tick();
  assert.equal(gladys.fake.states.length, published, 'nothing changed');
  clock.now = new Date('2026-11-22T05:00:00Z');
  await app.tick();
  assert.equal(gladys.fake.lastState(`${device.external_id}:days_remaining`), 40);
});

test('replacement due: at the event hour, once, again after a replacement', async () => {
  const { gladys, app, clock } = await start({ at: '2026-11-21T05:00:00Z' });
  ok(await gladys.fake.action(ACTIONS.ADD, SENSOR));
  assert.equal(events(gladys, SCENE_TRIGGERS.DUE).length, 0, '06:00 in Paris, before 09:00');
  clock.now = new Date('2026-11-21T08:00:00Z');
  await app.tick();
  await app.tick();
  const due = events(gladys, SCENE_TRIGGERS.DUE);
  assert.equal(due.length, 1);
  assert.deepEqual(due[0].data, {
    battery: 'ext:test-integration:battery:b0000001',
    reason: 'age',
    name: 'Living room sensor',
    battery_type: 'CR2032',
    quantity: 1,
    days_remaining: -20,
    level: 0,
    level_source: 'estimated',
    end_date: 'Sunday, November 1, 2026',
  });
  assert.deepEqual(events(gladys, SCENE_TRIGGERS.SHORT)[0].data, {
    battery_type: 'CR2032',
    stock: 0,
    needed: 1,
    to_buy: 1,
  });

  const device = await createDevice(gladys, 'b0000001');
  ok(await gladys.fake.setValue(device, button(device), 1));
  assert.deepEqual(events(gladys, SCENE_TRIGGERS.REPLACED)[0].data, {
    battery: device.external_id,
    origin: 'device',
    name: 'Living room sensor',
    battery_type: 'CR2032',
    quantity: 1,
    days_used: 385,
    stock_left: null,
  });
  assert.equal(gladys.fake.lastState(`${device.external_id}:days_since`), 0);
  // The learned life (385 days) makes it last a year again; a year later it
  // is due once more.
  clock.now = new Date('2027-12-01T09:00:00Z');
  await app.tick();
  assert.equal(events(gladys, SCENE_TRIGGERS.DUE).length, 2);
});

test('stock: taken at a replacement, given back by an undo, refilled by "Bought the list"', async () => {
  const { gladys } = await start();
  ok(await gladys.fake.action(ACTIONS.ADD, { ...SENSOR, quantity: 2 }));
  assert.equal(events(gladys, SCENE_TRIGGERS.SHORT).length, 1);
  assert.match(
    ok(await gladys.fake.action(ACTIONS.STOCK, { battery_type: 'cr2032', count: 3 })).en,
    /CR2032: 0 → 3/,
  );
  const replaced = ok(await gladys.fake.action(ACTIONS.MARK, { battery: '#1' }));
  assert.match(replaced.en, /1 × CR2032 left in stock/);
  assert.equal(events(gladys, SCENE_TRIGGERS.REPLACED)[0].data.origin, 'configuration');
  assert.equal(events(gladys, SCENE_TRIGGERS.REPLACED)[0].data.stock_left, 1);
  assert.match(
    ok(await gladys.fake.action(ACTIONS.UNDO, { battery: 'Living room sensor' })).en,
    /2 × CR2032 put back in stock/,
  );
  assert.deepEqual(gladys.fake.config.battery_stock, { CR2032: 3 });

  ok(
    await gladys.fake.action(ACTIONS.STOCK, { battery_type: 'CR2032', operation: 'set', count: 0 }),
  );
  const shopping = ok(await gladys.fake.widgetGet(WIDGETS.SHOPPING));
  assert.deepEqual(validateWidgetContent(shopping), []);
  assert.equal(shopping.components[0].value, 2, 'two to buy');
  const toast = ok(await gladys.fake.widgetAction(WIDGETS.SHOPPING, WIDGET_ACTIONS.BOUGHT));
  assert.equal(toast.en, 'Put in stock: 2 × CR2032.');
  assert.deepEqual(gladys.fake.config.battery_stock, { CR2032: 2 });
  const stock = ok(
    await gladys.fake.widgetAction(
      WIDGETS.SHOPPING,
      WIDGET_ACTIONS.STOCK,
      {},
      {
        values: { battery_type: 'AA', operation: 'add', count: 4 },
      },
    ),
  );
  assert.equal(stock.fr, 'Stock de AA : 0 → 4.');
  assert.equal(
    ok(await gladys.fake.widgetAction(WIDGETS.SHOPPING, WIDGET_ACTIONS.STOCK)).en,
    ok(await gladys.fake.widgetAction(WIDGETS.BATTERIES, WIDGET_ACTIONS.REPLACED)).en,
    'no form: update Gladys',
  );
});

test('report_level: kept as the level, a low one makes it due, a rise is a replacement without event', async () => {
  const { gladys } = await start();
  ok(await gladys.fake.action(ACTIONS.ADD, { ...SMOKE, replaced_on: '2026-11-01' }));
  const device = await createDevice(gladys, 'b0000001');
  const low = ok(
    await gladys.fake.sceneAction(SCENE_ACTIONS.REPORT, {
      battery: device.external_id,
      level: '12 %',
    }),
  );
  assert.deepEqual(low, { level: 12, replaced: false, days_remaining: 345 });
  assert.equal(gladys.fake.lastState(`${device.external_id}:level`), 12);
  const due = events(gladys, SCENE_TRIGGERS.DUE);
  assert.equal(due.length, 1);
  assert.deepEqual([due[0].data.reason, due[0].data.level_source], ['level', 'reported']);

  const high = ok(
    await gladys.fake.sceneAction(SCENE_ACTIONS.REPORT, {
      battery: device.external_id,
      level: 100,
    }),
  );
  assert.equal(high.replaced, true);
  assert.equal(events(gladys, SCENE_TRIGGERS.REPLACED).length, 0, 'never after a scene action');
  assert.equal(gladys.fake.lastState(`${device.external_id}:level`), 100);
  assert.equal(gladys.fake.config.batteries[0].replacedOn, '2026-11-21');

  const bad = await gladys.fake.sceneAction(SCENE_ACTIONS.REPORT, {
    battery: device.external_id,
    level: '{{x}}',
  });
  assert.equal(bad.success, false);
  assert.match(bad.error, /is not a level from 0 to 100/);
  const unknown = await gladys.fake.sceneAction(SCENE_ACTIONS.REPORT, {
    battery: 'ext:test-integration:battery:ffffffff',
    level: 50,
  });
  assert.equal(unknown.success, false);

  const marked = ok(
    await gladys.fake.sceneAction(SCENE_ACTIONS.MARK, { battery: device.external_id }),
  );
  assert.deepEqual(marked, { days_used: 0, stock_left: -1 });
  assert.equal(events(gladys, SCENE_TRIGGERS.REPLACED).length, 0);
});

test('auto_replace off: a rise is only a level', async () => {
  const { gladys } = await start({ config: { auto_replace: false } });
  ok(await gladys.fake.action(ACTIONS.ADD, SMOKE));
  const device = await createDevice(gladys, 'b0000001');
  ok(
    await gladys.fake.sceneAction(SCENE_ACTIONS.REPORT, { battery: device.external_id, level: 10 }),
  );
  const high = ok(
    await gladys.fake.sceneAction(SCENE_ACTIONS.REPORT, { battery: device.external_id, level: 90 }),
  );
  assert.equal(high.replaced, false);
  assert.equal(gladys.fake.config.batteries[0].replacedOn, '2026-01-01');
});

test('get_report: the text of a notification, counts', async () => {
  const { gladys } = await start();
  ok(await gladys.fake.action(ACTIONS.ADD, SMOKE));
  ok(await gladys.fake.action(ACTIONS.ADD, SENSOR));
  const due = ok(await gladys.fake.sceneAction(SCENE_ACTIONS.REPORT_TEXT, {}));
  assert.equal(due.due_count, 1);
  assert.equal(
    due.to_buy_count,
    1,
    'the sensor; the detector ends in 41 days, beyond the 30 of the horizon',
  );
  assert.match(
    due.text,
    /^Batteries to replace \(1\):\n• Living room sensor \(1 × CR2032\): 20 days overdue/,
  );
  const all = ok(await gladys.fake.sceneAction(SCENE_ACTIONS.REPORT_TEXT, { content: 'all' }));
  assert.match(all.text, /All batteries \(2\)/);
  const shopping = ok(
    await gladys.fake.sceneAction(SCENE_ACTIONS.REPORT_TEXT, { content: 'shopping' }),
  );
  assert.match(shopping.text, /^To buy:\n• 1 × CR2032/);
});

test('widget buttons: replaced with the form, from the one-battery widget, refusals as toasts', async () => {
  const { gladys } = await start();
  ok(await gladys.fake.action(ACTIONS.ADD, SENSOR));
  const toast = ok(
    await gladys.fake.widgetAction(
      WIDGETS.BATTERIES,
      WIDGET_ACTIONS.REPLACED,
      {},
      {
        values: { battery: 'b0000001', day: '20/11/2026' },
      },
    ),
  );
  assert.match(toast.en, /Replacement of “Living room sensor” recorded on Nov 20, 2026/);
  assert.equal(events(gladys, SCENE_TRIGGERS.REPLACED)[0].data.origin, 'widget');
  const future = ok(
    await gladys.fake.widgetAction(
      WIDGETS.BATTERIES,
      WIDGET_ACTIONS.REPLACED,
      {},
      {
        values: { battery: 'b0000001', day: '01/01/2030' },
      },
    ),
  );
  assert.equal(future.en, 'A replacement cannot be in the future.');
  const one = ok(
    await gladys.fake.widgetAction(WIDGETS.BATTERY, WIDGET_ACTIONS.REPLACED, {
      battery: 'b0000001',
    }),
  );
  assert.match(one.fr, /Remplacement de « Living room sensor » enregistré le 21 nov\. 2026/);

  const device = await createDevice(gladys, 'b0000001');
  const content = ok(
    await gladys.fake.widgetGet(WIDGETS.BATTERY, {
      settings: { battery: device.external_id },
      language: 'de',
    }),
  );
  assert.deepEqual(validateWidgetContent(content), []);
  assert.equal(content.components[0].text, 'Living room sensor');
  const gone = ok(
    await gladys.fake.widgetGet(WIDGETS.BATTERY, {
      settings: { battery: 'ext:test-integration:battery:ffffffff' },
    }),
  );
  assert.match(gone.components[0].text, /no longer exists/);
});

test('language: automatic follows the dashboard, the configuration wins', async () => {
  const { gladys } = await start({ config: { language: 'auto' } });
  ok(await gladys.fake.action(ACTIONS.ADD, SMOKE));
  assert.equal(
    gladys.fake.discoveredDevices[0].features[0].name,
    'Niveau des piles',
    'Europe/Paris guess',
  );
  ok(await gladys.fake.widgetGet(WIDGETS.BATTERIES, { language: 'de' }));
  assert.equal(gladys.fake.config.last_language, 'de');
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(gladys.fake.discoveredDevices[0].features[0].name, 'Batteriestand');
  await gladys.fake.configUpdated({ ...gladys.fake.config, language: 'es' });
  assert.equal(gladys.fake.discoveredDevices[0].features[0].name, 'Nivel de las pilas');
});

test('remove: the device leaves the Discovery list, its level is forgotten', async () => {
  const { gladys, app } = await start();
  ok(await gladys.fake.action(ACTIONS.ADD, SMOKE));
  const device = await createDevice(gladys, 'b0000001');
  ok(
    await gladys.fake.sceneAction(SCENE_ACTIONS.REPORT, { battery: device.external_id, level: 40 }),
  );
  assert.match(
    ok(await gladys.fake.action(ACTIONS.REMOVE, { battery: '#1' })).en,
    /“Smoke detector” removed/,
  );
  assert.deepEqual(gladys.fake.discoveredDevices, []);
  assert.equal(app.state.level('b0000001'), null);
  const lookup = ok(
    await gladys.fake.action(ACTIONS.LOOKUP, { manufacturer: 'ikea', model: 'styrbar' }),
  );
  assert.match(lookup.en, /^2 model\(s\) found \(2 shown\):\n• IKEA STYRBAR remote control/);
  assert.match(
    ok(await gladys.fake.action(ACTIONS.LOOKUP, { model: 'zzzz-nothing' })).en,
    /No model found/,
  );
});
