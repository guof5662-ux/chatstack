/**
 * Projects 管理器 - 管理双层项目结构
 * 1. Auto Projects - 多平台自动映射，只读
 * 2. My Projects - 用户创建，可编辑
 */

class ProjectManager {
  constructor() {
    this.DEBUG = true;
    this.projects = {
      auto: {}, // { 'Platform:slug': { name, conversations: [], platform } }
      my: {} // { projectId: { name, conversations: [], createdAt } }
    };
  }

  log(...args) {
    if (this.DEBUG) {
      console.log('[ProjectManager]', ...args);
    }
  }

  /**
   * 初始化 - 从存储加载项目数据
   */
  async init() {
    this.projects = await window.storageManager.getAllProjects();
    this.log('Initialized with projects:', this.projects);
  }

  /**
   * 保存项目数据到存储
   */
  async save() {
    await window.storageManager.saveProjects(this.projects);
    this.log('Projects saved');
  }

  /**
   * 映射会话到自动项目（多平台支持）
   * @param {string} conversationId
   * @param {string} platform - 平台名称：'ChatGPT' | 'Gemini' | ...
   * @param {string|null} projectSlug - 项目标识符
   * @param {string|null} projectName - 显示名
   */
  async mapToAutoProject(conversationId, platform, projectSlug, projectName) {
    const slug = (projectSlug && String(projectSlug).trim()) || null;
    const name = (projectName && String(projectName).trim()) || null;
    const key = slug ? `${platform}:${slug}` : `${platform}:Inbox`;

    // 从所有自动项目中移除该会话
    Object.values(this.projects.auto).forEach(project => {
      project.conversations = (project.conversations || []).filter(id => id !== conversationId);
    });

    // 确保项目存在
    if (!this.projects.auto[key]) {
      this.projects.auto[key] = {
        name: name || (slug || 'Inbox (Auto)'),
        conversations: [],
        platform: platform
      };
    }

    const project = this.projects.auto[key];
    if (name) project.name = name;
    if (!project.platform) project.platform = platform;

    // 添加会话到项目
    if (!project.conversations.includes(conversationId)) {
      project.conversations.push(conversationId);
    }

    this.cleanupEmptyAutoProjects();
    await this.save();
    this.log(`Mapped conversation ${conversationId} to ${platform} project: ${key}`);
  }

  /**
   * 兼容旧方法：映射到 ChatGPT 项目
   */
  async mapToChatGPTProject(conversationId, projectSlug, projectName) {
    return this.mapToAutoProject(conversationId, 'ChatGPT', projectSlug, projectName);
  }

  /**
   * 移除对话数为 0 的自动分类
   */
  cleanupEmptyAutoProjects() {
    Object.keys(this.projects.auto).forEach((key) => {
      const p = this.projects.auto[key];
      const count = (p && p.conversations && p.conversations.length) || 0;
      // 保留 Inbox 项目
      if (!key.endsWith(':Inbox') && count === 0) {
        delete this.projects.auto[key];
      }
    });
  }

  /**
   * 删除某个自动分类
   * @param {string} key - 格式为 'Platform:slug'
   */
  async deleteAutoProjectCategory(key) {
    const project = this.projects.auto[key];
    if (!project) return;
    const count = (project.conversations || []).length;
    delete this.projects.auto[key];
    await this.save();
    this.log(`Deleted auto project category: ${key}, ${count} conversations removed`);
  }

  /**
   * 兼容旧方法
   */
  async deleteChatGPTProjectCategory(key) {
    // 尝试新格式
    if (this.projects.auto[key]) {
      return this.deleteAutoProjectCategory(key);
    }
    // 尝试旧格式（ChatGPT:xxx）
    const newKey = `ChatGPT:${key}`;
    if (this.projects.auto[newKey]) {
      return this.deleteAutoProjectCategory(newKey);
    }
  }

  /**
   * 从所有自动项目中移除会话
   * @param {string} conversationId
   */
  async removeFromAutoProject(conversationId) {
    let changed = false;
    Object.values(this.projects.auto).forEach(project => {
      const convs = project.conversations || [];
      const before = convs.length;
      project.conversations = convs.filter(id => id !== conversationId);
      if (project.conversations.length !== before) changed = true;
    });
    if (changed) await this.save();
    this.log(`Removed conversation ${conversationId} from auto projects`);
  }

  /**
   * 兼容旧方法
   */
  async removeFromChatGPTProject(conversationId) {
    return this.removeFromAutoProject(conversationId);
  }

  /**
   * 创建用户自定义项目
   * @param {string} name - 项目名称
   * @returns {string} 项目 ID
   */
  async createMyProject(name) {
    const projectId = `my_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    this.projects.my[projectId] = {
      name,
      conversations: [],
      createdAt: Date.now()
    };

    await this.save();
    this.log(`Created My Project: ${name} (${projectId})`);

    return projectId;
  }

  /**
   * 将会话添加到用户项目
   * @param {string} conversationId
   * @param {string} projectId
   */
  async addToMyProject(conversationId, projectId) {
    if (!this.projects.my[projectId]) {
      console.error(`[ProjectManager] My Project ${projectId} not found`);
      return;
    }

    if (!this.projects.my[projectId].conversations.includes(conversationId)) {
      this.projects.my[projectId].conversations.push(conversationId);
      await this.save();
      this.log(`Added conversation ${conversationId} to My Project ${projectId}`);
    }
  }

  /**
   * 从用户项目中移除会话
   * @param {string} conversationId
   * @param {string} projectId
   */
  async removeFromMyProject(conversationId, projectId) {
    if (!this.projects.my[projectId]) {
      return;
    }

    this.projects.my[projectId].conversations =
      this.projects.my[projectId].conversations.filter(id => id !== conversationId);

    await this.save();
    this.log(`Removed conversation ${conversationId} from My Project ${projectId}`);
  }

  /**
   * 删除用户项目（不删除会话数据）
   * @param {string} projectId
   */
  async deleteMyProject(projectId) {
    if (this.projects.my[projectId]) {
      delete this.projects.my[projectId];
      await this.save();
      this.log(`Deleted My Project ${projectId}`);
    }
  }

  /**
   * 重命名用户项目
   * @param {string} projectId
   * @param {string} newName
   */
  async renameMyProject(projectId, newName) {
    if (this.projects.my[projectId]) {
      this.projects.my[projectId].name = newName;
      await this.save();
      this.log(`Renamed My Project ${projectId} to ${newName}`);
    }
  }

  /**
   * 获取所有自动项目
   * @returns {Object} { [key]: { name, conversations: [], platform } }
   */
  getAutoProjects() {
    const out = {};
    Object.entries(this.projects.auto).forEach(([k, p]) => {
      out[k] = {
        name: p.name != null ? p.name : k,
        conversations: p.conversations || [],
        platform: p.platform || 'ChatGPT' // 兼容旧数据
      };
    });
    return out;
  }

  /**
   * 按平台获取自动项目
   * @param {string} platform
   * @returns {Object}
   */
  getAutoProjectsByPlatform(platform) {
    const all = this.getAutoProjects();
    const filtered = {};
    Object.entries(all).forEach(([k, v]) => {
      if (v.platform === platform) {
        filtered[k] = v;
      }
    });
    return filtered;
  }

  /**
   * 兼容旧方法
   */
  getChatGPTProjects() {
    return this.getAutoProjectsByPlatform('ChatGPT');
  }

  /**
   * 获取所有用户项目
   * @returns {Object}
   */
  getMyProjects() {
    return this.projects.my;
  }

  /**
   * 获取会话所属的自动项目名
   * @param {string} conversationId
   * @returns {string|null}
   */
  getAutoProjectForConversation(conversationId) {
    for (const [key, project] of Object.entries(this.projects.auto)) {
      if ((project.conversations || []).includes(conversationId)) {
        return project.name != null ? project.name : key;
      }
    }
    return null;
  }

  /**
   * 兼容旧方法
   */
  getChatGPTProjectForConversation(conversationId) {
    return this.getAutoProjectForConversation(conversationId);
  }

  /**
   * 获取会话所属的用户项目列表
   * @param {string} conversationId
   * @returns {Array} [{ id, name }, ...]
   */
  getMyProjectsForConversation(conversationId) {
    const result = [];
    for (const [projectId, project] of Object.entries(this.projects.my)) {
      if (project.conversations.includes(conversationId)) {
        result.push({ id: projectId, name: project.name });
      }
    }
    return result;
  }
}

// 全局单例
window.projectManager = new ProjectManager();
