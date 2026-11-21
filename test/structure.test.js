// -----------------------------------------------------------------------------
// Non-regression of everything users store: every key of the manifest a
// scene, a widget or a saved configuration refers to, the values scenes
// filter on, and the features of the devices users created.
//
// test/fixtures/manifest.baseline.json was generated from version 0.1.0 (the
// first release). A failure here means existing users would lose a setting,
// their device, a scene or a widget: never update the baseline without
// a documented migration.
// -----------------------------------------------------------------------------

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { FEATURES } from '../src/device.js';

const read = (path) => JSON.parse(readFileSync(new URL(path, import.meta.url), 'utf8'));
const baseline = read('./fixtures/manifest.baseline.json');
const manifest = read('../gladys-assistant-integration.json');

const keys = (list) => (list ?? []).map((entry) => entry.key);
const byKey = (list) => new Map((list ?? []).map((entry) => [entry.key, entry]));

test('stays a device integration', () => {
  assert.equal(manifest.type, baseline.type);
});

test('no configuration key disappears or changes type', () => {
  const current = byKey(manifest.config_schema);
  for (const { key, type } of baseline.config_schema) {
    assert.equal(current.get(key)?.type, type, `config_schema.${key}`);
  }
  // Saved configurations hold these values: an option never disappears.
  for (const [key, values] of Object.entries(baseline.select_values)) {
    const field = byKey(manifest.config_schema).get(key);
    for (const value of values) {
      assert.ok(
        field.options.some((option) => option.value === value),
        `${key}: ${value}`,
      );
    }
  }
});

test('no Configuration screen button disappears nor loses a field', () => {
  assert.deepEqual(
    keys(manifest.actions).filter((key) => baseline.actions.includes(key)),
    baseline.actions,
  );
  const current = byKey(manifest.actions);
  for (const [action, fields] of Object.entries(baseline.action_fields)) {
    fields.forEach((field) =>
      assert.ok(keys(current.get(action).fields).includes(field), `${action}.${field}`),
    );
  }
});

test('the features of the created devices keep their keys, pairs, units and ranges', () => {
  // Gladys compares these on "Update" in the Discovery screen: a change would
  // force every user to delete and create their devices again.
  const current = byKey(FEATURES);
  for (const feature of baseline.device_features) {
    const now = current.get(feature.key);
    assert.ok(now, `feature ${feature.key}`);
    assert.deepEqual(
      {
        key: now.key,
        category: now.shape.category,
        type: now.shape.type,
        unit: now.shape.unit ?? null,
        min: now.shape.min,
        max: now.shape.max,
      },
      feature,
    );
  }
  assert.equal(
    FEATURES.length,
    baseline.device_features.length,
    'a new feature needs a migration note',
  );
});

test('scene triggers keep their keys, filters, options and variables', () => {
  const current = byKey(manifest.scene_triggers);
  for (const trigger of baseline.scene_triggers) {
    const now = current.get(trigger.key);
    assert.ok(now, `scene_triggers.${trigger.key}`);
    const fields = byKey(now.fields);
    for (const { key, type, options } of trigger.fields) {
      assert.equal(fields.get(key)?.type, type, `${trigger.key}.fields.${key}`);
      const values = (fields.get(key).options ?? []).map((option) => option.value);
      options.forEach((value) =>
        assert.ok(values.includes(value), `${trigger.key}.${key}: ${value}`),
      );
    }
    const variables = byKey(now.variables);
    for (const { key, type } of trigger.variables) {
      assert.equal(variables.get(key)?.type, type, `${trigger.key}.variables.${key}`);
    }
  }
});

test('scene actions keep their keys, fields and outputs', () => {
  const current = byKey(manifest.scene_actions);
  for (const action of baseline.scene_actions) {
    const now = current.get(action.key);
    assert.ok(now, `scene_actions.${action.key}`);
    action.fields.forEach((field) =>
      assert.ok(keys(now.fields).includes(field), `${action.key}.${field}`),
    );
    const outputs = byKey(now.outputs);
    for (const { key, type } of action.outputs) {
      assert.equal(outputs.get(key)?.type, type, `${action.key}.outputs.${key}`);
    }
    // A new required field without a default breaks the scenes using the action.
    for (const field of now.fields ?? []) {
      if (field.required && field.default === undefined) {
        assert.ok(
          action.fields.includes(field.key),
          `${action.key}.${field.key} is new and required`,
        );
      }
    }
  }
});

test('widgets keep their keys and settings', () => {
  const current = byKey(manifest.widgets);
  for (const widget of baseline.widgets) {
    const now = current.get(widget.key);
    assert.ok(now, `widgets.${widget.key}`);
    const settings = byKey(now.settings);
    widget.settings.forEach((key) => assert.ok(settings.has(key), `${widget.key}.${key}`));
  }
});
