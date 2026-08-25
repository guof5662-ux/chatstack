/**
 * 侧边栏项目管理模块
 * 职责：渲染项目列表、处理项目相关的交互（创建、删除、移动会话等）
 */
class SidebarProjects {
    constructor(sidebar) {
        this.sidebar = sidebar;
        // State variables managed by this module
        this.projectsSearchKeyword = '';
        this.projectsFilterPanelOpen = false;
        // 项目标签内视图状态：切到其他标签再切回时恢复（list | conversation）
        this.projectsViewState = { level: 'list', projectType: null, projectKey: null, conversationId: null, conversationTitle: null, searchKeyword: '' };
        this.projectSectionCollapsed = { auto: false, my: false };
        // 历史页：记录已展开的项目，避免重渲染后自动收回
        this.projectsExpandedItems = new Set();
        this._savedProjectsPanelScrollTop = null;

        // Detailed view state
        this.projectsDetailMessages = null;
        this.projectsDetailMessagesEl = null;
        this.projectsDetailConvId = null;
        this.projectsDetailConvData = null;
        this.tocFilterRole = null;
        this.tocFilterFavorite = false;
    }

    /**
     * Proxy for translation
     */
    _t(key, params) {
        return this.sidebar._t(key, params);
    }

    /**
     * Helper to access shadowRoot
     */
    get shadowRoot() {
        return this.sidebar.shadowRoot;
    }

    /**
     * Helper to access exportState
     */
    get exportState() {
        return this.sidebar.exportState;
    }

    /**
     * Helper to access common methods from sidebar
     */
    escapeHtml(str) {
        return this.sidebar.escapeHtml(str);
    }

    getPlatformIconUrl(platform) {
        return this.sidebar.getPlatformIconUrl(platform);
    }

    getIcon(name) {
        return this.sidebar.getIcon(name);
    }

    formatTimeAgo(ts) {
        return this.sidebar.formatTimeAgo(ts);
    }

    highlightKeywordInText(text, keyword) {
        return this.sidebar.highlightKeywordInText(text, keyword);
    }

    log(...args) {
        this.sidebar.log(...args);
    }

    createDialog(...args) {
        return this.sidebar.createDialog(...args);
    }

    showConfirmDialog(...args) {
        return this.sidebar.showConfirmDialog(...args);
    }

    showToast(msg) {
        this.sidebar.showToast(msg);
    }

    openConversationInNewTab(id) {
        this.sidebar.openConversationInNewTab(id);
    }

    toggleExportSelectionFromDot(dot) {
        this.sidebar.toggleExportSelectionFromDot(dot);
    }

    editConversationTitle(id, card) {
        // Re-use logic from conversations module if possible
        if (this.sidebar.conversationsModule) {
            this.sidebar.conversationsModule.editConversationTitle(id, card);
        }
    }

    findPreviewBreakpoint(content) {
        if (this.sidebar.tocMod && this.sidebar.tocMod.findPreviewBreakpoint) {
            return this.sidebar.tocMod.findPreviewBreakpoint(content);
        }
        return 200; // Fallback
    }

    saveProjectsPanelScrollState() {
        const panel = this.shadowRoot?.querySelector('.tab-panel[data-panel="projects"]');
        if (panel && this.projectsViewState?.level === 'conversation') {
            this._savedProjectsPanelScrollTop = panel.scrollTop;
            return;
        }
        this._savedProjectsPanelScrollTop = null;
    }

    getConversationListById() {
        const listById = {};
        return window.storageManager.getConversationList().then((list) => {
            (list || []).forEach((item) => { listById[item.id] = item; });
            return listById;
        });
    }

    async filterEntriesForProject(convIds, listById, rangeStart, rangeEnd, projKwLower) {
        let entries = convIds.map((id) => listById[id]).filter(Boolean);
        if (rangeStart != null && rangeEnd != null) {
            entries = entries.filter((item) => {
                const t = item.lastSeenAt || 0;
                return t >= rangeStart && t <= rangeEnd;
            });
        }
        if (this.sidebar.tocFilterPlatforms && this.sidebar.tocFilterPlatforms.length > 0) {
            entries = entries.filter((item) => {
                const platform = item.platform || 'ChatGPT';
                return this.sidebar.tocFilterPlatforms.includes(platform);
            });
        }
        if (!projKwLower) return entries.sort((a, b) => (b.lastSeenAt || 0) - (a.lastSeenAt || 0));

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
        return entries
            .filter((item) => item._titleMatch || item._snippetMatch || item._contentMatchCount > 0)
            .sort((a, b) => (b.lastSeenAt || 0) - (a.lastSeenAt || 0));
    }

    renderProjectCardsHtml(entries, projectType, projKw) {
        if (entries.length === 0) {
            return `<ul class="project-conv-list-view"><li class="project-conv-empty">${this.escapeHtml(this._t('project.noConvs'))}</li></ul>`;
        }
        return `<ul class="project-conv-list-view">${entries.map((item) => {
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
                      <button type="button" class="conv-card-action" data-action="open" title="${this.escapeHtml(this._t('conv.openInNewTab'))}" aria-label="${this.escapeHtml(this._t('conv.openInNewTab'))}">${this.getIcon('external')}</button>
                      ${projectType === 'my' ? `<button type="button" class="conv-card-action" data-action="move" data-conv-id="${this.escapeHtml(item.id)}" title="${this.escapeHtml(this._t('action.move'))}" aria-label="${this.escapeHtml(this._t('action.move'))}">${this.getIcon('move')}</button>` : ''}
                      ${projectType === 'my' ? `<button type="button" class="conv-card-action conv-card-action--delete" data-action="remove-from-project" data-conv-id="${this.escapeHtml(item.id)}" title="${this.escapeHtml(this._t('conv.removeFromProject'))}" aria-label="${this.escapeHtml(this._t('conv.removeFromProject'))}">${this.getIcon('trash')}</button>` : ''}
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
        }).join('')}</ul>`;
    }

    renderProjectItem(options) {
        const { projectType, projectKey, projectName, entries, projKw, projKwLower } = options;
        const projectNameHtml = projKw ? this.highlightKeywordInText(projectName, projKw) : this.escapeHtml(projectName);
        const cardListHtml = this.renderProjectCardsHtml(entries, projectType, projKw);
        const detailViewHtml = entries.length === 0 ? '' : `<div class="project-conv-detail-view" style="display:none;">
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
        const convListSection = entries.length === 0
            ? `<ul class="project-conversations"><li class="project-conv-empty">${this.escapeHtml(this._t('project.noConvs'))}</li></ul>`
            : `<div class="project-conversations">${cardListHtml}${detailViewHtml}</div>`;
        const editBtn = projectType === 'my' ? `<button type="button" class="project-header-action" data-action="edit-project" title="${this.escapeHtml(this._t('project.editTitle'))}" aria-label="${this.escapeHtml(this._t('project.editTitle'))}">${this.getIcon('edit')}</button>` : '';
        const deleteBtn = `<button type="button" class="project-header-action" data-action="delete-project" title="${this.escapeHtml(projectType === 'my' ? this._t('project.deleteProject') : this._t('project.removeCategory'))}" aria-label="${this.escapeHtml(projectType === 'my' ? this._t('project.deleteProject') : this._t('project.removeCategory'))}">${this.getIcon('trash')}</button>`;
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
    }

    /**
     * 渲染项目列表（可展开、对话列表、移除/移动）
     */
    async renderProjects() {
        this.saveProjectsPanelScrollState();
        const myProjects = window.projectManager.getMyProjects();
        const listById = await this.getConversationListById();
        const { start: rangeStart, end: rangeEnd } = this.sidebar.getFilterDateRange();
        const projKw = (this.projectsSearchKeyword || '').trim();
        const projKwLower = projKw.toLowerCase();

        // 我创建的项目（项目页仅保留此项）
        const myList = this.shadowRoot.getElementById('my-projects-list');
        if (Object.keys(myProjects).length === 0) {
            myList.innerHTML = '<div class="empty-state"><div class="empty-state-text">' + this._t('empty.noMyProjects').replace(/\n/g, '<br>') + '</div></div>';
        } else {
            const myItems = [];
            for (const [id, project] of Object.entries(myProjects)) {
                const name = project.name || id;
                const filteredEntries = await this.filterEntriesForProject(project.conversations || [], listById, rangeStart, rangeEnd, projKwLower);
                if (projKwLower && filteredEntries.length === 0 && !name.toLowerCase().includes(projKwLower)) continue;
                myItems.push(this.renderProjectItem({ projectType: 'my', projectKey: id, projectName: name, entries: filteredEntries, projKw, projKwLower }));
            }
            myList.innerHTML = myItems.length ? myItems.join('') : '<div class="empty-state"><div class="empty-state-text">' + this._t('empty.noFilterProjects') + '</div></div>';
        }

        this.bindProjectItemEvents(myList);
        this.applyProjectsExpandedState(myList);
        this.applyProjectSectionCollapsed();
        if (this.exportState.active && this.exportState.scope === 'projects') {
            this.sidebar.syncExportSelectionUI();
        }
    }

    applyProjectSectionCollapsed() {
        const mySection = this.shadowRoot.querySelector('.project-section .project-section-header[data-section="my"]')?.closest('.project-section');
        if (mySection) mySection.classList.toggle('project-section-collapsed', !!this.projectSectionCollapsed.my);
    }

    handleProjectCardExportSelection(e, card) {
        if (!(this.exportState.active && this.exportState.scope === 'projects')) return false;
        if (e.target.closest('.export-select-dot')) return true;
        const dot = card.querySelector('.export-select-dot');
        if (dot) this.toggleExportSelectionFromDot(dot);
        return true;
    }

    shouldIgnoreProjectCardClick(e) {
        if (e.target.closest('.export-select-dot')) return true;
        if (e.target.closest('.conv-card-actions')) return true;
        if (e.target.closest('.conv-card-title')) return true;
        return false;
    }

    prepareProjectDetailSearchInput(detailView) {
        const listSearchWrapEl = this.shadowRoot.getElementById('projects-search-and-filter-wrap');
        const projSearchEl = this.shadowRoot.getElementById('projects-search-input');
        const detailSearchEl = detailView.querySelector('.project-conv-detail-search-input');
        const btnProjFilterEl = this.shadowRoot.getElementById('btn-projects-filter');
        const projFilterPanelEl = this.shadowRoot.getElementById('projects-filter-panel');
        if (listSearchWrapEl) listSearchWrapEl.style.display = 'none';
        if (btnProjFilterEl) btnProjFilterEl.style.display = 'none';
        if (projFilterPanelEl) projFilterPanelEl.style.display = 'none';
        if (!detailSearchEl) return null;
        detailSearchEl.placeholder = this._t('filter.search.currentConv');
        if (projSearchEl && projSearchEl.value.trim()) detailSearchEl.value = projSearchEl.value.trim();
        detailSearchEl.oninput = () => this.handleProjectDetailSearch(detailSearchEl.value.trim());
        return detailSearchEl;
    }

    bindProjectDetailTitleEdit(titleEl, convId, card) {
        if (!titleEl) return;
        titleEl.addEventListener('dblclick', (e) => {
            e.stopPropagation();
            this.editConversationTitle(convId, card);
        });
    }

    async openProjectConversationDetail({ item, listView, detailView, card, type, key }) {
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
        const detailSearchEl = this.prepareProjectDetailSearchInput(detailView);
        const initialKw = detailSearchEl ? detailSearchEl.value.trim() : '';
        this.projectsViewState = { level: 'conversation', projectType: type, projectKey: key, conversationId: convId, conversationTitle, searchKeyword: initialKw || '' };
        await this.renderProjectConversationMessages(convId, messagesEl, initialKw || undefined);
        this.bindProjectConvDetailFilters(detailView, convId, detailSearchEl);
        this.bindProjectDetailTitleEdit(titleEl, convId, card);
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
                        if (this.handleProjectCardExportSelection(e, card)) return;
                        if (this.shouldIgnoreProjectCardClick(e)) return;
                        await this.openProjectConversationDetail({ item, listView, detailView, card, type, key });
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
        const convId = conversationId || this.sidebar.conversationId;
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
     * 切回项目标签时恢复之前的层级（若之前在某个对话详情则重新展开并显示该对话）
     */

    // --- Utility Methods Recovered from Backup ---


}

(function (global) {
    global.SidebarProjects = SidebarProjects;
})(typeof globalThis !== 'undefined' ? globalThis : window);
