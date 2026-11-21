// The registry of the batteries and of the stock: forms checked, the device
// library used when the type is missing, replacements, undo, stock changes,
// what is stored and what is ignored when read back.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  createRegistry,
  parseRegistry,
  parseStock,
  readDay,
  resolveBattery,
  RegistryError,
} from '../src/registry.js';
import { lookupModel, singleBattery, compact } from '../src/library.js';
import { INTERNAL_KEYS } from '../src/config.js';

const TODAY = '2026-11-21';

/**
 * @description A registry on a fake setConfig.
 * @param {object} [stored] - The stored configuration.
 * @returns {{ registry: object, saved: object[] }} The registry and what it saved.
 */
function make(stored = {}) {
  const saved = [];
  let n = 0;
  const registry = createRegistry(
    { setConfig: async (values) => saved.push(values) },
    { newId: () => `c000000${(n += 1)}`.slice(-8) },
  );
  registry.load(stored);
  return { registry, saved };
}

const rejects = (promise, key) =>
  assert.rejects(promise, (err) => err instanceof RegistryError && err.key === key);

test('add: typed battery, defaults, stored in the Gladys configuration', async () => {
  const { registry, saved } = make();
  const entry = await registry.add({ name: '  Smoke   detector ', battery_type: '9v' }, TODAY);
  assert.deepEqual(entry, {
    id: 'c0000001',
    name: 'Smoke detector',
    type: '9V',
    quantity: 1,
    lifeMonths: null,
    replacedOn: TODAY,
    history: [],
    taken: 0,
    model: '',
  });
  assert.deepEqual(saved, [{ [INTERNAL_KEYS.registry]: [entry] }]);
  const second = await registry.add(
    {
      name: 'Remote',
      battery_type: 'AAA',
      quantity: '2',
      life_months: 18,
      replaced_on: '1/3/2026',
    },
    TODAY,
  );
  assert.equal(second.quantity, 2);
  assert.equal(second.lifeMonths, 18);
  assert.equal(second.replacedOn, '2026-03-01');
});

test('add: the device library gives the type and count of a model', async () => {
  const { registry } = make();
  const entry = await registry.add(
    { name: 'Living room', manufacturer: 'aqara', model: 'wsdcgq11lm' },
    TODAY,
  );
  assert.equal(entry.type, 'CR2032');
  assert.equal(entry.quantity, 1);
  assert.match(entry.model, /^Aqara .*WSDCGQ11LM/);
  // A typed count wins over the library.
  const remote = await registry.add(
    { name: 'Styrbar', manufacturer: 'IKEA', model: 'STYRBAR', quantity: 1 },
    TODAY,
  );
  assert.deepEqual([remote.type, remote.quantity], ['AAA', 1]);
  await rejects(registry.add({ name: 'X' }, TODAY), 'errorTypeMissing');
  await rejects(registry.add({ name: 'X', model: 'no-such-model-42' }, TODAY), 'errorModelUnknown');
  await rejects(registry.add({ name: 'X', manufacturer: 'IKEA' }, TODAY), 'errorModelAmbiguous');
});

test('add: invalid forms are refused with the reason', async () => {
  const { registry, saved } = make();
  await rejects(registry.add({ name: '', battery_type: 'AA' }, TODAY), 'errorName');
  await rejects(registry.add({ name: 'x'.repeat(61), battery_type: 'AA' }, TODAY), 'errorName');
  await rejects(
    registry.add({ name: 'X', battery_type: 'AA', quantity: 0 }, TODAY),
    'errorQuantity',
  );
  await rejects(
    registry.add({ name: 'X', battery_type: 'AA', quantity: 1.5 }, TODAY),
    'errorQuantity',
  );
  await rejects(
    registry.add({ name: 'X', battery_type: 'AA', life_months: 999 }, TODAY),
    'errorLife',
  );
  await rejects(
    registry.add({ name: 'X', battery_type: 'AA', replaced_on: '31/02/2026' }, TODAY),
    'errorDay',
  );
  await rejects(
    registry.add({ name: 'X', battery_type: 'AA', replaced_on: '01/12/2026' }, TODAY),
    'errorFutureDay',
  );
  assert.deepEqual(saved, [], 'nothing stored');
});

test('days: empty or "today" in any language is today', () => {
  for (const raw of ['', undefined, 'today', "aujourd'hui", 'Heute', 'hoy']) {
    assert.equal(readDay(raw, TODAY), TODAY, String(raw));
  }
});

test('find, edit and remove by number, name or identifier', async () => {
  const { registry } = make();
  await registry.add({ name: 'Hall', battery_type: 'AA', quantity: 2 }, TODAY);
  await registry.add({ name: 'Remote', battery_type: 'AAA' }, TODAY);
  await registry.add({ name: 'remote', battery_type: 'AAA' }, TODAY);
  assert.equal(registry.find('#1').name, 'Hall');
  assert.equal(registry.find('hall').name, 'Hall');
  assert.equal(registry.find('c0000002').name, 'Remote');
  assert.throws(
    () => registry.find('REMOTE'),
    (err) => err.key === 'errorAmbiguous',
  );
  assert.throws(
    () => registry.find('Garage'),
    (err) => err.key === 'errorNotFound',
  );
  assert.throws(
    () => registry.find(' '),
    (err) => err.key === 'errorTarget',
  );

  const { before, after } = await registry.edit(
    { battery: '#1', name: 'Hall sensor', life_months: '6', replaced_on: '2026-10-01' },
    TODAY,
  );
  assert.equal(before.name, 'Hall');
  assert.deepEqual(
    [after.name, after.quantity, after.lifeMonths, after.replacedOn],
    ['Hall sensor', 2, 6, '2026-10-01'],
  );
  const reset = await registry.edit({ battery: '#1', life_months: 0 }, TODAY);
  assert.equal(reset.after.lifeMonths, null, '0 = learned or default life');

  const removed = await registry.remove('#3');
  assert.equal(removed.name, 'remote');
  assert.deepEqual(
    registry.list().map((e) => e.name),
    ['Hall sensor', 'Remote'],
  );
});

test('replace: history kept, batteries taken from the stock, undo gives them back', async () => {
  const { registry, saved } = make();
  const entry = await registry.add(
    { name: 'Hall', battery_type: 'AA', quantity: 2, replaced_on: '2026-01-01' },
    TODAY,
  );
  await registry.setStock({ battery_type: 'aa', operation: 'set', count: 3 });

  const first = await registry.replace(entry.id, '2026-11-01');
  assert.deepEqual(first.entry.history, ['2026-01-01']);
  assert.equal(first.daysUsed, 304);
  assert.deepEqual([first.stockLeft, first.short, first.entry.taken], [1, false, 2]);
  assert.deepEqual(saved.at(-1), {
    [INTERNAL_KEYS.registry]: [first.entry],
    [INTERNAL_KEYS.stock]: { AA: 1 },
  });

  const second = await registry.replace(entry.id, TODAY);
  assert.deepEqual([second.stockLeft, second.short, second.entry.taken], [0, true, 1]);
  await rejects(registry.replace(entry.id, '2026-10-01'), 'errorBeforeLast');

  const undone = await registry.undo('Hall');
  assert.equal(undone.entry.replacedOn, '2026-11-01');
  assert.equal(undone.returned, 1, 'only what was taken');
  assert.deepEqual(registry.stock(), { AA: 1 });
  await registry.undo('Hall');
  await rejects(registry.undo('Hall'), 'errorNothingToUndo');

  // Without stock decrement, or a type not in stock: nothing taken.
  const free = await registry.replace(entry.id, TODAY, { decrement: false });
  assert.deepEqual([free.stockLeft, free.entry.taken], [null, 0]);
});

test('stock: add, remove, set; same type whatever the spelling; empty unused types dropped', async () => {
  const { registry } = make();
  await registry.add({ name: 'Hall', battery_type: 'CR2032' }, TODAY);
  assert.deepEqual(await registry.setStock({ battery_type: 'cr 2032', count: 4 }), {
    type: 'CR2032',
    before: 0,
    after: 4,
  });
  assert.equal(
    (await registry.setStock({ battery_type: 'CR2032', operation: 'remove', count: 9 })).after,
    0,
  );
  assert.deepEqual(registry.stock(), { CR2032: 0 }, 'kept at 0: a battery uses it');
  await registry.setStock({ battery_type: 'AA', operation: 'add', count: 2 });
  await registry.setStock({ battery_type: 'aa', operation: 'set', count: 0 });
  assert.deepEqual(registry.stock(), { CR2032: 0 }, 'AA dropped: no battery uses it');
  await rejects(registry.setStock({ battery_type: 'AA', count: -1 }), 'errorCount');
  await rejects(
    registry.setStock({ battery_type: 'AA', operation: 'double', count: 1 }),
    'errorChoice',
  );
  await rejects(registry.setStock({ battery_type: '', count: 1 }), 'errorType');
});

test('stored values: invalid batteries and stock entries are ignored', () => {
  const valid = {
    id: 'a1b2c3d4',
    name: 'Hall',
    type: 'AA',
    quantity: 2,
    lifeMonths: null,
    replacedOn: '2026-01-01',
    history: ['2025-01-01', 'nope', '2027-01-01'],
    taken: 0,
    model: '',
  };
  const entries = parseRegistry(
    JSON.stringify([
      valid,
      { ...valid },
      { ...valid, id: 'zz' },
      { ...valid, id: 'b1b2c3d4', quantity: 0 },
    ]),
  );
  assert.equal(entries.length, 1, 'duplicate, bad id and bad quantity dropped');
  assert.deepEqual(entries[0].history, ['2025-01-01'], 'only days before the replacement');
  assert.deepEqual(parseRegistry('not json'), []);
  assert.deepEqual(parseStock('{"aa":3,"CR2032":-1,"9V":1.5}'), { AA: 3 });
  assert.deepEqual(parseStock(null), {});
});

test('library: compact matching, exact model first, single answer only', () => {
  assert.equal(compact('LUMI / Aqara'), 'lumiaqara');
  const exact = lookupModel('', 'WSDCGQ11LM');
  assert.ok(exact.total >= 1);
  assert.ok(exact.matches.every((match) => match.type === 'CR2032'));
  assert.deepEqual(singleBattery(exact.matches), { type: 'CR2032', quantity: 1 });
  const many = lookupModel('IKEA', '');
  assert.ok(many.total > 10 && many.matches.length === 10);
  assert.equal(singleBattery(many.matches), null);
  assert.deepEqual(lookupModel('', ''), { matches: [], total: 0 });
  const labels = lookupModel('IKEA', 'STYRBAR').matches.map((match) => match.label);
  assert.equal(new Set(labels).size, labels.length, 'no line printed twice');
});

test('library: models whose battery is not a type to buy', () => {
  const rows = [
    {
      manufacturer: 'Acme',
      model: 'Box',
      modelId: '',
      type: 'MANUAL',
      quantity: 1,
      keys: { manufacturer: 'acme', model: 'box', modelId: '' },
    },
  ];
  assert.deepEqual(singleBattery(lookupModel('acme', 'box', rows).matches), {
    type: 'MANUAL',
    quantity: 1,
  });
  assert.equal(resolveBattery({ battery_type: 'AA' }).type, 'AA');
});
