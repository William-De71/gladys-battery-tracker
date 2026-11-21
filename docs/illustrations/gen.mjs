// Builds the widget contents of the illustrations with the integration's own
// code: node gen.mjs <repo> <out.json> (run by render.sh)
//
// The three widgets on a made-up house (fixed date, 21 November 2026): seven
// batteries, one past its end, one with a low reported level, one ending
// soon, a small stock. Every name and number is made up; the contents around
// them come from src/batteries.js and src/widgets.js.
import { readFileSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

const [repo, out] = process.argv.slice(2);
const load = (path) => import(pathToFileURL(`${repo}/${path}`).href);
const { buildBatteriesWidget, buildBatteryWidget, buildShoppingWidget } =
  await load('src/widgets.js');
const { statusOf, shoppingList } = await load('src/batteries.js');
const { normalizeConfig } = await load('src/config.js');
const { LANGUAGES } = await load('src/i18n.js');
const manifest = JSON.parse(readFileSync(`${repo}/gladys-assistant-integration.json`, 'utf8'));

const TODAY = '2026-11-21';
const NOW = Date.parse('2026-11-21T18:00:00Z');
const config = normalizeConfig({});

// [names per language], type, quantity, life (months), replaced on, history, report
const HOUSE = [
  [
    ['Hall motion sensor', 'Détecteur entrée', 'Bewegungsmelder Flur', 'Sensor de la entrada'],
    'CR2450',
    1,
    null,
    '2025-10-02',
    ['2024-10-20'],
    null,
  ],
  [
    ['Living room sensor', 'Capteur salon', 'Sensor Wohnzimmer', 'Sensor del salón'],
    'CR2032',
    1,
    18,
    '2025-08-10',
    [],
    { level: 9, day: '2026-11-21' },
  ],
  [
    ['Smoke detector', 'Détecteur de fumée', 'Rauchmelder', 'Detector de humo'],
    '9V',
    1,
    12,
    '2025-12-01',
    [],
    null,
  ],
  [
    ['Front door lock', 'Serrure porte', 'Türschloss', 'Cerradura'],
    'AA',
    4,
    10,
    '2026-04-12',
    [],
    { level: 72, day: '2026-11-20' },
  ],
  [
    ['TV remote', 'Télécommande TV', 'TV-Fernbedienung', 'Mando de la TV'],
    'AAA',
    2,
    24,
    '2025-06-01',
    [],
    null,
  ],
  [
    ['Kitchen clock', 'Horloge cuisine', 'Küchenuhr', 'Reloj de cocina'],
    'AA',
    1,
    18,
    '2026-02-14',
    [],
    null,
  ],
  [
    [
      'Bedroom thermometer',
      'Thermomètre chambre',
      'Thermometer Schlafzimmer',
      'Termómetro dormitorio',
    ],
    'CR2032',
    1,
    24,
    '2026-09-30',
    [],
    null,
  ],
];
const STOCK = { AA: 6, AAA: 0, CR2032: 1 };

const statuses = (language) =>
  HOUSE.map(([names, type, quantity, lifeMonths, replacedOn, history, report], index) =>
    statusOf(
      {
        id: `a000000${index + 1}`,
        name: names[LANGUAGES.indexOf(language)],
        type,
        quantity,
        lifeMonths,
        replacedOn,
        history,
        taken: 0,
        model: '',
      },
      TODAY,
      config,
      report,
    ),
  );

const contents = {};
for (const language of LANGUAGES) {
  const list = statuses(language);
  const shopping = shoppingList(list, STOCK, config.horizonDays);
  contents[language] = {
    batteries: buildBatteriesWidget({
      statuses: list,
      shopping,
      settings: {},
      language,
      ttl: 3600,
    }),
    battery: buildBatteryWidget({
      status: list[3],
      chosen: true,
      stock: STOCK.AA,
      language,
      ttl: 3600,
    }),
    shopping: buildShoppingWidget({
      shopping,
      statuses: list,
      horizonDays: config.horizonDays,
      language,
      ttl: 3600,
    }),
  };
}
const widgets = Object.fromEntries(
  manifest.widgets.map((w) => [w.key, { icon: w.icon, label: w.label }]),
);
writeFileSync(out, JSON.stringify({ now: NOW, widgets, contents }));
