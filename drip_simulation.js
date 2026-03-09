/**
 * コーヒーのドリップ（抽出）シミュレーション
 */

class DripSimulation {
  /**
   * @param {Object} roastedBean v1で生成された焙煎豆データのJSONオブジェクト
   */
  constructor(roastedBean) {
    if (!roastedBean || !roastedBean.cuppingScores) {
      throw new Error("Invalid RoastedBean data provided.");
    }
    this.bean = roastedBean;
    this.baseScores = roastedBean.cuppingScores;
  }

  /**
   * 抽出レシピに基づいてコーヒーをシミュレートする
   * @param {Object} recipe 
   * {
   *   dose: 15, // 粉の量(g)
   *   waterWeight: 250, // 湯量(g)
   *   waterTemp: 93, // 湯温(℃)
   *   grindSize: 3.0, // 挽き目 (1.0:極細挽き ~ 3.0:中挽き ~ 5.0:粗挽き)
   *   brewTime: 150 // 抽出時間(秒)
   * }
   */
  brew(recipe) {
    const { dose, waterWeight, waterTemp, grindSize, brewTime } = recipe;

    // 1. 焙煎度に基づくベースの溶け出しやすさ (深煎りほど成分が脆く出やすい)
    // 基準温度210℃でベースEY19%とする
    const baseExtrationPotential = 19 + (this.bean.finalTemperature - 210) * 0.08;

    // 2. 抽出パラメータによる補正係数の計算
    // 時間係数: 長いほど出るが、対数的に頭打ちになる (150秒を1.0とする)
    const timeMult = Math.log10(Math.max(10, brewTime)) / Math.log10(150);
    
    // 温度係数: 90℃を1.0として、高いほど抽出促進
    const tempMult = 1.0 + (waterTemp - 90) * 0.02;
    
    // 挽き目係数: 3.0を1.0とし、細かい(値が小さい)ほど抽出促進
    const grindMult = 1.0 + (3.0 - grindSize) * 0.15;

    // 3. 実際の抽出収率 (Actual EY: Extraction Yield) の算出 (上限28%キャップ)
    let ey = baseExtrationPotential * timeMult * tempMult * grindMult;
    ey = Math.max(5, Math.min(28, ey));

    // 4. TDS (濃度) の算出
    // 注いだお湯から、コーヒー粉が吸う分（粉量x2）を引いた量が出来高
    const brewedLiquid = Math.max(10, waterWeight - (dose * 2)); 
    // 溶け出した成分の量 (g)
    const extractedMass = dose * (ey / 100);
    // TDS (%): 出来上がった液体に対する固形成分の割合
    const tds = (extractedMass / brewedLiquid) * 100;

    // 5. カップ評価の算出
    // 適正なEY(18-22%)を基準に、味のバランス（過抽出・未抽出）をシミュレート
    const resultScores = { ...this.baseScores };
    let alerts = [];

    // 酸味 (Acidity): 抽出序盤に出る。未抽出(EY<18)で強い（酸っぱい）。過抽出(EY>22)で苦味にマスキングされ下がる。
    if (ey < 18) {
      resultScores.acidity = Math.min(100, resultScores.acidity * 1.15);
      alerts.push("未抽出 (Under-extracted) - 酸っぱく薄いコーヒーです");
    } else if (ey > 22) {
      resultScores.acidity = resultScores.acidity * 0.8;
    }

    // 甘さ (Sweetness): 適正レンジ(19~21%)付近で最大に感じられる
    const sweetDist = Math.abs(ey - 20);
    resultScores.sweetness = Math.max(0, resultScores.sweetness * (1.0 - sweetDist * 0.05));

    // 風味 (Flavor) と 香り (Aroma): 適正レンジで最大
    const flavorDist = Math.abs(ey - 19.5);
    resultScores.flavor = Math.max(0, resultScores.flavor * (1.0 - flavorDist * 0.05));
    resultScores.aroma = Math.max(0, resultScores.aroma * (1.0 - flavorDist * 0.03));

    // クリーンカップ & 渋み: 過抽出(EY>22)になると、後から出る雑味やエグみが急増する
    if (ey > 22) {
      const overExt = ey - 22;
      resultScores.cleanCup -= (overExt * 8);
      resultScores.aftertaste -= (overExt * 5);
      alerts.push("過抽出 (Over-extracted) - 苦味やエグみ（渋み）が出ています");
    }

    // ボディ (Body / 濃度感): TDSの高さに強く影響される (理想は1.25~1.45%前後)
    // ただしTDSが高すぎると重すぎる（Overwhelming）
    const tdsRatio = tds / 1.35;
    resultScores.body = Math.max(0, Math.min(100, resultScores.body * tdsRatio));

    // 正規化
    for (let key in resultScores) {
      if (key !== 'overall') {
        resultScores[key] = Math.max(0, Math.min(100, Math.round(resultScores[key])));
      }
    }

    // 新たな総合評価
    const sum = resultScores.aroma + resultScores.flavor + resultScores.aftertaste + 
                resultScores.acidity + resultScores.body + resultScores.sweetness + resultScores.cleanCup;
    resultScores.overall = Math.round(sum / 7);

    return {
      recipe: recipe,
      physics: {
        brewRatio: parseFloat((waterWeight / dose).toFixed(2)),
        extractionYield: parseFloat(ey.toFixed(2)),
        tds: parseFloat(tds.toFixed(2)),
        brewedLiquid: parseFloat(brewedLiquid.toFixed(1))
      },
      alerts: alerts,
      finalScores: resultScores
    };
  }
}

module.exports = { DripSimulation };
