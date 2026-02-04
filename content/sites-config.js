/**
 * 站点配置 - 类似 ChatTOC 的 sitesConfig，驱动各平台 DOM 选择器
 * 便于维护与扩展，选择器变更时只需修改此处
 */

const SUPPORTED_DOMAINS = [
  'chatgpt.com',
  'chat.openai.com',
  'gemini.google.com',
  'claude.ai',
  'chat.deepseek.com'
];

const SITES_CONFIG = {
  'chatgpt.com': {
    platformName: 'ChatGPT',
    platformIcon: 'https://chatgpt.com/favicon.ico',
    selectors: {
      container: 'main',
      mainContainer: 'main',
      userItem: 'div[data-message-author-role="user"]',
      assistantItem: 'div[data-message-author-role="assistant"]',
      turnItem: '[data-testid^="conversation-turn-"]',
      articleContainer: 'article',
      fallbackGroup: 'main [class*="group"], main .text-base',
    },
  },
  'chat.openai.com': {
    platformName: 'ChatGPT',
    platformIcon: 'https://chatgpt.com/favicon.ico',
    selectors: {
      container: 'main',
      mainContainer: 'main',
      userItem: 'div[data-message-author-role="user"]',
      assistantItem: 'div[data-message-author-role="assistant"]',
      turnItem: '[data-testid^="conversation-turn-"]',
      articleContainer: 'article',
      fallbackGroup: 'main [class*="group"], main .text-base',
    },
  },
  'claude.ai': {
    platformName: 'Claude',
    platformIcon: 'https://claude.ai/favicon.ico',
    selectors: {
      container: '[data-test-render-count]',
      mainContainer: '[data-test-render-count]',
      userItem: '[data-testid="user-message"]',
      assistantItem: '.font-claude-response',
    },
  },
  'gemini.google.com': {
    platformName: 'Gemini',
    platformIcon: 'https://www.gstatic.com/lamda/images/gemini_sparkle_v002_d4735304ff6292a690345.svg',
    useShadowDOM: true,
    selectors: {
      container: '#chat-history',
      mainContainer: '#chat-history',
      conversationBlock: '.conversation-container',
      userQuery: 'user-query .query-text',
      modelResponse: 'model-response',
      modelResponseText: '.model-response-text',
    },
  },
  'chat.deepseek.com': {
    platformName: 'DeepSeek',
    platformIcon: 'https://chat.deepseek.com/favicon.ico',
    selectors: {
      container: '.dad65929',
      mainContainer: '.dad65929',
      userMessage: '._9663006',
      aiMessage: '._4f9bf79._43c05b5',
      userText: '.fbb737a4',
      dsMessage: '.ds-message',
      dsMarkdown: '.ds-markdown',
      thinkingContainer: '.ds-think-content, .e1675d8b',
    },
  },
};

const DOMAIN_MAP = {
  'chat.openai.com': 'chatgpt.com',
};

/**
 * 根据 hostname 获取站点配置
 * 支持 chat.openai.com -> chatgpt.com 等映射
 * @param {string} hostname
 * @returns {Object|null}
 */
function getSiteConfig(hostname) {
  if (!hostname || typeof hostname !== 'string') return null;
  const key = DOMAIN_MAP[hostname] || hostname;
  return SITES_CONFIG[key] || null;
}

/**
 * 检查 hostname 是否在支持的平台中
 * @param {string} hostname
 * @returns {boolean}
 */
function isSupportedDomain(hostname) {
  if (!hostname) return false;
  return SUPPORTED_DOMAINS.some((d) => hostname.includes(d) || d.includes(hostname));
}

if (typeof window !== 'undefined') {
  window.SITES_CONFIG = SITES_CONFIG;
  window.getSiteConfig = getSiteConfig;
  window.isSupportedDomain = isSupportedDomain;
  window.SUPPORTED_DOMAINS_SITES = SUPPORTED_DOMAINS;
}
