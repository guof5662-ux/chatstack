/**
 * 侧边栏调整大小模块
 * 职责：处理侧边栏拖拽调整宽度、页面边距适配
 */

class SidebarResizer {
    constructor(sidebar) {
        this.sidebar = sidebar;
        this.MIN_WIDTH = 240;
        this.MAX_WIDTH = 560;
    }

    /**
     * 获取需要调整页面边距的根元素
     * @returns {HTMLElement[]}
     */
    getLayoutRoots() {
        if (typeof document === 'undefined' || !document.body) return [];

        const candidates = [];
        const add = (el) => {
            if (el && !candidates.includes(el)) candidates.push(el);
        };

        // 尝试从平台适配器获取主容器
        if (window.platformAdapter && typeof window.platformAdapter.getMainContainer === 'function') {
            add(window.platformAdapter.getMainContainer());
        }

        // 常见的根元素
        add(document.querySelector('main'));
        add(document.getElementById('__next'));
        add(document.getElementById('root'));
        add(document.body);

        // 只保留最内层元素，避免对嵌套祖先重复施加 padding-right
        return candidates.filter(el => !candidates.some(other => other !== el && el.contains(other)));
    }

    /**
     * 获取 DeepSeek 输入框容器（需要特殊偏移处理）
     * @returns {HTMLElement|null}
     */
    getDeepSeekInputContainer() {
        if (!window.location || !window.location.hostname.includes('chat.deepseek.com')) return null;

        const input = document.querySelector('textarea[placeholder*="DeepSeek"]') ||
            document.querySelector('textarea[placeholder*="发送消息"]') ||
            document.querySelector('textarea');

        if (!input) return null;

        // 向上查找 fixed 或 sticky 定位的父元素
        let cur = input;
        for (let i = 0; i < 8 && cur; i += 1) {
            const style = window.getComputedStyle(cur);
            if (style && (style.position === 'fixed' || style.position === 'sticky')) {
                return cur;
            }
            cur = cur.parentElement;
        }

        return input.closest('form') || input.closest('[role="form"]') || input.closest('footer') || input.parentElement;
    }

    /**
     * 应用 DeepSeek 输入框偏移
     * @param {number} width - 侧边栏宽度
     */
    applyDeepSeekInputOffset(width) {
        const container = this.getDeepSeekInputContainer();
        if (!container) return;

        const w = String(width != null ? width : this.sidebar.sidebarWidth);

        // 保存原始样式
        if (!container.dataset.chatgptSidebarOffset) {
            container.dataset.chatgptSidebarOffset = '1';
            container.dataset.chatgptSidebarPrevRight = container.style.right || '';
            container.dataset.chatgptSidebarPrevWidth = container.style.width || '';
            container.dataset.chatgptSidebarPrevMaxWidth = container.style.maxWidth || '';
        }

        // 应用偏移
        container.style.right = `var(--chatgpt-sidebar-width)`;
        container.style.width = `calc(100% - ${w}px)`;
        container.style.maxWidth = `calc(100% - ${w}px)`;
    }

    /**
     * 清除 DeepSeek 输入框偏移
     */
    clearDeepSeekInputOffset() {
        const container = this.getDeepSeekInputContainer();
        if (!container || !container.dataset.chatgptSidebarOffset) return;

        // 恢复原始样式
        container.style.right = container.dataset.chatgptSidebarPrevRight || '';
        container.style.width = container.dataset.chatgptSidebarPrevWidth || '';
        container.style.maxWidth = container.dataset.chatgptSidebarPrevMaxWidth || '';

        delete container.dataset.chatgptSidebarOffset;
        delete container.dataset.chatgptSidebarPrevRight;
        delete container.dataset.chatgptSidebarPrevWidth;
        delete container.dataset.chatgptSidebarPrevMaxWidth;
    }

    /**
     * 应用页面边距适配（侧边栏打开时推挤页面内容）
     * @param {number} width - 侧边栏宽度
     */
    applyPageMarginForDocked(width) {
        if (typeof document === 'undefined') return;

        const w = String(width != null ? width : this.sidebar.sidebarWidth);

        // 添加全局class和CSS变量
        document.documentElement.classList.add('chatgpt-sidebar-docked');
        document.documentElement.style.setProperty('--chatgpt-sidebar-width', w + 'px');

        // 获取需要调整的根元素
        const roots = this.getLayoutRoots();

        // 拖拽时禁用过渡动画
        const transition = document.documentElement.classList.contains('chatgpt-sidebar-resizing')
            ? 'none'
            : 'padding-right 0.18s ease-out';

        roots.forEach((root) => {
            root.style.setProperty('padding-right', w + 'px');
            root.style.setProperty('box-sizing', 'border-box');
            root.style.setProperty('transition', transition);
        });

        // DeepSeek 特殊处理
        this.applyDeepSeekInputOffset(w);
    }

    /**
     * 清除页面边距适配
     */
    clearPageMarginForDocked() {
        if (typeof document === 'undefined') return;

        // 移除全局class和CSS变量
        document.documentElement.classList.remove('chatgpt-sidebar-docked', 'chatgpt-sidebar-resizing');
        document.documentElement.style.removeProperty('--chatgpt-sidebar-width');

        // 移除根元素样式
        this.getLayoutRoots().forEach((root) => {
            root.style.removeProperty('padding-right');
            root.style.removeProperty('box-sizing');
            root.style.removeProperty('transition');
        });

        this.clearDeepSeekInputOffset();
    }

    /**
     * 开始调整大小（禁用过渡动画）
     */
    startResizing() {
        if (typeof document === 'undefined') return;

        document.documentElement.classList.add('chatgpt-sidebar-resizing');

        if (this.sidebar.container) {
            this.sidebar.container.classList.add('sidebar-resizing');
        }

        this.getLayoutRoots().forEach((root) => {
            root.style.setProperty('transition', 'none');
        });
    }

    /**
     * 结束调整大小（恢复过渡动画）
     */
    endResizing() {
        if (typeof document === 'undefined') return;

        document.documentElement.classList.remove('chatgpt-sidebar-resizing');

        if (this.sidebar.container) {
            this.sidebar.container.classList.remove('sidebar-resizing');
        }

        this.getLayoutRoots().forEach((root) => {
            root.style.setProperty('transition', 'padding-right 0.18s ease-out');
        });
    }

    /**
     * 应用侧边栏宽度
     * @param {number} width - 宽度（会被限制在 MIN_WIDTH 和 MAX_WIDTH 之间）
     */
    applySidebarWidth(width) {
        const w = Math.min(this.MAX_WIDTH, Math.max(this.MIN_WIDTH, width || this.sidebar.sidebarWidth));
        this.sidebar.sidebarWidth = w;

        // 设置侧边栏容器宽度
        if (this.sidebar.container) {
            this.sidebar.container.style.width = w + 'px';
        }

        // 如果侧边栏是打开状态，应用页面边距
        if (this.sidebar.container && !this.sidebar.container.classList.contains('sidebar-hidden')) {
            this.applyPageMarginForDocked(w);
        } else {
            this.clearPageMarginForDocked();
        }
    }

    /**
     * 从存储中恢复保存的宽度
     */
    async applySavedWidth() {
        try {
            if (!window.storageManager || typeof window.storageManager.getConfig !== 'function') return;

            const config = await window.storageManager.getConfig();
            const w = config && config.sidebarWidth != null ? config.sidebarWidth : 280;

            this.sidebar.sidebarWidth = Math.min(this.MAX_WIDTH, Math.max(this.MIN_WIDTH, Number(w) || 280));
            this.applySidebarWidth(this.sidebar.sidebarWidth);
        } catch {
            this.applySidebarWidth(280);
        }
    }

    /**
     * 保存当前宽度到存储
     */
    async saveSidebarWidth() {
        try {
            if (!window.storageManager || typeof window.storageManager.getConfig !== 'function') return;

            const config = await window.storageManager.getConfig();
            config.sidebarWidth = this.sidebar.sidebarWidth;
            await window.storageManager.saveConfig(config);
        } catch (e) {
            this.log('saveSidebarWidth error:', e);
        }
    }

    /**
     * 日志输出
     */
    log(...args) {
        if (this.sidebar && this.sidebar.DEBUG) {
            console.log('[SidebarResizer]', ...args);
        }
    }
}

// 全局注册
window.SidebarResizer = SidebarResizer;
