import { beforeEach, describe, expect, it, vi } from 'vitest';

import '../../content/sidebar-conversations.js';

function createSidebarStub(shadowRoot) {
  return {
    shadowRoot,
    container: shadowRoot,
    exportState: {
      active: false,
      scope: null,
      selected: new Set(),
      formats: { json: false, md: false, txt: false }
    },
    tocFilterPlatforms: [],
    projectSectionCollapsed: {},
    _t: (key, params = {}) => {
      let out = String(key);
      Object.entries(params).forEach(([k, v]) => {
        out = out.replaceAll(`{${k}}`, String(v));
      });
      return out;
    },
    log: vi.fn(),
    escapeHtml: (text) => String(text),
    getPlatformIconUrl: () => 'icon.png',
    getIcon: () => '<svg></svg>',
    formatTimeAgo: () => 'now',
    highlightKeywordInText: (text) => text,
    hasActiveFilter: () => false,
    getFilterDateRange: () => ({ start: null, end: null }),
    syncExportSelectionUI: vi.fn(),
    showToast: vi.fn(),
    createDialog: vi.fn(),
    copyTextToClipboard: vi.fn(),
    showConfirmDialog: vi.fn().mockResolvedValue(true),
    openConversationInNewTab: vi.fn(),
    projectsModule: { showAddToProjectDialog: vi.fn() },
    tocMod: {
      findPreviewBreakpoint: () => 80,
      countKeywordOccurrences: () => 0,
      restoreMsgSearchOverlayForTab: vi.fn(),
      extractMessageHTMLForDisplay: () => ''
    }
  };
}

function createHistoryDOM() {
  const host = document.createElement('div');
  const root = host.attachShadow({ mode: 'open' });
  root.innerHTML = `
    <div id="conversations-search-and-filter-wrap"></div>
    <input id="conversations-search-input" />
    <input id="conv-detail-search-input" />
    <button id="btn-conversations-filter"></button>
    <div id="conversations-list-container"></div>
    <div id="conversation-detail-container"></div>
    <div id="conversations-by-platform"></div>
    <div id="conv-detail-header"></div>
    <div id="conv-detail-messages"></div>
    <button id="btn-open-conv"></button>
    <button id="btn-conv-back"></button>
  `;
  return { host, root };
}

describe('SidebarConversations', () => {
  let sidebar;
  let mod;

  beforeEach(() => {
    const { host, root } = createHistoryDOM();
    document.body.innerHTML = '';
    document.body.appendChild(host);

    sidebar = createSidebarStub(root);
    mod = new window.SidebarConversations(sidebar);

    window.projectManager = {
      getAutoProjects: vi.fn().mockReturnValue({}),
      removeFromAutoProject: vi.fn().mockResolvedValue(),
      getMyProjects: vi.fn().mockReturnValue({}),
      removeFromMyProject: vi.fn().mockResolvedValue(),
      deleteAutoProjectCategory: vi.fn().mockResolvedValue(),
      deleteChatGPTProjectCategory: vi.fn().mockResolvedValue()
    };

    window.storageManager = {
      getConversationList: vi.fn().mockResolvedValue([]),
      saveConversationList: vi.fn().mockResolvedValue(),
      deleteConversation: vi.fn().mockResolvedValue(),
      getConversation: vi.fn().mockResolvedValue({ messages: [], title: 'T', platform: 'ChatGPT' })
    };
  });

  it('renderConversationsList 在空项目数据下可正常渲染（回归 constlist 崩溃）', async () => {
    await expect(mod.renderConversationsList()).resolves.toBeUndefined();
    expect(window.storageManager.getConversationList).toHaveBeenCalledTimes(1);
    expect(sidebar.shadowRoot.getElementById('conversations-by-platform').innerHTML).toContain('empty.noConversations');
  });

  it('history 导出选中态使用 selected Set 键格式', async () => {
    sidebar.exportState.active = true;
    sidebar.exportState.scope = 'history';
    sidebar.exportState.selected = new Set(['history:conversation:c1']);

    window.projectManager.getAutoProjects.mockReturnValue({
      'ChatGPT:Inbox': { name: 'Inbox', platform: 'ChatGPT', conversations: ['c1'] }
    });
    window.storageManager.getConversationList.mockResolvedValue([
      { id: 'c1', title: 'Hello', snippet: 'World', messageCount: 2, lastSeenAt: 1, platform: 'ChatGPT' }
    ]);

    await mod.renderConversationsList();
    const selectedCard = sidebar.shadowRoot.querySelector('.conv-card.selected');
    expect(selectedCard).toBeTruthy();
    expect(selectedCard.getAttribute('data-conversation-id')).toBe('c1');
  });

  it('history 项目导出点包含 project-type/project-key 属性', async () => {
    window.projectManager.getAutoProjects.mockReturnValue({
      'ChatGPT:Inbox': { name: 'Inbox', platform: 'ChatGPT', conversations: ['c1'] }
    });
    window.storageManager.getConversationList.mockResolvedValue([
      { id: 'c1', title: 'Hello', snippet: 'World', messageCount: 2, lastSeenAt: 1, platform: 'ChatGPT' }
    ]);

    await mod.renderConversationsList();
    const dot = sidebar.shadowRoot.querySelector('.project-item .export-select-dot[data-type="project"]');
    expect(dot).toBeTruthy();
    expect(dot.getAttribute('data-project-type')).toBe('auto');
    expect(dot.getAttribute('data-project-key')).toBe('ChatGPT:Inbox');
  });

  it('点击历史卡片进入详情页而不是调用不存在的 runtime API', async () => {
    window.projectManager.getAutoProjects.mockReturnValue({
      'ChatGPT:Inbox': { name: 'Inbox', platform: 'ChatGPT', conversations: ['c1'] }
    });
    window.storageManager.getConversationList.mockResolvedValue([
      { id: 'c1', title: 'Hello', snippet: 'World', messageCount: 2, lastSeenAt: 1, platform: 'ChatGPT' }
    ]);

    const openDetailSpy = vi.spyOn(mod, 'renderConversationDetailInToc').mockResolvedValue();

    await mod.renderConversationsList();
    const card = sidebar.shadowRoot.querySelector('.conv-card');
    card.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));

    expect(openDetailSpy).toHaveBeenCalledWith('c1');
  });

  it('历史列表双击标题会走 editConversationTitle 路径', async () => {
    window.projectManager.getAutoProjects.mockReturnValue({
      'ChatGPT:Inbox': { name: 'Inbox', platform: 'ChatGPT', conversations: ['c1'] }
    });
    window.storageManager.getConversationList.mockResolvedValue([
      { id: 'c1', title: 'Hello', snippet: 'World', messageCount: 2, lastSeenAt: 1, platform: 'ChatGPT' }
    ]);

    const editSpy = vi.spyOn(mod, 'editConversationTitle').mockResolvedValue();

    await mod.renderConversationsList();
    const titleEl = sidebar.shadowRoot.querySelector('.conv-card-title-editable');
    titleEl.dispatchEvent(new window.MouseEvent('dblclick', { bubbles: true }));

    expect(editSpy).toHaveBeenCalledTimes(1);
    expect(editSpy.mock.calls[0][0]).toBe('c1');
  });

  it('历史列表支持删除自动分类（非 Inbox）', async () => {
    window.projectManager.getAutoProjects.mockReturnValue({
      'ChatGPT:Work': { name: 'Work', platform: 'ChatGPT', conversations: ['c1'] }
    });
    window.storageManager.getConversationList.mockResolvedValue([
      { id: 'c1', title: 'Hello', snippet: 'World', messageCount: 2, lastSeenAt: 1, platform: 'ChatGPT' }
    ]);
    await mod.renderConversationsList();
    const renderSpy = vi.spyOn(mod, 'renderConversationsList');
    const btn = sidebar.shadowRoot.querySelector('.project-header-action[data-action="delete-project"]');
    expect(btn).toBeTruthy();
    btn.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
    await Promise.resolve();
    await Promise.resolve();

    expect(window.projectManager.deleteAutoProjectCategory).toHaveBeenCalledWith('ChatGPT:Work');
    expect(renderSpy).toHaveBeenCalled();
  });

  it('DeepSeek 打开链接使用 /a/chat/s 路径', () => {
    const url = mod.getConversationOpenUrl('DeepSeek', 'a_chat_s_12345', '');
    expect(url).toBe('https://chat.deepseek.com/a/chat/s/12345');
  });

  it('silentDeleteConversation 会清理列表、项目引用和会话数据', async () => {
    window.storageManager.getConversationList.mockResolvedValue([
      { id: 'c1' },
      { id: 'c2' }
    ]);
    window.projectManager.getMyProjects.mockReturnValue({
      my_1: { conversations: ['c1', 'c3'] }
    });
    const renderSpy = vi.spyOn(mod, 'renderConversationsList').mockResolvedValue();

    await mod.silentDeleteConversation('c1');

    expect(window.storageManager.saveConversationList).toHaveBeenCalledWith([{ id: 'c2' }]);
    expect(window.projectManager.removeFromAutoProject).toHaveBeenCalledWith('c1');
    expect(window.projectManager.removeFromMyProject).toHaveBeenCalledWith('c1', 'my_1');
    expect(window.storageManager.deleteConversation).toHaveBeenCalledWith('c1');
    expect(renderSpy).toHaveBeenCalled();
  });

  it('历史列表按平台分块渲染', async () => {
    window.projectManager.getAutoProjects.mockReturnValue({
      'ChatGPT:Inbox': { name: 'Inbox (Auto)', platform: 'ChatGPT', conversations: ['c1'] },
      'Gemini:Inbox': { name: 'Inbox (Auto)', platform: 'Gemini', conversations: ['c2'] }
    });
    window.storageManager.getConversationList.mockResolvedValue([
      { id: 'c1', title: 'A', snippet: 'a', messageCount: 1, lastSeenAt: 2, platform: 'ChatGPT' },
      { id: 'c2', title: 'B', snippet: 'b', messageCount: 1, lastSeenAt: 1, platform: 'Gemini' }
    ]);

    await mod.renderConversationsList();

    expect(sidebar.shadowRoot.querySelector('.project-platform-block[data-platform="ChatGPT"]')).toBeTruthy();
    expect(sidebar.shadowRoot.querySelector('.project-platform-block[data-platform="Gemini"]')).toBeTruthy();
  });

  it('wrapLeadBoldInHtml 会返回带首段加粗的 HTML', () => {
    const html = '<p>Hello world</p>';
    const out = mod.wrapLeadBoldInHtml(html, 5);
    expect(out).toContain('<strong class="toc-content-lead">Hello</strong>');
  });
});
