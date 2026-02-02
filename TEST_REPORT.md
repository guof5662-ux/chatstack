# ChatGPT Sidebar Navigator — 测试报告

**测试时间**：基于当前代码的静态检查与逻辑验证  
**说明**：浏览器 MCP 当前不可用，以下为代码级验证 + 你可本地执行的手动测试清单。

---

## ✅ 代码级验证结果

### 1. 语法检查
- **8/8** 个 JS 文件通过 Node 语法检查（无语法错误）
- 涉及文件：`storage.js`, `toc-manager.js`, `project-manager.js`, `bookmark-manager.js`, `progress-manager.js`, `chatgpt-adapter.js`, `sidebar.js`, `content.js`

### 2. 依赖与加载顺序
- `manifest.json` 中脚本顺序正确：storage → toc/project/bookmark/progress → chatgpt-adapter → sidebar → content
- 全局单例均正确挂载：`window.storageManager`, `window.tocManager`, `window.projectManager`, `window.bookmarkManager`, `window.progressManager`, `window.chatgptAdapter`, `window.sidebarUI`

### 3. 配置与存储
- `StorageManager.getConfig()` / `saveConfig()` 存在，且对无效结果有防御式处理
- 侧边栏“自动恢复阅读进度”开关已正确绑定到 `storageManager.getConfig/saveConfig`

### 4. 已修复的问题
- **搜索跳转**：此前点击「助手消息」的搜索结果不会滚动（TOC 只存了用户消息）。已在 `toc-manager.js` 中维护 `messageIdToElement` 映射，`jumpToMessage(messageId)` 现在对所有消息（含助手）均可正确跳转并高亮。

---

## 📋 请你本地执行的手动测试清单

在 Chrome 中加载扩展后，打开 ChatGPT 会话页（URL 含 `/c/`），按下面逐项勾选。

### 基础
- [ ] 右侧出现侧边栏（约 320px 宽）
- [ ] 四个 Tab 可见：目录、项目、书签、设置
- [ ] 无样式错位、无 Console 报错

### 目录 (TOC)
- [ ] 在 ChatGPT 中发 3～5 条用户消息后，侧边栏「目录」出现对应条目（前 36 字为标题）
- [ ] 点击某条目录，页面滚动到对应消息并高亮约 2 秒
- [ ] 新发一条用户消息后，目录自动更新（可等待约 0.5s debounce）

### 搜索
- [ ] 在侧边栏搜索框输入关键词，出现「搜索结果」列表
- [ ] 点击**用户消息**的搜索结果 → 能跳转并高亮
- [ ] 点击**助手消息**的搜索结果 → 能跳转并高亮（已修复）
- [ ] 清空搜索框后恢复为目录显示

### 项目
- [ ] 「项目」Tab 中能看到「ChatGPT Projects (Auto)」和「My Projects」
- [ ] 点击「+ 新建项目」、输入名称后，项目出现在「My Projects」
- [ ] 点击「添加到项目」、选择项目后，当前会话被加入该项目

### 书签
- [ ] 在「书签」Tab 点击「+ 添加书签」，最后一条用户消息被添加为书签
- [ ] 点击书签能跳转到对应消息
- [ ] 对同一条消息再次添加书签时有「已添加书签」类提示

### 阅读进度
- [ ] 在「设置」中开启「自动恢复阅读进度」
- [ ] 滚动到会话中间，等待几秒后刷新页面，能自动滚回上次位置
- [ ] 「手动恢复进度」按钮能跳转到上次阅读位置

### 数据持久化
- [ ] 创建项目、添加书签后，关闭浏览器再打开 ChatGPT，数据仍在

---

## ⚠️ 已知限制（与 README 一致）

1. **ChatGPT DOM 变化**：若 OpenAI 改版，`chatgpt-adapter.js` 中的选择器（如 `main [class*="group"]`、`[data-message-author-role]`）可能需要调整。
2. **消息解析**：当前用 `main [class*="group"], main .text-base` 等做消息容器，若页面无消息或目录为空，需在开发者工具里确认 ChatGPT 当前 DOM 是否仍匹配。
3. **自动项目**：ChatGPT 原生项目名依赖页面 DOM/URL，多数情况会归入「Inbox (Auto)」。

---

## 🔧 若侧边栏不出现或目录为空

1. 确认 URL 包含 `/c/`（会话页）。
2. 打开 F12 → Console，查看是否有 `[ChatGPT Sidebar Extension]`、`[ChatGPTAdapter]` 等日志或报错。
3. 在 Console 执行：  
   `document.querySelector('main')`  
   确认 `main` 存在；再检查是否有带 `data-testid="conversation-turn-*"` 或 `class*="group"` 的节点。
4. 到 `chrome://extensions/` 点击该扩展的「刷新」，然后刷新 ChatGPT 页面再试。

---

测试完成后，若有某一步失败或出现新的报错，把现象和 Console 报错贴出来，我可以继续帮你改。
