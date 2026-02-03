/**
 * Gemini 页面适配器 - 负责解析 Gemini 页面的 DOM 结构
 * 继承 BasePlatformAdapter，使用 ChatMemo 验证过的精准选择器
 */

class GeminiAdapter extends BasePlatformAdapter {
  constructor() {
    super();
    this.debounceDelay = 600;
    this.keepMessagesOnEmpty = true;
    this.maxEmptyParseStreak = 0;
    this.minMessageContentLength = 1; // 允许短消息如「你好」被识别
  }

  // ===== 抽象方法实现 =====

  getPlatformName() {
    return 'Gemini';
  }

  getPlatformIcon() {
    return 'https://www.gstatic.com/lamda/images/gemini_sparkle_v002_d4735304ff6292a690345.svg';
  }

  /**
   * 检测是否在 Gemini 对话页面
   * 参考 ChatMemo 的 URL 模式：/app/id, /gem/xx/id, 多段/app/id, 多段/gem/xx/id
   */
  isConversationPage() {
    try {
      const urlObj = new URL(window.location.href);
      const hostname = urlObj.hostname;
      const pathname = urlObj.pathname || '';

      if (!hostname.includes('gemini.google.com')) return false;

      const validPatterns = [
        /^\/gem\/[^/]+\/[^/]+$/,           // /gem/*/conversation_id
        /^\/app\/[^/]+$/,                   // /app/conversation_id
        /^\/[^/]+\/[^/]+\/app\/[^/]+$/,     // /*/*/app/conversation_id
        /^\/[^/]+\/[^/]+\/gem\/[^/]+\/[^/]+$/  // /*/*/gem/*/conversation_id
      ];

      if (pathname === '/app' ||
          /^\/gem\/[^/]+$/.test(pathname) ||
          /^\/[^/]+\/[^/]+\/app$/.test(pathname) ||
          /^\/[^/]+\/[^/]+\/gem\/[^/]+$/.test(pathname)) {
        return false;
      }

      return validPatterns.some(p => p.test(pathname));
    } catch (e) {
      return false;
    }
  }

  /**
   * 从 URL 获取 conversation ID
   * 支持 /app/id, /gem/xx/id, /u/1/app/id, /u/1/gem/xx/id
   */
  getConversationId() {
    try {
      const pathname = (window.location.pathname || '').replace(/^\/+/, '');
      const segments = pathname.split('/');

      if (segments[0] === 'app' && segments[1]) return segments[1];
      if (segments[0] === 'gem' && segments.length >= 3 && segments[2]) return segments[2];
      if (segments.length >= 4 && segments[2] === 'app' && segments[3]) return segments[3];
      if (segments.length >= 5 && segments[2] === 'gem' && segments[4]) return segments[4];

      const appMatch = window.location.href.match(/\/app\/([a-zA-Z0-9_-]+)/);
      if (appMatch) return appMatch[1];
      const chatMatch = window.location.href.match(/\/chat\/([a-zA-Z0-9_-]+)/);
      if (chatMatch) return chatMatch[1];
    } catch (e) {
      // ignore
    }
    return null;
  }

  /**
   * 在根节点内查询元素，穿透 Shadow DOM（Gemini 主内容可能在 Shadow 内）
   */
  querySelectorIncludingShadow(root, selector) {
    if (!root) return null;
    const direct = root.querySelector ? root.querySelector(selector) : null;
    if (direct) return direct;
    const walk = (node) => {
      if (!node || !node.children) return null;
      for (const child of node.children) {
        if (child.shadowRoot) {
          const found = child.shadowRoot.querySelector(selector);
          if (found) return found;
          const deep = walk(child.shadowRoot);
          if (deep) return deep;
        }
        const deep = walk(child);
        if (deep) return deep;
      }
      return null;
    };
    if (root.shadowRoot) {
      const inRoot = root.shadowRoot.querySelector(selector);
      if (inRoot) return inRoot;
      return walk(root.shadowRoot) || null;
    }
    return walk(root) || null;
  }

  /**
   * 在根节点内查询所有匹配元素，穿透 Shadow DOM
   */
  querySelectorAllIncludingShadow(root, selector) {
    if (!root) return [];
    const direct = Array.from((root.querySelectorAll && root.querySelectorAll(selector)) || []);
    const fromShadow = [];
    const walk = (node) => {
      if (!node || !node.children) return;
      for (const child of node.children) {
        if (child.shadowRoot) {
          const list = child.shadowRoot.querySelectorAll(selector);
          fromShadow.push(...list);
          walk(child.shadowRoot);
        }
        walk(child);
      }
    };
    if (root.shadowRoot) {
      fromShadow.push(...(root.shadowRoot.querySelectorAll(selector) || []));
      walk(root.shadowRoot);
    }
    walk(root);
    if (direct.length > 0 || fromShadow.length > 0) return [...direct, ...fromShadow];
    return direct;
  }

  /**
   * 解析页面中的消息列表
   * 使用 #chat-history、.conversation-container、user-query .query-text、model-response .model-response-text
   */
  parseMessages() {
    const messages = [];

    try {
      if (!this.isConversationPage()) {
        this.log('Not on Gemini conversation page, skip parsing');
        return messages;
      }

      const root = document.body;
      const chatHistoryContainer = document.querySelector('#chat-history') ||
        this.querySelectorIncludingShadow(root, '#chat-history');
      if (!chatHistoryContainer) {
        this.log('Container #chat-history not found');
        return messages;
      }

      let conversationBlocks = chatHistoryContainer.querySelectorAll('.conversation-container');
      if (conversationBlocks.length === 0) {
        conversationBlocks = this.querySelectorAllIncludingShadow(root, '.conversation-container');
      }
      if (conversationBlocks.length === 0) {
        this.log('No .conversation-container found');
        return messages;
      }

      const hasEdit = Array.from(conversationBlocks).some(block => this.isInEditMode(block));
      if (hasEdit) {
        this.log('User is editing, skip parsing');
        return messages;
      }

      let index = 0;
      conversationBlocks.forEach((block) => {
        const userQueryContainer = block.querySelector('user-query .query-text');
        if (userQueryContainer) {
          const content = this.cleanText(this.extractFormattedContent(userQueryContainer));
          if (content && content.length >= this.minMessageContentLength && !this.looksLikeDisclaimer(content)) {
            const messageId = `gemini_msg_${index}`;
            index += 1;
            const el = userQueryContainer;
            if (el.setAttribute) el.setAttribute('data-ext-message-id', messageId);
            messages.push({ id: messageId, role: 'user', content: content.trim(), element: el });
          }
        }

        const modelResponseEntity = block.querySelector('model-response');
        if (modelResponseEntity) {
          const messageContentContainer = modelResponseEntity.querySelector('.model-response-text');
          const textEl = messageContentContainer || modelResponseEntity;
          const raw = this.extractFormattedContent(textEl);
          const content = this.cleanText(raw);
          if (content && content.length >= this.minMessageContentLength && !this.looksLikeDisclaimer(content)) {
            const messageId = `gemini_msg_${index}`;
            index += 1;
            if (textEl.setAttribute) textEl.setAttribute('data-ext-message-id', messageId);
            messages.push({ id: messageId, role: 'assistant', content: content.trim(), element: textEl });
          }
        }
      });

      const deduped = this.dedupeMessages(messages);
      this.log('Parsed Gemini messages:', deduped.length);
      return deduped;
    } catch (error) {
      console.error('[GeminiAdapter] Error parsing messages:', error);
      return messages;
    }
  }

  // ===== 辅助方法（参考 ChatMemo）=====

  /**
   * 检查是否处于编辑状态（避免在用户输入时解析）
   */
  isInEditMode(element) {
    if (!element) return false;
    const activeTextarea = element.querySelector('textarea:focus');
    return !!activeTextarea;
  }

  /**
   * 提取格式化内容的可见文本
   */
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

  looksLikeDisclaimer(text) {
    if (!text || !text.trim()) return false;
    const t = text.trim();
    const patterns = [
      /未必正确无误/, /请注意核查/, /你的隐私权与 gemini/i, /gemini 的回答/i,
      /open in new window/i, /在新窗口中打开/
    ];
    return patterns.some(p => p.test(t));
  }

  /**
   * 清理文本：不可见字符、多余空白
   */
  cleanText(text) {
    if (!text) return '';
    let t = String(text);
    t = t.replace(/\u00A0/g, ' ');
    t = t.replace(/[\u200B-\u200F\uFEFF\u2060]/g, '');
    t = t.replace(/\r/g, '');
    t = t.replace(/[ \t]+/g, ' ');
    t = t.replace(/\n\s*\n\s*\n+/g, '\n\n');
    return t.trim();
  }

  /**
   * 去重：同 role 且内容前 120 字符相同视为重复
   */
  dedupeMessages(messages) {
    const out = [];
    const seen = new Set();
    messages.forEach((m) => {
      const key = `${m.role}:${(m.content || '').trim().slice(0, 120)}`;
      if (seen.has(key)) return;
      seen.add(key);
      out.push(m);
    });
    return out;
  }

  // ===== 可选方法（保持与 sidebar 兼容）=====

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
      if (title && title !== 'Gemini' && !title.includes('Google')) {
        return title.length > 50 ? title.substring(0, 50) + '...' : title;
      }
    }
    const firstUser = document.querySelector('[data-test-id="user-message"]');
    if (firstUser) {
      const text = (firstUser.innerText || '').trim();
      if (text) return text.length > 50 ? text.substring(0, 50) + '...' : text;
    }
    return null;
  }
}

// 注册适配器
PlatformAdapterFactory.register(['gemini.google.com'], () => new GeminiAdapter());

window.GeminiAdapter = GeminiAdapter;

if (window.location.hostname.includes('gemini.google.com')) {
  window.geminiAdapter = new GeminiAdapter();
  window.platformAdapter = window.geminiAdapter;
}
