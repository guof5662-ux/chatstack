/**
 * SidebarProjects 详情方法拆分
 */
class SidebarProjectsDetailMethods {

    findProjectItemForViewState(state) {
        if (!state) return null;
        const myList = this.shadowRoot.getElementById('my-projects-list');
        const containers = [myList].filter(Boolean);
        for (const container of containers) {
            const found = Array.from(container.querySelectorAll('.project-item')).find(
                (el) => el.getAttribute('data-project-type') === state.projectType && el.getAttribute('data-project-key') === state.projectKey
            );
            if (found) return found;
        }
        return null;
    }

    showRestoredProjectDetail(item, listView, detailView, state) {
        item.classList.add('expanded');
        listView.style.display = 'none';
        detailView.style.display = 'block';
        detailView.setAttribute('data-conversation-id', state.conversationId);
        item.classList.add('project-item--showing-detail');
    }

    setupRestoredProjectDetailTitle(item, detailView, state) {
        const titleEl = detailView.querySelector('.project-conv-detail-title');
        if (!titleEl) return;
        titleEl.textContent = state.conversationTitle || this._t('conv.defaultTitle');
        const card = item.querySelector(`.conv-card[data-conversation-id="${state.conversationId}"]`);
        this.bindProjectDetailTitleEdit(titleEl, state.conversationId, card || null);
    }

    setupRestoredProjectSearchUI(detailView, state) {
        const listSearchWrapEl = this.shadowRoot.getElementById('projects-search-and-filter-wrap');
        const detailSearchEl = detailView.querySelector('.project-conv-detail-search-input');
        const btnProjFilterEl = this.shadowRoot.getElementById('btn-projects-filter');
        const projFilterPanelEl = this.shadowRoot.getElementById('projects-filter-panel');
        if (listSearchWrapEl) listSearchWrapEl.style.display = 'none';
        if (btnProjFilterEl) btnProjFilterEl.style.display = 'none';
        if (projFilterPanelEl) projFilterPanelEl.style.display = 'none';
        if (!detailSearchEl) return null;
        detailSearchEl.placeholder = this._t('filter.search.currentConv');
        if ((state.searchKeyword || '').trim()) detailSearchEl.value = (state.searchKeyword || '').trim();
        return detailSearchEl;
    }

    restoreProjectsPanelScroll() {
        if (this._savedProjectsPanelScrollTop == null) return;
        const projectsPanel = this.shadowRoot?.querySelector('.tab-panel[data-panel="projects"]');
        if (!projectsPanel) return;
        const toRestore = this._savedProjectsPanelScrollTop;
        this._savedProjectsPanelScrollTop = null;
        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                projectsPanel.scrollTop = toRestore;
            });
        });
    }

    async restoreProjectsViewState() {
        const s = this.projectsViewState;
        if (!s || s.level !== 'conversation' || !s.conversationId || !s.projectType || !s.projectKey) return;

        const item = this.findProjectItemForViewState(s);
        if (!item) return;
        const listView = item.querySelector('.project-conv-list-view');
        const detailView = item.querySelector('.project-conv-detail-view');
        if (!listView || !detailView) return;

        this.showRestoredProjectDetail(item, listView, detailView, s);
        this.setupRestoredProjectDetailTitle(item, detailView, s);
        const messagesEl = detailView.querySelector('.project-conv-detail-messages');
        if (!messagesEl) return;
        const detailSearchEl = this.setupRestoredProjectSearchUI(detailView, s);

        await this.renderProjectConversationMessages(s.conversationId, messagesEl, (s.searchKeyword || '').trim() || undefined);
        this.bindProjectConvDetailFilters(detailView, s.conversationId, detailSearchEl);
        this.restoreProjectsPanelScroll();
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

    applyInlineBold(text) {
        if (!text || !text.includes('**')) return this.escapeHtml(text);
        const parts = text.split(/\*\*/);
        return parts.map((p, i) => (i % 2 === 1 ? '<strong class="toc-expanded-strong">' + this.escapeHtml(p) + '</strong>' : this.escapeHtml(p))).join('');
    }

    formatContentAsTocHtml(content) {
        if (!content || !content.trim()) return '<p class="toc-expanded-p toc-content-lead-wrap">无内容</p>';
        const leadLen = this.findLeadLength(content);
        const rawBlocks = content.split(/\n\n+/).map((b) => b.trim()).filter(Boolean);
        if (rawBlocks.length === 0) return '<p class="toc-expanded-p toc-content-lead-wrap">无内容</p>';

        const out = [];
        for (let i = 0; i < rawBlocks.length; i++) {
            const block = rawBlocks[i];
            // Simplified formatting for brevity, can expand if needed to match full logic
            // But let's try to match the full logic as it handles lists etc nicely
            // Code block check
            const codeBlockMatch = block.match(/^```(?:\w+)?\s*\n?([\s\S]*?)```\s*$/);
            if (codeBlockMatch) {
                const codeContent = (codeBlockMatch[1] || '').trim();
                out.push('<pre class="toc-expanded-pre"><code class="toc-expanded-code">' + this.escapeHtml(codeContent) + '</code></pre>');
                continue;
            }

            // Headers
            const h2Match = block.match(/^##\s+(.+)$/s);
            if (h2Match) { out.push(`<h2 class="toc-expanded-h2">${this.applyInlineBold(h2Match[1].trim())}</h2>`); continue; }
            const h3Match = block.match(/^###\s+(.+)$/s);
            if (h3Match) { out.push(`<h3 class="toc-expanded-h3">${this.applyInlineBold(h3Match[1].trim())}</h3>`); continue; }

            // Lists checks omitted for brevity unless critical - they are good for detail view
            // Just standard paragraph handling for now
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

    formatHistoryContent(content) {
        if (!content || !content.trim()) return '<p class="toc-expanded-p toc-content-lead-wrap">无内容</p>';
        return this.formatContentAsTocHtml(content);
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

    // --- Missing View Methods ---

    setProjectDetailState(conversationId, containerElement, convData, messages) {
        this.projectsDetailMessages = messages;
        this.projectsDetailMessagesEl = containerElement;
        this.projectsDetailConvId = conversationId;
        this.projectsDetailConvData = convData;
    }

    getProjectDetailFilteredMessages(messages, favIds) {
        return messages
            .map((m, i) => ({ ...m, _index: i }))
            .filter((m) => {
                if (this.tocFilterRole && this.tocFilterRole !== 'all' && m.role !== this.tocFilterRole) return false;
                if (this.tocFilterFavorite && !favIds.has(`msg_${m._index}`)) return false;
                return true;
            });
    }

    buildProjectDetailMessageItemHtml(message, favIds, keyword) {
        const index = message._index;
        const isUser = message.role === 'user';
        const roleLabel = isUser ? this._t('role.user') : this._t('role.assistant');
        const roleIcon = isUser ? this.getIcon('user') : this.getIcon('bot');
        const roleAttr = isUser ? 'user' : 'assistant';
        const content = message.content || '';
        const num = index + 1;
        const previewBreakpoint = this.findPreviewBreakpoint(content);
        const hasLongContent = content.length > previewBreakpoint;
        const rawHtml = (message.contentHtml != null && message.contentHtml !== '') ? message.contentHtml : this.formatHistoryContent(content);
        const fullContentHtml = this.applyHighlightToTextContentOnly(rawHtml, keyword);
        const safeContent = this.escapeHtml(content);
        const isFav = favIds.has(`msg_${index}`);
        const expandText = this._t('toc.expand');
        const expandIcon = this.getIcon('chevronDown');
        return `<li class="toc-item" data-role="${roleAttr}" data-message-id="proj_msg_${index}" data-expanded="false" data-proj-index="${index}">
            <div class="toc-item-main">
              <div class="toc-index" title="${this.escapeHtml(roleLabel)}">#${num}</div>
              <div class="toc-meta"><span class="toc-role-icon" aria-hidden="true">${roleIcon}</span>${this.escapeHtml(roleLabel)}</div>
              <div class="toc-content-wrapper">
                ${hasLongContent ? `
                  <div class="toc-content-collapsible" aria-expanded="false">
                    <div class="toc-content-full">${fullContentHtml}</div>
                    <div class="toc-preview-fade" aria-hidden="true"></div>
                  </div>
                  <div class="toc-expand-btn-row">
                    <button type="button" class="toc-expand-text-btn" data-action="expand" aria-label="${this.escapeHtml(expandText)}">
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
              <button type="button" class="toc-action-btn" title="${this.escapeHtml(this._t('toc.copy'))}" aria-label="${this.escapeHtml(this._t('toc.copy'))}" data-action="copy" data-content="${safeContent}">${this.getIcon('copy')}</button>
              <button type="button" class="toc-action-btn toc-action-fav" title="${this.escapeHtml(this._t('toc.favorite'))}" aria-label="${this.escapeHtml(this._t('toc.favorite'))}" data-action="favorite" data-fav="${isFav ? '1' : '0'}">${isFav ? this.getIcon('star') : this.getIcon('starOutline')}</button>
            </div>
          </li>`;
    }

    bindProjectDetailMessageActions(conversationId, containerElement, keyword) {
        containerElement.querySelectorAll('.toc-item').forEach((li) => {
            const projIndex = li.getAttribute('data-proj-index');
            li.querySelectorAll('.toc-action-btn, .toc-expand-text-btn').forEach((btn) => {
                btn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const action = btn.getAttribute('data-action');
                    if (action === 'expand') {
                        this.toggleProjectTocItemExpand(li);
                    } else if (action === 'copy') {
                        const content = btn.getAttribute('data-content') || '';
                        this.copyTextToClipboard(content);
                    } else if (action === 'favorite' && projIndex != null) {
                        this.toggleProjectDetailFavorite(conversationId, parseInt(projIndex, 10)).then(() => {
                            const detailSearchEl = this.shadowRoot.querySelector('.project-conv-detail-search-input');
                            const kw2 = detailSearchEl ? detailSearchEl.value.trim() : keyword;
                            this.renderProjectConversationMessages(conversationId, containerElement, kw2 || undefined);
                        });
                    }
                });
            });
        });
    }

    restoreProjectDetailScroll(containerElement, preserveScroll, prevScrollTop) {
        if (!preserveScroll) return;
        const nextScrollEl = containerElement.querySelector('.conv-detail-toc-list');
        if (!nextScrollEl) return;
        const maxTop = Math.max(0, nextScrollEl.scrollHeight - nextScrollEl.clientHeight);
        nextScrollEl.scrollTop = Math.min(prevScrollTop, maxTop);
    }

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
            this.setProjectDetailState(conversationId, containerElement, convData, messages);

            const favIds = new Set((convData.favoriteMessageIds || []));
            const filtered = this.getProjectDetailFilteredMessages(messages, favIds);

            if (filtered.length === 0) {
                containerElement.innerHTML = '<div class="empty-state"><div class="empty-state-text">' + this._t('empty.noFilterMessages') + '</div></div>';
                return;
            }

            const kw = (searchKeyword || '').trim();
            const html = `<ul class="toc-list conv-detail-toc-list">` +
                filtered.map((m) => this.buildProjectDetailMessageItemHtml(m, favIds, kw)).join('') +
                `</ul>`;
            containerElement.innerHTML = html;
            this.bindProjectDetailMessageActions(conversationId, containerElement, kw);
            this.restoreProjectDetailScroll(containerElement, preserveScroll, prevScrollTop);
            // Accessing sidebar method if available
            if (this.sidebar.tocMod && this.sidebar.tocMod.restoreMsgSearchOverlayForTab) {
                this.sidebar.tocMod.restoreMsgSearchOverlayForTab('projects');
            }
        } catch (e) {
            containerElement.innerHTML = '<div class="empty-state">' + this._t('empty.loadFailed') + '</div>';
            this.log('renderProjectConversationMessages error:', e);
        }
    }

    toggleProjectTocItemExpand(tocItem) {
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

    handleProjectDetailSearch(keyword) {
        if (!this.projectsDetailMessagesEl || !this.projectsDetailMessages || !this.projectsDetailConvId) return;
        this.renderProjectConversationMessages(this.projectsDetailConvId, this.projectsDetailMessagesEl, keyword, { scrollToMatch: false });
    }

    async copyTextToClipboard(text) {
        if (this.sidebar.conversationsModule) {
            return this.sidebar.conversationsModule.copyTextToClipboard(text);
        }
        // Fallback
        try {
            await navigator.clipboard.writeText(text);
            this.showToast(this._t('toast.copied'));
        } catch (e) {
            this.log('Copy failed:', e);
            this.showToast(this._t('toast.copyFailed'));
        }
    }
}

(function (global) {
  const SidebarProjectsClass = global.SidebarProjects || null;
  if (!SidebarProjectsClass) return;
  const proto = SidebarProjectsDetailMethods.prototype;
  Object.getOwnPropertyNames(proto).forEach((name) => {
    if (name === "constructor") return;
    SidebarProjectsClass.prototype[name] = proto[name];
  });
})(typeof globalThis !== "undefined" ? globalThis : window);
