/**
 * 阅读进度管理器 - 管理会话的阅读进度
 */

class ProgressManager {
  constructor() {
    this.DEBUG = true;
    this.progressData = {}; // { conversationId: { lastMessageId, scrollTop, timestamp } }
    this._contextInvalidated = false; // 扩展上下文已失效时不再写 storage
  }

  _isContextInvalidatedError(err) {
    if (!err) return false;
    const msg = (err.message != null ? String(err.message) : String(err)) || '';
    return msg === 'Extension context invalidated' || msg.includes('Extension context invalidated');
  }

  _markContextInvalidated() {
    this._contextInvalidated = true;
    if (this.saveTimer) {
      clearTimeout(this.saveTimer);
      this.saveTimer = null;
    }
  }

  log(...args) {
    if (this.DEBUG) {
      console.log('[ProgressManager]', ...args);
    }
  }

  /**
   * 初始化
   */
  async init() {
    this.log('Progress manager initialized');
  }

  /**
   * 记录阅读进度
   * @param {string} conversationId
   * @param {string} lastMessageId - 最后阅读的消息 ID
   * @param {number} scrollTop - 滚动位置（可选）
   */
  async recordProgress(conversationId, lastMessageId, scrollTop = 0) {
    if (this._contextInvalidated) return;
    try {
      const convData = await window.storageManager.getConversation(conversationId);
      convData.lastRead = {
        messageId: lastMessageId,
        scrollTop,
        timestamp: Date.now()
      };
      await window.storageManager.saveConversation(conversationId, convData);
      this.progressData[conversationId] = convData.lastRead;
      this.log(`Progress recorded for ${conversationId}:`, lastMessageId);
    } catch (error) {
      if (this._isContextInvalidatedError(error)) {
        this._markContextInvalidated();
      }
      // 不再 throw，避免 setTimeout 回调产生 Uncaught
    }
  }

  /**
   * 获取阅读进度
   * @param {string} conversationId
   * @returns {Promise<Object|null>} { messageId, scrollTop, timestamp }
   */
  async getProgress(conversationId) {
    if (this._contextInvalidated) return null;
    // 先从内存缓存获取
    if (this.progressData[conversationId]) {
      return this.progressData[conversationId];
    }
    try {
      const convData = await window.storageManager.getConversation(conversationId);
      if (convData.lastRead) {
        this.progressData[conversationId] = convData.lastRead;
        return convData.lastRead;
      }
    } catch (error) {
      if (this._isContextInvalidatedError(error)) {
        this._markContextInvalidated();
      }
      // 非 context invalidated 时也不抛，避免 Uncaught；返回 null 即可
      return null;
    }
    return null;
  }

  /**
   * 恢复阅读进度（滚动到上次位置）
   * @param {string} conversationId
   * @param {Array} messages - 当前会话的消息列表
   * @param {boolean} shouldScroll - 是否滚动到该位置（默认 true）
   */
  async restoreProgress(conversationId, messages, shouldScroll = true) {
    const progress = await this.getProgress(conversationId);

    if (!progress || !progress.messageId) {
      this.log('No progress to restore for', conversationId);
      return false;
    }

    // 查找对应的消息元素
    const message = messages.find(m => m.id === progress.messageId);

    if (message && message.element) {
      // 只在 shouldScroll 为 true 时才滚动到该消息
      if (shouldScroll) {
        setTimeout(() => {
          message.element.scrollIntoView({
            behavior: 'smooth',
            block: 'start'
          });
          this.log('Progress restored (with scroll):', progress.messageId);
        }, 500); // 延迟确保 DOM 已渲染
      } else {
        this.log('Progress restored (without scroll):', progress.messageId);
      }

      return true;
    } else {
      this.log('Message not found for progress:', progress.messageId);
      return false;
    }
  }

  /**
   * 自动记录当前可见的最后一条消息
   * @param {string} conversationId
   * @param {Array} messages - 消息列表
   */
  autoRecordVisibleProgress(conversationId, messages) {
    if (this._contextInvalidated) {
      if (this.saveTimer) {
        clearTimeout(this.saveTimer);
        this.saveTimer = null;
      }
      return;
    }
    if (messages.length === 0) return;

    // 找到视口中最后一条完全可见的消息
    let lastVisibleMessage = null;

    for (let i = messages.length - 1; i >= 0; i--) {
      const msg = messages[i];
      if (msg.element && this.isElementInViewport(msg.element)) {
        lastVisibleMessage = msg;
        break;
      }
    }

    if (lastVisibleMessage) {
      // 防抖：避免频繁保存
      if (this.saveTimer) {
        clearTimeout(this.saveTimer);
      }

      this.saveTimer = setTimeout(() => {
        this.recordProgress(conversationId, lastVisibleMessage.id).catch(function () {
          // 吞掉所有 rejection，避免 anonymous function 报错
        });
      }, 1000); // 1 秒后保存
    }
  }

  /**
   * 检查元素是否在视口中
   * @param {HTMLElement} element
   * @returns {boolean}
   */
  isElementInViewport(element) {
    const rect = element.getBoundingClientRect();
    return (
      rect.top >= 0 &&
      rect.left >= 0 &&
      rect.bottom <= (window.innerHeight || document.documentElement.clientHeight) &&
      rect.right <= (window.innerWidth || document.documentElement.clientWidth)
    );
  }

  /**
   * 清除指定会话的进度
   * @param {string} conversationId
   */
  async clearProgress(conversationId) {
    if (this._contextInvalidated) return;
    delete this.progressData[conversationId];
    try {
      const convData = await window.storageManager.getConversation(conversationId);
      convData.lastRead = null;
      await window.storageManager.saveConversation(conversationId, convData);
      this.log('Progress cleared for', conversationId);
    } catch (error) {
      if (this._isContextInvalidatedError(error)) {
        this._markContextInvalidated();
      }
      // 不再 throw，避免 Uncaught
    }
  }
}

// 全局单例
window.progressManager = new ProgressManager();
