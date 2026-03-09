const fs = require('fs');
const { DripSimulation } = require('./drip_simulation');

const REPORT_FILE = 'drip_report.txt';
// 初期化
fs.writeFileSync(REPORT_FILE, '', 'utf8');

/**
 * 結果を美しいレポート形式でファイルとコンソールに出力する関数
 */
function printReport(result, title) {
  let output = '';
  output += '\n==================================================\n';
  output += `☕ DRIP REPORT: ${title}\n`;
  output += '==================================================\n';
  output += `■ 抽出レシピ :\n`;
  output += `  - 粉量      : ${result.recipe.dose} g\n`;
  output += `  - 湯量      : ${result.recipe.waterWeight} g (Ratio 1:${result.physics.brewRatio})\n`;
  output += `  - 湯温      : ${result.recipe.waterTemp} ℃\n`;
  output += `  - 挽き目    : ${result.recipe.grindSize} (1.0~5.0)\n`;
  output += `  - 抽出時間  : ${Math.floor(result.recipe.brewTime / 60)}分 ${result.recipe.brewTime % 60}秒\n`;
  output += '--------------------------------------------------\n';
  output += `■ 抽出物理データ :\n`;
  output += `  - EY (収率) : ${result.physics.extractionYield} % (理想: 18~22%)\n`;
  output += `  - TDS (濃度): ${result.physics.tds} % (理想: 1.15~1.45%)\n`;
  output += `  - 抽出液量  : ${result.physics.brewedLiquid} g\n`;
  output += '--------------------------------------------------\n';
  
  if (result.alerts && result.alerts.length > 0) {
    output += '■ ⚠️ アラート :\n';
    result.alerts.forEach(msg => { output += '  ' + msg + '\n'; });
    output += '--------------------------------------------------\n';
  }

  output += '■ 抽出後カップ評価 (100点満点) :\n';
  
  const logScore = (label, score) => {
    const length = 20;
    const filled = Math.round((Math.max(0, Math.min(100, score)) / 100) * length);
    const empty = length - filled;
    let msg = `[${String(score).padStart(3, ' ')}] ` + '='.repeat(filled) + '-'.repeat(empty);
    output += `  ${label.padEnd(16, ' ')} : ${msg}\n`;
  };

  logScore('香り (Aroma)', result.finalScores.aroma);
  logScore('風味 (Flavor)', result.finalScores.flavor);
  logScore('後味 (Aftertaste)', result.finalScores.aftertaste);
  logScore('酸味 (Acidity)', result.finalScores.acidity);
  logScore('ボディ (Body)', result.finalScores.body);
  logScore('甘さ (Sweetness)', result.finalScores.sweetness);
  logScore('クリーンカップ', result.finalScores.cleanCup);
  output += `  ★ 総合評価      : ${result.finalScores.overall} 点\n`;
  output += '==================================================\n\n';

  fs.appendFileSync(REPORT_FILE, output, 'utf8');
}

process.on('exit', () => {
  console.log(`✅ ドリップ・シミュレーション完了。結果は ${REPORT_FILE} に出力されました。`);
});

// ファイルから焙煎済みデータを検索してロードする（エチオピアの成功データを利用）
const files = fs.readdirSync('./');
const targetFile = files.find(f => f.startsWith('roasted_bean_ethiopia_good') && f.endsWith('.json'));

if (!targetFile) {
  console.error('エラー: 焙煎済みのエチオピアのJSONデータが見つかりません。先に run_simulation.js を実行してください。');
  process.exit(1);
}

const beanData = JSON.parse(fs.readFileSync(targetFile, 'utf8'));
const sim = new DripSimulation(beanData);

console.log(`=== 焙煎豆「${beanData.beanId} (${beanData.roastLevel})」を元に抽出テストを開始します ===\n`);

// ケース1: 理想的な抽出 (適切な温度、時間、挽き目)
const recipeStandard = {
  dose: 15,
  waterWeight: 250, // Ratio 1:16.6
  waterTemp: 92,
  grindSize: 3.0, // 中挽き
  brewTime: 150 // 2分30秒
};
printReport(sim.brew(recipeStandard), "標準的で理想的な抽出");

// ケース2: 未抽出 (ぬるいお湯、粗挽き、短時間) -> 酸っぱく薄くなる
const recipeUnder = {
  dose: 15,
  waterWeight: 250,
  waterTemp: 82, // ぬるい
  grindSize: 5.0, // 粗挽き
  brewTime: 90 // 1分30秒ですぐ終わる
};
printReport(sim.brew(recipeUnder), "未抽出 (低温・粗挽き・短時間)");

// ケース3: 過抽出 (熱湯、極細挽き、長時間) -> 苦味・エグみが出る
const recipeOver = {
  dose: 15,
  waterWeight: 250,
  waterTemp: 98, // 熱湯
  grindSize: 1.0, // 極細挽き
  brewTime: 300 // 5分かける
};
printReport(sim.brew(recipeOver), "過抽出 (熱湯・極細挽き・長時間)");

// ケース4: 濃いめの抽出 (豆の量を増やすが、EYは適正にコントロール)
const recipeStrong = {
  dose: 20, // 20gに増やす
  waterWeight: 250, // 湯量は同じ (Ratio 1:12.5)
  waterTemp: 90,
  grindSize: 3.5, // 濃くなりすぎないよう少し粗く
  brewTime: 180 
};
printReport(sim.brew(recipeStrong), "ストロング (粉量多めの濃い抽出)");
