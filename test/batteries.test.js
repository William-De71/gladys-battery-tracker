// The computations of a battery: life (set, learned, default), level
// (reported or estimated), urgency, shopping list, replacement detection,
// and the day arithmetic under them.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeType,
  typeKey,
  learnedLife,
  lifeOf,
  statusOf,
  byUrgency,
  shoppingList,
  isReplacementRise,
  parseLevel,
  URGENCY,
} from '../src/batteries.js';
import { normalizeConfig } from '../src/config.js';
import { isIsoDay, daysBetween, addDays, parseTypedDay } from '../src/dates.js';

const config = normalizeConfig({});
const battery = (over = {}) => ({
  id: 'a1b2c3d4',
  name: 'Hall',
  type: 'CR2032',
  quantity: 1,
  lifeMonths: null,
  replacedOn: '2026-01-01',
  history: [],
  taken: 0,
  model: '',
  ...over,
});

test('days: validity, differences, additions, typed days', () => {
  assert.equal(isIsoDay('2026-02-28'), true);
  assert.equal(isIsoDay('2026-02-29'), false);
  assert.equal(isIsoDay('1989-12-31'), false, 'older than 1990 is a typo');
  assert.equal(daysBetween('2026-03-28', '2026-03-30'), 2, 'no DST effect');
  assert.equal(daysBetween('2026-01-31', '2026-01-01'), -30);
  assert.equal(addDays('2026-12-31', 1), '2027-01-01');
  assert.equal(parseTypedDay('3/9/2026'), '2026-09-03', 'day first');
  assert.equal(parseTypedDay('03.09.2026'), '2026-09-03');
  assert.equal(parseTypedDay('2026-9-3'), '2026-09-03');
  assert.equal(parseTypedDay('31/04/2026'), null);
  assert.equal(parseTypedDay('soon'), null);
});

test('types: short codes in capitals, compared without spaces nor dots', () => {
  assert.equal(normalizeType(' cr2032 '), 'CR2032');
  assert.equal(normalizeType('aa'), 'AA');
  assert.equal(normalizeType('Rechargeable Li-ion'), 'Rechargeable Li-ion');
  assert.equal(typeKey('CR 2032'), typeKey('cr2032'));
  assert.equal(typeKey('LR-44'), typeKey('LR44'));
});

test('life: set, else learned from the replacements (14 days or more), else default', () => {
  assert.deepEqual(lifeOf(battery({ lifeMonths: 24 }), config), { days: 731, source: 'set' });
  assert.deepEqual(lifeOf(battery(), config), { days: 365, source: 'default' });
  const learned = battery({
    history: ['2024-01-01', '2024-07-01', '2024-07-05', '2025-07-01'],
    replacedOn: '2026-01-01',
  });
  // Intervals 182, (4: ignored), 361, 184 -> the last three usable: 182, 361, 184.
  assert.equal(learnedLife(learned), 242);
  assert.deepEqual(lifeOf(learned, config), { days: 242, source: 'learned' });
  assert.equal(learnedLife(battery({ history: ['2025-12-25'] })), null, 'only a short interval');
});

test('status: estimate from the age, reported level when recent, urgency', () => {
  const fresh = statusOf(battery(), '2026-07-02', config);
  assert.equal(fresh.daysSince, 182);
  assert.equal(fresh.daysRemaining, 183);
  assert.equal(fresh.level, 50);
  assert.equal(fresh.levelSource, 'estimated');
  assert.equal(fresh.endDay, '2027-01-01');
  assert.equal(fresh.urgency, URGENCY.OK);

  const soon = statusOf(battery(), '2026-12-20', config);
  assert.equal(soon.urgency, URGENCY.SOON, '12 days left, reminder 14');
  assert.equal(soon.due, true);
  const late = statusOf(battery(), '2027-01-10', config);
  assert.equal(late.urgency, URGENCY.REPLACE);
  assert.equal(late.daysRemaining, -9);
  assert.equal(late.level, 0);

  const reported = statusOf(battery(), '2026-07-02', config, { level: 15, day: '2026-06-30' });
  assert.equal(reported.level, 15);
  assert.equal(reported.levelSource, 'reported');
  assert.equal(reported.reportDay, '2026-06-30');
  assert.equal(reported.urgency, URGENCY.REPLACE, 'low reported level');
  assert.equal(reported.reason, 'level');

  const stale = statusOf(battery(), '2026-07-02', config, { level: 15, day: '2026-06-01' });
  assert.equal(stale.levelSource, 'estimated', 'a report older than 14 days is ignored');
  assert.equal(stale.urgency, URGENCY.OK);
});

test('urgency order: replace (lowest level first), soon, ok, by days', () => {
  const day = '2026-12-25';
  const list = [
    statusOf(battery({ id: 'a', name: 'ok', replacedOn: '2026-12-01' }), day, config),
    statusOf(battery({ id: 'b', name: 'soon', replacedOn: '2026-01-01' }), day, config),
    statusOf(battery({ id: 'c', name: 'late', replacedOn: '2025-11-01' }), day, config),
    statusOf(battery({ id: 'd', name: 'low', replacedOn: '2026-12-01' }), day, config, {
      level: 5,
      day,
    }),
  ];
  assert.deepEqual(
    byUrgency(list).map((status) => status.entry.name),
    ['low', 'late', 'soon', 'ok'],
  );
});

test('shopping list: needed within the horizon minus the stock, by type', () => {
  const day = '2026-12-10';
  const statuses = [
    statusOf(battery({ id: 'a', quantity: 2, replacedOn: '2026-01-01' }), day, config),
    statusOf(battery({ id: 'b', type: 'cr 2032', replacedOn: '2026-12-01' }), day, config),
    statusOf(battery({ id: 'c', type: 'AAA', quantity: 3, replacedOn: '2025-12-20' }), day, config),
  ];
  const list = shoppingList(statuses, { CR2032: 1, '9V': 2 }, 30);
  assert.deepEqual(
    list.map(({ type, needed, stock, toBuy, installed }) => ({
      type,
      needed,
      stock,
      toBuy,
      installed,
    })),
    [
      { type: 'AAA', needed: 3, stock: 0, toBuy: 3, installed: 3 },
      { type: 'CR2032', needed: 2, stock: 1, toBuy: 1, installed: 3 },
      { type: '9V', needed: 0, stock: 2, toBuy: 0, installed: 0 },
    ],
  );
  assert.deepEqual(shoppingList([], {}, 30), []);
});

test('replacement rise and reported levels', () => {
  assert.equal(isReplacementRise({ level: 10 }, 100), true);
  assert.equal(isReplacementRise({ level: 60 }, 84), false, '24 points');
  assert.equal(isReplacementRise({ level: 60 }, 85), true, '25 points');
  assert.equal(isReplacementRise(null, 100), false, 'no previous report');
  assert.equal(parseLevel('64,5 %'), 65);
  assert.equal(parseLevel(' 100 '), 100);
  assert.equal(parseLevel(42.4), 42);
  assert.equal(parseLevel('101'), null);
  assert.equal(parseLevel('-3'), null);
  assert.equal(parseLevel('{{0.0.last_value}}'), null, 'a variable the scene did not resolve');
  assert.equal(parseLevel(''), null);
});
