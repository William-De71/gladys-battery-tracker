// -----------------------------------------------------------------------------
// What the integration keeps in /data/state.json, the only writable folder of
// the container (not in the Gladys backups: nothing here is lost for good):
//   - `levels`  the last level a scene reported for each battery
//               (`{ level, day }`): many reports a day would be too many
//               writes into the Gladys configuration;
//   - `due`     the batteries whose "replacement due" event was fired, armed
//               again once they are no longer due (a replacement);
//   - `short`   the battery types whose "stock short" event was fired, armed
//               again once nothing is to buy.
// A restart therefore never fires the same event twice.
// -----------------------------------------------------------------------------

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { isIsoDay } from './dates.js';

const DEFAULT_PATH = '/data/state.json';

/**
 * @description The state of the integration.
 * @param {object} [options] - Options.
 * @param {string|null} [options.path] - The file (null: memory only).
 * @param {object} [options.logger] - Logger.
 * @returns {object} The state.
 */
function createState({ path = DEFAULT_PATH, logger } = {}) {
  let levels = {};
  let due = new Set();
  let short = new Set();

  if (path) {
    try {
      const stored = JSON.parse(readFileSync(path, 'utf8'));
      Object.entries(stored?.levels ?? {}).forEach(([id, report]) => {
        if (Number.isInteger(report?.level) && isIsoDay(report?.day)) {
          levels[id] = { level: report.level, day: report.day };
        }
      });
      due = new Set((stored?.due ?? []).filter((id) => typeof id === 'string'));
      short = new Set((stored?.short ?? []).filter((key) => typeof key === 'string'));
    } catch (err) {
      if (err.code !== 'ENOENT') {
        logger?.warn(`Battery Tracker: ${path} unreadable, starting afresh: ${err.message}`);
      }
    }
  }

  const save = () => {
    if (!path) return;
    try {
      mkdirSync(dirname(path), { recursive: true });
      writeFileSync(path, JSON.stringify({ levels, due: [...due], short: [...short] }));
    } catch (err) {
      logger?.warn(`Battery Tracker: unable to write ${path}: ${err.message}`);
    }
  };

  return {
    /** @param {string} id - Battery. @returns {{ level: number, day: string }|null} The last report. */
    level: (id) => levels[id] ?? null,
    /**
     * @param {string} id - Battery.
     * @param {{ level: number, day: string }|null} report - The report, null to forget it.
     */
    setLevel(id, report) {
      if (report === null) delete levels[id];
      else levels[id] = { level: report.level, day: report.day };
      save();
    },
    isDue: (id) => due.has(id),
    /** @param {string} id - Battery. @param {boolean} value - Whether its event was fired. */
    setDue(id, value) {
      if (value === due.has(id)) return;
      if (value) due.add(id);
      else due.delete(id);
      save();
    },
    isShort: (key) => short.has(key),
    /** @param {string} key - Type key. @param {boolean} value - Whether its event was fired. */
    setShort(key, value) {
      if (value === short.has(key)) return;
      if (value) short.add(key);
      else short.delete(key);
      save();
    },
    /**
     * @description Forget what belongs to removed batteries.
     * @param {string[]} ids - The batteries that still exist.
     */
    keepOnly(ids) {
      const keep = new Set(ids);
      const before = Object.keys(levels).length + due.size;
      levels = Object.fromEntries(Object.entries(levels).filter(([id]) => keep.has(id)));
      due = new Set([...due].filter((id) => keep.has(id)));
      if (Object.keys(levels).length + due.size !== before) save();
    },
  };
}

export { DEFAULT_PATH, createState };
