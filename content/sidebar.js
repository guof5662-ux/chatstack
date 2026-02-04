/**
 * 侧边栏 UI 管理器 - 使用 Shadow DOM 注入侧边栏
 */

class SidebarUI {
  constructor() {
    this.DEBUG = true;
    this.shadowHost = null;
    this.shadowRoot = null;
    this.container = null;
    this.currentTab = 'toc';
    this.conversationId = null;
    this.messages = [];
    this.userClosed = false;
    this.viewingConversationId = null;
    this.tocFilterRole = 'all';
    this.tocFilterFavorite = false;
    this.tocFavoriteMessageIds = new Set();
    this.currentMsgSearchMessageId = null;
    this.currentMsgSearchElement = null;
    this.msgSearchFloatRoot = null;
    this.floatButton = null;
    this.sidebarWidth = 320;
    this._resizeStartX = 0;
    this._resizeStartWidth = 0;
    this.currentTocView = 'toc'; // 'toc' | 'conversations'
    this.tocFilterDateRange = null; // 'today' | 'last3Days' | 'last7Days' | 'custom'
    this.tocFilterStartDate = null;
    this.tocFilterEndDate = null;
    this.tocFilterPlatforms = []; // ['ChatGPT','Claude','Gemini'] 空表示不过滤
    this.tocFilterPanelOpen = false;
    this.conversationsSearchKeyword = '';
    this.projectsSearchKeyword = '';
    this.conversationsFilterPanelOpen = false;
    this.projectsFilterPanelOpen = false;
    // 项目标签内视图状态：切到其他标签再切回时恢复（list | conversation）
    this.projectsViewState = { level: 'list', projectType: null, projectKey: null, conversationId: null, conversationTitle: null, searchKeyword: '' };
    this.projectSectionCollapsed = { auto: false, my: false };
    // 历史页：记录已展开的项目，避免重渲染后自动收回
    this.historyExpandedProjects = new Set();
    // 历史页：记录已收起的分区（如 ChatGPT 的“项目/你的聊天”）
    this.historySectionCollapsed = new Set();
    // 项目页：记录已展开的项目，避免重渲染后自动收回
    this.projectsExpandedItems = new Set();
    this.lastNonSettingsTab = 'toc';
    this.msgSearchPersist = null;
    // 导出模式状态
    this.exportState = { active: false, scope: null, selected: new Set(), formats: { json: false, md: false, txt: false }, zip: false };
    this.exportMod = typeof globalThis.SidebarExport !== 'undefined' ? new globalThis.SidebarExport(this) : null;
    this.tocMod = typeof globalThis.SidebarTOC !== 'undefined' ? new globalThis.SidebarTOC(this) : null;
    this.filterMod = typeof globalThis.SidebarFilters !== 'undefined' ? new globalThis.SidebarFilters(this) : null;
  }

  log(...args) {
    if (this.DEBUG) {
      console.log('[SidebarUI]', ...args);
    }
  }

  /**
   * 检查扩展上下文是否有效（扩展重载后旧脚本上下文会失效）
   * @returns {boolean}
   */
  isExtensionContextValid() {
    try {
      return !!(chrome && chrome.runtime && chrome.runtime.id);
    } catch (e) {
      return false;
    }
  }

  /** 取当前语言的文案，供 JS 动态渲染用；支持 _t(key, { n: 1 }) 等参数替换 */
  _t(key, params) {
    return window.i18nManager ? window.i18nManager.t(key, params || {}) : key;
  }

  /** 极简线型图标（24x24，stroke 1.5，统一风格） */
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
      if (url) window.open(url, '_blank');
    } catch (e) {
      this.log('openConversationInNewTab error:', e);
      const url = this.getConversationOpenUrl('ChatGPT', conversationId, '');
      if (url) window.open(url, '_blank');
    }
  }

  /** 根据平台名称返回平台 logo URL（用于历史/项目卡片） */
  getPlatformIconUrl(platformName) {
    const name = (platformName || '').trim() || 'ChatGPT';
    const urls = {
      ChatGPT: 'https://chatgpt.com/favicon.ico',
      Gemini: 'https://www.gstatic.com/lamda/images/gemini_sparkle_v002_d4735304ff6292a690345.svg',
      Claude: 'https://claude.ai/favicon.ico',
    };
    return urls[name] || urls.ChatGPT;
  }

  getExportBarHTML(scope) {
    return this.exportMod ? this.exportMod.getExportBarHTML(scope) : '';
  }

  /**
   * 注入侧边栏到页面
   */
  inject() {
    if (!this.isExtensionContextValid()) {
      this.log('Extension context invalidated, skipping inject');
      return;
    }

    const existing = document.getElementById('chatgpt-sidebar-extension');
    if (existing && existing.isConnected) {
      this.shadowHost = existing;
      this.shadowRoot = existing.shadowRoot;
      this.container = this.shadowRoot ? this.shadowRoot.querySelector('.sidebar-container') : null;
      this.log('Sidebar already in DOM');
      this.createFloatButton();
      this.applySavedWidth();
      this.applyInitialSidebarState();
      return;
    }
    if (this.shadowHost && !this.shadowHost.isConnected) {
      this.shadowHost = null;
      this.shadowRoot = null;
      this.container = null;
    }
    this.shadowHost = document.createElement('div');
    this.shadowHost.id = 'chatgpt-sidebar-extension';
    document.body.appendChild(this.shadowHost);
    this.shadowRoot = this.shadowHost.attachShadow({ mode: 'open' });
    this.loadStyles();
    this.createContainer();
    this.createFloatButton();
    this.applyInitialSidebarState();
    this.log('Sidebar injected');
  }

  /**
   * 根据 config.sidebarOpen 决定首屏显示侧边栏还是悬浮图标
   */
  async applyInitialSidebarState() {
    try {
      if (!window.storageManager || typeof window.storageManager.getConfig !== 'function') {
        this.userClosed = true;
        this.hide();
        return;
      }
      const config = await window.storageManager.getConfig();
      if (config && config.sidebarOpen === true) {
        this.userClosed = false;
        this.show();
      } else {
        this.userClosed = true;
        this.hide();
      }
    } catch (e) {
      this.log('applyInitialSidebarState error:', e);
      this.userClosed = true;
      this.hide();
    }
  }

  /**
   * 加载样式到 Shadow DOM
   */
  async loadStyles() {
    try {
      if (!this.isExtensionContextValid()) {
        this.log('Extension context invalidated, skipping loadStyles');
        return;
      }
      const styleUrl = chrome.runtime.getURL('content/sidebar.css');
      const response = await fetch(styleUrl);
      const cssText = await response.text();

      const style = document.createElement('style');
      style.textContent = cssText;
      this.shadowRoot.appendChild(style);
    } catch (error) {
      if (error && error.message && error.message.includes('Extension context invalidated')) {
        this.log('Extension context invalidated during loadStyles');
        return;
      }
      console.error('[SidebarUI] loadStyles error:', error);
    }
  }

  /**
   * 创建侧边栏容器
   */
  createContainer() {
    if (!this.isExtensionContextValid()) {
      this.log('Extension context invalidated, skipping createContainer');
      return;
    }

    this.container = document.createElement('div');
    this.container.className = 'sidebar-container sidebar-hidden';

    // 检测暗色模式
    if (this.isDarkMode()) {
      this.container.classList.add('dark');
    }

    const iconUrl = this.isExtensionContextValid() ? chrome.runtime.getURL('icons/float-icon.png') : '';
    this.container.innerHTML = `
      <div class="sidebar-resize-handle" id="sidebar-resize-handle" data-i18n-title="action.dragToResize" title="拖拽调整宽度"></div>
      <div class="sidebar-card">
      <div class="sidebar-header">
        <img src="${iconUrl}" alt="" class="sidebar-header-icon" />
        <div class="sidebar-header-right">
          <div class="sidebar-header-top">
            <h2 class="sidebar-title" data-i18n="header.title">ChatStack</h2>
            <div class="sidebar-header-actions">
              <button type="button" class="sidebar-refresh-btn" id="btn-sidebar-refresh" data-i18n-title="header.refresh" data-i18n-aria-label="header.refresh" title="刷新" aria-label="刷新">${this.getIcon('refresh')}</button>
              <button type="button" class="sidebar-refresh-btn" id="btn-sidebar-settings" data-i18n-title="header.settings" data-i18n-aria-label="header.settings" title="设置" aria-label="设置">${this.getIcon('settings')}</button>
              <button type="button" class="sidebar-close-btn" id="btn-sidebar-close" data-i18n-title="header.close" data-i18n-aria-label="header.close" title="关闭" aria-label="关闭">${this.getIcon('close')}</button>
            </div>
          </div>
          <p class="sidebar-subtitle" data-i18n="header.subtitle">AI 对话侧边导航与重构工具</p>
        </div>
      </div>

      <div class="tab-nav">
        <button class="tab-button active" data-tab="toc">${this.getIcon('list')} <span data-i18n="tab.current">当前对话</span></button>
        <button class="tab-button" data-tab="conversations">${this.getIcon('history')} <span data-i18n="tab.history">历史</span></button>
        <button class="tab-button" data-tab="projects">${this.getIcon('folder')} <span data-i18n="tab.projects">项目</span></button>
      </div>

      <div class="sidebar-content">
        <div class="tab-panel active" data-panel="toc">
          <!-- 当前对话：上方搜索+筛选，下方可滚动对话区 -->
          <div class="toc-view toc-view-with-bottom" id="toc-view-current" data-view="toc" style="display: flex;">
            <div class="toc-view-top">
              <div class="search-box search-box-with-filter">
                <input type="text" class="search-input" data-i18n-placeholder="filter.search.messages" placeholder="搜索消息内容..." id="search-input" aria-label="搜索消息">
                <button type="button" class="search-filter-btn search-export-btn" id="btn-toc-export" data-i18n-title="action.export" data-i18n-aria-label="action.export" title="导出" aria-label="导出">${this.getIcon('export')}</button>
              </div>
              ${this.getExportBarHTML('toc')}
              <div class="toc-filters">
                <button type="button" class="toc-filter-btn active" data-filter-role="all"><span data-i18n="filter.all">全部</span></button>
                <button type="button" class="toc-filter-btn" data-filter-role="user"><span data-i18n="filter.user">用户</span></button>
                <button type="button" class="toc-filter-btn" data-filter-role="assistant"><span data-i18n="filter.ai">AI</span></button>
                <button type="button" class="toc-filter-btn" data-filter-favorite="true" id="toc-filter-favorite">${this.getIcon('star')} <span data-i18n="filter.favorite">收藏</span></button>
                <button type="button" class="toc-filter-btn toc-add-to-project-btn" id="toc-btn-add-to-project" data-i18n-title="filter.addToProject" title="添加到项目">${this.getIcon('folderAdd')} <span data-i18n="filter.addToProject">添加到项目</span></button>
              </div>
            </div>
            <div class="toc-view-scroll">
              <div id="search-results" style="display: none;">
                <h4 style="font-size: 12px; color: #6b7280; margin: 0 0 8px 0;" data-i18n="empty.searchResults">搜索结果</h4>
                <ul class="search-results" id="search-results-list"></ul>
              </div>
              <div id="toc-content">
                <ul class="toc-list" id="toc-list"></ul>
              </div>
            </div>
            <div class="toc-summary" id="toc-summary"></div>
          </div>

          <!-- 对话列表视图 -->
          <div class="toc-view" id="toc-view-conversations" data-view="conversations" style="display: none;">
            <div class="search-and-filter-wrap" id="conversations-search-and-filter-wrap">
              <div class="search-box search-box-with-filter">
                <input type="text" class="search-input" data-i18n-placeholder="filter.search.conversations" placeholder="搜索对话标题或内容..." id="conversations-search-input" aria-label="搜索历史对话">
                <button type="button" class="search-filter-btn" id="btn-conversations-filter" data-i18n-title="filter.filter" data-i18n-aria-label="filter.filter" title="筛选" aria-label="筛选">${this.getIcon('filter')}</button>
                <button type="button" class="search-filter-btn search-export-btn" id="btn-conversations-export" data-i18n-title="action.export" data-i18n-aria-label="action.export" title="导出" aria-label="导出">${this.getIcon('export')}</button>
              </div>
              <div class="filter-panel" id="conversations-filter-panel" style="display: none;" role="dialog" data-i18n-aria-label="filter.filterDialogAria" aria-label="筛选条件">
                <div class="filter-panel-section">
                  <div class="filter-panel-label" data-i18n="filter.dateRange">日期范围</div>
                  <div class="filter-panel-buttons">
                    <button type="button" class="filter-range-btn" data-range="today" data-i18n="filter.today">今天</button>
                    <button type="button" class="filter-range-btn" data-range="last3Days" data-i18n="filter.last3Days">最近3天</button>
                    <button type="button" class="filter-range-btn" data-range="last7Days" data-i18n="filter.last7Days">最近7天</button>
                  </div>
                </div>
                <div class="filter-panel-section filter-panel-dates-section">
                  <div class="filter-panel-dates-row">
                    <div class="filter-date-group">
                      <label class="filter-panel-label" data-i18n="filter.startDate">开始日期</label>
                      <div class="filter-date-wrap">
                        <input type="text" class="filter-date-input" id="conv-filter-start-date" placeholder="yyyy/mm/dd" />
                        <button type="button" class="filter-date-calendar-btn" data-for="conv-filter-start-date" data-i18n-title="filter.selectDate" title="选择日期">${this.getIcon('calendar')}</button>
                      </div>
                    </div>
                    <div class="filter-date-group">
                      <label class="filter-panel-label" data-i18n="filter.endDate">结束日期</label>
                      <div class="filter-date-wrap">
                        <input type="text" class="filter-date-input" id="conv-filter-end-date" placeholder="yyyy/mm/dd" />
                        <button type="button" class="filter-date-calendar-btn" data-for="conv-filter-end-date" data-i18n-title="filter.selectDate" title="选择日期">${this.getIcon('calendar')}</button>
                      </div>
                    </div>
                  </div>
                </div>
                <div class="filter-panel-section">
                  <div class="filter-panel-label" data-i18n="filter.platform">平台来源</div>
                  <div class="filter-platform-select" id="conv-filter-platform-trigger" data-i18n="filter.selectPlatform">点击选择平台</div>
                  <div class="filter-platform-options" id="conv-filter-platform-options" style="display: none;">
                    <label class="filter-platform-option"><input type="checkbox" value="ChatGPT" /> ChatGPT</label>
                    <label class="filter-platform-option"><input type="checkbox" value="Claude" /> Claude</label>
                    <label class="filter-platform-option"><input type="checkbox" value="Gemini" /> Gemini</label>
                  </div>
                </div>
                <div class="filter-panel-actions">
                  <button type="button" class="btn btn-primary btn-small" id="btn-conv-filter-apply" data-i18n="filter.apply">筛选</button>
                  <button type="button" class="btn btn-secondary btn-small" id="btn-conv-filter-clear" data-i18n="filter.clear">清除筛选</button>
                </div>
              </div>
            </div>
            ${this.getExportBarHTML('history')}
            <div id="conversations-list-container">
              <div id="conversations-by-platform" class="conversations-by-platform"></div>
            </div>
            <div id="conversation-detail-container" style="display: none;">
              <div class="conv-detail-top">
                <div class="conv-detail-toolbar">
                  <button type="button" class="btn btn-conv-back-icon" id="btn-conv-back" data-i18n-title="action.backToList" data-i18n-aria-label="action.backToList" title="返回列表" aria-label="返回列表">${this.getIcon('back')}</button>
                  <div class="toc-filters conv-detail-filters" id="conv-detail-filters">
                  <button type="button" class="toc-filter-btn active" data-filter-role="all"><span data-i18n="filter.all">全部</span></button>
                  <button type="button" class="toc-filter-btn" data-filter-role="user"><span data-i18n="filter.user">用户</span></button>
                  <button type="button" class="toc-filter-btn" data-filter-role="assistant"><span data-i18n="filter.ai">AI</span></button>
                  <button type="button" class="toc-filter-btn" data-filter-favorite="true">${this.getIcon('star')} <span data-i18n="filter.favorite">收藏</span></button>
                  <button type="button" class="toc-filter-btn toc-add-to-project-btn" id="conv-detail-add-to-project" data-i18n-title="filter.addToProject" title="添加到项目">${this.getIcon('folderAdd')} <span data-i18n="filter.addToProject">添加到项目</span></button>
                  </div>
                </div>
                <div class="search-box conv-detail-search-wrap">
                  <input type="text" class="search-input" data-i18n-placeholder="filter.search.currentConv" placeholder="搜索当前对话内容..." id="conv-detail-search-input" aria-label="搜索当前对话内容">
                </div>
                <div id="conv-detail-header"></div>
              </div>
              <div class="conv-detail-scroll">
                <div id="conv-detail-messages"></div>
              </div>
              <button type="button" class="btn btn-primary btn-small" id="btn-open-conv" style="margin-top: 8px;" data-i18n="action.openInChatGPT">在 ChatGPT 中打开</button>
            </div>
          </div>
        </div>

        <!-- Projects Tab -->
        <div class="tab-panel" data-panel="projects">
          <div class="search-and-filter-wrap" id="projects-search-and-filter-wrap">
            <div class="search-box search-box-with-filter">
              <input type="text" class="search-input" data-i18n-placeholder="filter.search.projects" placeholder="搜索项目或对话标题..." id="projects-search-input" aria-label="搜索项目">
              <button type="button" class="search-filter-btn" id="btn-projects-filter" data-i18n-title="filter.filter" data-i18n-aria-label="filter.filter" title="筛选" aria-label="筛选">${this.getIcon('filter')}</button>
              <button type="button" class="search-filter-btn search-export-btn" id="btn-projects-export" data-i18n-title="action.export" data-i18n-aria-label="action.export" title="导出" aria-label="导出">${this.getIcon('export')}</button>
            </div>
            <div class="filter-panel" id="projects-filter-panel" style="display: none;" role="dialog" data-i18n-aria-label="filter.filterDialogAria" aria-label="筛选条件">
              <div class="filter-panel-section">
                <div class="filter-panel-label" data-i18n="filter.dateRange">日期范围</div>
                <div class="filter-panel-buttons">
                  <button type="button" class="filter-range-btn" data-range="today" data-i18n="filter.today">今天</button>
                  <button type="button" class="filter-range-btn" data-range="last3Days" data-i18n="filter.last3Days">最近3天</button>
                  <button type="button" class="filter-range-btn" data-range="last7Days" data-i18n="filter.last7Days">最近7天</button>
                </div>
              </div>
              <div class="filter-panel-section filter-panel-dates-section">
                <div class="filter-panel-dates-row">
                  <div class="filter-date-group">
                    <label class="filter-panel-label" data-i18n="filter.startDate">开始日期</label>
                    <div class="filter-date-wrap">
                      <input type="text" class="filter-date-input" id="projects-filter-start-date" placeholder="yyyy/mm/dd" />
                      <button type="button" class="filter-date-calendar-btn" data-for="projects-filter-start-date" data-i18n-title="filter.selectDate" title="选择日期">${this.getIcon('calendar')}</button>
                    </div>
                  </div>
                  <div class="filter-date-group">
                    <label class="filter-panel-label" data-i18n="filter.endDate">结束日期</label>
                    <div class="filter-date-wrap">
                      <input type="text" class="filter-date-input" id="projects-filter-end-date" placeholder="yyyy/mm/dd" />
                      <button type="button" class="filter-date-calendar-btn" data-for="projects-filter-end-date" data-i18n-title="filter.selectDate" title="选择日期">${this.getIcon('calendar')}</button>
                    </div>
                  </div>
                </div>
              </div>
              <div class="filter-panel-section">
                <div class="filter-panel-label" data-i18n="filter.platform">平台来源</div>
                <div class="filter-platform-select" id="projects-filter-platform-trigger" data-i18n="filter.selectPlatform">点击选择平台</div>
                <div class="filter-platform-options" id="projects-filter-platform-options" style="display: none;">
                  <label class="filter-platform-option"><input type="checkbox" value="ChatGPT" /> ChatGPT</label>
                  <label class="filter-platform-option"><input type="checkbox" value="Claude" /> Claude</label>
                  <label class="filter-platform-option"><input type="checkbox" value="Gemini" /> Gemini</label>
                </div>
              </div>
              <div class="filter-panel-actions">
                <button type="button" class="btn btn-primary btn-small" id="btn-projects-filter-apply" data-i18n="filter.apply">筛选</button>
                <button type="button" class="btn btn-secondary btn-small" id="btn-projects-filter-clear" data-i18n="filter.clear">清除筛选</button>
              </div>
            </div>
          </div>
          ${this.getExportBarHTML('projects')}
          <div class="project-section" id="my-projects-section">
            <div class="project-section-header" data-section="my">
              <div class="project-section-title-row">
                <h3 class="project-section-title" data-i18n="project.myProjects">我创建的项目</h3>
                <button class="btn btn-primary btn-small project-header-create-btn" id="btn-create-project" data-i18n="project.create">+ 新建项目</button>
                <span class="project-section-toggle" aria-hidden="true">${this.getIcon('chevronDown')}</span>
              </div>
            </div>
            <ul class="project-list" id="my-projects-list"></ul>
          </div>
        </div>

        <!-- Settings Tab (opened via header Settings button) -->
        <div class="tab-panel" data-panel="settings">
          <div class="settings-panel">
            <div class="settings-header">
              <button type="button" class="settings-back-btn" id="btn-settings-back" data-i18n-title="action.back" data-i18n-aria-label="action.back" title="返回" aria-label="返回">
                ${this.getIcon('back')}
                <span class="settings-back-text" data-i18n="action.back">返回</span>
              </button>
            </div>
            <!-- 自动保存开关 -->
            <div class="settings-section">
              <h3 class="settings-section-title" data-i18n="settings.autoSave.title">自动保存</h3>
              <label class="toggle-switch">
                <input type="checkbox" id="toggle-auto-save" checked>
                <span class="toggle-slider"></span>
                <span class="toggle-label" data-i18n="settings.autoSave.label">自动解析对话并同步历史</span>
              </label>
              <p class="settings-hint" data-i18n="settings.autoSave.hint">关闭后对话不会自动解析，也不会同步到历史记录</p>
            </div>

            <!-- 显示语言 -->
            <div class="settings-section">
              <h3 class="settings-section-title" data-i18n="settings.language.title">显示语言</h3>
              <div class="settings-select-group">
                <select id="select-language" class="settings-select">
                  <option value="auto" data-i18n="settings.language.auto">跟随系统</option>
                  <option value="zh">中文</option>
                  <option value="en">English</option>
                </select>
              </div>
            </div>

            <!-- 显示风格 -->
            <div class="settings-section">
              <h3 class="settings-section-title" data-i18n="settings.theme.title">显示风格</h3>
              <div class="settings-select-group">
                <select id="select-theme" class="settings-select">
                  <option value="auto" data-i18n="settings.theme.auto">跟随系统</option>
                  <option value="light" data-i18n="settings.theme.light">浅色模式</option>
                  <option value="dark" data-i18n="settings.theme.dark">深色模式</option>
                </select>
              </div>
            </div>

            <!-- 数据管理 -->
            <div class="settings-section">
              <h3 class="settings-section-title" data-i18n="settings.data.title">数据管理</h3>
              <div class="settings-buttons">
                <button class="btn btn-danger" id="btn-clear-data" data-i18n="settings.data.clearAll">清空所有数据</button>
              </div>
            </div>

            <!-- 版本信息 -->
            <div class="settings-footer">
              <p>ChatGPT Sidebar Navigator v1.0.0</p>
            </div>
          </div>
        </div>
      </div>
      </div>
    `;

    this.shadowRoot.appendChild(this.container);

    this.applySidebarWidth(this.sidebarWidth);
    this.applySavedWidth();
    this.createFloatButton();
    this.bindEvents();
    this.initSettings();
  }

  getLayoutRoots() {
    if (typeof document === 'undefined' || !document.body) return [];
    const seen = new Set();
    const roots = [];
    const add = (el) => { if (el && !seen.has(el)) { seen.add(el); roots.push(el); } };
    add(document.querySelector('main'));
    add(document.getElementById('__next'));
    add(document.getElementById('root'));
    add(document.body);
    return roots;
  }

  applyPageMarginForDocked(width) {
    if (typeof document === 'undefined') return;
    const w = String(width != null ? width : this.sidebarWidth);
    document.documentElement.classList.add('chatgpt-sidebar-docked');
    document.documentElement.style.setProperty('--chatgpt-sidebar-width', w + 'px');
    const roots = this.getLayoutRoots();
    const transition = document.documentElement.classList.contains('chatgpt-sidebar-resizing') ? 'none' : 'margin-right 0.18s ease-out';
    roots.forEach((root) => {
      root.style.setProperty('margin-right', w + 'px');
      root.style.setProperty('transition', transition);
    });
  }

  clearPageMarginForDocked() {
    if (typeof document === 'undefined') return;
    document.documentElement.classList.remove('chatgpt-sidebar-docked', 'chatgpt-sidebar-resizing');
    document.documentElement.style.removeProperty('--chatgpt-sidebar-width');
    this.getLayoutRoots().forEach((root) => {
      root.style.removeProperty('margin-right');
      root.style.removeProperty('transition');
    });
  }

  startResizing() {
    if (typeof document === 'undefined') return;
    document.documentElement.classList.add('chatgpt-sidebar-resizing');
    if (this.container) this.container.classList.add('sidebar-resizing');
    this.getLayoutRoots().forEach((root) => root.style.setProperty('transition', 'none'));
  }

  endResizing() {
    if (typeof document === 'undefined') return;
    document.documentElement.classList.remove('chatgpt-sidebar-resizing');
    if (this.container) this.container.classList.remove('sidebar-resizing');
    this.getLayoutRoots().forEach((root) => root.style.setProperty('transition', 'margin-right 0.18s ease-out'));
  }

  applySidebarWidth(width) {
    const w = Math.min(560, Math.max(240, width || this.sidebarWidth));
    this.sidebarWidth = w;
    if (this.container) this.container.style.width = w + 'px';
    if (this.container && !this.container.classList.contains('sidebar-hidden')) {
      this.applyPageMarginForDocked(w);
    } else {
      this.clearPageMarginForDocked();
    }
  }

async applySavedWidth() {
    try {
      if (!window.storageManager || typeof window.storageManager.getConfig !== 'function') return;
      const config = await window.storageManager.getConfig();
      const w = config && config.sidebarWidth != null ? config.sidebarWidth : 320;
      this.sidebarWidth = Math.min(560, Math.max(240, Number(w) || 320));
      this.applySidebarWidth(this.sidebarWidth);
    } catch (e) {
      this.applySidebarWidth(320);
    }
  }

  async saveSidebarWidth() {
    try {
      if (!window.storageManager || typeof window.storageManager.getConfig !== 'function') return;
      const config = await window.storageManager.getConfig();
      config.sidebarWidth = this.sidebarWidth;
      await window.storageManager.saveConfig(config);
    } catch (e) {}
  }

  show() {
    this.userClosed = false;
    if (!this.container) {
      const c = this.shadowRoot && this.shadowRoot.querySelector('.sidebar-container');
      if (c) this.container = c;
    }
    if (this.container) {
      this.container.classList.remove('sidebar-hidden');
      this.applySidebarWidth(this.sidebarWidth);
    }
    this.hideFloatButton();
    this.persistSidebarOpen(true);
  }

  hide() {
    this.userClosed = true;
    if (!this.container) {
      const c = this.shadowRoot && this.shadowRoot.querySelector('.sidebar-container');
      if (c) this.container = c;
    }
    if (this.container) this.container.classList.add('sidebar-hidden');
    this.clearPageMarginForDocked();
    this.showFloatButton();
    this.persistSidebarOpen(false);
  }

  /**
   * 持久化侧边栏打开状态
   */
  async persistSidebarOpen(isOpen) {
    try {
      if (!window.storageManager || typeof window.storageManager.getConfig !== 'function') return;
      const config = await window.storageManager.getConfig();
      config.sidebarOpen = isOpen;
      await window.storageManager.saveConfig(config);
    } catch (e) {
      this.log('persistSidebarOpen error:', e);
    }
  }

  toggle() {
    if (!this.container) {
      const c = this.shadowRoot && this.shadowRoot.querySelector('.sidebar-container');
      if (c) this.container = c;
    }
    if (this.container) {
      const isHidden = this.container.classList.contains('sidebar-hidden');
      if (isHidden) this.show();
      else this.hide();
    }
  }

  createFloatButton() {
    if (!this.isExtensionContextValid()) {
      this.log('Extension context invalidated, skipping createFloatButton');
      return;
    }

    let existing = document.getElementById('chatgpt-sidebar-float-btn');
    if (existing) {
      this.floatButton = existing;
      this.floatButtonVisual = existing.querySelector('.chatgpt-sidebar-float-btn-visual');
      return;
    }
    // 外层：定位、热区、拖拽
    this.floatButton = document.createElement('div');
    this.floatButton.id = 'chatgpt-sidebar-float-btn';
    this.floatButton.className = 'chatgpt-sidebar-float-btn';
    this.floatButton.style.display = 'none';
    // 内层：视觉图标（使用自定义图标）
    this.floatButtonVisual = document.createElement('div');
    this.floatButtonVisual.className = 'chatgpt-sidebar-float-btn-visual';
    const floatImg = document.createElement('img');
    floatImg.src = this.isExtensionContextValid() ? chrome.runtime.getURL('icons/float-icon.png') : '';
    floatImg.alt = this._t('float.openSidebar');
    floatImg.className = 'chatgpt-sidebar-float-btn-icon';
    this.floatButtonVisual.appendChild(floatImg);
    this.floatButtonVisual.title = this._t('float.openSidebar');
    this.floatButton.appendChild(this.floatButtonVisual);
    document.body.appendChild(this.floatButton);
    // 点击视觉层打开侧边栏
    this.floatButtonVisual.addEventListener('click', (e) => {
      if (this._floatBtnDragged) return; // 拖拽结束不触发点击
      this.show();
    });
    // 初始化拖拽和贴边逻辑
    this.initFloatButtonDrag();
    // 恢复上次位置
    this.restoreFloatButtonPosition();
  }

  showFloatButton() {
    if (!this.floatButton) this.createFloatButton();
    if (this.floatButton) this.floatButton.style.display = 'flex';
  }

  hideFloatButton() {
    if (this.floatButton) this.floatButton.style.display = 'none';
  }

  /**
   * 初始化悬浮按钮拖拽与贴边逻辑
   */
  initFloatButtonDrag() {
    if (!this.floatButton) return;
    let dragging = false;
    let startX = 0, startY = 0, startLeft = 0, startTop = 0;
    const EDGE_THRESHOLD = 10; // 只有图标边界几乎贴到左右边框时才吸入隐藏

    const onMouseDown = (e) => {
      if (!this.floatButton.contains(e.target)) return;
      e.preventDefault();
      dragging = true;
      this._floatBtnDragged = false;
      startX = e.clientX;
      startY = e.clientY;
      const rect = this.floatButton.getBoundingClientRect();
      startLeft = rect.left;
      startTop = rect.top;
      this.floatButton.classList.add('dragging');
      document.addEventListener('mousemove', onMouseMove);
      document.addEventListener('mouseup', onMouseUp);
    };

    const onMouseMove = (e) => {
      if (!dragging) return;
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      if (Math.abs(dx) > 3 || Math.abs(dy) > 3) this._floatBtnDragged = true;
      let newLeft = startLeft + dx;
      let newTop = startTop + dy;
      // 限制在视口内
      const rect = this.floatButton.getBoundingClientRect();
      const btnW = rect.width, btnH = rect.height;
      newLeft = Math.max(0, Math.min(window.innerWidth - btnW, newLeft));
      newTop = Math.max(0, Math.min(window.innerHeight - btnH, newTop));
      this.floatButton.style.left = newLeft + 'px';
      this.floatButton.style.top = newTop + 'px';
      this.floatButton.style.right = 'auto';
      this.floatButton.style.bottom = 'auto';
    };

    const onMouseUp = (e) => {
      if (!dragging) return;
      dragging = false;
      this.floatButton.classList.remove('dragging');
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
      // 判断贴边
      const rect = this.floatButton.getBoundingClientRect();
      let edge = null;
      if (rect.left < EDGE_THRESHOLD) {
        edge = 'left';
        this.floatButton.style.left = '0px';
        this.floatButton.style.right = 'auto';
      } else if (window.innerWidth - rect.right < EDGE_THRESHOLD) {
        edge = 'right';
        this.floatButton.style.left = 'auto';
        this.floatButton.style.right = '0px';
      }
      this.floatButton.classList.remove('edge-left', 'edge-right', 'expanded');
      if (edge === 'left') this.floatButton.classList.add('edge-left');
      else if (edge === 'right') this.floatButton.classList.add('edge-right');
      this._floatBtnEdge = edge;
      // 保存位置
      this.saveFloatButtonPosition();
      // 短暂延迟后允许点击
      setTimeout(() => { this._floatBtnDragged = false; }, 50);
    };

    this.floatButton.addEventListener('mousedown', onMouseDown);

    // Hover 展开/收起：贴边状态下 hover 展开，离开后延迟收起
    let collapseTimer = null;
    this.floatButton.addEventListener('mouseenter', () => {
      if (collapseTimer) { clearTimeout(collapseTimer); collapseTimer = null; }
      if (this._floatBtnEdge) {
        this.floatButton.classList.add('expanded');
      }
    });
    this.floatButton.addEventListener('mouseleave', () => {
      if (this._floatBtnEdge) {
        collapseTimer = setTimeout(() => {
          this.floatButton.classList.remove('expanded');
          collapseTimer = null;
        }, 350);
      }
    });
  }

  /**
   * 保存悬浮按钮位置到 config
   */
  async saveFloatButtonPosition() {
    try {
      if (!window.storageManager || typeof window.storageManager.getConfig !== 'function') return;
      const rect = this.floatButton.getBoundingClientRect();
      const config = await window.storageManager.getConfig();
      config.floatButtonPosition = {
        x: rect.left,
        y: rect.top,
        edge: this._floatBtnEdge || null
      };
      await window.storageManager.saveConfig(config);
    } catch (e) {
      this.log('saveFloatButtonPosition error:', e);
    }
  }

  /**
   * 恢复悬浮按钮位置
   */
  async restoreFloatButtonPosition() {
    try {
      if (!window.storageManager || typeof window.storageManager.getConfig !== 'function') return;
      const config = await window.storageManager.getConfig();
      const pos = config && config.floatButtonPosition;
      if (!pos) return; // 无历史位置，使用 CSS 默认
      const btnW = 56, btnH = 56;
      let x = pos.x, y = pos.y;
      // 限制在当前视口内
      x = Math.max(0, Math.min(window.innerWidth - btnW, x));
      y = Math.max(0, Math.min(window.innerHeight - btnH, y));
      if (pos.edge === 'left') {
        this.floatButton.style.left = '0px';
        this.floatButton.style.right = 'auto';
        this.floatButton.classList.add('edge-left');
      } else if (pos.edge === 'right') {
        this.floatButton.style.left = 'auto';
        this.floatButton.style.right = '0px';
        this.floatButton.classList.add('edge-right');
      } else {
        this.floatButton.style.left = x + 'px';
        this.floatButton.style.right = 'auto';
      }
      this.floatButton.style.top = y + 'px';
      this.floatButton.style.bottom = 'auto';
      this._floatBtnEdge = pos.edge || null;
    } catch (e) {
      this.log('restoreFloatButtonPosition error:', e);
    }
  }

  /**
   * 根据配置判断是否使用深色模式
   * @param {string} themeConfig - 'light' | 'dark' | 'auto'
   * @returns {boolean}
   */
  isDarkMode(themeConfig = 'auto') {
    if (themeConfig === 'light') return false;
    if (themeConfig === 'dark') return true;
    // auto: 跟随系统
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  }

  /**
   * 应用主题设置
   * @param {string} theme - 'light' | 'dark' | 'auto'
   */
  applyTheme(theme) {
    if (!this.container) return;

    const shouldBeDark = this.isDarkMode(theme);

    if (shouldBeDark) {
      this.container.classList.add('dark');
    } else {
      this.container.classList.remove('dark');
    }

    this.log('Theme applied:', theme, '-> dark:', shouldBeDark);
  }

  ensureDatePickerPopup() {
    if (this.filterMod) this.filterMod.ensureDatePickerPopup();
  }

  renderDatePickerGrid() {
    if (this.filterMod) this.filterMod.renderDatePickerGrid();
  }

  openDatePickerForInput(inputId, anchorButton) {
    if (this.filterMod) this.filterMod.openDatePickerForInput(inputId, anchorButton);
  }

  /**
   * 绑定事件监听
   */
  bindEvents() {
    const closeBtn = this.shadowRoot.getElementById('btn-sidebar-close');
    if (closeBtn) closeBtn.addEventListener('click', () => this.hide());

    const refreshBtn = this.shadowRoot.getElementById('btn-sidebar-refresh');
    if (refreshBtn) refreshBtn.addEventListener('click', () => this.refreshSidebar());

    const resizeHandle = this.shadowRoot.getElementById('sidebar-resize-handle');
    if (resizeHandle) {
      resizeHandle.addEventListener('mousedown', (e) => {
        e.preventDefault();
        this._resizeStartX = e.clientX;
        this._resizeStartWidth = this.sidebarWidth;
        this.startResizing();
        let rafId = null;
        let lastEv = null;
        const onMove = (ev) => {
          lastEv = ev;
          if (rafId != null) return;
          rafId = requestAnimationFrame(() => {
            rafId = null;
            if (lastEv == null) return;
            const delta = this._resizeStartX - lastEv.clientX;
            const w = Math.min(560, Math.max(240, this._resizeStartWidth + delta));
            this.applySidebarWidth(w);
          });
        };
        const onUp = () => {
          document.removeEventListener('mousemove', onMove);
          document.removeEventListener('mouseup', onUp);
          document.body.style.userSelect = '';
          document.body.style.cursor = '';
          if (rafId != null) cancelAnimationFrame(rafId);
          this.endResizing();
          this.saveSidebarWidth();
        };
        document.body.style.userSelect = 'none';
        document.body.style.cursor = 'col-resize';
        document.addEventListener('mousemove', onMove);
        document.addEventListener('mouseup', onUp);
      });
    }

    const tabButtons = this.shadowRoot.querySelectorAll('.tab-button');
    tabButtons.forEach(btn => {
      btn.addEventListener('click', (e) => {
        const tab = (e.currentTarget || e.target).getAttribute('data-tab');
        if (tab) this.switchTab(tab);
      });
    });

    this.shadowRoot.getElementById('btn-sidebar-settings')?.addEventListener('click', () => {
      if (this.currentTab === 'settings') {
        this.switchTab(this.lastNonSettingsTab || 'toc');
      } else {
        this.lastNonSettingsTab = this.currentTab || 'toc';
        this.switchTab('settings');
      }
    });

    this.shadowRoot.getElementById('btn-settings-back')?.addEventListener('click', () => {
      this.switchTab(this.lastNonSettingsTab || 'toc');
    });

    this.shadowRoot.getElementById('btn-toc-export')?.addEventListener('click', () => this.toggleExportMode('toc'));
    this.shadowRoot.getElementById('btn-conversations-export')?.addEventListener('click', () => this.toggleExportMode('history'));
    this.shadowRoot.getElementById('btn-projects-export')?.addEventListener('click', () => this.toggleExportMode('projects'));

    this.shadowRoot.addEventListener('click', (e) => {
      const dot = e.target.closest('.export-select-dot');
      if (dot) {
        e.stopPropagation();
        this.toggleExportSelectionFromDot(dot);
        return;
      }
      const actionBtn = e.target.closest('.export-bar [data-action]');
      if (actionBtn) {
        e.stopPropagation();
        this.handleExportBarAction(actionBtn);
      }
    });

    this.shadowRoot.addEventListener('change', (e) => {
      const target = e.target;
      if (!target) return;
      if (target.matches('.export-bar input[data-format]')) {
        this.exportState.formats[target.getAttribute('data-format')] = target.checked;
        return;
      }
      if (target.matches('.export-bar input[data-zip]')) {
        this.exportState.zip = target.checked;
      }
    });

    const stopKeyPropagation = (e) => {
      const target = e.target;
      if (!target || !this.shadowRoot.contains(target)) return;
      if (target.matches('input, textarea') || target.isContentEditable) {
        e.stopPropagation();
      }
    };
    this.shadowRoot.addEventListener('keydown', stopKeyPropagation);
    this.shadowRoot.addEventListener('keyup', stopKeyPropagation);
    this.shadowRoot.addEventListener('keypress', stopKeyPropagation);

    const searchInput = this.shadowRoot.getElementById('search-input');
    const runSearch = () => this.handleSearch(searchInput.value);
    searchInput.addEventListener('input', runSearch);
    searchInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); runSearch(); }
    });
    searchInput.addEventListener('focus', () => {
      if (searchInput.value.trim()) runSearch();
    });

    this.shadowRoot.querySelectorAll('.toc-filter-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        if (btn.id === 'toc-btn-add-to-project') {
          this.showAddToProjectDialog();
          return;
        }
        const role = btn.getAttribute('data-filter-role');
        const isFavBtn = btn.getAttribute('data-filter-favorite') === 'true';
        if (role) { this.tocFilterRole = role; this.renderTOC(); }
        else if (isFavBtn) { this.tocFilterFavorite = !this.tocFilterFavorite; this.renderTOC(); }
      });
    });

    this.shadowRoot.querySelectorAll('.filter-date-calendar-btn').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const inputId = btn.getAttribute('data-for');
        if (inputId) this.openDatePickerForInput(inputId, btn);
      });
    });

    // 历史对话：列表层有搜索+筛选；详情层只有搜索当前对话内容
    const convSearchInput = this.shadowRoot.getElementById('conversations-search-input');
    const convFilterPanel = this.shadowRoot.getElementById('conversations-filter-panel');
    const btnConvFilter = this.shadowRoot.getElementById('btn-conversations-filter');
    const convDetailContainer = this.shadowRoot.getElementById('conversation-detail-container');
    if (convSearchInput) {
      convSearchInput.addEventListener('input', () => {
        const kw = convSearchInput.value.trim();
        if (convDetailContainer && convDetailContainer.style.display === 'block') {
          this.handleHistoryDetailSearch(kw);
        } else {
          this.conversationsSearchKeyword = kw;
          this.renderConversationsList();
        }
      });
    }
    if (btnConvFilter && convFilterPanel) {
      btnConvFilter.addEventListener('click', (e) => {
        e.stopPropagation();
        this.conversationsFilterPanelOpen = !this.conversationsFilterPanelOpen;
        convFilterPanel.style.display = this.conversationsFilterPanelOpen ? 'block' : 'none';
        if (this.conversationsFilterPanelOpen) this.syncFilterPanelUI('conversations');
        btnConvFilter.classList.toggle('active', this.conversationsFilterPanelOpen || this.hasActiveFilter());
      });
      convFilterPanel.querySelectorAll('.filter-range-btn').forEach((btn) => {
        btn.addEventListener('click', () => {
          const range = btn.getAttribute('data-range');
          this.tocFilterDateRange = range;
          const { start, end } = this.getFilterDateRange();
          this.tocFilterStartDate = start;
          this.tocFilterEndDate = end;
          this.shadowRoot.querySelectorAll('.filter-range-btn').forEach((b) => b.classList.remove('active'));
          btn.classList.add('active');
          const startVal = start ? this.formatDateForInput(start) : '';
          const endVal = end ? this.formatDateForInput(end) : '';
          ['conv-filter-start-date', 'conv-filter-end-date', 'projects-filter-start-date', 'projects-filter-end-date'].forEach((id) => {
            const el = this.shadowRoot.getElementById(id);
            if (el) el.value = id.includes('start') ? startVal : endVal;
          });
        });
      });
      const convStartEl = this.shadowRoot.getElementById('conv-filter-start-date');
      const convEndEl = this.shadowRoot.getElementById('conv-filter-end-date');
      if (convStartEl) convStartEl.addEventListener('change', () => { this.tocFilterStartDate = this.parseDateInput(convStartEl.value); this.tocFilterDateRange = 'custom'; });
      if (convEndEl) convEndEl.addEventListener('change', () => { this.tocFilterEndDate = this.parseDateInput(convEndEl.value); this.tocFilterDateRange = 'custom'; });
      const convPlatformTrigger = this.shadowRoot.getElementById('conv-filter-platform-trigger');
      const convPlatformOptions = this.shadowRoot.getElementById('conv-filter-platform-options');
      if (convPlatformTrigger && convPlatformOptions) {
        convPlatformTrigger.addEventListener('click', () => {
          const visible = convPlatformOptions.style.display === 'block';
          convPlatformOptions.style.display = visible ? 'none' : 'block';
        });
        convPlatformOptions.querySelectorAll('input[type="checkbox"]').forEach((cb) => {
          cb.addEventListener('change', () => {
            this.tocFilterPlatforms = Array.from(convPlatformOptions.querySelectorAll('input[type="checkbox"]:checked')).map((c) => c.value);
            this.updateFilterPlatformTriggerText('conv-filter-platform-trigger');
          });
        });
      }
      this.shadowRoot.getElementById('btn-conv-filter-apply')?.addEventListener('click', () => {
        this.applyFilterFromPanel('conv-filter-start-date', 'conv-filter-end-date');
        convFilterPanel.style.display = 'none';
        this.conversationsFilterPanelOpen = false;
        btnConvFilter.classList.toggle('active', this.hasActiveFilter());
        this.renderConversationsList();
      });
      this.shadowRoot.getElementById('btn-conv-filter-clear')?.addEventListener('click', () => {
        this.clearTocFilter();
        this.syncFilterPanelUI('conversations');
        convFilterPanel.style.display = 'none';
        this.conversationsFilterPanelOpen = false;
        btnConvFilter.classList.remove('active');
        this.renderConversationsList();
      });
      this.shadowRoot.addEventListener('click', (e) => {
        if (this.conversationsFilterPanelOpen && !convFilterPanel.contains(e.target) && !btnConvFilter.contains(e.target)) {
          convFilterPanel.style.display = 'none';
          this.conversationsFilterPanelOpen = false;
          btnConvFilter.classList.toggle('active', this.hasActiveFilter());
        }
      });
    }

    // 项目：搜索 + 完整筛选
    const projSearchInput = this.shadowRoot.getElementById('projects-search-input');
    const projFilterPanel = this.shadowRoot.getElementById('projects-filter-panel');
    const btnProjFilter = this.shadowRoot.getElementById('btn-projects-filter');
    if (projSearchInput) {
      projSearchInput.addEventListener('input', () => {
        const kw = projSearchInput.value.trim();
        const inProjectDetail = this.shadowRoot.querySelector('.project-item--showing-detail');
        if (inProjectDetail) {
          this.handleProjectDetailSearch(kw);
        } else {
          this.projectsSearchKeyword = kw;
          this.renderProjects();
        }
      });
    }
    if (btnProjFilter && projFilterPanel) {
      btnProjFilter.addEventListener('click', (e) => {
        e.stopPropagation();
        this.projectsFilterPanelOpen = !this.projectsFilterPanelOpen;
        projFilterPanel.style.display = this.projectsFilterPanelOpen ? 'block' : 'none';
        if (this.projectsFilterPanelOpen) this.syncFilterPanelUI('projects');
        btnProjFilter.classList.toggle('active', this.projectsFilterPanelOpen || this.hasActiveFilter());
      });
      projFilterPanel.querySelectorAll('.filter-range-btn').forEach((btn) => {
        btn.addEventListener('click', () => {
          const range = btn.getAttribute('data-range');
          this.tocFilterDateRange = range;
          const { start, end } = this.getFilterDateRange();
          this.tocFilterStartDate = start;
          this.tocFilterEndDate = end;
          this.shadowRoot.querySelectorAll('.filter-range-btn').forEach((b) => b.classList.remove('active'));
          btn.classList.add('active');
          const startVal = start ? this.formatDateForInput(start) : '';
          const endVal = end ? this.formatDateForInput(end) : '';
          ['conv-filter-start-date', 'conv-filter-end-date', 'projects-filter-start-date', 'projects-filter-end-date'].forEach((id) => {
            const el = this.shadowRoot.getElementById(id);
            if (el) el.value = id.includes('start') ? startVal : endVal;
          });
        });
      });
      const projStartEl = this.shadowRoot.getElementById('projects-filter-start-date');
      const projEndEl = this.shadowRoot.getElementById('projects-filter-end-date');
      if (projStartEl) projStartEl.addEventListener('change', () => { this.tocFilterStartDate = this.parseDateInput(projStartEl.value); this.tocFilterDateRange = 'custom'; });
      if (projEndEl) projEndEl.addEventListener('change', () => { this.tocFilterEndDate = this.parseDateInput(projEndEl.value); this.tocFilterDateRange = 'custom'; });
      const projPlatformTrigger = this.shadowRoot.getElementById('projects-filter-platform-trigger');
      const projPlatformOptions = this.shadowRoot.getElementById('projects-filter-platform-options');
      if (projPlatformTrigger && projPlatformOptions) {
        projPlatformTrigger.addEventListener('click', () => {
          const visible = projPlatformOptions.style.display === 'block';
          projPlatformOptions.style.display = visible ? 'none' : 'block';
        });
        projPlatformOptions.querySelectorAll('input[type="checkbox"]').forEach((cb) => {
          cb.addEventListener('change', () => {
            this.tocFilterPlatforms = Array.from(projPlatformOptions.querySelectorAll('input[type="checkbox"]:checked')).map((c) => c.value);
            this.updateFilterPlatformTriggerText('projects-filter-platform-trigger');
          });
        });
      }
      this.shadowRoot.getElementById('btn-projects-filter-apply')?.addEventListener('click', () => {
        this.applyFilterFromPanel('projects-filter-start-date', 'projects-filter-end-date');
        projFilterPanel.style.display = 'none';
        this.projectsFilterPanelOpen = false;
        btnProjFilter.classList.toggle('active', this.hasActiveFilter());
        this.renderProjects();
      });
      this.shadowRoot.getElementById('btn-projects-filter-clear')?.addEventListener('click', () => {
        this.clearTocFilter();
        this.syncFilterPanelUI('projects');
        projFilterPanel.style.display = 'none';
        this.projectsFilterPanelOpen = false;
        btnProjFilter.classList.remove('active');
        this.renderProjects();
      });
      this.shadowRoot.addEventListener('click', (e) => {
        if (this.projectsFilterPanelOpen && !projFilterPanel.contains(e.target) && !btnProjFilter.contains(e.target)) {
          projFilterPanel.style.display = 'none';
          this.projectsFilterPanelOpen = false;
          btnProjFilter.classList.toggle('active', this.hasActiveFilter());
        }
      });
    }

    // 项目分组折叠
    this.shadowRoot.querySelectorAll('.project-section-header').forEach((header) => {
      header.addEventListener('click', () => {
        const section = header.getAttribute('data-section');
        if (!section) return;
        const key = section === 'auto' ? 'auto' : 'my';
        this.projectSectionCollapsed[key] = !this.projectSectionCollapsed[key];
        this.applyProjectSectionCollapsed();
      });
    });

    // TOC 视图切换按钮事件
    this.shadowRoot.querySelectorAll('.toc-view-tab').forEach(btn => {
      btn.addEventListener('click', () => {
        const view = btn.getAttribute('data-view');
        this.switchTocView(view);
      });
    });

    // 按钮事件
    this.shadowRoot.getElementById('btn-create-project').addEventListener('click', (e) => {
      e.stopPropagation();
      this.showCreateProjectDialog();
    });

    this.shadowRoot.getElementById('btn-clear-data')?.addEventListener('click', () => {
      this.clearAllData();
    });

    // 设置 - 自动保存开关
    this.shadowRoot.getElementById('toggle-auto-save')?.addEventListener('change', async (e) => {
      try {
        if (!e.target) return;
        const isChecked = e.target.checked;

        if (!window.storageManager || typeof window.storageManager.getConfig !== 'function') {
          console.error('[SidebarUI] storageManager not available');
          return;
        }
        const config = await window.storageManager.getConfig();
        if (!config || typeof config !== 'object') {
          console.error('[SidebarUI] Invalid config object:', config);
          return;
        }
        config.autoSave = isChecked;
        await window.storageManager.saveConfig(config);
        this.log('Auto-save:', isChecked);

        // 如果重新开启，立即重新解析当前页并更新侧边栏，避免需要手动刷新
        if (isChecked && window.platformAdapter && typeof window.platformAdapter.updateMessages === 'function') {
          window.platformAdapter.updateMessages(true); // forceNotify，确保回调触发
        }
      } catch (error) {
        console.error('[SidebarUI] Error updating autoSave config:', error);
      }
    });

    // 设置 - 语言切换
    this.shadowRoot.getElementById('select-language')?.addEventListener('change', async (e) => {
      try {
        const lang = e.target.value;
        const config = await window.storageManager.getConfig();
        config.language = lang;
        await window.storageManager.saveConfig(config);

        // 更新 i18n 并刷新 UI
        if (window.i18nManager) {
          const resolvedLang = (lang === 'auto') ? this.getSystemLanguageCode() : lang;
          window.i18nManager.setLanguage(resolvedLang);
          window.i18nManager.updateDOM(this.shadowRoot);
          // 重新渲染当前标签下的动态文案（时间、平台筛选、TOC/历史/项目等）
          this.updateFilterPlatformTriggerText();
          if (this.datePickerPopup) this.renderDatePickerGrid();
          const floatImg = this.floatButton?.querySelector('.chatgpt-sidebar-float-btn-icon');
          if (floatImg) floatImg.alt = this._t('float.openSidebar');
          if (this.floatButtonVisual) this.floatButtonVisual.title = this._t('float.openSidebar');
          if (this.currentTab === 'toc') {
            this.renderTOC();
          } else if (this.currentTab === 'conversations') {
            if (this.viewingConversationId) this.renderConversationDetailInToc(this.viewingConversationId);
            else this.renderConversationsList();
          } else if (this.currentTab === 'projects') {
            this.renderProjects();
          }
          if (this.exportState.active) {
            this.updateExportCount();
            this.updateExportHint();
          }
        }
        this.log('Language changed to:', lang);
      } catch (error) {
        console.error('[SidebarUI] Error updating language config:', error);
      }
    });

    // 设置 - 主题切换
    this.shadowRoot.getElementById('select-theme')?.addEventListener('change', async (e) => {
      try {
        const theme = e.target.value;
        const config = await window.storageManager.getConfig();
        config.theme = theme;
        await window.storageManager.saveConfig(config);
        this.applyTheme(theme);
        this.log('Theme changed to:', theme);
      } catch (error) {
        console.error('[SidebarUI] Error updating theme config:', error);
      }
    });

    // 监听系统主题变化（仅当设置为 auto 时生效）
    if (window.matchMedia) {
      window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', async () => {
        try {
          const config = await window.storageManager.getConfig();
          if (config.theme === 'auto') {
            this.applyTheme('auto');
          }
        } catch (error) {
          console.error('[SidebarUI] Error handling system theme change:', error);
        }
      });
    }
  }

  toggleExportMode(scope) {
    if (this.exportMod) this.exportMod.toggleExportMode(scope);
  }

  enterExportMode(scope) {
    if (this.exportMod) this.exportMod.enterExportMode(scope);
  }

  exitExportMode() {
    if (this.exportMod) this.exportMod.exitExportMode();
  }

  syncExportFormatsToUI() {
    if (this.exportMod) this.exportMod.syncExportFormatsToUI();
  }

  updateExportHint() {
    if (this.exportMod) this.exportMod.updateExportHint();
  }

  updateExportCount() {
    if (this.exportMod) this.exportMod.updateExportCount();
  }

  toggleExportSelectionFromDot(dot) {
    if (this.exportMod) this.exportMod.toggleExportSelectionFromDot(dot);
  }

  getExportKeyFromDot(dot) {
    return this.exportMod ? this.exportMod.getExportKeyFromDot(dot) : null;
  }

  syncExportSelectionUI() {
    if (this.exportMod) this.exportMod.syncExportSelectionUI();
  }

  selectAllInScope(scope) {
    if (this.exportMod) this.exportMod.selectAllInScope(scope);
  }

  isAllSelectedInScope(scope) {
    return this.exportMod ? this.exportMod.isAllSelectedInScope(scope) : false;
  }

  updateSelectAllButtonState() {
    if (this.exportMod) this.exportMod.updateSelectAllButtonState();
  }

  handleExportBarAction(btn) {
    if (this.exportMod) this.exportMod.handleExportBarAction(btn);
  }

  resetExportDownloadButton() {
    if (this.exportMod) this.exportMod.resetExportDownloadButton();
  }

  async runExportDownload() {
    if (this.exportMod) await this.exportMod.runExportDownload();
  }

  /**
   * 初始化设置状态
   */
  async initSettings() {
    try {
      const config = await window.storageManager.getConfig();

      // 设置自动保存开关
      const autoSaveToggle = this.shadowRoot.getElementById('toggle-auto-save');
      if (autoSaveToggle) {
        autoSaveToggle.checked = config.autoSave !== false;
      }

      // 设置语言
      const languageSelect = this.shadowRoot.getElementById('select-language');
      if (languageSelect) {
        const savedLang = config.language || 'auto';
        languageSelect.value = savedLang;
      }
      if (window.i18nManager) {
        const savedLang = config.language || 'auto';
        const resolvedLang = (savedLang === 'auto') ? this.getSystemLanguageCode() : savedLang;
        window.i18nManager.setLanguage(resolvedLang);
        window.i18nManager.updateDOM(this.shadowRoot);
      }

      // 设置主题
      const themeSelect = this.shadowRoot.getElementById('select-theme');
      if (themeSelect) {
        themeSelect.value = config.theme || 'auto';
      }
      this.applyTheme(config.theme || 'auto');

      this.log('Settings initialized');
    } catch (error) {
      console.error('[SidebarUI] Error initializing settings:', error);
    }
  }

  /**
   * 切换 Tab
   */
  switchTab(tabName) {
    if (!tabName) return;
    if (this.exportState.active) {
      this.exitExportMode();
    }
    this.stashMsgSearchOverlayForNextTab(tabName);
    if (tabName !== 'settings') {
      this.lastNonSettingsTab = tabName;
    }
    this.currentTab = tabName;
    if (this.container) {
      this.container.classList.toggle('settings-only', tabName === 'settings');
    }

    // 更新 Tab 按钮状态
    this.shadowRoot.querySelectorAll('.tab-button').forEach(btn => {
      btn.classList.remove('active');
      if (btn.getAttribute('data-tab') === tabName) {
        btn.classList.add('active');
      }
    });
    // 头部设置按钮：仅在 settings 面板时高亮
    const headerSettingsBtn = this.shadowRoot.getElementById('btn-sidebar-settings');
    if (headerSettingsBtn) {
      headerSettingsBtn.classList.toggle('active', tabName === 'settings');
    }

    // 更新面板显示（当前对话与历史共用 toc 面板）
    this.shadowRoot.querySelectorAll('.tab-panel').forEach(panel => {
      panel.classList.remove('active');
      const panelId = panel.getAttribute('data-panel');
      if (panelId === tabName || (tabName === 'conversations' && panelId === 'toc')) {
        panel.classList.add('active');
      }
    });

    if (tabName === 'toc' || tabName === 'conversations') {
      this.switchTocView(tabName);
    }

    if (tabName === 'projects') {
      (async () => {
        const needRestore = this.projectsViewState?.level === 'conversation' && this.projectsViewState?.conversationId;
        const panel = this.shadowRoot.querySelector('.tab-panel[data-panel="projects"]');
        const sections = panel ? panel.querySelectorAll('.project-section') : [];
        if (needRestore && sections.length) {
          sections.forEach((el) => { el.style.opacity = '0'; });
        }
        await this.updateChatGPTProjectMapping();
        await this.renderProjects();
        await this.restoreProjectsViewState();
        if (needRestore && sections.length) {
          sections.forEach((el) => { el.style.opacity = ''; });
        }
        this.restoreMsgSearchOverlayForTab('projects');
      })();
    }

    this.log('Switched to tab:', tabName);
  }

  /**
   * 切回项目标签时恢复之前的层级（若之前在某个对话详情则重新展开并显示该对话）
   */
  async restoreProjectsViewState() {
    const s = this.projectsViewState;
    if (!s || s.level !== 'conversation' || !s.conversationId || !s.projectType || !s.projectKey) return;

    const myList = this.shadowRoot.getElementById('my-projects-list');
    const containers = [myList].filter(Boolean);
    let item = null;
    for (const c of containers) {
      const found = Array.from(c.querySelectorAll('.project-item')).find(
        (el) => el.getAttribute('data-project-type') === s.projectType && el.getAttribute('data-project-key') === s.projectKey
      );
      if (found) {
        item = found;
        break;
      }
    }
    if (!item) return;

    const listView = item.querySelector('.project-conv-list-view');
    const detailView = item.querySelector('.project-conv-detail-view');
    if (!listView || !detailView) return;

    item.classList.add('expanded');
    listView.style.display = 'none';
    detailView.style.display = 'block';
    detailView.setAttribute('data-conversation-id', s.conversationId);
    item.classList.add('project-item--showing-detail');

    const titleEl = detailView.querySelector('.project-conv-detail-title');
    if (titleEl) {
      titleEl.textContent = s.conversationTitle || this._t('conv.defaultTitle');
      const card = item.querySelector(`.conv-card[data-conversation-id="${s.conversationId}"]`);
      titleEl.addEventListener('dblclick', (e) => {
        e.stopPropagation();
        this.editConversationTitle(s.conversationId, card || null);
      });
    }
    const messagesEl = detailView.querySelector('.project-conv-detail-messages');
    if (!messagesEl) return;

    const listSearchWrapEl = this.shadowRoot.getElementById('projects-search-and-filter-wrap');
    const detailSearchEl = detailView.querySelector('.project-conv-detail-search-input');
    const btnProjFilterEl = this.shadowRoot.getElementById('btn-projects-filter');
    const projFilterPanelEl = this.shadowRoot.getElementById('projects-filter-panel');
    if (listSearchWrapEl) listSearchWrapEl.style.display = 'none';
    if (btnProjFilterEl) btnProjFilterEl.style.display = 'none';
    if (projFilterPanelEl) projFilterPanelEl.style.display = 'none';
    if (detailSearchEl) {
      detailSearchEl.placeholder = this._t('filter.search.currentConv');
      if ((s.searchKeyword || '').trim()) detailSearchEl.value = (s.searchKeyword || '').trim();
    }

    await this.renderProjectConversationMessages(s.conversationId, messagesEl, (s.searchKeyword || '').trim() || undefined);

    // 恢复重渲染前的滚动位置，避免用户在对话详情内滑动时被 storage 同步触发重绘后跳回顶部
    if (this._savedProjectsPanelScrollTop != null) {
      const projectsPanel = this.shadowRoot?.querySelector('.tab-panel[data-panel="projects"]');
      if (projectsPanel) {
        const toRestore = this._savedProjectsPanelScrollTop;
        this._savedProjectsPanelScrollTop = null;
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            projectsPanel.scrollTop = toRestore;
          });
        });
      }
    }
  }

  /**
   * 切换 TOC 面板内的视图
   */
  switchTocView(viewName) {
    this.currentTocView = viewName;

    // 更新视图切换按钮状态
    this.shadowRoot.querySelectorAll('.toc-view-tab').forEach(btn => {
      btn.classList.toggle('active', btn.getAttribute('data-view') === viewName);
    });

    // 切换视图显示
    this.shadowRoot.querySelectorAll('.toc-view').forEach(view => {
      const isTarget = view.getAttribute('data-view') === viewName;
      view.style.display = isTarget ? 'flex' : 'none';
    });

    // 加载对应数据（切回当前对话时重绘 TOC，保证角色标签等随当前语言更新）
    if (viewName === 'toc') {
      this.renderTOC();
      this.restoreMsgSearchOverlayForTab('toc');
    } else if (viewName === 'conversations') {
      // 如果之前在查看某个对话详情，则恢复到那个详情页面
      if (this.viewingConversationId) {
        this.renderConversationDetailInToc(this.viewingConversationId);
      } else {
        this.renderConversationsList();
        this.restoreMsgSearchOverlayForTab('conversations');
      }
    }

    this.log('Switched TOC view to:', viewName);
  }

  /**
   * 更新消息数据
   */
  async updateMessages(messages) {
    this.messages = messages;
    this.conversationId = window.platformAdapter ? window.platformAdapter.getCurrentConversationId() : null;

    // 获取配置
    const config = await window.storageManager.getConfig();

    // 始终渲染TOC（本地显示不受自动保存设置影响）
    await this.loadTocFavorites();
    this.renderTOC();

    // 只有在自动保存开启时才执行保存和同步操作
    if (config.autoSave !== false) {
      await this.saveCurrentConversationSnapshot();

      // 更新 ChatGPT 项目映射
      await this.updateChatGPTProjectMapping();
      if (this.conversationId) {
        setTimeout(() => { this.runUpdateChatGPTProjectMappingIfSameConversation(); }, 1500);
      }

      // 历史列表：进入新对话或消息数变化时自动刷新
      if (this.currentTab === 'conversations' && !this.viewingConversationId) {
        const msgCount = this.messages.length;
        if (this._lastHistorySyncConversationId !== this.conversationId || this._lastHistorySyncMessageCount !== msgCount) {
          this._lastHistorySyncConversationId = this.conversationId;
          this._lastHistorySyncMessageCount = msgCount;
          this.renderConversationsList();
        }
      }
    } else {
      this.log('Auto-save disabled, skipping snapshot and history sync');
    }

    // 仅当侧边栏当前为展开状态时才应用主内容区边距，避免首次进入时出现空白占位
    if (this.container && !this.container.classList.contains('sidebar-hidden')) {
      this.applyPageMarginForDocked(this.sidebarWidth);
      setTimeout(() => this.applyPageMarginForDocked(this.sidebarWidth), 150);
    }
  }

  async loadTocFavorites() {
    if (!this.conversationId) { this.tocFavoriteMessageIds = new Set(); return; }
    try {
      const conv = await window.storageManager.getConversation(this.conversationId);
      this.tocFavoriteMessageIds = new Set(conv.favoriteMessageIds || []);
    } catch (e) {
      this.tocFavoriteMessageIds = new Set();
    }
  }

  async saveCurrentConversationSnapshot() {
    if (!this.conversationId || !this.messages || this.messages.length === 0) return;
    try {
      const platform = window.platformAdapter ? window.platformAdapter.getPlatformName() : 'Unknown';
      const firstUserContent = (this.messages.find(m => m.role === 'user') || {}).content || '';
      const pageTitle = window.platformAdapter && window.platformAdapter.getConversationTitleFromPage && window.platformAdapter.getConversationTitleFromPage();
      const title = (pageTitle && pageTitle.trim()) ? pageTitle.trim() : (window.tocManager ? window.tocManager.generateTitle(firstUserContent) : this._t('conv.defaultTitle'));
      const snippet = firstUserContent.replace(/\s+/g, ' ').trim().slice(0, 80);
      const messageCount = this.messages.length;
      const lastSeenAt = Date.now();
      // 保存与「当前对话」一致的展示用 HTML，历史/项目里直接复用，格式完全一致
      const messagesData = this.messages.map((m) => {
        const content = m.content || '';
        let contentHtml = null;
        if (m.element) {
          try {
            const html = this.extractMessageHTMLForDisplay(m.element);
            if (html && html.trim()) contentHtml = this.wrapLeadBoldInHtml(html, this.findLeadLength(content));
          } catch (e) { this.log('saveSnapshot contentHtml error:', e); }
        }
        return { role: m.role, content, contentHtml };
      });
      const convData = await window.storageManager.getConversation(this.conversationId);
      convData.favoriteMessageIds = convData.favoriteMessageIds || [];
      const link = typeof window !== 'undefined' && window.location && window.location.href ? window.location.href : '';
      Object.assign(convData, { title, snippet, messageCount, lastSeenAt, messages: messagesData, platform, link });
      await window.storageManager.saveConversation(this.conversationId, convData);
      let list = await window.storageManager.getConversationList();
      const existing = list.findIndex(item => item.id === this.conversationId);
      const entry = { id: this.conversationId, title, snippet, messageCount, lastSeenAt, platform, link };
      if (existing >= 0) list[existing] = entry;
      else list.unshift(entry);
      list.sort((a, b) => (b.lastSeenAt || 0) - (a.lastSeenAt || 0));
      list = list.slice(0, 100);
      await window.storageManager.saveConversationList(list);
    } catch (e) { this.log('saveCurrentConversationSnapshot error:', e); }
  }

  renderTOC(searchKeyword) {
    if (!this.shadowRoot) return;
    const tocList = this.shadowRoot.getElementById('toc-list');
    let tocItems = window.tocManager.buildTOC(this.messages);
    if (tocItems.length === 0) {
      tocList.innerHTML = '<div class="empty-state"><div class="empty-state-icon">📭</div><div class="empty-state-text">' + this._t('empty.noMessages') + '</div></div>';
      this.updateTocSummary(0, 0, 0, false);
      this.updateOpenInPlatformButtonText(window.platformAdapter ? window.platformAdapter.getPlatformName() : 'ChatGPT');
      return;
    }
    if (this.tocFilterRole !== 'all') tocItems = tocItems.filter((item) => item.role === this.tocFilterRole);
    if (this.tocFilterFavorite) tocItems = tocItems.filter((item) => this.tocFavoriteMessageIds.has(item.messageId));
    const favSet = this.tocFavoriteMessageIds;
    const searchInput = this.shadowRoot.getElementById('search-input');
    const kw = (searchKeyword !== undefined ? searchKeyword : (searchInput ? searchInput.value.trim() : '')) || '';
    const kwLower = kw.toLowerCase();

    tocList.innerHTML = tocItems.map((item, i) => {
      const num = item.turnNumber != null ? item.turnNumber : (item.index + 1);
      const isUser = item.role === 'user';
      const roleLabel = isUser ? this._t('role.user') : this._t('role.assistant');
      const roleIcon = isUser ? this.getIcon('user') : this.getIcon('bot');
      const isFav = favSet.has(item.messageId);
      const content = (this.messages.find((m) => m.id === item.messageId) || {}).content || '';
      const roleAttr = isUser ? 'user' : 'assistant';
      const previewBreakpoint = this.findPreviewBreakpoint(content);
      const isLastItem = i === tocItems.length - 1;
      // 最后一条消息：内容超过预览阈值时强制视为长内容，保证始终有展开/收起按钮（避免流式更新未触发重渲染时缺按钮）
      const hasLongContent = content.length > previewBreakpoint || (isLastItem && content.length > 150);
      let fullContentHtml = this.getFullContentHtml(item.messageId, content);
      fullContentHtml = this.applyHighlightToTextContentOnly(fullContentHtml, kw);

      const matchCount = kw ? this.countKeywordOccurrences(content, kw) : 0;
      const hasMatch = matchCount > 0;
      const matchLabel = hasMatch ? this._t('search.matchCount', { n: String(matchCount) }) : '';
      const expanded = false;
      const expandClass = expanded ? ' toc-content-expanded' : '';
      const expandAria = expanded ? 'true' : 'false';
      const expandText = expanded ? this._t('toc.collapse') : this._t('toc.expand');
      const expandIcon = expanded ? this.getIcon('chevronUp') : this.getIcon('chevronDown');

      return `<li class="toc-item${hasMatch ? ' has-match-badge' : ''}" data-role="${roleAttr}" data-message-id="${item.messageId}" data-expanded="${expanded}">
        <button type="button" class="export-select-dot" data-scope="toc" data-type="message" data-id="${item.messageId}" aria-label="${this._t('export.select')}"></button>
        <div class="toc-item-main">
          <div class="toc-index" title="${roleLabel}">#${num}</div>
          <div class="toc-meta"><span class="toc-role-icon" aria-hidden="true">${roleIcon}</span>${this.escapeHtml(roleLabel)}</div>
          <div class="toc-content-wrapper">
            ${hasLongContent ? `
              <div class="toc-content-collapsible${expandClass}" aria-expanded="${expandAria}">
                <div class="toc-content-full">${fullContentHtml}</div>
                <div class="toc-preview-fade" aria-hidden="true"></div>
              </div>
              <div class="toc-expand-btn-row">
                <button type="button" class="toc-expand-text-btn" data-action="expand">
                  <span class="toc-expand-text">${expandText}</span>
                  <span class="toc-expand-icon toc-expand-icon-svg" aria-hidden="true">${expandIcon}</span>
                </button>
              </div>
            ` : `
              <div class="toc-content-full toc-content-full-standalone">${fullContentHtml}</div>
            `}
          </div>
        </div>
        <div class="toc-item-actions">
          ${hasLongContent ? `<button type="button" class="toc-action-btn toc-collapse-btn" title="${this._t('toc.collapse')}" data-action="expand">${this.getIcon('chevronUp')}</button>` : ''}
          <button type="button" class="toc-action-btn" title="${this._t('toc.searchInMessage')}" data-action="search">${this.getIcon('search')}</button>
          <button type="button" class="toc-action-btn" title="${this._t('toc.copy')}" data-action="copy">${this.getIcon('copy')}</button>
          <button type="button" class="toc-action-btn toc-action-fav" title="${this._t('toc.favorite')}" data-action="favorite" data-fav="${isFav ? '1' : '0'}">${isFav ? this.getIcon('star') : this.getIcon('starOutline')}</button>
        </div>
        ${hasMatch ? `<span class="toc-match-badge">${this.escapeHtml(matchLabel)}</span>` : ''}
      </li>`;
    }).join('');
    tocList.querySelectorAll('.toc-item').forEach((li) => {
      const messageId = li.getAttribute('data-message-id');
      const msg = this.messages.find((m) => m.id === messageId);
      const content = (msg && msg.content) || '';
      li.addEventListener('click', (e) => {
        if (this.exportState.active && this.exportState.scope === 'toc') {
          if (e.target.closest('.toc-action-btn') || e.target.closest('.toc-expand-text-btn')) return;
          const dot = li.querySelector('.export-select-dot');
          if (dot) this.toggleExportSelectionFromDot(dot);
          e.stopPropagation();
          e.preventDefault();
        }
      });
      const mainClickArea = li.querySelector('.toc-item-main');
      if (mainClickArea) {
        mainClickArea.addEventListener('click', (e) => {
          // 如果点击的是按钮，不触发跳转
          if (e.target.closest('.toc-expand-text-btn')) return;
          if (this.exportState.active && this.exportState.scope === 'toc') return;
          window.tocManager.jumpToMessage(messageId);
        });
        mainClickArea.style.cursor = 'pointer';
      }
      li.querySelectorAll('.toc-action-btn, .toc-expand-text-btn').forEach((btn) => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          const action = btn.getAttribute('data-action');
          if (action === 'expand') {
            this.toggleTocItemExpand(li, messageId);
          } else if (action === 'search') {
            this.openMsgSearchOverlay(messageId);
          } else if (action === 'copy') {
            this.copyMessageWithFormat(messageId, msg);
          } else if (action === 'favorite') {
            this.toggleTocFavorite(messageId).then(() => this.renderTOC());
          }
        });
      });
    });
    const userCount = tocItems.filter((item) => item.role === 'user').length;
    const aiCount = tocItems.length - userCount;
    const isFiltered = (this.tocFilterRole && this.tocFilterRole !== 'all') ||
      this.tocFilterFavorite ||
      this.hasActiveFilter() ||
      ((kw || '').trim().length > 0);
    this.updateTocSummary(tocItems.length, userCount, aiCount, isFiltered);
    this.updateTocFilterButtons();
    this.updateOpenInPlatformButtonText(window.platformAdapter ? window.platformAdapter.getPlatformName() : 'ChatGPT');
    this.log('TOC rendered:', tocItems.length, 'items');
    if (this.exportState.active && this.exportState.scope === 'toc') {
      this.syncExportSelectionUI();
    }
  }

  /** 根据当前或指定平台更新「在 X 中打开」按钮文案 */
  updateOpenInPlatformButtonText(platformName) {
    const btn = this.shadowRoot.getElementById('btn-open-conv');
    if (!btn) return;
    const name = (platformName || '').trim() || 'ChatGPT';
    btn.textContent = this._t('action.openInPlatform', { platform: name });
  }

  updateTocSummary(total, userCount, aiCount, isFiltered) {
    if (this.tocMod) this.tocMod.updateTocSummary(total, userCount, aiCount, isFiltered);
  }

  findPreviewBreakpoint(content) {
    return this.tocMod ? this.tocMod.findPreviewBreakpoint(content) : content.length;
  }

  countKeywordOccurrences(text, keyword) {
    return this.tocMod ? this.tocMod.countKeywordOccurrences(text, keyword) : 0;
  }

  async toggleTocFavorite(messageId) {
    if (!this.conversationId) return;
    try {
      const conv = await window.storageManager.getConversation(this.conversationId);
      conv.favoriteMessageIds = conv.favoriteMessageIds || [];
      const idx = conv.favoriteMessageIds.indexOf(messageId);
      if (idx >= 0) conv.favoriteMessageIds.splice(idx, 1);
      else conv.favoriteMessageIds.push(messageId);
      await window.storageManager.saveConversation(this.conversationId, conv);
      this.tocFavoriteMessageIds = new Set(conv.favoriteMessageIds);
    } catch (e) { this.log('toggleTocFavorite error:', e); }
  }

  toggleTocItemExpand(tocItem, messageId) {
    if (this.tocMod) this.tocMod.toggleTocItemExpand(tocItem, messageId);
  }

  extractRemainingHTML(fullHtml, skipChars) {
    return this.tocMod ? this.tocMod.extractRemainingHTML(fullHtml, skipChars) : fullHtml;
  }

  highlightInElement(element, keyword) {
    if (this.tocMod) this.tocMod.highlightInElement(element, keyword);
  }

  clearHighlightInElement(element) {
    if (this.tocMod) this.tocMod.clearHighlightInElement(element);
  }

  resolveMessageElement(messageId) {
    return this.tocMod ? this.tocMod.resolveMessageElement(messageId) : null;
  }

  scrollHighlightIntoViewCenter(markEl) {
    if (this.tocMod) this.tocMod.scrollHighlightIntoViewCenter(markEl);
  }

  openMsgSearchOverlay(messageId) {
    if (this.tocMod) this.tocMod.openMsgSearchOverlay(messageId);
  }

  closeMsgSearchOverlay() {
    if (this.tocMod) this.tocMod.closeMsgSearchOverlay();
  }

  getMsgSearchExpectedTab(messageId) {
    return this.tocMod ? this.tocMod.getMsgSearchExpectedTab(messageId) : 'toc';
  }

  stashMsgSearchOverlayForNextTab(nextTab) {
    if (this.tocMod) this.tocMod.stashMsgSearchOverlayForNextTab(nextTab);
  }

  restoreMsgSearchOverlayForTab(tabName) {
    if (this.tocMod) this.tocMod.restoreMsgSearchOverlayForTab(tabName);
  }

  async copyMessageWithFormat(messageId, msg) {
    try {
      const content = (msg && msg.content) || '';
      const element = this.resolveMessageElement(messageId);
      
      if (!navigator.clipboard) {
        this.log('Clipboard API not available');
        return;
      }

      if (navigator.clipboard.write && element) {
        const htmlContent = this.extractMessageHTML(element);
        const formattedText = this.extractFormattedText(element);
        
        const clipboardItem = new ClipboardItem({
          'text/html': new Blob([htmlContent], { type: 'text/html' }),
          'text/plain': new Blob([formattedText], { type: 'text/plain' })
        });
        
        await navigator.clipboard.write([clipboardItem]);
        this.showCopyFeedback(this._t('toast.copied'));
        this.log('Copied with format');
      } else {
        const element = this.resolveMessageElement(messageId);
        const formattedText = element ? this.extractFormattedText(element) : content;
        await navigator.clipboard.writeText(formattedText);
        this.showCopyFeedback(this._t('toast.copied'));
        this.log('Copied as formatted text');
      }
    } catch (error) {
      this.log('Copy error:', error);
      this.showCopyFeedback(this._t('toast.copyFailed'));
    }
  }

  extractMessageHTML(element) {
    return this.tocMod ? this.tocMod.extractMessageHTML(element) : '';
  }

  extractMessageHTMLForDisplay(element) {
    return this.tocMod ? this.tocMod.extractMessageHTMLForDisplay(element) : '';
  }

  /**
   * 移除 img、figure 等图片元素及由此产生的空白占位容器，保留 iframe、video 等视频内容
   * 插件内不显示照片，且不保留空白占位框
   */
  stripMediaElements(html) {
    if (!html || !html.trim()) return html;
    const div = document.createElement('div');
    div.innerHTML = html;
    // 移除图片及其 figure 容器
    div.querySelectorAll('img').forEach((el) => {
      const fig = el.closest('figure');
      if (fig) fig.remove();
      else el.remove();
    });
    div.querySelectorAll('figure').forEach((fig) => fig.remove());
    // 移除无文字内容的空段落
    div.querySelectorAll('p').forEach((p) => {
      if (!p.textContent.trim()) p.remove();
    });
    // 递归移除因去掉图片后变空的包装元素（避免留下空白占位框）
    this.removeEmptyImagePlaceholders(div);
    return div.innerHTML.trim() || html;
  }

  /**
   * 移除空占位容器：无文字且无子元素的 div/span（多为去掉图片后留下的空白框）
   */
  removeEmptyImagePlaceholders(container) {
    if (!container || !container.querySelectorAll) return;
    let removed;
    do {
      removed = 0;
      container.querySelectorAll('div, span').forEach((el) => {
        if (!el.parentNode) return;
        const hasText = (el.textContent || '').trim().length > 0;
        const hasChildElements = el.children.length > 0;
        if (!hasText && !hasChildElements) {
          el.remove();
          removed++;
        }
      });
    } while (removed > 0);
  }

  /**
   * 规范化媒体 URL，用于去重比较
   * - 对于 YouTube 视频，提取 video ID
   * - 移除常见的追踪参数
   */
  normalizeMediaSrc(src) {
    if (!src || typeof src !== 'string') return '';
    let normalized = src.trim().toLowerCase();

    // 提取 YouTube video ID
    const ytMatch = normalized.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|v\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/i);
    if (ytMatch) {
      return `youtube:${ytMatch[1]}`;
    }

    // 对于完整 URL，移除常见追踪参数但保留域名
    if (normalized.startsWith('http://') || normalized.startsWith('https://')) {
      try {
        const url = new URL(normalized);
        ['utm_source', 'utm_medium', 'utm_campaign', 'ref', 't', '_'].forEach(p => url.searchParams.delete(p));
        // 保留完整的 host + pathname + 清理后的参数
        normalized = url.host + url.pathname + (url.searchParams.toString() ? '?' + url.searchParams.toString() : '');
      } catch (e) {
        // URL 解析失败，使用原始值
      }
    }

    return normalized;
  }

  /**
   * 按媒体 src 去重，消除同一视频/图片在侧边栏重复显示
   */
  deduplicateMediaBySrc(html) {
    if (!html || !html.trim()) return html;
    const div = document.createElement('div');
    div.innerHTML = html;
    const seen = new Set();

    // 选择器：针对视频/嵌入内容去重，避免误伤普通内容图片
    const mediaEls = Array.from(div.querySelectorAll(
      'iframe[src], video[src], video source[src], ' +
      'a[href*="youtube"] img, a[href*="youtu.be"] img, ' +
      '[class*="video"] img, [class*="embed"] img'
    ));

    mediaEls.forEach((el) => {
      if (!el.parentNode) return;
      const rawSrc = (el.getAttribute('src') || el.src || '').trim();
      if (!rawSrc) return;

      const normalizedSrc = this.normalizeMediaSrc(rawSrc);
      if (!normalizedSrc) return;

      if (seen.has(normalizedSrc)) {
        // 尝试找到包含该媒体的卡片容器并移除整个容器
        const wrapper = el.closest('figure, a[href*="youtube"], a[href*="youtu.be"], div[class*="card"], div[class*="embed"], div[class*="video"]') || el.parentElement;
        if (wrapper && wrapper !== div && Array.from(wrapper.querySelectorAll('img, iframe, video')).length <= 1) {
          wrapper.remove();
        } else {
          el.remove();
        }
      } else {
        seen.add(normalizedSrc);
      }
    });

    // 额外：对整个视频卡片容器进行去重（基于链接 href）
    const videoCardSeen = new Set();
    const videoCards = Array.from(div.querySelectorAll('a[href*="youtube.com"], a[href*="youtu.be"]'));
    videoCards.forEach((card) => {
      if (!card.parentNode) return;
      const href = (card.getAttribute('href') || '').trim();
      const normalizedHref = this.normalizeMediaSrc(href);
      if (!normalizedHref) return;

      if (videoCardSeen.has(normalizedHref)) {
        // 移除重复的视频卡片容器
        const wrapper = card.closest('figure, div[class*="card"], div[class*="embed"]') || card;
        wrapper.remove();
      } else {
        videoCardSeen.add(normalizedHref);
      }
    });

    return div.innerHTML.trim() || html;
  }

  extractFormattedText(element) {
    if (!element) return '';
    const html = this.extractMessageHTML(element);
    return (window.HtmlToMarkdown && window.HtmlToMarkdown.toText(html)) || '';
  }

  convertHTMLToFormattedText(element) {
    if (!element) return '';
    return (window.HtmlToMarkdown && window.HtmlToMarkdown.toText(element.innerHTML || '')) || '';
  }

  showCopyFeedback(message) {
    const existing = this.shadowRoot.querySelector('.copy-feedback');
    if (existing) existing.remove();
    
    const feedback = document.createElement('div');
    feedback.className = 'copy-feedback';
    feedback.textContent = message;
    feedback.style.cssText = `
      position: fixed;
      top: 20px;
      left: 50%;
      transform: translateX(-50%);
      background: #10b981;
      color: white;
      padding: 8px 16px;
      border-radius: 6px;
      font-size: 13px;
      z-index: 1000000;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
      animation: fadeInOut 2s ease-in-out;
    `;
    
    this.shadowRoot.appendChild(feedback);
    
    setTimeout(() => {
      if (feedback.parentNode) feedback.remove();
    }, 2000);
  }

  updateTocFilterButtons() {
    const panel = this.shadowRoot.querySelector('[data-panel="toc"]');
    if (!panel) return;
    panel.querySelectorAll('.toc-filter-btn').forEach((btn) => {
      const isRole = btn.hasAttribute('data-filter-role');
      const isFav = btn.getAttribute('data-filter-favorite') === 'true';
      let active = false;
      if (isRole) active = this.tocFilterRole === btn.getAttribute('data-filter-role');
      else if (isFav) active = this.tocFilterFavorite;
      btn.classList.toggle('active', active);
    });
  }

  getFilterDateRange() {
    return this.filterMod ? this.filterMod.getFilterDateRange() : { start: null, end: null };
  }

  formatDateForInput(ms) {
    return this.filterMod ? this.filterMod.formatDateForInput(ms) : '';
  }

  parseDateInput(str) {
    return this.filterMod ? this.filterMod.parseDateInput(str) : null;
  }

  hasActiveFilter() {
    return this.filterMod ? this.filterMod.hasActiveFilter() : false;
  }

  applyFilterFromPanel(startInputId = 'filter-start-date', endInputId = 'filter-end-date') {
    if (this.filterMod) this.filterMod.applyFilterFromPanel(startInputId, endInputId);
  }

  clearTocFilter() {
    if (this.filterMod) this.filterMod.clearTocFilter();
  }

  syncFilterPanelUI(panelScope = 'conversations') {
    if (this.filterMod) this.filterMod.syncFilterPanelUI(panelScope);
  }

  updateFilterPlatformTriggerText(triggerId = 'filter-platform-trigger') {
    if (this.filterMod) this.filterMod.updateFilterPlatformTriggerText(triggerId);
  }

  formatTimeAgo(ms) {
    if (!ms) return '';
    const s = Math.floor((Date.now() - ms) / 1000);
    if (s < 60) return this._t('time.justNow');
    if (s < 3600) return this._t('time.minutesAgo', { n: String(Math.floor(s / 60)) });
    if (s < 86400) return this._t('time.hoursAgo', { n: String(Math.floor(s / 3600)) });
    if (s < 2592000) return this._t('time.daysAgo', { n: String(Math.floor(s / 86400)) });
    const locale = (window.i18nManager && window.i18nManager.getLanguage() === 'en') ? 'en-US' : 'zh-CN';
    return new Date(ms).toLocaleDateString(locale);
  }

  async renderConversationsList() {
    const listContainer = this.shadowRoot.getElementById('conversations-list-container');
    const detailContainer = this.shadowRoot.getElementById('conversation-detail-container');
    const listEl = this.shadowRoot.getElementById('conversations-by-platform');

    if (!listContainer || !listEl) return;

    listContainer.style.display = 'block';
    if (detailContainer) detailContainer.style.display = 'none';
    this.viewingConversationId = null;
    this.historyDetailMessages = null;
    this.historyDetailConvId = null;

    const listSearchWrapEl = this.shadowRoot.getElementById('conversations-search-and-filter-wrap');
    const convSearchInputEl = this.shadowRoot.getElementById('conversations-search-input');
    const convDetailSearchEl = this.shadowRoot.getElementById('conv-detail-search-input');
    const btnConvFilterEl = this.shadowRoot.getElementById('btn-conversations-filter');
    if (listSearchWrapEl) listSearchWrapEl.style.display = '';
    if (convSearchInputEl) convSearchInputEl.placeholder = this._t('filter.search.conversations');
    if (btnConvFilterEl) btnConvFilterEl.style.display = '';
    if (convDetailSearchEl) convDetailSearchEl.oninput = null;

    try {
      const autoProjects = window.projectManager.getAutoProjects();
      const list = await window.storageManager.getConversationList() || [];
      const listById = {};
      list.forEach((item) => { listById[item.id] = item; });

      const { start: rangeStart, end: rangeEnd } = this.getFilterDateRange();
      const kw = (this.conversationsSearchKeyword || '').trim();
      const kwLower = kw.toLowerCase();

      const filterEntriesForHistory = async (convIds) => {
        let entries = convIds.map((id) => listById[id]).filter(Boolean);
        if (rangeStart != null && rangeEnd != null) {
          entries = entries.filter((item) => {
            const t = item.lastSeenAt || 0;
            return t >= rangeStart && t <= rangeEnd;
          });
        }
        if (this.tocFilterPlatforms && this.tocFilterPlatforms.length > 0) {
          entries = entries.filter((item) => {
            const platform = item.platform || 'ChatGPT';
            return this.tocFilterPlatforms.includes(platform);
          });
        }
        if (kwLower) {
          entries = entries.map((item) => ({
            ...item,
            _titleMatch: (item.title || '').toLowerCase().includes(kwLower),
            _snippetMatch: (item.snippet || '').toLowerCase().includes(kwLower),
            _contentMatchCount: 0
          }));
          if (entries.length > 0) {
            await Promise.all(entries.map(async (item) => {
              try {
                const conv = await window.storageManager.getConversation(item.id);
                const messages = conv.messages || [];
                let count = 0;
                messages.forEach((m) => {
                  if ((m.content || '').toLowerCase().includes(kwLower)) count++;
                });
                item._contentMatchCount = count;
              } catch (e) {
                this.log('history content match error:', e);
                item._contentMatchCount = 0;
              }
            }));
          }
          entries = entries.filter((item) => item._titleMatch || item._snippetMatch || item._contentMatchCount > 0);
        }
        return entries.sort((a, b) => (b.lastSeenAt || 0) - (a.lastSeenAt || 0));
      };

      const byPlatform = {};
      Object.entries(autoProjects).forEach(([key, project]) => {
        const platform = project.platform || 'ChatGPT';
        if (!byPlatform[platform]) byPlatform[platform] = [];
        byPlatform[platform].push({ key, project });
      });

      if (Object.keys(byPlatform).length === 0) {
        const emptyText = this.hasActiveFilter() ? this._t('empty.noFilterResults') : this._t('empty.noConversations');
        listEl.innerHTML = '<div class="empty-state"><div class="empty-state-icon">💬</div><div class="empty-state-text">' + emptyText.replace(/\n/g, '<br>') + '</div></div>';
        if (this.exportState.active && this.exportState.scope === 'history') this.syncExportSelectionUI();
        return;
      }

      const noConvs = this._t('project.noConvs');
      const buildCardListHtml = (entries) => {
        if (entries.length === 0) return `<ul class="project-conv-list-view"><li class="project-conv-empty">${this.escapeHtml(noConvs)}</li></ul>`;
        return `<ul class="project-conv-list-view">${entries
          .map((item) => {
            const titleText = (item.title || this._t('conv.defaultTitle')).slice(0, 36);
            const snippetText = (item.snippet || '').slice(0, 100);
            const titleHtml = kwLower ? this.highlightKeywordInText(titleText, kw) : this.escapeHtml(titleText);
            const snippetHtml = kwLower ? this.highlightKeywordInText(snippetText, kw) : this.escapeHtml(snippetText);
            const showContentMatch = kwLower && item._contentMatchCount > 0;
            const matchText = showContentMatch ? this._t('conv.contentMatches', { n: String(item._contentMatchCount) }) : '';
            const platformName = item.platform || 'ChatGPT';
            const platformTag = this.escapeHtml(platformName);
            const pIconUrl = this.getPlatformIconUrl(platformName);
            return `
                <li class="conv-card" data-conversation-id="${this.escapeHtml(item.id)}">
                  <button type="button" class="export-select-dot" data-scope="history" data-type="conversation" data-id="${this.escapeHtml(item.id)}" aria-label="${this._t('export.select')}"></button>
                  <div class="conv-card-header">
                    <div class="conv-card-title conv-card-title-editable" title="${this.escapeHtml(this._t('conv.editTitleHint'))}">${titleHtml}</div>
                    <div class="conv-card-actions">
                      <button type="button" class="conv-card-action" data-action="open" title="${this.escapeHtml(this._t('conv.openInNewTab'))}">${this.getIcon('external')}</button>
                      <button type="button" class="conv-card-action" data-action="add-to-project" title="${this.escapeHtml(this._t('filter.addToProject'))}">${this.getIcon('folderAdd')}</button>
                      <button type="button" class="conv-card-action conv-card-action--delete" data-action="delete" title="${this.escapeHtml(this._t('conv.delete'))}">${this.getIcon('trash')}</button>
                    </div>
                  </div>
                  <div class="conv-card-snippet">${snippetHtml}</div>
                  <div class="conv-card-meta">
                    <span class="conv-card-tag">
                      <img src="${this.escapeHtml(pIconUrl)}" alt="" class="conv-card-tag-icon" />
                      <span class="conv-card-tag-text">${platformTag}</span>
                    </span>
                    ${showContentMatch ? `<span class="conv-card-match">${this.escapeHtml(matchText)}</span>` : ''}
                    <span class="conv-card-info">💬 ${item.messageCount || 0}</span>
                    <span class="conv-card-time">${this.formatTimeAgo(item.lastSeenAt)}</span>
                  </div>
                </li>`;
          })
          .join('')}</ul>`;
      };
      const buildProjectItemHtml = (key, name, filteredEntries, showDeleteBtn, expandByDefault) => {
        const cardListHtml = buildCardListHtml(filteredEntries);
        const convListSection = filteredEntries.length === 0
          ? `<ul class="project-conversations"><li class="project-conv-empty">${this.escapeHtml(noConvs)}</li></ul>`
          : `<div class="project-conversations">${cardListHtml}</div>`;
        const deleteBtn = showDeleteBtn ? `<button type="button" class="project-header-action" data-action="delete-project" title="${this.escapeHtml(this._t('project.removeCategory'))}">${this.getIcon('trash')}</button>` : '';
        const expandedClass = expandByDefault ? ' expanded' : '';
        return `
        <li class="project-item${expandedClass}" data-project-type="auto" data-project-key="${this.escapeHtml(key)}">
          <div class="project-item-header">
            <span class="project-expand-icon">▶</span>
            <button type="button" class="export-select-dot" data-scope="history" data-type="project" data-project-type="auto" data-project-key="${this.escapeHtml(key)}" aria-label="${this._t('export.select')}"></button>
            <div class="project-name">
              <span>${this.escapeHtml(name)}</span>
              <span class="project-count">${filteredEntries.length}</span>
            </div>
            <div class="project-item-header-actions">${deleteBtn}</div>
          </div>
          ${convListSection}
        </li>`;
      };

      const platformOrder = ['ChatGPT', 'Gemini', 'Claude'];
      const platformBlocks = [];
      for (const platform of platformOrder) {
        const plist = byPlatform[platform];
        if (!plist || plist.length === 0) continue;
        const platformTitle = this._t('project.projectsInPlatform', { platform });
        const platformIconUrl = this.getPlatformIconUrl(platform);

        if (platform === 'ChatGPT') {
          const chatgptProjects = plist.filter(({ key }) => key !== 'ChatGPT:Inbox');
          const chatgptInbox = plist.find(({ key }) => key === 'ChatGPT:Inbox');
          const projectsSectionItems = [];
          for (const { key, project } of chatgptProjects) {
            const name = project.name || key;
            const filteredEntries = await filterEntriesForHistory(project.conversations || []);
            if (kwLower && filteredEntries.length === 0 && !name.toLowerCase().includes(kwLower)) continue;
            const expandBySearch = !!(kwLower && (filteredEntries.length > 0 || name.toLowerCase().includes(kwLower)));
            projectsSectionItems.push(buildProjectItemHtml(key, name, filteredEntries, true, expandBySearch));
          }
          let yourChatsSectionHtml = '';
          if (chatgptInbox) {
            const inboxProject = chatgptInbox.project;
            const filteredInbox = await filterEntriesForHistory(inboxProject.conversations || []);
            if (!kwLower || filteredInbox.length > 0 || (kwLower && '你的聊天'.toLowerCase().includes(kwLower))) {
              const yourChatsLabel = this._t('history.chatgpt.yourChats');
              const expandBySearch = !!(kwLower && filteredInbox.length > 0);
              yourChatsSectionHtml = buildProjectItemHtml('ChatGPT:Inbox', yourChatsLabel, filteredInbox, false, expandBySearch);
            }
          }
          const projectsTitle = this._t('history.chatgpt.projects');
          const yourChatsTitle = this._t('history.chatgpt.yourChats');
          const hasProjects = projectsSectionItems.length > 0;
          const hasYourChats = yourChatsSectionHtml !== '';
          if (!hasProjects && !hasYourChats && kwLower) continue;
          const projectsSectionKey = 'ChatGPT:projects';
          const projectsCollapsed = !kwLower && this.historySectionCollapsed.has(projectsSectionKey);
          const projectsToggleTitle = projectsCollapsed ? this._t('toc.expand') : this._t('toc.collapse');
          platformBlocks.push(`
          <div class="project-platform-block" data-platform="ChatGPT">
            <h4 class="project-platform-subtitle"><img class="project-section-icon" alt="" src="${this.escapeHtml(platformIconUrl)}" />${this.escapeHtml(platformTitle)}</h4>
            <div class="history-chatgpt-sections">
              <div class="history-chatgpt-section${projectsCollapsed ? ' history-section-collapsed' : ''}" data-section-key="${this.escapeHtml(projectsSectionKey)}">
                <div class="history-chatgpt-section-header">
                  <h5 class="history-chatgpt-section-title">${this.escapeHtml(projectsTitle)}</h5>
                  <button type="button" class="history-section-toggle" title="${this.escapeHtml(projectsToggleTitle)}" aria-label="${this.escapeHtml(projectsToggleTitle)}">${this.getIcon('chevronDown')}</button>
                </div>
                <div class="history-chatgpt-section-body">
                  <ul class="project-list">${hasProjects ? projectsSectionItems.join('') : '<li class="project-conv-empty">' + this.escapeHtml(this._t('empty.noFilterProjects')) + '</li>'}</ul>
                </div>
              </div>
              <div class="history-chatgpt-section">
                <h5 class="history-chatgpt-section-title">${this.escapeHtml(yourChatsTitle)}</h5>
                <ul class="project-list">${hasYourChats ? yourChatsSectionHtml : '<li class="project-conv-empty">' + this.escapeHtml(noConvs) + '</li>'}</ul>
              </div>
            </div>
          </div>`);
        } else {
          const projectItems = [];
          for (const { key, project } of plist) {
            const isInbox = key === `${platform}:Inbox`;
            const name = isInbox ? this._t('history.chatgpt.yourChats') : (project.name || key);
            const filteredEntries = await filterEntriesForHistory(project.conversations || []);
            if (kwLower && filteredEntries.length === 0 && !name.toLowerCase().includes(kwLower)) continue;
            const expandBySearch = !!(kwLower && (filteredEntries.length > 0 || name.toLowerCase().includes(kwLower)));
            projectItems.push(buildProjectItemHtml(key, name, filteredEntries, !isInbox, expandBySearch));
          }
          if (projectItems.length === 0 && kwLower) continue;
          platformBlocks.push(`
          <div class="project-platform-block" data-platform="${this.escapeHtml(platform)}">
            <h4 class="project-platform-subtitle"><img class="project-section-icon" alt="" src="${this.escapeHtml(platformIconUrl)}" />${this.escapeHtml(platformTitle)}</h4>
            <ul class="project-list">${projectItems.length ? projectItems.join('') : '<li class="project-conv-empty">' + this.escapeHtml(this._t('empty.noFilterProjects')) + '</li>'}</ul>
          </div>`);
        }
      }

      if (platformBlocks.length === 0) {
        const emptyText = this.hasActiveFilter() ? this._t('empty.noFilterResults') : this._t('empty.noConversations');
        listEl.innerHTML = '<div class="empty-state"><div class="empty-state-icon">💬</div><div class="empty-state-text">' + emptyText.replace(/\n/g, '<br>') + '</div></div>';
      } else {
        listEl.innerHTML = platformBlocks.join('');
        this.bindHistoryPlatformEvents(listEl);
        this.applyHistoryExpandedState(listEl);
      }

      if (this.exportState.active && this.exportState.scope === 'history') {
        this.syncExportSelectionUI();
      }
    } catch (e) {
      listEl.innerHTML = '<div class="empty-state"><div class="empty-state-text">' + this._t('empty.loadFailed') + '</div></div>';
    }
  }

  /**
   * 绑定历史页「按平台/项目分组」的展开与卡片事件（点击卡片进入全局详情）
   */
  bindHistoryPlatformEvents(container) {
    if (!container) return;
    container.querySelectorAll('.history-chatgpt-section').forEach((section) => {
      const toggleBtn = section.querySelector('.history-section-toggle');
      const key = section.getAttribute('data-section-key');
      if (!toggleBtn || !key) return;
      toggleBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        e.preventDefault();
        const nextCollapsed = !section.classList.contains('history-section-collapsed');
        section.classList.toggle('history-section-collapsed', nextCollapsed);
        this.updateHistorySectionCollapsed(key, nextCollapsed);
        const label = nextCollapsed ? this._t('toc.expand') : this._t('toc.collapse');
        toggleBtn.setAttribute('title', label);
        toggleBtn.setAttribute('aria-label', label);
      });
    });
    container.querySelectorAll('.project-item').forEach((item) => {
      const header = item.querySelector('.project-item-header');
      const key = item.getAttribute('data-project-key');
      if (!header) return;
      header.onclick = (e) => {
        const dot = e.target.closest('.export-select-dot');
        if (dot) {
          e.stopPropagation();
          e.preventDefault();
          this.toggleExportSelectionFromDot(dot);
          return;
        }
        e.stopPropagation();
        e.preventDefault();
        if (e.target.closest('.project-item-header-actions')) return;
        if (this.exportState.active && this.exportState.scope === 'history') {
          item.classList.toggle('expanded');
          this.updateHistoryExpandedState(key, item.classList.contains('expanded'));
          return;
        }
        item.classList.toggle('expanded');
        this.updateHistoryExpandedState(key, item.classList.contains('expanded'));
      };
      item.querySelectorAll('.project-header-action[data-action="delete-project"]').forEach((btn) => {
        btn.addEventListener('click', async (e) => {
          e.stopPropagation();
          const displayName = key;
          const ok = await this.showConfirmDialog(this._t('confirm.title'), this._t('confirm.removeCategory.message', { name: displayName }));
          if (!ok) return;
          await window.projectManager.deleteChatGPTProjectCategory(key);
          this.renderConversationsList();
        });
      });
      const listView = item.querySelector('.project-conv-list-view');
      if (listView) {
        listView.querySelectorAll('.conv-card').forEach((card) => {
          const convId = card.getAttribute('data-conversation-id');
          card.addEventListener('click', (e) => {
            if (this.exportState.active && this.exportState.scope === 'history') {
              if (e.target.closest('.export-select-dot')) return;
              const dot = card.querySelector('.export-select-dot');
              if (dot) this.toggleExportSelectionFromDot(dot);
              return;
            }
            if (e.target.closest('.conv-card-action')) return;
            if (e.target.closest('.conv-card-title')) return;
            this.renderConversationDetailInToc(convId);
          });
          card.querySelector('.conv-card-title')?.addEventListener('dblclick', (e) => {
            e.stopPropagation();
            if (this.exportState.active && this.exportState.scope === 'history') return;
            this.editConversationTitle(convId, card);
          });
          card.querySelectorAll('.conv-card-action').forEach((btn) => {
            btn.addEventListener('click', (e) => {
              e.stopPropagation();
              if (this.exportState.active && this.exportState.scope === 'history') {
                const dot = card.querySelector('.export-select-dot');
                if (dot) this.toggleExportSelectionFromDot(dot);
                return;
              }
              const action = btn.getAttribute('data-action');
              if (action === 'open') this.openConversationInNewTab(convId);
              else if (action === 'add-to-project') this.showAddToProjectDialog(convId);
              else if (action === 'delete') this.deleteConversation(convId);
            });
          });
        });
      }
    });
  }

  applyHistoryExpandedState(container) {
    if (!container || !this.historyExpandedProjects || this.historyExpandedProjects.size === 0) return;
    container.querySelectorAll('.project-item').forEach((item) => {
      const key = item.getAttribute('data-project-key');
      if (key && this.historyExpandedProjects.has(key)) {
        item.classList.add('expanded');
      }
    });
  }

  updateHistoryExpandedState(key, expanded) {
    if (!key) return;
    if (expanded) this.historyExpandedProjects.add(key);
    else this.historyExpandedProjects.delete(key);
  }

  updateHistorySectionCollapsed(key, collapsed) {
    if (!key) return;
    if (collapsed) this.historySectionCollapsed.add(key);
    else this.historySectionCollapsed.delete(key);
  }

  async renderConversationDetailInToc(conversationId) {
    if (this.exportState.active && this.exportState.scope === 'history') {
      this.exitExportMode();
    }
    const listContainer = this.shadowRoot.getElementById('conversations-list-container');
    const detailContainer = this.shadowRoot.getElementById('conversation-detail-container');
    const headerEl = this.shadowRoot.getElementById('conv-detail-header');
    const messagesEl = this.shadowRoot.getElementById('conv-detail-messages');
    const btnOpen = this.shadowRoot.getElementById('btn-open-conv');
    const btnBack = this.shadowRoot.getElementById('btn-conv-back');

    if (!listContainer || !detailContainer) return;

    this.viewingConversationId = conversationId;
    listContainer.style.display = 'none';
    detailContainer.style.display = 'flex';

    const listSearchWrapEl = this.shadowRoot.getElementById('conversations-search-and-filter-wrap');
    const convSearchInputEl = this.shadowRoot.getElementById('conversations-search-input');
    const convDetailSearchEl = this.shadowRoot.getElementById('conv-detail-search-input');
    const btnConvFilterEl = this.shadowRoot.getElementById('btn-conversations-filter');
    const convFilterPanelEl = this.shadowRoot.getElementById('conversations-filter-panel');
    if (listSearchWrapEl) listSearchWrapEl.style.display = 'none';
    if (btnConvFilterEl) btnConvFilterEl.style.display = 'none';
    if (convFilterPanelEl) convFilterPanelEl.style.display = 'none';
    if (convDetailSearchEl) {
      convDetailSearchEl.placeholder = this._t('filter.search.currentConv');
      if (convSearchInputEl && convSearchInputEl.value.trim()) convDetailSearchEl.value = convSearchInputEl.value.trim();
      convDetailSearchEl.oninput = () => this.handleHistoryDetailSearch(convDetailSearchEl.value.trim());
    }

    try {
      const convData = await window.storageManager.getConversation(conversationId);
      const messages = convData.messages || [];
      this.historyDetailMessages = messages;
      this.historyDetailConvId = conversationId;
      this.historyDetailConvData = convData;

      this.updateOpenInPlatformButtonText(convData.platform || 'ChatGPT');

      headerEl.innerHTML = '<div class="conv-detail-header-inner">' +
        '<div class="conv-detail-title conv-detail-title-editable" title="' + this._t('conv.editTitleHint') + '">' + this.escapeHtml(convData.title || this._t('conv.defaultTitle')) + '</div>' +
      '</div>';
      headerEl.querySelector('.conv-detail-title')?.addEventListener('dblclick', () => {
        this.editConversationTitle(conversationId, null);
      });

      if (!messages || messages.length === 0) {
        messagesEl.innerHTML = '<div class="empty-state">' + this._t('empty.noMessages') + '</div>';
      } else {
        const initialKeyword = convDetailSearchEl ? convDetailSearchEl.value.trim() : '';
        this.handleHistoryDetailSearch(initialKeyword || null);
      }

      this.bindConvDetailFilters(conversationId, convDetailSearchEl);

      btnOpen.onclick = () => {
        const url = this.getConversationOpenUrl(convData.platform || 'ChatGPT', conversationId, convData.link);
        if (url) window.open(url, '_blank');
      };

    } catch (e) {
      headerEl.textContent = this._t('conv.loadFailed');
      messagesEl.innerHTML = '';
    }

    btnBack.onclick = () => this.renderConversationsList();
    this.restoreMsgSearchOverlayForTab('conversations');
  }

  /**
   * 绑定历史对话详情层的五个筛选/操作按钮
   */
  bindConvDetailFilters(conversationId, convSearchInputEl) {
    const filtersEl = this.shadowRoot.getElementById('conv-detail-filters');
    if (!filtersEl) return;

    filtersEl.querySelectorAll('.toc-filter-btn').forEach((btn) => {
      const fresh = btn.cloneNode(true);
      fresh.classList.remove('active');
      const role = fresh.getAttribute('data-filter-role');
      const isFav = fresh.getAttribute('data-filter-favorite') === 'true';
      if (role && (this.tocFilterRole || 'all') === role) fresh.classList.add('active');
      if (isFav && this.tocFilterFavorite) fresh.classList.add('active');
      btn.replaceWith(fresh);
    });

    filtersEl.querySelectorAll('.toc-filter-btn').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (btn.id === 'conv-detail-add-to-project') {
          this.showAddToProjectDialog(conversationId);
          return;
        }
        const role = btn.getAttribute('data-filter-role');
        const isFav = btn.getAttribute('data-filter-favorite') === 'true';
        if (role) {
          this.tocFilterRole = role;
          filtersEl.querySelectorAll('[data-filter-role]').forEach((b) => b.classList.toggle('active', b.getAttribute('data-filter-role') === role));
          filtersEl.querySelector('[data-filter-favorite="true"]')?.classList.remove('active');
        } else if (isFav) {
          this.tocFilterFavorite = !this.tocFilterFavorite;
          btn.classList.toggle('active', this.tocFilterFavorite);
        }
        const kw = convSearchInputEl ? convSearchInputEl.value.trim() : '';
        this.handleHistoryDetailSearch(kw || null);
      });
    });
  }

  /**
   * 历史对话详情层：在当前对话内容中搜索并高亮，支持角色和收藏筛选
   */
  handleHistoryDetailSearch(keyword) {
    const messagesEl = this.shadowRoot.getElementById('conv-detail-messages');
    if (!messagesEl || !this.historyDetailMessages || !this.historyDetailMessages.length) return;

    const kw = (keyword || '').trim();
    const favIds = new Set((this.historyDetailConvData?.favoriteMessageIds || []));
    let messages = this.historyDetailMessages
      .map((m, i) => ({ ...m, _index: i }))
      .filter((m) => {
        if (this.tocFilterRole && this.tocFilterRole !== 'all' && m.role !== this.tocFilterRole) return false;
        if (this.tocFilterFavorite && !favIds.has(`msg_${m._index}`)) return false;
        return true;
      });
    const kwLower = kw.toLowerCase();

    // 优先用保存时与「当前对话」一致的 contentHtml，无则用正文解析
    const buildMessageHtml = (msg) => {
      const html = (msg.contentHtml != null && msg.contentHtml !== '') ? msg.contentHtml : this.formatHistoryContent(msg.content || '');
      return this.applyHighlightToTextContentOnly(html, kw);
    };

    if (messages.length === 0) {
      messagesEl.innerHTML = '<div class="empty-state"><div class="empty-state-text">' + this._t('empty.noFilterMessages') + '</div></div>';
      return;
    }

    const html = '<ul class="toc-list conv-detail-toc-list">' + messages.map((m, idx) => {
      const index = m._index;
      const isUser = m.role === 'user';
      const roleLabel = isUser ? this._t('role.user') : this._t('role.assistant');
      const roleIcon = isUser ? this.getIcon('user') : this.getIcon('bot');
      const roleAttr = isUser ? 'user' : 'assistant';
      const content = m.content || '';
      const num = index + 1;
      const previewBreakpoint = this.findPreviewBreakpoint(content);
      const hasLongContent = content.length > previewBreakpoint;
      const fullContentHtml = buildMessageHtml(m);
      const msgId = `hist_msg_${index}`;
      const favKey = `msg_${index}`;
      const isFav = favIds.has(favKey);
      const matchCount = kw ? this.countKeywordOccurrences(content, kw) : 0;
      const hasMatch = matchCount > 0;
      const matchLabel = hasMatch ? this._t('search.matchCount', { n: String(matchCount) }) : '';
      const expanded = false;
      const expandClass = expanded ? ' toc-content-expanded' : '';
      const expandAria = expanded ? 'true' : 'false';
      const expandText = expanded ? this._t('toc.collapse') : this._t('toc.expand');
      const expandIcon = expanded ? this.getIcon('chevronUp') : this.getIcon('chevronDown');

      return '<li class="toc-item' + (hasMatch ? ' has-match-badge' : '') + '" data-role="' + roleAttr + '" data-message-id="' + msgId + '" data-expanded="' + expanded + '" data-hist-index="' + index + '">' +
        '<div class="toc-item-main">' +
          '<div class="toc-index" title="' + this.escapeHtml(roleLabel) + '">#' + num + '</div>' +
          '<div class="toc-meta"><span class="toc-role-icon" aria-hidden="true">' + roleIcon + '</span>' + this.escapeHtml(roleLabel) + '</div>' +
          '<div class="toc-content-wrapper">' +
            (hasLongContent ? '<div class="toc-content-collapsible' + expandClass + '" aria-expanded="' + expandAria + '"><div class="toc-content-full">' + fullContentHtml + '</div><div class="toc-preview-fade" aria-hidden="true"></div></div><div class="toc-expand-btn-row"><button type="button" class="toc-expand-text-btn" data-action="expand"><span class="toc-expand-text">' + expandText + '</span><span class="toc-expand-icon toc-expand-icon-svg" aria-hidden="true">' + expandIcon + '</span></button></div>' : '<div class="toc-content-full toc-content-full-standalone">' + fullContentHtml + '</div>') +
          '</div>' +
        '</div>' +
        '<div class="toc-item-actions">' +
          (hasLongContent ? '<button type="button" class="toc-action-btn toc-collapse-btn" title="' + this._t('toc.collapse') + '" data-action="expand">' + this.getIcon('chevronUp') + '</button>' : '') +
          '<button type="button" class="toc-action-btn" title="' + this._t('toc.copy') + '" data-action="copy" data-content="' + this.escapeHtml(content) + '">' + this.getIcon('copy') + '</button>' +
          '<button type="button" class="toc-action-btn toc-action-fav" title="' + this._t('toc.favorite') + '" data-action="favorite" data-fav="' + (isFav ? '1' : '0') + '">' + (isFav ? this.getIcon('star') : this.getIcon('starOutline')) + '</button>' +
        '</div>' +
        (hasMatch ? '<span class="toc-match-badge">' + this.escapeHtml(matchLabel) + '</span>' : '') +
      '</li>';
    }).join('') + '</ul>';

    messagesEl.innerHTML = html;

    messagesEl.querySelectorAll('.toc-item').forEach((li) => {
      const histIndex = li.getAttribute('data-hist-index');
      li.querySelectorAll('.toc-action-btn, .toc-expand-text-btn').forEach((btn) => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          const action = btn.getAttribute('data-action');
          if (action === 'expand') {
            this.toggleHistoryTocItemExpand(li);
          } else if (action === 'copy') {
            const content = btn.getAttribute('data-content');
            this.copyTextToClipboard(content);
          } else if (action === 'favorite' && histIndex != null) {
            this.toggleHistoryDetailFavorite(parseInt(histIndex, 10)).then(() => this.handleHistoryDetailSearch(kw || null));
          }
        });
      });
    });

  }

  /**
   * 历史对话详情：切换某条消息的收藏状态（与当前对话收藏一致）
   */
  async toggleHistoryDetailFavorite(histIndex) {
    const convId = this.historyDetailConvId;
    if (!convId) return;
    try {
      const conv = await window.storageManager.getConversation(convId);
      conv.favoriteMessageIds = conv.favoriteMessageIds || [];
      const id = `msg_${histIndex}`;
      const idx = conv.favoriteMessageIds.indexOf(id);
      if (idx >= 0) conv.favoriteMessageIds.splice(idx, 1);
      else conv.favoriteMessageIds.push(id);
      await window.storageManager.saveConversation(convId, conv);
      this.historyDetailConvData = conv;
    } catch (e) {
      this.log('toggleHistoryDetailFavorite error:', e);
    }
  }

  /**
   * 项目内对话详情：切换某条消息的收藏状态（与当前对话收藏一致）
   */
  async toggleProjectDetailFavorite(convId, projIndex) {
    if (!convId) return;
    try {
      const conv = await window.storageManager.getConversation(convId);
      conv.favoriteMessageIds = conv.favoriteMessageIds || [];
      const id = `msg_${projIndex}`;
      const idx = conv.favoriteMessageIds.indexOf(id);
      if (idx >= 0) conv.favoriteMessageIds.splice(idx, 1);
      else conv.favoriteMessageIds.push(id);
      await window.storageManager.saveConversation(convId, conv);
      this.projectsDetailConvData = conv;
    } catch (e) {
      this.log('toggleProjectDetailFavorite error:', e);
    }
  }

  /**
   * 格式化历史/项目内对话内容，与「当前对话」一致：段落、列表、标题、加粗（toc-expanded-*）
   */
  formatHistoryContent(content) {
    if (!content || !content.trim()) return '<p class="toc-expanded-p toc-content-lead-wrap">无内容</p>';
    return this.formatContentAsTocHtml(content);
  }

  /**
   * 将纯文本/简单 Markdown 转为与当前对话一致的 HTML（段落、列表、标题、**加粗**）
   */
  formatContentAsTocHtml(content) {
    if (!content || !content.trim()) return '<p class="toc-expanded-p toc-content-lead-wrap">无内容</p>';
    const leadLen = this.findLeadLength(content);
    const rawBlocks = content.split(/\n\n+/).map((b) => b.trim()).filter(Boolean);
    if (rawBlocks.length === 0) return '<p class="toc-expanded-p toc-content-lead-wrap">无内容</p>';

    const out = [];
    for (let i = 0; i < rawBlocks.length; i++) {
      const block = rawBlocks[i];
      const lines = block.split(/\n/).map((l) => l.trim()).filter(Boolean);

      // 代码块：```...```（HtmlToMarkdown 输出格式）
      const codeBlockMatch = block.match(/^```(?:\w+)?\s*\n?([\s\S]*?)```\s*$/);
      if (codeBlockMatch) {
        const codeContent = (codeBlockMatch[1] || '').trim();
        out.push('<pre class="toc-expanded-pre"><code class="toc-expanded-code">' + this.escapeHtml(codeContent) + '</code></pre>');
        continue;
      }

      // 标题：## 或 ### 开头
      const h2Match = block.match(/^##\s+(.+)$/s);
      const h3Match = block.match(/^###\s+(.+)$/s);
      if (h2Match) {
        out.push(`<h2 class="toc-expanded-h2">${this.applyInlineBold(h2Match[1].trim())}</h2>`);
        continue;
      }
      if (h3Match) {
        out.push(`<h3 class="toc-expanded-h3">${this.applyInlineBold(h3Match[1].trim())}</h3>`);
        continue;
      }

      // 有序列表：① ② ③ 或 1. 2. 3.
      const circled = /^[①②③④⑤⑥⑦⑧⑨⑩]\s*/;
      const numDot = /^\d+\.\s+/;
      const allCircled = lines.length > 0 && lines.every((l) => circled.test(l));
      const allNumDot = lines.length > 0 && lines.every((l) => numDot.test(l));
      if (allCircled && lines.length >= 1) {
        const items = lines.map((l) => l.replace(circled, '').trim()).filter(Boolean);
        out.push('<ol class="toc-expanded-ol">' + items.map((t) => `<li class="toc-expanded-li">${this.applyInlineBold(t)}</li>`).join('') + '</ol>');
        continue;
      }
      if (allNumDot && lines.length >= 1) {
        const items = lines.map((l) => l.replace(numDot, '').trim()).filter(Boolean);
        out.push('<ol class="toc-expanded-ol">' + items.map((t) => `<li class="toc-expanded-li">${this.applyInlineBold(t)}</li>`).join('') + '</ol>');
        continue;
      }

      // 无序列表：- 或 * 开头
      const bullet = /^[-*]\s+/;
      const allBullet = lines.length > 0 && lines.every((l) => bullet.test(l));
      if (allBullet && lines.length >= 1) {
        const items = lines.map((l) => l.replace(bullet, '').trim()).filter(Boolean);
        out.push('<ul class="toc-expanded-ul">' + items.map((t) => `<li class="toc-expanded-li">${this.applyInlineBold(t)}</li>`).join('') + '</ul>');
        continue;
      }

      // 无换行时按 ① ② ③ 拆成列表（兼容旧保存的无结构长文）
      if (rawBlocks.length === 1 && /[①②③④⑤⑥⑦⑧⑨⑩]/.test(block)) {
        const listParts = block.split(/(?=[①②③④⑤⑥⑦⑧⑨⑩])/).map((s) => s.trim()).filter(Boolean);
        const listItems = listParts.filter((s) => /^[①②③④⑤⑥⑦⑧⑨⑩]/.test(s));
        const prefix = listParts[0] && !/^[①②③④⑤⑥⑦⑧⑨⑩]/.test(listParts[0]) ? listParts[0] : '';
        if (listItems.length >= 1) {
          if (prefix) out.push(`<p class="toc-expanded-p">${this.applyInlineBold(prefix)}</p>`);
          out.push('<ol class="toc-expanded-ol">' + listItems.map((t) => `<li class="toc-expanded-li">${this.applyInlineBold(t)}</li>`).join('') + '</ol>');
          continue;
        }
      }

      // 普通段落
      const paraHtml = this.applyInlineBold(block).replace(/\n/g, '<br>');
      if (i === 0 && leadLen > 0) {
        const lead = block.slice(0, leadLen);
        const rest = block.slice(leadLen);
        if (rest.length === 0) {
          out.push(`<p class="toc-expanded-p toc-content-lead-wrap"><strong class="toc-content-lead">${this.applyInlineBold(lead)}</strong></p>`);
        } else {
          out.push(`<p class="toc-expanded-p toc-content-lead-wrap"><strong class="toc-content-lead">${this.applyInlineBold(lead)}</strong>${this.applyInlineBold(rest).replace(/\n/g, '<br>')}</p>`);
        }
      } else {
        out.push(`<p class="toc-expanded-p">${paraHtml}</p>`);
      }
    }
    return out.join('');
  }

  /**
   * 将文本中的 **bold** 转为 <strong class="toc-expanded-strong">
   */
  applyInlineBold(text) {
    if (!text || !text.includes('**')) return this.escapeHtml(text);
    const parts = text.split(/\*\*/);
    return parts.map((p, i) => (i % 2 === 1 ? '<strong class="toc-expanded-strong">' + this.escapeHtml(p) + '</strong>' : this.escapeHtml(p))).join('');
  }

  /**
   * 切换历史对话 TOC 项展开/收起
   */
  toggleHistoryTocItemExpand(tocItem) {
    if (!tocItem) return;

    const isExpanded = tocItem.getAttribute('data-expanded') === 'true';
    const collapsible = tocItem.querySelector('.toc-content-collapsible');
    const expandBtn = tocItem.querySelector('.toc-expand-text-btn');

    if (!collapsible) return;

    if (isExpanded) {
      tocItem.setAttribute('data-expanded', 'false');
      collapsible.classList.remove('toc-content-expanded');
      collapsible.setAttribute('aria-expanded', 'false');
      if (expandBtn) {
        expandBtn.querySelector('.toc-expand-text').textContent = this._t('toc.expand');
        expandBtn.querySelector('.toc-expand-icon').innerHTML = this.getIcon('chevronDown');
      }
    } else {
      tocItem.setAttribute('data-expanded', 'true');
      collapsible.classList.add('toc-content-expanded');
      collapsible.setAttribute('aria-expanded', 'true');
      if (expandBtn) {
        expandBtn.querySelector('.toc-expand-text').textContent = this._t('toc.collapse');
        expandBtn.querySelector('.toc-expand-icon').innerHTML = this.getIcon('chevronUp');
      }
    }
  }

  /**
   * 懒加载并渲染项目内某条对话的消息列表（与目录/历史对话详情格式一致）
   * @param {string} conversationId
   * @param {HTMLElement} containerElement - .project-conv-detail
   */
  async renderProjectConversationMessages(conversationId, containerElement, searchKeyword, options = {}) {
    if (!containerElement) return;
    const { preserveScroll = true } = options || {};
    const prevScrollEl = containerElement.querySelector('.conv-detail-toc-list');
    const prevScrollTop = preserveScroll && prevScrollEl ? prevScrollEl.scrollTop : 0;
    try {
      const convData = await window.storageManager.getConversation(conversationId);
      const messages = convData.messages || [];
      if (!messages.length) {
        containerElement.innerHTML = '<div class="empty-state">' + this._t('empty.noMessages') + '</div>';
        return;
      }
      this.projectsDetailMessages = messages;
      this.projectsDetailMessagesEl = containerElement;
      this.projectsDetailConvId = conversationId;
      this.projectsDetailConvData = convData;

      const favIds = new Set((convData.favoriteMessageIds || []));
      const filtered = messages
        .map((m, i) => ({ ...m, _index: i }))
        .filter((m) => {
          if (this.tocFilterRole && this.tocFilterRole !== 'all' && m.role !== this.tocFilterRole) return false;
          if (this.tocFilterFavorite && !favIds.has(`msg_${m._index}`)) return false;
          return true;
        });

      if (filtered.length === 0) {
        containerElement.innerHTML = '<div class="empty-state"><div class="empty-state-text">' + this._t('empty.noFilterMessages') + '</div></div>';
        return;
      }

      const kw = (searchKeyword || '').trim();
      const kwLower = kw.toLowerCase();

      // 优先用保存时与「当前对话」一致的 contentHtml，无则用正文解析
      const buildMessageHtml = (msg) => {
        const html = (msg.contentHtml != null && msg.contentHtml !== '') ? msg.contentHtml : this.formatHistoryContent(msg.content || '');
        return this.applyHighlightToTextContentOnly(html, kw);
      };

      const html = `<ul class="toc-list conv-detail-toc-list">` + filtered.map((m, idx) => {
        const index = m._index;
        const isUser = m.role === 'user';
        const roleLabel = isUser ? this._t('role.user') : this._t('role.assistant');
        const roleIcon = isUser ? this.getIcon('user') : this.getIcon('bot');
        const roleAttr = isUser ? 'user' : 'assistant';
        const content = m.content || '';
        const num = index + 1;
        const previewBreakpoint = this.findPreviewBreakpoint(content);
        const hasLongContent = content.length > previewBreakpoint;
        const fullContentHtml = buildMessageHtml(m);
        const msgId = `proj_msg_${index}`;
        const safeContent = this.escapeHtml(content);
        const favKey = `msg_${index}`;
        const isFav = favIds.has(favKey);
        const expanded = false;
        const expandClass = expanded ? ' toc-content-expanded' : '';
        const expandAria = expanded ? 'true' : 'false';
        const expandText = expanded ? this._t('toc.collapse') : this._t('toc.expand');
        const expandIcon = expanded ? this.getIcon('chevronUp') : this.getIcon('chevronDown');
        return `<li class="toc-item" data-role="${roleAttr}" data-message-id="${msgId}" data-expanded="${expanded}" data-proj-index="${index}">
            <div class="toc-item-main">
              <div class="toc-index" title="${this.escapeHtml(roleLabel)}">#${num}</div>
              <div class="toc-meta"><span class="toc-role-icon" aria-hidden="true">${roleIcon}</span>${this.escapeHtml(roleLabel)}</div>
              <div class="toc-content-wrapper">
                ${hasLongContent ? `
                  <div class="toc-content-collapsible${expandClass}" aria-expanded="${expandAria}">
                    <div class="toc-content-full">${fullContentHtml}</div>
                    <div class="toc-preview-fade" aria-hidden="true"></div>
                  </div>
                  <div class="toc-expand-btn-row">
                    <button type="button" class="toc-expand-text-btn" data-action="expand">
                      <span class="toc-expand-text">${this.escapeHtml(expandText)}</span>
                      <span class="toc-expand-icon toc-expand-icon-svg" aria-hidden="true">${expandIcon}</span>
                    </button>
                  </div>
                ` : `
                  <div class="toc-content-full toc-content-full-standalone">${fullContentHtml}</div>
                `}
              </div>
            </div>
            <div class="toc-item-actions">
              <button type="button" class="toc-action-btn" title="${this.escapeHtml(this._t('toc.copy'))}" data-action="copy" data-content="${safeContent}">${this.getIcon('copy')}</button>
              <button type="button" class="toc-action-btn toc-action-fav" title="${this.escapeHtml(this._t('toc.favorite'))}" data-action="favorite" data-fav="${isFav ? '1' : '0'}">${isFav ? this.getIcon('star') : this.getIcon('starOutline')}</button>
            </div>
          </li>`;
      }).join('') + `</ul>`;
      containerElement.innerHTML = html;
      containerElement.querySelectorAll('.toc-item').forEach((li) => {
        const projIndex = li.getAttribute('data-proj-index');
        li.querySelectorAll('.toc-action-btn, .toc-expand-text-btn').forEach((btn) => {
          btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const action = btn.getAttribute('data-action');
          if (action === 'expand') {
            this.toggleHistoryTocItemExpand(li);
          } else if (action === 'copy') {
              const content = btn.getAttribute('data-content') || '';
              this.copyTextToClipboard(content);
            } else if (action === 'favorite' && projIndex != null) {
              this.toggleProjectDetailFavorite(conversationId, parseInt(projIndex, 10)).then(() => {
                const detailSearchEl = this.shadowRoot.querySelector('.project-conv-detail-search-input');
                const kw2 = detailSearchEl ? detailSearchEl.value.trim() : kw;
                this.renderProjectConversationMessages(conversationId, containerElement, kw2 || undefined);
              });
            }
          });
        });
      });
      if (preserveScroll) {
        const nextScrollEl = containerElement.querySelector('.conv-detail-toc-list');
        if (nextScrollEl) {
          const maxTop = Math.max(0, nextScrollEl.scrollHeight - nextScrollEl.clientHeight);
          nextScrollEl.scrollTop = Math.min(prevScrollTop, maxTop);
        }
      }
      this.restoreMsgSearchOverlayForTab('projects');
    } catch (e) {
      containerElement.innerHTML = '<div class="empty-state">' + this._t('empty.loadFailed') + '</div>';
      this.log('renderProjectConversationMessages error:', e);
    }
  }

  /**
   * 绑定项目内对话详情层的五个筛选/操作按钮
   */
  bindProjectConvDetailFilters(detailView, conversationId, projSearchEl) {
    const filtersEl = detailView.querySelector('.project-conv-detail-filters');
    if (!filtersEl) return;

    filtersEl.querySelectorAll('.toc-filter-btn').forEach((btn) => {
      btn.classList.remove('active');
      const role = btn.getAttribute('data-filter-role');
      const isFav = btn.getAttribute('data-filter-favorite') === 'true';
      if (role && (this.tocFilterRole || 'all') === role) btn.classList.add('active');
      if (isFav && this.tocFilterFavorite) btn.classList.add('active');
    });

    filtersEl.querySelectorAll('.toc-filter-btn').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (btn.classList.contains('project-conv-add-to-project') || btn.classList.contains('toc-add-to-project-btn')) {
          this.showAddToProjectDialog(conversationId);
          return;
        }
        const role = btn.getAttribute('data-filter-role');
        const isFav = btn.getAttribute('data-filter-favorite') === 'true';
        if (role) {
          this.tocFilterRole = role;
          filtersEl.querySelectorAll('[data-filter-role]').forEach((b) => b.classList.toggle('active', b.getAttribute('data-filter-role') === role));
          filtersEl.querySelector('[data-filter-favorite="true"]')?.classList.remove('active');
        } else if (isFav) {
          this.tocFilterFavorite = !this.tocFilterFavorite;
          filtersEl.querySelector('[data-filter-favorite="true"]')?.classList.toggle('active', this.tocFilterFavorite);
        }
        const kw = projSearchEl ? projSearchEl.value.trim() : '';
        this.renderProjectConversationMessages(conversationId, this.projectsDetailMessagesEl, kw || undefined);
      });
    });
  }

  /**
   * 项目内对话详情：在当前对话内容中搜索，高亮 + 全部展开 / 清空即收起
   */
  handleProjectDetailSearch(keyword) {
    if (!this.projectsDetailMessagesEl || !this.projectsDetailMessages || !this.projectsDetailConvId) return;
    this.renderProjectConversationMessages(this.projectsDetailConvId, this.projectsDetailMessagesEl, keyword, { scrollToMatch: false });
  }

  /**
   * 复制文本到剪贴板
   */
  async copyTextToClipboard(text) {
    try {
      await navigator.clipboard.writeText(text);
      this.showToast(this._t('toast.copied'));
    } catch (e) {
      this.log('Copy failed:', e);
      this.showToast(this._t('toast.copyFailed'));
    }
  }

  async deleteConversation(conversationId) {
    const ok = await this.showConfirmDialog(this._t('confirm.deleteConv.title'), this._t('confirm.deleteConv.message'));
    if (!ok) return;

    try {
      // 从列表中删除
      let list = await window.storageManager.getConversationList();
      list = list.filter(item => item.id !== conversationId);
      await window.storageManager.saveConversationList(list);

      // 从自动项目及我创建的项目中移除
      await window.projectManager.removeFromAutoProject(conversationId);
      const myProjects = window.projectManager.getMyProjects();
      for (const [projectId, project] of Object.entries(myProjects)) {
        if ((project.conversations || []).includes(conversationId)) {
          await window.projectManager.removeFromMyProject(conversationId, projectId);
        }
      }

      // 删除对话数据
      await window.storageManager.deleteConversation(conversationId);

      // 重新渲染
      this.renderConversationsList();
      this.log('Deleted conversation:', conversationId);
    } catch (e) {
      this.log('Delete conversation error:', e);
    }
  }

  async editConversationTitle(conversationId, cardEl) {
    try {
      if (this.exportState && this.exportState.active) return;
      const conv = await window.storageManager.getConversation(conversationId);
      const currentTitle = conv.title || this._t('conv.defaultTitle');

      const newTitle = await new Promise((resolve) => {
        const overlay = this.createDialog(this._t('dialog.editConvTitle'), this._t('dialog.editConvTitlePlaceholder'), (value) => resolve(value), currentTitle, () => resolve(null));
        (this.container || this.shadowRoot).appendChild(overlay);
      });

      if (newTitle == null) return;

      const trimmed = (newTitle.trim() || this._t('conv.defaultTitle'));
      if (trimmed === (currentTitle || '').trim()) return;
      conv.title = trimmed;
      await window.storageManager.saveConversation(conversationId, conv);

      let list = await window.storageManager.getConversationList();
      const idx = list.findIndex((item) => item.id === conversationId);
      if (idx >= 0) {
        list[idx] = { ...list[idx], title: trimmed };
        await window.storageManager.saveConversationList(list);
      }

      if (cardEl) {
        const titleEl = cardEl.querySelector('.conv-card-title');
        if (titleEl) titleEl.textContent = trimmed.slice(0, 36);
      }
      if (this.viewingConversationId === conversationId) {
        const headerEl = this.shadowRoot.getElementById('conv-detail-header');
        const titleEl = headerEl?.querySelector('.conv-detail-title');
        if (titleEl) titleEl.textContent = trimmed;
      }
      const projectDetailView = this.shadowRoot.querySelector(`.project-conv-detail-view[data-conversation-id="${conversationId}"]`);
      if (projectDetailView) {
        const projectTitleEl = projectDetailView.querySelector('.project-conv-detail-title');
        if (projectTitleEl) projectTitleEl.textContent = trimmed;
      }
      this.renderConversationsList();
      this.renderProjects();
      this.showToast(this._t('toast.titleUpdated'));
    } catch (e) {
      this.log('Edit conversation title error:', e);
      this.showToast(this._t('toast.updateFailed'));
    }
  }

  highlightKeywordInText(text, keyword) {
    if (!text || !keyword) return this.escapeHtml(text);
    const k = keyword.trim();
    if (!k) return this.escapeHtml(text);
    const lowerText = text.toLowerCase();
    const lowerKeyword = k.toLowerCase();
    let result = '';
    let lastIndex = 0;
    let index = lowerText.indexOf(lowerKeyword);
    while (index !== -1) {
      result += this.escapeHtml(text.substring(lastIndex, index));
      result += `<mark class="search-keyword-highlight">${this.escapeHtml(text.substring(index, index + k.length))}</mark>`;
      lastIndex = index + k.length;
      index = lowerText.indexOf(lowerKeyword, lastIndex);
    }
    result += this.escapeHtml(text.substring(lastIndex));
    return result;
  }

  handleSearch(keyword) {
    const searchResults = this.shadowRoot.getElementById('search-results');
    const tocContent = this.shadowRoot.getElementById('toc-content');
    const kw = (keyword || '').trim();
    searchResults.style.display = 'none';
    tocContent.style.display = 'block';
    this.renderTOC(kw || undefined);
    this.log('TOC search:', kw ? 'highlight + expand all' : 'clear');
  }

  /**
   * 更新平台项目映射（按 platform:slug 存，重命名只更新显示名）
   * 多平台均参与：ChatGPT / Gemini 等；无 slug 时归入该平台的 Inbox
   */
  async updatePlatformProjectMapping() {
    if (!this.conversationId) return;
    const platform = window.platformAdapter ? window.platformAdapter.getPlatformName() : 'Unknown';
    const slug = window.platformAdapter && window.platformAdapter.getProjectSlug ? window.platformAdapter.getProjectSlug() : null;
    const name = window.platformAdapter && window.platformAdapter.getProjectName ? window.platformAdapter.getProjectName() : null;
    await window.projectManager.mapToAutoProject(this.conversationId, platform, slug, name);
    this.log(`${platform} project mapping updated:`, `${slug != null ? slug : 'Inbox'}${name ? ` (${name})` : ''}`);
  }

  // 兼容旧方法名
  async updateChatGPTProjectMapping() {
    return this.updatePlatformProjectMapping();
  }

  /**
   * 全局刷新插件：同步项目映射并按当前标签重绘内容，无需刷新页面
   */
  async refreshSidebar() {
    try {
      await this.updateChatGPTProjectMapping();
      if (this.currentTab === 'toc') {
        this.renderTOC();
      } else if (this.currentTab === 'conversations') {
        await this.renderConversationsList();
      } else if (this.currentTab === 'projects') {
        await this.renderProjects();
      }
      this.showToast(this._t('toast.refreshed'));
    } catch (e) {
      this.log('refreshSidebar error:', e);
      this.showToast(this._t('toast.refreshFailed'));
    }
  }

  /**
   * 若仍为同一对话，延迟后再执行一次项目映射并刷新项目列表（应对切到新项目对话时 DOM 尚未渲染完成）
   */
  async runUpdatePlatformProjectMappingIfSameConversation() {
    const currentId = window.platformAdapter ? window.platformAdapter.getCurrentConversationId() : null;
    if (this.conversationId !== currentId) return;
    await this.updatePlatformProjectMapping();
    if (this.currentTab === 'projects') await this.renderProjects();
  }

  // 兼容旧方法名
  async runUpdateChatGPTProjectMappingIfSameConversation() {
    return this.runUpdatePlatformProjectMappingIfSameConversation();
  }

  /**
   * 获取对话标题（用于项目内列表展示）
   * @param {string[]} [conversationIds] - 项目内出现的 conversationId 列表，缺失或无标题的会用 getConversation(id).title 兜底
   */
  async getConversationTitleMap(conversationIds) {
    const list = await window.storageManager.getConversationList();
    const map = {};
    const unnamed = this._t('conv.unnamed');
    (list || []).forEach((item) => {
      map[item.id] = item.title || unnamed;
    });
    const ids = conversationIds || [];
    const needFallback = [...new Set(ids)].filter((id) => !map[id] || map[id] === unnamed);
    for (const id of needFallback) {
      try {
        const conv = await window.storageManager.getConversation(id);
        map[id] = conv.title || unnamed;
      } catch (e) {
        map[id] = unnamed;
      }
    }
    return map;
  }

  /**
   * 渲染项目列表（可展开、对话列表、移除/移动）
   */
  async renderProjects() {
    // 在项目对话详情视图时，保存滚动位置，避免 storage 触发重渲染后自动跳回顶部
    const panel = this.shadowRoot?.querySelector('.tab-panel[data-panel="projects"]');
    if (panel && this.projectsViewState?.level === 'conversation') {
      this._savedProjectsPanelScrollTop = panel.scrollTop;
    } else {
      this._savedProjectsPanelScrollTop = null;
    }

    const myProjects = window.projectManager.getMyProjects();
    const allConvIds = [];
    Object.values(myProjects).forEach((p) => allConvIds.push(...(p.conversations || [])));
    const list = await window.storageManager.getConversationList() || [];
    const listById = {};
    list.forEach((item) => { listById[item.id] = item; });

    const { start: rangeStart, end: rangeEnd } = this.getFilterDateRange();
    const projKw = (this.projectsSearchKeyword || '').trim();
    const projKwLower = projKw.toLowerCase();

    const filterEntriesForProject = async (convIds) => {
      let entries = convIds.map((id) => listById[id]).filter(Boolean);
      if (rangeStart != null && rangeEnd != null) {
        entries = entries.filter((item) => {
          const t = item.lastSeenAt || 0;
          return t >= rangeStart && t <= rangeEnd;
        });
      }
      if (this.tocFilterPlatforms && this.tocFilterPlatforms.length > 0) {
        entries = entries.filter((item) => {
          const platform = item.platform || 'ChatGPT';
          return this.tocFilterPlatforms.includes(platform);
        });
      }
      if (projKwLower) {
        entries = entries.map((item) => ({
          ...item,
          _titleMatch: (item.title || '').toLowerCase().includes(projKwLower),
          _snippetMatch: (item.snippet || '').toLowerCase().includes(projKwLower),
          _contentMatchCount: 0
        }));
        if (entries.length > 0) {
          await Promise.all(entries.map(async (item) => {
            try {
              const conv = await window.storageManager.getConversation(item.id);
              const messages = conv.messages || [];
              let count = 0;
              messages.forEach((m) => {
                if ((m.content || '').toLowerCase().includes(projKwLower)) count++;
              });
              item._contentMatchCount = count;
            } catch (e) {
              this.log('projects content match error:', e);
              item._contentMatchCount = 0;
            }
          }));
        }
        entries = entries.filter((item) => item._titleMatch || item._snippetMatch || item._contentMatchCount > 0);
      }
      return entries.sort((a, b) => (b.lastSeenAt || 0) - (a.lastSeenAt || 0));
    };

    const renderProjectItem = (projectType, projectKey, projectName, entries) => {
      const noConvs = this._t('project.noConvs');
      const projectNameHtml = projKw ? this.highlightKeywordInText(projectName, projKw) : this.escapeHtml(projectName);
      const cardListHtml =
        entries.length === 0
          ? `<ul class="project-conv-list-view"><li class="project-conv-empty">${this.escapeHtml(noConvs)}</li></ul>`
          : `<ul class="project-conv-list-view">${entries
              .map(
                (item) => {
                  const titleText = (item.title || this._t('conv.defaultTitle')).slice(0, 36);
                  const snippetText = (item.snippet || '').slice(0, 100);
                  const titleHtml = projKw ? this.highlightKeywordInText(titleText, projKw) : this.escapeHtml(titleText);
                  const snippetHtml = projKw ? this.highlightKeywordInText(snippetText, projKw) : this.escapeHtml(snippetText);
                  const showContentMatch = projKw && item._contentMatchCount > 0;
                  const matchText = showContentMatch ? this._t('conv.contentMatches', { n: String(item._contentMatchCount) }) : '';
                  const platformName = item.platform || 'ChatGPT';
                  const platformTag = this.escapeHtml(platformName);
                  const platformIconUrl = this.getPlatformIconUrl(platformName);
                  return `
                <li class="conv-card" data-conversation-id="${this.escapeHtml(item.id)}" ${projectType === 'my' ? 'draggable="true"' : ''} title="${projectType === 'my' ? this.escapeHtml(this._t('conv.dragToProject')) : ''}">
                  <button type="button" class="export-select-dot" data-scope="projects" data-type="conversation" data-id="${this.escapeHtml(item.id)}" aria-label="${this._t('export.select')}"></button>
                  <div class="conv-card-header">
                    <div class="conv-card-title conv-card-title-editable" title="${this.escapeHtml(this._t('conv.editTitleHint'))}">${titleHtml}</div>
                    <div class="conv-card-actions">
                      <button type="button" class="conv-card-action" data-action="open" title="${this.escapeHtml(this._t('conv.openInNewTab'))}">${this.getIcon('external')}</button>
                      ${projectType === 'my' ? `<button type="button" class="conv-card-action" data-action="move" data-conv-id="${this.escapeHtml(item.id)}" title="${this.escapeHtml(this._t('action.move'))}">${this.getIcon('move')}</button>` : ''}
                      ${projectType === 'my' ? `<button type="button" class="conv-card-action conv-card-action--delete" data-action="remove-from-project" data-conv-id="${this.escapeHtml(item.id)}" title="${this.escapeHtml(this._t('conv.removeFromProject'))}">${this.getIcon('trash')}</button>` : ''}
                    </div>
                  </div>
                  <div class="conv-card-snippet">${snippetHtml}</div>
                  <div class="conv-card-meta">
                    <span class="conv-card-tag">
                      <img src="${this.escapeHtml(platformIconUrl)}" alt="" class="conv-card-tag-icon" />
                      <span class="conv-card-tag-text">${platformTag}</span>
                    </span>
                    ${showContentMatch ? `<span class="conv-card-match">${this.escapeHtml(matchText)}</span>` : ''}
                    <span class="conv-card-info">💬 ${item.messageCount || 0}</span>
                    <span class="conv-card-time">${this.formatTimeAgo(item.lastSeenAt)}</span>
                  </div>
                </li>`;
                }
              )
              .join('')}</ul>`;

      const detailViewHtml =
        entries.length === 0
          ? ''
          : `<div class="project-conv-detail-view" style="display:none;">
          <div class="conv-detail-toolbar project-conv-detail-toolbar">
            <button type="button" class="btn project-conv-back-icon project-conv-back" title="${this.escapeHtml(this._t('action.backToList'))}" aria-label="${this.escapeHtml(this._t('action.backToList'))}">${this.getIcon('back')}</button>
            <div class="toc-filters project-conv-detail-filters">
              <button type="button" class="toc-filter-btn active" data-filter-role="all">${this.escapeHtml(this._t('filter.all'))}</button>
              <button type="button" class="toc-filter-btn" data-filter-role="user">${this.escapeHtml(this._t('filter.user'))}</button>
              <button type="button" class="toc-filter-btn" data-filter-role="assistant">${this.escapeHtml(this._t('filter.ai'))}</button>
              <button type="button" class="toc-filter-btn" data-filter-favorite="true">${this.getIcon('star')} ${this.escapeHtml(this._t('filter.favorite'))}</button>
              <button type="button" class="toc-filter-btn toc-add-to-project-btn project-conv-add-to-project" title="${this.escapeHtml(this._t('filter.addToProject'))}">${this.getIcon('folderAdd')} ${this.escapeHtml(this._t('filter.addToProject'))}</button>
            </div>
          </div>
          <div class="search-box project-conv-detail-search-wrap">
            <input type="text" class="search-input project-conv-detail-search-input" placeholder="${this.escapeHtml(this._t('filter.search.currentConv'))}" aria-label="${this.escapeHtml(this._t('filter.search.currentConv'))}">
          </div>
          <div class="project-conv-detail-header">
            <div class="project-conv-detail-title-row">
              <div class="project-conv-detail-title project-conv-detail-title-editable" title="${this.escapeHtml(this._t('conv.editTitleHint'))}"></div>
            </div>
          </div>
          <div class="project-conv-detail-messages"></div>
        </div>`;

      const convListSection =
        entries.length === 0
          ? `<ul class="project-conversations"><li class="project-conv-empty">${this.escapeHtml(this._t('project.noConvs'))}</li></ul>`
          : `<div class="project-conversations">${cardListHtml}${detailViewHtml}</div>`;

      const editBtn = projectType === 'my' ? `<button type="button" class="project-header-action" data-action="edit-project" title="${this.escapeHtml(this._t('project.editTitle'))}">${this.getIcon('edit')}</button>` : '';
      const deleteBtn = `<button type="button" class="project-header-action" data-action="delete-project" title="${this.escapeHtml(projectType === 'my' ? this._t('project.deleteProject') : this._t('project.removeCategory'))}">${this.getIcon('trash')}</button>`;
      const expandedClass = projKwLower && (entries.length > 0 || projectName.toLowerCase().includes(projKwLower)) ? ' expanded' : '';
      return `
        <li class="project-item${expandedClass}" data-project-type="${projectType}" data-project-key="${this.escapeHtml(projectKey)}">
          <div class="project-item-header">
            <span class="project-expand-icon">▶</span>
            <button type="button" class="export-select-dot" data-scope="projects" data-type="project" data-project-type="${projectType}" data-project-key="${this.escapeHtml(projectKey)}" aria-label="${this._t('export.select')}"></button>
            <div class="project-name">
              <span>${projectNameHtml}</span>
              <span class="project-count">${entries.length}</span>
            </div>
            <div class="project-item-header-actions">${editBtn}${deleteBtn}</div>
          </div>
          ${convListSection}
        </li>`;
    };

    // 我创建的项目（项目页仅保留此项）
    const myList = this.shadowRoot.getElementById('my-projects-list');
    if (Object.keys(myProjects).length === 0) {
      myList.innerHTML = '<div class="empty-state"><div class="empty-state-text">' + this._t('empty.noMyProjects').replace(/\n/g, '<br>') + '</div></div>';
    } else {
      const myItems = [];
      for (const [id, project] of Object.entries(myProjects)) {
        const name = project.name || id;
        const filteredEntries = await filterEntriesForProject(project.conversations || []);
        if (projKwLower && filteredEntries.length === 0 && !name.toLowerCase().includes(projKwLower)) continue;
        myItems.push(renderProjectItem('my', id, name, filteredEntries));
      }
      myList.innerHTML = myItems.length ? myItems.join('') : '<div class="empty-state"><div class="empty-state-text">' + this._t('empty.noFilterProjects') + '</div></div>';
    }

    this.bindProjectItemEvents(myList);
    this.applyProjectsExpandedState(myList);
    this.applyProjectSectionCollapsed();
    if (this.exportState.active && this.exportState.scope === 'projects') {
      this.syncExportSelectionUI();
    }
  }

  applyProjectSectionCollapsed() {
    const mySection = this.shadowRoot.querySelector('.project-section .project-section-header[data-section="my"]')?.closest('.project-section');
    if (mySection) mySection.classList.toggle('project-section-collapsed', !!this.projectSectionCollapsed.my);
  }

  /**
   * 绑定项目项展开与对话操作（打开、移动）
   */
  bindProjectItemEvents(container) {
    if (!container) return;
    container.querySelectorAll('.project-item').forEach((item) => {
      const header = item.querySelector('.project-item-header');
      const type = item.getAttribute('data-project-type');
      const key = item.getAttribute('data-project-key');

      header.addEventListener('click', (e) => {
        if (e.target.closest('.project-item-header-actions')) return;
        if (this.exportState.active && this.exportState.scope === 'projects') {
          if (e.target.closest('.export-select-dot')) return;
          item.classList.toggle('expanded');
          this.updateProjectsExpandedState(type, key, item.classList.contains('expanded'));
          return;
        }
        item.classList.toggle('expanded');
        this.updateProjectsExpandedState(type, key, item.classList.contains('expanded'));
      });

      const displayName = type === 'my' ? (window.projectManager.getMyProjects()[key]?.name || key) : key;

      item.querySelectorAll('.project-header-action[data-action="edit-project"]').forEach((btn) => {
        btn.addEventListener('click', async (e) => {
          e.stopPropagation();
          if (type !== 'my') return;
          const newName = await new Promise((resolve) => {
            const overlay = this.createDialog(this._t('dialog.editProjectName'), this._t('dialog.editProjectNamePlaceholder'), (value) => resolve(value), displayName, () => resolve(null));
            (this.container || this.shadowRoot).appendChild(overlay);
          });
          if (newName == null || !newName.trim()) return;
          await window.projectManager.renameMyProject(key, newName.trim());
          this.renderProjects();
        });
      });

      item.querySelectorAll('.project-header-action[data-action="delete-project"]').forEach((btn) => {
        btn.addEventListener('click', async (e) => {
          e.stopPropagation();
          const msg = type === 'my' ? this._t('confirm.deleteProject.messageMy', { name: displayName }) : this._t('confirm.removeCategory.message', { name: displayName });
          const ok = await this.showConfirmDialog(this._t('confirm.title'), msg);
          if (!ok) return;
          if (type === 'my') {
            await window.projectManager.deleteMyProject(key);
          } else {
            await window.projectManager.deleteChatGPTProjectCategory(key);
          }
          this.renderProjects();
        });
      });

      const listView = item.querySelector('.project-conv-list-view');
      const detailView = item.querySelector('.project-conv-detail-view');
      if (listView && detailView) {
        item.querySelectorAll('.conv-card').forEach((card) => {
          card.addEventListener('click', async (e) => {
            if (this.exportState.active && this.exportState.scope === 'projects') {
              if (e.target.closest('.export-select-dot')) return;
              const dot = card.querySelector('.export-select-dot');
              if (dot) this.toggleExportSelectionFromDot(dot);
              return;
            }
            if (e.target.closest('.export-select-dot')) return;
            if (e.target.closest('.conv-card-actions')) return;
            if (e.target.closest('.conv-card-title')) return;
            const convId = card.getAttribute('data-conversation-id');
            if (!convId) return;
            const titleEl = detailView.querySelector('.project-conv-detail-title');
            const messagesEl = detailView.querySelector('.project-conv-detail-messages');
            const cardTitle = card.querySelector('.conv-card-title');
            const conversationTitle = (cardTitle && cardTitle.textContent) ? cardTitle.textContent.trim() : this._t('conv.defaultTitle');
            if (titleEl) titleEl.textContent = conversationTitle;
            if (messagesEl) messagesEl.innerHTML = '';
            listView.style.display = 'none';
            detailView.style.display = 'block';
            detailView.setAttribute('data-conversation-id', convId);
            item.classList.add('project-item--showing-detail');

            const listSearchWrapEl = this.shadowRoot.getElementById('projects-search-and-filter-wrap');
            const projSearchEl = this.shadowRoot.getElementById('projects-search-input');
            const detailSearchEl = detailView.querySelector('.project-conv-detail-search-input');
            const btnProjFilterEl = this.shadowRoot.getElementById('btn-projects-filter');
            const projFilterPanelEl = this.shadowRoot.getElementById('projects-filter-panel');
            if (listSearchWrapEl) listSearchWrapEl.style.display = 'none';
            if (btnProjFilterEl) btnProjFilterEl.style.display = 'none';
            if (projFilterPanelEl) projFilterPanelEl.style.display = 'none';
            if (detailSearchEl) {
              detailSearchEl.placeholder = this._t('filter.search.currentConv');
              if (projSearchEl && projSearchEl.value.trim()) detailSearchEl.value = projSearchEl.value.trim();
              detailSearchEl.oninput = () => this.handleProjectDetailSearch(detailSearchEl.value.trim());
            }
            const initialKw = detailSearchEl ? detailSearchEl.value.trim() : '';
            this.projectsViewState = { level: 'conversation', projectType: type, projectKey: key, conversationId: convId, conversationTitle, searchKeyword: initialKw || '' };
            await this.renderProjectConversationMessages(convId, messagesEl, initialKw || undefined);

            this.bindProjectConvDetailFilters(detailView, convId, detailSearchEl);

            if (titleEl) {
              titleEl.addEventListener('dblclick', (e) => {
                e.stopPropagation();
                this.editConversationTitle(convId, card);
              });
            }
          });
        });
        detailView.querySelectorAll('.project-conv-back').forEach((btn) => {
          btn.addEventListener('click', (e) => {
            e.preventDefault();
            detailView.style.display = 'none';
            detailView.removeAttribute('data-conversation-id');
            listView.style.display = 'block';
            item.classList.remove('project-item--showing-detail');

            const anyOtherShowingDetail = container.querySelectorAll('.project-item--showing-detail').length > 0;
            if (!anyOtherShowingDetail) {
              this.projectsDetailMessages = null;
              this.projectsDetailMessagesEl = null;
              this.projectsDetailConvId = null;
              this.projectsViewState = { level: 'list', projectType: null, projectKey: null, conversationId: null, conversationTitle: null, searchKeyword: '' };
              const listSearchWrapEl = this.shadowRoot.getElementById('projects-search-and-filter-wrap');
              const projSearchEl = this.shadowRoot.getElementById('projects-search-input');
              const btnProjFilterEl = this.shadowRoot.getElementById('btn-projects-filter');
              if (listSearchWrapEl) listSearchWrapEl.style.display = '';
              if (projSearchEl) {
                projSearchEl.placeholder = this._t('filter.search.projects');
                this.projectsSearchKeyword = projSearchEl.value.trim();
              }
              if (btnProjFilterEl) btnProjFilterEl.style.display = '';
            }
            const detailSearchEl = detailView.querySelector('.project-conv-detail-search-input');
            if (detailSearchEl) detailSearchEl.oninput = null;
          });
        });
      }

      item.querySelectorAll('.conv-card .conv-card-title').forEach((titleEl) => {
        const card = titleEl.closest('.conv-card');
        const convId = card?.getAttribute('data-conversation-id');
        if (convId) {
          titleEl.addEventListener('dblclick', (e) => {
            e.stopPropagation();
            this.editConversationTitle(convId, card);
          });
        }
      });

      item.querySelectorAll('.conv-card-action[data-action="open"], .project-conv-action[data-action="open"]').forEach((el) => {
        el.addEventListener('click', (e) => {
          e.stopPropagation();
          if (this.exportState.active && this.exportState.scope === 'projects') {
            const card = el.closest('.conv-card');
            const dot = card?.querySelector('.export-select-dot');
            if (dot) this.toggleExportSelectionFromDot(dot);
            return;
          }
          const convId = el.getAttribute('data-conv-id') || el.closest('.conv-card')?.getAttribute('data-conversation-id') || el.closest('.project-conversation-item')?.getAttribute('data-conversation-id');
          if (convId) this.openConversationInNewTab(convId);
        });
      });

      item.querySelectorAll('.conv-card-action[data-action="move"], .project-conv-action[data-action="move"]').forEach((btn) => {
        btn.addEventListener('click', async (e) => {
          e.stopPropagation();
          if (this.exportState.active && this.exportState.scope === 'projects') {
            const card = btn.closest('.conv-card');
            const dot = card?.querySelector('.export-select-dot');
            if (dot) this.toggleExportSelectionFromDot(dot);
            return;
          }
          const convId = btn.getAttribute('data-conv-id');
          if (!convId || type !== 'my') return;
          const myProjects = window.projectManager.getMyProjects();
          const others = Object.entries(myProjects).filter(([id]) => id !== key);
          const overlay = document.createElement('div');
          overlay.className = 'dialog-overlay';
          const dialog = document.createElement('div');
          dialog.className = 'dialog';
          const hasOtherProjects = others.length > 0;
          dialog.innerHTML = `
            <h3 class="dialog-title">移动到项目</h3>
            <select class="dialog-input" id="move-project-select" ${!hasOtherProjects ? 'disabled' : ''}>
              ${hasOtherProjects ? others.map(([id, p]) => `<option value="${id}">${this.escapeHtml(p.name)}</option>`).join('') : `<option value="">暂无其他项目</option>`}
            </select>
            <div class="dialog-buttons">
              <button class="btn btn-secondary" id="move-cancel">取消</button>
              <button class="btn btn-primary" id="move-confirm" ${!hasOtherProjects ? 'disabled' : ''}>确定</button>
            </div>`;
          overlay.appendChild(dialog);
          (this.container || this.shadowRoot).appendChild(overlay);
          dialog.querySelector('#move-cancel').addEventListener('click', () => overlay.remove());
          dialog.querySelector('#move-confirm').addEventListener('click', async () => {
            const targetId = dialog.querySelector('#move-project-select').value;
            if (!targetId) return;
            await window.projectManager.removeFromMyProject(convId, key);
            await window.projectManager.addToMyProject(convId, targetId);
            overlay.remove();
            this.renderProjects();
          });
        });
      });

      // 删除/移出项目按钮
      item.querySelectorAll('.conv-card-action[data-action="remove-from-project"]').forEach((btn) => {
        btn.addEventListener('click', async (e) => {
          e.stopPropagation();
          if (this.exportState.active && this.exportState.scope === 'projects') {
            const card = btn.closest('.conv-card');
            const dot = card?.querySelector('.export-select-dot');
            if (dot) this.toggleExportSelectionFromDot(dot);
            return;
          }
          const convId = btn.getAttribute('data-conv-id');
          if (!convId || type !== 'my') return;
          const ok = await this.showConfirmDialog(this._t('confirm.title'), this._t('dialog.confirmRemoveFromProject'));
          if (!ok) return;
          await window.projectManager.removeFromMyProject(convId, key);
          this.renderProjects();
        });
      });

      if (type === 'my') {
        item.querySelectorAll('.conv-card').forEach((card) => {
          card.addEventListener('dragstart', (e) => {
            const convId = card.getAttribute('data-conversation-id');
            if (!convId) return;
            e.dataTransfer.setData('application/json', JSON.stringify({ conversationId: convId, sourceProjectKey: key }));
            e.dataTransfer.effectAllowed = 'move';
            card.classList.add('conv-card-dragging');
          });
          card.addEventListener('dragend', () => {
            card.classList.remove('conv-card-dragging');
            container.querySelectorAll('.project-item').forEach((el) => el.classList.remove('project-item-drag-over'));
          });
        });
        item.addEventListener('dragover', (e) => {
          e.preventDefault();
          e.dataTransfer.dropEffect = 'move';
          item.classList.add('project-item-drag-over');
        });
        item.addEventListener('dragleave', (e) => {
          if (!item.contains(e.relatedTarget)) item.classList.remove('project-item-drag-over');
        });
        item.addEventListener('drop', async (e) => {
          e.preventDefault();
          item.classList.remove('project-item-drag-over');
          try {
            const raw = e.dataTransfer.getData('application/json');
            if (!raw) return;
            const { conversationId: convId, sourceProjectKey: sourceKey } = JSON.parse(raw);
            if (!convId || sourceKey === key) return;
            const myList = this.shadowRoot.getElementById('my-projects-list');
            const expandedKeys = new Set();
            [myList].forEach((c) => {
              if (!c) return;
              c.querySelectorAll('.project-item.expanded').forEach((el) => {
                expandedKeys.add(JSON.stringify([el.getAttribute('data-project-type'), el.getAttribute('data-project-key')]));
              });
            });
            await window.projectManager.removeFromMyProject(convId, sourceKey);
            await window.projectManager.addToMyProject(convId, key);
            await this.renderProjects();
            [myList].forEach((c) => {
              if (!c) return;
              c.querySelectorAll('.project-item').forEach((el) => {
                const k = JSON.stringify([el.getAttribute('data-project-type'), el.getAttribute('data-project-key')]);
                if (expandedKeys.has(k)) el.classList.add('expanded');
              });
            });
            this.showToast(this._t('toast.movedToProject'));
          } catch (err) {
            this.log('Drop move error:', err);
          }
        });
      }
    });
  }

  applyProjectsExpandedState(container) {
    if (!container || !this.projectsExpandedItems || this.projectsExpandedItems.size === 0) return;
    container.querySelectorAll('.project-item').forEach((item) => {
      const type = item.getAttribute('data-project-type');
      const key = item.getAttribute('data-project-key');
      const id = this.getProjectsExpandedKey(type, key);
      if (id && this.projectsExpandedItems.has(id)) {
        item.classList.add('expanded');
      }
    });
  }

  updateProjectsExpandedState(type, key, expanded) {
    const id = this.getProjectsExpandedKey(type, key);
    if (!id) return;
    if (expanded) this.projectsExpandedItems.add(id);
    else this.projectsExpandedItems.delete(id);
  }

  getProjectsExpandedKey(type, key) {
    if (!type || !key) return null;
    return `${type}:${key}`;
  }

  /**
   * 显示创建项目对话框
   */
  showCreateProjectDialog() {
    const dialog = this.createDialog(this._t('project.create'), this._t('dialog.createProjectAndAddPlaceholder'), async (value) => {
      if (value && value.trim()) {
        await window.projectManager.createMyProject(value.trim());
        this.renderProjects();
        this.log('Project created:', value);
      }
    });
    (this.container || this.shadowRoot).appendChild(dialog);
  }

  /**
   * 显示添加到项目对话框
   * @param {string} [conversationId] - 可选，不传则使用当前会话
   */
  showAddToProjectDialog(conversationId) {
    const convId = conversationId || this.conversationId;
    if (!convId) {
      this.showToast(this._t('toast.cannotGetSessionId'));
      return;
    }

    const myProjects = window.projectManager.getMyProjects();
    const projectEntries = Object.entries(myProjects);

    const overlay = document.createElement('div');
    overlay.className = 'dialog-overlay';

    const dialog = document.createElement('div');
    dialog.className = 'dialog';

    if (projectEntries.length === 0) {
      dialog.innerHTML = `
        <h3 class="dialog-title">${this.escapeHtml(this._t('dialog.addToProject'))}</h3>
        <p class="dialog-hint">${this.escapeHtml(this._t('dialog.noProjectsHint'))}</p>
        <input type="text" class="dialog-input" id="project-name-input" placeholder="${this.escapeHtml(this._t('dialog.enterProjectName'))}">
        <div class="dialog-buttons">
          <button class="btn btn-secondary" id="dialog-cancel">${this.escapeHtml(this._t('dialog.cancel'))}</button>
          <button class="btn btn-primary" id="dialog-confirm">${this.escapeHtml(this._t('dialog.createAndAdd'))}</button>
        </div>
      `;
    } else {
      dialog.innerHTML = `
        <h3 class="dialog-title">${this.escapeHtml(this._t('dialog.addToProject'))}</h3>
        <select class="dialog-input" id="project-select">
          ${projectEntries.map(([id, project]) => `
            <option value="${id}">${this.escapeHtml(project.name)}</option>
          `).join('')}
        </select>
        <div class="dialog-buttons dialog-buttons-multi">
          <button class="btn btn-secondary" id="dialog-cancel">${this.escapeHtml(this._t('dialog.cancel'))}</button>
          <button class="btn btn-secondary" id="dialog-new-project">+ ${this.escapeHtml(this._t('dialog.createAndAdd'))}</button>
          <button class="btn btn-primary" id="dialog-confirm">${this.escapeHtml(this._t('dialog.confirm'))}</button>
        </div>
      `;
    }

    overlay.appendChild(dialog);
    (this.container || this.shadowRoot).appendChild(overlay);

    const close = () => { overlay.remove(); };

    dialog.querySelector('#dialog-cancel').addEventListener('click', close);

    if (projectEntries.length === 0) {
      dialog.querySelector('#dialog-confirm').addEventListener('click', async () => {
        const input = dialog.querySelector('#project-name-input');
        const name = (input && input.value && input.value.trim()) || '';
        if (!name) {
          this.showToast(this._t('toast.enterProjectName'));
          return;
        }
        const projectId = await window.projectManager.createMyProject(name);
        await window.projectManager.addToMyProject(convId, projectId);
        close();
        this.renderProjects();
        this.log('Created project and added:', projectId);
      });
    } else {
      dialog.querySelector('#dialog-confirm').addEventListener('click', async () => {
        const projectId = dialog.querySelector('#project-select').value;
        await window.projectManager.addToMyProject(convId, projectId);
        close();
        this.renderProjects();
        this.log('Added to project:', projectId);
      });

      dialog.querySelector('#dialog-new-project').addEventListener('click', () => {
        overlay.remove();
        const subDialog = this.createDialog(this._t('dialog.createProjectAndAdd'), this._t('dialog.createProjectAndAddPlaceholder'), async (value) => {
          const name = value && value.trim();
          if (name) {
            const projectId = await window.projectManager.createMyProject(name);
            await window.projectManager.addToMyProject(convId, projectId);
            this.renderProjects();
            this.log('Created project and added:', projectId);
          }
        });
        (this.container || this.shadowRoot).appendChild(subDialog);
      });
    }
  }

  /**
   * 清空所有数据
   */
  async clearAllData() {
    const ok = await this.showConfirmDialog(this._t('confirm.clearData.title'), this._t('confirm.clearData.message'));
    if (ok) {
      await window.storageManager.clear();
      this.showToast(this._t('toast.dataCleared'));
      location.reload();
    }
  }

  /**
   * 创建输入对话框（在插件内弹出）
   * @param {string} title - 标题
   * @param {string} placeholder - 输入框占位
   * @param {function} onConfirm - 确认回调 (value) => void
   * @param {string} [defaultValue] - 输入框默认值
   * @param {function} [onCancel] - 取消回调
   */
  createDialog(title, placeholder, onConfirm, defaultValue = '', onCancel) {
    const overlay = document.createElement('div');
    overlay.className = 'dialog-overlay';

    const dialog = document.createElement('div');
    dialog.className = 'dialog';

    dialog.innerHTML = `
      <h3 class="dialog-title">${this.escapeHtml(title)}</h3>
      <input type="text" class="dialog-input" placeholder="${this.escapeHtml(placeholder)}" id="dialog-input">
      <div class="dialog-buttons">
        <button class="btn btn-secondary" id="dialog-cancel">取消</button>
        <button class="btn btn-primary" id="dialog-confirm">确定</button>
      </div>
    `;

    overlay.appendChild(dialog);

    const inputEl = dialog.querySelector('#dialog-input');
    if (defaultValue) inputEl.value = defaultValue;
    inputEl.focus();
    inputEl.select();

    // 事件绑定
    dialog.querySelector('#dialog-cancel').addEventListener('click', () => {
      if (onCancel) onCancel();
      overlay.remove();
    });

    const doConfirm = () => {
      const value = inputEl.value;
      overlay.remove();
      onConfirm(value);
    };

    dialog.querySelector('#dialog-confirm').addEventListener('click', doConfirm);

    inputEl.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') doConfirm();
    });

    return overlay;
  }

  /**
   * 创建确认对话框（在插件内弹出）
   * @param {string} title - 标题
   * @param {string} message - 提示内容
   * @returns {Promise<boolean>} - 确认返回 true，取消返回 false
   */
  showConfirmDialog(title, message) {
    return new Promise((resolve) => {
      const overlay = document.createElement('div');
      overlay.className = 'dialog-overlay';

      const dialog = document.createElement('div');
      dialog.className = 'dialog';

      dialog.innerHTML = `
        <h3 class="dialog-title">${this.escapeHtml(title)}</h3>
        <p class="dialog-message">${this.escapeHtml(message)}</p>
        <div class="dialog-buttons">
          <button class="btn btn-secondary" id="dialog-cancel">取消</button>
          <button class="btn btn-primary" id="dialog-confirm">确定</button>
        </div>
      `;

      overlay.appendChild(dialog);
      (this.container || this.shadowRoot).appendChild(overlay);

      dialog.querySelector('#dialog-cancel').addEventListener('click', () => {
        overlay.remove();
        resolve(false);
      });

      dialog.querySelector('#dialog-confirm').addEventListener('click', () => {
        overlay.remove();
        resolve(true);
      });
    });
  }

  /**
   * 计算「标题导引」加粗长度：取第一句或前若干字
   */
  findLeadLength(content) {
    if (!content || content.length === 0) return 0;
    const maxLead = 42;
    const minLead = 12;
    const sentenceEnd = /[。！？\n]/;
    let i = 0;
    while (i < content.length && i < maxLead) {
      const idx = content.slice(i).search(sentenceEnd);
      if (idx === -1) {
        i = Math.min(content.length, maxLead);
        break;
      }
      i += idx + 1;
      if (i >= minLead) break;
    }
    if (i < minLead && content.length > minLead) i = Math.min(maxLead, content.length);
    return Math.max(0, Math.min(i, content.length));
  }

  /**
   * 在已有 HTML 中把前 leadLen 个字符包成 <strong class="toc-content-lead">，保持原始格式
   */
  wrapLeadBoldInHtml(html, leadLen) {
    if (!html || leadLen <= 0) return html;
    const div = document.createElement('div');
    div.innerHTML = html;
    let count = 0;
    const walker = document.createTreeWalker(div, NodeFilter.SHOW_TEXT, null, false);
    const nodesToWrap = [];
    let splitAt = -1;
    while (walker.nextNode()) {
      const node = walker.currentNode;
      const len = node.textContent.length;
      if (count >= leadLen) break;
      if (count + len <= leadLen) {
        nodesToWrap.push({ node, full: true });
        count += len;
      } else {
        nodesToWrap.push({ node, full: false, splitAt: leadLen - count });
        count = leadLen;
        break;
      }
    }
    for (const { node, full, splitAt: at } of nodesToWrap) {
      const parent = node.parentNode;
      if (!parent) continue;
      const strong = document.createElement('strong');
      strong.className = 'toc-content-lead';
      if (full) {
        parent.insertBefore(strong, node);
        strong.appendChild(node);
      } else {
        const after = node.splitText(at);
        parent.insertBefore(strong, node);
        strong.appendChild(node);
      }
    }
    return div.innerHTML;
  }

  /**
   * 优先用页面消息 HTML（保留段落/列表等），否则用纯文本按段落格式化；并加开头加粗
   */
  getFullContentHtml(messageId, content) {
    const element = this.resolveMessageElement(messageId);
    const leadLen = this.findLeadLength(content || '');
    if (element) {
      const html = this.extractMessageHTMLForDisplay(element);
      if (html && html.trim()) return this.wrapLeadBoldInHtml(html, leadLen);
    }
    return this.formatContentWithLeadBold(content);
  }

  /**
   * 纯文本格式化为带段落和开头加粗的 HTML（与原始双换行分段一致）
   */
  formatContentWithLeadBold(content) {
    if (!content || !content.trim()) return '<p class="toc-expanded-p toc-content-lead-wrap">无内容</p>';
    const leadLen = this.findLeadLength(content);
    const paragraphs = content.split(/\n\n+/).map((p) => p.trim()).filter(Boolean);
    if (paragraphs.length === 0) return '<p class="toc-expanded-p toc-content-lead-wrap">无内容</p>';
    const out = [];
    for (let i = 0; i < paragraphs.length; i++) {
      const p = paragraphs[i];
      const escaped = this.escapeHtml(p).replace(/\n/g, '<br>');
      if (i === 0 && leadLen > 0) {
        if (leadLen >= p.length) {
          out.push(`<p class="toc-expanded-p toc-content-lead-wrap"><strong class="toc-content-lead">${escaped}</strong></p>`);
        } else {
          const lead = this.escapeHtml(p.slice(0, leadLen));
          const rest = this.escapeHtml(p.slice(leadLen)).replace(/\n/g, '<br>');
          out.push(`<p class="toc-expanded-p toc-content-lead-wrap"><strong class="toc-content-lead">${lead}</strong>${rest}</p>`);
        }
      } else {
        out.push(`<p class="toc-expanded-p">${escaped}</p>`);
      }
    }
    return out.join('');
  }

  /**
   * 显示轻提示
   */
  showToast(message, duration = 2000) {
    const existing = this.shadowRoot.querySelector('.sidebar-toast');
    if (existing) existing.remove();

    const toast = document.createElement('div');
    toast.className = 'sidebar-toast';
    toast.textContent = message;
    this.shadowRoot.querySelector('.sidebar-container').appendChild(toast);

    setTimeout(() => {
      toast.classList.add('sidebar-toast-hide');
      setTimeout(() => toast.remove(), 300);
    }, duration);
  }

  /**
   * 仅在 HTML 的文本内容中高亮关键词，不替换标签/属性内的字符，避免破坏 DOM（如搜索 "s" 时误改 <strong>、class="items"）
   */
  applyHighlightToTextContentOnly(html, keyword) {
    if (!keyword || !html) return html;
    const escapedKw = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    let regex;
    try {
      regex = new RegExp(escapedKw, 'gi');
    } catch (e) {
      return html;
    }
    const parts = html.split(/(<[^>]+>)/g);
    return parts
      .map((part) => {
        if (/^<[^>]+>$/.test(part)) return part;
        return part.replace(regex, (m) => `<mark class="search-keyword-highlight">${m}</mark>`);
      })
      .join('');
  }

  /**
   * HTML 转义
   */
  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  getSystemLanguageCode() {
    const langs = (navigator.languages && navigator.languages.length) ? navigator.languages : [navigator.language || ''];
    const primary = (langs[0] || '').toLowerCase();
    return primary.startsWith('zh') ? 'zh' : 'en';
  }
}

// 全局单例
window.sidebarUI = new SidebarUI();
