const fs = require('fs');
const path = require('path');
const { loadBean } = require('./beans');
const { RoastSimulation } = require('./simulation');
const { t } = require('./i18n');

const REPORTS_DIR = path.join(__dirname, 'data', 'reports');
const ROASTED_BEANS_DIR = path.join(__dirname, 'data', 'roasted_beans');
const GRAPHS_DIR = path.join(__dirname, 'data', 'graphs');

// Ensure output directories exist
[REPORTS_DIR, ROASTED_BEANS_DIR, GRAPHS_DIR].forEach(dir => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

const REPORT_FILE = path.join(REPORTS_DIR, 'report.txt');
// 初期化
fs.writeFileSync(REPORT_FILE, '', 'utf8');

/**
 * 結果を美しいレポート形式でファイルに出力する関数
 */
function formatTime(totalSeconds) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return { minutes, seconds };
}

function printReport(result, title) {
  let output = '';
  output += '\n==================================================\n';
  output += t('report.roasting', { title: title }) + '\n';
  output += '==================================================\n';
  output += t('report.bean_type', { name: result.beanName }) + '\n';

  const totalTime = formatTime(result.totalTimeSec);
  output += t('report.roast_time', totalTime) + '\n';
  output += t('report.end_temp', { temp: result.finalTemp }) + '\n';

  output += '--------------------------------------------------\n';
  output += t('report.roast_events') + '\n';

  const formatEvent = (timeSec) => timeSec ? `${Math.floor(timeSec / 60)}m ${timeSec % 60}s` : t('report.not_reached');
  output += t('report.event_dry_end', { time: formatEvent(result.events.dryEnd) }) + '\n';
  output += t('report.event_first_crack', { time: formatEvent(result.events.firstCrack) }) + '\n';
  output += t('report.event_second_crack', { time: formatEvent(result.events.secondCrack) }) + '\n';
  output += '--------------------------------------------------\n';

  // Warnings / Defects
  const defectMessages = result.alerts || [];
  if (defectMessages.length > 0) {
    output += t('report.alerts') + '\n';
    defectMessages.forEach(msg => { output += '  ' + msg + '\n'; });
    output += '--------------------------------------------------\n';
  }

  // SCA Score mapping
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
    const filled = Math.round((score / 100) * length);
    const empty = length - filled;
    let msg = `[${String(score).padStart(3, ' ')}]` + '='.repeat(filled) + '-'.repeat(empty);
    output += `  ${label.padEnd(16, ' ')} : ${msg}\n`;
  };

  logScore('aroma', result.scores.aroma);
  logScore('flavor', result.scores.flavor);
  logScore('aftertaste', result.scores.aftertaste);
  logScore('acidity', result.scores.acidity);
  logScore('body', result.scores.body);
  logScore('sweetness', result.scores.sweetness);
  logScore('cleanCup', result.scores.cleanCup);
  output += '--------------------------------------------------\n';

  // Flavor Profile
  if (result.flavorProfile && result.flavorProfile.length > 0) {
    output += t('report.flavor_profile', { profile: result.flavorProfile.join(', ') }) + '\n';
    output += '--------------------------------------------------\n';
  }

  // Overall Score
  output += t('report.score_overall', { score: result.scores.overall }) + '\n';
  output += '==================================================\n\n';

  fs.appendFileSync(REPORT_FILE, output, 'utf8');

  // JSONデータの生成と出力
  const roastLevelLabel = getRoastLevelLabel(result.finalTemp, result.events);
  const jsonExport = {
    beanId: result.bean,
    roastDate: new Date().toISOString(),
    totalRoastTime: result.totalTimeSec,
    finalTemperature: result.finalTemp,
    roastLevel: roastLevelLabel,
    events: result.events,
    defects: result.defects,
    cuppingScores: result.scores,
    roastProfile: result.history,
    flavorProfile: result.flavorProfile,
    alerts: result.alerts
  };

  const jsonFilename = path.join(ROASTED_BEANS_DIR, `roasted_bean_${title.replace(/[^a-zA-Z0-9]/g, '_')}_${result.totalTimeSec}s.json`);
  fs.writeFileSync(jsonFilename, JSON.stringify(jsonExport, null, 2), 'utf8');

  // Artisan風HTMLグラフレポートの生成
  generateHtmlReport(jsonExport, title);
}

/**
 * HTMLグラフレポートを生成する関数
 */
function generateHtmlReport(data, title) {
  const safeTitle = title.replace(/[^a-zA-Z0-9]/g, '_');
  const filename = path.join(GRAPHS_DIR, `report_graph_${safeTitle}_${data.totalRoastTime}s.html`);

  const html = `<!DOCTYPE html>
  <html lang="ja">
    <head>
      <meta charset="UTF-8">
        <title>Roast Report - ${data.beanId}</title>
        <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
        <style>
          body { font-family: sans-serif; background: #222; color: #eee; margin: 20px; }
          .container { max-width: 1000px; margin: 0 auto; background: #333; padding: 20px; border-radius: 8px; }
          h1 { margin-top: 0; color: #fff; }
          .info { display: flex; flex-wrap: wrap; gap: 20px; margin-bottom: 20px; background: #444; padding: 15px; border-radius: 4px; }
          .info-box { flex: 1; min-width: 200px; }
          .info-box p { margin: 5px 0; }
          .score-bar { background: #555; height: 10px; border-radius: 5px; overflow: hidden; margin-top: 5px; }
          .score-fill { background: #4caf50; height: 100%; transition: width 1s ease-in-out; }
          canvas { background: #222; border-radius: 4px; padding: 10px; }
        </style>
    </head>
    <body>
      <div class="container">
        <h1>Roasting Analysis: ${data.beanId} (${data.roastLevel})</h1>
        <div class="info">
          <div class="info-box">
            <h3>General</h3>
            <p>Total Time: ${Math.floor(data.totalRoastTime / 60)}m ${data.totalRoastTime % 60}s</p>
            <p>End Temp: ${data.finalTemperature} °C</p>
            <p>Dry End: ${data.events.dryEnd ? Math.floor(data.events.dryEnd / 60) + ':' + String(data.events.dryEnd % 60).padStart(2, '0') : 'N/A'}</p>
            <p>1st Crack: ${data.events.firstCrack ? Math.floor(data.events.firstCrack / 60) + ':' + String(data.events.firstCrack % 60).padStart(2, '0') : 'N/A'}</p>
            <p>2nd Crack: ${data.events.secondCrack ? Math.floor(data.events.secondCrack / 60) + ':' + String(data.events.secondCrack % 60).padStart(2, '0') : 'N/A'}</p>
          </div>
          <div class="info-box">
            <h3>Cupping Score (${data.cuppingScores.overall})</h3>
            ${Object.entries(data.cuppingScores).map(([key, value]) => key !== 'overall' ? `
          <div style="font-size: 0.9em; margin-bottom: 4px;">${key.charAt(0).toUpperCase() + key.slice(1)}: ${value}
            <div class="score-bar"><div class="score-fill" style="width: ${value}%"></div></div>
          </div>
        ` : '').join('')}
          </div>
        </div>

        <canvas id="roastChart" width="1000" height="500"></canvas>
      </div>

      <script>
        const roastData = ${JSON.stringify(data.roastProfile)};
        const events = ${JSON.stringify(data.events)};
    
    const labels = roastData.map(d => {
      const m = Math.floor(d.time / 60);
        const s = String(d.time % 60).padStart(2, '0');
        return m + ':' + s;
    });
    const btData = roastData.map(d => d.bt);
    const etData = roastData.map(d => d.envTemp);
    const rorData = roastData.map(d => d.ror);
    const powerData = roastData.map(d => d.heatPower);

        const eventLines = {
          id: 'eventLines',
      beforeDraw: chart => {
        const {ctx, chartArea, scales} = chart;
        const drawLine = (timeSec, color, label) => {
          if (!timeSec) return;
          const index = roastData.findIndex(d => d.time >= timeSec);
        if (index === -1) return;
        const x = scales.x.getPixelForTick(index);
        ctx.save();
        ctx.beginPath();
        ctx.lineWidth = 1;
        ctx.setLineDash([5, 5]);
        ctx.strokeStyle = color;
        ctx.moveTo(x, chartArea.top);
        ctx.lineTo(x, chartArea.bottom);
        ctx.stroke();
        ctx.fillStyle = color;
        ctx.textAlign = 'right';
        ctx.font = "12px sans-serif";
        ctx.fillText(label, x - 5, chartArea.top + 15);
        ctx.restore();
        };

        drawLine(events.dryEnd, '#ffeb3b', 'Dry End');
        drawLine(events.firstCrack, '#ff9800', '1st Crack');
        drawLine(events.secondCrack, '#f44336', '2nd Crack');
      }
    };

        const ctx = document.getElementById('roastChart').getContext('2d');
        new Chart(ctx, {
          type: 'line',
        data: {
          labels: labels,
        datasets: [
        {
          label: 'Bean Temp (BT)', data: btData,
        borderColor: '#ff5252', backgroundColor: 'transparent',
        yAxisID: 'y', tension: 0.1, pointRadius: 0
          },
        {
          label: 'Env Temp (ET)', data: etData,
        borderColor: '#2196f3', backgroundColor: 'transparent',
        yAxisID: 'y', borderDash: [5, 5], tension: 0.1, pointRadius: 0
          },
        {
          label: 'RoR (C/sec)', data: rorData,
        borderColor: '#4caf50', backgroundColor: 'rgba(76, 175, 80, 0.2)',
        yAxisID: 'y1', tension: 0.3, fill: true, pointRadius: 0
          },
        {
          label: 'Heat Power (%)', data: powerData,
        borderColor: '#9e9e9e', backgroundColor: 'transparent',
        yAxisID: 'y2', borderWidth: 1, stepped: true, pointRadius: 0
          }
        ]
      },
        options: {
          responsive: true,
        interaction: {mode: 'index', intersect: false },
        plugins: {legend: {labels: {color: '#eee' } } },
        scales: {
          x: {ticks: {color: '#aaa', maxTicksLimit: 20 }, grid: {color: '#444' } },
        y: {
          type: 'linear', position: 'left',
        title: {display: true, text: 'Temperature (°C)', color: '#eee' },
        ticks: {color: '#aaa' }, grid: {color: '#444' }, min: 0, max: 400
          },
        y1: {
          type: 'linear', position: 'right',
        title: {display: true, text: 'RoR (°C/s)', color: '#4caf50' },
        ticks: {color: '#4caf50' }, grid: {drawOnChartArea: false }, min: -0.5, max: 2.0
          },
        y2: {
          type: 'linear', position: 'right', display: false, min: 0, max: 100 
          }
        }
      },
        plugins: [eventLines]
    });
      </script>
    </body>
  </html>`;

  fs.writeFileSync(filename, html, 'utf8');
}


/**
 * 温度から大まかな焙煎度を判定するユーティリティ
 */
function getRoastLevelLabel(finalTemp, events) {
  if (finalTemp < 195) return "Underdeveloped";
  if (!events.firstCrack || finalTemp < 210) return "Light";
  if (!events.secondCrack && finalTemp < 220) return "Medium";
  if (events.secondCrack && finalTemp < 235) return "Medium-Dark";
  if (finalTemp >= 235 && finalTemp < 250) return "Dark";
  return "Very Dark / Scorched";
}

/**
 * テスト完了後
 */
process.on('exit', () => {
  console.log(t('simulation_completed', { file: REPORT_FILE }));
});


// ============================================
// シミュレーション実行ケース
// ============================================

// ケース1: エチオピアの良い浅煎り〜中煎り (12分程度、1ハゼ後少しで引き上げ)
const ethiopiaGoodProfile = [
  { time: 0, power: 80 },   // 最初は中強火
  { time: 300, power: 60 }, // 5分で少し火を弱める(水分が抜け切り熱が入りやすくなるため)
  { time: 500, power: 50 }, // 1ハゼが近づいたらさらに弱める
];
const sim1 = new RoastSimulation(loadBean('ethiopia'));
const result1 = sim1.run(ethiopiaGoodProfile, 11 * 60 + 30); // 11分30秒で引き上げ
printReport(result1, "ethiopia_good");

// ケース2: マンデリンの良い深煎り (14分程度、2ハゼまでじっくり)
const mandhelingGoodProfile = [
  { time: 0, power: 75 },
  { time: 360, power: 55 },
  { time: 600, power: 45 }, // ゆっくり熱を入れる
];
const sim2 = new RoastSimulation(loadBean('indonesia'));
const result2 = sim2.run(mandhelingGoodProfile, 14 * 60); // 14分で引き上げ
printReport(result2, "mandheling_good");

// ケース3: 失敗例 (火力が強すぎてすぐ焦げる)
const scorchedProfile = [
  { time: 0, power: 100 }, // 手網でずっと全開
];
const sim3 = new RoastSimulation(loadBean('brazil'));
const result3 = sim3.run(scorchedProfile, 7 * 60); // 7分で終了
printReport(result3, "brazil_scorched");

// ケース4: 失敗例 (火力が弱すぎてベイクド)
const bakedProfile = [
  { time: 0, power: 30 }, // ずっと弱火
];
const sim4 = new RoastSimulation(loadBean('colombia'));
const result4 = sim4.run(bakedProfile, 20 * 60); // 20分かかる
printReport(result4, "colombia_baked");
