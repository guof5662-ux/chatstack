/**
 * 存储管理模块 - 统一管理 chrome.storage.local
 * 数据结构设计便于后续迁移到 IndexedDB
 */

class StorageManager {
  constructor() {
    this.DEBUG = true; // 开发模式日志开关
  }

  log(...args) {
    if (this.DEBUG) {
      console.log('[StorageManager]', ...args);
    }
  }

  /**
   * 是否为扩展上下文失效（页面卸载/扩展重载等正常情况）
   * @param {Error} err
   * @returns {boolean}
   */
  isContextInvalidated(err) {
    if (!err) return false;
    const msg = (err && (err.message || String(err))) || '';
    return msg === 'Extension context invalidated' || msg.includes('Extension context invalidated');
  }

  /**
   * 获取数据
   * @param {string|string[]} keys - 键名或键名数组
   * @returns {Promise<any>}
   */
  async get(keys) {
    const def = typeof keys === 'string' ? { [keys]: null } : {};
    try {
      if (typeof chrome === 'undefined' || !chrome.storage || !chrome.storage.local) {
        if (this.DEBUG) this.log('GET no storage API, using default');
        return def;
      }
      const result = await chrome.storage.local.get(keys);
      this.log('GET', keys, result);
      if (!result || typeof result !== 'object') {
        return def;
      }
      return result;
    } catch (error) {
      if (this.isContextInvalidated(error)) {
        if (this.DEBUG) this.log('GET context invalidated, using default');
        return def;
      }
      if (this.DEBUG) this.log('GET Error (swallowed):', error && (error.message || String(error)));
      return def;
    }
  }

  /**
   * 设置数据
   * @param {Object} items - 键值对对象
   * @returns {Promise<void>}
   */
  async set(items) {
    try {
      if (typeof chrome === 'undefined' || !chrome.storage || !chrome.storage.local) {
        if (this.DEBUG) this.log('SET no storage API, skip');
        return;
      }
      await chrome.storage.local.set(items);
      this.log('SET', items);
    } catch (error) {
      if (this.isContextInvalidated(error)) {
        if (this.DEBUG) this.log('SET context invalidated, skip');
        return;
      }
      if (this.DEBUG) this.log('SET Error (swallowed):', error && (error.message || String(error)));
      // 不再 throw，避免刷红和 Uncaught
    }
  }

  /**
   * 删除数据
   * @param {string|string[]} keys - 键名或键名数组
   * @returns {Promise<void>}
   */
  async remove(keys) {
    try {
      if (typeof chrome === 'undefined' || !chrome.storage || !chrome.storage.local) {
        if (this.DEBUG) this.log('REMOVE no storage API, skip');
        return;
      }
      await chrome.storage.local.remove(keys);
      this.log('REMOVE', keys);
    } catch (error) {
      if (this.isContextInvalidated(error)) {
        if (this.DEBUG) this.log('REMOVE context invalidated, skip');
        return;
      }
      if (this.DEBUG) this.log('REMOVE Error (swallowed):', error && (error.message || String(error)));
      // 不再 throw，避免刷红和 Uncaught
    }
  }

  /**
   * 清空所有数据
   * @returns {Promise<void>}
   */
  async clear() {
    try {
      if (typeof chrome === 'undefined' || !chrome.storage || !chrome.storage.local) {
        if (this.DEBUG) this.log('CLEAR no storage API, skip');
        return;
      }
      await chrome.storage.local.clear();
      this.log('CLEAR ALL');
    } catch (error) {
      if (this.isContextInvalidated(error)) {
        if (this.DEBUG) this.log('CLEAR context invalidated, skip');
        return;
      }
      if (this.DEBUG) this.log('CLEAR Error (swallowed):', error && (error.message || String(error)));
      // 不再 throw，避免刷红和 Uncaught
    }
  }

  /**
   * 获取会话数据
   * @param {string} conversationId
   * @returns {Promise<Object>}
   */
  async getConversation(conversationId) {
    const defaultConv = {
      id: conversationId,
      messages: [],
      lastRead: null,
      chatgptProject: null,
      myProjects: [],
      bookmarks: [],
      favoriteMessageIds: [], // 目录里收藏的消息 id，与「用户/AI」联合筛选
      createdAt: Date.now(),
      updatedAt: Date.now()
    };
    try {
      const key = `conv_${conversationId}`;
      const result = await this.get(key);
      return result[key] || defaultConv;
    } catch (error) {
      if (this.isContextInvalidated(error)) {
        if (this.DEBUG) this.log('getConversation context invalidated, using default');
        return defaultConv;
      }
      if (this.DEBUG) this.log('getConversation Error (swallowed):', error && (error.message || String(error)));
      return defaultConv;
    }
  }

  /**
   * 保存会话数据
   * @param {string} conversationId
   * @param {Object} data
   * @returns {Promise<void>}
   */
  async saveConversation(conversationId, data) {
    try {
      const key = `conv_${conversationId}`;
      data.updatedAt = Date.now();
      await this.set({ [key]: data });
    } catch (error) {
      if (this.isContextInvalidated(error)) {
        if (this.DEBUG) this.log('saveConversation context invalidated, skip');
        return;
      }
      if (this.DEBUG) this.log('saveConversation Error (swallowed):', error && (error.message || String(error)));
      // 不再 throw，避免刷红和 Uncaught
    }
  }

  /**
   * 获取对话列表（每个对话单独模块，用于侧边栏「对话」Tab）
   * @returns {Promise<Array>} [{ id, title, snippet, messageCount, lastSeenAt }]
   */
  async getConversationList() {
    try {
      const result = await this.get('conversationList');
      const list = result && result.conversationList && Array.isArray(result.conversationList) ? result.conversationList : [];
      return list;
    } catch (error) {
      if (this.isContextInvalidated(error)) return [];
      if (this.DEBUG) this.log('getConversationList Error:', error);
      return [];
    }
  }

  /**
   * 保存对话列表
   * @param {Array} list
   * @returns {Promise<void>}
   */
  async saveConversationList(list) {
    try {
      await this.set({ conversationList: list });
    } catch (error) {
      if (this.isContextInvalidated(error)) return;
      if (this.DEBUG) this.log('saveConversationList Error:', error);
    }
  }

  /**
   * 删除对话数据
   * @param {string} conversationId
   * @returns {Promise<void>}
   */
  async deleteConversation(conversationId) {
    try {
      const key = `conv_${conversationId}`;
      await this.remove(key);
      this.log('Deleted conversation:', conversationId);
    } catch (error) {
      if (this.isContextInvalidated(error)) {
        if (this.DEBUG) this.log('deleteConversation context invalidated, skip');
        return;
      }
      if (this.DEBUG) this.log('deleteConversation Error (swallowed):', error && (error.message || String(error)));
    }
  }

  /**
   * 获取所有项目
   * @returns {Promise<Object>}
   */
  async getAllProjects() {
    const result = await this.get('projects');
    return result.projects || {
      chatgpt: {}, // ChatGPT 自动项目: { projectName: { conversations: [] } }
      my: {} // 用户项目: { projectId: { name, conversations: [], createdAt } }
    };
  }

  /**
   * 保存所有项目
   * @param {Object} projects
   * @returns {Promise<void>}
   */
  async saveProjects(projects) {
    try {
      await this.set({ projects });
    } catch (error) {
      if (this.isContextInvalidated(error)) {
        if (this.DEBUG) this.log('saveProjects context invalidated, skip');
        return;
      }
      if (this.DEBUG) this.log('saveProjects Error (swallowed):', error && (error.message || String(error)));
      // 不再 throw
    }
  }

  /**
   * 获取所有书签
   * @returns {Promise<Array>}
   */
  async getAllBookmarks() {
    const result = await this.get('bookmarks');
    return result.bookmarks || [];
  }

  /**
   * 保存书签
   * @param {Array} bookmarks
   * @returns {Promise<void>}
   */
  async saveBookmarks(bookmarks) {
    try {
      await this.set({ bookmarks });
    } catch (error) {
      if (this.isContextInvalidated(error)) {
        if (this.DEBUG) this.log('saveBookmarks context invalidated, skip');
        return;
      }
      if (this.DEBUG) this.log('saveBookmarks Error (swallowed):', error && (error.message || String(error)));
      // 不再 throw
    }
  }

  /**
   * 获取配置
   * @returns {Promise<Object>}
   */
  async getConfig() {
    try {
      const result = await this.get('config');
      const defaults = this.getDefaultConfig();

      // 防御式检查：确保返回有效的配置对象
      if (!result || typeof result !== 'object') {
        this.log('getConfig: result is invalid, using defaults');
        return defaults;
      }

      // 如果 config 存在且是对象，与默认配置合并（确保新增字段有默认值）
      if (result.config && typeof result.config === 'object') {
        return { ...defaults, ...result.config };
      }

      this.log('getConfig: config not found, using defaults');
      return defaults;
    } catch (error) {
      if (this.isContextInvalidated(error)) {
        if (this.DEBUG) this.log('getConfig context invalidated, using defaults');
        return this.getDefaultConfig();
      }
      console.error('[StorageManager] getConfig Error:', error);
      return this.getDefaultConfig();
    }
  }

  /**
   * 获取默认配置
   * @returns {Object}
   */
  getDefaultConfig() {
    return {
      autoRestoreProgress: true,
      debugMode: true,
      sidebarWidth: 320,
      sidebarOpen: false, // 首屏默认只显示悬浮图标，不显示侧边栏
      floatButtonPosition: null, // { x, y, edge: 'left'|'right'|null }
      // 新增配置项
      autoSave: true,      // 自动保存：开启后自动解析对话并同步历史
      language: 'auto',    // 显示语言：'auto'=跟随系统, 'zh'=中文, 'en'=英文
      theme: 'auto'        // 主题风格：'light'=浅色, 'dark'=深色, 'auto'=跟随系统
    };
  }

  /**
   * 保存配置
   * @param {Object} config
   * @returns {Promise<void>}
   */
  async saveConfig(config) {
    try {
      await this.set({ config });
    } catch (error) {
      if (this.isContextInvalidated(error)) {
        if (this.DEBUG) this.log('saveConfig context invalidated, skip');
        return;
      }
      if (this.DEBUG) this.log('saveConfig Error (swallowed):', error && (error.message || String(error)));
      // 不再 throw
    }
  }
}

// 全局单例
window.storageManager = new StorageManager();
