# CLAUDE.md

Project rules for coding assistants (Claude Code reads this file) and for human
contributors.

## What this is

A Gladys Assistant **external integration** that keeps track of the batteries
of the house, in the spirit of the Home Assistant integration Battery Notes: a
Node.js service (Node 22+, ESM, no build step) that runs in its own sandboxed
Docker container and talks to Gladys through
[`@gladysassistant/integration-sdk`](https://github.com/GladysAssistant/integration-sdk-js),
its only runtime dependency. A device integration (`type: "device"`): battery
records declared with the Configuration screen buttons, one device per record,
spare stock and shopping list, scene triggers and actions, dashboard widgets.
Transport: local, and no network call at all.

An external integration cannot read the devices of other integrations: the
real level of a sensor reaches it only through the `report_level` scene
action. Without it, the level is estimated from the age.

## Commands

```bash
npm install
npm test                                  # node --test, never touches the network
node --test test/app.test.js              # one file
DEBUG=gladys-integration-sdk npm test     # with the SDK debug logs
npm run lint                              # ESLint
npm run format:check                      # Prettier, as the CI runs it
npm run format                            # Prettier, fix in place
npx github:GladysAssistant/integration-store . --skip-image-check   # store checks
scripts/build-cover.sh                    # cover.jpg from docs/assets/cover.svg
docs/illustrations/render.sh              # docs/assets/widgets.<lang>.png
node scripts/update-library.mjs           # refresh src/data/library.json (network)
node .github/scripts/release.mjs next     # the version the next release would get
```

## Architecture

```
index.js                SDK wiring only (new GladysIntegration + createApp)
src/app.js              every handler, registered before connect(); clock (30 s)
src/registry.js         battery records + stock, stored with setConfig (keys
                        `batteries`, `battery_stock`), forms checked, replace
                        and undo, one change at a time
src/batteries.js        pure computations: life (set / learned / default),
                        level (reported < 14 days, else estimate), urgency,
                        shopping list, replacement rise (25 points)
src/library.js          device library lookup (src/data/library.json, from
                        Battery Notes, MIT: src/data/LICENSE.battery-notes)
src/state.js            /data/state.json: last reported levels, fired flags
                        of replacement_due and stock_short
src/device.js           one device per record, its features and states
src/events.js           scene trigger data, get_report texts
src/widgets.js          batteries, battery and shopping widgets
src/config.js           configuration, language guessed from the timezone
src/dates.js, time.js   days as YYYY-MM-DD, the timezone of Gladys (TZ)
src/i18n.js             runtime texts, en / fr / de / es
gladys-assistant-integration.json   manifest
docs/{en,fr,de,es}.md   user documentation, re-hosted by the store
docs/illustrations/     generated widget images (render.sh, gen.mjs, render.js)
.github/scripts/release.mjs         version, changelog, bump (tested in test/)
```

## Rules

- **Keys are forever**: every key users store — `config_schema` keys and
  types, the select values, the Configuration screen buttons and their
  fields, widget keys and settings, scene triggers (fields, options,
  variables), scene actions (fields, outputs), the internal configuration
  keys (`batteries`, `battery_stock`, `last_language`), the external ids
  (`battery:<8 hex>`) and the device features (key, category, type, unit,
  min, max: Gladys compares them on "Update"). `test/structure.test.js`
  compares them to `test/fixtures/manifest.baseline.json` (0.1.0): never
  update the baseline to make a test pass without a documented migration.
- **Records live in the Gladys configuration** (`setConfig`), so in its
  backups; `/data` only holds what can be lost (last reported levels, fired
  flags). A change is applied in memory once Gladys saved it.
- **Scene events**: `replacement_due` once per battery until it is no longer
  due, `stock_short` once per type until nothing is to buy, both waiting for
  the event hour; `battery_replaced` only for a replacement from the device
  button, a widget or the configuration. A scene ACTION never fires
  `battery_replaced`. Flat scalar data, declared keys only.
- **`report_level`** takes a string field: only string fields get the scene
  variables (`{{…}}`) substituted by the core. `parseLevel` reads it.
- **Widget forms**: labels are multi-language objects, option labels 40
  characters at most (`optionLabel`); a button with a form needs Gladys 5.2.0
  (the manifest asks 5.3.0).
- **No network**: the library is shipped in the image, refreshed by hand with
  `scripts/update-library.mjs` (keep `src/data/LICENSE.battery-notes` and the
  NOTICE).
- **The container rootfs is read-only.** Write only under `/data`.
- **Four languages.** Every user-facing text (manifest, runtime messages in
  `src/i18n.js`, `docs/*.md`, README) exists in English, French, German and
  Spanish (German: "Sie"). `test/i18n.test.js` checks it.
- **Widget images.** After any change to the content of a widget, run
  `docs/illustrations/render.sh` again and look at the four PNG files.
- **Versions belong to the Release workflow**: never edit `version` in
  `package.json`, the lockfile or the manifest, nor the `docker_image` tag.
  The version stays below 1.0.0 until the maintainer runs the Release workflow
  with `release-as: 1.0.0`.
- **Changelog.** Never edit CHANGELOG.md by hand, it is generated at the
  release. Write the PR title as the line the user will read.
- **Commits and PR titles** follow Conventional Commits, in English: `feat` ->
  minor, `fix` / `perf` -> patch, `!` or `BREAKING CHANGE:` -> major (minor
  below 1.0.0); `docs`, `chore`, `ci`, `test`, `style`, `refactor`, `build`
  release nothing.
- **Manifest.** Texts are objects `{ "en", "fr", "de", "es" }`; the catalog
  `description` holds 10 to 100 characters per language; the file stays under
  100 KB. Transport: `["local"]`.
- **Forum drafts** (`.github/forum-*.md`) are never committed.
- **Style.** Prettier formats, ESLint catches mistakes. Comments explain why,
  in English. Tests never touch the network (the fake Gladys of the SDK).
