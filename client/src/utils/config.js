/**
 * 鱼价查 · UniApp 客户端配置
 *
 * 一套代码四端编译：
 *   - 微信小程序：uni build -p mp-weixin
 *   - iOS / Android App：uni build -p app
 *   - H5（网站 / 预览）：uni build
 */
export const APP_NAME = '鱼价查';
export const APP_VERSION = '1.0.0';

/** 后端 API 基址：按运行环境区分 */
const BASES = {
  // H5 同源部署（后端已托管 H5 产物）
  h5: '',
  // 微信小程序：微信要求 HTTPS 且域名需在白名单中（在微信公众平台配置 request 合法域名）
  'mp-weixin': 'https://api.yujiacha.example.com',
  // App：可直接指向生产 API
  app: 'https://api.yujiacha.example.com',
};

export function apiBase() {
  // #ifdef H5
  // H5 走同源，避免跨域
  if (typeof location !== 'undefined' && location.origin) return '';
  // #endif
  // #ifdef MP-WEIXIN
  return BASES['mp-weixin'];
  // #endif
  // #ifdef APP-PLUS
  return BASES.app;
  // #endif
  return BASES.h5;
}

export const TOKEN_KEY = 'yjt_token';
export const REFRESH_KEY = 'yjt_refresh';
export const USER_KEY = 'yjt_user';
export const THEME_KEY = 'yjt_theme';
export const WATCH_KEY = 'yjt_watchlist';

/** 价格档位（说明书 3.1.1，阈值以元/斤为单位） */
export const PRICE_TIERS = [
  { tier: 'low', label: '低位', min: 0, max: 26, color: '#2F7ED8' },
  { tier: 'mid', label: '中位', min: 26, max: 36, color: '#F5A623' },
  { tier: 'high', label: '高位', min: 36, max: Infinity, color: '#E0503C' },
];

/** 主题（F9：深色 / 浅色 / 学术白底） */
export const THEMES = [
  { id: 'light', name: '浅色', desc: '默认浅色主题' },
  { id: 'dark', name: '深色', desc: '近黑青背景，适合夜间与大屏监测墙' },
  { id: 'academic', name: '学术白底', desc: '白底 + 青色点缀，适合教研与报告截图' },
];

export const HOT_SEARCH = ['大黄鱼', '梭子蟹', '对虾', '生蚝', '鲍鱼', '贝类'];

export const SOURCE_NAME = '农业农村部全国农产品价格信息系统';
export const SOURCE_URL = 'https://pfsc.agri.cn';
