/*
  番茄小说 fanqie.js
  去广告 + 段评保护 + 屏蔽短剧/福利板块
*/

let body = $response.body;
if (!body) $done({});

let obj;
try {
    obj = JSON.parse(body);
} catch (e) {
    $done({});
}

// ── 白名单：保护段评/评论/用户数据 ──
const WHITE_KEYS = ["comment", "paragraph", "ugc", "reply", "user", "author", "forum", "review", "interact"];

// ── 广告 key 精确命中 ──
const AD_KEYS_EXACT = new Set([
    "ad_info", "video_ad", "pangle", "splash", "ad_config",
    "interstitial", "report_ad", "ad_v2", "ad_list", "ad_data",
    "ad_params", "ad_ext", "ad_extra", "ad_detail"
]);

const AD_KEYS_PARTIAL = ["pangle", "interstitial", "splash_ad", "ad_source"];

// ── 短剧/福利相关关键词 ──
// tab_type / tab_name / schema 里包含这些词就过滤掉整个 tab/card
const BLOCK_TAB_KEYWORDS = [
    "short_video", "drama", "movie", "短剧",
    "welfare", "benefit", "task", "gold_coin", "金币",
    "福利", "领券", "red_packet", "redpacket", "lucky",
    "game", "游戏", "sign_in", "signin", "checkin",
    "activity", "活动", "invite", "邀请"
];

function isWhiteKey(key) {
    const lower = key.toLowerCase();
    return WHITE_KEYS.some(w => lower.includes(w));
}

function isAdKey(key) {
    const lower = key.toLowerCase();
    if (AD_KEYS_EXACT.has(lower)) return true;
    return AD_KEYS_PARTIAL.some(k => lower.includes(k));
}

function isAdObject(val) {
    if (!val || typeof val !== 'object' || Array.isArray(val)) return false;
    if (val.is_ad === 1 || val.is_ad === true) return true;
    if (val.pangle_ad_type !== undefined) return true;
    if (val.ad_source === "pangle") return true;
    if (val.log_extra && typeof val.log_extra === 'string' && val.log_extra.includes("pangle")) return true;
    return false;
}

// ── 判断一个 tab/card 条目是否应该被屏蔽 ──
function isBlockedTab(item) {
    if (!item || typeof item !== 'object') return false;
    // 拼接所有可能携带类型信息的字段来检测
    const checkFields = [
        item.tab_type, item.tab_name, item.name, item.title,
        item.schema, item.url, item.type, item.key,
        item.card_type, item.section_type, item.module_type,
        item.icon_name, item.route
    ].filter(Boolean).join(" ").toLowerCase();

    return BLOCK_TAB_KEYWORDS.some(k => checkFields.includes(k.toLowerCase()));
}

// ── 递归清理广告，带深度保护 ──
function cleanAd(data, depth) {
    depth = depth || 0;
    if (depth > 20) return;

    if (Array.isArray(data)) {
        for (let i = data.length - 1; i >= 0; i--) {
            if (isAdObject(data[i])) {
                data.splice(i, 1);
            } else {
                cleanAd(data[i], depth + 1);
            }
        }
    } else if (data && typeof data === 'object') {
        for (let key of Object.keys(data)) {
            if (isWhiteKey(key)) continue;
            if (isAdKey(key) || isAdObject(data[key])) {
                delete data[key];
            } else {
                cleanAd(data[key], depth + 1);
            }
        }
    }
}

// ── 过滤 tab 列表（底部导航 / 首页 section / 我的页面条目）──
function filterTabList(arr) {
    if (!Array.isArray(arr)) return arr;
    return arr.filter(item => !isBlockedTab(item));
}

// ── 定点处理已知数据挂载点 ──
function patchKnownPoints(obj) {
    const d = obj.data;
    if (!d) return;

    // 底部 tab 栏（短剧 tab）
    if (Array.isArray(d.tab_list))    d.tab_list    = filterTabList(d.tab_list);
    if (Array.isArray(d.tabs))        d.tabs        = filterTabList(d.tabs);

    // 首页各 section / card
    if (Array.isArray(d.section_list)) d.section_list = filterTabList(d.section_list);
    if (Array.isArray(d.card_list))    d.card_list    = filterTabList(d.card_list);
    if (Array.isArray(d.module_list))  d.module_list  = filterTabList(d.module_list);

    // 「我的」页面功能入口列表
    if (Array.isArray(d.menu_list))    d.menu_list    = filterTabList(d.menu_list);
    if (Array.isArray(d.item_list))    d.item_list    = filterTabList(d.item_list);
    if (Array.isArray(d.entry_list))   d.entry_list   = filterTabList(d.entry_list);
    if (Array.isArray(d.func_list))    d.func_list    = filterTabList(d.func_list);

    // feed 流插入广告/推荐卡片
    if (Array.isArray(d.book_list))    d.book_list    = d.book_list.filter(item => !isAdObject(item));
    if (Array.isArray(d.banner_list))  d.banner_list  = d.banner_list.filter(item => !isAdObject(item));

    // 章节页广告
    if (d.chapter_info) {
        delete d.chapter_info.ad_info;
        delete d.chapter_info.video_ad;
        delete d.chapter_info.ad_config;
    }

    // settings 页广告配置
    if (d.settings) {
        delete d.settings.ad_config;
        delete d.settings.splash;
    }
}

patchKnownPoints(obj);
cleanAd(obj);

$done({ body: JSON.stringify(obj) });
