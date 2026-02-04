/**
 * DeepSeek 页面适配器 - 负责解析 DeepSeek 页面的 DOM 结构
 * 继承 BasePlatformAdapter，参考 ChatMemo 实现
 * 只获取正式回复，跳过思考块（thinking blocks）
 *
 * 站点与 URL：https://chat.deepseek.com；对话页 /a/chat/s/{id}
 * 依赖 DOM（见 content/sites-config.js）：container/.dad65929、userMessage、aiMessage、dsMessage、dsMarkdown、thinkingContainer
 * 改版时：同步更新 sites-config.js 中 chat.deepseek.com 的 selectors 与本 adapter 内选择器
 */

class DeepSeekAdapter extends BasePlatformAdapter {
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
    return this.siteConfig?.platformName || 'DeepSeek';
  }

  getPlatformIcon() {
    // 优先使用扩展内打包的 DeepSeek 官方 logo，其次配置/CDN
    try {
      if (typeof chrome !== 'undefined' && chrome.runtime?.id && chrome.runtime.getURL) {
        return chrome.runtime.getURL('icons/deepseek.png');
      }
    } catch (e) {}
    return this.siteConfig?.platformIcon || 'https://cdn.deepseek.com/logo.png';
  }

  /**
   * 检测是否在 DeepSeek 对话页面
   * URL 模式: https://chat.deepseek.com/a/chat/s/{id}
   */
  isConversationPage() {
    if (!window.location.hostname.includes('chat.deepseek.com')) {
      return false;
    }
    return /^\/a\/chat\/s\/[^/]+$/.test(window.location.pathname || '');
  }

  /**
   * 从 URL 提取对话 ID
   * path: /a/chat/s/xxx -> a_chat_s_xxx
   */
  getConversationId() {
    try {
      const pathname = (window.location.pathname || '').replace(/^\/+/, '');
      if (!pathname || pathname === 'a' || pathname === 'chat') {
        return null;
      }
      if (/^a\/chat\/s\/[^/]+$/.test(pathname)) {
        return pathname.replace(/\//g, '_');
      }
      return null;
    } catch (e) {
      return null;
    }
  }

  /**
   * 获取主内容区（用于 getReadyContainer）
   */
  getMainContainer() {
    const containerSel = this._sel('mainContainer', '.dad65929') || this._sel('container', '.dad65929');
    const chatWindow = document.querySelector(containerSel);
    if (chatWindow) return chatWindow;
    return document.querySelector('main') || document.querySelector('[role="main"]') || document.body;
  }

  /**
   * 解析页面中的消息列表
   * 参考 ChatMemo：容器 .dad65929，用户 ._9663006，AI ._4f9bf79._43c05b5
   * AI 消息跳过思考块，只提取 .ds-message 内正式回复的 .ds-markdown
   */
  parseMessages() {
    const messages = [];

    try {
      if (!this.isConversationPage()) {
        this.log('Not on DeepSeek conversation page, skip parsing');
        return messages;
      }

      const containerSel = this._sel('container', '.dad65929');
      const chatWindow = document.querySelector(containerSel);
      if (!chatWindow) {
        this.log('Chat window not found:', containerSel);
        return messages;
      }

      const userMsgSel = this._sel('userMessage', '._9663006');
      const aiMsgSel = this._sel('aiMessage', '._4f9bf79._43c05b5');
      const messageElements = chatWindow.querySelectorAll(`${userMsgSel}, ${aiMsgSel}`);
      if (messageElements.length === 0) {
        this.log('No message elements found');
        return messages;
      }

      const hasEdit = Array.from(messageElements).some((el) => this.isInEditMode(el));
      if (hasEdit) {
        this.log('User is editing, skip parsing');
        return messages;
      }

      const userTextSel = this._sel('userText', '.fbb737a4');
      const dsMessageSel = this._sel('dsMessage', '.ds-message');
      const dsMarkdownSel = this._sel('dsMarkdown', '.ds-markdown');
      const thinkingSel = this._sel('thinkingContainer', '.ds-think-content, .e1675d8b');
      const allElements = [];
      messageElements.forEach((element) => {
        const isUserMessage = element.matches(userMsgSel) || element.classList.contains(userMsgSel.replace(/^\./, '').split('.')[0] || '_9663006');
        const role = isUserMessage ? 'user' : 'assistant';
        let content = '';

        if (isUserMessage) {
          const userTextElement = element.querySelector(userTextSel);
          if (userTextElement) {
            content = this.extractFormattedContent(userTextElement);
          }
        } else {
          const dsMessage = element.querySelector(dsMessageSel);
          if (dsMessage) {
            const thinkingContainer = dsMessage.querySelector(thinkingSel);
            const directMarkdown = Array.from(dsMessage.children).find(
              (child) => child.classList && child.classList.contains(dsMarkdownSel.replace(/^\./, ''))
            );
            if (directMarkdown) {
              content = this.extractFormattedContent(directMarkdown);
            }
            if (!content) {
              const allMarkdown = dsMessage.querySelectorAll(dsMarkdownSel);
              for (const el of allMarkdown) {
                if (thinkingContainer && thinkingContainer.contains(el)) continue;
                content = this.extractFormattedContent(el);
                if (content) break;
              }
            }
          }
        }

        if (content && !this.isNoiseContent(content)) {
          allElements.push({ element, role, content });
        }
      });

      allElements.sort((a, b) => {
        const pos = a.element.compareDocumentPosition(b.element);
        if (pos & Node.DOCUMENT_POSITION_FOLLOWING) return -1;
        if (pos & Node.DOCUMENT_POSITION_PRECEDING) return 1;
        return 0;
      });

      allElements.forEach((item, index) => {
        const messageId = `deepseek_msg_${index}`;
        item.element.setAttribute('data-ext-message-id', messageId);
        messages.push({
          id: messageId,
          role: item.role,
          content: item.content.trim(),
          element: item.element
        });
      });

      this.log('Parsed DeepSeek messages:', messages.length);
    } catch (error) {
      console.error('[DeepSeekAdapter] Error parsing messages:', error);
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
      .map((line) => line.trim())
      .filter((line, idx, array) => {
        if (line) return true;
        const prevLine = array[idx - 1];
        const nextLine = array[idx + 1];
        return prevLine && nextLine && prevLine.trim() && nextLine.trim();
      })
      .join('\n')
      .trim();
  }

  getProjectSlug() {
    return null;
  }

  getProjectName() {
    return null;
  }

  getConversationTitleFromPage() {
    const containerSel = this._sel('container', '.dad65929');
    const chatWindow = document.querySelector(containerSel);
    if (!chatWindow) return null;
    const userMsgSel = this._sel('userMessage', '._9663006');
    const userTextSel = this._sel('userText', '.fbb737a4');
    const firstUserMessage = chatWindow.querySelector(`${userMsgSel} ${userTextSel}`);
    if (firstUserMessage) {
      const text = firstUserMessage.innerText.trim();
      return text.length > 50 ? text.substring(0, 50) + '...' : text;
    }
    const titleEl = document.querySelector('title');
    if (titleEl && titleEl.textContent.trim()) {
      const title = titleEl.textContent.trim();
      if (title && title !== 'DeepSeek' && !title.includes('DeepSeek')) {
        return title.length > 50 ? title.substring(0, 50) + '...' : title;
      }
    }
    return null;
  }
}

PlatformAdapterFactory.register(['chat.deepseek.com'], () => new DeepSeekAdapter());

window.DeepSeekAdapter = DeepSeekAdapter;

if (window.location.hostname.includes('chat.deepseek.com')) {
  window.deepseekAdapter = new DeepSeekAdapter();
  window.platformAdapter = window.deepseekAdapter;
}
