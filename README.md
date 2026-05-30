# Mythic GME 2nd Edition for Obsidian

An [Obsidian](https://obsidian.md) plugin for playing solo RPGs with [Mythic Game Master Emulator 2nd Edition](https://www.wordmillgames.com/mythic-game-master-emulator.html).

## Features

- **Oracle** — Fate Chart (d100) and Fate Check (2d10) with all 9 Odds × 9 Chaos Factor combinations
- **Random Events** — Full event generator with Event Focus Table and Meaning Tables (Actions, Descriptions, Elements)
- **Scene Testing** — Expected scene test, Interrupt/Altered scene detection, Scene Adjustment Table
- **Lists** — Thread and Character lists with section-based random extraction (up to 25 entries each)
- **Chaos Factor** — Tracks CF from 1 to 9, persisted across sessions
- Automatic Random Event detection on doubles (Fate Chart and Fate Check)
- **Roll logging** — Write results to any Obsidian note (narrative or full log level)
- **Solo TTRPG Notation integration** — Logs results using the `ttrpg` code block format when [Solo TTRPG Notation](https://github.com/J3tr0/obsidian-solo-ttrpg-notation) is installed
- Italian UI

## Installation

### Via BRAT (recommended)

1. Install the [BRAT plugin](https://github.com/TfTHacker/obsidian42-brat) from the Obsidian community plugins
2. Open BRAT settings → **Add Beta Plugin**
3. Enter: `https://github.com/J3tr0/obsidian-mythic-gme`
4. Enable the plugin in Settings → Community Plugins

### Manual

1. Download `main.js`, `manifest.json`, and `styles.css` from the [latest release](https://github.com/J3tr0/obsidian-mythic-gme/releases/latest)
2. Copy them to your vault: `.obsidian/plugins/mythic-gme/`
3. Enable the plugin in Settings → Community Plugins

## Usage

Click the **M** icon in the left ribbon to open the Mythic GME panel.

### Oracle tab
Set the **Chaos Factor** with the − / + buttons, select the **Odds**, and press **Tira** to roll. The result shows Yes/No with Exceptional variants and signals any Random Event triggered by doubles.

The oracle method (Fate Chart or Fate Check) can be changed in **Settings → Mythic GME 2nd Edition**.

### Events tab
- **Genera Evento** — rolls Focus + Meaning in one step, pulling from your Thread/Character lists when relevant
- **Focus** — rolls the Event Focus Table alone
- **Significato** — rolls any Meaning Table (Actions, Descriptions, Elements)

### Scene tab
Test the expected scene against the current CF. Altered and Interrupted scenes are flagged with suggestions. Use the Adjustment Table for altered scenes.

### Lists tab
Add Threads (objectives) and Characters (NPCs). Use the **Filo** / **Personaggio** buttons to extract a random entry using the section-based dice mechanic from the book (d10 for 1–5 entries, scaling up to d10+d10 for 21–25).

## Roll Logging

Enable logging in **Settings → Mythic GME 2nd Edition → Log risultati**.

- **Narrative level** — only meaningful rolls: Oracle answers, Random Events, Scene tests
- **Full level** — all rolls including NPC Behavior, Meaning tables, Scene Adjustment, list extractions
- **Target** — write to the active note or a fixed note path

## Solo TTRPG Notation Integration

If [Solo TTRPG Notation](https://github.com/J3tr0/obsidian-solo-ttrpg-notation) is installed, you can enable the integration in the plugin settings. When active, roll results are logged using the `ttrpg` code block format with proper notation symbols:

| Result | Symbol | Example |
|---|---|---|
| Oracle question | `?` | `? [50/50] (CF 5)` |
| Oracle answer | `->` | `-> Sì (tiro: 24)` |
| Scene test | `S` | `S Scena Attesa` |
| Mechanics / roll | `d:` | `d: Focus: Azione PNG (d100: 42)` |
| Narrative outcome | `=>` | `=> Usare male / Battaglia` |
| Metadata | `(...)` | `(d10: 8, CF: 5)` |

## Requirements

- Obsidian 1.5.0 or later
- No build step required — plain JavaScript
- [Solo TTRPG Notation](https://github.com/J3tr0/obsidian-solo-ttrpg-notation) (optional, for notation integration)

## License

[MIT](LICENSE)
