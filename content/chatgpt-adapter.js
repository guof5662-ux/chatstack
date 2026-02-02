/**
 * ChatGPT 页面适配器 - 负责解析 ChatGPT 页面的 DOM 结构
 * 使用 MutationObserver 监听流式输出，debounce 避免频繁重建
 */

class ChatGPTAdapter {
  constructor() {
    this.DEBUG = true;
    this.conversationId = null;
    this.messages = []; // [{ id, role, content, element }]
    this.observer = null;
    this.debounceTimer = null;
    this.debounceDelay = 500; // ms
    this.lastMessageCount = 0;
    this.onMessagesUpdated = null; // 回调函数
  }

  log(...args) {
    if (this.DEBUG) {
      console.log('[ChatGPTAdapter]', ...args);
    }
  }

  /**
   * 从 URL 获取 conversation ID
   * 支持两种对话页：普通对话 /c/xxx 、项目内对话 /g/.../c/xxx
   * @returns {string|null}
   */
  getConversationId() {
    const url = window.location.href;
    // 普通对话: https://chatgpt.com/c/697be369-6504-838d-9131-c02f849de113
    // 项目内对话: https://chatgpt.com/g/g-p-xxx-aixiang-mu/c/697b8fe3-79f4-8326-a2a7-4505f0c5dd76
    const match = url.match(/\/c\/([a-zA-Z0-9-]+)/);
    return match ? match[1] : null;
  }

  /**
   * 从 URL 获取 ChatGPT 项目 slug（/g/ 后第一段），用于稳定标识项目；重命名后 slug 不变则只更新显示名
   * @returns {string|null}
   */
  getChatGPTProjectSlug() {
    const path = window.location.pathname || '';
    if (!path.includes('/g/')) return null;
    const m = path.match(/\/g\/([^/]+)/);
    return m ? m[1] : null;
  }

  /**
   * 尝试获取 ChatGPT 原生项目名（仅当 URL 含 /g/ 时解析，否则返回 null，不把普通聊天归入自动项目）
   * @returns {string|null}
   */
  getChatGPTProjectName() {
    const trim = (s) => (typeof s === 'string' ? s.trim() : '') || null;
    const path = window.location.pathname || '';
    if (!path.includes('/g/')) return null;
    const gMatch = path.match(/\/g\/([^/]+)/);

    try {
      // 1. URL 查询参数
      const urlParams = new URLSearchParams(window.location.search);
      const projectParam = urlParams.get('project');
      if (projectParam) return trim(projectParam) || null;

      // 2. data 属性
      const dataEl = document.querySelector('[data-project-name]');
      if (dataEl) {
        const v = dataEl.getAttribute('data-project-name');
        if (trim(v)) return trim(v);
      }

      // 3. 侧栏优先：项目页（含 /g/xxx）时先取侧栏当前项目链接文本（如「咨询」）
      if (gMatch && gMatch[1]) {
        const pathSlug = gMatch[1];
        const links = document.querySelectorAll('a[href*="/g/"]');
        for (const a of links) {
          const href = (a.getAttribute('href') || '').replace(/^https?:\/\/[^/]+/, '');
          if (href.indexOf('/g/' + pathSlug) !== -1 || href.indexOf('/g/' + pathSlug + '/') !== -1) {
            const t = trim(a.textContent);
            if (t && t.length < 200) return t;
          }
        }
      }

      // 4. 主内容区标题兜底，跳过像对话/消息内容的标题（如「一、什么叫...」）
      const looksLikeConversation = (t) => {
        if (!t || t.length >= 50) return true;
        if (/^[一二三四五六七八九十]、/.test(t)) return true;
        if (t.includes('什么叫')) return true;
        return false;
      };
      const mainSelectors = ['main h1', 'main header h1', '[role="main"] h1', 'main [role="heading"]', 'main h2'];
      for (const sel of mainSelectors) {
        const el = document.querySelector(sel);
        if (el) {
          const t = trim(el.textContent);
          if (t && t.length < 200 && !looksLikeConversation(t)) return t;
        }
      }

      // 5. 回退：URL 路径解析（仅能得到 slug）
      if (gMatch && gMatch[1]) {
        const slug = gMatch[1];
        if (slug.startsWith('g-p-')) {
          return slug.replace(/^g-p-/, '').replace(/-/g, ' ') || slug;
        }
        return slug.replace(/-/g, ' ');
      }
    } catch (error) {
      this.log('Error getting ChatGPT project name:', error);
    }

    return null; // 无法获取，将归入 Inbox (Auto)
  }

  /**
   * 从当前页 DOM 读取对话标题（如「问候交流」），排除项目名；供 sidebar 保存快照时优先使用。
   * @returns {string|null}
   */
  getConversationTitleFromPage() {
    const trim = (s) => (typeof s === 'string' ? s.trim() : '') || null;
    const projectName = this.getChatGPTProjectName();
    const knownUI = new Set(['新聊天', 'New chat', '咨询']);

    const looksLikeTitle = (t) => {
      if (!t || t.length > 50) return false;
      if (knownUI.has(t)) return false;
      if (t === projectName) return false;
      if (/^https?:\/\//i.test(t)) return false;
      if (/^[一二三四五六七八九十]、/.test(t)) return false;
      return true;
    };

    try {
      const headings = document.querySelectorAll('main h1, main header h1, [role="main"] h1, main [role="heading"], main h2');
      for (const el of headings) {
        const t = trim(el.textContent);
        if (!looksLikeTitle(t)) continue;
        if (t === projectName) continue;
        return t;
      }
      return null;
    } catch (e) {
      this.log('getConversationTitleFromPage error:', e);
      return null;
    }
  }

  /**
   * 判断是否为噪音内容（非真实对话，如 UI 文案、调试信息等）
   * 不把短用户消息（如「你好」）判为噪音
   */
  isNoiseContent(text) {
    if (!text || typeof text !== 'string') return true;
    const t = text.trim();
    if (t.length < 1) return true;
    const lower = t.toLowerCase();
    if (lower.startsWith('window.') || lower.includes('__oai') && t.length < 40) return true;
    if ((t === '来源' || t === '复制代码') || (t.length < 20 && (lower.includes('来源') || lower.includes('复制代码')))) return true;
    return false;
  }

  /**
   * 解析页面中的消息列表
   * 优先使用 conversation-turn 精确分块，过滤噪音，保证每条为用户/助手真实回合
   * @returns {Array}
   */
  parseMessages() {
    const messages = [];

    try {
      if (!this.getConversationId()) {
        this.log('Not on conversation page (no /c/xxx in URL), skip parsing messages');
        return messages;
      }

      // 优先：ChatGPT 官方对话回合节点，识别最准
      const turnElements = document.querySelectorAll('[data-testid^="conversation-turn-"]');
      if (turnElements.length > 0) {
        turnElements.forEach((el, index) => {
          const roleEl = el.querySelector('[data-message-author-role="user"]') ? 'user' : el.querySelector('[data-message-author-role="assistant"]') ? 'assistant' : null;
          if (!roleEl) return;
          const content = this.extractMessageContent(el);
          if (!content || this.isNoiseContent(content)) return;
          const messageId = `msg_${index}`;
          el.setAttribute('data-ext-message-id', messageId);
          messages.push({ id: messageId, role: roleEl, content: content.trim(), element: el });
        });
        this.log('Parsed messages (conversation-turn):', messages.length);
        return messages;
      }

      // 备用：按 main 内带角色标识的块遍历，并严格过滤
      const allGroups = document.querySelectorAll('main [class*="group"], main .text-base');
      let messageIndex = 0;
      allGroups.forEach((element) => {
        const hasUser = element.querySelector('[data-message-author-role="user"]');
        const hasAssistant = element.querySelector('[data-message-author-role="assistant"]');
        let role = null;
        if (hasUser) role = 'user';
        else if (hasAssistant) role = 'assistant';
        if (!role) {
          if (this.detectUserMessage(element)) role = 'user';
          else if (this.detectAssistantMessage(element)) role = 'assistant';
        }
        if (!role) return;

        const content = this.extractMessageContent(element);
        if (!content || this.isNoiseContent(content)) return;

        const messageId = `msg_${messageIndex}`;
        element.setAttribute('data-ext-message-id', messageId);
        messages.push({ id: messageId, role, content: content.trim(), element });
        messageIndex++;
      });

    } catch (error) {
      console.error('[ChatGPTAdapter] Error parsing messages:', error);
    }

    this.log('Parsed messages:', messages.length);
    return messages;
  }

  /**
   * 检测是否为用户消息
   * @param {HTMLElement} element
   * @returns {boolean}
   */
  detectUserMessage(element) {
    // 根据实际 DOM 结构判断
    // ChatGPT 用户消息通常有特定的背景色或类名
    const text = element.textContent || '';
    const classes = element.className || '';

    // 简单启发式判断（需要根据实际调整）
    return classes.includes('bg-') || element.querySelector('img[alt*="User"]') !== null;
  }

  /**
   * 检测是否为助手消息
   * @param {HTMLElement} element
   * @returns {boolean}
   */
  detectAssistantMessage(element) {
    const classes = element.className || '';
    return element.querySelector('img[alt*="ChatGPT"]') !== null ||
           element.querySelector('[class*="markdown"]') !== null;
  }

  /**
   * 提取消息的完整文本内容（合并该回合内所有内容块，避免长回复只取到第一段）
   * @param {HTMLElement} element
   * @returns {string}
   */
  extractMessageContent(element) {
    const parts = [];
    const markdownBlocks = element.querySelectorAll('[class*="markdown"]');
    if (markdownBlocks.length > 0) {
      markdownBlocks.forEach((block) => {
        const t = (block.textContent || '').trim();
        if (t) parts.push(t);
      });
    }
    if (parts.length === 0) {
      const first = element.querySelector('div[class*="text-"]');
      const fallback = first || element;
      const t = (fallback.textContent || fallback.innerText || '').trim();
      if (t) parts.push(t);
    }
    let text = parts.join('\n\n');
    // 保留换行以维持段落/列表结构，仅折叠行内连续空格
    text = text.replace(/[ \t]+/g, ' ');
    text = text.replace(/\n\s*\n\s*\n+/g, '\n\n');
    return text.trim();
  }

  /**
   * 安排几次延迟解析，应对对话内容异步/流式渲染（长回复多段渲染完再解析一次）
   */
  scheduleDelayedParses() {
    const delays = [300, 800, 2000, 5000];
    delays.forEach((ms) => {
      setTimeout(() => {
        if (this.getConversationId()) this.updateMessages();
      }, ms);
    });
  }

  /**
   * 开始监听页面变化
   * @param {Function} callback - 消息更新时的回调函数
   */
  startObserving(callback) {
    this.onMessagesUpdated = callback;

    // 初始解析
    this.updateMessages();
    // 延迟再解析几次，应对内容异步加载
    this.scheduleDelayedParses();

    // 设置 MutationObserver
    const targetNode = document.querySelector('main') || document.body;

    const config = {
      childList: true,
      subtree: true,
      characterData: true
    };

    this.observer = new MutationObserver((mutations) => {
      this.handleMutations(mutations);
    });

    this.observer.observe(targetNode, config);

    this.log('Started observing DOM changes');
  }

  /**
   * 处理 DOM 变化（带 debounce）
   * @param {Array} mutations
   */
  handleMutations(mutations) {
    // Debounce: 避免频繁触发
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }

    this.debounceTimer = setTimeout(() => {
      this.updateMessages();
    }, this.debounceDelay);
  }

  /**
   * 更新消息列表
   * 消息数量变化或最后一条消息内容变化（如流式输出）时都会触发回调，保证侧边栏能重渲染并显示展开/收起按钮
   * @param {boolean} [forceNotify] - 为 true 时无论是否有变化都触发回调（用于「重新开启自动解析」等场景）
   */
  updateMessages(forceNotify = false) {
    const newMessages = this.parseMessages();

    const countChanged = newMessages.length !== this.lastMessageCount;
    const prevLastLen = (this.messages.length && this.messages[this.messages.length - 1].content)
      ? this.messages[this.messages.length - 1].content.length
      : 0;
    const newLastLen = (newMessages.length && newMessages[newMessages.length - 1].content)
      ? newMessages[newMessages.length - 1].content.length
      : 0;
    const contentChanged = !countChanged && newMessages.length > 0 && newLastLen !== prevLastLen;

    if (countChanged || contentChanged || forceNotify) {
      this.messages = newMessages;
      this.lastMessageCount = newMessages.length;
      if (this.onMessagesUpdated) {
        this.onMessagesUpdated(this.messages);
      }
      if (countChanged) {
        this.log('Messages updated:', this.lastMessageCount, '->', newMessages.length);
      }
      if (contentChanged) {
        this.log('Message content updated (e.g. streaming):', prevLastLen, '->', newLastLen);
      }
      if (forceNotify) {
        this.log('Messages refreshed (force notify)');
      }
    }
  }

  /**
   * 停止监听
   */
  stopObserving() {
    if (this.observer) {
      this.observer.disconnect();
      this.log('Stopped observing');
    }
  }

  /**
   * 初始化适配器
   */
  init() {
    this.conversationId = this.getConversationId();
    this.log('Initialized for conversation:', this.conversationId);

    // 监听 URL 变化（切换会话）
    this.watchURLChanges();
  }

  /**
   * 监听 URL 变化
   */
  watchURLChanges() {
    let lastUrl = window.location.href;

    const checkUrlChange = () => {
      const currentUrl = window.location.href;
      if (currentUrl !== lastUrl) {
        lastUrl = currentUrl;
        this.conversationId = this.getConversationId();
        this.log('URL changed, new conversation:', this.conversationId);

        // 立即解析一次，再延迟几次以等待 SPA 渲染新对话
        this.lastMessageCount = 0;
        this.updateMessages();
        this.scheduleDelayedParses();
      }
    };

    // 使用 setInterval 检查（简单方案）
    setInterval(checkUrlChange, 1000);

    // 或者使用 navigation API（现代浏览器）
    if (window.navigation) {
      window.navigation.addEventListener('navigate', (e) => {
        setTimeout(checkUrlChange, 100);
      });
    }
  }

  /**
   * 获取当前会话 ID
   * @returns {string|null}
   */
  getCurrentConversationId() {
    return this.conversationId;
  }

  /**
   * 获取当前消息列表
   * @returns {Array}
   */
  getMessages() {
    return this.messages;
  }
}

// 全局单例
window.chatgptAdapter = new ChatGPTAdapter();
