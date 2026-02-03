/**
 * Gemini 页面适配器 - 负责解析 Gemini 页面的 DOM 结构
 * 继承 BasePlatformAdapter，实现 Gemini 特定的解析逻辑
 *
 * 注意：DOM 选择器需要根据实际 Gemini 页面结构调整
 */

class GeminiAdapter extends BasePlatformAdapter {
  constructor() {
    super();
    // Gemini 特有配置
    this.debounceDelay = 600; // Gemini 可能需要更长的 debounce
  }

  // ===== 实现抽象方法 =====

  /**
   * 返回平台名称
   * @returns {string}
   */
  getPlatformName() {
    return 'Gemini';
  }

  /**
   * 返回平台图标 URL
   * @returns {string}
   */
  getPlatformIcon() {
    return 'https://www.gstatic.com/lamda/images/gemini_sparkle_v002_d4735304ff6292a690345.svg';
  }

  /**
   * 检测是否在 Gemini 对话页面
   * Gemini URL 格式：https://gemini.google.com/app/xxxx
   * @returns {boolean}
   */
  isConversationPage() {
    const url = window.location.href;
    return url.includes('gemini.google.com/app/') ||
           url.includes('gemini.google.com/chat/');
  }

  /**
   * 从 URL 获取 conversation ID
   * @returns {string|null}
   */
  getConversationId() {
    const url = window.location.href;
    // Gemini URL: https://gemini.google.com/app/xxxxxxxx
    const appMatch = url.match(/\/app\/([a-zA-Z0-9_-]+)/);
    if (appMatch) return appMatch[1];

    // 备用：https://gemini.google.com/chat/xxxxxxxx
    const chatMatch = url.match(/\/chat\/([a-zA-Z0-9_-]+)/);
    if (chatMatch) return chatMatch[1];

    return null;
  }

  /**
   * 解析页面中的消息列表
   * @returns {Array}
   */
  parseMessages() {
    const messages = [];

    try {
      if (!this.getConversationId()) {
        this.log('Not on Gemini conversation page, skip parsing');
        return messages;
      }

      // Gemini DOM 选择器（需要根据实际页面调整）
      // 尝试多种可能的选择器
      const selectors = [
        // 对话容器选择器（需调研）
        '[data-message-id]',
        '.conversation-turn',
        '.message-content',
        '[role="listitem"]',
        '.chat-message'
      ];

      let turnElements = null;
      for (const selector of selectors) {
        const elements = document.querySelectorAll(selector);
        if (elements.length > 0) {
          turnElements = elements;
          this.log('Found messages with selector:', selector);
          break;
        }
      }

      if (!turnElements || turnElements.length === 0) {
        // 尝试更通用的方法：查找包含用户/AI 消息的容器
        this.log('No messages found with predefined selectors, trying fallback');
        return this.parseMessagesFallback();
      }

      turnElements.forEach((el, index) => {
        const role = this.detectMessageRole(el);
        if (!role) return;

        const content = this.extractMessageContent(el);
        if (!content || this.isNoiseContent(content)) return;

        const messageId = `gemini_msg_${index}`;
        el.setAttribute('data-ext-message-id', messageId);
        messages.push({
          id: messageId,
          role,
          content: content.trim(),
          element: el
        });
      });

      this.log('Parsed Gemini messages:', messages.length);
    } catch (error) {
      console.error('[GeminiAdapter] Error parsing messages:', error);
    }

    return messages;
  }

  /**
   * 备用解析方法
   */
  parseMessagesFallback() {
    const messages = [];

    // 查找主要内容区域
    const mainContent = document.querySelector('main') ||
                       document.querySelector('[role="main"]') ||
                       document.querySelector('.chat-container');

    if (!mainContent) {
      this.log('No main content area found');
      return messages;
    }

    // 查找所有可能的消息块
    const allBlocks = mainContent.querySelectorAll('div[class], article, section');
    let messageIndex = 0;

    allBlocks.forEach((el) => {
      // 跳过太小或太大的元素
      const text = (el.textContent || '').trim();
      if (text.length < 2 || text.length > 50000) return;

      // 检测是否为消息
      const role = this.detectMessageRole(el);
      if (!role) return;

      // 避免嵌套重复
      if (el.querySelector('[data-ext-message-id]')) return;

      const content = this.extractMessageContent(el);
      if (!content || this.isNoiseContent(content)) return;

      const messageId = `gemini_msg_${messageIndex}`;
      el.setAttribute('data-ext-message-id', messageId);
      messages.push({
        id: messageId,
        role,
        content: content.trim(),
        element: el
      });
      messageIndex++;
    });

    return messages;
  }

  // ===== Gemini 特有方法 =====

  /**
   * 检测消息角色
   * @param {HTMLElement} element
   * @returns {'user'|'assistant'|null}
   */
  detectMessageRole(element) {
    const html = element.outerHTML.toLowerCase();
    const text = (element.textContent || '').toLowerCase();
    const classes = (element.className || '').toLowerCase();

    // 检测用户消息的特征
    const userIndicators = [
      'user-message',
      'human-message',
      'user-turn',
      'from-user',
      'query-content',
      'user-query'
    ];

    // 检测 AI 消息的特征
    const assistantIndicators = [
      'model-response',
      'assistant-message',
      'ai-message',
      'gemini-response',
      'bot-message',
      'response-content'
    ];

    for (const indicator of userIndicators) {
      if (classes.includes(indicator) || html.includes(indicator)) {
        return 'user';
      }
    }

    for (const indicator of assistantIndicators) {
      if (classes.includes(indicator) || html.includes(indicator)) {
        return 'assistant';
      }
    }

    // 检查是否有用户头像或 Gemini 图标
    const hasUserAvatar = element.querySelector('img[alt*="user" i], img[alt*="profile" i]');
    const hasGeminiIcon = element.querySelector('img[alt*="gemini" i], img[alt*="sparkle" i], svg[class*="gemini" i]');

    if (hasUserAvatar) return 'user';
    if (hasGeminiIcon) return 'assistant';

    // 检查 data 属性
    const role = element.getAttribute('data-role') ||
                 element.getAttribute('data-message-role') ||
                 element.getAttribute('data-author');
    if (role) {
      if (role.toLowerCase().includes('user') || role.toLowerCase().includes('human')) {
        return 'user';
      }
      if (role.toLowerCase().includes('model') || role.toLowerCase().includes('assistant') || role.toLowerCase().includes('gemini')) {
        return 'assistant';
      }
    }

    return null;
  }

  /**
   * 提取消息内容
   * @param {HTMLElement} element
   * @returns {string}
   */
  extractMessageContent(element) {
    // 优先查找 markdown 内容区域
    const markdownSelectors = [
      '[class*="markdown"]',
      '.message-content',
      '.response-text',
      '.query-text',
      'p',
      '.text-content'
    ];

    for (const selector of markdownSelectors) {
      const contentEl = element.querySelector(selector);
      if (contentEl) {
        const text = (contentEl.textContent || '').trim();
        if (text.length > 0) {
          return this.cleanText(text);
        }
      }
    }

    // 回退：直接获取元素文本
    const text = (element.textContent || element.innerText || '').trim();
    return this.cleanText(text);
  }

  /**
   * 清理文本
   */
  cleanText(text) {
    if (!text) return '';
    // 折叠多余空白
    text = text.replace(/[ \t]+/g, ' ');
    text = text.replace(/\n\s*\n\s*\n+/g, '\n\n');
    return text.trim();
  }

  /**
   * 判断是否为噪音内容
   */
  isNoiseContent(text) {
    if (!text || typeof text !== 'string') return true;
    const t = text.trim();
    if (t.length < 1) return true;

    // Gemini 特有的噪音模式
    const noisePatterns = [
      /^copy$/i,
      /^share$/i,
      /^edit$/i,
      /^regenerate$/i,
      /^good response$/i,
      /^bad response$/i,
      /^thumb/i
    ];

    for (const pattern of noisePatterns) {
      if (pattern.test(t)) return true;
    }

    return t.length < 2;
  }

  /**
   * Gemini 没有项目概念，返回 null
   */
  getProjectSlug() {
    return null;
  }

  /**
   * Gemini 没有项目概念，返回 null
   */
  getProjectName() {
    return null;
  }

  /**
   * 从页面获取对话标题
   * @returns {string|null}
   */
  getConversationTitleFromPage() {
    // 尝试从页面标题获取
    const titleSelectors = [
      'h1',
      '[class*="title"]',
      '[class*="header"] h2',
      'title'
    ];

    for (const selector of titleSelectors) {
      const el = document.querySelector(selector);
      if (el) {
        const text = (el.textContent || '').trim();
        // 排除通用标题
        if (text && text.length < 100 && !text.toLowerCase().includes('gemini')) {
          return text;
        }
      }
    }

    return null;
  }
}

// 在工厂中注册 Gemini 适配器
PlatformAdapterFactory.register(['gemini.google.com'], () => new GeminiAdapter());

// 全局注册
window.GeminiAdapter = GeminiAdapter;

// 如果在 Gemini 页面，注册为 platformAdapter
if (window.location.hostname.includes('gemini.google.com')) {
  window.geminiAdapter = new GeminiAdapter();
  window.platformAdapter = window.geminiAdapter;
}
