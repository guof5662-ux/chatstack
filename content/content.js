/**
 * Content Script 主入口
 * 协调各模块，初始化扩展
 */

class ChatGPTSidebarExtension {
  constructor() {
    this.DEBUG = false;
    this.initialized = false;
  }

  log(...args) {
    if (this.DEBUG) {
      console.log('[ChatGPT Sidebar Extension]', ...args);
    }
  }

  /**
   * 初始化扩展
   */
  async init() {
    if (this.initialized) return;

    this.log('Initializing extension...');

    try {
      // 等待页面加载完成
      await this.waitForPageReady();

      // 初始化各管理器
      await this.initManagers();

      // 注入侧边栏
      window.sidebarUI.inject();

      // 初始化 ChatGPT 适配器
      window.chatgptAdapter.init();

      // 开始监听页面变化
      window.chatgptAdapter.startObserving((messages) => {
        this.handleMessagesUpdate(messages);
      });

      this.initialized = true;
      this.log('Extension initialized successfully ✓');

    } catch (error) {
      console.error('[ChatGPT Sidebar Extension] Initialization error:', error);
    }
  }

  /**
   * 等待页面准备就绪
   */
  async waitForPageReady() {
    // 检查是否在会话页面
    if (!window.location.href.includes('/c/')) {
      this.log('Not on a conversation page, waiting...');

      // 监听 URL 变化
      return new Promise((resolve) => {
        const checkUrl = setInterval(() => {
          if (window.location.href.includes('/c/')) {
            clearInterval(checkUrl);
            this.log('Conversation page detected');
            resolve();
          }
        }, 300);
      });
    }

    // 等待主要内容区域加载
    await new Promise((resolve) => {
      const checkContent = setInterval(() => {
        const mainContent = document.querySelector('main');
        if (mainContent) {
          clearInterval(checkContent);
          this.log('Main content ready');
          resolve();
        }
      }, 100);
    });

    // 给 React 一点时间完成渲染再注入侧边栏，避免首屏不显示
    await new Promise((r) => setTimeout(r, 400));
  }

  /**
   * 初始化各管理器
   */
  async initManagers() {
    // 项目管理器
    await window.projectManager.init();
    this.log('ProjectManager initialized');

    // 书签管理器
    await window.bookmarkManager.init();
    this.log('BookmarkManager initialized');

    // 阅读进度管理器
    await window.progressManager.init();
    this.log('ProgressManager initialized');
  }

  /**
   * 处理消息更新
   * 关闭「自动解析并同步历史」时，不把解析结果传给侧边栏，侧边栏显示「暂无消息」且不写入存储
   */
  async handleMessagesUpdate(messages) {
    this.log('Messages updated:', messages.length);

    try {
      const config = await window.storageManager.getConfig();
      if (config && config.autoSave === false) {
        // 不展示、不同步：传空列表，侧边栏只显示空状态
        await window.sidebarUI.updateMessages([]);
        return;
      }
    } catch (e) {
      this.log('handleMessagesUpdate getConfig error:', e);
    }

    await window.sidebarUI.updateMessages(messages);
  }
}

// ============================================================================
// 启动扩展
// ============================================================================

(function() {
  'use strict';

  console.log('ChatGPT Sidebar Extension Content Script Loaded');

  // 检查是否在 ChatGPT 页面
  if (!window.location.hostname.includes('openai.com') &&
      !window.location.hostname.includes('chatgpt.com')) {
    console.log('Not on ChatGPT, extension will not activate');
    return;
  }

  // 消息内搜索：在主页面高亮关键词的样式
  if (!document.getElementById('chatgpt-sidebar-msg-highlight-style')) {
    const style = document.createElement('style');
    style.id = 'chatgpt-sidebar-msg-highlight-style';
    style.textContent = `.chatgpt-sidebar-msg-highlight { 
      background-color: rgba(92, 141, 176, 0.4) !important; 
      border: 1px solid rgba(92, 141, 176, 0.6) !important;
      border-radius: 3px !important;
      box-shadow: 0 0 0 2px rgba(92, 141, 176, 0.25) !important;
      padding: 1px 2px !important;
      color: #111827 !important;
      font-weight: 500 !important;
    }`;
    document.head.appendChild(style);
  }

  /* 分屏布局：侧边栏停靠时主内容区独立滚动并显示可见的上下滚动条（ChatGPT 滚动在 main 上） */
  if (!document.getElementById('chatgpt-sidebar-docked-layout-style')) {
    const style = document.createElement('style');
    style.id = 'chatgpt-sidebar-docked-layout-style';
    style.textContent = `
      html.chatgpt-sidebar-docked { height: 100%; }
      html.chatgpt-sidebar-docked body { height: 100%; }
      html.chatgpt-sidebar-docked main {
        overflow-y: auto !important;
        overflow-x: hidden !important;
        -webkit-overflow-scrolling: touch;
        box-sizing: border-box;
      }
      html.chatgpt-sidebar-docked main::-webkit-scrollbar { width: 6px; }
      html.chatgpt-sidebar-docked main::-webkit-scrollbar-track { background: transparent; margin: 12px 0; border-radius: 3px; }
      html.chatgpt-sidebar-docked main::-webkit-scrollbar-thumb { background: rgba(0, 0, 0, 0.14); border-radius: 3px; min-height: 40px; }
      html.chatgpt-sidebar-docked main::-webkit-scrollbar-thumb:hover { background: rgba(0, 0, 0, 0.22); }
    `;
    document.head.appendChild(style);
  }

  // 悬浮按钮样式：包装层(定位/热区) + 视觉层(图标/动画)
  if (!document.getElementById('chatgpt-sidebar-float-btn-style')) {
    const style = document.createElement('style');
    style.id = 'chatgpt-sidebar-float-btn-style';
    style.textContent = `
      /* 外层：定位、热区、拖拽（热区略大于图标便于拖拽，尺寸缩小一半） */
      .chatgpt-sidebar-float-btn {
        position: fixed;
        right: 20px;
        bottom: 20px;
        width: 58px;
        height: 58px;
        z-index: 999998;
        cursor: grab;
        user-select: none;
        -webkit-user-select: none;
        display: flex;
        align-items: center;
        justify-content: center;
      }
      .chatgpt-sidebar-float-btn.dragging {
        cursor: grabbing;
      }
      /* 内层：仅图标，无背景、无方框，效果直接加在图标上 */
      .chatgpt-sidebar-float-btn-visual {
        width: 54px;
        height: 54px;
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        background: transparent;
        transition: transform 0.25s cubic-bezier(0.33, 1, 0.68, 1), filter 0.25s ease;
        will-change: transform;
      }
      .chatgpt-sidebar-float-btn-visual .chatgpt-sidebar-float-btn-icon {
        width: 54px;
        height: 54px;
        object-fit: contain;
        display: block;
        /* 悬浮感 + 微微发光：投影 + 蓝色透亮光晕，沿图标形状 */
        filter: drop-shadow(0 0 6px rgba(135, 206, 250, 0.35)) drop-shadow(0 0 12px rgba(100, 180, 255, 0.18)) drop-shadow(0 4px 8px rgba(0, 0, 0, 0.1));
        transition: filter 0.25s ease;
      }
      /* 悬停：微微放大 + 投影加深 + 光晕稍强 */
      .chatgpt-sidebar-float-btn:hover .chatgpt-sidebar-float-btn-visual {
        filter: brightness(1.05);
      }
      .chatgpt-sidebar-float-btn:hover .chatgpt-sidebar-float-btn-visual .chatgpt-sidebar-float-btn-icon {
        filter: drop-shadow(0 0 8px rgba(135, 206, 250, 0.45)) drop-shadow(0 0 16px rgba(100, 180, 255, 0.22)) drop-shadow(0 6px 12px rgba(0, 0, 0, 0.12)) brightness(1.02);
      }
      /* 贴左边：只隐藏一部分，露出右侧约一半 */
      .chatgpt-sidebar-float-btn.edge-left .chatgpt-sidebar-float-btn-visual {
        transform: translateX(-27px);
      }
      .chatgpt-sidebar-float-btn.edge-left:hover .chatgpt-sidebar-float-btn-visual {
        transform: translateX(-27px) scale(1.08);
      }
      /* 贴右边：只隐藏一部分，露出左侧约一半 */
      .chatgpt-sidebar-float-btn.edge-right .chatgpt-sidebar-float-btn-visual {
        transform: translateX(27px);
      }
      .chatgpt-sidebar-float-btn.edge-right:hover .chatgpt-sidebar-float-btn-visual {
        transform: translateX(27px) scale(1.08);
      }
      /* 未贴边 / 展开状态 */
      .chatgpt-sidebar-float-btn.expanded .chatgpt-sidebar-float-btn-visual,
      .chatgpt-sidebar-float-btn:not(.edge-left):not(.edge-right) .chatgpt-sidebar-float-btn-visual {
        transform: translateX(0);
      }
      .chatgpt-sidebar-float-btn:not(.edge-left):not(.edge-right):hover .chatgpt-sidebar-float-btn-visual,
      .chatgpt-sidebar-float-btn.expanded:hover .chatgpt-sidebar-float-btn-visual {
        transform: translateX(0) scale(1.08);
      }
    `;
    document.head.appendChild(style);
  }

  // 创建扩展实例
  const extension = new ChatGPTSidebarExtension();

  function showPageToast(message, duration = 3000) {
    const id = 'chatgpt-sidebar-page-toast';
    const existing = document.getElementById(id);
    if (existing) existing.remove();
    const toast = document.createElement('div');
    toast.id = id;
    toast.style.cssText = 'position:fixed;bottom:24px;left:50%;transform:translateX(-50%);padding:12px 20px;background:#1f2937;color:#f9fafb;font-size:14px;border-radius:8px;box-shadow:0 4px 12px rgba(0,0,0,0.2);z-index:999999;';
    toast.textContent = message;
    document.body.appendChild(toast);
    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transition = 'opacity 0.2s';
      setTimeout(() => toast.remove(), 200);
    }, duration);
  }

  // 检查扩展上下文是否有效
  function isExtensionContextValid() {
    try {
      return !!(chrome && chrome.runtime && chrome.runtime.id);
    } catch (e) {
      return false;
    }
  }

  // 响应扩展图标点击：切换侧边栏显示
  if (isExtensionContextValid()) {
    chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
      if (msg && msg.type === 'TOGGLE_SIDEBAR') {
        (async () => {
          try {
            if (!isExtensionContextValid()) {
              sendResponse({ ok: false });
              return;
            }
            if (!window.location.href.includes('/c/')) {
              const text = window.i18nManager ? window.i18nManager.t('toast.openConversationFirst') : '请先打开或创建一个对话';
              showPageToast(text);
              sendResponse({ ok: false });
              return;
            }
            const sidebarEl = document.getElementById('chatgpt-sidebar-extension');
            if (sidebarEl && window.sidebarUI) {
              window.sidebarUI.toggle();
              sendResponse({ ok: true });
              return;
            }
            // 侧边栏尚未注入：先完成初始化再显示
            if (!extension.initialized) {
              await extension.init();
            }
            if (window.sidebarUI) {
              window.sidebarUI.show();
              sendResponse({ ok: true });
            } else {
              sendResponse({ ok: false });
            }
          } catch (e) {
            if (e && e.message && e.message.includes('Extension context invalidated')) {
              console.log('[ChatGPT Sidebar] Extension context invalidated');
              sendResponse({ ok: false });
              return;
            }
            console.error('[ChatGPT Sidebar] Toggle error:', e);
            sendResponse({ ok: false });
          }
        })();
        return true; // 保持 sendResponse 异步有效
      }
    });
  }

  function tryInitOnConversationPage() {
    const currentUrl = location.href;
    if (!currentUrl.includes('/c/')) return;
    if (extension.initialized) return;
    extension.init();
  }

  // 页面加载完成后初始化
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      tryInitOnConversationPage();
    });
  } else {
    tryInitOnConversationPage();
  }

  // 监听页面导航（SPA）：URL 变化检测
  let lastUrl = location.href;

  function onUrlChange() {
    const currentUrl = location.href;
    if (currentUrl === lastUrl) return;
    lastUrl = currentUrl;
    console.log('[ChatGPT Sidebar] URL changed:', currentUrl);
    if (currentUrl.includes('/c/')) {
      if (!extension.initialized) {
        setTimeout(() => extension.init(), 300);
      }
    }
  }

  // MutationObserver 可捕获部分 SPA 更新
  new MutationObserver(() => onUrlChange()).observe(document, { subtree: true, childList: true });

  // pushState/replaceState 不会触发 MutationObserver，用 popstate + 轮询
  window.addEventListener('popstate', onUrlChange);
  setInterval(() => onUrlChange(), 600);
})();
