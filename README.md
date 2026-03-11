🌐 **English | [日本語](README.ja.md)** 

# Coffee Roasting Simulation (Hand-Roasting Simulator)

## Overview
This project is a CLI engine for testing and simulating the physical temperature changes and chemical development within coffee beans during "hand roasting", ultimately calculating an SCA (Specialty Coffee Association) simplified cupping score.

Designed as a headless Node.js script, it allows you to execute custom heat application profiles to virtually test roasting successes and failures (like Baked or Scorched). The roasting results are output in two forms: a universally structured JSON format intended for integration with other systems (like automatic drip machine simulators), and a visually intuitive HTML graph.

## Features
*   **Physical Simulation**: A second-by-second heat transfer model that accounts for endothermic reactions during the drying phase and exothermic reactions during cracks.
*   **SCA Simplified Evaluation**: An evaluation engine that scores Aroma, Flavor, Aftertaste, Acidity, Body, Sweetness, and Clean Cup on a 100-point scale.
*   **Infinite Bean Data (Data-Driven)**: Comes pre-loaded with 5 base bean profiles (Ethiopia, Brazil, etc.) stored as JSON files in `data/green_beans/*.json`. You can easily add your own JSON files to simulate an unlimited variety of original beans.
*   **Defect Detection**: Automatically identifies roasting defects like "Scorched", "Baked", and "Underdeveloped", applying the appropriate penalties to the final cup score.
*   **Report Generation**:
    *   **Text Report** (`data/reports/report.txt`): A console-friendly execution log.
    *   **Data Integration JSON** (`data/roasted_beans/roasted_bean_*.json`): Universal roasting specification data containing arrays of 10-second interval temperature transitions (BT/ET/RoR).
    *   **Artisan-style Graph Report** (`data/graphs/report_graph_*.html`): Beautiful, intuitive telemetry & score graphs using Chart.js.
*   **i18n Support**: CLI outputs and Text Reports can be toggled between English and Japanese via `config.js`.

## Usage

A Node.js environment is required.

1.  Clone or download the project and open the directory.
2.  Run the simulation with the following command:
    ```bash
    node run_simulation.js
    ```
3.  After execution, 4 test roast patterns (Ethiopia Good, Mandheling Good, Brazil Failure, Colombia Failure) will be automatically run, and result files will be generated.

### Creating a Custom Roast Profile
You can simulate your own roast by editing the execution cases at the end of `run_simulation.js`.

```javascript
// Example: Creating a new profile
const customProfile = [
  { time: 0, power: 80 },    // 0s~: Start with High Heat (80)
  { time: 300, power: 60 },  // 5m~: Medium Heat (60)
  { time: 500, power: 45 },  // 8m20s~: Low Heat before 1st crack (45)
];

const { loadBean } = require('./beans');

// Execution: Specify the name of a JSON file in `data/green_beans/` (without the extension)
const sim = new RoastSimulation(loadBean('ethiopia')); 
const result = sim.run(customProfile, 660); // End roast at 11 minutes (660 seconds)

printReport(result, "Custom Roast Test");
```

## Documentation
For detailed specifications on how the physical roasting calculations work, and which temperatures affect which scores, please refer to the [REFERENCE_MANUAL.md](./REFERENCE_MANUAL.md).

## Phase 2: Coffee Extraction (Drip) Simulator
Added in v2 is the ability to load pre-roasted bean data (JSON) and simulate how the cupping score changes based on extraction recipes, such as actual water temperature and brew time.

### How to Use the Drip Simulator
1. First, run `run_simulation.js` to ensure pre-roasted JSON files (e.g., `roasted_bean_ethiopia_good_...json`) are generated in the data directory.
2. Run the following command:
    ```bash
    node run_drip.js
    ```
3. The script will test 4 extraction recipe patterns (Ideal, Under-extracted, Over-extracted, Strong) and output the resulting `EY (Extraction Yield)` and `TDS (Total Dissolved Solids)`, along with the adjusted flavor scores, to `data/reports/drip_report.txt` and the console.

By editing `run_drip.js` to lower the water temperature (`waterTemp`) or increase the brew time (`brewTime`), you can experience a simulation of how the coffee's flavor profile changes.

## Version
*   `v2.1.0` - Added i18n support for running reports and outputs in English/Japanese.
*   `v2.0.0` - Added Drip Simulation (EY/TDS calculation engine)
*   `v1.0.0` - Hand-roasting core logic, JSON export, HTML graph output
