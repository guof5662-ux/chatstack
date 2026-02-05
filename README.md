# ChatStack

智能目录、多平台对话与项目分组；搜索跳转、收藏与导出。支持 **ChatGPT**、**Gemini**、**Claude**、**DeepSeek**。

---

## 功能

- **会话内目录 (TOC)**：按每条提问生成目录，点击跳转并高亮
- **全文搜索**：关键词搜索，显示匹配片段，点击定位
- **项目分组**：自动映射平台项目 + 自定义「我的项目」，一个会话可归入多项目
- **导出**：侧边栏内导出对话（Markdown / 压缩包等）
- **多平台**：同一套侧边栏逻辑，适配上述四个站点

## 安装

### 从 Chrome 网上应用店（推荐）

若已上架，在 Chrome 或 Edge 中搜索 **ChatStack** 安装即可。

### 手动加载（开发者/未上架时）

1. 打开 `chrome://extensions/`（Chrome）或 `edge://extensions/`（Edge）
2. 开启右上角「开发者模式」
3. 点击「加载已解压的扩展程序」，选择本仓库解压后的文件夹

## 支持站点

| 平台    | 网址 |
|---------|------|
| ChatGPT | [chat.openai.com](https://chat.openai.com) / [chatgpt.com](https://chatgpt.com) |
| Gemini  | [gemini.google.com](https://gemini.google.com) |
| Claude  | [claude.ai](https://claude.ai) |
| DeepSeek | [chat.deepseek.com](https://chat.deepseek.com) |

访问上述任意站点并打开对话页，右侧会出现侧边栏。

## 项目结构

```
├── manifest.json       # 扩展配置 (Manifest V3)
├── background.js       # Service Worker
├── _locales/           # 多语言 (en, zh_CN)
├── content/            # 内容脚本与侧边栏
│   ├── content.js      # 入口
│   ├── sidebar.js      # 侧边栏 UI
│   ├── sidebar-*.js    # TOC、搜索、导出等
│   ├── *-adapter.js    # 各平台页面适配 (ChatGPT/Gemini/Claude/DeepSeek)
│   └── sites-config.js # 站点配置
├── core/               # 核心逻辑
│   ├── storage.js      # 存储
│   ├── toc-manager.js  # 目录管理
│   ├── project-manager.js # 项目管理
│   └── i18n.js         # 国际化
├── icons/              # 图标
└── lib/                # 第三方库 (如 JSZip)
```

## 隐私与权限

数据处理与权限说明见 [PRIVACY.md](PRIVACY.md)。

## 许可证

MIT License。欢迎 Issue 与 Pull Request。
