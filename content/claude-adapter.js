/**
 * Claude 页面适配器 - 负责解析 Claude 页面的 DOM 结构
 * 继承 BasePlatformAdapter，参考 ChatMemo 实现
 * 只获取正式回复，跳过思考块（thinking blocks）
 */

class ClaudeAdapter extends BasePlatformAdapter {
  constructor() {
    super();
    this.debounceDelay = 500;
    this.keepMessagesOnEmpty = true;
    this.maxEmptyParseStreak = 2;
    this.siteConfig = typeof getSiteConfig === 'function' ? getSiteConfig(window.location.hostname) : null;
  }

  _sel(key, fallback) {
    const s = this.siteConfig?.selectors?.[key];
    return (typeof s === 'string' ? s : null) || fallback;
  }

  // ===== 实现抽象方法 =====

  getPlatformName() {
    return this.siteConfig?.platformName || 'Claude';
  }

  getPlatformIcon() {
    return this.siteConfig?.platformIcon || 'https://claude.ai/favicon.ico';
  }

  /**
   * 检测是否在 Claude 对话页面
   * URL 模式: /chat/* 或 /o/.../chat/*（组织路径）
   */
  isConversationPage() {
    const pathname = window.location.pathname || '';
    return /^\/chat(?:\/|$)/.test(pathname) || /\/chat\//.test(pathname);
  }

  /**
   * 从 URL 提取对话 ID
   * 例如: https://claude.ai/chat/xxx -> xxx
   * /chat/uuid-with-slashes -> uuid_with_slashes
   * /o/org-id/chat/conv-id -> conv-id
   */
  getConversationId() {
    try {
      const pathname = (window.location.pathname || '').replace(/^\/+/, '');
      const segments = pathname.split('/').filter(Boolean);

      const chatIdx = segments.indexOf('chat');
      if (chatIdx >= 0 && segments[chatIdx + 1]) {
        return segments.slice(chatIdx + 1).join('_');
      }
      const match = window.location.href.match(/\/chat\/([^#]+?)(?:\?|$|#)/);
      return match ? match[1].replace(/\//g, '_') : null;
    } catch (e) {
      return null;
    }
  }

  /**
   * 解析页面中的消息列表
   * 使用 [data-test-render-count] 容器，[data-testid="user-message"]，.font-claude-response
   */
  parseMessages() {
    const messages = [];

    try {
      if (!this.isConversationPage()) {
        this.log('Not on Claude conversation page, skip parsing');
        return messages;
      }

      const containerSel = this._sel('container', '[data-test-render-count]');
      const messageContainers = document.querySelectorAll(containerSel);
      if (messageContainers.length === 0) {
        this.log('No message containers found, selector:', containerSel);
        return messages;
      }

      const hasEdit = Array.from(messageContainers).some(el => this.isInEditMode(el));
      if (hasEdit) {
        this.log('User is editing, skip parsing');
        return messages;
      }

      const userSel = this._sel('userItem', '[data-testid="user-message"]');
      const assistantSel = this._sel('assistantItem', '.font-claude-response');
      const allElements = [];
      messageContainers.forEach((container) => {
        const userMessage = container.querySelector(userSel);
        if (userMessage) {
          let content = this.getContentWithStructure(userMessage, 'user');
          if (!content) content = this.extractFormattedContent(userMessage);
          if (content && !this.isNoiseContent(content)) {
            allElements.push({ element: userMessage, role: 'user', content });
          }
          return;
        }

        const aiMessage = container.querySelector(assistantSel);
        if (aiMessage) {
          let content = this.getContentWithStructure(aiMessage, 'assistant');
          if (!content) content = this.extractOnlyFormalResponse(aiMessage);
          if (content && !this.isNoiseContent(content)) {
            allElements.push({ element: aiMessage, role: 'assistant', content });
          }
        }
      });

      allElements.sort((a, b) => {
        const pos = a.element.compareDocumentPosition(b.element);
        if (pos & Node.DOCUMENT_POSITION_FOLLOWING) return -1;
        if (pos & Node.DOCUMENT_POSITION_PRECEDING) return 1;
        return 0;
      });

      allElements.forEach((item, index) => {
        const messageId = `claude_msg_${index}`;
        item.element.setAttribute('data-ext-message-id', messageId);
        messages.push({
          id: messageId,
          role: item.role,
          content: item.content.trim(),
          element: item.element
        });
      });

      this.log('Parsed Claude messages:', messages.length);
    } catch (error) {
      console.error('[ClaudeAdapter] Error parsing messages:', error);
    }

    return messages;
  }

  // ===== 辅助方法 =====

  isInEditMode(element) {
    if (!element) return false;
    const activeTextarea = element.querySelector('textarea:focus');
    return !!activeTextarea;
  }

  extractFormattedContent(element) {
    if (!element) return '';
    const textContent = element.innerText || element.textContent || '';
    return textContent
      .split('\n')
      .map(line => line.trim())
      .filter((line, idx, array) => {
        if (line) return true;
        const prevLine = array[idx - 1];
        const nextLine = array[idx + 1];
        return prevLine && nextLine && prevLine.trim() && nextLine.trim();
      })
      .join('\n')
      .trim();
  }

  /**
   * 只提取正式回复内容，跳过思考块（thinking blocks）
   */
  extractOnlyFormalResponse(element) {
    if (!element) return '';

    const childElements = Array.from(element.children);
    const formalResponseParts = [];

    childElements.forEach((child) => {
      if (this.isThinkingBlock(child)) return;

      const content = this.extractFormattedContent(child);
      if (content) formalResponseParts.push(content);
    });

    return formalResponseParts.join('\n\n').trim();
  }

  /**
   * 检查是否为思考块
   */
  isThinkingBlock(element) {
    if (!element || !element.classList) return false;

    const classList = element.classList;
    const hasThinkingClasses =
      classList.contains('transition-all') &&
      classList.contains('rounded-lg') &&
      (classList.contains('border-0.5') || classList.contains('border'));

    const hasThinkingText =
      element.textContent &&
      (element.textContent.includes('Architected') ||
        element.textContent.includes('Engineered'));
    const hasCollapsibleButton = element.querySelector('button[aria-expanded]');

    return hasThinkingClasses || (hasThinkingText && hasCollapsibleButton);
  }

  /**
   * 从容器中移除思考块子节点（就地修改）
   */
  removeThinkingBlocksInPlace(container) {
    if (!container || !container.children) return;
    const toRemove = [];
    Array.from(container.children).forEach((child) => {
      if (this.isThinkingBlock(child)) toRemove.push(child);
    });
    toRemove.forEach((el) => el.remove());
  }

  /**
   * 用 HTML 经 HtmlToMarkdown 得到带层级的文本，与侧边栏排版一致
   * @param {HTMLElement} element - 用户或助手消息内容根节点
   * @param {string} role - 'user' | 'assistant'
   * @returns {string} 带结构的文本，无 HtmlToMarkdown 时返回空串由调用方回退纯文本
   */
  getContentWithStructure(element, role) {
    if (!element) return '';
    let html = '';
    if (role === 'user') {
      html = (element.innerHTML || '').trim();
    } else {
      const clone = element.cloneNode(true);
      this.removeThinkingBlocksInPlace(clone);
      html = (clone.innerHTML || '').trim();
    }
    if (!html) return '';
    if (typeof window !== 'undefined' && window.HtmlToMarkdown && window.HtmlToMarkdown.toText) {
      const text = window.HtmlToMarkdown.toText(html);
      return (text && text.trim()) ? text : '';
    }
    return '';
  }

  getProjectSlug() {
    return null;
  }

  getProjectName() {
    return null;
  }

  getConversationTitleFromPage() {
    const titleEl = document.querySelector('title');
    if (titleEl && titleEl.textContent.trim()) {
      const title = titleEl.textContent.trim();
      if (title && title !== 'Claude' && !title.includes('Anthropic')) {
        return title.length > 50 ? title.substring(0, 50) + '...' : title;
      }
    }
    return null;
  }
}

PlatformAdapterFactory.register(['claude.ai'], () => new ClaudeAdapter());

window.ClaudeAdapter = ClaudeAdapter;

if (window.location.hostname.includes('claude.ai')) {
  window.claudeAdapter = new ClaudeAdapter();
  window.platformAdapter = window.claudeAdapter;
}
