/**
 * 侧边栏数据管理模块
 * 职责：管理消息数据、对话 ID、平台映射及数据刷新
 */
class SidebarData {
    constructor(sidebar) {
        this.sidebar = sidebar;
        this.messages = [];
        this.conversationId = null;
    }

    get _t() { return (key, params) => this.sidebar._t(key, params); }

    /**
     * 更新消息数据
     */
    async updateMessages(messages) {
        this.messages = messages;
        this.conversationId = window.platformAdapter ? window.platformAdapter.getCurrentConversationId() : null;

        // 获取配置
        const config = await window.storageManager.getConfig();

        // 始终渲染TOC（本地显示不受自动保存设置影响）
        if (this.sidebar.tocMod) await this.sidebar.tocMod.loadFavorites();
        if (this.sidebar.renderTOC) this.sidebar.renderTOC();

        // 只有在自动保存开启时才执行保存和同步操作
        if (config.autoSave !== false) {
            if (this.sidebar.saveCurrentConversationSnapshot) await this.sidebar.saveCurrentConversationSnapshot();

            // 更新 ChatGPT 项目映射
            await this.updatePlatformProjectMapping();
            if (this.conversationId) {
                setTimeout(() => { this.runUpdatePlatformProjectMappingIfSameConversation(); }, 1500);
            }

            // 历史列表：进入新对话或消息数变化时自动刷新
            // (这里简单处理：每次 updateMessages 都刷新历史，保证“当前对话”高亮和 lastActiveTime 更新)
            if (this.sidebar.conversationsModule && this.sidebar.conversationsModule.renderConversationsList) {
                this.sidebar.conversationsModule.renderConversationsList();
            }
        } else {
            this.sidebar.log('Auto-save disabled, skipping snapshot and history sync');
        }

        // 仅当侧边栏当前为展开状态时才应用主内容区边距，避免首次进入时出现空白占位
        if (this.sidebar.container && !this.sidebar.container.classList.contains('sidebar-hidden')) {
            if (this.sidebar.applyPageMarginForDocked) {
                this.sidebar.applyPageMarginForDocked(this.sidebar.sidebarWidth);
                setTimeout(() => this.sidebar.applyPageMarginForDocked(this.sidebar.sidebarWidth), 150);
            }
        }
    }

    /**
     * 更新平台项目映射（按 platform:slug 存，重命名只更新显示名）
     * 多平台均参与：ChatGPT / Gemini 等；无 slug 时归入该平台的 Inbox
     */
    async updatePlatformProjectMapping() {
        if (!this.conversationId) return;
        const platform = window.platformAdapter ? window.platformAdapter.getPlatformName() : 'Unknown';
        const slug = window.platformAdapter && window.platformAdapter.getProjectSlug ? window.platformAdapter.getProjectSlug() : null;
        const name = window.platformAdapter && window.platformAdapter.getProjectName ? window.platformAdapter.getProjectName() : null;
        await window.projectManager.mapToAutoProject(this.conversationId, platform, slug, name);
        this.sidebar.log(`${platform} project mapping updated:`, `${slug != null ? slug : 'Inbox'}${name ? ` (${name})` : ''}`);
    }

    // 兼容旧方法名
    async updateChatGPTProjectMapping() {
        return this.updatePlatformProjectMapping();
    }

    /**
     * 全局刷新插件：同步项目映射并按当前标签重绘内容，无需刷新页面
     */
    async refreshSidebar() {
        try {
            await this.updatePlatformProjectMapping();
            if (this.sidebar.currentTab === 'toc') {
                if (this.sidebar.renderTOC) this.sidebar.renderTOC();
            } else if (this.sidebar.currentTab === 'conversations') {
                if (this.sidebar.renderConversationsList) await this.sidebar.renderConversationsList();
            } else if (this.sidebar.currentTab === 'projects') {
                if (this.sidebar.renderProjects) await this.sidebar.renderProjects();
            }
            this.sidebar.showToast(this._t('toast.refreshed'));
        } catch (e) {
            this.sidebar.log('refreshSidebar error:', e);
            this.sidebar.showToast(this._t('toast.refreshFailed'));
        }
    }

    /**
     * 若仍为同一对话，延迟后再执行一次项目映射并刷新项目列表（应对切到新项目对话时 DOM 尚未渲染完成）
     */
    async runUpdatePlatformProjectMappingIfSameConversation() {
        const currentId = window.platformAdapter ? window.platformAdapter.getCurrentConversationId() : null;
        if (this.conversationId !== currentId) return;
        await this.updatePlatformProjectMapping();
        // 如果当前在项目页且展开了 Auto Projects，则刷新列表以显示最新归类
        if (this.sidebar.currentTab === 'projects' && this.sidebar.projectsModule) {
            // 简单判断：如果项目列表可见，就刷新
            if (this.sidebar.renderProjects) this.sidebar.renderProjects();
        }
    }

    /**
     * 检查当前平台上对话是否存在
     * 通过扫描当前页面DOM中的对话链接来验证
     */
    checkConversationExists(conversationId) {
        if (!window.platformAdapter) return true; // 无法验证，假设存在
        if (!conversationId) return true;

        try {
            const hostname = window.location.hostname || '';
            const links = new Set();

            // 根据平台提取对话ID（从页面DOM中）
            if (hostname.includes('chatgpt.com') || hostname.includes('openai.com')) {
                // ChatGPT: /c/{id} 格式
                document.querySelectorAll('a[href*="/c/"]').forEach(el => {
                    const match = el.href.match(/\/c\/([a-zA-Z0-9-]+)/);
                    if (match) links.add(match[1]);
                });
            } else if (hostname.includes('gemini')) {
                // Gemini: /app/{id} 格式
                document.querySelectorAll('a[href*="/app/"]').forEach(el => {
                    const match = el.href.match(/\/app\/([^/?]+)/);
                    if (match) links.add(match[1]);
                });
            } else if (hostname.includes('claude')) {
                // Claude: /chat/{id}，可能包含多段路径，统一为下划线格式
                document.querySelectorAll('a[href*="/chat/"]').forEach(el => {
                    try {
                        const url = new URL(el.href, window.location.origin);
                        const match = url.pathname.match(/\/chat\/(.+)$/);
                        if (!match || !match[1]) return;
                        const canonicalId = match[1]
                            .replace(/\/+/g, '_')
                            .replace(/_+$/, '')
                            .trim();
                        if (canonicalId) links.add(canonicalId);
                    } catch {
                        // ignore invalid href
                    }
                });
            } else if (hostname.includes('deepseek')) {
                // DeepSeek: /a/chat/s/{id} 格式 (ID会被替换为 a_chat_s_xxx)
                document.querySelectorAll('a[href*="/a/chat/s/"]').forEach(el => {
                    const match = el.href.match(/\/a\/chat\/s\/([a-zA-Z0-9_-]+)/);
                    if (match) links.add(`a_chat_s_${match[1]}`);
                });
            }

            // DOM 里没有任何会话链接时通常代表列表未渲染完整（虚拟列表/折叠/懒加载），不做否定判断
            if (links.size === 0) {
                this.sidebar.log('Check conversation skipped: no visible conversation links in DOM');
                return true;
            }

            // 检查目标对话ID是否在页面上存在
            const exists = links.has(conversationId);
            this.sidebar.log(`Check conversation ${conversationId} exists on page: ${exists}`);
            return exists;
        } catch (e) {
            this.sidebar.log('checkConversationExists error:', e);
            return true; // 出错时假设存在，避免误删
        }
    }
}

// 全局注册
window.SidebarData = SidebarData;
