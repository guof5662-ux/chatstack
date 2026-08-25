/**
 * 侧边栏 TOC 与消息内搜索模块
 * 职责：当前会话 TOC 渲染与交互、消息内搜索浮层、消息 HTML 提取与媒体处理
 */
(function (global) {
  class SidebarTOC {
    constructor(sidebar) {
      this.sidebar = sidebar;
      this.filterRole = 'all';
      this.filterFavorite = false;
      this.favorites = new Set();
    }

    get _t() { return (key, params) => this.sidebar._t(key, params); }
    get shadowRoot() { return this.sidebar.shadowRoot; }
    get messages() { return this.sidebar.messages; }
    get exportState() { return this.sidebar.exportState; }

    findPreviewBreakpoint(content) {
      if (!content || content.length <= 150) return content.length;
      const minLength = 100;
      const maxLength = 300;
      const breakpoint = Math.min(200, content.length);
      const doubleNewline = content.indexOf('\n\n', minLength);
      if (doubleNewline > 0 && doubleNewline <= maxLength) return doubleNewline;
      const sentenceEnds = /[。！？\n]/g;
      let match;
      let lastGoodBreak = minLength;
      while ((match = sentenceEnds.exec(content)) !== null) {
        if (match.index >= minLength && match.index <= maxLength) lastGoodBreak = match.index + 1;
        if (match.index > maxLength) break;
      }
      if (lastGoodBreak > minLength) return lastGoodBreak;
      const englishSentenceEnds = /[.!?]\s+/g;
      lastGoodBreak = minLength;
      while ((match = englishSentenceEnds.exec(content)) !== null) {
        if (match.index >= minLength && match.index <= maxLength) lastGoodBreak = match.index + match[0].length;
        if (match.index > maxLength) break;
      }
      if (lastGoodBreak > minLength) return lastGoodBreak;
      return breakpoint;
    }

    countKeywordOccurrences(text, keyword) {
      if (!text || !keyword) return 0;
      const lowerText = text.toLowerCase();
      const lowerKw = keyword.toLowerCase();
      if (!lowerKw) return 0;
      let count = 0;
      let idx = 0;
      while ((idx = lowerText.indexOf(lowerKw, idx)) !== -1) {
        count += 1;
        idx += lowerKw.length;
      }
      return count;
    }

    /** TOC 展开/收起：根据 data-expanded 切换，更新 collapsible 样式、aria-expanded、按钮文案与图标（展开↔收起） */
    toggleTocItemExpand(tocItem, _messageId) {
      if (!tocItem) return;
      const isExpanded = tocItem.getAttribute('data-expanded') === 'true';
      const collapsible = tocItem.querySelector('.toc-content-collapsible');
      const expandBtn = tocItem.querySelector('.toc-expand-text-btn');
      if (!collapsible || !expandBtn) return;
      if (isExpanded) {
        collapsible.classList.remove('toc-content-expanded');
        collapsible.setAttribute('aria-expanded', 'false');
        const fade = collapsible.querySelector('.toc-preview-fade');
        if (fade) fade.style.display = 'block';
        expandBtn.querySelector('.toc-expand-text').textContent = this._t('toc.expand');
        expandBtn.querySelector('.toc-expand-icon').innerHTML = this.sidebar.getIcon('chevronDown');
        tocItem.setAttribute('data-expanded', 'false');
        tocItem.classList.remove('toc-item-expanded');
      } else {
        collapsible.classList.add('toc-content-expanded');
        collapsible.setAttribute('aria-expanded', 'true');
        const fade = collapsible.querySelector('.toc-preview-fade');
        if (fade) fade.style.display = 'none';
        expandBtn.querySelector('.toc-expand-text').textContent = this._t('toc.collapse');
        expandBtn.querySelector('.toc-expand-icon').innerHTML = this.sidebar.getIcon('chevronUp');
        tocItem.setAttribute('data-expanded', 'true');
        tocItem.classList.add('toc-item-expanded');
      }
    }

    extractRemainingHTML(fullHtml, skipChars) {
      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = fullHtml;
      let charCount = 0;
      let found = false;
      const walker = document.createTreeWalker(tempDiv, NodeFilter.SHOW_TEXT);
      while (walker.nextNode()) {
        const textNode = walker.currentNode;
        const text = textNode.textContent || '';
        if (!found && charCount + text.length > skipChars) {
          const offset = skipChars - charCount;
          textNode.textContent = text.slice(offset);
          found = true;
        } else if (!found) {
          charCount += text.length;
          if (textNode.parentNode) textNode.parentNode.removeChild(textNode);
        }
      }
      return tempDiv.innerHTML || '<p class="toc-expanded-empty">' + this._t('toc.noMoreContent') + '</p>';
    }

    highlightInElement(element, keyword) {
      if (!element || typeof element.getElementsByTagName !== 'function') return;
      const k = (keyword || '').trim();
      this.clearHighlightInElement(element);
      if (!k) return;
      const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT, {
        acceptNode(node) {
          if (node.parentNode && (node.parentNode.tagName === 'SCRIPT' || node.parentNode.tagName === 'STYLE')) return NodeFilter.FILTER_REJECT;
          return NodeFilter.FILTER_ACCEPT;
        }
      });
      const toProcess = [];
      let n;
      while ((n = walker.nextNode())) toProcess.push(n);
      const lowerK = k.toLowerCase();
      toProcess.forEach((textNode) => {
        const text = textNode.textContent;
        if (!text || text.toLowerCase().indexOf(lowerK) === -1) return;
        const parent = textNode.parentNode;
        if (!parent) return;
        const frag = document.createDocumentFragment();
        let idx = 0;
        let pos;
        const lowerText = text.toLowerCase();
        while ((pos = lowerText.indexOf(lowerK, idx)) !== -1) {
          frag.appendChild(document.createTextNode(text.slice(idx, pos)));
          const mark = document.createElement('mark');
          mark.className = 'chatgpt-sidebar-msg-highlight';
          mark.textContent = text.slice(pos, pos + k.length);
          frag.appendChild(mark);
          idx = pos + k.length;
        }
        frag.appendChild(document.createTextNode(text.slice(idx)));
        parent.replaceChild(frag, textNode);
      });
    }

    clearHighlightInElement(element) {
      if (!element || typeof element.querySelectorAll !== 'function') return;
      element.querySelectorAll('.chatgpt-sidebar-msg-highlight').forEach((mark) => {
        const text = document.createTextNode(mark.textContent);
        mark.parentNode.replaceChild(text, mark);
      });
      element.normalize();
    }

    resolveMessageElement(messageId) {
      if (!messageId) return null;
      if (messageId.startsWith('hist_msg_') || messageId.startsWith('proj_msg_')) {
        const item = this.shadowRoot.querySelector(`.toc-item[data-message-id="${messageId}"]`);
        if (!item) return null;
        return item.querySelector('.toc-content-full') || item.querySelector('.toc-content-wrapper') || item;
      }
      const el = (window.tocManager && window.tocManager.messageIdToElement && window.tocManager.messageIdToElement[messageId]) || (this.messages.find((m) => m.id === messageId) || {}).element;
      return el && el.isConnected ? el : null;
    }

    scrollHighlightIntoViewCenter(markEl) {
      if (!markEl || typeof markEl.scrollIntoView !== 'function') return;
      markEl.scrollIntoView({ block: 'center', behavior: 'smooth', inline: 'nearest' });
    }

    getMsgSearchExpectedTab(messageId) {
      if (!messageId) return null;
      if (messageId.startsWith('hist_msg_')) return 'conversations';
      if (messageId.startsWith('proj_msg_')) return 'projects';
      return 'toc';
    }

    openMsgSearchOverlay(messageId) {
      this.closeMsgSearchOverlay();
      const tocItem = this.shadowRoot.querySelector(`.toc-item[data-message-id="${messageId}"]`);
      if (!tocItem) { this.sidebar.log('TOC item not found'); return; }
      const element = this.resolveMessageElement(messageId);
      if (!element) { this.sidebar.log('Message element not found'); return; }
      this.sidebar.currentMsgSearchMessageId = messageId;
      this.sidebar.currentMsgSearchElement = element;
      const root = document.createElement('div');
      root.className = 'toc-msg-search-float';
      root.setAttribute('role', 'search');
      root.setAttribute('aria-label', this._t('msgSearch.ariaLabel'));
      root.innerHTML = '<span class="toc-msg-search-float-icon toc-msg-search-float-icon-svg" aria-hidden="true">' + this.sidebar.getIcon('search') + '</span><input type="text" class="toc-msg-search-float-input" placeholder="' + this._t('msgSearch.placeholder') + '"><button type="button" class="toc-msg-search-float-close" title="' + this._t('action.close') + '" aria-label="' + this._t('action.close') + '">' + this.sidebar.getIcon('close') + '</button>';
      const panel = tocItem.closest('.tab-panel') || this.shadowRoot.querySelector('[data-panel="toc"]');
      const nextItem = tocItem.nextElementSibling && tocItem.nextElementSibling.classList.contains('toc-item') ? tocItem.nextElementSibling : null;
      if (panel && nextItem) {
        const panelRect = panel.getBoundingClientRect();
        const itemRect = tocItem.getBoundingClientRect();
        const nextRect = nextItem.getBoundingClientRect();
        const gapMiddle = (itemRect.bottom + nextRect.top) / 2;
        const top = gapMiddle - panelRect.top;
        const maxWidth = Math.max(220, panelRect.width - 32);
        const contentWidth = Math.min(maxWidth, Math.max(200, Math.floor(itemRect.width * 0.82)));
        const left = Math.max(8, Math.floor((panelRect.width - contentWidth) / 2));
        root.style.top = `${top}px`;
        root.style.left = `${left}px`;
        root.style.width = `${contentWidth}px`;
        root.style.height = 'auto';
        root.style.transform = 'translateY(-50%)';
        root.style.position = 'absolute';
        root.style.boxSizing = 'border-box';
        panel.appendChild(root);
      } else {
        tocItem.appendChild(root);
      }
      this.sidebar.msgSearchFloatRoot = root;
      const input = root.querySelector('.toc-msg-search-float-input');
      const closeBtn = root.querySelector('.toc-msg-search-float-close');
      input.value = '';
      input.focus();
      closeBtn.addEventListener('click', () => this.closeMsgSearchOverlay());
      let highlightIndex = 0;
      const applyHighlight = () => {
        const el = this.resolveMessageElement(this.sidebar.currentMsgSearchMessageId);
        if (!el) return;
        this.sidebar.currentMsgSearchElement = el;
        this.highlightInElement(el, input.value);
        const marks = el.querySelectorAll('.chatgpt-sidebar-msg-highlight');
        if (marks.length > 0) { highlightIndex = 0; this.scrollHighlightIntoViewCenter(marks[0]); }
      };
      const goToNextHighlight = () => {
        const el = this.resolveMessageElement(this.sidebar.currentMsgSearchMessageId);
        if (!el) return;
        const marks = el.querySelectorAll('.chatgpt-sidebar-msg-highlight');
        if (marks.length === 0) return;
        highlightIndex = (highlightIndex + 1) % marks.length;
        this.scrollHighlightIntoViewCenter(marks[highlightIndex]);
      };
      input.addEventListener('input', applyHighlight);
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') this.closeMsgSearchOverlay();
        if (e.key === 'Enter') { e.preventDefault(); goToNextHighlight(); }
      });
      input.addEventListener('focus', () => { if (input.value.trim()) applyHighlight(); });
    }

    closeMsgSearchOverlay() {
      const el = this.sidebar.currentMsgSearchMessageId ? this.resolveMessageElement(this.sidebar.currentMsgSearchMessageId) : this.sidebar.currentMsgSearchElement;
      if (el) this.clearHighlightInElement(el);
      if (this.sidebar.msgSearchFloatRoot && this.sidebar.msgSearchFloatRoot.parentNode) this.sidebar.msgSearchFloatRoot.remove();
      this.sidebar.msgSearchFloatRoot = null;
      this.sidebar.currentMsgSearchElement = null;
      this.sidebar.currentMsgSearchMessageId = null;
    }

    stashMsgSearchOverlayForNextTab(nextTab) {
      if (!this.sidebar.msgSearchFloatRoot || !this.sidebar.currentMsgSearchMessageId) return;
      const expected = this.getMsgSearchExpectedTab(this.sidebar.currentMsgSearchMessageId);
      if (expected && expected === nextTab) return;
      const input = this.sidebar.msgSearchFloatRoot.querySelector('.toc-msg-search-float-input');
      this.sidebar.msgSearchPersist = {
        messageId: this.sidebar.currentMsgSearchMessageId,
        keyword: (input && input.value) ? input.value : ''
      };
      this.closeMsgSearchOverlay();
    }

    restoreMsgSearchOverlayForTab(tabName) {
      if (!this.sidebar.msgSearchPersist || !this.sidebar.msgSearchPersist.messageId) return;
      const expected = this.getMsgSearchExpectedTab(this.sidebar.msgSearchPersist.messageId);
      if (expected && expected !== tabName) return;
      this.openMsgSearchOverlay(this.sidebar.msgSearchPersist.messageId);
      const input = this.sidebar.msgSearchFloatRoot?.querySelector('.toc-msg-search-float-input');
      if (!input) return;
      input.value = this.sidebar.msgSearchPersist.keyword || '';
      if (input.value.trim()) input.dispatchEvent(new Event('input'));
      this.sidebar.msgSearchPersist = null;
    }

    isClaudeThinkingBlock(element) {
      if (!element || !element.classList) return false;
      const classList = element.classList;
      const hasThinkingClasses =
        classList.contains('transition-all') &&
        classList.contains('rounded-lg') &&
        (classList.contains('border-0.5') || classList.contains('border'));
      const hasThinkingText =
        element.textContent &&
        (element.textContent.includes('Architected') || element.textContent.includes('Engineered'));
      const hasCollapsibleButton = element.querySelector('button[aria-expanded]');
      return hasThinkingClasses || (hasThinkingText && hasCollapsibleButton);
    }

    removeClaudeThinkingBlocks(container) {
      if (!container || !container.children) return;
      const toRemove = [];
      Array.from(container.children).forEach((child) => {
        if (this.isClaudeThinkingBlock(child)) toRemove.push(child);
      });
      toRemove.forEach((el) => el.remove());
    }

    sanitizeExtractedHtml(html) {
      let cleaned = (html || '').trim();
      cleaned = cleaned.replace(/<button[^>]*>[\s\S]*?<\/button>/gi, '');
      cleaned = cleaned.replace(/<!--[\s\S]*?-->/g, '');
      cleaned = cleaned.replace(/\sstyle="[^"]*"/gi, '').replace(/\sstyle='[^']*'/gi, '');
      return cleaned.trim();
    }

    extractClaudeMessageHtml(clone) {
      const userRoot = (clone.matches && clone.matches('[data-testid="user-message"]'))
        ? clone
        : clone.querySelector('[data-testid="user-message"]');
      if (userRoot) {
        return this.sanitizeExtractedHtml(userRoot.innerHTML || '');
      }

      const aiRoot = (clone.matches && clone.matches('.font-claude-response'))
        ? clone
        : clone.querySelector('.font-claude-response');
      if (!aiRoot) return '';
      this.removeClaudeThinkingBlocks(aiRoot);
      return this.sanitizeExtractedHtml(aiRoot.innerHTML || '');
    }

    extractMessageHTML(element) {
      if (!element) return '';
      const clone = element.cloneNode(true);
      clone.querySelectorAll('button, [role="button"], .copy-button, .regenerate-button').forEach((btn) => btn.remove());
      clone.querySelectorAll('.avatar, [data-testid*="avatar"]').forEach((avatar) => avatar.remove());
      clone.querySelectorAll('svg').forEach((el) => el.remove());

      const isClaude = window.platformAdapter && window.platformAdapter.getPlatformName() === 'Claude';
      if (isClaude) {
        const claudeHtml = this.extractClaudeMessageHtml(clone);
        if (claudeHtml) return claudeHtml;
      }

      const contentElement = clone.querySelector('[data-message-author-role], .markdown, .message-content, [class*="prose"]') || clone;
      return this.sanitizeExtractedHtml(contentElement.innerHTML || '');
    }

    stripMediaElements(html) {
      if (!html || !html.trim()) return html;
      const div = document.createElement('div');
      div.innerHTML = html;
      div.querySelectorAll('img').forEach((el) => {
        const fig = el.closest('figure');
        if (fig) fig.remove();
        else el.remove();
      });
      div.querySelectorAll('figure').forEach((fig) => fig.remove());
      div.querySelectorAll('p').forEach((p) => { if (!p.textContent.trim()) p.remove(); });
      this.removeEmptyImagePlaceholders(div);
      return div.innerHTML.trim() || html;
    }

    removeEmptyImagePlaceholders(container) {
      if (!container || !container.querySelectorAll) return;
      let removed;
      do {
        removed = 0;
        container.querySelectorAll('div, span').forEach((el) => {
          if (!el.parentNode) return;
          const hasText = (el.textContent || '').trim().length > 0;
          const hasChildElements = el.children.length > 0;
          if (!hasText && !hasChildElements) { el.remove(); removed++; }
        });
      } while (removed > 0);
    }

    normalizeMediaSrc(src) {
      if (!src || typeof src !== 'string') return '';
      let normalized = src.trim().toLowerCase();
      const ytMatch = normalized.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|v\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/i);
      if (ytMatch) return `youtube:${ytMatch[1]}`;
      if (normalized.startsWith('http://') || normalized.startsWith('https://')) {
        try {
          const url = new URL(normalized);
          ['utm_source', 'utm_medium', 'utm_campaign', 'ref', 't', '_'].forEach((p) => url.searchParams.delete(p));
          normalized = url.host + url.pathname + (url.searchParams.toString() ? '?' + url.searchParams.toString() : '');
        } catch { }
      }
      return normalized;
    }

    deduplicateMediaBySrc(html) {
      if (!html || !html.trim()) return html;
      const div = document.createElement('div');
      div.innerHTML = html;
      const seen = new Set();
      const mediaEls = Array.from(div.querySelectorAll(
        'iframe[src], video[src], video source[src], a[href*="youtube"] img, a[href*="youtu.be"] img, [class*="video"] img, [class*="embed"] img'
      ));
      mediaEls.forEach((el) => {
        if (!el.parentNode) return;
        const rawSrc = (el.getAttribute('src') || el.src || '').trim();
        if (!rawSrc) return;
        const normalizedSrc = this.normalizeMediaSrc(rawSrc);
        if (!normalizedSrc) return;
        if (seen.has(normalizedSrc)) {
          const wrapper = el.closest('figure, a[href*="youtube"], a[href*="youtu.be"], div[class*="card"], div[class*="embed"], div[class*="video"]') || el.parentElement;
          if (wrapper && wrapper !== div && Array.from(wrapper.querySelectorAll('img, iframe, video')).length <= 1) wrapper.remove();
          else el.remove();
        } else seen.add(normalizedSrc);
      });
      const videoCardSeen = new Set();
      Array.from(div.querySelectorAll('a[href*="youtube.com"], a[href*="youtu.be"]')).forEach((card) => {
        if (!card.parentNode) return;
        const href = (card.getAttribute('href') || '').trim();
        const normalizedHref = this.normalizeMediaSrc(href);
        if (!normalizedHref) return;
        if (videoCardSeen.has(normalizedHref)) {
          const wrapper = card.closest('figure, div[class*="card"], div[class*="embed"]') || card;
          wrapper.remove();
        } else videoCardSeen.add(normalizedHref);
      });
      return div.innerHTML.trim() || html;
    }

    createMessageDisplayClone(element) {
      const clone = element.cloneNode(true);
      clone.querySelectorAll('button, [role="button"], .copy-code, .regenerate-button').forEach((btn) => btn.remove());
      clone.querySelectorAll('.avatar, [data-testid*="avatar"], img[alt*="avatar"]').forEach((avatar) => avatar.remove());
      clone.querySelectorAll('svg').forEach((el) => el.remove());
      return clone;
    }

    extractDisplayHtmlFromClaude(clone) {
      const userRoot = (clone.matches && clone.matches('[data-testid="user-message"]'))
        ? clone
        : clone.querySelector('[data-testid="user-message"]');
      if (userRoot) return (userRoot.innerHTML || '').trim();

      const aiRoot = (clone.matches && clone.matches('.font-claude-response'))
        ? clone
        : clone.querySelector('.font-claude-response');
      if (!aiRoot) return '';
      this.removeClaudeThinkingBlocks(aiRoot);
      return (aiRoot.innerHTML || '').trim();
    }

    extractDisplayHtmlFromDeepSeek(clone) {
      const dsMessage = clone.querySelector('.ds-message');
      if (!dsMessage) return '';
      dsMessage.querySelectorAll('.ds-think-content, .e1675d8b').forEach((el) => el.remove());
      const dsMarkdown = dsMessage.querySelector('.ds-markdown');
      return dsMarkdown ? (dsMarkdown.innerHTML || '').trim() : '';
    }

    extractDisplayHtmlFromContentBlocks(clone) {
      const roleContainer = clone.querySelector('[data-message-author-role]');
      if (roleContainer) return (roleContainer.innerHTML || '').trim();

      const blocksArray = Array.from(clone.querySelectorAll('.markdown, .message-content, [class*="prose"]'));
      if (blocksArray.length === 0) return '';
      const rootBlock = blocksArray.find((el) => blocksArray.every((other) => el === other || el.contains(other)));
      if (rootBlock) return (rootBlock.innerHTML || '').trim();
      if (blocksArray.length === 1) return (blocksArray[0].innerHTML || '').trim();
      const topLevelBlocks = blocksArray.filter((el) => !blocksArray.some((other) => other !== el && other.contains(el)));
      if (topLevelBlocks.length === 0) return '';
      if (topLevelBlocks.length > 1) {
        const parent = topLevelBlocks[0].parentElement;
        if (parent && clone.contains(parent)) return (parent.innerHTML || '').trim();
      }
      return topLevelBlocks.map((el) => (el.innerHTML || '').trim()).filter(Boolean).join('\n\n');
    }

    normalizeDisplayHtml(html) {
      let normalized = (html || '').trim();
      normalized = normalized.replace(/<button[^>]*>[\s\S]*?<\/button>/gi, '');
      normalized = normalized.replace(/<!--[\s\S]*?-->/g, '');
      normalized = normalized.replace(/\sstyle="[^"]*"/gi, '').replace(/\sstyle='[^']*'/gi, '');
      normalized = normalized.replace(/\sclass="[^"]*"/gi, '').replace(/\sclass='[^']*'/gi, '');
      normalized = normalized.replace(/<a\s+/gi, '<a target="_blank" rel="noopener noreferrer" ');
      normalized = normalized.replace(/<p>/gi, '<p class="toc-expanded-p">').replace(/<ul>/gi, '<ul class="toc-expanded-ul">').replace(/<ol>/gi, '<ol class="toc-expanded-ol">').replace(/<li>/gi, '<li class="toc-expanded-li">').replace(/<pre>/gi, '<pre class="toc-expanded-pre">').replace(/<code>/gi, '<code class="toc-expanded-code">').replace(/<h([1-6])(\s[^>]*)?\/?>/gi, '<h$1 class="toc-expanded-h$1">').replace(/<blockquote>/gi, '<blockquote class="toc-expanded-blockquote">').replace(/<strong>/gi, '<strong class="toc-expanded-strong">').replace(/<b>/gi, '<b class="toc-expanded-b">').replace(/<br\s*\/?>/gi, '<br>');
      return normalized.trim();
    }

    extractMessageHTMLForDisplay(element) {
      if (!element) return '';
      const clone = this.createMessageDisplayClone(element);
      const platform = window.platformAdapter ? window.platformAdapter.getPlatformName() : '';
      let html = '';
      if (platform === 'Claude') html = this.extractDisplayHtmlFromClaude(clone);
      if (!html && platform === 'DeepSeek') html = this.extractDisplayHtmlFromDeepSeek(clone);
      if (!html) html = this.extractDisplayHtmlFromContentBlocks(clone);
      html = this.normalizeDisplayHtml(html);
      html = this.stripMediaElements(html);
      html = this.deduplicateMediaBySrc(html);
      return html || '';
    }

    updateTocSummary(total, userCount, aiCount, isFiltered) {
      const summaryEl = this.shadowRoot.getElementById('toc-summary');
      if (!summaryEl) return;
      if (!total) {
        summaryEl.textContent = '';
        summaryEl.style.display = 'none';
        return;
      }
      const label = isFiltered ? this._t('toc.summary.filtered') : this._t('toc.summary.total');
      const itemsLabel = this._t('toc.summary.items');
      const platformName = window.platformAdapter ? window.platformAdapter.getPlatformName() : 'Unknown';
      const platformIcon = window.platformAdapter ? window.platformAdapter.getPlatformIcon() : '';
      summaryEl.innerHTML = `
      <div class="toc-summary-left">
        <span>${label} ${total} ${itemsLabel}</span>
        <span class="toc-summary-meta">${this._t('role.user')} ${userCount} · ${this._t('role.assistant')} ${aiCount}</span>
      </div>
      <div class="toc-summary-platform">
        <img src="${platformIcon}" alt="" class="toc-summary-platform-icon" />
        <span class="toc-summary-platform-name">${platformName}</span>
      </div>
    `;
      summaryEl.style.display = 'flex';
    }

    async loadFavorites() {
      if (!this.sidebar.conversationId) { this.favorites = new Set(); return; }
      try {
        const conv = await window.storageManager.getConversation(this.sidebar.conversationId);
        this.favorites = new Set(conv.favoriteMessageIds || []);
      } catch {
        this.favorites = new Set();
      }
    }

    async toggleFavorite(messageId) {
      if (!this.sidebar.conversationId) return;
      try {
        const conv = await window.storageManager.getConversation(this.sidebar.conversationId);
        conv.favoriteMessageIds = conv.favoriteMessageIds || [];
        const idx = conv.favoriteMessageIds.indexOf(messageId);
        if (idx >= 0) conv.favoriteMessageIds.splice(idx, 1);
        else conv.favoriteMessageIds.push(messageId);
        await window.storageManager.saveConversation(this.sidebar.conversationId, conv);
        this.favorites = new Set(conv.favoriteMessageIds);
      } catch (e) { this.sidebar.log('toggleFavorite error:', e); }
    }

    updateFilterButtons() {
      const panel = this.shadowRoot.querySelector('[data-panel="toc"]');
      if (!panel) return;
      panel.querySelectorAll('.toc-filter-btn').forEach((btn) => {
        const isRole = btn.hasAttribute('data-filter-role');
        const isFav = btn.getAttribute('data-filter-favorite') === 'true';
        let active = false;
        if (isRole) active = this.filterRole === btn.getAttribute('data-filter-role');
        else if (isFav) active = this.filterFavorite;
        btn.classList.toggle('active', active);
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
      for (const { node, full, splitAt: at } of nodesToWrap) {
        const parent = node.parentNode;
        if (!parent) continue;
        const strong = document.createElement('strong');
        strong.className = 'toc-content-lead';
        if (full) {
          parent.insertBefore(strong, node);
          strong.appendChild(node);
        } else {
          node.splitText(at);
          parent.insertBefore(strong, node);
          strong.appendChild(node);
        }
      }
      return div.innerHTML;
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
        const escaped = this.sidebar.escapeHtml(p).replace(/\n/g, '<br>');
        if (i === 0 && leadLen > 0) {
          if (leadLen >= p.length) {
            out.push(`<p class="toc-expanded-p toc-content-lead-wrap"><strong class="toc-content-lead">${escaped}</strong></p>`);
          } else {
            const lead = this.sidebar.escapeHtml(p.slice(0, leadLen));
            const rest = this.sidebar.escapeHtml(p.slice(leadLen)).replace(/\n/g, '<br>');
            out.push(`<p class="toc-expanded-p toc-content-lead-wrap"><strong class="toc-content-lead">${lead}</strong>${rest}</p>`);
          }
        } else {
          out.push(`<p class="toc-expanded-p">${escaped}</p>`);
        }
      }
      return out.join('');
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
     * 仅在 HTML 的文本内容中高亮关键词，不替换标签/属性内的字符
     */
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

    getTocItemRenderData(item, index, totalCount, favSet, keyword) {
      const num = item.turnNumber != null ? item.turnNumber : (item.index + 1);
      const isUser = item.role === 'user';
      const roleLabel = isUser ? this._t('role.user') : this._t('role.assistant');
      const roleIcon = isUser ? this.sidebar.getIcon('user') : this.sidebar.getIcon('bot');
      const isFav = favSet.has(item.messageId);
      const content = (this.messages.find((m) => m.id === item.messageId) || {}).content || '';
      const roleAttr = isUser ? 'user' : 'assistant';
      const previewBreakpoint = this.findPreviewBreakpoint(content);
      const isLastItem = index === totalCount - 1;
      const hasLongContent = content.length > previewBreakpoint || (isLastItem && content.length > 150);
      let fullContentHtml = this.getFullContentHtml(item.messageId, content);
      fullContentHtml = this.applyHighlightToTextContentOnly(fullContentHtml, keyword);
      const matchCount = keyword ? this.countKeywordOccurrences(content, keyword) : 0;
      const hasMatch = matchCount > 0;
      const matchLabel = hasMatch ? this._t('search.matchCount', { n: String(matchCount) }) : '';
      return { num, roleLabel, roleIcon, isFav, content, roleAttr, hasLongContent, fullContentHtml, hasMatch, matchLabel };
    }

    renderTocItemHtml(item, index, totalCount, favSet, keyword) {
      const { num, roleLabel, roleIcon, isFav, roleAttr, hasLongContent, fullContentHtml, hasMatch, matchLabel } =
        this.getTocItemRenderData(item, index, totalCount, favSet, keyword);
      const expandText = this._t('toc.expand');
      const expandIcon = this.sidebar.getIcon('chevronDown');

      return `<li class="toc-item${hasMatch ? ' has-match-badge' : ''}" data-role="${roleAttr}" data-message-id="${item.messageId}" data-expanded="false">
        <button type="button" class="export-select-dot" data-scope="toc" data-type="message" data-id="${item.messageId}" aria-label="${this._t('export.select')}"></button>
        <div class="toc-item-main">
          <div class="toc-index" title="${roleLabel}">#${num}</div>
          <div class="toc-meta"><span class="toc-role-icon" aria-hidden="true">${roleIcon}</span>${this.sidebar.escapeHtml(roleLabel)}</div>
          <div class="toc-content-wrapper">
            ${hasLongContent ? `
              <div class="toc-content-collapsible" aria-expanded="false">
                <div class="toc-content-full">${fullContentHtml}</div>
                <div class="toc-preview-fade" aria-hidden="true"></div>
              </div>
              <div class="toc-expand-btn-row">
                <button type="button" class="toc-expand-text-btn" data-action="expand" aria-label="${expandText}">
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
          ${hasLongContent ? `<button type="button" class="toc-action-btn toc-collapse-btn" title="${this._t('toc.collapse')}" aria-label="${this._t('toc.collapse')}" data-action="expand">${this.sidebar.getIcon('chevronUp')}</button>` : ''}
          <button type="button" class="toc-action-btn" title="${this._t('toc.searchInMessage')}" aria-label="${this._t('toc.searchInMessage')}" data-action="search">${this.sidebar.getIcon('search')}</button>
          <button type="button" class="toc-action-btn" title="${this._t('toc.copy')}" aria-label="${this._t('toc.copy')}" data-action="copy">${this.sidebar.getIcon('copy')}</button>
          <button type="button" class="toc-action-btn toc-action-fav" title="${this._t('toc.favorite')}" aria-label="${this._t('toc.favorite')}" data-action="favorite" data-fav="${isFav ? '1' : '0'}">${isFav ? this.sidebar.getIcon('star') : this.sidebar.getIcon('starOutline')}</button>
        </div>
        ${hasMatch ? `<span class="toc-match-badge">${this.sidebar.escapeHtml(matchLabel)}</span>` : ''}
      </li>`;
    }

    renderTOC(searchKeyword) {
      if (!this.shadowRoot) return;
      const tocList = this.shadowRoot.getElementById('toc-list');
      let tocItems = window.tocManager.buildTOC(this.messages);
      if (tocItems.length === 0) {
        tocList.innerHTML = '<div class="empty-state"><div class="empty-state-icon">📭</div><div class="empty-state-text">' + this._t('empty.noMessages') + '</div></div>';
        this.updateTocSummary(0, 0, 0, false);
        this.sidebar.updateOpenInPlatformButtonText(window.platformAdapter ? window.platformAdapter.getPlatformName() : 'ChatGPT');
        return;
      }
      if (this.filterRole !== 'all') tocItems = tocItems.filter((item) => item.role === this.filterRole);
      if (this.filterFavorite) tocItems = tocItems.filter((item) => this.favorites.has(item.messageId));
      const favSet = this.favorites;
      const searchInput = this.shadowRoot.getElementById('search-input');
      const kw = (searchKeyword !== undefined ? searchKeyword : (searchInput ? searchInput.value.trim() : '')) || '';
      tocList.innerHTML = tocItems.map((item, i) => this.renderTocItemHtml(item, i, tocItems.length, favSet, kw)).join('');
      tocList.querySelectorAll('.toc-item').forEach((li) => {
        const messageId = li.getAttribute('data-message-id');
        const msg = this.messages.find((m) => m.id === messageId);
        li.addEventListener('click', (e) => {
          if (this.exportState.active && this.exportState.scope === 'toc') {
            if (e.target.closest('.toc-action-btn') || e.target.closest('.toc-expand-text-btn')) return;
            const dot = li.querySelector('.export-select-dot');
            if (dot) this.sidebar.toggleExportSelectionFromDot(dot);
            e.stopPropagation();
            e.preventDefault();
          }
        });
        const mainClickArea = li.querySelector('.toc-item-main');
        if (mainClickArea) {
          mainClickArea.addEventListener('click', (e) => {
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
              this.sidebar.copyMessageWithFormat(messageId, msg);
            } else if (action === 'favorite') {
              this.toggleFavorite(messageId).then(() => this.renderTOC());
            }
          });
        });
      });
      const userCount = tocItems.filter((item) => item.role === 'user').length;
      const aiCount = tocItems.length - userCount;
      this.updateTocSummary(tocItems.length, userCount, aiCount, this.filterRole !== 'all' || this.filterFavorite);
    }
  }

  global.SidebarTOC = SidebarTOC;
})(typeof globalThis !== 'undefined' ? globalThis : window);
