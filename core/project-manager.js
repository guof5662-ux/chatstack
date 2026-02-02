/**
 * Projects 管理器 - 管理双层项目结构
 * 1. ChatGPT Projects (Auto) - 自动映射，只读
 * 2. My Projects - 用户创建，可编辑
 */

class ProjectManager {
  constructor() {
    this.DEBUG = true;
    this.projects = {
      chatgpt: {}, // { projectName: { conversations: [conversationId, ...] } }
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
   * 映射会话到 ChatGPT 自动项目（按 slug 存，重命名时只更新 name，不新建分类）
   * @param {string} conversationId
   * @param {string|null} projectSlug - URL 中 /g/ 后第一段；无 /g/ 时传 null
   * @param {string|null} projectName - 显示名，用于列表标题；重命名后传新名即可
   */
  async mapToChatGPTProject(conversationId, projectSlug, projectName) {
    const slug = (projectSlug && String(projectSlug).trim()) || null;
    const name = (projectName && String(projectName).trim()) || null;

    // 记录当前会话所在的项目（改名导致 slug 变化时，用于合并旧项目到新 slug）
    const oldKeysContainingConv = [];
    Object.entries(this.projects.chatgpt).forEach(([k, project]) => {
      if ((project.conversations || []).includes(conversationId)) oldKeysContainingConv.push(k);
    });

    // 从所有 ChatGPT 项目中移除该会话
    Object.values(this.projects.chatgpt).forEach(project => {
      project.conversations = (project.conversations || []).filter(id => id !== conversationId);
    });

    if (!slug) {
      this.cleanupEmptyChatGPTProjects();
      await this.save();
      this.log(`Conversation ${conversationId} not in a ChatGPT project, not added to Auto`);
      return;
    }

    const isNewSlug = !this.projects.chatgpt[slug];
    if (isNewSlug) {
      this.projects.chatgpt[slug] = { name: name || slug, conversations: [] };
    }
    const project = this.projects.chatgpt[slug];
    if (name) project.name = name;

    // 若为新 slug 且当前会话此前只在一个旧项目中：视为 ChatGPT 项目改名，将旧项目下所有对话合并到新 slug 并删除旧项
    if (isNewSlug && oldKeysContainingConv.length === 1) {
      const oldKey = oldKeysContainingConv[0];
      const oldProject = this.projects.chatgpt[oldKey];
      if (oldProject && (oldProject.conversations || []).length > 0) {
        const toMerge = [...(oldProject.conversations || [])];
        toMerge.forEach(id => {
          if (!project.conversations.includes(id)) project.conversations.push(id);
        });
        delete this.projects.chatgpt[oldKey];
        this.log(`ChatGPT project renamed: merged ${oldKey} -> ${slug} (${toMerge.length} conversations)`);
      }
    }
    if (!project.conversations.includes(conversationId)) {
      project.conversations.push(conversationId);
    }

    this.cleanupEmptyChatGPTProjects();
    await this.save();
    this.log(`Mapped conversation ${conversationId} to ChatGPT project (slug: ${slug}, name: ${project.name})`);
  }

  /** 移除对话数为 0 的自动分类（保留 Inbox (Auto)），避免重命名后留下空项 */
  cleanupEmptyChatGPTProjects() {
    const inbox = 'Inbox (Auto)';
    Object.keys(this.projects.chatgpt).forEach((key) => {
      const p = this.projects.chatgpt[key];
      const count = (p && p.conversations && p.conversations.length) || 0;
      if (key !== inbox && count === 0) {
        delete this.projects.chatgpt[key];
      }
    });
  }

  /**
   * 删除某个 ChatGPT 自动分类（key 为 slug 或 "Inbox (Auto)"）
   * 删除即移除该分类及其下对话，不再归入任何自动项目（不放入 Inbox）
   */
  async deleteChatGPTProjectCategory(key) {
    const project = this.projects.chatgpt[key];
    if (!project) return;
    const count = (project.conversations || []).length;
    delete this.projects.chatgpt[key];
    await this.save();
    this.log(`Deleted ChatGPT project category: ${key}, ${count} conversations removed from Auto`);
  }

  /**
   * 仅从所有 ChatGPT 项目中移除会话（不加入 Inbox）
   * @param {string} conversationId
   */
  async removeFromChatGPTProject(conversationId) {
    let changed = false;
    Object.values(this.projects.chatgpt).forEach(project => {
      const convs = project.conversations || [];
      const before = convs.length;
      project.conversations = convs.filter(id => id !== conversationId);
      if (project.conversations.length !== before) changed = true;
    });
    if (changed) await this.save();
    this.log(`Removed conversation ${conversationId} from ChatGPT projects`);
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
   * 获取所有 ChatGPT 自动项目（key 为 slug 或 "Inbox (Auto)"，value 含 name 与 conversations）
   * @returns {Object} { [key]: { name: string, conversations: string[] } }
   */
  getChatGPTProjects() {
    const out = {};
    Object.entries(this.projects.chatgpt).forEach(([k, p]) => {
      out[k] = { name: p.name != null ? p.name : k, conversations: p.conversations || [] };
    });
    return out;
  }

  /**
   * 获取所有用户项目
   * @returns {Object}
   */
  getMyProjects() {
    return this.projects.my;
  }

  /**
   * 获取会话所属的 ChatGPT 项目名
   * @param {string} conversationId
   * @returns {string|null}
   */
  getChatGPTProjectForConversation(conversationId) {
    for (const [key, project] of Object.entries(this.projects.chatgpt)) {
      if ((project.conversations || []).includes(conversationId)) {
        return project.name != null ? project.name : key;
      }
    }
    return null;
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
