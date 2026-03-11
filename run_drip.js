const fs = require('fs');
const path = require('path');
const { t } = require('./i18n');
const { DripSimulation } = require('./drip_simulation');

const REPORTS_DIR = path.join(__dirname, 'data', 'reports');

// Ensure output directories exist
if (!fs.existsSync(REPORTS_DIR)) {
  fs.mkdirSync(REPORTS_DIR, { recursive: true });
}

const REPORT_FILE = path.join(REPORTS_DIR, 'drip_report.txt');
// 初期化
fs.writeFileSync(REPORT_FILE, '', 'utf8');

/**
 * 結果を美しいレポート形式でファイルとコンソールに出力する関数
 */
function printReport(result, title) {
  let output = '';
  output += '\n==================================================\n';
  output += t('report.drip', { title: title }) + '\n';
  output += '==================================================\n';
  output += t('report.drip_recipe') + '\n';
  output += t('report.drip_dose', { amount: result.recipe.dose }) + '\n';
  output += t('report.drip_water', { amount: result.recipe.waterWeight, ratio: result.physics.brewRatio }) + '\n';
  output += t('report.drip_temp', { temp: result.recipe.waterTemp }) + '\n';
  output += t('report.drip_grind', { grind: result.recipe.grindSize }) + '\n';
  output += t('report.drip_time', { minutes: Math.floor(result.recipe.brewTime / 60), seconds: result.recipe.brewTime % 60 }) + '\n';
  output += '--------------------------------------------------\n';
  output += t('report.drip_physics_data') + '\n';
  output += t('report.drip_ey', { ey: result.physics.extractionYield }) + '\n';
  output += t('report.drip_tds', { tds: result.physics.tds }) + '\n';
  output += t('report.drip_brewed_liquid', { amount: result.physics.brewedLiquid }) + '\n';
  output += '--------------------------------------------------\n';

  if (result.alerts && result.alerts.length > 0) {
    output += t('report.alerts') + '\n';
    result.alerts.forEach(msg => { output += '  ' + msg + '\n'; });
    output += '--------------------------------------------------\n';
  }

  output += t('report.sca_score') + '\n';

  const scoreLabels = {
    aroma: t('scores.aroma'),
    flavor: t('scores.flavor'),
    aftertaste: t('scores.aftertaste'),
    acidity: t('scores.acidity'),
    body: t('scores.body'),
    sweetness: t('scores.sweetness'),
    cleanCup: t('scores.clean_cup'),
  };

  const logScore = (labelKey, score) => {
    const label = scoreLabels[labelKey] || labelKey;
    const length = 20;
    const filled = Math.round((Math.max(0, Math.min(100, score)) / 100) * length);
    const empty = length - filled;
    let msg = `[${String(score).padStart(3, ' ')}] ` + '='.repeat(filled) + '-'.repeat(empty);
    output += `  ${label.padEnd(16, ' ')} : ${msg}\n`;
  };

  logScore('aroma', result.finalScores.aroma);
  logScore('flavor', result.finalScores.flavor);
  logScore('aftertaste', result.finalScores.aftertaste);
  logScore('acidity', result.finalScores.acidity);
  logScore('body', result.finalScores.body);
  logScore('sweetness', result.finalScores.sweetness);
  logScore('cleanCup', result.finalScores.cleanCup);
  output += `  ${t('report.score_overall_label')} : ${result.finalScores.overall} ${t('report.score_unit')}\n`;
  output += '==================================================\n\n';

  fs.appendFileSync(REPORT_FILE, output, 'utf8');
}

process.on('exit', () => {
  console.log(t('drip_simulation_completed', { file: REPORT_FILE }));
});

// ファイルから焙煎済みデータを検索してロードする（エチオピアの成功データを利用）
const ROASTED_BEANS_DIR = path.join(__dirname, 'data', 'roasted_beans');
if (!fs.existsSync(ROASTED_BEANS_DIR)) {
  console.error(t('error_no_roasted_beans_dir', { dir: ROASTED_BEANS_DIR }));
  process.exit(1);
}

const files = fs.readdirSync(ROASTED_BEANS_DIR);
const targetFile = files.find(f => f.startsWith('roasted_bean_ethiopia_good') && f.endsWith('.json'));

if (!targetFile) {
  console.error('エラー: 焙煎済みのエチオピアのJSONデータが見つかりません。先に run_simulation.js を実行してください。');
  process.exit(1);
}

const beanData = JSON.parse(fs.readFileSync(path.join(ROASTED_BEANS_DIR, targetFile), 'utf8'));
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
