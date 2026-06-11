/*
  番茄小说 fanqie_723.js (小火箭/Shadowrocket)
  去广告 + 去短剧/福利/商城/游戏板块 + 页面净化
*/

let body = $response.body;
if (!body) $done({});

let obj;
try {
    obj = JSON.parse(body);
} catch (e) {
    $done({});
}

// ── 白名单：保护的核心字段 ──
const WHITE_KEYS = [
    "comment", "paragraph", "ugc", "reply", "user", "author",
    "forum", "review", "interact", "book_info", "chapter",
    "content", "reader", "read", "shelf", "history", "download"
];

// ── 广告特征词 ──
const AD_KEYS_PARTIAL = [
    "pangle", "interstitial", "splash", "ad_source", "ad_info", "ad_v2",
    "ad_list", "ad_data", "ad_params", "ad_ext", "ad_extra", "ad_detail",
    "ad_config", "video_ad", "report_ad", "insert_ad", "banner_ad",
    "feed_ad", "draw_ad", "live_ad", "dsp_ad", "tt_ad", "bytedance_ad",
    "reward_video", "open_screen", "float_ad", "native_ad", "preload_ad",
    "ad_placement", "ad_slot", "ad_template", "ad_cache", "ad_strategy"
];

// ── 短剧/福利/商城/游戏 屏蔽关键词 ──
const BLOCK_KEYWORDS = [
    "short_video", "drama", "movie", "短剧", "skit", "theater",
    "video_feed", "video_tab", "video_page", "mini_drama", "series",
    "drama_center", "drama_home", "drama_list",
    "welfare", "benefit", "task", "gold_coin", "金币", "福利",
    "领券", "red_packet", "redpacket", "lucky", "bonus", "reward",
    "coin_task", "coin_center", "coin_home",
    "activity", "活动", "invite", "邀请", "签到", "sign_in", "signin",
    "checkin", "check_in",
    "mall", "商城", "shopping", "shop", "store", "电商", "商品",
    "mall_home", "shop_home",
    "game", "游戏", "mini_game", "game_center"
];

function isWhiteKey(key) {
    const lower = key.toLowerCase();
    return WHITE_KEYS.some(w =>
        lower === w ||
        lower.startsWith(w + "_") ||
        lower.endsWith("_" + w)
    );
}

function isAdKey(key) {
    const lower = key.toLowerCase();
    return AD_KEYS_PARTIAL.some(k => lower.includes(k));
}

function isAdObject(val) {
    if (!val || typeof val !== 'object' || Array.isArray(val)) return false;
    if (val.is_ad === 1 || val.is_ad === true) return true;
    if (val.ad_type !== undefined || val.pangle_ad_type !== undefined) return true;
    if (val.ad_source === "pangle" || val.ad_source === "dsp") return true;
    if (val.ad_id || val.ad_model) {
        if (val.is_ad === 1) return true;
    }
    if (val.log_extra && typeof val.log_extra === 'string' &&
        (val.log_extra.includes("pangle") || val.log_extra.includes("ad"))) return true;
    return false;
}

function isBlockedItem(item) {
    if (!item || typeof item !== 'object') return false;

    const fieldsToCheck = [
        item.tab_type, item.tab_name, item.tab_id, item.name, item.title,
        item.schema, item.url, item.type, item.key, item.card_type,
        item.section_type, item.module_type, item.icon_name, item.route,
        item.sub_type, item.func_type, item.entry_id, item.page_type,
        item.action, item.link, item.target, item.page_name, item.biz_type,
        item.left_icon, item.right_icon, item.icon_url,
        item.component_name, item.component_id, item.page_id,
        item.nav_type, item.tag, item.category, item.group_id
    ];

    const checkString = fieldsToCheck
        .filter(f => f !== undefined && f !== null)
        .map(f => String(f))
        .join(" ")
        .toLowerCase();

    return BLOCK_KEYWORDS.some(k => {
        const pattern = new RegExp(`(^|[_\\.\\-\\/])${k}([_\\\\.\\-\\/]|$)`, 'i');
        return pattern.test(checkString);
    });
}

function cleanAd(data, depth) {
    if (depth === undefined) depth = 0;
    if (depth > 20) return;
    if (!data || typeof data !== 'object') return;

    if (Array.isArray(data)) {
        for (let i = data.length - 1; i >= 0; i--) {
            if (!data[i]) continue;
            if (isAdObject(data[i])) {
                data.splice(i, 1);
            } else if (typeof data[i] === 'object') {
                cleanAd(data[i], depth + 1);
            }
        }
    } else {
        for (let key of Object.keys(data)) {
            if (isWhiteKey(key)) continue;
            if (isAdKey(key) || isAdObject(data[key])) {
                delete data[key];
            } else if (data[key] && typeof data[key] === 'object') {
                cleanAd(data[key], depth + 1);
            }
        }
    }
}

function filterBlockedItems(arr) {
    if (!Array.isArray(arr)) return arr;
    return arr.filter(item => {
        if (!item) return true;
        return !isBlockedItem(item);
    });
}

function patchKnownPoints(obj) {
    const d = obj.data;
    if (!d) return;

    // 底部导航 Tab
    if (Array.isArray(d.tab_list)) d.tab_list = filterBlockedItems(d.tab_list);
    if (Array.isArray(d.tabs)) d.tabs = filterBlockedItems(d.tabs);
    if (Array.isArray(d.dynamic_tabs)) d.dynamic_tabs = filterBlockedItems(d.dynamic_tabs);
    if (Array.isArray(d.bottom_tabs)) d.bottom_tabs = filterBlockedItems(d.bottom_tabs);
    if (Array.isArray(d.nav_tabs)) d.nav_tabs = filterBlockedItems(d.nav_tabs);

    // 首页各 section / card / module
    if (Array.isArray(d.section_list)) d.section_list = filterBlockedItems(d.section_list);
    if (Array.isArray(d.card_list)) d.card_list = filterBlockedItems(d.card_list);
    if (Array.isArray(d.module_list)) d.module_list = filterBlockedItems(d.module_list);
    if (Array.isArray(d.pages)) d.pages = filterBlockedItems(d.pages);
    if (Array.isArray(d.sections)) d.sections = filterBlockedItems(d.sections);
    if (Array.isArray(d.components)) d.components = filterBlockedItems(d.components);

    // 「我的」页面
    if (Array.isArray(d.menu_list)) d.menu_list = filterBlockedItems(d.menu_list);
    if (Array.isArray(d.item_list)) d.item_list = filterBlockedItems(d.item_list);
    if (Array.isArray(d.entry_list)) d.entry_list = filterBlockedItems(d.entry_list);
    if (Array.isArray(d.func_list)) d.func_list = filterBlockedItems(d.func_list);
    if (Array.isArray(d.cells)) d.cells = filterBlockedItems(d.cells);
    if (Array.isArray(d.entries)) d.entries = filterBlockedItems(d.entries);
    if (Array.isArray(d.items)) d.items = filterBlockedItems(d.items);
    if (Array.isArray(d.rows)) d.rows = filterBlockedItems(d.rows);

    // 信息流去广告
    if (Array.isArray(d.book_list)) d.book_list = d.book_list.filter(item => !isAdObject(item));
    if (Array.isArray(d.banner_list)) d.banner_list = d.banner_list.filter(item => !isAdObject(item));
    if (Array.isArray(d.data_list)) d.data_list = d.data_list.filter(item => !isAdObject(item));
    if (Array.isArray(d.recommend_list)) d.recommend_list = d.recommend_list.filter(item => !isAdObject(item));
    if (Array.isArray(d.feed_list)) d.feed_list = d.feed_list.filter(item => !isAdObject(item));
    if (Array.isArray(d.content_list)) d.content_list = d.content_list.filter(item => !isAdObject(item));

    // 阅读器清理
    if (d.chapter_info) {
        delete d.chapter_info.ad_info;
        delete d.chapter_info.video_ad;
        delete d.chapter_info.ad_config;
        delete d.chapter_info.interstitial;
        delete d.chapter_info.insert_ad;
        delete d.chapter_info.splash;
    }
    if (d.audio_info) {
        delete d.audio_info.ad_info;
        delete d.audio_info.ad_config;
        delete d.audio_info.insert_ad;
    }
    if (d.reader_info) {
        delete d.reader_info.ad_config;
        delete d.reader_info.interstitial;
    }

    // 全局设置
    if (d.settings) {
        delete d.settings.ad_config;
        delete d.settings.splash;
        delete d.settings.ad_interval;
        delete d.settings.ad_strategy;
    }

    // 7.2.3 新增入口
    if (Array.isArray(d.float_entries)) d.float_entries = filterBlockedItems(d.float_entries);
    if (Array.isArray(d.popups)) d.popups = filterBlockedItems(d.popups);
    if (Array.isArray(d.red_dot_list)) d.red_dot_list = filterBlockedItems(d.red_dot_list);
    if (Array.isArray(d.badge_list)) d.badge_list = filterBlockedItems(d.badge_list);
    if (Array.isArray(d.discover_list)) d.discover_list = filterBlockedItems(d.discover_list);
    if (Array.isArray(d.mine_list)) d.mine_list = filterBlockedItems(d.mine_list);
    if (Array.isArray(d.profile_list)) d.profile_list = filterBlockedItems(d.profile_list);
    if (Array.isArray(d.popup_ad)) d.popup_ad = [];
    if (Array.isArray(d.splash_list)) d.splash_list = [];

    // 深度清理
    cleanDeepArrays(d, 0);
}

function cleanDeepArrays(data, depth) {
    if (depth > 15 || !data || typeof data !== 'object') return;
    for (let key of Object.keys(data)) {
        const val = data[key];
        if (Array.isArray(val)) {
            if (val.length > 0 && typeof val[0] === 'object' && val[0] !== null) {
                data[key] = filterBlockedItems(val);
            }
        } else if (typeof val === 'object' && val !== null) {
            cleanDeepArrays(val, depth + 1);
        }
    }
}

patchKnownPoints(obj);
cleanAd(obj);

$done({ body: JSON.stringify(obj) });
