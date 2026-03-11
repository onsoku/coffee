const config = require('./config');
const fs = require('fs');
const path = require('path');

const localesDir = path.join(__dirname, 'locales');
let currentDictionary = {};

// 辞書データを読み込む
function loadDictionary() {
    const lang = config.language || 'en';
    const filePath = path.join(localesDir, `${lang}.json`);

    try {
        if (fs.existsSync(filePath)) {
            const data = fs.readFileSync(filePath, 'utf8');
            currentDictionary = JSON.parse(data);
        } else {
            console.warn(`[i18n] Warning: Language file not found: ${filePath}`);
            // Fallback to English if not found
            const fallbackPath = path.join(localesDir, 'en.json');
            if (fs.existsSync(fallbackPath)) {
                const fallbackData = fs.readFileSync(fallbackPath, 'utf8');
                currentDictionary = JSON.parse(fallbackData);
            }
        }
    } catch (error) {
        console.error(`[i18n] Error loading language file: ${error.message}`);
    }
}

// 翻訳関数
function t(key, params = {}) {
    const keys = key.split('.');
    let value = currentDictionary;

    for (const k of keys) {
        if (value && typeof value === 'object' && k in value) {
            value = value[k];
        } else {
            value = undefined;
            break;
        }
    }

    // キーが見つからない場合はキー名をそのまま返す
    if (value === undefined) {
        return key;
    }

    // パラメータ置換 (例: "Hello, {name}" -> t("greeting", { name: "Alice" }))
    if (typeof value === 'string') {
        return value.replace(/\{(\w+)\}/g, (match, p1) => {
            return params[p1] !== undefined ? params[p1] : match;
        });
    }

    return value;
}

// 初期化時に辞書を読み込む
loadDictionary();

module.exports = { t, config };
