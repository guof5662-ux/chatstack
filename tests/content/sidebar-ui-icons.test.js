import { beforeEach, describe, expect, it, vi } from 'vitest';

import '../../content/sidebar.js';
import '../../content/sidebar-ui-icons.js';

describe('SidebarUIIconMethods', () => {
  beforeEach(() => {
    window.storageManager = {
      getConversation: vi.fn().mockResolvedValue({
        id: 'c1',
        platform: 'ChatGPT',
        link: ''
      })
    };
    window.open = vi.fn();
  });

  it('openConversationInNewTab 在 DOM 校验失败时不会删除本地记录', async () => {
    const proto = window.SidebarUI.prototype;
    const context = {
      getConversationOpenUrl: proto.getConversationOpenUrl,
      isCurrentPlatform: () => true,
      checkConversationExists: () => false,
      silentDeleteConversation: vi.fn(),
      showToast: vi.fn(),
      _t: () => 'warn',
      log: vi.fn(),
      dataModule: null
    };

    await proto.openConversationInNewTab.call(context, 'c1');

    expect(context.silentDeleteConversation).not.toHaveBeenCalled();
    expect(context.showToast).toHaveBeenCalledWith('warn');
    expect(window.open).toHaveBeenCalledWith('https://chatgpt.com/c/c1', '_blank');
  });
});
