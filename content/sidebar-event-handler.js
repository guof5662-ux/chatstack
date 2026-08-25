/**
 * 侧边栏事件处理模块
 * 职责：集中管理所有事件监听和处理逻辑
 */

class SidebarEventHandler {
    constructor(sidebar) {
        this.sidebar = sidebar;
    }

    /**
     * 绑定所有事件监听
     */
    bindEvents() {
        this.bind基础控制Events();
        this.bindResizeEvents();
        this.bindTabEvents();
        this.bindTOCEvents();
        this.bindHistoryEvents();
        this.bindProjectsEvents();
        this.bindExportEvents();
        this.bindSettingsEvents();
        this.bindKeyboardEvents();
    }

    /**
     * 基础控制事件（关闭、刷新等）
     */
    bind基础控制Events() {
        const sr = this.sidebar.shadowRoot;
        if (!sr) return;

        // 关闭按钮
        const closeBtn = sr.getElementById('btn-sidebar-close');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => {
                if (this.sidebar.viewModule) {
                    this.sidebar.viewModule.hide();
                }
            });
        }

        // 刷新按钮
        const refreshBtn = sr.getElementById('btn-sidebar-refresh');
        if (refreshBtn) {
            refreshBtn.addEventListener('click', () => {
                if (this.sidebar.refreshSidebar) {
                    this.sidebar.refreshSidebar();
                }
            });
        }

        // 设置按钮
        sr.getElementById('btn-sidebar-settings')?.addEventListener('click', () => {
            if (this.sidebar.currentTab === 'settings') {
                this.sidebar.switchTab(this.sidebar.lastNonSettingsTab || 'toc');
            } else {
                this.sidebar.lastNonSettingsTab = this.sidebar.currentTab || 'toc';
                this.sidebar.switchTab('settings');
            }
        });

        // 设置页返回按钮
        sr.getElementById('btn-settings-back')?.addEventListener('click', () => {
            this.sidebar.switchTab(this.sidebar.lastNonSettingsTab || 'toc');
        });
    }

    /**
     * 调整大小事件
     */
    bindResizeEvents() {
        const sr = this.sidebar.shadowRoot;
        if (!sr) return;

        const resizeHandle = sr.getElementById('sidebar-resize-handle');
        if (!resizeHandle) return;

        resizeHandle.addEventListener('mousedown', (e) => {
            e.preventDefault();

            this.sidebar._resizeStartX = e.clientX;
            this.sidebar._resizeStartWidth = this.sidebar.sidebarWidth;

            if (this.sidebar.resizerModule) {
                this.sidebar.resizerModule.startResizing();
            }

            let rafId = null;
            let lastEv = null;

            const onMove = (ev) => {
                lastEv = ev;
                if (rafId != null) return;

                rafId = requestAnimationFrame(() => {
                    rafId = null;
                    if (lastEv == null) return;

                    const delta = this.sidebar._resizeStartX - lastEv.clientX;
                    const w = Math.min(560, Math.max(240, this.sidebar._resizeStartWidth + delta));

                    if (this.sidebar.resizerModule) {
                        this.sidebar.resizerModule.applySidebarWidth(w);
                    }
                });
            };

            const onUp = () => {
                document.removeEventListener('mousemove', onMove);
                document.removeEventListener('mouseup', onUp);
                document.body.style.userSelect = '';
                document.body.style.cursor = '';

                if (rafId != null) cancelAnimationFrame(rafId);

                if (this.sidebar.resizerModule) {
                    this.sidebar.resizerModule.endResizing();
                    this.sidebar.resizerModule.saveSidebarWidth();
                }
            };

            document.body.style.userSelect = 'none';
            document.body.style.cursor = 'col-resize';
            document.addEventListener('mousemove', onMove);
            document.addEventListener('mouseup', onUp);
        });
    }

    /**
     * 标签页切换事件
     */
    bindTabEvents() {
        const sr = this.sidebar.shadowRoot;
        if (!sr) return;

        const tabButtons = sr.querySelectorAll('.tab-button');
        const tabOrder = ['toc', 'conversations', 'projects'];

        tabButtons.forEach(btn => {
            btn.setAttribute('role', 'tab');

            // 点击切换
            btn.addEventListener('click', (e) => {
                const tab = (e.currentTarget || e.target).getAttribute('data-tab');
                if (tab) this.sidebar.switchTab(tab);
            });

            // 键盘导航
            btn.addEventListener('keydown', (e) => {
                const tab = btn.getAttribute('data-tab');
                if (!tab) return;

                let nextTab = null;
                if (e.key === 'ArrowRight') {
                    const idx = tabOrder.indexOf(tab);
                    nextTab = tabOrder[idx + 1] || tabOrder[0];
                } else if (e.key === 'ArrowLeft') {
                    const idx = tabOrder.indexOf(tab);
                    nextTab = tabOrder[idx - 1] != null ? tabOrder[idx - 1] : tabOrder[tabOrder.length - 1];
                }

                if (nextTab) {
                    e.preventDefault();
                    this.sidebar.switchTab(nextTab);
                    const nextBtn = sr.querySelector(`.tab-button[data-tab="${nextTab}"]`);
                    if (nextBtn) nextBtn.focus();
                }
            });
        });

        const tabList = sr.querySelector('.tab-nav');
        if (tabList) tabList.setAttribute('role', 'tablist');
    }

    /**
     * TOC（目录）标签页事件
     */
    bindTOCEvents() {
        const sr = this.sidebar.shadowRoot;
        if (!sr) return;

        // 搜索框
        const searchInput = sr.getElementById('search-input');
        if (searchInput) {
            const runSearch = () => {
                if (this.sidebar.handleSearch) {
                    this.sidebar.handleSearch(searchInput.value);
                }
            };

            searchInput.addEventListener('input', runSearch);
            searchInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    runSearch();
                }
            });
            searchInput.addEventListener('focus', () => {
                if (searchInput.value.trim()) runSearch();
            });
        }

        // 筛选按钮
        sr.querySelectorAll('.toc-filter-btn').forEach((btn) => {
            btn.addEventListener('click', () => {
                if (btn.id === 'toc-btn-add-to-project') {
                    if (this.sidebar.showAddToProjectDialog) {
                        this.sidebar.showAddToProjectDialog();
                    }
                    return;
                }

                const role = btn.getAttribute('data-filter-role');
                const isFavBtn = btn.getAttribute('data-filter-favorite') === 'true';

                if (role) {
                    this.sidebar.tocFilterRole = role;
                    if (this.sidebar.renderTOC) this.sidebar.renderTOC();
                } else if (isFavBtn) {
                    this.sidebar.tocFilterFavorite = !this.sidebar.tocFilterFavorite;
                    if (this.sidebar.renderTOC) this.sidebar.renderTOC();
                }
            });
        });

        // 日期选择器按钮
        sr.querySelectorAll('.filter-date-calendar-btn').forEach((btn) => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const inputId = btn.getAttribute('data-for');
                if (inputId && this.sidebar.openDatePickerForInput) {
                    this.sidebar.openDatePickerForInput(inputId, btn);
                }
            });
        });

        // TOC 视图切换按钮
        sr.querySelectorAll('.toc-view-tab').forEach(btn => {
            btn.addEventListener('click', () => {
                const view = btn.getAttribute('data-view');
                if (this.sidebar.switchTocView) {
                    this.sidebar.switchTocView(view);
                }
            });
        });
    }

    /**
     * 历史对话标签页事件
     */
    bindHistoryEvents() {
        const sr = this.sidebar.shadowRoot;
        if (!sr) return;

        const convSearchInput = sr.getElementById('conversations-search-input');
        const convFilterPanel = sr.getElementById('conversations-filter-panel');
        const btnConvFilter = sr.getElementById('btn-conversations-filter');
        const convDetailContainer = sr.getElementById('conversation-detail-container');

        // 搜索框
        if (convSearchInput) {
            convSearchInput.addEventListener('input', () => {
                const kw = convSearchInput.value.trim();
                if (convDetailContainer && convDetailContainer.style.display === 'block') {
                    if (this.sidebar.handleHistoryDetailSearch) {
                        this.sidebar.handleHistoryDetailSearch(kw);
                    }
                } else {
                    this.sidebar.conversationsSearchKeyword = kw;
                    if (this.sidebar.renderConversationsList) {
                        this.sidebar.renderConversationsList();
                    }
                }
            });
        }

        // 筛选面板
        if (btnConvFilter && convFilterPanel) {
            this.bindFilterPanel('conversations', btnConvFilter, convFilterPanel, 'conv');
        }
    }

    /**
     * 项目标签页事件
     */
    bindProjectsEvents() {
        const sr = this.sidebar.shadowRoot;
        if (!sr) return;

        const projSearchInput = sr.getElementById('projects-search-input');
        const projFilterPanel = sr.getElementById('projects-filter-panel');
        const btnProjFilter = sr.getElementById('btn-projects-filter');

        // 搜索框
        if (projSearchInput) {
            projSearchInput.addEventListener('input', () => {
                const kw = projSearchInput.value.trim();
                const inProjectDetail = sr.querySelector('.project-item--showing-detail');

                if (inProjectDetail) {
                    if (this.sidebar.handleProjectDetailSearch) {
                        this.sidebar.handleProjectDetailSearch(kw);
                    }
                } else {
                    this.sidebar.projectsSearchKeyword = kw;
                    if (this.sidebar.renderProjects) {
                        this.sidebar.renderProjects();
                    }
                }
            });
        }

        // 筛选面板
        if (btnProjFilter && projFilterPanel) {
            this.bindFilterPanel('projects', btnProjFilter, projFilterPanel, 'projects');
        }

        // 项目分组折叠
        sr.querySelectorAll('.project-section-header').forEach((header) => {
            header.addEventListener('click', () => {
                const section = header.getAttribute('data-section');
                if (!section) return;

                const key = section === 'auto' ? 'auto' : 'my';
                this.sidebar.projectSectionCollapsed[key] = !this.sidebar.projectSectionCollapsed[key];

                if (this.sidebar.applyProjectSectionCollapsed) {
                    this.sidebar.applyProjectSectionCollapsed();
                }
            });
        });

        // 新建项目按钮
        sr.getElementById('btn-create-project')?.addEventListener('click', (e) => {
            e.stopPropagation();
            if (this.sidebar.showCreateProjectDialog) {
                this.sidebar.showCreateProjectDialog();
            }
        });
    }

    /**
     * 绑定筛选面板（历史和项目共用）
     * @param {string} scope - 'conversations' | 'projects'
     * @param {HTMLElement} btnFilter - 筛选按钮
     * @param {HTMLElement} filterPanel - 筛选面板
     * @param {string} prefix - 输入元素ID前缀 'conv' | 'projects'
     */
    bindFilterPanel(scope, btnFilter, filterPanel, prefix) {
        const sr = this.sidebar.shadowRoot;

        // 切换筛选面板
        btnFilter.addEventListener('click', (e) => {
            e.stopPropagation();

            const panelOpen = scope === 'conversations'
                ? this.sidebar.conversationsFilterPanelOpen
                : this.sidebar.projectsFilterPanelOpen;

            const newState = !panelOpen;

            if (scope === 'conversations') {
                this.sidebar.conversationsFilterPanelOpen = newState;
            } else {
                this.sidebar.projectsFilterPanelOpen = newState;
            }

            filterPanel.style.display = newState ? 'block' : 'none';

            if (newState && this.sidebar.syncFilterPanelUI) {
                this.sidebar.syncFilterPanelUI(scope);
            }

            const hasFilter = this.sidebar.hasActiveFilter ? this.sidebar.hasActiveFilter() : false;
            btnFilter.classList.toggle('active', newState || hasFilter);
        });

        // 日期范围快捷按钮
        filterPanel.querySelectorAll('.filter-range-btn').forEach((btn) => {
            btn.addEventListener('click', () => {
                const range = btn.getAttribute('data-range');
                this.sidebar.tocFilterDateRange = range;

                const { start, end } = this.sidebar.getFilterDateRange ? this.sidebar.getFilterDateRange() : { start: null, end: null };
                this.sidebar.tocFilterStartDate = start;
                this.sidebar.tocFilterEndDate = end;

                sr.querySelectorAll('.filter-range-btn').forEach((b) => b.classList.remove('active'));
                btn.classList.add('active');

                const startVal = start && this.sidebar.formatDateForInput ? this.sidebar.formatDateForInput(start) : '';
                const endVal = end && this.sidebar.formatDateForInput ? this.sidebar.formatDateForInput(end) : '';

                ['conv-filter-start-date', 'conv-filter-end-date', 'projects-filter-start-date', 'projects-filter-end-date'].forEach((id) => {
                    const el = sr.getElementById(id);
                    if (el) el.value = id.includes('start') ? startVal : endVal;
                });
            });
        });

        // 日期输入框
        const startEl = sr.getElementById(`${prefix}-filter-start-date`);
        const endEl = sr.getElementById(`${prefix}-filter-end-date`);

        if (startEl) {
            startEl.addEventListener('change', () => {
                this.sidebar.tocFilterStartDate = this.sidebar.parseDateInput ? this.sidebar.parseDateInput(startEl.value) : null;
                this.sidebar.tocFilterDateRange = 'custom';
            });
        }

        if (endEl) {
            endEl.addEventListener('change', () => {
                this.sidebar.tocFilterEndDate = this.sidebar.parseDateInput ? this.sidebar.parseDateInput(endEl.value) : null;
                this.sidebar.tocFilterDateRange = 'custom';
            });
        }

        // 平台筛选下拉框
        const platformTrigger = sr.getElementById(`${prefix}-filter-platform-trigger`);
        const platformOptions = sr.getElementById(`${prefix}-filter-platform-options`);

        if (platformTrigger && platformOptions) {
            platformTrigger.addEventListener('click', () => {
                const visible = platformOptions.style.display === 'block';
                platformOptions.style.display = visible ? 'none' : 'block';
            });

            platformOptions.querySelectorAll('input[type="checkbox"]').forEach((cb) => {
                cb.addEventListener('change', () => {
                    this.sidebar.tocFilterPlatforms = Array.from(platformOptions.querySelectorAll('input[type="checkbox"]:checked')).map((c) => c.value);
                    if (this.sidebar.updateFilterPlatformTriggerText) {
                        this.sidebar.updateFilterPlatformTriggerText(`${prefix}-filter-platform-trigger`);
                    }
                });
            });
        }

        // 应用筛选按钮
        sr.getElementById(`btn-${prefix}-filter-apply`)?.addEventListener('click', () => {
            if (this.sidebar.applyFilterFromPanel) {
                this.sidebar.applyFilterFromPanel(`${prefix}-filter-start-date`, `${prefix}-filter-end-date`);
            }

            filterPanel.style.display = 'none';

            if (scope === 'conversations') {
                this.sidebar.conversationsFilterPanelOpen = false;
                if (this.sidebar.renderConversationsList) {
                    this.sidebar.renderConversationsList();
                }
            } else {
                this.sidebar.projectsFilterPanelOpen = false;
                if (this.sidebar.renderProjects) {
                    this.sidebar.renderProjects();
                }
            }

            const hasFilter = this.sidebar.hasActiveFilter ? this.sidebar.hasActiveFilter() : false;
            btnFilter.classList.toggle('active', hasFilter);
        });

        // 清除筛选按钮
        sr.getElementById(`btn-${prefix}-filter-clear`)?.addEventListener('click', () => {
            if (this.sidebar.clearTocFilter) {
                this.sidebar.clearTocFilter();
            }

            if (this.sidebar.syncFilterPanelUI) {
                this.sidebar.syncFilterPanelUI(scope);
            }

            filterPanel.style.display = 'none';

            if (scope === 'conversations') {
                this.sidebar.conversationsFilterPanelOpen = false;
                if (this.sidebar.renderConversationsList) {
                    this.sidebar.renderConversationsList();
                }
            } else {
                this.sidebar.projectsFilterPanelOpen = false;
                if (this.sidebar.renderProjects) {
                    this.sidebar.renderProjects();
                }
            }

            btnFilter.classList.remove('active');
        });

        // 点击外部关闭筛选面板
        sr.addEventListener('click', (e) => {
            const panelOpen = scope === 'conversations'
                ? this.sidebar.conversationsFilterPanelOpen
                : this.sidebar.projectsFilterPanelOpen;

            if (panelOpen && !filterPanel.contains(e.target) && !btnFilter.contains(e.target)) {
                filterPanel.style.display = 'none';

                if (scope === 'conversations') {
                    this.sidebar.conversationsFilterPanelOpen = false;
                } else {
                    this.sidebar.projectsFilterPanelOpen = false;
                }

                const hasFilter = this.sidebar.hasActiveFilter ? this.sidebar.hasActiveFilter() : false;
                btnFilter.classList.toggle('active', hasFilter);
            }
        });
    }

    /**
     * 导出相关事件
     */
    bindExportEvents() {
        const sr = this.sidebar.shadowRoot;
        if (!sr) return;

        // 导出按钮
        sr.getElementById('btn-toc-export')?.addEventListener('click', () => {
            if (this.sidebar.toggleExportMode) {
                this.sidebar.toggleExportMode('toc');
            }
        });

        sr.getElementById('btn-conversations-export')?.addEventListener('click', () => {
            if (this.sidebar.toggleExportMode) {
                this.sidebar.toggleExportMode('history');
            }
        });

        sr.getElementById('btn-projects-export')?.addEventListener('click', () => {
            if (this.sidebar.toggleExportMode) {
                this.sidebar.toggleExportMode('projects');
            }
        });

        // 导出选择点击
        sr.addEventListener('click', (e) => {
            const dot = e.target.closest('.export-select-dot');
            if (dot) {
                e.stopPropagation();
                if (this.sidebar.toggleExportSelectionFromDot) {
                    this.sidebar.toggleExportSelectionFromDot(dot);
                }
                return;
            }

            const actionBtn = e.target.closest('.export-bar [data-action]');
            if (actionBtn) {
                e.stopPropagation();
                if (this.sidebar.handleExportBarAction) {
                    this.sidebar.handleExportBarAction(actionBtn);
                }
            }
        });

        // 导出格式复选框
        sr.addEventListener('change', (e) => {
            const target = e.target;
            if (!target) return;

            if (target.matches('.export-bar input[data-format]')) {
                const format = target.getAttribute('data-format');
                this.sidebar.exportState.formats[format] = target.checked;
            }
        });
    }

    updateFloatingButtonTextsForLanguage() {
        if (!this.sidebar._t) return;
        const floatImg = this.sidebar.floatButton?.querySelector('.chatgpt-sidebar-float-btn-icon');
        if (floatImg) floatImg.alt = this.sidebar._t('float.openSidebar');
        if (this.sidebar.floatButtonVisual) this.sidebar.floatButtonVisual.title = this.sidebar._t('float.openSidebar');
    }

    rerenderCurrentTabAfterLanguageChange() {
        if (this.sidebar.currentTab === 'toc' && this.sidebar.renderTOC) {
            this.sidebar.renderTOC();
            return;
        }
        if (this.sidebar.currentTab === 'conversations') {
            if (this.sidebar.viewingConversationId && this.sidebar.renderConversationDetailInToc) {
                this.sidebar.renderConversationDetailInToc(this.sidebar.viewingConversationId);
                return;
            }
            if (this.sidebar.renderConversationsList) this.sidebar.renderConversationsList();
            return;
        }
        if (this.sidebar.currentTab === 'projects' && this.sidebar.renderProjects) {
            this.sidebar.renderProjects();
        }
    }

    refreshLanguageDependentUI(shadowRoot) {
        if (this.sidebar.updateFilterPlatformTriggerText) {
            this.sidebar.updateFilterPlatformTriggerText();
        }
        if (this.sidebar.datePickerPopup && this.sidebar.renderDatePickerGrid) {
            this.sidebar.renderDatePickerGrid();
        }
        this.updateFloatingButtonTextsForLanguage();
        this.rerenderCurrentTabAfterLanguageChange();
        if (this.sidebar.exportState.active) {
            if (this.sidebar.updateExportCount) this.sidebar.updateExportCount();
            if (this.sidebar.updateExportHint) this.sidebar.updateExportHint();
        }
        if (window.i18nManager) {
            window.i18nManager.updateDOM(shadowRoot);
        }
    }

    async handleLanguageSettingChange(event, shadowRoot) {
        const lang = event?.target?.value;
        if (!lang) return;
        const config = await window.storageManager.getConfig();
        config.language = lang;
        await window.storageManager.saveConfig(config);

        if (window.i18nManager) {
            const resolvedLang = (lang === 'auto') ? this.sidebar.getSystemLanguageCode() : lang;
            window.i18nManager.setLanguage(resolvedLang);
        }
        this.refreshLanguageDependentUI(shadowRoot);
        this.log('Language changed to:', lang);
    }

    /**
     * 设置页面事件
     */
    bindSettingsEvents() {
        const sr = this.sidebar.shadowRoot;
        if (!sr) return;

        // 清空所有数据
        sr.getElementById('btn-clear-data')?.addEventListener('click', () => {
            if (this.sidebar.clearAllData) {
                this.sidebar.clearAllData();
            }
        });

        // 清空历史数据
        sr.getElementById('btn-clear-history')?.addEventListener('click', () => {
            const daysValue = sr.getElementById('select-clear-history')?.value;
            const daysMap = {
                '7': { days: 7, label: this.sidebar._t ? this.sidebar._t('settings.data.timeRange.7d') : '一周前' },
                '30': { days: 30, label: this.sidebar._t ? this.sidebar._t('settings.data.timeRange.30d') : '一个月前' },
                '90': { days: 90, label: this.sidebar._t ? this.sidebar._t('settings.data.timeRange.90d') : '三个月前' },
                'all': { days: Infinity, label: this.sidebar._t ? this.sidebar._t('settings.data.timeRange.all') : '全部对话' }
            };

            const selected = daysMap[daysValue];
            if (selected && this.sidebar.clearHistoryData) {
                this.sidebar.clearHistoryData(selected.days, selected.label);
            }
        });

        // 自动保存开关
        sr.getElementById('toggle-auto-save')?.addEventListener('change', async (e) => {
            try {
                if (!e.target) return;
                const isChecked = e.target.checked;

                if (!window.storageManager || typeof window.storageManager.getConfig !== 'function') {
                    console.error('[SidebarEventHandler] storageManager not available');
                    return;
                }

                const config = await window.storageManager.getConfig();
                if (!config || typeof config !== 'object') {
                    console.error('[SidebarEventHandler] Invalid config object:', config);
                    return;
                }

                config.autoSave = isChecked;
                await window.storageManager.saveConfig(config);
                this.log('Auto-save:', isChecked);

                // 如果重新开启，立即重新解析当前页
                if (isChecked && window.platformAdapter && typeof window.platformAdapter.updateMessages === 'function') {
                    window.platformAdapter.updateMessages(true);
                }
            } catch (error) {
                console.error('[SidebarEventHandler] Error updating autoSave config:', error);
            }
        });

        // 语言切换
        sr.getElementById('select-language')?.addEventListener('change', async (e) => {
            try {
                await this.handleLanguageSettingChange(e, sr);
            } catch (error) {
                console.error('[SidebarEventHandler] Error updating language config:', error);
            }
        });

        // 主题切换
        sr.getElementById('select-theme')?.addEventListener('change', async (e) => {
            try {
                const theme = e.target.value;
                const config = await window.storageManager.getConfig();
                config.theme = theme;
                await window.storageManager.saveConfig(config);

                if (this.sidebar.themeModule && this.sidebar.themeModule.applyTheme) {
                    this.sidebar.themeModule.applyTheme(theme);
                }

                this.log('Theme changed to:', theme);
            } catch (error) {
                console.error('[SidebarEventHandler] Error updating theme config:', error);
            }
        });

        // 监听系统主题变化
        if (window.matchMedia) {
            window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', async () => {
                try {
                    const config = await window.storageManager.getConfig();
                    if (config.theme === 'auto' || !config.theme) {
                        if (this.sidebar.themeModule && this.sidebar.themeModule.applyTheme) {
                            this.sidebar.themeModule.applyTheme('auto');
                        }
                    }
                } catch (error) {
                    console.error('[SidebarEventHandler] Error handling system theme change:', error);
                }
            });
        }
    }

    /**
     * 键盘事件（防止按键传播到页面）
     */
    bindKeyboardEvents() {
        const sr = this.sidebar.shadowRoot;
        if (!sr) return;

        const stopKeyPropagation = (e) => {
            const target = e.target;
            if (!target || !sr.contains(target)) return;

            if (target.matches('input, textarea') || target.isContentEditable) {
                e.stopPropagation();
            }
        };

        sr.addEventListener('keydown', stopKeyPropagation);
        sr.addEventListener('keyup', stopKeyPropagation);
        sr.addEventListener('keypress', stopKeyPropagation);
    }

    /**
     * 日志输出
     */
    log(...args) {
        if (this.sidebar && this.sidebar.DEBUG) {
            console.log('[SidebarEventHandler]', ...args);
        }
    }
}

// 全局注册
window.SidebarEventHandler = SidebarEventHandler;
