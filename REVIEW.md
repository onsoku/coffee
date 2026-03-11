# コーヒー手網焙煎シミュレータ レビューメモ

> **目的**: エンジニア間で改善ポイントを共有・検討するためのドキュメント
> **対象バージョン**: v2.1.0 (2026-03-11 時点)
> **前提**: 全体としてのアーキテクチャと方向性はOK。以下は次のイテレーションに向けた具体的な改善提案。

---

## 1. 物理モデル: 未使用パラメータの活用

### 現状の問題

豆プロファイル (`data/green_beans/*.json`) の `hidden_state` に定義されている以下のパラメータが、シミュレーション計算で使われていない。

| パラメータ | 定義場所 | 値の例 | 現在の利用状況 |
|---|---|---|---|
| `thermal_mass_factor` | `hidden_state` | Ethiopia: 1.0, Indonesia: 1.1 | **未使用** |
| `cell_wall_fragility` | `hidden_state` | Ethiopia: 1.1, Indonesia: 0.9 | `simulateStorageAging()` のみで使用 |
| `moisture_percent` | `measured` | Ethiopia: 11.2, Indonesia: 12.0 | **未使用** |
| `density_g_l` | `measured` | Ethiopia: 720, Indonesia: 660 | **未使用** |

### 該当コード

`simulation.js:51` の熱伝達計算:

```javascript
let ror = (this.envTemp - this.bt) * 0.005; // 熱移動係数を上げる
```

`0.005` がハードコードされた定数であり、豆ごとの物性の違いが反映されない。

### 改善案

#### A. `thermal_mass_factor` を熱伝達に反映

熱容量が大きい（密度が高い）豆ほど温度が上がりにくいという物理現象を再現する。

```javascript
// 現在
let ror = (this.envTemp - this.bt) * 0.005;

// 提案
const k = 0.005 / this.bean.hidden_state.thermal_mass_factor;
let ror = (this.envTemp - this.bt) * k;
```

**影響**: `thermal_mass_factor: 1.1` (Indonesia) は同じ火力でも温度が上がりにくくなり、深煎り向けの長い焙煎時間が自然に必要になる。

#### B. `moisture_percent` を乾燥フェーズに反映

現在、乾燥フェーズ (100-150°C) は一律 `ror *= 0.7` だが (`simulation.js:54-57`)、含水率が高い豆ほど乾燥に時間がかかるべき。

```javascript
// 現在
if (this.bt > 100 && this.bt < 150) {
  ror *= 0.7;
}

// 提案: 含水率に比例した吸熱係数
if (this.bt > 100 && this.bt < 150) {
  const moistureFactor = this.bean.measured.moisture_percent.value / 11.0; // 11%を基準
  ror *= (0.7 / moistureFactor);
}
```

**影響**: Indonesia (12.0%) は Ethiopia (11.2%) より乾燥フェーズが長くなり、ターニングポイントの時間差が再現される。

#### C. `cell_wall_fragility` を1ハゼの挙動に反映

細胞壁が脆い豆は1ハゼの発熱が激しい（エネルギー放出が大きい）。

```javascript
// 現在
} else if (this.bt >= 200 && this.bt < 210) {
  ror *= 1.2;
}

// 提案
} else if (this.bt >= 200 && this.bt < 210) {
  ror *= 1.0 + (0.2 * this.bean.hidden_state.cell_wall_fragility);
}
```

**影響**: `cell_wall_fragility: 1.1` (Ethiopia) は 1ハゼ時の温度上昇が `1.22` 倍になり、`0.9` (Indonesia) は `1.18` 倍に留まる。

#### D. `density_g_l` をスコーチ判定の閾値に反映

密度が低い豆は表面が焦げやすい。現在のスコーチ判定 (`simulation.js:73`) は `ror > 1.5` 固定。

```javascript
// 現在
if (ror > 1.5 && this.bt > 100) {
  this.defects.scorched = true;
}

// 提案: 密度700g/Lを基準に閾値を調整
const scorchThreshold = 1.5 * (this.bean.measured.density_g_l.value / 700);
if (ror > scorchThreshold && this.bt > 100) {
  this.defects.scorched = true;
}
```

**影響**: 低密度の Indonesia (660g/L) はスコーチ閾値が `1.41` に下がり焦げやすくなる。高密度の Ethiopia (720g/L) は `1.54` で少し余裕ができる。

### 優先度: **高**

データモデルは既に整っている。シミュレーションコアの数行を変更するだけで、豆ごとの焙煎体験の差が大きく広がる。投資対効果が最も高い改善。

---

## 2. スコアリングモデルの精緻化

### 2-1. Flavor のペナルティカーブ

**該当コード**: `simulation.js:141-142`

```javascript
const tempDiff = Math.abs(finalTemp - this.bean.hidden_state.optimalEndTemp);
scores.flavor = Math.max(50, base.flavor - (tempDiff * 1.2));
```

**問題**: 線形ペナルティ (`tempDiff * 1.2`) だと、最適温度から1°Cずれても10°Cずれてもペナルティの増え方が同じ。実際には最適温度付近は許容範囲があり、離れるほど急激に悪化する。

**提案**: 二次関数カーブに変更。

```javascript
const tempDiff = Math.abs(finalTemp - this.bean.hidden_state.optimalEndTemp);
scores.flavor = Math.max(50, base.flavor - (tempDiff * tempDiff * 0.12));
```

**比較** (base.flavor = 85 の場合):

| 偏差 | 現行 (線形) | 提案 (二次) |
|---:|---:|---:|
| ±1°C | 83.8 | 84.9 |
| ±3°C | 81.4 | 83.9 |
| ±5°C | 79.0 | 82.0 |
| ±10°C | 73.0 | 73.0 |
| ±15°C | 67.0 | 58.0 |

最適温度付近では寛容に、大きくずれると急激に悪化する。コーヒーの実際の味変化に近い。

### 2-2. Sweetness のピーク温度が豆によらず固定

**該当コード**: `simulation.js:161-162`

```javascript
const sweetPeakDist = Math.abs(finalTemp - 210);
scores.sweetness = Math.max(50, base.sweetness - (sweetPeakDist * 1.0));
```

**問題**: `210°C` がハードコードされている。浅煎り向きの Ethiopia (最適温度 205°C) と深煎り向きの Indonesia (最適温度 230°C) で同じ甘さのピーク温度を使うのは不自然。

**提案**: 豆の `optimalEndTemp` を基準にピーク温度を算出する。

```javascript
// 甘さのピーク = 最適温度の少し手前（キャラメル化ゾーン）
const sweetPeakTemp = this.bean.hidden_state.optimalEndTemp - 5;
const sweetPeakDist = Math.abs(finalTemp - sweetPeakTemp);
scores.sweetness = Math.max(50, base.sweetness - (sweetPeakDist * 1.0));
```

あるいは、`hidden_state` に `optimalSweetnessTemp` を明示的に追加する方法もある。データモデルの方針次第。

### 2-3. Overall の計算方法

**該当コード**: `simulation.js:203-205`

```javascript
const sum = scores.aroma + scores.flavor + scores.aftertaste +
  scores.acidity + scores.body + scores.sweetness + scores.cleanCup;
scores.overall = Math.round(sum / 7);
```

**問題**: 7属性の単純平均。SCA のカッピングフォームは実際には各項目 6-10 点のスケール（36-100点変換）であり、欠陥 (defect) による大幅減点が総合点に直結する。現行モデルでは Clean Cup が 60 点でも Overall が 75 点になることがある。

**提案**: 検討の選択肢を2つ示す。

- **案A**: 現行の単純平均を維持しつつ、`cleanCup` が閾値以下の場合に Overall を強制的に引き下げる

```javascript
scores.overall = Math.round(sum / 7);
if (scores.cleanCup < 70) {
  scores.overall = Math.min(scores.overall, scores.cleanCup);
}
```

- **案B**: 加重平均を導入する（flavor / cleanCup の比重を上げる）

どちらが良いかはシミュレータの目的による。教育ツールとしてはシンプルな案Aが分かりやすいか。

### 優先度: **中**

スコアリングはシミュレータの「出力品質」に直結するが、物理モデル (セクション1) が先に改善されないとスコアの入力自体が粗いまま。

---

## 3. 1ハゼの物理挙動

### 現状

**該当コード**: `simulation.js:57-60`

```javascript
} else if (this.bt >= 200 && this.bt < 210) {
  ror *= 1.2;
}
```

200-210°C の範囲で一律 `ror *= 1.2` を適用している。

### 問題

実際の1ハゼは以下の挙動を示す:

1. **RoR が一時的に急上昇する** (発熱反応)
2. **その直後に RoR が低下する** (エネルギー放出後の安定化)
3. この RoR のディップ (通称 "flick") が焙煎者にとって重要な判断材料

現行モデルでは 200-210°C の間ずっと一定の倍率がかかるため、フリック現象が再現されない。

### 提案

```javascript
} else if (this.bt >= 198 && this.bt < 205) {
  // 1ハゼ開始: 急激な発熱
  ror *= 1.3;
} else if (this.bt >= 205 && this.bt < 212) {
  // 1ハゼ後半: エネルギー放出後のRoR低下
  ror *= 0.9;
}
```

さらにリアルにするなら、1ハゼを「イベント」として扱い、発生時点から数秒間だけ発熱ブーストをかける方法もある。

```javascript
if (this.bt >= 200 && !this.events.firstCrack) {
  this.events.firstCrack = this.time;
}
if (this.events.firstCrack) {
  const elapsed = this.time - this.events.firstCrack;
  if (elapsed < 15) {
    ror *= 1.3; // 最初の15秒: 発熱ブースト
  } else if (elapsed < 45) {
    ror *= 0.9; // その後30秒: RoRディップ
  }
}
```

### 優先度: **中**

HTMLグラフでRoRカーブを見たときに「それっぽい」形になるかどうかに直結する。教育的な価値が高い改善。

---

## 4. ドリップシミュレーションの改善

### 4-1. 焙煎度と抽出効率の関係

**該当コード**: `drip_simulation.js:36`

```javascript
const baseExtrationPotential = 19 + (this.bean.finalTemperature - 210) * 0.08;
```

**問題**: 焙煎度の影響が温度差に対して `0.08` の線形係数のみ。深煎りでは細胞壁が崩壊して多孔質になるため、抽出効率が大きく上がる。現行の係数では 230°C (深煎り) でも `19 + 20 * 0.08 = 20.6%` と、わずかしか変わらない。

**提案**: 指数的な抽出効率の上昇を導入。

```javascript
const tempOver = Math.max(0, this.bean.finalTemperature - 200);
const baseExtrationPotential = 18 + tempOver * 0.06 + (tempOver * tempOver * 0.001);
```

**比較**:

| 焙煎終了温度 | 現行 | 提案 |
|---:|---:|---:|
| 205°C | 18.6% | 18.3% |
| 215°C | 19.4% | 18.9% |
| 230°C | 20.6% | 20.7% |
| 240°C | 21.4% | 22.0% |

深煎りでの差が適切に開く。

### 4-2. CleanCup の過抽出判定ロジックにバグの疑い

**該当コード**: `drip_simulation.js:87-95`

```javascript
if (ey > 22.0) {
  flavorProfile.push("Bitter", "Astringent");
  overallScore -= 10;
  alerts.push(t('alerts.over_extracted'));
} else {
  // ← EY <= 22.0 のとき（適正 or 未抽出のとき）に
  const overExt = ey - 22;  // ← 常に負の値
  resultScores.cleanCup -= (overExt * 8);  // ← cleanCup が加算される（意図と逆？）
  resultScores.aftertaste -= (overExt * 5); // ← aftertaste が加算される
}
```

`else` ブロック内で `overExt = ey - 22` は常に負になるため、`cleanCup -= 負の値` → cleanCup が**増加**する。これは意図した挙動か？

**もし意図していないなら**: `else` ブロック自体が不要か、または `ey > 20` のような中間ゾーンでの微調整として書き直すべき。

```javascript
if (ey > 22.0) {
  const overExt = ey - 22;
  resultScores.cleanCup -= (overExt * 8);
  resultScores.aftertaste -= (overExt * 5);
  flavorProfile.push("Bitter", "Astringent");
  overallScore -= 10;
  alerts.push(t('alerts.over_extracted'));
}
// else: 適正範囲なのでcleanCup/aftertasteは焙煎時のスコアをそのまま維持
```

### 4-3. `overallScore` 変数が最終スコアに反映されていない

**該当コード**: `drip_simulation.js:66, 71, 89`

```javascript
let overallScore = 0; // L66: 宣言
overallScore -= 10;   // L71: 未抽出時に減算
overallScore -= 10;   // L89: 過抽出時に減算
```

しかし、最終的な `resultScores.overall` の計算 (L110-112) では `overallScore` が使われていない。

```javascript
const sum = resultScores.aroma + resultScores.flavor + resultScores.aftertaste +
  resultScores.acidity + resultScores.body + resultScores.sweetness + resultScores.cleanCup;
resultScores.overall = Math.round(sum / 7);
// ← overallScore が加算されていない
```

**修正案**:

```javascript
resultScores.overall = Math.round(sum / 7) + overallScore;
```

### 優先度: **高** (4-2, 4-3 はバグの可能性があるため)

---

## 5. コード構造と保守性

### 5-1. レポート生成ロジックの分離

**現状**: `run_simulation.js` に `printReport()` (L29-120) と `generateHtmlReport()` (L125-272) の約240行が埋め込まれている。`run_drip.js` にも別の `printReport()` (L20-76) がある。

**問題**:
- 2つの `printReport` が別ファイルに重複して存在し、スコアバーの描画ロジックなどがコピペされている
- HTMLレポート生成のテンプレートがJSの文字列リテラルに直書きされている (約140行)
- シミュレーション実行スクリプトが「データ生成」と「表示」の2つの責務を持っている

**提案**: `report.js` モジュールに分離する。

```
report.js
  ├── formatTextReport(result, type)     // テキストレポート生成
  ├── formatHtmlReport(data, title)      // HTMLレポート生成
  └── exportRoastedBeanJson(result)      // JSON出力
```

これにより:
- `run_simulation.js` と `run_drip.js` はシミュレーション実行のみに集中
- レポートフォーマットの変更が1箇所で済む
- テストからもレポート生成を独立して検証できる

### 5-2. テストの不在

**現状**: ユニットテストが存在しない。

**影響**: セクション1で提案した物理モデルのパラメータ変更を入れる際、既存の出力が壊れていないことを確認する手段がない。

**提案**: 最低限のスナップショットテストから始める。

```javascript
// test/simulation.test.js
const { RoastSimulation } = require('../simulation');
const { loadBean } = require('../beans');

test('Ethiopia good roast produces expected score range', () => {
  const sim = new RoastSimulation(loadBean('ethiopia'));
  const result = sim.run([
    { time: 0, power: 80 },
    { time: 300, power: 60 },
    { time: 500, power: 50 }
  ], 690);

  expect(result.finalTemp).toBeGreaterThan(200);
  expect(result.finalTemp).toBeLessThan(215);
  expect(result.scores.overall).toBeGreaterThan(70);
  expect(result.defects.scorched).toBe(false);
  expect(result.defects.baked).toBe(false);
});

test('Full heat causes scorched defect', () => {
  const sim = new RoastSimulation(loadBean('brazil'));
  const result = sim.run([{ time: 0, power: 100 }], 420);

  expect(result.defects.scorched).toBe(true);
});
```

物理モデル変更前にテストを書いておけば、パラメータ調整時の安全ネットになる。

### 5-3. flavorProfile がハードコード

**該当コード**: `simulation.js:208`

```javascript
const flavorProfile = ["Aroma", "Flavor", "Body"];
```

コメントにも `// Mock Flavor Profile for now` とある。焙煎結果に基づいたフレーバータグの動的生成は将来課題として認識されているが、現状はモック。

**提案**: 最低限の改善として、スコアのトップ3を抽出するだけでも意味がある。

```javascript
const scoreEntries = Object.entries(scores)
  .filter(([k]) => k !== 'overall' && k !== 'cleanCup')
  .sort(([,a], [,b]) => b - a);
const flavorProfile = scoreEntries.slice(0, 3).map(([k]) => k);
```

### 優先度: **中〜低**

機能の正しさには直結しないが、セクション1-4の改善を入れる前にテスト基盤を整えておくのが望ましい。

---

## 6. 火力プロファイルの補間

### 現状

**該当コード**: `simulation.js:94-105`

```javascript
run(heatProfile, endTime) {
  let currentPower = 0;
  let profileIndex = 0;

  for (let t = 0; t <= endTime; t++) {
    if (profileIndex < heatProfile.length && heatProfile[profileIndex].time === t) {
      currentPower = heatProfile[profileIndex].power;
      profileIndex++;
    }
    this.tick(currentPower);
  }
```

火力はステップ関数で切り替わる（時刻が来たら即座に次の値になる）。

### 問題

実際の手網焙煎では、火力の調整は連続的。ステップ切り替えでは、300秒でいきなり power が 80→60 に落ちるため、RoR カーブに不自然な角が出る。

### 提案

線形補間を導入する。

```javascript
run(heatProfile, endTime) {
  for (let t = 0; t <= endTime; t++) {
    const currentPower = this._interpolatePower(heatProfile, t);
    this.tick(currentPower);
  }
}

_interpolatePower(profile, time) {
  if (profile.length === 0) return 0;
  if (time <= profile[0].time) return profile[0].power;
  if (time >= profile[profile.length - 1].time) return profile[profile.length - 1].power;

  for (let i = 0; i < profile.length - 1; i++) {
    if (time >= profile[i].time && time < profile[i + 1].time) {
      const ratio = (time - profile[i].time) / (profile[i + 1].time - profile[i].time);
      return profile[i].power + (profile[i + 1].power - profile[i].power) * ratio;
    }
  }
  return profile[profile.length - 1].power;
}
```

HTMLグラフ上のHeat Powerラインが滑らかになり、RoRカーブの急な角もなくなる。

### 優先度: **低**

見た目の改善が主。物理的な正確さへの影響は限定的。

---

## まとめ: 推奨する作業順序

| 順番 | セクション | 内容 | 理由 |
|:---:|:---:|---|---|
| 1 | 5-2 | テスト基盤の構築 | 以降の変更の安全ネット |
| 2 | 4-2, 4-3 | ドリップシミュレーションのバグ修正 | バグは早期に潰すべき |
| 3 | 1 | 未使用パラメータの物理モデル組み込み | 投資対効果が最も高い |
| 4 | 3 | 1ハゼの物理挙動改善 | セクション1と合わせて実施すると自然 |
| 5 | 2 | スコアリングモデルの精緻化 | 物理モデル改善後にチューニング |
| 6 | 5-1 | レポート生成の分離 | リファクタリング。機能追加の前に整理 |
| 7 | 6 | 火力プロファイルの補間 | nice-to-have |
| 8 | 5-3 | flavorProfile の動的生成 | nice-to-have |
