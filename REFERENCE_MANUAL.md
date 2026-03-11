🌐 **English | [日本語](REFERENCE_MANUAL.ja.md)** 

# Hand-Roasting Coffee Simulation Reference Manual

This document is a manual explaining the characteristics of coffee beans, the physical model of roasting, and the calculation logic for the simplified cupping evaluation based on SCA (Specialty Coffee Association) standards within this simulation engine.

---

## 5. Changing Language Settings (i18n)
With the version update, you can now toggle the simulation output reports and command-line messages between **Japanese (ja) / English (en)**.

1. Open `config.js` located in the project root.
2. Change the `language: "ja"` part to `language: "en"` and save.
3. When you run `node run_simulation.js` or `node run_drip.js`, the report will be output referencing the configured language dictionary (`locales/en.json` or `locales/ja.json`).

*Note: The structure and property names (English characters) of the "data (JSON files)" such as roasted beans saved as simulation results will not be changed. Only the display labels in the reports will switch.*

---

## 1. Included Coffee Bean Types and Characteristics

The simulation bundles 5 representative types of beans, each with different roasting characteristics based on their origin.
These green bean data are managed in a data-driven way as individual JSON files in the `data/green_beans/` folder, and are dynamically instantiated (`loadBean()`) as a universal **`GreenCoffeeLot` class** that encompasses SCA standards and agricultural perspectives.
By simply adding a new JSON file to this directory, you can run simulations on unknown, original beans without touching the source code (intended for integration with outputs from external tools like farm/agricultural simulators).

### 1.1 `GreenCoffeeLot` Data Layer Structure
The data for each bean is separated into the following layers to allow the simulation engine to adapt to future expansions.
*   **`descriptor`**: Basic coffee information (ID, name, overview)
*   **`cultivation`**: `CultivationProfile` class. Agricultural information (variety, altitude band, region, etc.)
*   **`processing`**: `ProcessingProfile` class. Processing information (method, drying method)
*   **`measured`**: Quality observation values based on SCA standards. Stored as pairs of `value` and `source` (actual measurement or estimate). (Moisture content `moisture_percent`, water activity `water_activity`, density `density_g_l`, etc.)
*   **`hidden_state`**: Latent variables exclusively for physical simulation (thermal conductivity `thermal_mass_factor`, ideal target temperature `optimalEndTemp`, etc.)
*   **`evaluation`**: Base scores and temperature coefficients for SCA-compliant cupping evaluation calculations

### 1.2 Preset Bean Profile Overview
| Bean Type (ID) | Ideal Roast Level | Ideal End Temp | Characteristics / Simulation Properties |
| :--- | :--- | :--- | :--- |
| **Ethiopia** (`ethiopia`) | Light to Medium-Light | 205 ℃ (Right after 1st crack) | Characterized by floral aroma and fruity acidity.<br>・Very high initial potential for **Acidity** (95).<br>・Acidity is **lost quickly** as roasting progresses (DropRate: 1.2).<br>・Body is hard to increase even with dark roasting (GainRate: 0.8). |
| **Brazil** (`brazil`) | Medium | 215 ℃ (Between 1st & 2nd crack) | Nutty aroma and a well-balanced taste.<br>・All stats are average and **well-balanced**.<br>・Initial potential for Sweetness is slightly high (85). |
| **Colombia** (`colombia`) | Medium-Dark | 220 ℃ (Around start of 2nd crack) | Solid body and caramel-like sweetness.<br>・High base scores for **Body** and **Flavor** (85).<br>・Acidity is hard to lose even as roasting progresses (DropRate: 0.9).<br>・Body increases beautifully as heat is applied (GainRate: 1.1). |
| **Indonesia** (`indonesia`) | Dark (Mandheling) | 230 ℃ (Middle/Late 2nd crack) | Heavy body, spicy flavor, low acidity.<br>・Overwhelmingly high potential for **Body** (95).<br>・Acidity is barely evaluated in a light roast state (DropRate: 1.5).<br>・**Body increases rapidly** as heat is applied (GainRate: 1.3). |
| **Guatemala** (`guatemala`) | Medium-Dark | 225 ℃ (Around 2nd crack) | Chocolate-like flavor and complex taste.<br>・Similar to Colombia, but with higher base Aroma (80) and Acidity (80).<br>・Change rates for each stat are standard (1.0). |

---

## 2. Physical Model of the Roasting Process

The roasting simulation is calculated at **1 second = 1 Tick**, modeling the increase in Bean Temperature (`BT`) due to heat transfer based on the input "Heat Power (`power`: 0-100)".

### 2.1 Basic Heat Transfer Formula
1.  **Calculating Environment Temperature (EnvTemp)**
    This is the air temperature above the stove where the hand roaster is shaken. It is assumed to reach a maximum of about 405℃ at maximum power (100). When the power is changed, EnvTemp approaches the target value with a delay.
2.  **Calculating RoR (Rate of Rise)**
    Calculates how many degrees the bean temperature will rise per second based on the difference between the current environment temperature and the bean temperature (Newton's law of cooling).
    `RoR = (EnvTemp - BT) * 0.005`

### 2.2 Roasting Phases and Chemical Reactions (Endothermic/Exothermic)
Depending on the temperature zone of the beans during roasting, corrections are applied to the RoR to account for internal chemical reactions.

*   **Drying Phase (100℃ - 150℃)**
    The phase where the moisture inside the bean evaporates. Because heat is taken away by the heat of vaporization, **the temperature rise slows down** (`RoR * 0.7`). If the heat is insufficient, significant time is lost here.
*   **Maillard Reaction (150℃ - 200℃)**
    An important phase where the beans change from yellow to brown, and aromatic compounds and sweetness are formed.
*   **First Crack (Around 200℃)**
    The point where the moisture inside the bean vaporizes and expands, causing the cell walls to burst and emit a "popping" sound. Right after this, there is a moment when the beans themselves release heat energy, temporarily **accelerating the temperature rise** (`RoR * 1.2`).
*   **Second Crack (Around 225℃)**
    As roasting progresses further, the bean structure is further destroyed and gas erupts, creating a "snapping" sound. This marks the entrance to a dark roast.

---

## 3. SCA Simplified Cupping Evaluation Model and Scoring Logic

From the data at the end of roasting (final temperature, roasting time, event achievement status), 7 items (100 points maximum each) and an overall evaluation are calculated according to SCA standards.

### 3.1 Mechanism of Each Scoring Item

1.  **Aroma**
    *   **Peak Temp:** Around 215℃ (between 1st and 2nd crack)
    *   **Calculation:** Extremely low if underdeveloped (under 150℃), and rises sharply towards 215℃. Decreases if it starts burning beyond that.
2.  **Flavor**
    *   **Mechanism:** Evaluated by how close it is to the "Optimal End Temp" where the bean best displays its uniqueness.
    *   **Calculation:** `Base Flavor Score - (Difference between final temp and ideal temp * 1.2)`
3.  **Acidity**
    *   **Peak Temp:** 200℃ (start of 1st crack)
    *   **Calculation:** Peaks at 1st crack, and decreases according to the bean's specific decrease rate (`DropRate`) as the bean's temperature rises from there.
    *   *Note:* Creates a difference between beans with a high base that decrease easily like Ethiopia, and beans that originally have no acidity.
4.  **Body / Mouthfeel**
    *   **Peak Temp:** 225℃ and above (2nd crack to dark roast)
    *   **Calculation:** From 190℃ onwards, the score grows according to the bean's increase rate (`GainRate`) as roasting progresses.
5.  **Sweetness**
    *   **Peak Temp:** 210℃ (Middle of the development phase)
    *   **Calculation:** Calculated based on how close it is to 210℃, where caramelization occurs most balancedly.
6.  **Clean Cup & Aftertaste**
    *   **Mechanism:** Points are heavily deducted from these two items only when roasting "defects" occur (initial value is 100).

### 3.2 Roasting Defect Detection

In the simulation, improper heat control leads to the following 3 alert states.

| Alert | Trigger Condition | Penalty | Impact on Taste |
| :--- | :--- | :--- | :--- |
| **⚠️ Underdeveloped** | The state where **195℃** is not reached by the end of roasting. | Clean Cup -30<br>Aftertaste -20 | The inside of the bean is not cooked through, leaving a grassy astringency or unpleasant sourness. Low evaluation across the board. |
| **🥱 Baked** | The state where total roasting time exceeds **16 minutes (960 seconds)**. | Aftertaste -15<br>Flavor & Acidity -10 | Heat was too low and roasting took too long, causing flavors like aroma and acidity to volatilize and disappear, resulting in a dull taste. |
| **🔥 Scorched** | The state where the bean's Rate of Rise (RoR) exceeds **1.5℃/sec**. (Too rapid temperature rise) | Clean Cup -40<br>Aftertaste -30<br>Aroma & Flavor -20 | Heat was too strong, resulting in only the surface being burned. Severe burnt taste and a lingering unpleasant aftertaste destroy the evaluation. |

---

## 4. How to Write a Test Profile

You can test various roasts by defining your own heat profiles in the CLI script (`run_simulation.js`).

```javascript
// Profile Example: "Switching heat over time"
const customProfile = [
  { time: 0, power: 80 },    // 0s~: Start with High Heat (80)
  { time: 300, power: 60 },  // 300s(5m)~: Drop to Medium Heat (60)
  { time: 500, power: 45 },  // 500s(8m20s)~: Drop to Low Heat before 1st crack (45)
];

const { loadBean } = require('./beans');

// Execution: (Generate bean instance from JSON, end seconds)
const sim = new RoastSimulation(loadBean('ethiopia')); // Load Ethiopia bean JSON
const result = sim.run(customProfile, 660); // Remove from stove at 11 minutes (660 seconds)

// Pass to output function
printReport(result, "CustomTest_Ethiopia_11m");
```

By modifying this file and running `node run_simulation.js` on the command line, reports for your new test patterns will be appended to `data/reports/report.txt`.
Additionally, the output roasted bean data is generated as a JSON in `data/roasted_beans/`, and the roasting graph is generated as HTML in `data/graphs/`.
