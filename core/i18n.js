/**
 * 国际化模块 - 支持中英文切换
 */

class I18nManager {
  constructor() {
    this.currentLanguage = 'zh';
    this.translations = {
      zh: {
        // 标题栏
        'header.title': 'ChatStack',
        'header.subtitle': 'AI 对话侧边导航与重构工具',
        'header.refresh': '刷新',
        'header.settings': '设置',
        'header.close': '关闭',

        // 标签页
        'tab.current': '当前对话',
        'tab.history': '历史',
        'tab.projects': '项目',

        // 筛选
        'filter.all': '全部',
        'filter.user': '用户',
        'filter.ai': 'AI',
        'filter.favorite': '收藏',
        'filter.addToProject': '添加到项目',
        'filter.search.messages': '搜索消息内容...',
        'filter.search.conversations': '搜索对话标题或内容...',
        'filter.search.projects': '搜索项目/对话标题/内容...',
        'filter.search.currentConv': '搜索当前对话内容...',
        'filter.filter': '筛选',
        'filter.filterDialogAria': '筛选条件',
        'filter.selectDate': '选择日期',
        'filter.dateRange': '日期范围',
        'filter.today': '今天',
        'filter.last3Days': '最近3天',
        'filter.last7Days': '最近7天',
        'filter.startDate': '开始日期',
        'filter.endDate': '结束日期',
        'filter.platform': '平台来源',
        'filter.selectPlatform': '点击选择平台',
        'filter.apply': '筛选',
        'filter.clear': '清除筛选',

        // 角色标签
        'role.user': '用户',
        'role.assistant': 'AI',

        // 空状态
        'empty.noMessages': '暂无消息',
        'empty.noConversations': '暂无已保存的对话\n打开对话后会自动保存',
        'empty.noFilterResults': '没有符合筛选条件的对话\n可点击筛选图标清除或修改条件',
        'empty.searchResults': '搜索结果',
        'empty.loadFailed': '加载失败',
        'empty.noFilterMessages': '暂无符合筛选条件的消息',
        'empty.searching': '正在搜索对话内容...',
        'empty.noChatGPTProjects': '暂无自动项目',
        'empty.noFilterProjects': '没有符合筛选条件的项目',
        'empty.noMyProjects': '暂无自定义项目\n点击"新建项目"开始',

        // 项目
        'project.create': '新建项目',
        'project.myProjects': '我创建的项目',
        'project.myProjectsHint': '可包含任意平台的对话，由你整理',
        'project.chatgptProjects': 'ChatGPT 中的项目',
        'project.platformProjects': '同步自平台',
        'project.platformProjectsHint': '来自 ChatGPT、Gemini 等站点的文件夹，仅展示',
        'project.projectsInPlatform': '{platform} 中的项目',

        // 历史 · ChatGPT 区分
        'history.chatgpt.projects': '项目',
        'history.chatgpt.yourChats': '你的聊天',

        // 设置页面
        'settings.autoSave.title': '自动保存',
        'settings.autoSave.label': '自动解析对话并同步历史',
        'settings.autoSave.hint': '关闭后对话不会自动解析，也不会同步到历史记录',
        'settings.language.title': '显示语言',
        'settings.language.auto': '跟随系统',
        'settings.theme.title': '显示风格',
        'settings.theme.auto': '跟随系统',
        'settings.theme.light': '浅色模式',
        'settings.theme.dark': '深色模式',
        'settings.data.title': '数据管理',
        'settings.data.clearAll': '清空所有数据',

        // 操作
        'action.openInChatGPT': '在 ChatGPT 中打开',
        'action.openInPlatform': '在 {platform} 中打开',
        'action.backToList': '返回列表',
        'action.dragToResize': '拖拽调整宽度',
        'action.close': '关闭',
        'action.export': '下载',
        'action.back': '返回',
        'export.format': '格式',
        'export.zip': '打包ZIP',
        'export.selectAll': '全选',
        'export.clear': '清空',
        'export.cancel': '取消',
        'export.download': '下载',
        'export.selected': '已选 {n}',
        'export.select': '选择',
        'export.noFormat': '请选择导出格式',
        'export.noSelection': '请先选择要导出的内容',
        'export.zipUnavailable': 'ZIP 模块不可用',
        'export.done': '已开始下载',
        'export.hint.toc': '点击对话卡片可取消选择（默认全选）',
        'export.hint.history': '点击对话卡片可选择/取消',
        'export.hint.projects': '点击文件夹选择全部；展开后点击卡片选择/取消',

        // 时间（formatTimeAgo）
        'time.justNow': '刚刚',
        'time.minutesAgo': '{n} 分钟前',
        'time.hoursAgo': '{n} 小时前',
        'time.daysAgo': '{n} 天前',

        // 平台筛选
        'filter.allPlatforms': '全部平台',
        'filter.selectedPlatforms': '已选 {n} 个平台',
        'search.matchCount': '内容匹配 {n}',

        // TOC/对话条目
        'toc.expand': '展开',
        'toc.collapse': '收起',
        'toc.searchInMessage': '消息内搜索',
        'toc.copy': '复制',
        'toc.favorite': '收藏',
        'toc.noMoreContent': '无更多内容',
        'toc.summary.total': '本对话',
        'toc.summary.filtered': '筛选结果',
        'toc.summary.items': '条',

        // 历史/对话卡片
        'conv.defaultTitle': '对话',
        'conv.editTitleHint': '双击修改标题',
        'conv.openInNewTab': '在新标签打开',
        'conv.dragToProject': '拖动到其他项目',
        'conv.delete': '删除',
        'conv.removeFromProject': '从项目移出',
        'conv.loadFailed': '加载失败',
        'conv.contentMatches': '内容匹配 {n}',

        // 消息内搜索浮层
        'msgSearch.ariaLabel': '在当前消息内高亮关键词',
        'msgSearch.placeholder': '高亮定位关键词，Enter 跳转下一处',

        // 日期选择器
        'datePicker.prevYear': '上一年',
        'datePicker.prevMonth': '上一月',
        'datePicker.nextMonth': '下一月',
        'datePicker.nextYear': '下一年',
        'datePicker.today': '今天',
        'datePicker.titleFormat': '{year}年 {month}月',
        'datePicker.weekdays': '日,一,二,三,四,五,六',

        // 确认对话框
        'confirm.clearData.title': '确认清空',
        'confirm.clearData.message': '确定要清空所有数据吗？此操作不可恢复！',
        'confirm.deleteConv.title': '确认删除',
        'confirm.deleteConv.message': '确定要删除这个对话记录吗？',
        'confirm.deleteProject': '确定要删除此项目吗？',
        'confirm.deleteProject.messageMy': '确定要删除项目「{name}」吗？对话不会被删除，仅从该项目中移出。',
        'confirm.removeCategory.message': '确定要移除自动分类「{name}」吗？其下对话将归入 Inbox (Auto)。',
        'confirm.title': '确认',

        // 对话框标题/占位
        'dialog.editConvTitle': '修改对话标题',
        'dialog.editConvTitlePlaceholder': '请输入新标题',
        'dialog.editProjectName': '修改项目名称',
        'dialog.editProjectNamePlaceholder': '请输入新项目名称',
        'dialog.addToProject': '添加到项目',
        'dialog.noProjectsHint': '暂无项目，新建项目并添加当前对话',
        'dialog.enterProjectName': '输入项目名称',
        'dialog.createAndAdd': '新建并添加',
        'dialog.cancel': '取消',
        'dialog.confirm': '确定',
        'dialog.createProjectAndAdd': '新建项目并添加',
        'dialog.createProjectAndAddPlaceholder': '请输入项目名称:',
        'dialog.confirmRemoveFromProject': '确定从项目中移出此对话？',

        // Toast 消息
        'toast.progressRestored': '进度已恢复',
        'toast.noProgress': '没有保存的进度',
        'toast.dataCleared': '数据已清空',
        'toast.settingsSaved': '设置已保存',
        'toast.copied': '已复制',
        'toast.copyFailed': '复制失败',
        'toast.titleUpdated': '标题已更新',
        'toast.updateFailed': '修改失败',
        'toast.refreshed': '已刷新',
        'toast.refreshFailed': '刷新失败',
        'toast.enterProjectName': '请输入项目名称',
        'toast.noMessages': '当前会话没有消息',
        'toast.noUserMessage': '没有用户消息',
        'toast.movedToProject': '已移动到当前项目',
        'toast.cannotGetSessionId': '无法获取会话 ID',
        'toast.openConversationFirst': '请先打开或创建一个对话',

        // 对话/项目 UI
        'conv.unnamed': '未命名对话',
        'project.noConvs': '暂无对话',
        'project.editTitle': '修改标题',
        'project.deleteProject': '删除项目',
        'project.removeCategory': '移除该分类',
        'action.move': '移动',
        'float.openSidebar': '打开侧边栏',
      },

      en: {
        // Header
        'header.title': 'ChatStack',
        'header.subtitle': 'Docked Navigation for AI Chats from ChatGPT, Claude, Gemini +',
        'header.refresh': 'Refresh',
        'header.settings': 'Settings',
        'header.close': 'Close',

        // Tabs
        'tab.current': 'Current',
        'tab.history': 'History',
        'tab.projects': 'Projects',

        // Filters
        'filter.all': 'All',
        'filter.user': 'User',
        'filter.ai': 'AI',
        'filter.favorite': 'Favorites',
        'filter.addToProject': 'Add to Project',
        'filter.search.messages': 'Search messages...',
        'filter.search.conversations': 'Search conversations...',
        'filter.search.projects': 'Search projects, titles, or content...',
        'filter.search.currentConv': 'Search current conversation...',
        'filter.filter': 'Filter',
        'filter.filterDialogAria': 'Filter criteria',
        'filter.selectDate': 'Select date',
        'filter.dateRange': 'Date Range',
        'filter.today': 'Today',
        'filter.last3Days': 'Last 3 days',
        'filter.last7Days': 'Last 7 days',
        'filter.startDate': 'Start Date',
        'filter.endDate': 'End Date',
        'filter.platform': 'Platform',
        'filter.selectPlatform': 'Select platform',
        'filter.apply': 'Apply',
        'filter.clear': 'Clear',

        // Role labels
        'role.user': 'User',
        'role.assistant': 'AI',

        // Empty states
        'empty.noMessages': 'No messages',
        'empty.noConversations': 'No saved conversations\nConversations will be saved automatically',
        'empty.noFilterResults': 'No matching conversations\nClick filter icon to modify criteria',
        'empty.searchResults': 'Search Results',
        'empty.loadFailed': 'Failed to load',
        'empty.noFilterMessages': 'No messages match the filter',
        'empty.searching': 'Searching conversations...',
        'empty.noChatGPTProjects': 'No auto projects',
        'empty.noFilterProjects': 'No projects match the filter',
        'empty.noMyProjects': 'No custom projects\nClick "New Project" to start',

        // Projects
        'project.create': 'New Project',
        'project.myProjects': 'My Projects',
        'project.myProjectsHint': 'Organize conversations from any platform',
        'project.chatgptProjects': 'ChatGPT Projects',
        'project.platformProjects': 'Synced from platforms',
        'project.platformProjectsHint': 'Folders from ChatGPT, Gemini, etc. — display only',
        'project.projectsInPlatform': 'Projects in {platform}',

        // History · ChatGPT sections
        'history.chatgpt.projects': 'Projects',
        'history.chatgpt.yourChats': 'Your Chats',

        // Settings
        'settings.autoSave.title': 'Auto Save',
        'settings.autoSave.label': 'Auto parse and sync conversations',
        'settings.autoSave.hint': 'When disabled, conversations will not be parsed or synced to history',
        'settings.language.title': 'Language',
        'settings.language.auto': 'Follow System',
        'settings.theme.title': 'Theme',
        'settings.theme.auto': 'Follow System',
        'settings.theme.light': 'Light Mode',
        'settings.theme.dark': 'Dark Mode',
        'settings.data.title': 'Data Management',
        'settings.data.clearAll': 'Clear All Data',

        // Actions
        'action.openInChatGPT': 'Open in ChatGPT',
        'action.openInPlatform': 'Open in {platform}',
        'action.backToList': 'Back to list',
        'action.dragToResize': 'Drag to resize',
        'action.close': 'Close',
        'action.back': 'Back',
        'action.export': 'Download',
        'export.format': 'Format',
        'export.zip': 'ZIP',
        'export.selectAll': 'Select all',
        'export.clear': 'Clear',
        'export.cancel': 'Cancel',
        'export.download': 'Download',
        'export.selected': 'Selected {n}',
        'export.select': 'Select',
        'export.noFormat': 'Select export format',
        'export.noSelection': 'Select items to export',
        'export.zipUnavailable': 'ZIP module unavailable',
        'export.done': 'Download started',
        'export.hint.toc': 'Click a card to deselect (current conversation is preselected)',
        'export.hint.history': 'Click a card to select/deselect',
        'export.hint.projects': 'Click a folder to select all, or expand and click cards',

        // Time (formatTimeAgo)
        'time.justNow': 'Just now',
        'time.minutesAgo': '{n} min ago',
        'time.hoursAgo': '{n} hr ago',
        'time.daysAgo': '{n} days ago',

        // Platform filter
        'filter.allPlatforms': 'All platforms',
        'filter.selectedPlatforms': '{n} selected',
        'search.matchCount': 'Matches {n}',

        // TOC / conversation items
        'toc.expand': 'Expand',
        'toc.collapse': 'Collapse',
        'toc.searchInMessage': 'Search in message',
        'toc.copy': 'Copy',
        'toc.favorite': 'Favorite',
        'toc.noMoreContent': 'No more content',
        'toc.summary.total': 'Conversation',
        'toc.summary.filtered': 'Filtered',
        'toc.summary.items': 'items',

        // History / conversation cards
        'conv.defaultTitle': 'Conversation',
        'conv.editTitleHint': 'Double-click to edit title',
        'conv.openInNewTab': 'Open in new tab',
        'conv.dragToProject': 'Drag to another project',
        'conv.delete': 'Delete',
        'conv.removeFromProject': 'Remove from project',
        'conv.loadFailed': 'Failed to load',
        'conv.contentMatches': 'Matches {n}',

        // In-message search overlay
        'msgSearch.ariaLabel': 'Highlight keyword in this message',
        'msgSearch.placeholder': 'Highlight and locate keywords, Enter for next',

        // Date picker
        'datePicker.prevYear': 'Previous year',
        'datePicker.prevMonth': 'Previous month',
        'datePicker.nextMonth': 'Next month',
        'datePicker.nextYear': 'Next year',
        'datePicker.today': 'Today',
        'datePicker.titleFormat': '{month}/{year}',
        'datePicker.weekdays': 'Sun,Mon,Tue,Wed,Thu,Fri,Sat',

        // Confirm dialogs
        'confirm.clearData.title': 'Confirm Clear',
        'confirm.clearData.message': 'Are you sure you want to clear all data? This cannot be undone.',
        'confirm.deleteConv.title': 'Confirm Delete',
        'confirm.deleteConv.message': 'Are you sure you want to delete this conversation?',
        'confirm.deleteProject': 'Are you sure you want to delete this project?',
        'confirm.deleteProject.messageMy': 'Delete project 「{name}」? Conversations will not be deleted, only removed from this project.',
        'confirm.removeCategory.message': 'Remove auto category 「{name}」? Its conversations will go to Inbox (Auto).',
        'confirm.title': 'Confirm',

        // Dialog titles / placeholders
        'dialog.editConvTitle': 'Edit conversation title',
        'dialog.editConvTitlePlaceholder': 'Enter new title',
        'dialog.editProjectName': 'Edit project name',
        'dialog.editProjectNamePlaceholder': 'Enter new project name',
        'dialog.addToProject': 'Add to project',
        'dialog.noProjectsHint': 'No projects yet. Create one and add this conversation',
        'dialog.enterProjectName': 'Enter project name',
        'dialog.createAndAdd': 'Create and add',
        'dialog.cancel': 'Cancel',
        'dialog.confirm': 'OK',
        'dialog.createProjectAndAdd': 'Create project and add',
        'dialog.createProjectAndAddPlaceholder': 'Enter project name:',
        'dialog.confirmRemoveFromProject': 'Remove this conversation from project?',

        // Toast messages
        'toast.progressRestored': 'Progress restored',
        'toast.noProgress': 'No saved progress',
        'toast.dataCleared': 'Data cleared',
        'toast.settingsSaved': 'Settings saved',
        'toast.copied': 'Copied',
        'toast.copyFailed': 'Copy failed',
        'toast.titleUpdated': 'Title updated',
        'toast.updateFailed': 'Update failed',
        'toast.refreshed': 'Refreshed',
        'toast.refreshFailed': 'Refresh failed',
        'toast.enterProjectName': 'Please enter project name',
        'toast.noMessages': 'No messages in current session',
        'toast.noUserMessage': 'No user messages',
        'toast.movedToProject': 'Moved to project',
        'toast.cannotGetSessionId': 'Cannot get session ID',
        'toast.openConversationFirst': 'Please open or create a conversation first',

        // Conversation / project UI
        'conv.unnamed': 'Unnamed conversation',
        'project.noConvs': 'No conversations',
        'project.editTitle': 'Edit title',
        'project.deleteProject': 'Delete project',
        'project.removeCategory': 'Remove category',
        'action.move': 'Move',
        'float.openSidebar': 'Open sidebar',
      }
    };
  }

  /**
   * 设置当前语言
   * @param {string} lang - 'zh' | 'en'
   */
  setLanguage(lang) {
    if (this.translations[lang]) {
      this.currentLanguage = lang;
    }
  }

  /**
   * 获取当前语言
   * @returns {string}
   */
  getLanguage() {
    return this.currentLanguage;
  }

  /**
   * 获取翻译文本
   * @param {string} key - 翻译键
   * @param {Object} params - 替换参数 (可选)
   * @returns {string}
   */
  t(key, params = {}) {
    const translation = this.translations[this.currentLanguage]?.[key]
      || this.translations['zh']?.[key]
      || key;

    // 支持参数替换: t('hello.name', {name: 'World'}) => 'Hello, World'
    return translation.replace(/\{(\w+)\}/g, (_, k) => params[k] || '');
  }

  /**
   * 更新Shadow DOM中所有带data-i18n属性的元素
   * @param {ShadowRoot} shadowRoot
   */
  updateDOM(shadowRoot) {
    if (!shadowRoot) return;

    // 更新所有带 data-i18n 属性的元素（文本内容）
    shadowRoot.querySelectorAll('[data-i18n]').forEach(el => {
      const key = el.getAttribute('data-i18n');
      el.textContent = this.t(key);
    });

    // 更新所有带 data-i18n-placeholder 属性的输入框
    shadowRoot.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
      const key = el.getAttribute('data-i18n-placeholder');
      el.placeholder = this.t(key);
    });

    // 更新所有带 data-i18n-title 属性的元素
    shadowRoot.querySelectorAll('[data-i18n-title]').forEach(el => {
      const key = el.getAttribute('data-i18n-title');
      el.title = this.t(key);
    });

    // 更新所有带 data-i18n-aria-label 属性的元素
    shadowRoot.querySelectorAll('[data-i18n-aria-label]').forEach(el => {
      const key = el.getAttribute('data-i18n-aria-label');
      el.setAttribute('aria-label', this.t(key));
    });
  }
}

// 全局单例
window.i18nManager = new I18nManager();
