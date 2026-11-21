// -----------------------------------------------------------------------------
// Entry point of the Battery Tracker external integration.
//
// Keeps track of the batteries of the house (type, count, replacements,
// estimated end, spare stock), in the spirit of the Home Assistant
// integration Battery Notes:
//   - devices: one per battery record declared in the configuration (level,
//     days until and since the replacement, "Replaced" button, last
//     replacement), offered on the Discovery screen (see src/device.js);
//   - scene triggers: replacement due, batteries replaced, stock short;
//   - scene actions: report a level read on a sensor, record a replacement,
//     get a report to send;
//   - dashboard widgets: every battery, one battery, the shopping list.
//
// This file only wires the SDK client: the handlers are in src/app.js.
//
// Environment variables provided by the Gladys supervisor:
//   GLADYS_HOST_API_URL / GLADYS_INTEGRATION_TOKEN / GLADYS_INTEGRATION_SELECTOR
//   TZ (the timezone of Gladys: a day starts at its midnight)
// The SDK reads the first three: `new GladysIntegration()` is enough.
// -----------------------------------------------------------------------------

import { readFileSync } from 'node:fs';
import { GladysIntegration, logger } from '@gladysassistant/integration-sdk';
import { createApp } from './src/app.js';

const { version } = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'));

const gladys = new GladysIntegration();
createApp(gladys);

// --- Startup -----------------------------------------------------------------------
logger.info(`Starting the Battery Tracker integration ${version}...`);
gladys.connect().catch((err) => {
  logger.error('Initial connection failed', err);
  process.exit(1);
});
