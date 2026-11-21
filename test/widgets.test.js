// The widget contents, validated as the core would trim them
// (validateWidgetContent of the SDK) in every language and every state:
// empty, a few batteries, more rows than shown, a removed battery.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateWidgetContent } from '@gladysassistant/integration-sdk';
import {
  buildBatteriesWidget,
  buildBatteryWidget,
  buildShoppingWidget,
  rowValue,
  ttlUntil,
} from '../src/widgets.js';
import { statusOf, shoppingList } from '../src/batteries.js';
import { normalizeConfig } from '../src/config.js';
import { LANGUAGES } from '../src/i18n.js';

const config = normalizeConfig({});
const TODAY = '2026-11-21';
const battery = (n, over = {}) => ({
  id: `a000000${n}`.slice(-8),
  name: `Détecteur de fumée de la chambre ${n} — étage`,
  type: n % 2 ? 'CR2032' : 'Rechargeable Li-ion',
  quantity: (n % 3) + 1,
  lifeMonths: 12,
  replacedOn: `2025-${String((n % 12) + 1).padStart(2, '0')}-15`,
  history: [],
  taken: 0,
  model: '',
  ...over,
});
const statuses = (count) =>
  Array.from({ length: count }, (_, i) =>
    statusOf(battery(i + 1), TODAY, config, i === 2 ? { level: 8, day: TODAY } : null),
  );

const valid = (content, label) => assert.deepEqual(validateWidgetContent(content), [], label);
const counts = (content) =>
  content.components.reduce((acc, c) => ({ ...acc, [c.type]: (acc[c.type] ?? 0) + 1 }), {});

test('batteries: counters, rows from the most urgent, the form of the button', () => {
  for (const language of LANGUAGES) {
    for (const count of [0, 3, 14]) {
      const list = statuses(count);
      const content = buildBatteriesWidget({
        statuses: list,
        shopping: shoppingList(list, { CR2032: 2 }, 30),
        settings: {},
        language,
        ttl: 3600,
      });
      valid(content, `${language} ${count}`);
      if (count === 14) {
        const status = content.components.find((c) => c.type === 'status');
        assert.equal(status.items.length, 10);
        assert.equal(status.items[0].color, 'danger');
        assert.ok(
          content.components.some((c) => c.type === 'text' && /4/.test(c.text)),
          'and 4 more',
        );
        const button = content.components.find((c) => c.type === 'button');
        assert.equal(button.action.fields[0].options.length, 14);
        assert.deepEqual(counts(content), { value: 3, status: 1, text: 1, button: 1 });
      }
    }
  }
  const list = statuses(3);
  const due = buildBatteriesWidget({
    statuses: list,
    shopping: [],
    settings: { show: 'due', show_button: false },
    language: 'en',
    ttl: 60,
  });
  valid(due);
  assert.ok(!due.components.some((c) => c.type === 'button'));
  assert.ok(
    due.components.find((c) => c.type === 'status').items.every((item) => item.color !== 'success'),
  );
});

test('rows fit 40 characters', () => {
  for (const language of LANGUAGES) {
    for (const status of statuses(14)) {
      assert.ok(rowValue(status, language).length <= 40);
    }
  }
  const late = statusOf(battery(1, { replacedOn: '2020-01-01', lifeMonths: 1 }), TODAY, config);
  assert.match(rowValue(late, 'fr'), /^\d+ j de retard · 2 × CR2032$/);
});

test('battery: one battery, the empty and removed cases', () => {
  for (const language of LANGUAGES) {
    for (const [index, status] of statuses(3).entries()) {
      const content = buildBatteryWidget({
        status,
        chosen: true,
        stock: index === 0 ? 1 : null,
        language,
        ttl: 3600,
      });
      valid(content, `${language} ${index}`);
      assert.equal(content.components.find((c) => c.type === 'gauge').value, status.level);
    }
    valid(buildBatteryWidget({ status: null, chosen: false, stock: null, language, ttl: 60 }));
    valid(buildBatteryWidget({ status: null, chosen: true, stock: null, language, ttl: 60 }));
  }
  const reported = buildBatteryWidget({
    status: statuses(3)[2],
    chosen: true,
    stock: null,
    language: 'fr',
    ttl: 60,
  });
  assert.equal(reported.components.find((c) => c.type === 'gauge').label, 'Niveau');
  assert.match(JSON.stringify(reported), /mesuré le 21 nov/);
});

test('shopping: to buy by type, the stock form, "Bought" only with something to buy', () => {
  for (const language of LANGUAGES) {
    for (const stock of [{}, { CR2032: 1, AAA: 12 }]) {
      const list = statuses(6);
      const shopping = shoppingList(list, stock, 30);
      const content = buildShoppingWidget({
        shopping,
        statuses: list,
        horizonDays: 30,
        language,
        ttl: 60,
      });
      valid(content, language);
    }
    const empty = buildShoppingWidget({
      shopping: [],
      statuses: [],
      horizonDays: 30,
      language,
      ttl: 60,
    });
    valid(empty);
    const form = empty.components.find((c) => c.type === 'button').action.fields;
    assert.ok(
      form[0].options.some((option) => option.value === 'CR2032'),
      'common types offered',
    );
    assert.ok(!empty.components.some((c) => c.action?.key === 'bought'));
  }
});

test('TTL: until midnight, between a minute and an hour', () => {
  assert.equal(ttlUntil(10), 60);
  assert.equal(ttlUntil(1800), 1800);
  assert.equal(ttlUntil(80000), 3600);
});
