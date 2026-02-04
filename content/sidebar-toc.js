/**
 * 侧边栏 TOC 与消息内搜索模块
 * 职责：当前会话 TOC 渲染与交互、消息内搜索浮层、消息 HTML 提取与媒体处理
 */
(function (global) {
  class SidebarTOC {
    constructor(sidebar) {
      this.sidebar = sidebar;
    }

    get _t() { return (key, params) => this.sidebar._t(key, params); }
    get shadowRoot() { return this.sidebar.shadowRoot; }
    get messages() { return this.sidebar.messages; }
    get exportState() { return this.sidebar.exportState; }

    findPreviewBreakpoint(content) {
      if (!content || content.length <= 150) return content.length;
      const minLength = 100;
      const maxLength = 300;
      let breakpoint = Math.min(200, content.length);
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

    toggleTocItemExpand(tocItem, messageId) {
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
      root.innerHTML = '<span class="toc-msg-search-float-icon toc-msg-search-float-icon-svg" aria-hidden="true">' + this.sidebar.getIcon('search') + '</span><input type="text" class="toc-msg-search-float-input" placeholder="' + this._t('msgSearch.placeholder') + '"><button type="button" class="toc-msg-search-float-close" title="' + this._t('action.close') + '">' + this.sidebar.getIcon('close') + '</button>';
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

    extractMessageHTML(element) {
      if (!element) return '';
      const clone = element.cloneNode(true);
      clone.querySelectorAll('button, [role="button"], .copy-button, .regenerate-button').forEach((btn) => btn.remove());
      clone.querySelectorAll('.avatar, [data-testid*="avatar"]').forEach((avatar) => avatar.remove());
      clone.querySelectorAll('svg').forEach((el) => el.remove());

      const isClaude = window.platformAdapter && window.platformAdapter.getPlatformName() === 'Claude';
      if (isClaude) {
        const isUserRoot = clone.matches && clone.matches('[data-testid="user-message"]');
        const isAiRoot = clone.matches && clone.matches('.font-claude-response');
        if (isUserRoot) {
          let html = (clone.innerHTML || '').trim();
          html = html.replace(/<button[^>]*>[\s\S]*?<\/button>/gi, '');
          html = html.replace(/<!--[\s\S]*?-->/g, '');
          html = html.replace(/\sstyle="[^"]*"/gi, '').replace(/\sstyle='[^']*'/gi, '');
          return html.trim();
        }
        if (isAiRoot) {
          this.removeClaudeThinkingBlocks(clone);
          let html = (clone.innerHTML || '').trim();
          html = html.replace(/<button[^>]*>[\s\S]*?<\/button>/gi, '');
          html = html.replace(/<!--[\s\S]*?-->/g, '');
          html = html.replace(/\sstyle="[^"]*"/gi, '').replace(/\sstyle='[^']*'/gi, '');
          return html.trim();
        }
        const userRoot = clone.querySelector('[data-testid="user-message"]');
        if (userRoot) {
          let html = (userRoot.innerHTML || '').trim();
          html = html.replace(/<button[^>]*>[\s\S]*?<\/button>/gi, '');
          html = html.replace(/<!--[\s\S]*?-->/g, '');
          html = html.replace(/\sstyle="[^"]*"/gi, '').replace(/\sstyle='[^']*'/gi, '');
          return html.trim();
        }
        const aiRoot = clone.querySelector('.font-claude-response');
        if (aiRoot) {
          this.removeClaudeThinkingBlocks(aiRoot);
          let html = (aiRoot.innerHTML || '').trim();
          html = html.replace(/<button[^>]*>[\s\S]*?<\/button>/gi, '');
          html = html.replace(/<!--[\s\S]*?-->/g, '');
          html = html.replace(/\sstyle="[^"]*"/gi, '').replace(/\sstyle='[^']*'/gi, '');
          return html.trim();
        }
      }

      const contentElement = clone.querySelector('[data-message-author-role], .markdown, .message-content, [class*="prose"]') || clone;
      let html = contentElement.innerHTML || '';
      html = html.replace(/<button[^>]*>[\s\S]*?<\/button>/gi, '');
      html = html.replace(/<!--[\s\S]*?-->/g, '');
      html = html.replace(/\sstyle="[^"]*"/gi, '').replace(/\sstyle='[^']*'/gi, '');
      return html.trim();
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
        } catch (e) {}
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

    extractMessageHTMLForDisplay(element) {
      if (!element) return '';
      const clone = element.cloneNode(true);
      clone.querySelectorAll('button, [role="button"], .copy-code, .regenerate-button').forEach((btn) => btn.remove());
      clone.querySelectorAll('.avatar, [data-testid*="avatar"], img[alt*="avatar"]').forEach((avatar) => avatar.remove());
      clone.querySelectorAll('svg').forEach((el) => el.remove());
      let html = '';

      const isClaude = window.platformAdapter && window.platformAdapter.getPlatformName() === 'Claude';
      if (isClaude) {
        const isUserRoot = clone.matches && clone.matches('[data-testid="user-message"]');
        const isAiRoot = clone.matches && clone.matches('.font-claude-response');
        if (isUserRoot) {
          html = (clone.innerHTML || '').trim();
        } else if (isAiRoot) {
          this.removeClaudeThinkingBlocks(clone);
          html = (clone.innerHTML || '').trim();
        } else {
          const userRoot = clone.querySelector('[data-testid="user-message"]');
          if (userRoot) html = (userRoot.innerHTML || '').trim();
          else {
            const aiRoot = clone.querySelector('.font-claude-response');
            if (aiRoot) {
              this.removeClaudeThinkingBlocks(aiRoot);
              html = (aiRoot.innerHTML || '').trim();
            }
          }
        }
      }

      if (!html) {
        let usedBlocks = [];
        const roleContainer = clone.querySelector('[data-message-author-role]');
        if (roleContainer) {
          html = (roleContainer.innerHTML || '').trim();
          usedBlocks = [roleContainer];
        } else {
          const contentBlocks = clone.querySelectorAll('.markdown, .message-content, [class*="prose"]');
          const blocksArray = Array.from(contentBlocks);
          const topLevelBlocks = blocksArray.filter((el) => !blocksArray.some((other) => other !== el && other.contains(el)));
          const rootBlock = blocksArray.find((el) => blocksArray.every((other) => el === other || el.contains(other)));
          if (rootBlock) {
            html = (rootBlock.innerHTML || '').trim();
            usedBlocks = [rootBlock];
          } else if (topLevelBlocks.length === 1) {
            html = (topLevelBlocks[0].innerHTML || '').trim();
            usedBlocks = [topLevelBlocks[0]];
          } else if (topLevelBlocks.length > 1) {
            const parent = topLevelBlocks[0].parentElement;
            if (parent && clone.contains(parent)) {
              html = (parent.innerHTML || '').trim();
              usedBlocks = [parent];
            } else {
              html = topLevelBlocks.map((el) => (el.innerHTML || '').trim()).filter(Boolean).join('\n\n');
            }
          }
        }
      }

      html = html.replace(/<button[^>]*>[\s\S]*?<\/button>/gi, '');
      html = html.replace(/<!--[\s\S]*?-->/g, '');
      html = html.replace(/\sstyle="[^"]*"/gi, '').replace(/\sstyle='[^']*'/gi, '');
      html = html.replace(/<a\s+/gi, '<a target="_blank" rel="noopener noreferrer" ');
      html = html.replace(/<p>/gi, '<p class="toc-expanded-p">').replace(/<ul>/gi, '<ul class="toc-expanded-ul">').replace(/<ol>/gi, '<ol class="toc-expanded-ol">').replace(/<li>/gi, '<li class="toc-expanded-li">').replace(/<pre>/gi, '<pre class="toc-expanded-pre">').replace(/<code>/gi, '<code class="toc-expanded-code">').replace(/<h([1-6])(\s[^>]*)?\/?>/gi, '<h$1 class="toc-expanded-h$1">').replace(/<blockquote>/gi, '<blockquote class="toc-expanded-blockquote">').replace(/<strong>/gi, '<strong class="toc-expanded-strong">').replace(/<b>/gi, '<b class="toc-expanded-b">').replace(/<br\s*\/?>/gi, '<br>');
      html = html.trim();
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
  }

  global.SidebarTOC = SidebarTOC;
})(typeof globalThis !== 'undefined' ? globalThis : window);
