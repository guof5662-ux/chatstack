/**
 * 侧边栏 UI 管理器 - 使用 Shadow DOM 注入侧边栏
 */

class SidebarUI {
  constructor() {
    this.DEBUG = false;
    this.shadowHost = null;
    this.shadowRoot = null;
    this.container = null;
    this.currentTab = 'toc';
    this.userClosed = false;
    // this.viewingConversationId managed by conversationsModule
    this.currentMsgSearchMessageId = null;
    this.currentMsgSearchElement = null;
    this.msgSearchFloatRoot = null;
    this.floatButton = null;
    this.floatButtonVisual = null; // 新增：悬浮按钮视觉层
    this.sidebarWidth = 280;
    this._resizeStartX = 0;
    this._resizeStartWidth = 0;
    this.currentTocView = 'toc'; // 'toc' | 'conversations'
    this.tocFilterDateRange = null; // 'today' | 'last3Days' | 'last7Days' | 'custom'
    this.tocFilterStartDate = null;
    this.tocFilterEndDate = null;
    this.tocFilterPlatforms = []; // ['ChatGPT','Claude','Gemini'] 空表示不过滤
    this.tocFilterPanelOpen = false;
    // this.conversationsSearchKeyword managed by conversationsModule
    // this.projectsSearchKeyword managed by projectsModule
    // this.conversationsFilterPanelOpen managed by conversationsModule
    // this.projectsFilterPanelOpen managed by projectsModule
    // 项目标签内视图状态：切到其他标签再切回时恢复（list | conversation）
    // this.projectsViewState managed by projectsModule
    // this.projectSectionCollapsed managed by projectsModule
    // 项目页：记录已展开的项目，避免重渲染后自动收回
    // this.projectsExpandedItems managed by projectsModule

    // 历史页：记录已展开的项目，避免重渲染后自动收回
    this.historyExpandedProjects = new Set();
    // 历史页：记录已收起的分区（如 ChatGPT 的"项目/你的聊天"）
    this.historySectionCollapsed = new Set();

    this.lastNonSettingsTab = 'toc';
    this.msgSearchPersist = null;
    // 导出模式状态
    this.exportState = { active: false, scope: null, selected: new Set(), formats: { json: false, md: false, txt: false } };
    this.exportMod = typeof globalThis.SidebarExport !== 'undefined' ? new globalThis.SidebarExport(this) : null;
    this.tocMod = typeof globalThis.SidebarTOC !== 'undefined' ? new globalThis.SidebarTOC(this) : null;
    this.filterMod = typeof globalThis.SidebarFilters !== 'undefined' ? new globalThis.SidebarFilters(this) : null;

    // 初始化新模块（保持向后兼容，如果模块不存在则不会报错）
    this.initModules();
  }

  /**
   * 初始化新的模块化架构
   */
  initModules() {
    // 主题模块
    this.themeModule = typeof window.SidebarTheme !== 'undefined'
      ? new window.SidebarTheme(this)
      : null;

    // 调整大小模块
    this.resizerModule = typeof window.SidebarResizer !== 'undefined'
      ? new window.SidebarResizer(this)
      : null;

    // 视图模块
    this.viewModule = typeof window.SidebarView !== 'undefined'
      ? new window.SidebarView(this)
      : null;

    // 事件处理模块
    this.eventModule = typeof window.SidebarEventHandler !== 'undefined'
      ? new window.SidebarEventHandler(this)
      : null;

    // 对话列表模块
    this.conversationsModule = typeof window.SidebarConversations !== 'undefined'
      ? new window.SidebarConversations(this)
      : null;

    // 项目模块
    this.projectsModule = typeof window.SidebarProjects !== 'undefined'
      ? new window.SidebarProjects(this)
      : null;

    // 导出模块（兼容旧名称）
    this.exportModule = this.exportMod;
    this.tocModule = this.tocMod;
    this.filterModule = this.filterMod;

    // 数据模块
    this.dataModule = typeof window.SidebarData !== 'undefined'
      ? new window.SidebarData(this)
      : null;
  }

  log(...args) {
    if (this.DEBUG) {
      console.log('[SidebarUI]', ...args);
    }
  }

  // State proxies for SidebarConversations module
  get conversationsSearchKeyword() { return this.conversationsModule?.conversationsSearchKeyword || ''; }
  set conversationsSearchKeyword(val) { if (this.conversationsModule) this.conversationsModule.conversationsSearchKeyword = val; }

  get viewingConversationId() { return this.conversationsModule?.viewingConversationId || null; }
  set viewingConversationId(val) { if (this.conversationsModule) this.conversationsModule.viewingConversationId = val; }

  get historyDetailMessages() { return this.conversationsModule?.historyDetailMessages || null; }
  set historyDetailMessages(val) { if (this.conversationsModule) this.conversationsModule.historyDetailMessages = val; }

  get historyDetailConvId() { return this.conversationsModule?.historyDetailConvId || null; }
  set historyDetailConvId(val) { if (this.conversationsModule) this.conversationsModule.historyDetailConvId = val; }

  get conversationsFilterPanelOpen() { return this.conversationsModule?.conversationsFilterPanelOpen || false; }
  set conversationsFilterPanelOpen(val) { if (this.conversationsModule) this.conversationsModule.conversationsFilterPanelOpen = val; }

  // State proxies for SidebarProjects module
  get projectsSearchKeyword() { return this.projectsModule?.projectsSearchKeyword || ''; }
  set projectsSearchKeyword(val) { if (this.projectsModule) this.projectsModule.projectsSearchKeyword = val; }

  get projectsFilterPanelOpen() { return this.projectsModule?.projectsFilterPanelOpen || false; }
  set projectsFilterPanelOpen(val) { if (this.projectsModule) this.projectsModule.projectsFilterPanelOpen = val; }

  get projectsViewState() { return this.projectsModule?.projectsViewState || { level: 'list' }; }
  set projectsViewState(val) { if (this.projectsModule) this.projectsModule.projectsViewState = val; }

  get projectSectionCollapsed() { return this.projectsModule?.projectSectionCollapsed || { auto: false, my: false }; }
  set projectSectionCollapsed(val) { if (this.projectsModule) this.projectsModule.projectSectionCollapsed = val; }

  get projectsExpandedItems() { return this.projectsModule?.projectsExpandedItems || new Set(); }
  set projectsExpandedItems(val) { if (this.projectsModule) this.projectsModule.projectsExpandedItems = val; }

  get tocFilterRole() { return this.tocMod?.filterRole || 'all'; }
  set tocFilterRole(val) { if (this.tocMod) this.tocMod.filterRole = val; }

  get tocFilterFavorite() { return this.tocMod?.filterFavorite || false; }
  set tocFilterFavorite(val) { if (this.tocMod) this.tocMod.filterFavorite = val; }

  // State proxies for SidebarData module
  get messages() { return this.dataModule?.messages || []; }
  set messages(val) { if (this.dataModule) this.dataModule.messages = val; }

  get conversationId() { return this.dataModule?.conversationId || null; }
  set conversationId(val) { if (this.dataModule) this.dataModule.conversationId = val; }

  /**
   * 检查扩展上下文是否有效（扩展重载后旧脚本上下文会失效）
   * @returns {boolean}
   */
  isExtensionContextValid() {
    try {
      return !!(chrome && chrome.runtime && chrome.runtime.id);
    } catch {
      return false;
    }
  }

  /** 取当前语言的文案，供 JS 动态渲染用；支持 _t(key, { n: 1 }) 等参数替换 */
  _t(key, params) {
    return window.i18nManager ? window.i18nManager.t(key, params || {}) : key;
  }

  /** 极简线型图标（24x24，stroke 1.5，统一风格） */

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
   * Delegated to SidebarTheme module
   */
  async loadStyles() {
    if (this.themeModule) {
      return this.themeModule.loadStyles();
    }
    // Fallback for legacy support
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
    // Delegated to SidebarView module
    if (this.viewModule) {
      return this.viewModule.createContainer();
    }
    // Fallback: minimal container if module not loaded
    this.container = document.createElement('div');
    this.container.className = 'sidebar-container sidebar-hidden';
    this.shadowRoot.appendChild(this.container);
  }
  getLayoutRoots() {
    if (typeof document === 'undefined' || !document.body) return [];
    const candidates = [];
    const add = (el) => { if (el && !candidates.includes(el)) candidates.push(el); };
    if (window.platformAdapter && typeof window.platformAdapter.getMainContainer === 'function') {
      add(window.platformAdapter.getMainContainer());
    }
    add(document.querySelector('main'));
    add(document.getElementById('__next'));
    add(document.getElementById('root'));
    add(document.body);
    // 只保留最内层元素，避免对嵌套祖先重复施加 padding-right
    return candidates.filter(el => !candidates.some(other => other !== el && el.contains(other)));
  }

  getDeepSeekInputContainer() {
    if (!window.location || !window.location.hostname.includes('chat.deepseek.com')) return null;
    const input = document.querySelector('textarea[placeholder*="DeepSeek"]') ||
      document.querySelector('textarea[placeholder*="发送消息"]') ||
      document.querySelector('textarea');
    if (!input) return null;
    let cur = input;
    for (let i = 0; i < 8 && cur; i += 1) {
      const style = window.getComputedStyle(cur);
      if (style && (style.position === 'fixed' || style.position === 'sticky')) return cur;
      cur = cur.parentElement;
    }
    return input.closest('form') || input.closest('[role="form"]') || input.closest('footer') || input.parentElement;
  }

  applyDeepSeekInputOffset(width) {
    const container = this.getDeepSeekInputContainer();
    if (!container) return;
    const w = String(width != null ? width : this.sidebarWidth);
    if (!container.dataset.chatgptSidebarOffset) {
      container.dataset.chatgptSidebarOffset = '1';
      container.dataset.chatgptSidebarPrevRight = container.style.right || '';
      container.dataset.chatgptSidebarPrevWidth = container.style.width || '';
      container.dataset.chatgptSidebarPrevMaxWidth = container.style.maxWidth || '';
    }
    container.style.right = `var(--chatgpt-sidebar-width)`;
    container.style.width = `calc(100% - ${w}px)`;
    container.style.maxWidth = `calc(100% - ${w}px)`;
  }

  clearDeepSeekInputOffset() {
    return this.resizerModule?.clearDeepSeekInputOffset();
  }

  applyPageMarginForDocked(width) {
    return this.resizerModule?.applyPageMarginForDocked(width);
  }

  clearPageMarginForDocked() {
    return this.resizerModule?.clearPageMarginForDocked();
  }

  startResizing() {
    return this.resizerModule?.startResizing();
  }

  endResizing() {
    return this.resizerModule?.endResizing();
  }

  applySidebarWidth(width) {
    return this.resizerModule?.applySidebarWidth(width);
  }

  async applySavedWidth() {
    return this.resizerModule?.applySavedWidth();
  }

  async saveSidebarWidth() {
    return this.resizerModule?.saveSidebarWidth();
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
    // Delegated to SidebarView module
    if (this.viewModule) {
      return this.viewModule.createFloatButton();
    }
  }

  showFloatButton() {
    if (!this.floatButton) this.createFloatButton();
    if (this.floatButton) this.floatButton.style.display = 'flex';
  }

  hideFloatButton() {
    if (this.floatButton) this.floatButton.style.display = 'none';
  }

  initFloatButtonDrag() {
    // Delegated to SidebarView module
    if (this.viewModule) {
      return this.viewModule.initFloatButtonDrag();
    }
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
    // Delegated to SidebarEventHandler module
    if (this.eventModule) {
      return this.eventModule.bindEvents();
    }
    // Fallback: basic events only if module not loaded
    const closeBtn = this.shadowRoot?.getElementById('btn-sidebar-close');
    if (closeBtn) closeBtn.addEventListener('click', () => this.hide());
    const refreshBtn = this.shadowRoot?.getElementById('btn-sidebar-refresh');
    if (refreshBtn) refreshBtn.addEventListener('click', () => this.refreshSidebar());
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
   * 更新版本信息，从 manifest.json 动态读取
   */
  updateVersionInfo() {
    try {
      const manifest = chrome.runtime.getManifest();
      const versionInfo = this.shadowRoot.getElementById('version-info');
      if (versionInfo && manifest) {
        const name = manifest.name || 'ChatStack';
        const version = manifest.version || '1.0.0';
        versionInfo.textContent = `${name} ${version}`;
      }
    } catch (error) {
      console.error('[SidebarUI] Error updating version info:', error);
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

    // 更新 Tab 按钮状态与 aria-selected（键盘/无障碍）
    this.shadowRoot.querySelectorAll('.tab-button').forEach(btn => {
      btn.classList.remove('active');
      const isActive = btn.getAttribute('data-tab') === tabName;
      if (isActive) btn.classList.add('active');
      btn.setAttribute('aria-selected', isActive ? 'true' : 'false');
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
    if (this.projectsModule) {
      return this.projectsModule.restoreProjectsViewState();
    }
  }

  applyProjectSectionCollapsed() {
    if (this.projectsModule && this.projectsModule.applyProjectSectionCollapsed) {
      return this.projectsModule.applyProjectSectionCollapsed();
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
    if (this.tocMod) await this.tocMod.loadFavorites();
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

}

// 全局单例
window.SidebarUI = SidebarUI;
window.sidebarUI = new SidebarUI();
