/**
 * 平台适配器基类 - 定义所有平台适配器必须实现的接口
 * 提供通用方法的默认实现，子类只需实现平台特定的抽象方法
 */

class BasePlatformAdapter {
  constructor() {
    this.DEBUG = true;
    this.conversationId = null;
    this.messages = []; // [{ id, role, content, element }]
    this.observer = null;
    this.debounceTimer = null;
    this.debounceDelay = 500; // ms
    this.lastMessageCount = 0;
    this.onMessagesUpdated = null; // 回调函数
    // 当解析结果为空时是否保留上一轮消息（用于规避 DOM 短暂抖动）
    this.keepMessagesOnEmpty = false;
    this.maxEmptyParseStreak = 0; // 0=不限制；>0 表示允许空解析连续次数
    this.emptyParseStreak = 0;
  }

  /**
   * 日志输出（带平台标识）
   */
  log(...args) {
    if (this.DEBUG) {
      console.log(`[${this.getPlatformName()}Adapter]`, ...args);
    }
  }

  // ===== 必须实现的抽象方法 =====

  /**
   * 返回平台名称，如 'ChatGPT', 'Gemini', 'Claude'
   * @returns {string}
   */
  getPlatformName() {
    throw new Error('Must implement getPlatformName()');
  }

  /**
   * 返回平台图标 URL
   * @returns {string}
   */
  getPlatformIcon() {
    throw new Error('Must implement getPlatformIcon()');
  }

  /**
   * 从 URL 解析会话 ID
   * @returns {string|null}
   */
  getConversationId() {
    throw new Error('Must implement getConversationId()');
  }

  /**
   * 解析页面 DOM 获取消息列表
   * @returns {Array<{id: string, role: string, content: string, element: HTMLElement}>}
   */
  parseMessages() {
    throw new Error('Must implement parseMessages()');
  }

  /**
   * 检测是否在该平台的会话页面
   * @returns {boolean}
   */
  isConversationPage() {
    throw new Error('Must implement isConversationPage()');
  }

  // ===== 可选方法（有默认实现，子类可覆盖）=====

  /**
   * 获取平台原生项目 slug（用于自动项目映射）
   * @returns {string|null}
   */
  getProjectSlug() {
    return null;
  }

  /**
   * 获取平台原生项目名
   * @returns {string|null}
   */
  getProjectName() {
    return null;
  }

  /**
   * 从页面 DOM 获取对话标题
   * @returns {string|null}
   */
  getConversationTitleFromPage() {
    return null;
  }

  /**
   * 判断内容是否为噪音（非真实对话内容）
   * @param {string} text
   * @returns {boolean}
   */
  isNoiseContent(text) {
    if (!text || typeof text !== 'string') return true;
    const t = text.trim();
    return t.length < 1;
  }

  // ===== 通用方法（继承使用）=====

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
   * 停止监听
   */
  stopObserving() {
    if (this.observer) {
      this.observer.disconnect();
      this.log('Stopped observing');
    }
  }

  /**
   * 处理 DOM 变化（带 debounce）
   * @param {Array} mutations
   */
  handleMutations(mutations) {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }

    this.debounceTimer = setTimeout(() => {
      this.updateMessages();
    }, this.debounceDelay);
  }

  /**
   * 安排延迟解析（应对异步/流式渲染）
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
   * 更新消息列表
   * @param {boolean} [forceNotify] - 为 true 时无论是否有变化都触发回调
   */
  updateMessages(forceNotify = false) {
    const newMessages = this.parseMessages();
    if (newMessages.length === 0) {
      this.emptyParseStreak += 1;
    } else {
      this.emptyParseStreak = 0;
    }

    if (!forceNotify && this.keepMessagesOnEmpty && this.messages.length > 0 && newMessages.length === 0) {
      const currentId = this.getConversationId ? this.getConversationId() : null;
      const sameConversation = currentId && this.conversationId && currentId === this.conversationId;
      const conversationUnclear = !currentId && this.conversationId;
      const underStreakLimit = this.maxEmptyParseStreak <= 0 || this.emptyParseStreak <= this.maxEmptyParseStreak;
      if ((sameConversation || conversationUnclear) && underStreakLimit) {
        this.log('Empty parse result, keep previous messages to avoid flicker');
        return;
      }
    }

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
        this.log('Message content updated (streaming):', prevLastLen, '->', newLastLen);
      }
      if (forceNotify) {
        this.log('Messages refreshed (force notify)');
      }
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

        // 重置并重新解析
        this.messages = [];
        this.lastMessageCount = 0;
        this.emptyParseStreak = 0;
        this.updateMessages();
        this.scheduleDelayedParses();
      }
    };

    // 使用 setInterval 检查
    setInterval(checkUrlChange, 1000);

    // 使用 navigation API（现代浏览器）
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

/**
 * 平台适配器工厂
 * 根据当前域名自动选择合适的适配器
 */
class PlatformAdapterFactory {
  /**
   * 注册的适配器映射表
   * key: hostname 或 hostname 的部分匹配
   * value: 返回适配器实例的工厂函数
   */
  static adapters = {};

  /**
   * 注册一个适配器
   * @param {string|string[]} hostnames - 支持的域名
   * @param {Function} createFn - 创建适配器的工厂函数
   */
  static register(hostnames, createFn) {
    const hosts = Array.isArray(hostnames) ? hostnames : [hostnames];
    hosts.forEach(hostname => {
      this.adapters[hostname] = createFn;
    });
  }

  /**
   * 根据域名创建适配器实例
   * @param {string} hostname
   * @returns {BasePlatformAdapter|null}
   */
  static create(hostname) {
    // 精确匹配
    if (this.adapters[hostname]) {
      return this.adapters[hostname]();
    }

    // 部分匹配（如 chatgpt.com 匹配 www.chatgpt.com）
    for (const key of Object.keys(this.adapters)) {
      if (hostname.includes(key) || key.includes(hostname)) {
        return this.adapters[key]();
      }
    }

    console.warn(`[PlatformAdapterFactory] No adapter for hostname: ${hostname}`);
    return null;
  }

  /**
   * 获取所有支持的平台名称
   * @returns {string[]}
   */
  static getSupportedPlatforms() {
    return ['ChatGPT', 'Gemini', 'Claude', 'DeepSeek'];
  }

  /**
   * 检查域名是否受支持
   * @param {string} hostname
   * @returns {boolean}
   */
  static isSupported(hostname) {
    return this.create(hostname) !== null;
  }
}

// 全局注册
window.BasePlatformAdapter = BasePlatformAdapter;
window.PlatformAdapterFactory = PlatformAdapterFactory;
