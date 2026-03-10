/**
 * コーヒー豆の種類と焙煎特性を定義するデータモジュール
 */

const beanTypes = {
  ethiopia: {
    descriptor: {
      id: 'ethiopia',
      name: 'エチオピア',
      origin: 'Ethiopia',
      description: '華やかな香りとフルーティーな酸味が特徴。浅煎り〜中浅煎り向け。'
    },
    measured: {
      moisture_percent: { value: 11.0, source: 'estimated' },
      density_g_l: { value: 720, source: 'estimated' }
    },
    hidden_state: {
      optimalEndTemp: 205, // 1ハゼ直後〜中盤が理想
      thermal_mass_factor: 1.0, 
      cell_wall_fragility: 1.1
    },
    evaluation: {
      baseScores: {
        aroma: 90,
        flavor: 85,
        acidity: 95,
        body: 60,
        sweetness: 80,
      },
      tempCoefficients: {
        // 温度によるスコアの変化率
        acidityDropRate: 1.2, // 焙煎が進むと酸味が落ちやすい
        bodyGainRate: 0.8,    // ボディは増えにくい
      }
    }
  },
  brazil: {
    descriptor: {
      id: 'brazil',
      name: 'ブラジル',
      origin: 'Brazil',
      description: 'ナッツのような香ばしさとバランスの取れた味わい。中煎り向け。'
    },
    measured: {
      moisture_percent: { value: 10.5, source: 'estimated' },
      density_g_l: { value: 680, source: 'estimated' }
    },
    hidden_state: {
      optimalEndTemp: 215, // 1ハゼ終わり〜2ハゼ直前が理想
      thermal_mass_factor: 0.95,
      cell_wall_fragility: 1.0
    },
    evaluation: {
      baseScores: {
        aroma: 75,
        flavor: 80,
        acidity: 70,
        body: 75,
        sweetness: 85,
      },
      tempCoefficients: {
        acidityDropRate: 1.0,
        bodyGainRate: 1.0,
      }
    }
  },
  colombia: {
    descriptor: {
      id: 'colombia',
      name: 'コロンビア',
      origin: 'Colombia',
      description: 'しっかりとしたコクとキャラメルのような甘さ。中深煎り向け。'
    },
    measured: {
      moisture_percent: { value: 11.2, source: 'estimated' },
      density_g_l: { value: 700, source: 'estimated' }
    },
    hidden_state: {
      optimalEndTemp: 220, // 2ハゼ開始付近が理想
      thermal_mass_factor: 1.0,
      cell_wall_fragility: 0.95
    },
    evaluation: {
      baseScores: {
        aroma: 75,
        flavor: 85,
        acidity: 75,
        body: 85,
        sweetness: 80,
      },
      tempCoefficients: {
        acidityDropRate: 0.9,
        bodyGainRate: 1.1,
      }
    }
  },
  indonesia: {
    descriptor: {
      id: 'indonesia',
      name: 'インドネシア (マンデリン)',
      origin: 'Indonesia',
      description: '重厚なボディ、スパイシーな風味、酸味が少ない。深煎り向け。'
    },
    measured: {
      moisture_percent: { value: 12.0, source: 'estimated' },
      density_g_l: { value: 660, source: 'estimated' }
    },
    hidden_state: {
      optimalEndTemp: 230, // 2ハゼ中盤〜後半が理想
      thermal_mass_factor: 1.1,
      cell_wall_fragility: 0.9
    },
    evaluation: {
      baseScores: {
        aroma: 70,
        flavor: 85,
        acidity: 60,
        body: 95,
        sweetness: 75,
      },
      tempCoefficients: {
        acidityDropRate: 1.5, // 焙煎が浅くても酸味は評価されにくい
        bodyGainRate: 1.3,    // 深煎りでボディが強調される
      }
    }
  },
  guatemala: {
    descriptor: {
      id: 'guatemala',
      name: 'グアテマラ',
      origin: 'Guatemala',
      description: 'チョコレートのような風味と複雑な味わい。中深煎り向け。'
    },
    measured: {
      moisture_percent: { value: 10.8, source: 'estimated' },
      density_g_l: { value: 710, source: 'estimated' }
    },
    hidden_state: {
      optimalEndTemp: 225, // 2ハゼ前後が理想
      thermal_mass_factor: 1.05,
      cell_wall_fragility: 0.95
    },
    evaluation: {
      baseScores: {
        aroma: 80,
        flavor: 85,
        acidity: 80,
        body: 80,
        sweetness: 80,
      },
      tempCoefficients: {
        acidityDropRate: 1.0,
        bodyGainRate: 1.0,
      }
    }
  }
};

module.exports = { beanTypes };
