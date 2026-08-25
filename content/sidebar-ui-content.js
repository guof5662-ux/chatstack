/**
 * SidebarUI 内容与工具方法拆分
 */
class SidebarUIContentMethods {

  renderTOC(searchKeyword) {
    if (this.tocMod) {
      this.tocMod.renderTOC(searchKeyword);
    }
  }

  /** 根据当前或指定平台更新「在 X 中打开」按钮文案 */
  updateOpenInPlatformButtonText(platformName) {
    const btn = this.shadowRoot.getElementById('btn-open-conv');
    if (!btn) return;
    const name = (platformName || '').trim() || 'ChatGPT';
    btn.textContent = this._t('action.openInPlatform', { platform: name });
  }

  updateTocFilterButtons() {
    if (this.tocMod) this.tocMod.updateFilterButtons();
  }



  countKeywordOccurrences(text, keyword) {
    return this.tocMod ? this.tocMod.countKeywordOccurrences(text, keyword) : 0;
  }



  /** TOC 展开/收起：委托 tocMod 切换 data-expanded、collapsible 样式与按钮文案 */
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
      } catch {
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


  /**
   * 渲染会话列表
   */
  async renderConversationsList() {
    if (this.conversationsModule) {
      return this.conversationsModule.renderConversationsList();
    }
  }

  /**
   * 渲染项目列表
   */
  async renderProjects() {
    if (this.projectsModule) {
      return this.projectsModule.renderProjects();
    }
  }

  /**
   * 渲染项目内会话消息
   */
  async renderProjectConversationMessages(...args) {
    if (this.projectsModule) {
      return this.projectsModule.renderProjectConversationMessages(...args);
    }
  }

  /**
   * 绑定项目相关事件
   */
  bindProjectConvDetailFilters(...args) {
    if (this.projectsModule && this.projectsModule.bindProjectConvDetailFilters) {
      this.projectsModule.bindProjectConvDetailFilters(...args);
    }
  }

  handleProjectDetailSearch(...args) {
    if (this.projectsModule && this.projectsModule.handleProjectDetailSearch) {
      this.projectsModule.handleProjectDetailSearch(...args);
    }
  }

  /**
   * 渲染会话详情到TOC区域
   */
  async renderConversationDetailInToc(conversationId) {
    if (this.conversationsModule) {
      return this.conversationsModule.renderConversationDetailInToc(conversationId);
    }
  }

  async saveCurrentConversationSnapshot() {
    if (this.conversationsModule) {
      return this.conversationsModule.saveCurrentConversationSnapshot();
    }
  }

  async silentDeleteConversation(conversationId) {
    if (this.conversationsModule && this.conversationsModule.silentDeleteConversation) {
      return this.conversationsModule.silentDeleteConversation(conversationId);
    }
  }

  async copyTextToClipboard(text) {
    if (this.conversationsModule) {
      return this.conversationsModule.copyTextToClipboard(text);
    }
    // Fallback logic if module not loaded
    try {
      await navigator.clipboard.writeText(text);
      this.showToast(this._t('toast.copied'));
    } catch (e) {
      this.log('Copy failed:', e);
      this.showToast(this._t('toast.copyFailed'));
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

  updatePlatformProjectMapping() {
    if (this.dataModule) this.dataModule.updatePlatformProjectMapping();
  }

  // 兼容旧方法名
  updateChatGPTProjectMapping() {
    if (this.dataModule) this.dataModule.updatePlatformProjectMapping();
  }

  /**
   * 全局刷新插件：同步项目映射并按当前标签重绘内容，无需刷新页面
   */
  refreshSidebar() {
    if (this.dataModule) this.dataModule.refreshSidebar();
  }

  runUpdatePlatformProjectMappingIfSameConversation() {
    if (this.dataModule) this.dataModule.runUpdatePlatformProjectMappingIfSameConversation();
  }

  // Legacy method proxy
  runUpdateChatGPTProjectMappingIfSameConversation() {
    this.runUpdatePlatformProjectMappingIfSameConversation();
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
      } catch {
        map[id] = unnamed;
      }
    }
    return map;
  }

  /**
   * 渲染项目列表（可展开、对话列表、移除/移动）
   */


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

  splitConversationListByCutoff(list, cutoffTime) {
    const toRemove = [];
    const toKeep = [];
    for (const item of list) {
      const timestamp = item.lastSeenAt || 0;
      if (timestamp < cutoffTime) toRemove.push(item);
      else toKeep.push(item);
    }
    return { toRemove, toKeep };
  }

  async removeConversationDataKeys(removeIds) {
    const keysToRemove = removeIds.map((id) => `conv_${id}`);
    if (keysToRemove.length > 0) {
      await window.storageManager.remove(keysToRemove);
    }
  }

  pruneProjectConversationRefs(projectGroup, removeIdSet) {
    if (!projectGroup) return;
    for (const key in projectGroup) {
      const project = projectGroup[key];
      if (!project || !Array.isArray(project.conversations)) continue;
      project.conversations = project.conversations.filter((id) => !removeIdSet.has(id));
    }
  }

  async cleanupProjectConversationRefs(removeIds) {
    if (!window.projectManager || !window.projectManager.projects) return;
    const projects = window.projectManager.projects;
    const removeIdSet = new Set(removeIds);
    this.pruneProjectConversationRefs(projects.auto, removeIdSet);
    this.pruneProjectConversationRefs(projects.my, removeIdSet);
    await window.projectManager.save();
  }

  async finalizeClearHistory(toRemoveCount, rangeLabel) {
    this.renderConversationsList();
    this.renderProjects();
    this.showToast(this._t('toast.historyCleared', { count: String(toRemoveCount) }));
    this.log(`Cleared ${toRemoveCount} conversations (${rangeLabel})`);
  }

  /**
   * 清空历史数据 - 清除指定时间范围外的对话
   * @param {number} days - 保留天数（Infinity 表示全部删除）
   * @param {string} rangeLabel - 时间范围标签（用于确认对话框）
   */
  async clearHistoryData(days, rangeLabel) {
    try {
      const cutoffTime = days === Infinity ? Infinity : Date.now() - days * 24 * 60 * 60 * 1000;

      // 获取对话列表
      const list = await window.storageManager.getConversationList();
      if (!list || list.length === 0) {
        this.showToast(this._t('toast.noOldHistory'));
        return;
      }

      // 分类：需删除和保留
      const { toRemove, toKeep } = this.splitConversationListByCutoff(list, cutoffTime);

      // 若无符合条件的对话，直接提示
      if (toRemove.length === 0) {
        this.showToast(this._t('toast.noOldHistory'));
        return;
      }

      // 确认对话框
      const message = this._t('confirm.clearHistory.message', {
        count: String(toRemove.length),
        range: rangeLabel
      });
      const ok = await this.showConfirmDialog(
        this._t('confirm.clearHistory.title'),
        message
      );
      if (!ok) return;

      // 执行删除：conversationList + conv_<id> key + projects 中的引用
      await window.storageManager.saveConversationList(toKeep);

      const removeIds = toRemove.map(item => item.id);
      await this.removeConversationDataKeys(removeIds);
      await this.cleanupProjectConversationRefs(removeIds);
      await this.finalizeClearHistory(toRemove.length, rangeLabel);
    } catch (error) {
      this.log('Clear history error:', error);
      this.showToast('清空历史失败');
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
    const previousActive = document.activeElement;
    const overlay = document.createElement('div');
    overlay.className = 'dialog-overlay';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');

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
    const cancelBtn = dialog.querySelector('#dialog-cancel');
    const confirmBtn = dialog.querySelector('#dialog-confirm');
    const focusables = [inputEl, cancelBtn, confirmBtn];
    if (defaultValue) inputEl.value = defaultValue;
    inputEl.focus();
    inputEl.select();

    const remove = () => {
      overlay.remove();
      if (previousActive && typeof previousActive.focus === 'function') previousActive.focus();
    };

    cancelBtn.addEventListener('click', () => {
      if (onCancel) onCancel();
      remove();
    });

    const doConfirm = () => {
      const value = inputEl.value;
      remove();
      onConfirm(value);
    };

    confirmBtn.addEventListener('click', doConfirm);

    inputEl.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') doConfirm();
    });

    overlay.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        if (onCancel) onCancel();
        remove();
        return;
      }
      if (e.key !== 'Tab') return;
      const idx = focusables.indexOf(document.activeElement);
      if (idx === -1) return;
      e.preventDefault();
      const next = e.shiftKey ? (idx - 1 + focusables.length) % focusables.length : (idx + 1) % focusables.length;
      focusables[next].focus();
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
      const previousActive = document.activeElement;
      const overlay = document.createElement('div');
      overlay.className = 'dialog-overlay';
      overlay.setAttribute('role', 'dialog');
      overlay.setAttribute('aria-modal', 'true');

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

      const cancelBtn = dialog.querySelector('#dialog-cancel');
      const confirmBtn = dialog.querySelector('#dialog-confirm');
      const focusables = [cancelBtn, confirmBtn];

      const close = (result) => {
        overlay.remove();
        resolve(result);
        if (previousActive && typeof previousActive.focus === 'function') previousActive.focus();
      };

      cancelBtn.addEventListener('click', () => close(false));
      confirmBtn.addEventListener('click', () => close(true));

      overlay.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
          e.preventDefault();
          close(false);
          return;
        }
        if (e.key !== 'Tab') return;
        const idx = focusables.indexOf(document.activeElement);
        if (idx === -1) return;
        e.preventDefault();
        const next = e.shiftKey ? (idx - 1 + focusables.length) % focusables.length : (idx + 1) % focusables.length;
        focusables[next].focus();
      });

      cancelBtn.focus();
    });
  }

  /**
   * 计算「标题导引」加粗长度：取第一句或前若干字
   */


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

(function (global) {
  const SidebarUIClass = global.SidebarUI || null;
  if (!SidebarUIClass) return;
  const proto = SidebarUIContentMethods.prototype;
  Object.getOwnPropertyNames(proto).forEach((name) => {
    if (name === "constructor") return;
    SidebarUIClass.prototype[name] = proto[name];
  });
})(typeof globalThis !== "undefined" ? globalThis : window);
