# Changelog

All notable changes to this integration are documented in this file. The format
follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and versions
follow [Semantic Versioning](https://semver.org/). This file is generated at
each release from the Conventional Commits: do not edit it by hand.

## [0.1.0] - 2026-11-21

### Added

- Battery records declared with configuration buttons (add, edit, remove, list): name, battery type and count, day of the last replacement, optional life; stored in the Gladys configuration, so in its backups.
- Device library of about 2,400 models (from Battery Notes, MIT) to fill the battery type and count from the manufacturer and the model, and a button to search it.
- One device per battery: level (reported or estimated from the age, a battery feature also seen by the native low battery warning of Gladys), days until and since the replacement, a "Batteries replaced" push button and the day of the last replacement.
- Life typed per battery, learned from its replacements, or a default life; reminder before the end and low reported level in the configuration.
- Spare stock per battery type, taken at each replacement, given back by "Undo the last replacement", and a shopping list over a horizon.
- Scene triggers: replacement due (once per battery, at the event hour), batteries replaced, batteries to buy (once per type).
- Scene actions: report a battery level read on a sensor (a rise of 25 points counts as a replacement), record a replacement, get the battery report as a text.
- Dashboard widgets: every battery with a "Batteries replaced" form, one battery, the batteries to buy with stock buttons.
- Local transport only; English, French, German and Spanish everywhere.

[0.1.0]: https://github.com/William-De71/gladys-battery-tracker/releases/tag/v0.1.0
