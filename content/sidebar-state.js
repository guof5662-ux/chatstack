/**
 * 侧边栏状态管理模块
 * 职责：集中管理所有侧边栏相关的状态变量
 */

class SidebarState {
    constructor() {
        // 调试模式
        this.DEBUG = false;

        // DOM 引用
        this.shadowHost = null;
        this.shadowRoot = null;
        this.container = null;
        this.floatButton = null;
        this.floatButtonVisual = null;

        // 当前状态
        this.currentTab = 'toc';
        this.conversationId = null;
        this.messages = [];
        this.userClosed = false;

        // 查看对话详情状态
        this.viewingConversationId = null;

        // TOC 筛选状态
        this.tocFilterRole = 'all'; // 'all' | 'user' | 'assistant'
        this.tocFilterFavorite = false;
        this.tocFavoriteMessageIds = new Set();

        // 消息内搜索状态
        this.currentMsgSearchMessageId = null;
        this.currentMsgSearchElement = null;
        this.msgSearchFloatRoot = null;
        this.msgSearchPersist = null; // { messageId, keyword }

        // 侧边栏宽度相关
        this.sidebarWidth = 280;
        this._resizeStartX = 0;
        this._resizeStartWidth = 0;

        // 悬浮按钮拖拽状态
        this._floatBtnDragged = false;

        // TOC 视图状态
        this.currentTocView = 'toc'; // 'toc' | 'conversations'

        // 历史对话筛选状态
        this.tocFilterDateRange = null; // 'today' | 'last3Days' | 'last7Days' | 'custom'
        this.tocFilterStartDate = null;
        this.tocFilterEndDate = null;
        this.tocFilterPlatforms = []; // ['ChatGPT','Claude','Gemini'] 空数组表示不过滤
        this.tocFilterPanelOpen = false;
        this.conversationsSearchKeyword = '';
        this.conversationsFilterPanelOpen = false;

        // 项目筛选搜索状态
        this.projectsSearchKeyword = '';
        this.projectsFilterPanelOpen = false;

        // 项目标签内视图状态：切到其他标签再切回时恢复（list | conversation）
        this.projectsViewState = {
            level: 'list', // 'list' | 'conversation'
            projectType: null, // 'auto' | 'chatgpt' | 'my'
            projectKey: null,
            conversationId: null,
            conversationTitle: null,
            searchKeyword: ''
        };

        // 项目折叠状态
        this.projectSectionCollapsed = { auto: false, my: false };

        // 历史页：记录已展开的项目，避免重渲染后自动收回
        this.historyExpandedProjects = new Set();

        // 历史页：记录已收起的分区（如 ChatGPT 的"项目/你的聊天"）
        this.historySectionCollapsed = new Set();

        // 项目页：记录已展开的项目，避免重渲染后自动收回
        this.projectsExpandedItems = new Set();

        // 标签页切换相关
        this.lastNonSettingsTab = 'toc';

        // 导出模式状态
        this.exportState = {
            active: false,
            scope: null, // 'toc' | 'history' | 'projects'
            selected: new Set(),
            formats: { json: false, md: false, txt: false }
        };

        // 模块引用
        this.exportModule = null;
        this.tocModule = null;
        this.filterModule = null;
    }

    /**
     * 重置导出状态
     */
    resetExportState() {
        this.exportState = {
            active: false,
            scope: null,
            selected: new Set(),
            formats: { json: false, md: false, txt: false }
        };
    }

    /**
     * 进入导出模式
     * @param {string} scope - 'toc' | 'history' | 'projects'
     */
    enterExportMode(scope) {
        this.exportState.active = true;
        this.exportState.scope = scope;
        this.exportState.selected = new Set();
    }

    /**
     * 退出导出模式
     */
    exitExportMode() {
        this.resetExportState();
    }

    /**
     * 切换导出格式
     * @param {string} format - 'json' | 'md' | 'txt'
     */
    toggleExportFormat(format) {
        if (Object.prototype.hasOwnProperty.call(this.exportState.formats, format)) {
            this.exportState.formats[format] = !this.exportState.formats[format];
        }
    }

    /**
     * 重置所有筛选状态
     */
    resetFilters() {
        this.tocFilterRole = 'all';
        this.tocFilterFavorite = false;
        this.tocFilterDateRange = null;
        this.tocFilterStartDate = null;
        this.tocFilterEndDate = null;
        this.tocFilterPlatforms = [];
        this.conversationsSearchKeyword = '';
        this.projectsSearchKeyword = '';
    }

    /**
     * 重置项目视图状态
     */
    resetProjectsViewState() {
        this.projectsViewState = {
            level: 'list',
            projectType: null,
            projectKey: null,
            conversationId: null,
            conversationTitle: null,
            searchKeyword: ''
        };
    }

    /**
     * 清空消息内搜索状态
     */
    clearMsgSearchState() {
        this.currentMsgSearchMessageId = null;
        this.currentMsgSearchElement = null;
        this.msgSearchFloatRoot = null;
        this.msgSearchPersist = null;
    }
}

// 全局注册
window.SidebarState = SidebarState;
