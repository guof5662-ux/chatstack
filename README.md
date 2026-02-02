# ChatGPT Sidebar Navigator

一个为 ChatGPT (chat.openai.com) 打造的智能侧边栏扩展，提供会话导航、双层项目管理和阅读进度等功能。

## ✨ 功能特性

### 📚 会话内 TOC（目录）
- 以每次用户提问为一个目录条目
- 自动提取前 36 字作为标题
- 点击条目跳转并高亮 2 秒
- 实时更新，支持流式输出

### 🔍 会话内搜索
- 大小写不敏感的全文搜索
- 显示匹配片段（前后各 20 字符）
- 点击结果跳转定位

### 📁 双层 Projects
**1. ChatGPT Projects (Auto) - 自动映射**
- 镜像 ChatGPT 原生项目结构
- 自动归类会话到对应项目
- 只读，不可手动修改

**2. My Projects - 用户自定义**
- 创建、重命名、删除项目
- 一个会话可加入多个项目
- 引用关系，删除项目不影响会话

### 📖 阅读进度
- 自动记录最后阅读位置
- 重进会话自动恢复
- 可手动控制开关

## 🏗️ 技术架构

### 技术栈
- **Manifest V3** - Chrome 扩展最新标准
- **原生 HTML/CSS/JS** - 无框架依赖
- **Shadow DOM** - 隔离样式，避免冲突
- **MutationObserver** - 监听流式输出，debounce 优化
- **chrome.storage.local** - 数据持久化

### 项目结构

```
chatgpt-sidebar-extension/
├── manifest.json              # 扩展配置文件
├── icons/                     # 图标资源
│   ├── icon16.png
│   ├── icon48.png
│   └── icon128.png
├── content/                   # Content Scripts
│   ├── content.js            # 主入口，协调各模块
│   ├── sidebar.js            # 侧边栏 UI 管理
│   ├── sidebar.css           # 侧边栏样式（Shadow DOM）
│   └── chatgpt-adapter.js    # ChatGPT 页面适配器
├── core/                      # 核心管理模块
│   ├── storage.js            # 存储管理
│   ├── toc-manager.js        # TOC 管理
│   ├── project-manager.js    # 项目管理
│   └── progress-manager.js   # 阅读进度管理
└── README.md                  # 本文件
```

### 数据结构

```javascript
// 会话数据
{
  id: "conversation_id",
  messages: [],
  lastRead: { messageId, scrollTop, timestamp },
  chatgptProject: "项目名或 null",
  myProjects: ["project_id_1", "project_id_2"],
  createdAt: timestamp,
  updatedAt: timestamp
}

// 项目数据
{
  chatgpt: {
    "项目名": { conversations: ["conv_id_1", ...] }
  },
  my: {
    "project_id": {
      name: "项目名",
      conversations: ["conv_id_1", ...],
      createdAt: timestamp
    }
  }
}

```

## 📦 安装步骤

### 1. 准备图标（可选）

扩展需要三个尺寸的图标：16x16、48x48、128x128 像素。

**快速方法：** 使用在线工具生成简单图标
- 访问 [favicon.io](https://favicon.io/) 或 [canva.com](https://www.canva.com/)
- 创建 128x128 的图标（建议使用 📑 emoji 或字母 "C"）
- 导出为 PNG 格式
- 调整为三个尺寸，保存到 `icons/` 目录

**临时方案：** 可以暂时使用纯色图片占位

### 2. 加载扩展到 Chrome/Edge

1. 打开浏览器，访问扩展管理页面：
   - **Chrome**: `chrome://extensions/`
   - **Edge**: `edge://extensions/`

2. 开启「开发者模式」（右上角开关）

3. 点击「加载已解压的扩展程序」

4. 选择项目文件夹 `chatgpt-sidebar-extension`

5. 扩展加载成功后，会显示在列表中

### 3. 访问 ChatGPT

打开 [https://chat.openai.com](https://chat.openai.com)，进入任意会话页面，右侧应该会自动出现侧边栏。

## 🧪 功能测试清单

### ✅ 基础功能测试

#### 1. 侧边栏注入
- [ ] 打开 ChatGPT 会话页面
- [ ] 右侧出现侧边栏，宽度 320px
- [ ] 侧边栏 Tab 可正常切换（当前对话 / 历史 / 项目）
- [ ] 样式正常，无错位

#### 2. TOC（目录）功能
- [ ] 在 ChatGPT 中提出 3-5 个问题
- [ ] 侧边栏「目录」Tab 显示所有用户提问
- [ ] 每条目录标题为问题前 36 字
- [ ] 点击目录条目，页面滚动到对应消息
- [ ] 滚动后消息高亮 2 秒（金色背景）
- [ ] 新增提问后，目录自动更新

#### 3. 搜索功能
- [ ] 在搜索框输入关键词（如 "你好"）
- [ ] 显示搜索结果列表
- [ ] 结果包含角色标识（用户/助手）
- [ ] 结果显示匹配片段
- [ ] 点击搜索结果跳转到对应消息
- [ ] 清空搜索框，恢复目录显示

#### 4. Projects（项目）功能

**ChatGPT Projects (Auto)**
- [ ] 切换到「项目」Tab
- [ ] 显示「ChatGPT Projects (Auto)」区域
- [ ] 如果会话属于某个 ChatGPT 项目，显示项目名和会话数
- [ ] 如果未归属，显示「Inbox (Auto)」

**My Projects**
- [ ] 点击「新建项目」按钮
- [ ] 输入项目名称（如 "测试项目"）
- [ ] 项目出现在「My Projects」列表
- [ ] 点击「添加到项目」按钮
- [ ] 选择刚创建的项目
- [ ] 项目会话数 +1

#### 5. 阅读进度功能
- [ ] 切换到「设置」Tab
- [ ] 阅读进度默认自动启用（无需手动开关）
- [ ] 滚动到会话中间位置
- [ ] 等待 2-3 秒（自动记录进度）
- [ ] 刷新页面或切换到其他会话再返回
- [ ] 页面自动滚动到上次阅读位置
- [ ] 点击「手动恢复进度」按钮，跳转到上次位置

### ✅ 高级测试

#### 7. 流式输出支持
- [ ] 提出一个需要长回答的问题
- [ ] 在助手回答过程中（流式输出）
- [ ] 目录不会频繁闪烁重建
- [ ] 等待回答完成后，目录正常更新

#### 8. URL 切换
- [ ] 从当前会话切换到另一个会话
- [ ] 侧边栏内容自动更新
- [ ] 显示新会话的目录
- [ ] 项目归属正确更新

#### 9. 数据持久化
- [ ] 创建项目
- [ ] 关闭浏览器
- [ ] 重新打开浏览器和 ChatGPT
- [ ] 数据仍然存在

#### 10. 多会话测试
- [ ] 打开会话 A，添加到项目「工作」
- [ ] 打开会话 B，添加到项目「工作」和「学习」
- [ ] 切换到「项目」Tab
- [ ] 项目「工作」显示 2 个会话
- [ ] 项目「学习」显示 1 个会话

## 🐛 调试技巧

### 开启开发者工具

1. 在 ChatGPT 页面，按 `F12` 打开开发者工具
2. 切换到「Console」标签页
3. 查看扩展日志（以 `[...]` 开头）

### 常见日志

```
[ChatGPT Sidebar Extension] Initializing extension...
[ChatGPTAdapter] Initialized for conversation: xxx
[StorageManager] GET ...
[TOCManager] TOC built: 5 items
[ProjectManager] Mapped conversation ... to ChatGPT project: Inbox (Auto)
```

### 查看存储数据

在 Console 中执行：

```javascript
// 查看所有存储数据
chrome.storage.local.get(null, (data) => console.log(data));

// 查看指定会话数据
chrome.storage.local.get('conv_xxx', (data) => console.log(data));

// 查看项目数据
chrome.storage.local.get('projects', (data) => console.log(data));

// 清空所有数据（谨慎使用！）
chrome.storage.local.clear();
```

### 重新加载扩展

1. 修改代码后，访问 `chrome://extensions/`
2. 找到扩展，点击「刷新」按钮
3. 刷新 ChatGPT 页面

## 🔧 自定义与扩展

### 修改侧边栏宽度

编辑 [content/sidebar.css:9](content/sidebar.css#L9)：

```css
.sidebar-container {
  width: 320px;  /* 修改为你想要的宽度，如 400px */
}
```

### 修改 Debounce 延迟

编辑 [content/chatgpt-adapter.js:12](content/chatgpt-adapter.js#L12)：

```javascript
this.debounceDelay = 500; // 修改为你想要的延迟（毫秒）
```

### 关闭开发日志

在各管理器中将 `DEBUG` 设置为 `false`：

```javascript
this.DEBUG = false;
```

或在「设置」Tab 中添加一个开关控制。

### 适配 ChatGPT UI 变化

ChatGPT 的 DOM 结构可能会变化，导致消息解析失败。

修改 [content/chatgpt-adapter.js](content/chatgpt-adapter.js) 中的选择器：

```javascript
// 找到正确的消息容器选择器
const messageElements = document.querySelectorAll('你的选择器');
```

**调试方法：**
1. 在 ChatGPT 页面打开开发者工具
2. 使用「选择元素」功能检查消息节点
3. 找到包含消息的父容器和特征类名/属性
4. 更新 `parseMessages()` 方法中的选择器

## 📝 已知限制

1. **ChatGPT Project 自动映射**：由于 ChatGPT UI 可能变化，自动项目名提取可能不准确，默认归入 "Inbox (Auto)"。需要根据实际 DOM 结构调整 `getChatGPTProjectName()` 方法。

2. **消息 ID 生成**：目前使用索引生成消息 ID，如果 ChatGPT 提供原生消息 ID，建议切换使用。

3. **数据迁移**：第一版使用 `chrome.storage.local`（限制 10MB），后续大量数据建议迁移到 IndexedDB。

4. **拖拽排序**：第一版不支持项目内会话拖拽排序，已预留数据结构。

## 🚀 后续优化方向

- [ ] 支持项目内会话拖拽排序
- [ ] 支持更多搜索选项（正则、日期筛选）
- [ ] 项目支持嵌套（子项目）
- [ ] 侧边栏位置可调（左侧/右侧）
- [ ] 快捷键支持
- [ ] 迁移到 IndexedDB
- [ ] 支持云同步（需要后端服务）

## 📄 许可证

MIT License

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

---

**享受更高效的 ChatGPT 使用体验！** 🎉
