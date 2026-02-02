/**
 * 书签管理器 - 管理会话内的消息书签
 */

class BookmarkManager {
  constructor() {
    this.DEBUG = true;
    this.bookmarks = []; // [{ id, conversationId, messageId, title, createdAt }]
  }

  log(...args) {
    if (this.DEBUG) {
      console.log('[BookmarkManager]', ...args);
    }
  }

  /**
   * 初始化 - 从存储加载书签数据
   */
  async init() {
    this.bookmarks = await window.storageManager.getAllBookmarks();
    this.log('Initialized with bookmarks:', this.bookmarks.length);
  }

  /**
   * 保存书签数据到存储
   */
  async save() {
    await window.storageManager.saveBookmarks(this.bookmarks);
    this.log('Bookmarks saved');
  }

  /**
   * 添加书签
   * @param {string} conversationId
   * @param {string} messageId
   * @param {string} title - 书签标题（消息片段）
   * @returns {string} 书签 ID
   */
  async addBookmark(conversationId, messageId, title) {
    const bookmarkId = `bm_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const bookmark = {
      id: bookmarkId,
      conversationId,
      messageId,
      title: title.substring(0, 60), // 限制标题长度
      createdAt: Date.now()
    };

    this.bookmarks.push(bookmark);
    await this.save();

    this.log('Bookmark added:', bookmark);
    return bookmarkId;
  }

  /**
   * 删除书签
   * @param {string} bookmarkId
   */
  async removeBookmark(bookmarkId) {
    this.bookmarks = this.bookmarks.filter(bm => bm.id !== bookmarkId);
    await this.save();
    this.log('Bookmark removed:', bookmarkId);
  }

  /**
   * 获取指定会话的所有书签
   * @param {string} conversationId
   * @returns {Array}
   */
  getBookmarksForConversation(conversationId) {
    return this.bookmarks.filter(bm => bm.conversationId === conversationId);
  }

  /**
   * 获取指定项目的所有书签
   * @param {string} projectId - 用户项目 ID
   * @returns {Array}
   */
  async getBookmarksForProject(projectId) {
    const myProjects = window.projectManager.getMyProjects();
    const project = myProjects[projectId];

    if (!project) {
      return [];
    }

    // 获取该项目下所有会话的书签
    const conversationIds = project.conversations;
    return this.bookmarks.filter(bm => conversationIds.includes(bm.conversationId));
  }

  /**
   * 检查消息是否已添加书签
   * @param {string} conversationId
   * @param {string} messageId
   * @returns {boolean}
   */
  hasBookmark(conversationId, messageId) {
    return this.bookmarks.some(
      bm => bm.conversationId === conversationId && bm.messageId === messageId
    );
  }

  /**
   * 获取所有书签
   * @returns {Array}
   */
  getAllBookmarks() {
    return this.bookmarks;
  }

  /**
   * 获取消息的书签 ID（如果存在）
   * @param {string} conversationId
   * @param {string} messageId
   * @returns {string|null}
   */
  getBookmarkId(conversationId, messageId) {
    const bookmark = this.bookmarks.find(
      bm => bm.conversationId === conversationId && bm.messageId === messageId
    );
    return bookmark ? bookmark.id : null;
  }
}

// 全局单例
window.bookmarkManager = new BookmarkManager();
