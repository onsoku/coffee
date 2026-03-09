/**
 * コーヒー焙煎の物理シミュレーションとSCA簡易評価ロジック
 */

const { beanTypes } = require('./beans');

class RoastSimulation {
  constructor(beanId) {
    if (!beanTypes[beanId]) {
      throw new Error(`Unknown bean type: ${beanId}`);
    }
    this.bean = beanTypes[beanId];
    
    // シミュレーションの状態 (初期値: 室温25度)
    this.bt = 25; // Bean Temperature (豆温度)
    this.envTemp = 25; // Environment Temperature (網周辺の温度)
    this.time = 0; // 経過秒数
    
    // 記録用
    this.history = [];
    this.events = {
      dryEnd: null,   // 水分抜け (~150C)
      firstCrack: null, // 1ハゼ開始 (~200C)
      secondCrack: null // 2ハゼ開始 (~225C)
    };
    
    // 欠点判定フラグ
    this.defects = {
      baked: false,   // ベイクド（温度上昇の停滞）
      scorched: false, // スコーチ（焦げ、急激すぎる温度上昇）
      underdeveloped: false // 未発達（1ハゼ前に終了など）
    };
  }

  /**
   * 1秒分のシミュレーションを進める
   * @param {number} heatPower 火力 (0-100)
   */
  tick(heatPower) {
    this.time++;

    // 1. 火力から環境温度への熱伝達
    // 最大火力(100)のとき、環境温度は最大400度程度まで上がると仮定 (コンロの火力設定)
    const targetEnvTemp = 25 + (Math.max(0, heatPower) * 3.8); // 100 -> ~405C
    
    // 環境温度は徐々に目標に近づく
    this.envTemp += (targetEnvTemp - this.envTemp) * 0.05;

    // 2. 環境温度から豆への熱伝達
    let ror = (this.envTemp - this.bt) * 0.005; // 熱移動係数を上げる

    // 3. フェーズごとの吸熱・発熱反応の調整
    if (this.bt > 100 && this.bt < 150) {
      // 乾燥フェーズ：水分の蒸発に熱が奪われる (吸熱)
      ror *= 0.7;
    } else if (this.bt >= 200 && this.bt < 210) {
      // 1ハゼ：豆自体が発熱エネルギーを放出するタイミングがある
      ror *= 1.2;
    }

    this.bt += ror;

    // 4. イベントの記録と欠点の判定
    if (this.bt >= 150 && !this.events.dryEnd) this.events.dryEnd = this.time;
    if (this.bt >= 200 && !this.events.firstCrack) this.events.firstCrack = this.time;
    if (this.bt >= 225 && !this.events.secondCrack) this.events.secondCrack = this.time;

    // - ベイクド: 今回は簡易的に最終評価部分で全体時間のみで判定する
    // 本来はRoR推移を見るが、1秒ごとのTickで判定するとノイズが出やすいため

    // - スコーチ: 温度が急上昇しすぎ（1秒間に1.5度以上上がるなど）
    if (ror > 1.5 && this.bt > 100) {
      this.defects.scorched = true;
    }

    // 履歴保存 (10秒に1回または重要イベント時)
    if (this.time % 10 === 0) {
      this.history.push({
        time: this.time,
        bt: parseFloat(this.bt.toFixed(1)),
        envTemp: parseFloat(this.envTemp.toFixed(1)),
        ror: parseFloat(ror.toFixed(2)),
        heatPower
      });
    }
  }

  /**
   * シミュレーションを一括で実行する
   * @param {Array} heatProfile [{ time: 0, power: 80 }, { time: 300, power: 60 }]
   * @param {number} endTime 焙煎終了秒数
   */
  run(heatProfile, endTime) {
    let currentPower = 0;
    let profileIndex = 0;

    for (let t = 0; t <= endTime; t++) {
      // プロファイルの時間が来たら火力を更新
      if (profileIndex < heatProfile.length && heatProfile[profileIndex].time === t) {
        currentPower = heatProfile[profileIndex].power;
        profileIndex++;
      }
      this.tick(currentPower);
    }
    
    // 未発達の判定
    if (this.bt < 195) {
      this.defects.underdeveloped = true;
    }
    
    return this.evaluate();
  }

  /**
   * 最終的な状態からSCA簡易評価スコアを算出する
   */
  evaluate() {
    const finalTemp = this.bt;
    const base = this.bean.baseScores;
    const coeff = this.bean.tempCoefficients;

    let scores = {
      aroma: 0,
      flavor: 0,
      aftertaste: 80, // 初期値
      acidity: 0,
      body: 0,
      sweetness: 0,
      cleanCup: 100, // 初期値
      overall: 0
    };

    // 1. 香り (Aroma): 1ハゼ直後(200~210)がピーク、その後減少
    if (finalTemp < 150) scores.aroma = 30;
    else if (finalTemp < 200) scores.aroma = 60 + (finalTemp - 150); // 徐々に増える
    else if (finalTemp < 215) scores.aroma = base.aroma + 5; // ピーク
    else scores.aroma = Math.max(50, base.aroma - (finalTemp - 215) * 1.5); // 焦げると落ちる

    // 2. 風味 (Flavor): 豆ごとの理想温度との差分ペナルティ
    const tempDiff = Math.abs(finalTemp - this.bean.optimalEndTemp);
    scores.flavor = Math.max(50, base.flavor - (tempDiff * 1.2));

    // 3. 酸味 (Acidity): 1ハゼ(200)で最大、その後焙煎が進むにつれ減少
    if (finalTemp < 190) scores.acidity = 40; // 未発達の酸（不快）
    else {
      // 200度をピークに下がるモデル
      const rawAcidity = 100 - Math.max(0, finalTemp - 190) * coeff.acidityDropRate;
      // 豆のポテンシャル(base)でキャップまたはスケーリング
      scores.acidity = Math.max(40, Math.min(base.acidity, rawAcidity));
    }

    // 4. ボディ (Body): 2ハゼ(225)に向かって増加
    if (finalTemp < 190) scores.body = 40;
    else {
      const rawBody = 40 + (finalTemp - 190) * coeff.bodyGainRate * 1.5;
      scores.body = Math.max(40, Math.min(base.body, rawBody));
    }

    // 5. 甘さ (Sweetness): デベロップメントフェーズ(210前後)でピーク
    const sweetPeakDist = Math.abs(finalTemp - 210);
    scores.sweetness = Math.max(50, base.sweetness - (sweetPeakDist * 1.0));

    // デフェクト(欠点)による Clean Cup と Aftertaste の減点
    // 焙煎時間が長すぎるとベイクド判定（今回は大雑把に16分=960秒以上かかっている場合）
    if (this.time > 960) {
      this.defects.baked = true;
      scores.aftertaste -= 15; // 平凡でつまらない後味
      scores.flavor -= 10;
      scores.acidity -= 10; // 酸味が飛ぶ
    }
    
    // 未発達の判定 (1ハゼ(200C)すら行かずに終了、または温度が低すぎる場合)
    if (finalTemp < 195) {
      this.defects.underdeveloped = true;
    }

    if (this.defects.underdeveloped) {
      scores.cleanCup -= 30;
      scores.aftertaste -= 20; // 渋み
    }
    if (this.defects.scorched) {
      scores.cleanCup -= 40; // 焦げ味
      scores.aftertaste -= 30; // いつまでも焦げ感が残る
      scores.aroma -= 20;
      scores.flavor -= 20;
    }

    // スコアの正規化 (0-100) と小数点丸め
    for (let key in scores) {
      if (key !== 'overall') {
        scores[key] = Math.max(0, Math.min(100, Math.round(scores[key])));
      }
    }

    // 7. Overall (総合): 
    const sum = scores.aroma + scores.flavor + scores.aftertaste + 
                scores.acidity + scores.body + scores.sweetness + scores.cleanCup;
    scores.overall = Math.round(sum / 7);

    return {
      bean: this.bean.name,
      totalTimeSec: this.time,
      finalTemp: parseFloat(finalTemp.toFixed(1)),
      events: this.events,
      defects: this.defects,
      scores: scores,
      history: this.history
    };
  }
}

module.exports = { RoastSimulation };
