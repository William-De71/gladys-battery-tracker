// A started integration on a controllable clock, against the fake Gladys of
// the SDK, with the state kept in memory.

import { createFakeGladys } from '@gladysassistant/integration-sdk/testing';
import { createApp } from '../../src/app.js';

const silent = { info() {}, warn() {}, error() {}, debug() {} };

/**
 * @description Start the integration.
 * @param {object} [options] - Options.
 * @param {string} [options.at] - The instant (ISO, UTC).
 * @param {object} [options.config] - The configuration.
 * @param {object[]} [options.devices] - Devices already created.
 * @returns {Promise<object>} `{ gladys, app, clock }`.
 */
async function start({ at = '2026-11-21T10:00:00Z', config = {}, devices = [] } = {}) {
  const clock = { now: new Date(at) };
  const gladys = createFakeGladys({ config: { language: 'en', ...config }, devices });
  let n = 0;
  const app = createApp(gladys, {
    now: () => clock.now,
    timezone: 'Europe/Paris',
    statePath: null,
    sleep: async () => {},
    newId: () => `b000000${(n += 1)}`.slice(-8),
    tickMs: 0,
    logger: silent,
  });
  await gladys.connect();
  return { gladys, app, clock };
}

/**
 * @description The data of a successful ack.
 * @param {object} ack - The ack.
 * @returns {*} The message, content or outputs.
 */
function ok(ack) {
  if (!ack.success) throw new Error(`ack failed: ${ack.error}`);
  return ack.data?.message ?? ack.data?.content ?? ack.data?.outputs ?? ack.data;
}

/**
 * @description Create, on the fake Gladys, the device offered for a battery.
 * @param {object} gladys - The fake Gladys.
 * @param {string} id - The battery identifier.
 * @returns {Promise<object>} The device.
 */
async function createDevice(gladys, id) {
  const device = gladys.fake.discoveredDevices.find((d) =>
    d.external_id.endsWith(`:battery:${id}`),
  );
  if (!device) throw new Error(`no discovered device for ${id}`);
  await gladys.fake.deviceCreated(device);
  return device;
}

export { silent, start, ok, createDevice };
