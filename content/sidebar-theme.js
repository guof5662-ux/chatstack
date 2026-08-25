/**
 * 侧边栏主题管理模块
 * 职责：主题检测、样式加载和主题应用
 */

class SidebarTheme {
    constructor(sidebar) {
        this.sidebar = sidebar;
    }

    /**
     * 加载样式到 Shadow DOM
     */
    async loadStyles() {
        try {
            if (!this.isExtensionContextValid()) {
                this.log('Extension context invalidated, skipping loadStyles');
                return;
            }

            const styleUrl = chrome.runtime.getURL('content/sidebar.css');
            const response = await fetch(styleUrl);
            const cssText = await response.text();

            const style = document.createElement('style');
            style.textContent = cssText;
            this.sidebar.shadowRoot.appendChild(style);
        } catch (error) {
            if (error && error.message && error.message.includes('Extension context invalidated')) {
                this.log('Extension context invalidated during loadStyles');
                return;
            }
            console.error('[SidebarTheme] loadStyles error:', error);
        }
    }

    /**
     * 根据配置判断是否使用深色模式
     * @param {string} themeConfig - 'light' | 'dark' | 'auto'
     * @returns {boolean}
     */
    isDarkMode(themeConfig = 'auto') {
        if (themeConfig === 'light') return false;
        if (themeConfig === 'dark') return true;
        // auto: 跟随系统
        return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    }

    /**
     * 应用主题设置
     * @param {string} theme - 'light' | 'dark' | 'auto'
     */
    applyTheme(theme) {
        if (!this.sidebar.container) return;

        const shouldBeDark = this.isDarkMode(theme);

        if (shouldBeDark) {
            this.sidebar.container.classList.add('dark');
        } else {
            this.sidebar.container.classList.remove('dark');
        }

        this.log('Theme applied:', theme, '->', 'dark:', shouldBeDark);
    }

    /**
     * 监听系统主题变化
     */
    watchSystemTheme() {
        if (!window.matchMedia) return;

        const darkModeQuery = window.matchMedia('(prefers-color-scheme: dark)');

        const handleThemeChange = async () => {
            try {
                if (!window.storageManager || typeof window.storageManager.getConfig !== 'function') return;
                const config = await window.storageManager.getConfig();

                // 仅当设置为 auto 时响应系统主题变化
                if (config.theme === 'auto' || !config.theme) {
                    this.applyTheme('auto');
                }
            } catch (e) {
                this.log('watchSystemTheme error:', e);
            }
        };

        // 监听主题变化
        if (darkModeQuery.addEventListener) {
            darkModeQuery.addEventListener('change', handleThemeChange);
        } else if (darkModeQuery.addListener) {
            // 兼容旧版浏览器
            darkModeQuery.addListener(handleThemeChange);
        }
    }

    // 辅助方法

    /**
     * 检查扩展上下文是否有效
     */
    isExtensionContextValid() {
        try {
            return !!(chrome && chrome.runtime && chrome.runtime.id);
        } catch {
            return false;
        }
    }

    /**
     * 日志输出
     */
    log(...args) {
        if (this.sidebar && this.sidebar.DEBUG) {
            console.log('[SidebarTheme]', ...args);
        }
    }
}

// 全局注册
window.SidebarTheme = SidebarTheme;
