/**
 * コーヒー豆の種類と焙煎特性を定義するデータモジュール
 * SCA基準や農学情報を包括したユニバーサルなオブジェクト構造を採用しています。
 */

const fs = require('fs');
const path = require('path');

const GREEN_BEANS_DIR = path.join(__dirname, 'data', 'green_beans');

class CultivationProfile {
  constructor({ variety, altitude, region, country, producer }) {
    this.variety = variety || 'Unknown';
    this.altitude = altitude || null;
    this.region = region || 'Unknown';
    this.country = country || 'Unknown';
    this.producer = producer || 'Unknown';
  }
}

class ProcessingProfile {
  constructor({ processType, dryingMethod }) {
    this.processType = processType || 'Washed';
    this.dryingMethod = dryingMethod || 'Sun Drying';
  }
}

class GreenCoffeeLot {
  constructor({
    lotId,
    name,
    description,
    cultivation,    // CultivationProfile instance
    processing,     // ProcessingProfile instance
    measured,       // SCA measured values (moisture, density, defects)
    hidden_state,   // Physics simulation layer (thermal_mass, etc.)
    evaluation      // Taste potential layer
  }) {
    this.descriptor = {
      id: lotId,
      name: name,
      description: description
    };
    
    this.cultivation = new CultivationProfile(cultivation || {});
    this.processing = new ProcessingProfile(processing || {});
    
    // Default SCA measurements if not fully provided
    this.measured = {
      moisture_percent: measured?.moisture_percent || { value: 11.0, source: 'estimated' },
      water_activity: measured?.water_activity || { value: 0.55, source: 'estimated' },
      density_g_l: measured?.density_g_l || { value: 700, source: 'estimated' },
      screen_distribution: measured?.screen_distribution || { value: '15-18', source: 'estimated' },
      defect_count_350g: measured?.defect_count_350g || { value: 0, source: 'estimated' }
    };
    
    this.hidden_state = hidden_state || {
      optimalEndTemp: 210,
      thermal_mass_factor: 1.0,
      cell_wall_fragility: 1.0
    };
    
    this.evaluation = evaluation || {
      baseScores: { aroma: 70, flavor: 70, acidity: 70, body: 70, sweetness: 70 },
      tempCoefficients: { acidityDropRate: 1.0, bodyGainRate: 1.0 }
    };
  }

  // 例: 倉庫での保管によるエイジング（劣化）シミュレーションメソッド
  simulateStorageAging(months) {
    if (months <= 0) return;
    // 保管月数に応じて水分と水分活性が徐々に下がる（非常に簡易的なモデル）
    this.measured.moisture_percent.value = Math.max(8.0, this.measured.moisture_percent.value - (months * 0.15));
    this.measured.water_activity.value = Math.max(0.40, this.measured.water_activity.value - (months * 0.01));
    // 枯れることで細胞壁の脆さが進行し、焙煎時の熱が入りやすくなる
    this.hidden_state.cell_wall_fragility += (months * 0.02);
  }
}

// ============================================
// Data Loader (JSON Factory)
// ============================================

/**
 * data/green_beans/ ディレクトリから指定された豆IDのJSONを読み込み、インスタンス化する
 * @param {string} lotId - 豆のID (例: 'ethiopia')
 * @returns {GreenCoffeeLot} - インスタンス化された生豆オブジェクト
 */
function loadBean(lotId) {
  const filePath = path.join(GREEN_BEANS_DIR, `${lotId}.json`);
  if (!fs.existsSync(filePath)) {
    throw new Error(`Green bean data file not found: ${filePath}`);
  }
  
  const rawData = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  return new GreenCoffeeLot(rawData);
}

/**
 * 利用可能なすべての生豆IDリストを取得する
 * @returns {string[]} - ['ethiopia', 'brazil', ...] のようなIDの配列
 */
function listAvailableBeans() {
  if (!fs.existsSync(GREEN_BEANS_DIR)) {
    return [];
  }
  return fs.readdirSync(GREEN_BEANS_DIR)
    .filter(file => file.endsWith('.json'))
    .map(file => path.basename(file, '.json'));
}

module.exports = { 
  GreenCoffeeLot, 
  CultivationProfile, 
  ProcessingProfile, 
  loadBean,
  listAvailableBeans
};
