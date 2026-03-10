/**
 * コーヒー豆の種類と焙煎特性を定義するデータモジュール
 * SCA基準や農学情報を包括したユニバーサルなオブジェクト構造を採用しています。
 */

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
    
    this.cultivation = cultivation || new CultivationProfile({});
    this.processing = processing || new ProcessingProfile({});
    
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
// Preset Bean Instances
// ============================================

const ethiopia = new GreenCoffeeLot({
  lotId: 'ethiopia',
  name: 'エチオピア',
  description: '華やかな香りとフルーティーな酸味が特徴。浅煎り〜中浅煎り向け。',
  cultivation: new CultivationProfile({
    variety: 'Heirloom',
    altitude: '1800-2200m',
    region: 'Yirgacheffe',
    country: 'Ethiopia'
  }),
  processing: new ProcessingProfile({ processType: 'Washed', dryingMethod: 'Raised Beds' }),
  measured: {
    moisture_percent: { value: 11.2, source: 'estimated' },
    water_activity: { value: 0.58, source: 'estimated' },
    density_g_l: { value: 720, source: 'estimated' },
    screen_distribution: { value: '14-15', source: 'estimated'},
    defect_count_350g: { value: 3, source: 'estimated' }
  },
  hidden_state: { optimalEndTemp: 205, thermal_mass_factor: 1.0, cell_wall_fragility: 1.1 },
  evaluation: {
    baseScores: { aroma: 90, flavor: 85, acidity: 95, body: 60, sweetness: 80 },
    tempCoefficients: { acidityDropRate: 1.2, bodyGainRate: 0.8 }
  }
});

const brazil = new GreenCoffeeLot({
  lotId: 'brazil',
  name: 'ブラジル',
  description: 'ナッツのような香ばしさとバランスの取れた味わい。中煎り向け。',
  cultivation: new CultivationProfile({
    variety: 'Mundo Novo, Catuai',
    altitude: '800-1200m',
    region: 'Cerrado',
    country: 'Brazil'
  }),
  processing: new ProcessingProfile({ processType: 'Natural', dryingMethod: 'Patio Drying' }),
  measured: {
    moisture_percent: { value: 10.5, source: 'estimated' },
    water_activity: { value: 0.53, source: 'estimated' },
    density_g_l: { value: 680, source: 'estimated' }
  },
  hidden_state: { optimalEndTemp: 215, thermal_mass_factor: 0.95, cell_wall_fragility: 1.0 },
  evaluation: {
    baseScores: { aroma: 75, flavor: 80, acidity: 70, body: 75, sweetness: 85 },
    tempCoefficients: { acidityDropRate: 1.0, bodyGainRate: 1.0 }
  }
});

const colombia = new GreenCoffeeLot({
  lotId: 'colombia',
  name: 'コロンビア',
  description: 'しっかりとしたコクとキャラメルのような甘さ。中深煎り向け。',
  cultivation: new CultivationProfile({
    variety: 'Castillo, Caturra',
    altitude: '1500-1900m',
    region: 'Huila',
    country: 'Colombia'
  }),
  processing: new ProcessingProfile({ processType: 'Washed', dryingMethod: 'Parabolic Beds' }),
  measured: {
    moisture_percent: { value: 11.2, source: 'estimated' },
    water_activity: { value: 0.56, source: 'estimated' },
    density_g_l: { value: 700, source: 'estimated' }
  },
  hidden_state: { optimalEndTemp: 220, thermal_mass_factor: 1.0, cell_wall_fragility: 0.95 },
  evaluation: {
    baseScores: { aroma: 75, flavor: 85, acidity: 75, body: 85, sweetness: 80 },
    tempCoefficients: { acidityDropRate: 0.9, bodyGainRate: 1.1 }
  }
});

const indonesia = new GreenCoffeeLot({
  lotId: 'indonesia',
  name: 'インドネシア (マンデリン)',
  description: '重厚なボディ、スパイシーな風味、酸味が少ない。深煎り向け。',
  cultivation: new CultivationProfile({
    variety: 'Typica, Ateng',
    altitude: '1300-1600m',
    region: 'Sumatra',
    country: 'Indonesia'
  }),
  processing: new ProcessingProfile({ processType: 'Wet Hulled (Giling Basah)', dryingMethod: 'Sun Drying' }),
  measured: {
    moisture_percent: { value: 12.0, source: 'estimated' },
    water_activity: { value: 0.62, source: 'estimated' },
    density_g_l: { value: 660, source: 'estimated' }
  },
  hidden_state: { optimalEndTemp: 230, thermal_mass_factor: 1.1, cell_wall_fragility: 0.9 },
  evaluation: {
    baseScores: { aroma: 70, flavor: 85, acidity: 60, body: 95, sweetness: 75 },
    tempCoefficients: { acidityDropRate: 1.5, bodyGainRate: 1.3 }
  }
});

const guatemala = new GreenCoffeeLot({
  lotId: 'guatemala',
  name: 'グアテマラ',
  description: 'チョコレートのような風味と複雑な味わい。中深煎り向け。',
  cultivation: new CultivationProfile({
    variety: 'Bourbon, Caturra',
    altitude: '1600-2000m',
    region: 'Antigua',
    country: 'Guatemala'
  }),
  processing: new ProcessingProfile({ processType: 'Washed', dryingMethod: 'Patio Drying' }),
  measured: {
    moisture_percent: { value: 10.8, source: 'estimated' },
    water_activity: { value: 0.55, source: 'estimated' },
    density_g_l: { value: 710, source: 'estimated' }
  },
  hidden_state: { optimalEndTemp: 225, thermal_mass_factor: 1.05, cell_wall_fragility: 0.95 },
  evaluation: {
    baseScores: { aroma: 80, flavor: 85, acidity: 80, body: 80, sweetness: 80 },
    tempCoefficients: { acidityDropRate: 1.0, bodyGainRate: 1.0 }
  }
});


const beanTypes = {
  ethiopia,
  brazil,
  colombia,
  indonesia,
  guatemala
};

module.exports = { 
  GreenCoffeeLot, 
  CultivationProfile, 
  ProcessingProfile, 
  beanTypes 
};
