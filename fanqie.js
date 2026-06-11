/*
  番茄小说 fanqie_723.js
  专配小火箭，强化删除底部短剧/福利/商城Tab
*/

let body = $response.body;
if (!body) $done({});

let obj;
try {
    obj = JSON.parse(body);
} catch (e) {
    $done({});
}

// ── 短剧/福利/商城全量关键词 ──
const BLOCK_WORDS = [
    "short_video", "drama", "短剧", "video_feed", "video_tab", "video_page",
    "drama_center", "mini_drama", "drama_list", "drama_home", "drama_entry",
    "welfare", "benefit", "gold_coin", "金币", "福利", "red_packet",
    "redpacket", "bonus", "reward", "coin_center", "coin_task",
    "mall", "商城", "shopping", "mall_home", "shop_home", "mall_center",
    "game_center", "mini_game", "game_entry",
    "activity", "task_center", "sign_in", "signin", "invite",
    "book_mall", "book_store"
];

// ── 广告特征 ──
const AD_WORDS = [
    "pangle", "interstitial", "splash", "ad_", "_ad", "banner",
    "insert_ad", "reward_video", "float_ad", "open_screen"
];

function hasBlockWord(str) {
    if (!str || typeof str !== 'string') return false;
    const lower = str.toLowerCase();
    return BLOCK_WORDS.some(w => lower.includes(w));
}

function hasAdWord(str) {
    if (!str || typeof str !== 'string') return false;
    const lower = str.toLowerCase();
    return AD_WORDS.some(w => lower.includes(w));
}

// 判断一个条目是否要屏蔽（检查它所有字符串字段）
function isBlockedEntry(item) {
    if (!item || typeof item !== 'object') return false;
    let text = '';
    for (let key of Object.keys(item)) {
        const val = item[key];
        if (typeof val === 'string') text += key + ' ' + val + ' ';
        else if (typeof val === 'number') text += key + ' ' + val + ' ';
    }
    return hasBlockWord(text);
}

// 判断字段值是否为广告对象
function isAdObj(val) {
    if (!val || typeof val !== 'object' || Array.isArray(val)) return false;
    return val.is_ad === 1 || val.is_ad === true || val.ad_type !== undefined;
}

// 暴力递归清理
function deepClean(data, depth) {
    if (depth > 30) return;
    if (!data || typeof data !== 'object') return;

    if (Array.isArray(data)) {
        for (let i = data.length - 1; i >= 0; i--) {
            const item = data[i];
            if (!item) continue;
            if (typeof item === 'object') {
                if (isBlockedEntry(item)) {
                    data.splice(i, 1);
                    continue;
                }
                deepClean(item, depth + 1);
            }
        }
    } else {
        const toDelete = [];
        for (let key of Object.keys(data)) {
            const val = data[key];
            if (hasBlockWord(key) || hasAdWord(key)) {
                toDelete.push(key);
                continue;
            }
            if (isAdObj(val)) {
                toDelete.push(key);
                continue;
            }
            if (Array.isArray(val)) {
                deepClean(val, depth + 1);
            } else if (val && typeof val === 'object') {
                deepClean(val, depth + 1);
            }
        }
        for (let k of toDelete) delete data[k];
    }
}

deepClean(obj, 0);

$done({ body: JSON.stringify(obj) });
