// The manifest against the code: versions, transport, declarations handled
// by the code, values mirrored from the code, limits of the store.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, statSync } from 'node:fs';

import { SCENE_TRIGGERS, SCENE_ACTIONS, REPORT_CONTENTS } from '../src/events.js';
import { ACTIONS } from '../src/app.js';
import { WIDGETS } from '../src/widgets.js';
import { LIFE_MONTHS, REMINDER_DAYS, LOW_LEVEL, HORIZON_DAYS, EVENT_HOUR } from '../src/config.js';
import { QUANTITY, STOCK_MAX, STOCK_OPERATIONS } from '../src/registry.js';
import { LANGUAGES } from '../src/i18n.js';

const read = (path) => JSON.parse(readFileSync(new URL(path, import.meta.url), 'utf8'));
const manifest = read('../gladys-assistant-integration.json');
const pkg = read('../package.json');
const byKey = (list) => new Map(list.map((entry) => [entry.key, entry]));
const values = (field) => field.options.map((option) => option.value);
const source = (path) => readFileSync(new URL(path, import.meta.url), 'utf8');
const bounds = (field) => [field.min, field.max];

test('a device integration, in lockstep with package.json, at 0.x', () => {
  assert.equal(manifest.type, 'device');
  assert.equal(manifest.name, 'Battery Tracker');
  assert.equal(manifest.version, pkg.version);
  assert.match(pkg.version, /^0\./);
  assert.equal(manifest.docker_image, `ghcr.io/william-de71/gladys-battery-tracker:${pkg.version}`);
  assert.equal(
    manifest.cover_image,
    'https://raw.githubusercontent.com/William-De71/gladys-battery-tracker/main/cover.jpg',
  );
  assert.equal(pkg.license, 'Apache-2.0');
  assert.equal(pkg.name, 'gladys-battery-tracker');
});

test('declares the local transport only: no network call at all', () => {
  assert.deepEqual(manifest.transports, ['local']);
  for (const file of ['app', 'registry', 'library', 'batteries', 'state', 'widgets', 'events']) {
    assert.doesNotMatch(source(`../src/${file}.js`), /fetch\(|https?:\/\/(?!github)/, file);
  }
  assert.doesNotMatch(source('../src/app.js'), /publishTransports|GLADYS_PREFER_LOCAL/);
});

test('requires Gladys 5.3.0 (widget forms, scenes, catalog keywords); no extra permission', () => {
  assert.equal(manifest.gladys_version, '>=5.3.0');
  assert.deepEqual(manifest.categories, ['services']);
  for (const key of ['location', 'network_wake', 'containers', 'network_discovery', 'webhooks']) {
    assert.equal(manifest[key], undefined, key);
  }
});

test('declares exactly the scene triggers, actions, widgets and buttons the code handles', () => {
  assert.deepEqual(
    manifest.scene_triggers.map((trigger) => trigger.key).sort(),
    Object.values(SCENE_TRIGGERS).sort(),
  );
  assert.deepEqual(
    manifest.scene_actions.map((action) => action.key).sort(),
    Object.values(SCENE_ACTIONS).sort(),
  );
  assert.deepEqual(
    manifest.widgets.map((widget) => widget.key).sort(),
    Object.values(WIDGETS).sort(),
  );
  const app = source('../src/app.js');
  for (const key of Object.keys(WIDGETS)) {
    assert.match(app, new RegExp(`onWidgetGet\\(WIDGETS\\.${key}`), key);
  }
  for (const key of Object.keys(SCENE_ACTIONS)) {
    assert.match(app, new RegExp(`onSceneAction\\(SCENE_ACTIONS\\.${key}`), key);
  }
  assert.deepEqual(
    manifest.actions.map((action) => action.key).sort(),
    Object.values(ACTIONS).sort(),
  );
  for (const key of Object.keys(ACTIONS)) {
    assert.match(app, new RegExp(`onAction\\(ACTIONS\\.${key}`), key);
  }
});

test('mirrors the values of the code', () => {
  const config = byKey(manifest.config_schema);
  assert.deepEqual(bounds(config.get('default_life_months')), [LIFE_MONTHS.min, LIFE_MONTHS.max]);
  assert.equal(config.get('default_life_months').default, LIFE_MONTHS.default);
  assert.deepEqual(bounds(config.get('reminder_days')), [REMINDER_DAYS.min, REMINDER_DAYS.max]);
  assert.equal(config.get('reminder_days').default, REMINDER_DAYS.default);
  assert.deepEqual(bounds(config.get('low_level')), [LOW_LEVEL.min, LOW_LEVEL.max]);
  assert.equal(config.get('low_level').default, LOW_LEVEL.default);
  assert.deepEqual(bounds(config.get('horizon_days')), [HORIZON_DAYS.min, HORIZON_DAYS.max]);
  assert.equal(config.get('horizon_days').default, HORIZON_DAYS.default);
  assert.deepEqual(bounds(config.get('event_hour')), [EVENT_HOUR.min, EVENT_HOUR.max]);
  assert.equal(config.get('event_hour').default, EVENT_HOUR.default);
  assert.equal(config.get('auto_replace').default, true);
  assert.equal(config.get('decrement_stock').default, true);
  assert.deepEqual(values(config.get('language')), ['auto', ...LANGUAGES]);

  const actions = byKey(manifest.actions);
  const add = byKey(actions.get('add_battery').fields);
  assert.deepEqual(bounds(add.get('quantity')), [QUANTITY.min, QUANTITY.max]);
  assert.deepEqual(bounds(add.get('life_months')), [0, LIFE_MONTHS.max]);
  const stock = byKey(actions.get('set_stock').fields);
  assert.deepEqual(values(stock.get('operation')), STOCK_OPERATIONS);
  assert.deepEqual(bounds(stock.get('count')), [0, STOCK_MAX]);

  const report = byKey(byKey(manifest.scene_actions).get('get_report').fields);
  assert.deepEqual(values(report.get('content')), REPORT_CONTENTS);
  const due = byKey(byKey(manifest.scene_triggers).get('replacement_due').fields);
  assert.deepEqual(values(due.get('reason')), ['age', 'level']);
  // The level of report_level is a string: only string fields get the {{…}}
  // of the scene substituted by the core.
  const level = byKey(byKey(manifest.scene_actions).get('report_level').fields).get('level');
  assert.equal(level.type, 'string');
});

test('the battery of a scene or widget is chosen among the devices of the integration', () => {
  const pick = (list, key) => byKey(byKey(list).get(key).fields ?? byKey(list).get(key).settings);
  for (const [list, key] of [
    [manifest.scene_triggers, 'replacement_due'],
    [manifest.scene_triggers, 'battery_replaced'],
    [manifest.scene_actions, 'report_level'],
    [manifest.scene_actions, 'mark_replaced'],
  ]) {
    assert.equal(pick(list, key).get('battery').source, 'devices', key);
  }
  const widget = byKey(byKey(manifest.widgets).get('battery').settings);
  assert.equal(widget.get('battery').source, 'devices');
});

test('limits of the store: counts, timeouts, sizes', () => {
  assert.ok(manifest.widgets.length >= 1 && manifest.widgets.length <= 5);
  assert.ok(manifest.scene_triggers.length <= 20);
  assert.ok(manifest.scene_actions.length <= 20);
  assert.ok(manifest.actions.length <= 10);
  for (const trigger of manifest.scene_triggers) {
    assert.ok((trigger.fields ?? []).length <= 10 && trigger.variables.length <= 20, trigger.key);
    assert.ok(trigger.key.length <= 40);
    for (const field of trigger.fields ?? []) {
      assert.ok(['string', 'number', 'select', 'multi_select'].includes(field.type), field.key);
    }
  }
  for (const action of [...manifest.scene_actions, ...manifest.actions]) {
    assert.ok(action.timeout_seconds >= 5 && action.timeout_seconds <= 120, action.key);
    assert.ok(
      (action.fields ?? []).length <= 10 && (action.outputs ?? []).length <= 20,
      action.key,
    );
  }
  // The store refuses a manifest of 100 KB or more.
  const size = statSync(new URL('../gladys-assistant-integration.json', import.meta.url)).size;
  assert.ok(size < 100 * 1024, `${size} bytes`);
  // The cover: 800 x 534 JPEG under 150 KB (dimensions checked in i18n.test.js).
  const cover = readFileSync(new URL('../cover.jpg', import.meta.url));
  assert.ok(cover.length < 150 * 1024, `cover.jpg: ${cover.length} bytes`);
  assert.equal(cover.readUInt16BE(0), 0xffd8, 'cover.jpg is a JPEG');
});

test('catalog search terms, usable in every country', () => {
  assert.ok(Array.isArray(manifest.keywords));
  assert.ok(manifest.keywords.length >= 1 && manifest.keywords.length <= 10);
  const terms = manifest.keywords.map((keyword) => keyword.trim().toLowerCase());
  for (const [index, term] of terms.entries()) {
    assert.ok(term.length >= 2 && manifest.keywords[index].length <= 30, term);
  }
  assert.equal(new Set(terms).size, terms.length, 'unique once trimmed and lowercased');
  assert.ok(!terms.includes(manifest.name.toLowerCase()), 'the name is already searched');
  assert.equal(manifest.countries, undefined);
});
