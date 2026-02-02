/**
 * TOC（目录）管理器 - 管理会话内容的目录结构
 * 以用户每次提问为一个 TOC 条目
 */

class TOCManager {
  constructor() {
    this.DEBUG = true;
    this.tocItems = []; // { id, title, messageId, element }
    this.messageIdToElement = {}; // 所有消息的 messageId -> element，供搜索跳转用
  }

  log(...args) {
    if (this.DEBUG) {
      console.log('[TOCManager]', ...args);
    }
  }

  /**
   * 生成 TOC 条目标题
   * @param {string} text - 用户消息文本
   * @returns {string}
   */
  generateTitle(text) {
    // 去掉多余空白，取前 36 字
    const cleaned = text.replace(/\s+/g, ' ').trim();
    return cleaned.length > 36 ? cleaned.substring(0, 36) + '...' : cleaned;
  }

  /**
   * 从消息列表构建 TOC（每条消息单独一条，用户与 AI 均展示，便于精准分块与跳转）
   * @param {Array} messages - 消息列表 [{ id, role, content, element }]
   * @returns {Array} TOC 条目列表 [{ id, title, messageId, element, index, role, turnNumber }]
   */
  buildTOC(messages) {
    this.tocItems = [];
    this.messageIdToElement = {};

    messages.forEach((msg, index) => {
      if (msg.element) {
        this.messageIdToElement[msg.id] = msg.element;
      }
      const turnNumber = index + 1;
      const roleLabel = msg.role === 'user' ? '用户' : 'AI';
      const title = this.generateTitle(msg.content);
      this.tocItems.push({
        id: `toc_${index}`,
        title,
        messageId: msg.id,
        element: msg.element,
        index,
        role: msg.role,
        roleLabel,
        turnNumber
      });
    });

    this.log('TOC built:', this.tocItems.length, 'items');
    return this.tocItems;
  }

  /**
   * 滚动并高亮指定的消息
   * @param {HTMLElement} element - 目标消息元素
   */
  scrollToAndHighlight(element) {
    if (!element) {
      console.warn('[TOCManager] Element not found');
      return;
    }

    // 滚动到元素
    element.scrollIntoView({
      behavior: 'smooth',
      block: 'center'
    });

    // 高亮 2 秒
    const originalBg = element.style.backgroundColor;
    const originalTransition = element.style.transition;

    element.style.transition = 'background-color 0.3s ease';
    element.style.backgroundColor = 'rgba(255, 215, 0, 0.3)'; // 金色高亮

    setTimeout(() => {
      element.style.backgroundColor = originalBg;
      setTimeout(() => {
        element.style.transition = originalTransition;
      }, 300);
    }, 2000);

    this.log('Scrolled to and highlighted message');
  }

  /**
   * 根据消息 ID 跳转
   * @param {string} messageId
   */
  jumpToMessage(messageId) {
    const element = this.messageIdToElement[messageId] ||
      (this.tocItems.find(t => t.messageId === messageId) || {}).element;
    if (element) {
      this.scrollToAndHighlight(element);
    } else {
      this.log('jumpToMessage: element not found for', messageId);
    }
  }

  /**
   * 搜索消息内容
   * @param {Array} messages - 消息列表
   * @param {string} keyword - 搜索关键词
   * @returns {Array} 匹配结果 [{ messageId, role, snippet, element }]
   */
  searchMessages(messages, keyword) {
    if (!keyword || keyword.trim().length === 0) {
      return [];
    }

    const lowerKeyword = keyword.toLowerCase();
    const results = [];

    messages.forEach(msg => {
      const lowerContent = msg.content.toLowerCase();
      const index = lowerContent.indexOf(lowerKeyword);

      if (index !== -1) {
        // 提取匹配片段（前后各 20 字符）
        const start = Math.max(0, index - 20);
        const end = Math.min(msg.content.length, index + keyword.length + 20);
        let snippet = msg.content.substring(start, end);

        if (start > 0) snippet = '...' + snippet;
        if (end < msg.content.length) snippet = snippet + '...';

        results.push({
          messageId: msg.id,
          role: msg.role,
          snippet,
          element: msg.element,
          fullContent: msg.content
        });
      }
    });

    this.log('Search results:', results.length, 'matches for', keyword);
    return results;
  }

  /**
   * 获取 TOC 列表
   * @returns {Array}
   */
  getTOC() {
    return this.tocItems;
  }

  /**
   * 清空 TOC
   */
  clear() {
    this.tocItems = [];
    this.log('TOC cleared');
  }
}

// 全局单例
window.tocManager = new TOCManager();
