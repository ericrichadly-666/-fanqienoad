/*
  番茄小说 fanqie.js (适配 7.2.x 版本)
  去广告 + 段评保护 + 屏蔽短剧/福利板块/商城
*/

let body = $response.body;
if (!body) $done({});

let obj;
try {
    obj = JSON.parse(body);
} catch (e) {
    $done({});
}

// ── 白名单：必须保护的用户核心体验 ──
// 采用严格匹配或边界匹配，防止误保诸如 "ad_user_info" 这种伪装字段
const WHITE_KEYS = ["comment", "paragraph", "ugc", "reply", "user", "author", "forum", "review", "interact"];

// ── 广告 key 匹配特征库 (应对 7.2.x 变异) ──
const AD_KEYS_PARTIAL = [
    "pangle", "interstitial", "splash", "ad_source", "ad_info", "ad_v2", 
    "ad_list", "ad_data", "ad_params", "ad_ext", "ad_extra", "ad_detail",
    "ad_config", "video_ad", "report_ad",
    "insert_ad", "banner_ad", "feed_ad", "draw_ad", "live_ad", "dsp_ad", // 7.2.x 常增字段
    "tt_ad", "bytedance_ad", "reward_video", "open_screen", "float_ad"
];

// ── 短剧/福利/商城 屏蔽关键词库 ──
const BLOCK_TAB_KEYWORDS = [
    "short_video", "drama", "movie", "短剧", "skit", "theater", // 影视/短剧
    "welfare", "benefit", "task", "gold_coin", "金币", "福利", // 福利任务
    "领券", "red_packet", "redpacket", "lucky", "bonus", "reward", // 奖励红包
    "game", "游戏", "sign_in", "signin", "checkin", // 游戏签到
    "activity", "活动", "invite", "邀请", "mall", "商城", "shopping" // 活动与电商
];

// 检查是否为白名单字段
function isWhiteKey(key) {
    const lower = key.toLowerCase();
    return WHITE_KEYS.some(w => lower === w || lower.startsWith(w + "_") || lower.endsWith("_" + w));
}

// 检查字段名是否包含广告特征
function isAdKey(key) {
    const lower = key.toLowerCase();
    return AD_KEYS_PARTIAL.some(k => lower.includes(k));
}

// 检查对象内部是否为广告实体
function isAdObject(val) {
    if (!val || typeof val !== 'object' || Array.isArray(val)) return false;
    if (val.is_ad === 1 || val.is_ad === true) return true;
    if (val.pangle_ad_type !== undefined) return true;
    if (val.ad_source === "pangle" || val.ad_source === "dsp") return true;
    if (val.log_extra && typeof val.log_extra === 'string' && val.log_extra.includes("pangle")) return true;
    // 7.2.x 新增类型判定
    if (val.ad_id || val.ad_model || val.req_id) {
        if (val.is_ad === 1 || Object.keys(val).some(k => k.includes("pangle"))) return true;
    }
    return false;
}

// ── 屏蔽特定的 Tab 或是 Card ──
function isBlockedTab(item) {
    if (!item || typeof item !== 'object') return false;
    
    // 直接拼接字符串，相比 Object.values.join 性能更好且不遗漏
    const checkString = (
        (item.tab_type || "") + " " + (item.tab_name || "") + " " + 
        (item.name || "") + " " + (item.title || "") + " " + 
        (item.schema || "") + " " + (item.url || "") + " " + 
        (item.type || "") + " " + (item.key || "") + " " + 
        (item.card_type || "") + " " + (item.section_type || "") + " " + 
        (item.module_type || "") + " " + (item.icon_name || "") + " " + 
        (item.route || "")
    ).toLowerCase();

    return BLOCK_TAB_KEYWORDS.some(k => checkString.includes(k.toLowerCase()));
}

// ── 递归清理广告，带深度与 null 保护 ──
function cleanAd(data, depth = 0) {
    if (depth > 20) return; // 防止爆栈

    if (Array.isArray(data)) {
        for (let i = data.length - 1; i >= 0; i--) {
            if (isAdObject(data[i])) {
                data.splice(i, 1);
            } else if (data[i] && typeof data[i] === 'object') {
                cleanAd(data[i], depth + 1);
            }
        }
    } else if (data && typeof data === 'object') {
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

// ── 定点处理已知数据挂载点 ──
function filterTabList(arr) {
    if (!Array.isArray(arr)) return arr;
    return arr.filter(item => !isBlockedTab(item));
}

function patchKnownPoints(obj) {
    const d = obj.data;
    if (!d) return;

    // 底部与顶部 Tab
    if (Array.isArray(d.tab_list))    d.tab_list    = filterTabList(d.tab_list);
    if (Array.isArray(d.tabs))        d.tabs        = filterTabList(d.tabs);
    if (Array.isArray(d.dynamic_tabs)) d.dynamic_tabs = filterTabList(d.dynamic_tabs);

    // 首页各 section / card / module
    if (Array.isArray(d.section_list)) d.section_list = filterTabList(d.section_list);
    if (Array.isArray(d.card_list))    d.card_list    = filterTabList(d.card_list);
    if (Array.isArray(d.module_list))  d.module_list  = filterTabList(d.module_list);
    if (Array.isArray(d.pages))        d.pages        = filterTabList(d.pages);

    // 「我的」页面条目
    if (Array.isArray(d.menu_list))    d.menu_list    = filterTabList(d.menu_list);
    if (Array.isArray(d.item_list))    d.item_list    = filterTabList(d.item_list);
    if (Array.isArray(d.entry_list))   d.entry_list   = filterTabList(d.entry_list);
    if (Array.isArray(d.func_list))    d.func_list    = filterTabList(d.func_list);

    // 信息流去重去广
    if (Array.isArray(d.book_list))    d.book_list    = d.book_list.filter(item => !isAdObject(item));
    if (Array.isArray(d.banner_list))  d.banner_list  = d.banner_list.filter(item => !isAdObject(item));
    if (Array.isArray(d.data_list))    d.data_list    = d.data_list.filter(item => !isAdObject(item)); // 新增 7.2.x 可能的通用列表流

    // 强制清除阅读器/听书界面的广告配置
    if (d.chapter_info) {
        delete d.chapter_info.ad_info;
        delete d.chapter_info.video_ad;
        delete d.chapter_info.ad_config;
    }
    if (d.audio_info) {
        delete d.audio_info.ad_info;
    }

    if (d.settings) {
        delete d.settings.ad_config;
        delete d.settings.splash;
    }
}

patchKnownPoints(obj);
cleanAd(obj);

$done({ body: JSON.stringify(obj) });
