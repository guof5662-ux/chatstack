/**
 * 侧边栏对话列表管理模块
 * 职责：负责渲染会话列表、处理搜索、筛选、删除会话等核心业务逻辑
 */
class SidebarConversations {
    constructor(sidebar) {
        this.sidebar = sidebar;
        // State variables managed by this module
        this.conversationsSearchKeyword = '';
        this.viewingConversationId = null;
        this.historyDetailMessages = null;
        this.historyDetailConvId = null;
        this.conversationsFilterPanelOpen = false;
        this.historyDetailConvData = null;
        // Cache for platform icons
        this._platformIcons = {};
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
     * Helper methods from sidebar that are needed here
     */
    escapeHtml(str) { return this.sidebar.escapeHtml(str); }
    getPlatformIconUrl(platform) { return this.sidebar.getPlatformIconUrl(platform); }
    getIcon(name) { return this.sidebar.getIcon(name); }
    formatTimeAgo(ts) { return this.sidebar.formatTimeAgo(ts); }
    highlightKeywordInText(text, keyword) { return this.sidebar.highlightKeywordInText(text, keyword); }
    log(...args) { this.sidebar.log(...args); }
    resetConversationsDetailView() {
        this.viewingConversationId = null;
        this.historyDetailMessages = null;
        this.historyDetailConvId = null;
    }
    prepareConversationsListSearchUI() {
        const listSearchWrapEl = this.shadowRoot.getElementById('conversations-search-and-filter-wrap');
        const convSearchInputEl = this.shadowRoot.getElementById('conversations-search-input');
        const convDetailSearchEl = this.shadowRoot.getElementById('conv-detail-search-input');
        const btnConvFilterEl = this.shadowRoot.getElementById('btn-conversations-filter');
        if (listSearchWrapEl) listSearchWrapEl.style.display = '';
        if (convSearchInputEl) convSearchInputEl.placeholder = this._t('filter.search.conversations');
        if (btnConvFilterEl) btnConvFilterEl.style.display = '';
        if (convDetailSearchEl) convDetailSearchEl.oninput = null;
    }
    buildHistoryProjectsByPlatform(autoProjects) {
        const byPlatform = {};
        Object.entries(autoProjects).forEach(([key, project]) => {
            const platform = project.platform || 'ChatGPT';
            if (!byPlatform[platform]) byPlatform[platform] = [];
            byPlatform[platform].push({ key, project });
        });
        return byPlatform;
    }
    async filterEntriesForHistory(convIds, listById, rangeStart, rangeEnd, kwLower) {
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
    }
    buildHistoryCardListHtml(entries, kw, kwLower, noConvs) {
        if (entries.length === 0) return `<ul class="project-conv-list-view"><li class="project-conv-empty">${this.escapeHtml(noConvs)}</li></ul>`;
        return `<ul class="project-conv-list-view">${entries.map((item) => {
            const titleText = (item.title || this._t('conv.defaultTitle')).slice(0, 36);
            const snippetText = (item.snippet || '').slice(0, 100);
            const titleHtml = kwLower ? this.highlightKeywordInText(titleText, kw) : this.escapeHtml(titleText);
            const snippetHtml = kwLower ? this.highlightKeywordInText(snippetText, kw) : this.escapeHtml(snippetText);
            const showContentMatch = kwLower && item._contentMatchCount > 0;
            const matchText = showContentMatch ? this._t('conv.contentMatches', { n: String(item._contentMatchCount) }) : '';
            const platformName = item.platform || 'ChatGPT';
            const platformTag = this.escapeHtml(platformName);
            const pIconUrl = this.getPlatformIconUrl(platformName);
            const isSelected = this.exportState.active && this.exportState.scope === 'history' && this.exportState.selected && this.exportState.selected.has(`history:conversation:${item.id}`);
            const selectedClass = isSelected ? ' selected' : '';
            return `
                        <li class="conv-card${selectedClass}" data-conversation-id="${this.escapeHtml(item.id)}">
                          <button type="button" class="export-select-dot" data-scope="history" data-type="conversation" data-id="${this.escapeHtml(item.id)}" aria-label="${this._t('export.select')}"></button>
                          <div class="conv-card-header">
                            <div class="conv-card-title conv-card-title-editable" title="${this.escapeHtml(this._t('conv.editTitleHint'))}">${titleHtml}</div>
                            <div class="conv-card-actions">
                              <button type="button" class="conv-card-action" data-action="open" title="${this.escapeHtml(this._t('conv.openInNewTab'))}" aria-label="${this.escapeHtml(this._t('conv.openInNewTab'))}">${this.getIcon('external')}</button>
                              <button type="button" class="conv-card-action" data-action="add-to-project" title="${this.escapeHtml(this._t('filter.addToProject'))}" aria-label="${this.escapeHtml(this._t('filter.addToProject'))}">${this.getIcon('folderAdd')}</button>
                              <button type="button" class="conv-card-action conv-card-action--delete" data-action="delete" title="${this.escapeHtml(this._t('conv.delete'))}" aria-label="${this.escapeHtml(this._t('conv.delete'))}">${this.getIcon('trash')}</button>
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
        }).join('')}</ul>`;
    }
    buildHistoryProjectItemHtml(options) {
        const { key, name, platform, filteredEntries, noConvs, expandByDefault, kw, kwLower } = options;
        const cardListHtml = this.buildHistoryCardListHtml(filteredEntries, kw, kwLower, noConvs);
        const convListSection = filteredEntries.length === 0
            ? `<ul class="project-conversations"><li class="project-conv-empty">${this.escapeHtml(noConvs)}</li></ul>`
            : `<div class="project-conversations">${cardListHtml}</div>`;
        const isInbox = key === `${platform}:Inbox`;
        const deleteBtn = isInbox
            ? ''
            : `<button type="button" class="project-header-action" data-action="delete-project" title="${this.escapeHtml(this._t('project.removeCategory'))}" aria-label="${this.escapeHtml(this._t('project.removeCategory'))}">${this.getIcon('trash')}</button>`;
        const expandedClass = expandByDefault ? ' expanded' : '';
        return `
                <li class="project-item${expandedClass}" data-project-type="auto" data-project-key="${this.escapeHtml(key)}">
                  <div class="project-item-header">
                    <button type="button" class="project-toggle-icon" aria-label="${this.escapeHtml(this._t('project.toggleExpand'))}">${this.getIcon('chevronRight')}</button>
                    <span class="project-name">${this.escapeHtml(name)}</span>
                    <span class="project-count">${filteredEntries.length}</span>
                    <div class="project-header-actions">
                         <button type="button" class="export-select-dot" data-scope="history" data-type="project" data-project-type="auto" data-project-key="${this.escapeHtml(key)}" aria-label="${this._t('export.select')}"></button>
                         ${deleteBtn}
                    </div>
                  </div>
                  ${convListSection}
                </li>`;
    }

    resolveHistoryProjectName(platform, key, project) {
        const isInbox = key === `${platform}:Inbox`;
        if (isInbox) return this._t('history.chatgpt.yourChats');
        return project?.name || key;
    }

    async buildHistorySectionsHtml(options) {
        const { byPlatform, listById, rangeStart, rangeEnd, kw, kwLower } = options;
        const hasFilter = this.sidebar.hasActiveFilter();
        const expandedSet = this.getHistoryExpandedProjectsSet();
        const collapsedState = this.sidebar.projectSectionCollapsed || {};
        const platformOrder = ['ChatGPT', 'Gemini', 'Claude', 'DeepSeek'];
        const platformBlocks = [];

        for (const platform of platformOrder) {
            const groups = byPlatform[platform] || [];
            if (groups.length === 0) continue;

            const groupsHtml = await Promise.all(groups.map(async ({ key, project }) => {
                const filtered = await this.filterEntriesForHistory(project.conversations || [], listById, rangeStart, rangeEnd, kwLower);
                const name = this.resolveHistoryProjectName(platform, key, project);
                if (filtered.length === 0 && ((kwLower && !name.toLowerCase().includes(kwLower)) || hasFilter)) {
                    return '';
                }
                const isExpanded = hasFilter || expandedSet.has(key) || !collapsedState[key];
                return this.buildHistoryProjectItemHtml({
                    key,
                    name,
                    platform,
                    filteredEntries: filtered,
                    noConvs: this._t('project.noConvs'),
                    expandByDefault: isExpanded,
                    kw,
                    kwLower
                });
            }));

            const projectItems = groupsHtml.filter(Boolean);
            if (projectItems.length === 0 && (hasFilter || kwLower)) continue;

            const platformTitle = this._t('project.projectsInPlatform', { platform });
            const platformIconUrl = this.getPlatformIconUrl(platform);
            platformBlocks.push(`
                <div class="project-platform-block" data-platform="${this.escapeHtml(platform)}">
                  <h4 class="project-platform-subtitle">
                    <img class="project-section-icon" alt="" src="${this.escapeHtml(platformIconUrl)}" />
                    ${this.escapeHtml(platformTitle)}
                  </h4>
                  <ul class="project-list">${projectItems.length ? projectItems.join('') : `<li class="project-conv-empty">${this.escapeHtml(this._t('project.noConvs'))}</li>`}</ul>
                </div>
            `);
        }

        return platformBlocks.join('');
    }
    /**
     * 渲染历史对话列表
     */
    async renderConversationsList() {
        if (!this.shadowRoot) return;
        const listContainer = this.shadowRoot.getElementById('conversations-list-container');
        const detailContainer = this.shadowRoot.getElementById('conversation-detail-container');
        const listEl = this.shadowRoot.getElementById('conversations-by-platform');
        if (!listContainer || !listEl) return;
        listContainer.style.display = 'block';
        if (detailContainer) detailContainer.style.display = 'none';
        this.resetConversationsDetailView();
        this.prepareConversationsListSearchUI();
        try {
            const autoProjects = window.projectManager.getAutoProjects();
            const list = await window.storageManager.getConversationList() || [];
            const listById = {};
            list.forEach((item) => { listById[item.id] = item; });
            const { start: rangeStart, end: rangeEnd } = this.sidebar.getFilterDateRange();
            const kw = (this.conversationsSearchKeyword || '').trim();
            const kwLower = kw.toLowerCase();
            const byPlatform = this.buildHistoryProjectsByPlatform(autoProjects);
            if (Object.keys(byPlatform).length === 0) {
                const emptyText = this.sidebar.hasActiveFilter() ? this._t('empty.noFilterResults') : this._t('empty.noConversations');
                listEl.innerHTML = '<div class="empty-state"><div class="empty-state-icon">💬</div><div class="empty-state-text">' + emptyText.replace(/\n/g, '<br>') + '</div></div>';
                if (this.exportState.active && this.exportState.scope === 'history') this.sidebar.syncExportSelectionUI();
                return;
            }
            const sectionsHtml = await this.buildHistorySectionsHtml({ byPlatform, listById, rangeStart, rangeEnd, kw, kwLower });
            if (!sectionsHtml) {
                const emptyText = this.sidebar.hasActiveFilter() ? this._t('empty.noFilterResults') : this._t('empty.noConversations');
                listEl.innerHTML = '<div class="empty-state"><div class="empty-state-icon">💬</div><div class="empty-state-text">' + emptyText.replace(/\n/g, '<br>') + '</div></div>';
            } else {
                listEl.innerHTML = sectionsHtml;
            }
            // 绑定事件
            this._bindConversationsListEvents(listEl);
            this.applyHistoryExpandedState(listEl);
            // 同步导出UI状态
            if (this.exportState.active && this.exportState.scope === 'history') {
                this.sidebar.syncExportSelectionUI();
            }
        } catch (e) {
            this.log('renderConversationsList error:', e);
            listEl.innerHTML = `<div class="error-message">Error loading conversations: ${this.escapeHtml(e.message)}</div>`;
        }
    }
    /**
     * 绑定会话列表事件
     */
    _bindConversationsListEvents(container) {
        // 项目折叠/展开
        container.querySelectorAll('.project-item-header').forEach((header) => {
            header.addEventListener('click', (e) => {
                // Ignore if clicked on actions or export dot
                if (e.target.closest('.project-header-actions') || e.target.closest('.export-select-dot')) return;
                const item = header.closest('.project-item');
                const key = item.dataset.projectKey;
                item.classList.toggle('expanded');
                // Toggle state
                if (item.classList.contains('expanded')) {
                    delete this.sidebar.projectSectionCollapsed[key];
                } else {
                    this.sidebar.projectSectionCollapsed[key] = true;
                }
                this.updateHistoryExpandedState(key, item.classList.contains('expanded'));
            });
        });

        container.querySelectorAll('.project-header-action[data-action="delete-project"]').forEach((btn) => {
            btn.addEventListener('click', async (e) => {
                e.stopPropagation();
                const item = btn.closest('.project-item');
                const key = item?.dataset.projectKey;
                if (!key) return;
                const ok = await this.sidebar.showConfirmDialog(
                    this._t('confirm.title'),
                    this._t('confirm.removeCategory.message', { name: key })
                );
                if (!ok) return;
                if (window.projectManager?.deleteAutoProjectCategory) {
                    await window.projectManager.deleteAutoProjectCategory(key);
                } else {
                    await window.projectManager?.deleteChatGPTProjectCategory?.(key);
                }
                this.renderConversationsList();
            });
        });

        // 会话卡片点击
        container.querySelectorAll('.conv-card').forEach((card) => {
            card.addEventListener('click', (e) => {
                // Ignore if clicked on actions or export dot
                if (
                    e.target.closest('.conv-card-actions') ||
                    e.target.closest('.export-select-dot') ||
                    e.target.closest('.conv-card-title')
                ) return;

                const convId = card.dataset.conversationId;
                // Add selection logic for export mode
                if (this.exportState.active && this.exportState.scope === 'history') {
                    if (this.sidebar.exportMod) {
                        this.sidebar.exportMod.toggleExportSelection('history', convId);
                        this.sidebar.syncExportSelectionUI();
                    }
                    return;
                }

                this.renderConversationDetailInToc(convId);
            });
        });

        // 卡片动作按钮
        container.querySelectorAll('.conv-card-action').forEach((btn) => {
            btn.addEventListener('click', async (e) => {
                e.stopPropagation();
                const action = btn.dataset.action;
                const card = btn.closest('.conv-card');
                const convId = card.dataset.conversationId;

                if (action === 'delete') {
                    await this.deleteConversation(convId);
                } else if (action === 'open') {
                    this.openConversationInNewTab(convId);
                } else if (action === 'add-to-project') {
                    this.sidebar.projectsModule?.showAddToProjectDialog(convId);
                }
            });
        });

        // 标题编辑
        container.querySelectorAll('.conv-card-title-editable').forEach((titleEl) => {
            titleEl.addEventListener('dblclick', (e) => {
                e.stopPropagation();
                if (this.exportState.active && this.exportState.scope === 'history') return;
                const card = titleEl.closest('.conv-card');
                const convId = card?.dataset.conversationId;
                if (!convId) return;
                this.editConversationTitle(convId, card);
            });
        });
    }

    getHistoryExpandedProjectsSet() {
        if (!(this.sidebar.historyExpandedProjects instanceof Set)) {
            this.sidebar.historyExpandedProjects = new Set();
        }
        return this.sidebar.historyExpandedProjects;
    }

    applyHistoryExpandedState(container) {
        if (!container) return;
        const expandedSet = this.getHistoryExpandedProjectsSet();
        if (expandedSet.size === 0) return;
        container.querySelectorAll('.project-item').forEach((item) => {
            const key = item.dataset.projectKey;
            if (key && expandedSet.has(key)) {
                item.classList.add('expanded');
            }
        });
    }

    updateHistoryExpandedState(key, expanded) {
        if (!key) return;
        const expandedSet = this.getHistoryExpandedProjectsSet();
        if (expanded) expandedSet.add(key);
        else expandedSet.delete(key);
    }

    /**
     * 删除会话
     */
    async deleteConversation(convId) {
        const ok = await this.sidebar.showConfirmDialog(
            this._t('confirm.deleteConv.title'),
            this._t('confirm.deleteConv.message')
        );
        if (!ok) return;

        try {
            let list = await window.storageManager.getConversationList();
            list = list.filter(item => item.id !== convId);
            await window.storageManager.saveConversationList(list);

            await window.projectManager.removeFromAutoProject(convId);
            const myProjects = window.projectManager.getMyProjects();
            for (const [projectId, project] of Object.entries(myProjects)) {
                if ((project.conversations || []).includes(convId)) {
                    await window.projectManager.removeFromMyProject(convId, projectId);
                }
            }

            await window.storageManager.deleteConversation(convId);
            this.renderConversationsList();
        } catch (e) {
            this.log('Error deleting conversation:', e);
        }
    }

    /**
     * Proxy for showToast
     */
    showToast(message) {
        this.sidebar.showToast(message);
    }

    /**
     * Proxy for createDialog
     */
    createDialog(...args) {
        return this.sidebar.createDialog(...args);
    }

    /**
     * Proxy for createConfirmDialog
     */
    createConfirmDialog(...args) {
        return this.sidebar.createConfirmDialog(...args);
    }

    async copyTextToClipboard(text) {
        if (this.sidebar.copyTextToClipboard) {
            return this.sidebar.copyTextToClipboard(text);
        }
        try {
            await navigator.clipboard.writeText(text);
            this.showToast(this._t('toast.copied'));
        } catch (e) {
            this.log('Copy failed:', e);
            this.showToast(this._t('toast.copyFailed'));
        }
    }

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
        return `https://chatgpt.com/c/${id}`;
    }

    openConversationInNewTab(conversationId) {
        if (this.sidebar.openConversationInNewTab) {
            this.sidebar.openConversationInNewTab(conversationId);
        }
    }

    updateOpenInPlatformButtonText(platformName) {
        const btn = this.shadowRoot.getElementById('btn-open-conv');
        if (!btn) return;
        const name = (platformName || '').trim() || 'ChatGPT';
        btn.textContent = this._t('action.openInPlatform', { platform: name });
    }

    findPreviewBreakpoint(content) {
        return this.sidebar.tocMod ? this.sidebar.tocMod.findPreviewBreakpoint(content) : content.length;
    }

    countKeywordOccurrences(text, keyword) {
        return this.sidebar.tocMod ? this.sidebar.tocMod.countKeywordOccurrences(text, keyword) : 0;
    }

    restoreMsgSearchOverlayForTab(tabName) {
        if (this.sidebar.tocMod) this.sidebar.tocMod.restoreMsgSearchOverlayForTab(tabName);
    }

    extractMessageHTMLForDisplay(element) {
        return this.sidebar.tocMod ? this.sidebar.tocMod.extractMessageHTMLForDisplay(element) : '';
    }

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

    formatHistoryContent(content) {
        if (!content || !content.trim()) return '<p class="toc-expanded-p toc-content-lead-wrap">无内容</p>';
        return this.formatContentAsTocHtml(content);
    }

    getHistoryContentBlocks(content) {
        return content.split(/\n\n+/).map((b) => b.trim()).filter(Boolean);
    }

    formatHistoryCodeBlock(block) {
        const codeBlockMatch = block.match(/^```(?:\w+)?\s*\n?([\s\S]*?)```\s*$/);
        if (!codeBlockMatch) return '';
        const codeContent = (codeBlockMatch[1] || '').trim();
        return '<pre class="toc-expanded-pre"><code class="toc-expanded-code">' + this.escapeHtml(codeContent) + '</code></pre>';
    }

    formatHistoryHeadingBlock(block) {
        const h2Match = block.match(/^##\s+(.+)$/s);
        if (h2Match) return `<h2 class="toc-expanded-h2">${this.applyInlineBold(h2Match[1].trim())}</h2>`;
        const h3Match = block.match(/^###\s+(.+)$/s);
        if (h3Match) return `<h3 class="toc-expanded-h3">${this.applyInlineBold(h3Match[1].trim())}</h3>`;
        return '';
    }

    formatHistoryListBlock(lines) {
        const circled = /^[①②③④⑤⑥⑦⑧⑨⑩]\s*/;
        const numDot = /^\d+\.\s+/;
        const bullet = /^[-*]\s+/;
        const allCircled = lines.length > 0 && lines.every((l) => circled.test(l));
        if (allCircled) {
            const items = lines.map((l) => l.replace(circled, '').trim()).filter(Boolean);
            return '<ol class="toc-expanded-ol">' + items.map((t) => `<li class="toc-expanded-li">${this.applyInlineBold(t)}</li>`).join('') + '</ol>';
        }
        const allNumDot = lines.length > 0 && lines.every((l) => numDot.test(l));
        if (allNumDot) {
            const items = lines.map((l) => l.replace(numDot, '').trim()).filter(Boolean);
            return '<ol class="toc-expanded-ol">' + items.map((t) => `<li class="toc-expanded-li">${this.applyInlineBold(t)}</li>`).join('') + '</ol>';
        }
        const allBullet = lines.length > 0 && lines.every((l) => bullet.test(l));
        if (!allBullet) return '';
        const items = lines.map((l) => l.replace(bullet, '').trim()).filter(Boolean);
        return '<ul class="toc-expanded-ul">' + items.map((t) => `<li class="toc-expanded-li">${this.applyInlineBold(t)}</li>`).join('') + '</ul>';
    }

    formatHistoryParagraphBlock(block, blockIndex, leadLen) {
        const paraHtml = this.applyInlineBold(block.replace(/\n/g, '<br>'));
        if (blockIndex !== 0 || leadLen <= 0) return `<p class="toc-expanded-p">${paraHtml}</p>`;
        const lead = block.slice(0, leadLen);
        const rest = block.slice(leadLen);
        if (lead.includes('\n') || rest.includes('\n')) return `<p class="toc-expanded-p">${paraHtml}</p>`;
        return `<p class="toc-expanded-p toc-content-lead-wrap"><strong class="toc-content-lead">${this.applyInlineBold(lead)}</strong>${this.applyInlineBold(rest).replace(/\n/g, '<br>')}</p>`;
    }

    formatHistoryBlock(block, blockIndex, leadLen) {
        const codeHtml = this.formatHistoryCodeBlock(block);
        if (codeHtml) return codeHtml;
        const headingHtml = this.formatHistoryHeadingBlock(block);
        if (headingHtml) return headingHtml;
        const lines = block.split(/\n/).map((l) => l.trim()).filter(Boolean);
        const listHtml = this.formatHistoryListBlock(lines);
        if (listHtml) return listHtml;
        return this.formatHistoryParagraphBlock(block, blockIndex, leadLen);
    }

    formatContentAsTocHtml(content) {
        if (!content || !content.trim()) return '<p class="toc-expanded-p toc-content-lead-wrap">无内容</p>';
        const leadLen = this.findLeadLength(content);
        const rawBlocks = this.getHistoryContentBlocks(content);
        if (rawBlocks.length === 0) return '<p class="toc-expanded-p toc-content-lead-wrap">无内容</p>';
        return rawBlocks.map((block, index) => this.formatHistoryBlock(block, index, leadLen)).join('');
    }

    applyInlineBold(text) {
        if (!text || !text.includes('**')) return this.escapeHtml(text);
        const parts = text.split(/\*\*/);
        return parts.map((p, i) => (i % 2 === 1 ? '<strong class="toc-expanded-strong">' + this.escapeHtml(p) + '</strong>' : this.escapeHtml(p))).join('');
    }

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

    async editConversationTitle(conversationId, _cardEl) {
        try {
            if (this.exportState.active) return;
            const conv = await window.storageManager.getConversation(conversationId);
            const currentTitle = conv.title || this._t('conv.defaultTitle');

            const newTitle = await new Promise((resolve) => {
                const overlay = this.createDialog(this._t('dialog.editConvTitle'), this._t('dialog.editConvTitlePlaceholder'), (value) => resolve(value), currentTitle, () => resolve(null));
                (this.sidebar.container || this.shadowRoot).appendChild(overlay);
            });

            if (newTitle == null) return;

            const trimmed = (newTitle.trim() || this._t('conv.defaultTitle'));
            if (trimmed === (currentTitle || '').trim()) return;
            conv.title = trimmed;
            await window.storageManager.saveConversation(conversationId, conv);

            const list = await window.storageManager.getConversationList();
            const idx = list.findIndex((item) => item.id === conversationId);
            if (idx >= 0) {
                list[idx] = { ...list[idx], title: trimmed };
                await window.storageManager.saveConversationList(list);
            }

            this.renderConversationsList();
            if (this.viewingConversationId === conversationId && this.historyDetailConvId === conversationId) {
                const titleEl = this.shadowRoot.querySelector('.conv-detail-title');
                if (titleEl) titleEl.textContent = trimmed;
            }
        } catch (e) {
            this.log('editConversationTitle error:', e);
        }
    }

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

    wrapLeadBoldInHtml(html, leadLen) {
        if (!html || leadLen <= 0) return html;
        const div = document.createElement('div');
        div.innerHTML = html;
        let count = 0;
        const walker = document.createTreeWalker(div, NodeFilter.SHOW_TEXT, null, false);
        const nodesToWrap = [];
        while (walker.nextNode()) {
            const node = walker.currentNode;
            const len = node.textContent.length;
            if (count >= leadLen) break;
            if (count + len <= leadLen) {
                nodesToWrap.push({ node, full: true });
                count += len;
            } else {
                nodesToWrap.push({ node, full: false, splitAt: leadLen - count });
                break;
            }
        }

        for (const { node, full, splitAt } of nodesToWrap) {
            const parent = node.parentNode;
            if (!parent) continue;

            const strong = document.createElement('strong');
            strong.className = 'toc-content-lead';

            if (full) {
                parent.insertBefore(strong, node);
                strong.appendChild(node);
            } else {
                node.splitText(splitAt);
                parent.insertBefore(strong, node);
                strong.appendChild(node);
            }
        }

        return div.innerHTML;
    }

    applyHighlightToTextContentOnly(html, keyword) {
        if (!keyword || !html) return html;
        const escapedKw = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        let regex;
        try {
            regex = new RegExp(escapedKw, 'gi');
        } catch {
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

    getConversationDetailElements() {
        return { listContainer: this.shadowRoot.getElementById('conversations-list-container'), detailContainer: this.shadowRoot.getElementById('conversation-detail-container'), headerEl: this.shadowRoot.getElementById('conv-detail-header'), messagesEl: this.shadowRoot.getElementById('conv-detail-messages'), btnOpen: this.shadowRoot.getElementById('btn-open-conv'), btnBack: this.shadowRoot.getElementById('btn-conv-back') };
    }

    setupConversationDetailLayout(conversationId, listContainer, detailContainer) {
        this.viewingConversationId = conversationId; listContainer.style.display = 'none'; detailContainer.style.display = 'flex';
    }

    setupConversationDetailSearchInput() {
        const listSearchWrapEl = this.shadowRoot.getElementById('conversations-search-and-filter-wrap');
        const convSearchInputEl = this.shadowRoot.getElementById('conversations-search-input');
        const convDetailSearchEl = this.shadowRoot.getElementById('conv-detail-search-input');
        const btnConvFilterEl = this.shadowRoot.getElementById('btn-conversations-filter');
        const convFilterPanelEl = this.shadowRoot.getElementById('conversations-filter-panel');
        if (listSearchWrapEl) listSearchWrapEl.style.display = 'none'; if (btnConvFilterEl) btnConvFilterEl.style.display = 'none'; if (convFilterPanelEl) convFilterPanelEl.style.display = 'none';
        if (!convDetailSearchEl) return null;
        convDetailSearchEl.placeholder = this._t('filter.search.currentConv');
        if (convSearchInputEl && convSearchInputEl.value.trim()) convDetailSearchEl.value = convSearchInputEl.value.trim();
        convDetailSearchEl.oninput = () => this.handleHistoryDetailSearch(convDetailSearchEl.value.trim());
        return convDetailSearchEl;
    }

    renderConversationDetailHeader(headerEl, conversationId, convData) {
        headerEl.innerHTML = '<div class="conv-detail-header-inner">' + '<div class="conv-detail-title conv-detail-title-editable" title="' + this._t('conv.editTitleHint') + '">' + this.escapeHtml(convData.title || this._t('conv.defaultTitle')) + '</div>' + '</div>';
        headerEl.querySelector('.conv-detail-title')?.addEventListener('dblclick', () => this.editConversationTitle(conversationId, null));
    }

    renderConversationDetailMessages(messagesEl, messages, convDetailSearchEl) {
        if (!messages || messages.length === 0) { messagesEl.innerHTML = '<div class="empty-state">' + this._t('empty.noMessages') + '</div>'; return; }
        const initialKeyword = convDetailSearchEl ? convDetailSearchEl.value.trim() : '';
        this.handleHistoryDetailSearch(initialKeyword || null);
    }

    bindConversationDetailOpenButton(btnOpen, convData, conversationId) {
        btnOpen.onclick = () => { const url = this.getConversationOpenUrl(convData.platform || 'ChatGPT', conversationId, convData.link); if (url) window.open(url, '_blank'); };
    }

    async renderConversationDetailInToc(conversationId) {
        if (this.exportState.active && this.exportState.scope === 'history') {
            this.sidebar.exitExportMode();
        }
        const { listContainer, detailContainer, headerEl, messagesEl, btnOpen, btnBack } = this.getConversationDetailElements();

        if (!listContainer || !detailContainer) return;

        this.setupConversationDetailLayout(conversationId, listContainer, detailContainer);
        const convDetailSearchEl = this.setupConversationDetailSearchInput();

        try {
            const convData = await window.storageManager.getConversation(conversationId);
            const messages = convData.messages || [];
            this.historyDetailMessages = messages;
            this.historyDetailConvId = conversationId;
            this.historyDetailConvData = convData;

            this.updateOpenInPlatformButtonText(convData.platform || 'ChatGPT');

            this.renderConversationDetailHeader(headerEl, conversationId, convData);
            this.renderConversationDetailMessages(messagesEl, messages, convDetailSearchEl);

            this.bindConvDetailFilters(conversationId, convDetailSearchEl);
            this.bindConversationDetailOpenButton(btnOpen, convData, conversationId);

        } catch {
            headerEl.textContent = this._t('conv.loadFailed');
            messagesEl.innerHTML = '';
        }

        btnBack.onclick = () => this.renderConversationsList();
        this.restoreMsgSearchOverlayForTab('conversations');
    }

    bindConvDetailFilters(conversationId, convSearchInputEl) {
        const filtersEl = this.shadowRoot.getElementById('conv-detail-filters');
        if (!filtersEl) return;

        filtersEl.querySelectorAll('.toc-filter-btn').forEach((btn) => {
            const fresh = btn.cloneNode(true);
            fresh.classList.remove('active');
            const role = fresh.getAttribute('data-filter-role');
            const isFav = fresh.getAttribute('data-filter-favorite') === 'true';
            if (role && (this.sidebar.tocFilterRole || 'all') === role) fresh.classList.add('active');
            if (isFav && this.sidebar.tocFilterFavorite) fresh.classList.add('active');
            btn.replaceWith(fresh);
        });

        filtersEl.querySelectorAll('.toc-filter-btn').forEach((btn) => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                if (btn.id === 'conv-detail-add-to-project') {
                    // this.showAddToProjectDialog(conversationId);
                    return;
                }
                const role = btn.getAttribute('data-filter-role');
                const isFav = btn.getAttribute('data-filter-favorite') === 'true';
                if (role) {
                    this.sidebar.tocFilterRole = role;
                    filtersEl.querySelectorAll('[data-filter-role]').forEach((b) => b.classList.toggle('active', b.getAttribute('data-filter-role') === role));
                    filtersEl.querySelector('[data-filter-favorite="true"]')?.classList.remove('active');
                } else if (isFav) {
                    this.sidebar.tocFilterFavorite = !this.sidebar.tocFilterFavorite;
                    btn.classList.toggle('active', this.sidebar.tocFilterFavorite);
                }
                const kw = convSearchInputEl ? convSearchInputEl.value.trim() : '';
                this.handleHistoryDetailSearch(kw || null);
            });
        });
    }

    handleHistoryDetailSearch(keyword) {
        const messagesEl = this.shadowRoot.getElementById('conv-detail-messages');
        if (!messagesEl || !this.historyDetailMessages || !this.historyDetailMessages.length) return;

        const kw = (keyword || '').trim();
        const favIds = new Set((this.historyDetailConvData?.favoriteMessageIds || []));
        const messages = this.historyDetailMessages
            .map((m, i) => ({ ...m, _index: i }))
            .filter((m) => {
                if (this.sidebar.tocFilterRole && this.sidebar.tocFilterRole !== 'all' && m.role !== this.sidebar.tocFilterRole) return false;
                if (this.sidebar.tocFilterFavorite && !favIds.has(`msg_${m._index}`)) return false;
                return true;
            });

        // Helper within helper
        const buildMessageHtml = (msg) => {
            const html = (msg.contentHtml != null && msg.contentHtml !== '') ? msg.contentHtml : this.formatHistoryContent(msg.content || '');
            return this.applyHighlightToTextContentOnly(html, kw);
        };

        if (messages.length === 0) {
            messagesEl.innerHTML = '<div class="empty-state"><div class="empty-state-text">' + this._t('empty.noFilterMessages') + '</div></div>';
            return;
        }

        const html = '<ul class="toc-list conv-detail-toc-list">' +
            messages.map((m) => this.buildHistoryDetailMessageItemHtml(m, kw, favIds, buildMessageHtml)).join('') +
            '</ul>';

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

    buildHistoryDetailMessageItemHtml(message, keyword, favIds, buildMessageHtml) {
        const index = message._index;
        const isUser = message.role === 'user';
        const roleLabel = isUser ? this._t('role.user') : this._t('role.assistant');
        const roleIcon = isUser ? this.getIcon('user') : this.getIcon('bot');
        const roleAttr = isUser ? 'user' : 'assistant';
        const content = message.content || '';
        const num = index + 1;
        const hasLongContent = content.length > this.findPreviewBreakpoint(content);
        const fullContentHtml = buildMessageHtml(message);
        const msgId = `hist_msg_${index}`;
        const isFav = favIds.has(`msg_${index}`);
        const matchCount = keyword ? this.countKeywordOccurrences(content, keyword) : 0;
        const hasMatch = matchCount > 0;
        const matchLabel = hasMatch ? this._t('search.matchCount', { n: String(matchCount) }) : '';
        const expandText = this._t('toc.expand'); const expandIcon = this.getIcon('chevronDown');

        return '<li class="toc-item' + (hasMatch ? ' has-match-badge' : '') + '" data-role="' + roleAttr + '" data-message-id="' + msgId + '" data-expanded="false" data-hist-index="' + index + '">' +
            '<div class="toc-item-main">' +
            '<div class="toc-index" title="' + this.escapeHtml(roleLabel) + '">#' + num + '</div>' +
            '<div class="toc-meta"><span class="toc-role-icon" aria-hidden="true">' + roleIcon + '</span>' + this.escapeHtml(roleLabel) + '</div>' +
            '<div class="toc-content-wrapper">' +
            (hasLongContent
                ? '<div class="toc-content-collapsible" aria-expanded="false"><div class="toc-content-full">' + fullContentHtml + '</div><div class="toc-preview-fade" aria-hidden="true"></div></div><div class="toc-expand-btn-row"><button type="button" class="toc-expand-text-btn" data-action="expand" aria-label="' + this.escapeHtml(expandText) + '"><span class="toc-expand-text">' + expandText + '</span><span class="toc-expand-icon toc-expand-icon-svg" aria-hidden="true">' + expandIcon + '</span></button></div>'
                : '<div class="toc-content-full toc-content-full-standalone">' + fullContentHtml + '</div>') +
            '</div>' +
            '</div>' +
            '<div class="toc-item-actions">' +
            (hasLongContent ? '<button type="button" class="toc-action-btn toc-collapse-btn" title="' + this._t('toc.collapse') + '" aria-label="' + this._t('toc.collapse') + '" data-action="expand">' + this.getIcon('chevronUp') + '</button>' : '') +
            '<button type="button" class="toc-action-btn" title="' + this._t('toc.copy') + '" aria-label="' + this._t('toc.copy') + '" data-action="copy" data-content="' + this.escapeHtml(content) + '">' + this.getIcon('copy') + '</button>' +
            '<button type="button" class="toc-action-btn toc-action-fav" title="' + this._t('toc.favorite') + '" aria-label="' + this._t('toc.favorite') + '" data-action="favorite" data-fav="' + (isFav ? '1' : '0') + '">' + (isFav ? this.getIcon('star') : this.getIcon('starOutline')) + '</button>' +
            '</div>' +
            (hasMatch ? '<span class="toc-match-badge">' + this.escapeHtml(matchLabel) + '</span>' : '') +
            '</li>';
    }

    resolveSnapshotTitle(firstUserContent) {
        const pageTitle = window.platformAdapter && window.platformAdapter.getConversationTitleFromPage && window.platformAdapter.getConversationTitleFromPage();
        if (pageTitle && pageTitle.trim()) return pageTitle.trim();
        if (this.sidebar.tocMod) return window.tocManager.generateTitle(firstUserContent);
        return this._t('conv.defaultTitle');
    }

    buildSnapshotMessageData(message) {
        const content = message.content || '';
        let contentHtml = null;
        if (message.element) {
            try {
                const html = this.extractMessageHTMLForDisplay(message.element);
                if (html && html.trim()) contentHtml = this.wrapLeadBoldInHtml(html, this.findLeadLength(content));
            } catch (e) {
                this.log('saveSnapshot contentHtml error:', e);
            }
        }
        return { role: message.role, content, contentHtml };
    }

    async upsertConversationListEntry(entry) {
        let list = await window.storageManager.getConversationList();
        const existing = list.findIndex(item => item.id === entry.id);
        if (existing >= 0) list[existing] = entry;
        else list.unshift(entry);
        list.sort((a, b) => (b.lastSeenAt || 0) - (a.lastSeenAt || 0));
        list = list.slice(0, 100);
        await window.storageManager.saveConversationList(list);
    }

    async saveCurrentConversationSnapshot() {
        if (!this.sidebar.conversationId || !this.sidebar.messages || this.sidebar.messages.length === 0) return;
        try {
            const platform = window.platformAdapter ? window.platformAdapter.getPlatformName() : 'Unknown';
            const firstUserContent = (this.sidebar.messages.find(m => m.role === 'user') || {}).content || '';
            const title = this.resolveSnapshotTitle(firstUserContent);
            const snippet = firstUserContent.replace(/\s+/g, ' ').trim().slice(0, 80);
            const messageCount = this.sidebar.messages.length;
            const lastSeenAt = Date.now();

            const messagesData = this.sidebar.messages.map((message) => this.buildSnapshotMessageData(message));
            const convData = await window.storageManager.getConversation(this.sidebar.conversationId);
            convData.favoriteMessageIds = convData.favoriteMessageIds || [];
            const link = typeof window !== 'undefined' && window.location && window.location.href ? window.location.href : '';
            Object.assign(convData, { title, snippet, messageCount, lastSeenAt, messages: messagesData, platform, link });
            await window.storageManager.saveConversation(this.sidebar.conversationId, convData);
            const entry = { id: this.sidebar.conversationId, title, snippet, messageCount, lastSeenAt, platform, link };
            await this.upsertConversationListEntry(entry);
        } catch (e) { this.log('saveCurrentConversationSnapshot error:', e); }
    }
    async silentDeleteConversation(conversationId) {
        try {
            let list = await window.storageManager.getConversationList();
            list = list.filter(item => item.id !== conversationId);
            await window.storageManager.saveConversationList(list);

            await window.projectManager.removeFromAutoProject(conversationId);
            const myProjects = window.projectManager.getMyProjects();
            for (const [projectId, project] of Object.entries(myProjects)) {
                if ((project.conversations || []).includes(conversationId)) {
                    await window.projectManager.removeFromMyProject(conversationId, projectId);
                }
            }

            await window.storageManager.deleteConversation(conversationId);

            if (this.viewingConversationId === conversationId) {
                this.viewingConversationId = null;
            }
            this.renderConversationsList();
        } catch (e) {
            this.log('Silent delete error:', e);
        }
    }

}

// 全局注册
window.SidebarConversations = SidebarConversations;
