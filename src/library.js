// -----------------------------------------------------------------------------
// The device library: the battery type and count of about 2,400 models
// (Zigbee, Z-Wave, Bluetooth sensors, remotes, locks…), taken from the
// library of the Home Assistant integration Battery Notes (MIT, see
// src/data/LICENSE.battery-notes). Refreshed by scripts/update-library.mjs,
// shipped in the image: a lookup never calls the network.
//
// A model is found by its manufacturer and its model (or model id), compared
// without case, spaces nor punctuation: "Aqara" finds "LUMI / Aqara", and
// "wsdcgq11lm" finds "WSDCGQ11LM".
// -----------------------------------------------------------------------------

import { readFileSync } from 'node:fs';

const MAX_RESULTS = 10;
let cache = null;

/**
 * @description Lower case letters and digits only.
 * @param {unknown} value - A text.
 * @returns {string} The compact text.
 * @example
 * compact('LUMI / Aqara'); // -> 'lumiaqara'
 */
const compact = (value) =>
  String(value ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[^a-z0-9]/g, '');

/**
 * @description The rows of the library, read once.
 * @returns {object[]} `{ manufacturer, model, modelId, type, quantity }`.
 */
function loadLibrary() {
  if (cache === null) {
    const raw = JSON.parse(readFileSync(new URL('./data/library.json', import.meta.url), 'utf8'));
    cache = raw.devices.map(([manufacturer, model, modelId, type, quantity]) => ({
      manufacturer,
      model,
      modelId,
      type,
      quantity,
      keys: {
        manufacturer: compact(manufacturer),
        model: compact(model),
        modelId: compact(modelId),
      },
    }));
  }
  return cache;
}

/**
 * @description The models of the library matching a manufacturer and a
 * model: an exact model (or model id) first, then the models containing the
 * typed text. Either text may be empty, not both.
 * @param {string} manufacturer - The typed manufacturer.
 * @param {string} model - The typed model or model id.
 * @param {object[]} [rows] - The library (tests).
 * @returns {{ matches: object[], total: number }} Up to 10 matches and the full count.
 * @example
 * lookupModel('Aqara', 'WSDCGQ11LM');
 */
function lookupModel(manufacturer, model, rows = loadLibrary()) {
  const maker = compact(manufacturer);
  const wanted = compact(model);
  if (!maker && !wanted) {
    return { matches: [], total: 0 };
  }
  const scored = [];
  for (const row of rows) {
    if (maker && !row.keys.manufacturer.includes(maker)) continue;
    let score = 0;
    if (!wanted) score = 1;
    else if (row.keys.model === wanted || row.keys.modelId === wanted) score = 3;
    else if (
      row.keys.model.includes(wanted) ||
      (row.keys.modelId && row.keys.modelId.includes(wanted))
    )
      score = 2;
    if (score > 0) scored.push({ row, score });
  }
  const best = scored.some((item) => item.score === 3) ? 3 : 0;
  const kept = scored.filter((item) => item.score >= best);
  kept.sort((a, b) => b.score - a.score || a.row.model.localeCompare(b.row.model));
  // Rows differing only by a model id already written in the model read
  // the same: one line each.
  const seen = new Set();
  const unique = [];
  for (const { row } of kept) {
    const label = `${row.manufacturer} ${row.model}${
      row.modelId && !row.model.includes(row.modelId) ? ` (${row.modelId})` : ''
    }`;
    const key = `${label}|${row.quantity}|${row.type}`;
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push({
      manufacturer: row.manufacturer,
      model: row.model,
      modelId: row.modelId,
      label,
      type: row.type,
      quantity: row.quantity,
    });
  }
  return { matches: unique.slice(0, MAX_RESULTS), total: unique.length };
}

/**
 * @description The battery of a model when the library gives only one
 * answer (same type and count for every match).
 * @param {object[]} matches - lookupModel().matches.
 * @returns {{ type: string, quantity: number }|null} The battery, or null.
 */
function singleBattery(matches) {
  if (matches.length === 0) {
    return null;
  }
  const [first] = matches;
  const same = matches.every(
    (match) => match.type === first.type && match.quantity === first.quantity,
  );
  return same ? { type: first.type, quantity: first.quantity } : null;
}

export { MAX_RESULTS, compact, loadLibrary, lookupModel, singleBattery };
