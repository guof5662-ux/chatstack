/**
 * SidebarUI 图标与跳转方法拆分
 */
class SidebarUIIconMethods {

  getIcon(name) {
    const attrs = 'viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" class="sidebar-icon"';
    const attrsFill = 'viewBox="0 0 24 24" fill="currentColor" stroke="none" class="sidebar-icon"';
    const icons = {
      refresh: `<svg ${attrs}><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>`,
      settings: `<svg ${attrs}><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>`,
      close: `<svg ${attrs}><path d="M18 6L6 18"/><path d="m6 6 12 12"/></svg>`,
      list: `<svg ${attrs}><path d="M8 6h13"/><path d="M8 12h13"/><path d="M8 18h13"/><path d="M3 6h.01"/><path d="M3 12h.01"/><path d="M3 18h.01"/></svg>`,
      history: `<svg ${attrs}><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>`,
      folder: `<svg ${attrs}><path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z"/></svg>`,
      star: `<svg ${attrsFill}><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>`,
      starOutline: `<svg ${attrs}><path d="M12 2l2.4 7.4h7.6l-6 4.6 2.3 7-6.3-4.6-6.3 4.6 2.3-7-6-4.6h7.6z"/></svg>`,
      folderAdd: `<svg ${attrs}><path d="M12 10v6"/><path d="M9 13h6"/><path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z"/></svg>`,
      back: `<svg ${attrs}><path d="m15 18-6-6 6-6"/></svg>`,
      chevronDown: `<svg ${attrs}><path d="m6 9 6 6 6-6"/></svg>`,
      chevronUp: `<svg ${attrs}><path d="m18 15-6-6-6 6"/></svg>`,
      external: `<svg ${attrs}><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><path d="M15 3h6v6"/><path d="M10 14 21 3"/></svg>`,
      calendar: `<svg ${attrs}><rect width="18" height="18" x="3" y="4" rx="2" ry="2"/><path d="M16 2v4"/><path d="M8 2v4"/><path d="M3 10h18"/></svg>`,
      filter: `<svg ${attrs}><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/></svg>`,
      search: `<svg ${attrs}><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>`,
      copy: `<svg ${attrs}><rect width="14" height="14" x="9" y="9" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>`,
      export: `<svg ${attrs}><path d="M12 3v12"/><path d="m8 11 4 4 4-4"/><path d="M5 21h14"/></svg>`,
      user: `<svg ${attrs}><path d="M20 21a8 8 0 1 0-16 0"/><circle cx="12" cy="8" r="3.5"/></svg>`,
      bot: `<svg ${attrs}><rect x="4" y="7" width="16" height="12" rx="3"/><path d="M12 3v4"/><circle cx="9" cy="13" r="1.5"/><circle cx="15" cy="13" r="1.5"/></svg>`,
      edit: `<svg ${attrs}><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>`,
      trash: `<svg ${attrs}><path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="M6 6l1 14h10l1-14"/><path d="M10 11v6"/><path d="M14 11v6"/></svg>`,
      move: `<svg ${attrs}><path d="M3 7a2 2 0 0 1 2-2h5l2 2h7a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z"/><path d="M5 12h10"/><path d="m12 9 3 3-3 3"/></svg>`,
    };
    return icons[name] || '';
  }

  /**
   * 根据平台和对话 ID 获取「在浏览器中打开」的 URL
   * @param {string} platform - 平台名，如 ChatGPT / Gemini
   * @param {string} conversationId - 对话 ID
   * @param {string} [storedLink] - 保存时记录的对话页 URL，有则优先使用
   * @returns {string}
   */
  getConversationOpenUrl(platform, conversationId, storedLink) {
    if (storedLink && typeof storedLink === 'string' && storedLink.startsWith('http')) {
      return storedLink;
    }
    const id = (conversationId || '').trim();
    if (!id) return '';
    const name = (platform || 'ChatGPT').trim();
    if (name === 'Gemini') {
      return `https://gemini.google.com/app/${id}`;
    }
    if (name === 'Claude') {
      const pathId = id.replace(/_/g, '/');
      return `https://claude.ai/chat/${pathId}`;
    }
    if (name === 'DeepSeek') {
      const pathId = id.replace(/_/g, '/');
      return `https://chat.deepseek.com/${pathId}`;
    }
    if (name === 'ChatGPT') {
      return `https://chatgpt.com/c/${id}`;
    }
    return `https://chatgpt.com/c/${id}`;
  }

  /**
   * 在浏览器新标签页打开指定对话（会先拉取对话数据以获取 link/platform）
   */
  async openConversationInNewTab(conversationId) {
    if (!conversationId) return;
    try {
      const conv = await window.storageManager.getConversation(conversationId);
      const platform = (conv && conv.platform) ? conv.platform : 'ChatGPT';
      const link = conv && conv.link ? conv.link : '';
      const url = this.getConversationOpenUrl(platform, conversationId, link);

      // 如果是打开当前平台的对话，先做一次轻量校验。
      // 注意：DOM 侧栏/虚拟列表可能不完整，校验结果不作为删除依据。
      if (this.isCurrentPlatform(platform)) {
        const exists = this.checkConversationExists(conversationId);
        if (!exists) {
          this.log('Conversation not found in current DOM snapshot, open anyway:', conversationId);
          this.showToast(this._t('toast.convMayNeedManualOpen'));
        }
      }

      if (url) window.open(url, '_blank');
    } catch (e) {
      this.log('openConversationInNewTab error:', e);
      const url = this.getConversationOpenUrl('ChatGPT', conversationId, '');
      if (url) window.open(url, '_blank');
    }
  }

  /**
   * 检查当前平台上对话是否存在
   * 通过扫描当前页面DOM中的对话链接来验证
   */
  checkConversationExists(conversationId) {
    if (this.dataModule) return this.dataModule.checkConversationExists(conversationId);
    return true;
  }

  /**
   * 检查当前运行环境是否在目标平台上
   */
  isCurrentPlatform(platform) {
    if (!window.platformAdapter) return false;
    return this.isSamePlatform(platform, window.platformAdapter.getPlatformName());
  }

  /**
   * 比较两个平台名称是否相同
   */
  isSamePlatform(platform1, platform2) {
    if (!platform1 || !platform2) return false;
    return platform1.toLowerCase() === platform2.toLowerCase();
  }

  /** 根据平台名称返回平台 logo URL（用于历史/项目卡片），优先使用扩展内本地图标 */
  getPlatformIconUrl(platformName) {
    const name = (platformName || '').trim() || 'ChatGPT';
    if (this.isExtensionContextValid() && chrome.runtime.getURL) {
      const local = {
        ChatGPT: 'icons/chatgpt.png',
        Gemini: 'icons/gemini.svg',
        Claude: 'icons/claude.ico',
        DeepSeek: 'icons/deepseek.png',
      };
      if (local[name]) return chrome.runtime.getURL(local[name]);
    }
    return '';
  }

  /** 导出条 HTML：scope 为 toc | history | projects，对应当前对话/历史/项目三种导出范围 */
  getExportBarHTML(scope) {
    return this.exportMod ? this.exportMod.getExportBarHTML(scope) : '';
  }
}

(function (global) {
  const SidebarUIClass = global.SidebarUI || null;
  if (!SidebarUIClass) return;
  const proto = SidebarUIIconMethods.prototype;
  Object.getOwnPropertyNames(proto).forEach((name) => {
    if (name === "constructor") return;
    SidebarUIClass.prototype[name] = proto[name];
  });
})(typeof globalThis !== "undefined" ? globalThis : window);
