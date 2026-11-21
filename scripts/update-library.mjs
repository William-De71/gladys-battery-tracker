#!/usr/bin/env node
// -----------------------------------------------------------------------------
// Refresh src/data/library.json, the device library used to suggest the
// battery type and count of a model, from the library of the Home Assistant
// integration Battery Notes (MIT, https://github.com/andrew-codechimp/HA-Battery-Notes).
//
// Run by hand (`node scripts/update-library.mjs`), never at runtime: the
// integration calls no network service. Keeps what the lookup needs, in a
// compact form: [manufacturer, model, model_id, battery_type, quantity].
// -----------------------------------------------------------------------------

import { writeFileSync } from 'node:fs';

const SOURCE =
  'https://raw.githubusercontent.com/andrew-codechimp/HA-Battery-Notes/main/library/library.json';
const TARGET = new URL('../src/data/library.json', import.meta.url);

const response = await fetch(SOURCE);
if (!response.ok) {
  console.error(`Unable to download the library: HTTP ${response.status}`);
  process.exit(1);
}
const library = await response.json();
if (!Array.isArray(library.devices)) {
  console.error('Unexpected library format: no devices array');
  process.exit(1);
}

const clean = (value) => (typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : '');
const seen = new Set();
const devices = [];
for (const device of library.devices) {
  const manufacturer = clean(device.manufacturer);
  const model = clean(device.model);
  const type = clean(device.battery_type);
  if (!manufacturer || !model || !type) continue;
  const quantity = Number.isInteger(device.battery_quantity) ? device.battery_quantity : 1;
  const row = [manufacturer, model, clean(device.model_id), type, quantity];
  const key = row.join('|').toLowerCase();
  if (seen.has(key)) continue;
  seen.add(key);
  devices.push(row);
}
devices.sort((a, b) => a[0].localeCompare(b[0]) || a[1].localeCompare(b[1]));

const output = {
  source: 'https://github.com/andrew-codechimp/HA-Battery-Notes (library/library.json)',
  license: 'MIT, Copyright (c) 2023-2026 Andrew Jackson',
  version: library.version ?? null,
  fetched: new Date().toISOString().slice(0, 10),
  fields: ['manufacturer', 'model', 'model_id', 'battery_type', 'quantity'],
  devices,
};
writeFileSync(TARGET, `${JSON.stringify(output)}\n`);
console.log(`${devices.length} devices written to src/data/library.json`);
