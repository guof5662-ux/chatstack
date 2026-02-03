/**
 * ChatGPT 页面适配器 - 负责解析 ChatGPT 页面的 DOM 结构
 * 继承 BasePlatformAdapter，实现 ChatGPT 特定的解析逻辑
 */

class ChatGPTAdapter extends BasePlatformAdapter {
  constructor() {
    super();
    // ChatGPT 特有配置（如果有）
  }

  // ===== 实现抽象方法 =====

  /**
   * 返回平台名称
   * @returns {string}
   */
  getPlatformName() {
    return 'ChatGPT';
  }

  /**
   * 返回平台图标 URL
   * @returns {string}
   */
  getPlatformIcon() {
    return 'https://chatgpt.com/favicon.ico';
  }

  /**
   * 检测是否在 ChatGPT 对话页面
   * @returns {boolean}
   */
  isConversationPage() {
    return window.location.href.includes('/c/');
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

  // ===== ChatGPT 特有方法 =====

  /**
   * 从 URL 获取 ChatGPT 项目 slug（/g/ 后第一段），用于稳定标识项目
   * @returns {string|null}
   */
  getProjectSlug() {
    const path = window.location.pathname || '';
    if (!path.includes('/g/')) return null;
    const m = path.match(/\/g\/([^/]+)/);
    return m ? m[1] : null;
  }

  /**
   * 尝试获取 ChatGPT 原生项目名（仅当 URL 含 /g/ 时解析）
   * @returns {string|null}
   */
  getProjectName() {
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

      // 3. 侧栏优先：项目页（含 /g/xxx）时先取侧栏当前项目链接文本
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

      // 4. 主内容区标题兜底
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

    return null;
  }

  /**
   * 从当前页 DOM 读取对话标题
   * @returns {string|null}
   */
  getConversationTitleFromPage() {
    const trim = (s) => (typeof s === 'string' ? s.trim() : '') || null;
    const projectName = this.getProjectName();
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
   * 判断是否为噪音内容（覆盖基类方法）
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
   * 检测是否为用户消息
   * @param {HTMLElement} element
   * @returns {boolean}
   */
  detectUserMessage(element) {
    const classes = element.className || '';
    return classes.includes('bg-') || element.querySelector('img[alt*="User"]') !== null;
  }

  /**
   * 检测是否为助手消息
   * @param {HTMLElement} element
   * @returns {boolean}
   */
  detectAssistantMessage(element) {
    return element.querySelector('img[alt*="ChatGPT"]') !== null ||
           element.querySelector('[class*="markdown"]') !== null;
  }

  /**
   * 提取消息的完整文本内容
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
    text = text.replace(/[ \t]+/g, ' ');
    text = text.replace(/\n\s*\n\s*\n+/g, '\n\n');
    return text.trim();
  }
}

// 在工厂中注册 ChatGPT 适配器
PlatformAdapterFactory.register(['chatgpt.com', 'chat.openai.com'], () => new ChatGPTAdapter());

// 全局单例（保持向后兼容）
window.ChatGPTAdapter = ChatGPTAdapter;
window.chatgptAdapter = new ChatGPTAdapter();

// 同时注册为 platformAdapter（如果在 ChatGPT 页面）
if (window.location.hostname.includes('chatgpt.com') ||
    window.location.hostname.includes('openai.com')) {
  window.platformAdapter = window.chatgptAdapter;
}
