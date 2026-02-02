/**
 * Service Worker：扩展图标点击时向当前标签页发送 TOGGLE_SIDEBAR
 */
chrome.action.onClicked.addListener(async (tab) => {
  if (!tab || !tab.id || !tab.url) return;
  const url = tab.url;
  if (!url.includes('chat.openai.com') && !url.includes('chatgpt.com')) return;
  try {
    await chrome.tabs.sendMessage(tab.id, { type: 'TOGGLE_SIDEBAR' });
  } catch (e) {
    // Content script 未注入（如页面未刷新过）时可能报错，忽略
  }
});
