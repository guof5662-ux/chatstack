/**
 * 侧边栏视图管理模块
 * 职责：DOM创建、显示/隐藏控制、悬浮按钮管理
 */

class SidebarView {
    constructor(sidebar) {
        this.sidebar = sidebar;
        this._floatBtnDragged = false;
        this._floatBtnEdge = null;
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
            this.sidebar.shadowHost = existing;
            this.sidebar.shadowRoot = existing.shadowRoot;
            this.sidebar.container = this.sidebar.shadowRoot ? this.sidebar.shadowRoot.querySelector('.sidebar-container') : null;
            this.log('Sidebar already in DOM');
            this.createFloatButton();
            if (this.sidebar.resizerModule) {
                this.sidebar.resizerModule.applySavedWidth();
            }
            this.applyInitialSidebarState();
            return;
        }

        if (this.sidebar.shadowHost && !this.sidebar.shadowHost.isConnected) {
            this.sidebar.shadowHost = null;
            this.sidebar.shadowRoot = null;
            this.sidebar.container = null;
        }

        this.sidebar.shadowHost = document.createElement('div');
        this.sidebar.shadowHost.id = 'chatgpt-sidebar-extension';
        document.body.appendChild(this.sidebar.shadowHost);
        this.sidebar.shadowRoot = this.sidebar.shadowHost.attachShadow({ mode: 'open' });

        // 加载样式
        if (this.sidebar.themeModule) {
            this.sidebar.themeModule.loadStyles();
        }

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
                this.sidebar.userClosed = true;
                this.hide();
                return;
            }

            const config = await window.storageManager.getConfig();
            if (config && config.sidebarOpen === true) {
                this.sidebar.userClosed = false;
                this.show();
            } else {
                this.sidebar.userClosed = true;
                this.hide();
            }
        } catch (e) {
            this.log('applyInitialSidebarState error:', e);
            this.sidebar.userClosed = true;
            this.hide();
        }
    }

    /**
     * 创建侧边栏容器（包含完整的HTML结构）
     */
    createContainer() {
        if (!this.isExtensionContextValid()) {
            this.log('Extension context invalidated, skipping createContainer');
            return;
        }

        this.sidebar.container = document.createElement('div');
        this.sidebar.container.className = 'sidebar-container sidebar-hidden';

        // 检测暗色模式
        if (this.sidebar.themeModule && this.sidebar.themeModule.isDarkMode()) {
            this.sidebar.container.classList.add('dark');
        }

        const iconUrl = this.isExtensionContextValid() ? chrome.runtime.getURL('icons/float-icon.png') : '';

        // 获取图标辅助函数
        const getIcon = (name) => this.sidebar.getIcon ? this.sidebar.getIcon(name) : '';
        const getExportBarHTML = (scope) => this.sidebar.getExportBarHTML ? this.sidebar.getExportBarHTML(scope) : '';

        this.sidebar.container.innerHTML = this.getSidebarHTML(iconUrl, getIcon, getExportBarHTML);

        this.sidebar.shadowRoot.appendChild(this.sidebar.container);

        // 应用宽度
        if (this.sidebar.resizerModule) {
            this.sidebar.resizerModule.applySidebarWidth(this.sidebar.sidebarWidth);
            this.sidebar.resizerModule.applySavedWidth();
        }

        this.createFloatButton();

        // 绑定事件（由事件处理模块处理）
        if (this.sidebar.bindEvents) {
            this.sidebar.bindEvents();
        }

        // 初始化设置
        if (this.sidebar.initSettings) {
            this.sidebar.initSettings();
        }

        // 更新版本信息
        if (this.sidebar.updateVersionInfo) {
            this.sidebar.updateVersionInfo();
        }
    }

    /**
     * 获取侧边栏HTML模板
     */
    getSidebarHTML(iconUrl, getIcon, getExportBarHTML) {
        return `
      <div class="sidebar-resize-handle" id="sidebar-resize-handle" data-i18n-title="action.dragToResize" title="拖拽调整宽度"></div>
      <div class="sidebar-card">
      <div class="sidebar-header">
        <img src="${iconUrl}" alt="" class="sidebar-header-icon" />
        <div class="sidebar-header-right">
          <div class="sidebar-header-top">
            <h2 class="sidebar-title" data-i18n="header.title">ChatStack</h2>
            <div class="sidebar-header-actions">
              <button type="button" class="sidebar-refresh-btn" id="btn-sidebar-refresh" data-i18n-title="header.refresh" data-i18n-aria-label="header.refresh" title="刷新" aria-label="刷新">${getIcon('refresh')}</button>
              <button type="button" class="sidebar-refresh-btn" id="btn-sidebar-settings" data-i18n-title="header.settings" data-i18n-aria-label="header.settings" title="设置" aria-label="设置">${getIcon('settings')}</button>
              <button type="button" class="sidebar-close-btn" id="btn-sidebar-close" data-i18n-title="header.close" data-i18n-aria-label="header.close" title="关闭" aria-label="关闭">${getIcon('close')}</button>
            </div>
          </div>
          <p class="sidebar-subtitle" data-i18n="header.subtitle">AI 对话侧边导航与重构工具</p>
        </div>
      </div>

      <div class="tab-nav">
        <button class="tab-button active" data-tab="toc">${getIcon('list')} <span data-i18n="tab.current">当前对话</span></button>
        <button class="tab-button" data-tab="conversations">${getIcon('history')} <span data-i18n="tab.history">历史</span></button>
        <button class="tab-button" data-tab="projects">${getIcon('folder')} <span data-i18n="tab.projects">项目</span></button>
      </div>

      <div class="sidebar-content">
        ${this.getTOCPanelHTML(getIcon, getExportBarHTML)}
        ${this.getProjectsPanelHTML(getIcon, getExportBarHTML)}
        ${this.getSettingsPanelHTML(getIcon)}
      </div>
      </div>
    `;
    }

    /**
     * 获取TOC面板HTML（包含当前对话和历史标签）
     */
    getTOCPanelHTML(getIcon, getExportBarHTML) {
        return `
        <div class="tab-panel active" data-panel="toc">
          <!-- 当前对话：上方搜索+筛选，下方可滚动对话区 -->
          <div class="toc-view toc-view-with-bottom" id="toc-view-current" data-view="toc" style="display: flex;">
            <div class="toc-view-top">
              <div class="search-box search-box-with-filter">
                <input type="text" class="search-input" data-i18n-placeholder="filter.search.messages" placeholder="搜索消息内容..." id="search-input" aria-label="搜索消息">
                <button type="button" class="search-filter-btn search-export-btn" id="btn-toc-export" data-i18n-title="action.export" data-i18n-aria-label="action.export" title="导出" aria-label="导出">${getIcon('export')}</button>
              </div>
              ${getExportBarHTML('toc')}
              <div class="toc-filters">
                <button type="button" class="toc-filter-btn active" data-filter-role="all"><span data-i18n="filter.all">全部</span></button>
                <button type="button" class="toc-filter-btn" data-filter-role="user"><span data-i18n="filter.user">用户</span></button>
                <button type="button" class="toc-filter-btn" data-filter-role="assistant"><span data-i18n="filter.ai">AI</span></button>
                <button type="button" class="toc-filter-btn" data-filter-favorite="true" id="toc-filter-favorite">${getIcon('star')} <span data-i18n="filter.favorite">收藏</span></button>
                <button type="button" class="toc-filter-btn toc-add-to-project-btn" id="toc-btn-add-to-project" data-i18n-title="filter.addToProject" data-i18n-aria-label="filter.addToProject" title="添加到项目" aria-label="添加到项目">${getIcon('folderAdd')} <span data-i18n="filter.addToProject">添加到项目</span></button>
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
                <button type="button" class="search-filter-btn" id="btn-conversations-filter" data-i18n-title="filter.filter" data-i18n-aria-label="filter.filter" title="筛选" aria-label="筛选">${getIcon('filter')}</button>
                <button type="button" class="search-filter-btn search-export-btn" id="btn-conversations-export" data-i18n-title="action.export" data-i18n-aria-label="action.export" title="导出" aria-label="导出">${getIcon('export')}</button>
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
                        <button type="button" class="filter-date-calendar-btn" data-for="conv-filter-start-date" data-i18n-title="filter.selectDate" data-i18n-aria-label="filter.selectDate" title="选择日期" aria-label="选择日期">${getIcon('calendar')}</button>
                      </div>
                    </div>
                    <div class="filter-date-group">
                      <label class="filter-panel-label" data-i18n="filter.endDate">结束日期</label>
                      <div class="filter-date-wrap">
                        <input type="text" class="filter-date-input" id="conv-filter-end-date" placeholder="yyyy/mm/dd" />
                        <button type="button" class="filter-date-calendar-btn" data-for="conv-filter-end-date" data-i18n-title="filter.selectDate" data-i18n-aria-label="filter.selectDate" title="选择日期" aria-label="选择日期">${getIcon('calendar')}</button>
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
                    <label class="filter-platform-option"><input type="checkbox" value="DeepSeek" /> DeepSeek</label>
                  </div>
                </div>
                <div class="filter-panel-actions">
                  <button type="button" class="btn btn-primary btn-small" id="btn-conv-filter-apply" data-i18n="filter.apply">筛选</button>
                  <button type="button" class="btn btn-secondary btn-small" id="btn-conv-filter-clear" data-i18n="filter.clear">清除筛选</button>
                </div>
              </div>
            </div>
            ${getExportBarHTML('history')}
            <div id="conversations-list-container">
              <div id="conversations-by-platform" class="conversations-by-platform"></div>
            </div>
            <div id="conversation-detail-container" style="display: none;">
              <div class="conv-detail-top">
                <div class="conv-detail-toolbar">
                  <button type="button" class="btn btn-conv-back-icon" id="btn-conv-back" data-i18n-title="action.backToList" data-i18n-aria-label="action.backToList" title="返回列表" aria-label="返回列表">${getIcon('back')}</button>
                  <div class="toc-filters conv-detail-filters" id="conv-detail-filters">
                  <button type="button" class="toc-filter-btn active" data-filter-role="all"><span data-i18n="filter.all">全部</span></button>
                  <button type="button" class="toc-filter-btn" data-filter-role="user"><span data-i18n="filter.user">用户</span></button>
                  <button type="button" class="toc-filter-btn" data-filter-role="assistant"><span data-i18n="filter.ai">AI</span></button>
                  <button type="button" class="toc-filter-btn" data-filter-favorite="true">${getIcon('star')} <span data-i18n="filter.favorite">收藏</span></button>
                  <button type="button" class="toc-filter-btn toc-add-to-project-btn" id="conv-detail-add-to-project" data-i18n-title="filter.addToProject" data-i18n-aria-label="filter.addToProject" title="添加到项目" aria-label="添加到项目">${getIcon('folderAdd')} <span data-i18n="filter.addToProject">添加到项目</span></button>
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
        `;
    }

    /**
     * 获取项目面板HTML
     */
    getProjectsPanelHTML(getIcon, getExportBarHTML) {
        return `
        <div class="tab-panel" data-panel="projects">
          <div class="search-and-filter-wrap" id="projects-search-and-filter-wrap">
            <div class="search-box search-box-with-filter">
              <input type="text" class="search-input" data-i18n-placeholder="filter.search.projects" placeholder="搜索项目或对话标题..." id="projects-search-input" aria-label="搜索项目">
              <button type="button" class="search-filter-btn" id="btn-projects-filter" data-i18n-title="filter.filter" data-i18n-aria-label="filter.filter" title="筛选" aria-label="筛选">${getIcon('filter')}</button>
              <button type="button" class="search-filter-btn search-export-btn" id="btn-projects-export" data-i18n-title="action.export" data-i18n-aria-label="action.export" title="导出" aria-label="导出">${getIcon('export')}</button>
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
                      <button type="button" class="filter-date-calendar-btn" data-for="projects-filter-start-date" data-i18n-title="filter.selectDate" data-i18n-aria-label="filter.selectDate" title="选择日期" aria-label="选择日期">${getIcon('calendar')}</button>
                    </div>
                  </div>
                  <div class="filter-date-group">
                    <label class="filter-panel-label" data-i18n="filter.endDate">结束日期</label>
                    <div class="filter-date-wrap">
                      <input type="text" class="filter-date-input" id="projects-filter-end-date" placeholder="yyyy/mm/dd" />
                      <button type="button" class="filter-date-calendar-btn" data-for="projects-filter-end-date" data-i18n-title="filter.selectDate" data-i18n-aria-label="filter.selectDate" title="选择日期" aria-label="选择日期">${getIcon('calendar')}</button>
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
                  <label class="filter-platform-option"><input type="checkbox" value="DeepSeek" /> DeepSeek</label>
                </div>
              </div>
              <div class="filter-panel-actions">
                <button type="button" class="btn btn-primary btn-small" id="btn-projects-filter-apply" data-i18n="filter.apply">筛选</button>
                <button type="button" class="btn btn-secondary btn-small" id="btn-projects-filter-clear" data-i18n="filter.clear">清除筛选</button>
              </div>
            </div>
          </div>
          ${getExportBarHTML('projects')}
          <div class="project-section" id="my-projects-section">
            <div class="project-section-header" data-section="my">
              <div class="project-section-title-row">
                <h3 class="project-section-title" data-i18n="project.myProjects">我创建的项目</h3>
                <button class="btn btn-primary btn-small project-header-create-btn" id="btn-create-project" data-i18n="project.create">+ 新建项目</button>
                <span class="project-section-toggle" aria-hidden="true">${getIcon('chevronDown')}</span>
              </div>
            </div>
            <ul class="project-list" id="my-projects-list"></ul>
          </div>
        </div>
        `;
    }

    /**
     * 获取设置面板HTML
     */
    getSettingsPanelHTML(getIcon) {
        return `
        <div class="tab-panel" data-panel="settings">
          <div class="settings-panel">
            <div class="settings-header">
              <button type="button" class="settings-back-btn" id="btn-settings-back" data-i18n-title="action.back" data-i18n-aria-label="action.back" title="返回" aria-label="返回">
                ${getIcon('back')}
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

              <!-- 清空历史对话 -->
              <div style="margin-bottom: 12px;">
                <div style="font-size: 12px; color: #6b7280; margin-bottom: 4px;" data-i18n="settings.data.clearHistory">清空历史对话</div>
                <div class="settings-clear-row">
                  <select id="select-clear-history" class="settings-select">
                    <option value="7" data-i18n="settings.data.timeRange.7d">一周前</option>
                    <option value="30" data-i18n="settings.data.timeRange.30d">一个月前</option>
                    <option value="90" data-i18n="settings.data.timeRange.90d">三个月前</option>
                    <option value="all" data-i18n="settings.data.timeRange.all">全部对话</option>
                  </select>
                  <button class="btn btn-danger btn-small" id="btn-clear-history" data-i18n="settings.data.clearHistoryBtn">清空</button>
                </div>
                <p class="settings-hint" data-i18n="settings.data.clearHistory.hint">清空指定时间前的对话，不影响项目和配置</p>
              </div>

              <!-- 清空所有数据 -->
              <div class="settings-buttons">
                <button class="btn btn-danger" id="btn-clear-data" data-i18n="settings.data.clearAll">清空所有数据</button>
              </div>
            </div>

            <div class="settings-footer">
              <p id="version-info"></p>
            </div>
          </div>
        </div>
        `;
    }

    /**
     * 显示侧边栏
     */
    show() {
        this.sidebar.userClosed = false;

        if (!this.sidebar.container) {
            const c = this.sidebar.shadowRoot && this.sidebar.shadowRoot.querySelector('.sidebar-container');
            if (c) this.sidebar.container = c;
        }

        if (this.sidebar.container) {
            this.sidebar.container.classList.remove('sidebar-hidden');
            if (this.sidebar.resizerModule) {
                this.sidebar.resizerModule.applySidebarWidth(this.sidebar.sidebarWidth);
            }
        }

        this.hideFloatButton();
        this.persistSidebarOpen(true);
    }

    /**
     * 隐藏侧边栏
     */
    hide() {
        this.sidebar.userClosed = true;

        if (!this.sidebar.container) {
            const c = this.sidebar.shadowRoot && this.sidebar.shadowRoot.querySelector('.sidebar-container');
            if (c) this.sidebar.container = c;
        }

        if (this.sidebar.container) {
            this.sidebar.container.classList.add('sidebar-hidden');
        }

        if (this.sidebar.resizerModule) {
            this.sidebar.resizerModule.clearPageMarginForDocked();
        }

        this.showFloatButton();
        this.persistSidebarOpen(false);
    }

    /**
     * 切换侧边栏显示/隐藏
     */
    toggle() {
        if (!this.sidebar.container) {
            const c = this.sidebar.shadowRoot && this.sidebar.shadowRoot.querySelector('.sidebar-container');
            if (c) this.sidebar.container = c;
        }

        if (this.sidebar.container) {
            const isHidden = this.sidebar.container.classList.contains('sidebar-hidden');
            if (isHidden) this.show();
            else this.hide();
        }
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

    /**
     * 创建悬浮按钮
     */
    createFloatButton() {
        if (!this.isExtensionContextValid()) {
            this.log('Extension context invalidated, skipping createFloatButton');
            return;
        }

        const existing = document.getElementById('chatgpt-sidebar-float-btn');
        if (existing) {
            this.sidebar.floatButton = existing;
            this.sidebar.floatButtonVisual = existing.querySelector('.chatgpt-sidebar-float-btn-visual');
            return;
        }

        // 外层：定位、热区、拖拽
        this.sidebar.floatButton = document.createElement('div');
        this.sidebar.floatButton.id = 'chatgpt-sidebar-float-btn';
        this.sidebar.floatButton.className = 'chatgpt-sidebar-float-btn';
        this.sidebar.floatButton.style.display = 'none';

        // 内层：视觉图标
        this.sidebar.floatButtonVisual = document.createElement('div');
        this.sidebar.floatButtonVisual.className = 'chatgpt-sidebar-float-btn-visual';

        const floatImg = document.createElement('img');
        floatImg.src = this.isExtensionContextValid() ? chrome.runtime.getURL('icons/float-icon.png') : '';
        floatImg.alt = this.sidebar._t ? this.sidebar._t('float.openSidebar') : '打开侧边栏';
        floatImg.className = 'chatgpt-sidebar-float-btn-icon';

        this.sidebar.floatButtonVisual.appendChild(floatImg);
        this.sidebar.floatButtonVisual.title = this.sidebar._t ? this.sidebar._t('float.openSidebar') : '打开侧边栏';
        this.sidebar.floatButton.appendChild(this.sidebar.floatButtonVisual);
        document.body.appendChild(this.sidebar.floatButton);

        // 点击视觉层打开侧边栏
        this.sidebar.floatButtonVisual.addEventListener('click', (_e) => {
            if (this._floatBtnDragged) return; // 拖拽结束不触发点击
            this.show();
        });

        // 初始化拖拽和贴边逻辑
        this.initFloatButtonDrag();

        // 恢复上次位置
        this.restoreFloatButtonPosition();
    }

    /**
     * 显示悬浮按钮
     */
    showFloatButton() {
        if (!this.sidebar.floatButton) this.createFloatButton();
        if (this.sidebar.floatButton) this.sidebar.floatButton.style.display = 'flex';
    }

    /**
     * 隐藏悬浮按钮
     */
    hideFloatButton() {
        if (this.sidebar.floatButton) this.sidebar.floatButton.style.display = 'none';
    }

    /**
     * 初始化悬浮按钮拖拽与贴边逻辑
     */
    initFloatButtonDrag() {
        if (!this.sidebar.floatButton) return;

        let dragging = false;
        let startX = 0, startY = 0, startLeft = 0, startTop = 0;
        const EDGE_THRESHOLD = 10; // 只有图标边界几乎贴到左右边框时才吸入隐藏

        const onMouseDown = (e) => {
            if (!this.sidebar.floatButton.contains(e.target)) return;
            e.preventDefault();
            dragging = true;
            this._floatBtnDragged = false;
            startX = e.clientX;
            startY = e.clientY;
            const rect = this.sidebar.floatButton.getBoundingClientRect();
            startLeft = rect.left;
            startTop = rect.top;
            this.sidebar.floatButton.classList.add('dragging');
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
            const rect = this.sidebar.floatButton.getBoundingClientRect();
            const btnW = rect.width, btnH = rect.height;
            newLeft = Math.max(0, Math.min(window.innerWidth - btnW, newLeft));
            newTop = Math.max(0, Math.min(window.innerHeight - btnH, newTop));

            this.sidebar.floatButton.style.left = newLeft + 'px';
            this.sidebar.floatButton.style.top = newTop + 'px';
            this.sidebar.floatButton.style.right = 'auto';
            this.sidebar.floatButton.style.bottom = 'auto';
        };

        const onMouseUp = (_e) => {
            if (!dragging) return;
            dragging = false;
            this.sidebar.floatButton.classList.remove('dragging');
            document.removeEventListener('mousemove', onMouseMove);
            document.removeEventListener('mouseup', onMouseUp);

            // 判断贴边
            const rect = this.sidebar.floatButton.getBoundingClientRect();
            let edge = null;

            if (rect.left < EDGE_THRESHOLD) {
                edge = 'left';
                this.sidebar.floatButton.style.left = '0px';
                this.sidebar.floatButton.style.right = 'auto';
            } else if (window.innerWidth - rect.right < EDGE_THRESHOLD) {
                edge = 'right';
                this.sidebar.floatButton.style.left = 'auto';
                this.sidebar.floatButton.style.right = '0px';
            }

            this.sidebar.floatButton.classList.remove('edge-left', 'edge-right', 'expanded');
            if (edge === 'left') this.sidebar.floatButton.classList.add('edge-left');
            else if (edge === 'right') this.sidebar.floatButton.classList.add('edge-right');

            this._floatBtnEdge = edge;

            // 保存位置
            this.saveFloatButtonPosition();

            // 短暂延迟后允许点击
            setTimeout(() => { this._floatBtnDragged = false; }, 50);
        };

        this.sidebar.floatButton.addEventListener('mousedown', onMouseDown);

        // Hover 展开/收起：贴边状态下 hover 展开，离开后延迟收起
        let collapseTimer = null;
        this.sidebar.floatButton.addEventListener('mouseenter', () => {
            if (collapseTimer) {
                clearTimeout(collapseTimer);
                collapseTimer = null;
            }
            if (this._floatBtnEdge) {
                this.sidebar.floatButton.classList.add('expanded');
            }
        });

        this.sidebar.floatButton.addEventListener('mouseleave', () => {
            if (this._floatBtnEdge) {
                collapseTimer = setTimeout(() => {
                    this.sidebar.floatButton.classList.remove('expanded');
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

            const rect = this.sidebar.floatButton.getBoundingClientRect();
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
                this.sidebar.floatButton.style.left = '0px';
                this.sidebar.floatButton.style.right = 'auto';
                this.sidebar.floatButton.classList.add('edge-left');
            } else if (pos.edge === 'right') {
                this.sidebar.floatButton.style.left = 'auto';
                this.sidebar.floatButton.style.right = '0px';
                this.sidebar.floatButton.classList.add('edge-right');
            } else {
                this.sidebar.floatButton.style.left = x + 'px';
                this.sidebar.floatButton.style.right = 'auto';
            }

            this.sidebar.floatButton.style.top = y + 'px';
            this.sidebar.floatButton.style.bottom = 'auto';
            this._floatBtnEdge = pos.edge || null;
        } catch (e) {
            this.log('restoreFloatButtonPosition error:', e);
        }
    }

    // 辅助方法

    /**
     * 检查扩展上下文是否有效
     */
    isExtensionContextValid() {
        try {
            return !!(chrome && chrome.runtime && chrome.runtime.id);
        } catch {
            return false;
        }
    }

    /**
     * 日志输出
     */
    log(...args) {
        if (this.sidebar && this.sidebar.DEBUG) {
            console.log('[SidebarView]', ...args);
        }
    }
}

// 全局注册
window.SidebarView = SidebarView;
