import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import '../../content/sidebar-data.js';

describe('SidebarData.checkConversationExists', () => {
  let sidebar;
  let mod;
  let originalLocation;

  beforeEach(() => {
    sidebar = {
      _t: (key) => key,
      log: vi.fn()
    };
    mod = new window.SidebarData(sidebar);
    window.platformAdapter = { getPlatformName: () => 'ChatGPT' };

    originalLocation = window.location;
  });

  it('当 DOM 中没有会话链接时返回 true（保守判断，避免误删）', () => {
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: { hostname: 'chatgpt.com' }
    });
    document.body.innerHTML = '<div>No conversations rendered</div>';

    expect(mod.checkConversationExists('c1')).toBe(true);
  });

  it('DeepSeek 会话 ID 支持下划线和短横线', () => {
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: { hostname: 'chat.deepseek.com' }
    });
    document.body.innerHTML = '<a href="https://chat.deepseek.com/a/chat/s/id_1-2">conv</a>';

    expect(mod.checkConversationExists('a_chat_s_id_1-2')).toBe(true);
  });

  afterEach(() => {
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: originalLocation
    });
  });
});
