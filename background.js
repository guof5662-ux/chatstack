/**
 * Service Worker：扩展图标点击时向当前标签页发送 TOGGLE_SIDEBAR
 * 支持多平台：ChatGPT、Gemini 等
 */

// 支持的平台域名
const SUPPORTED_DOMAINS = [
  'chat.openai.com',
  'chatgpt.com',
  'gemini.google.com',
  'claude.ai',
  'chat.deepseek.com'
];

chrome.action.onClicked.addListener(async (tab) => {
  if (!tab || !tab.id || !tab.url) return;
  const url = tab.url;

  // 检查是否为支持的域名
  const isSupported = SUPPORTED_DOMAINS.some(domain => url.includes(domain));
  if (!isSupported) return;

  try {
    await chrome.tabs.sendMessage(tab.id, { type: 'TOGGLE_SIDEBAR' });
  } catch (e) {
    // Content script 未注入（如页面未刷新过）时可能报错，忽略
  }
});
