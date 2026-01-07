# Atlas AI Assistant

🤖 AI驱动的智能浏览器扩展，为你的浏览体验注入AI能力。支持多AI服务商（OpenAI、Claude、Gemini），提供网页总结、智能对话、自动化操作和记忆系统功能。

> An AI-powered browser extension for intelligent web browsing. Features multi-provider AI support, webpage summarization, smart automation, and memory system.

![Atlas Extension](https://img.shields.io/badge/version-1.0.0-blue)
![License](https://img.shields.io/badge/license-MIT-green)
![Chrome](https://img.shields.io/badge/Chrome-Compatible-brightgreen)
![Edge](https://img.shields.io/badge/Edge-Compatible-brightgreen)

## ✅ 已完成功能

### 核心功能
- 🤖 **多 AI 提供商支持** - OpenAI GPT-4、Anthropic Claude、Google Gemini 无缝切换
- 💬 **侧边栏 AI 助手** - 与 AI 实时对话，支持流式响应和 Markdown 渲染
- 📝 **网页内容总结** - 一键提取和总结网页核心内容，支持缓存避免重复请求
- 🎯 **智能操作代理** - AI 驱动的网页自动化（表单填写、点击、滚动等）
- 🧠 **记忆系统** - 记住用户偏好和对话历史，提供上下文感知对话
- 📊 **历史记录分析** - 分析浏览习惯，AI 生成个性化洞察和建议

### 用户体验
- 🎨 **现代化 UI** - 支持深色/浅色主题切换，流畅动画效果
- ⚡ **快捷操作** - 右键菜单快速调用，快捷按钮一键总结/问答
- 🔒 **隐私优先** - 所有数据本地存储，API Key 加密保存

## 🚧 开发中 / 未来计划

| 功能 | 状态 | 描述 |
|------|------|------|
| 🌐 **网页翻译** | 计划中 | 一键翻译整个网页或选中文本，支持多语言 |
| 🎤 **语音输入** | 计划中 | 语音转文字，解放双手 |
| 🖼️ **图片分析** | 计划中 | 支持图片内容理解和描述 |
| 📤 **导出功能** | 计划中 | 导出对话历史、总结内容为多种格式 |
| ⌨️ **快捷键配置** | 计划中 | 自定义快捷键，提升效率 |
| 🔗 **跨设备同步** | 计划中 | 通过云端同步对话和设置 |
| 🦊 **Firefox 支持** | 计划中 | 适配 Firefox 浏览器 |
| 📱 **移动端优化** | 计划中 | 优化移动端浏览器体验 |

## 🚀 快速开始

### 安装

详细安装步骤请查看 [安装指南](INSTALL.md)

```bash
# 1. 安装依赖
npm install

# 2. 构建扩展
npm run build

# 3. 生成图标（可选）
# 在浏览器中打开 scripts/generate-icons.html

# 4. 加载到浏览器
# Chrome: chrome://extensions/
# Edge: edge://extensions/
```

### 配置 API Key

支持的 AI 服务：

- **OpenAI**: https://platform.openai.com/api-keys
- **Anthropic**: https://console.anthropic.com/
- **Gemini**: https://makersuite.google.com/app/apikey
- **New API** (兼容 OpenAI 格式): https://new-api.koyeb.app

在扩展设置页面配置至少一个 API Key。

💡 **使用 New API？** 查看详细配置指南：[NEW_API_CONFIG.md](NEW_API_CONFIG.md)

## 📖 文档

- [安装指南](INSTALL.md) - 详细的安装步骤
- [使用指南](USAGE.md) - 功能使用说明
- [开发文档](DEVELOPMENT.md) - 技术细节和开发指南

## 🛠️ 技术栈

- **前端框架**: React 18 + TypeScript
- **构建工具**: Vite 5
- **样式**: Tailwind CSS
- **状态管理**: Zustand
- **扩展标准**: Chrome Extension Manifest V3
- **AI 集成**: OpenAI、Anthropic、Gemini API

## 📁 项目结构

```
atlas-extension/
├── src/
│   ├── background/        # Service Worker
│   ├── content/           # Content Scripts
│   ├── sidepanel/         # 侧边栏 UI
│   ├── popup/             # 工具栏弹窗
│   ├── options/           # 设置页面
│   ├── services/          # 核心服务
│   ├── store/             # 状态管理
│   ├── utils/             # 工具函数
│   └── types/             # 类型定义
├── public/
│   ├── manifest.json      # 扩展清单
│   └── icons/             # 图标资源
└── scripts/               # 构建脚本
```

## 🎯 主要功能

### 1. 侧边栏 AI 助手

- 实时 AI 对话
- 自动获取页面上下文
- 流式响应显示
- 支持 Markdown 格式

### 2. 网页总结

- 一键总结当前页面
- 提取关键要点
- 保存历史总结

### 3. 智能代理

- AI 驱动的页面操作
- 自动填写表单
- 执行复杂任务

### 4. 记忆系统

- 记住用户偏好
- 上下文感知对话
- 智能信息提取

## 🔧 开发

```bash
# 开发模式（热更新）
npm run dev

# 构建生产版本
npm run build

# 类型检查
npm run type-check
```

## 🤝 贡献

欢迎贡献代码！请遵循以下步骤：

1. Fork 项目
2. 创建功能分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 开启 Pull Request

## 📝 变更日志

### v1.0.0 (2025-10-30)

- ✨ 初始版本发布
- ✅ 多 AI 提供商支持（OpenAI、Claude、Gemini）
- ✅ 侧边栏聊天界面，支持流式响应
- ✅ 网页内容总结与缓存
- ✅ 记忆系统与上下文感知
- ✅ 浏览历史分析与洞察
- ✅ 代理模式（实验性）
- ✅ 深色/浅色主题

### 计划中

- 🌐 网页翻译功能
- 🎤 语音输入支持
- 🖼️ 图片分析能力
- 📤 数据导出功能

## ⚠️ 注意事项

- 需要有效的 AI API Key
- 某些页面（如 chrome:// 页面）无法使用
- 代理模式为实验性功能
- API 调用会产生费用，请注意用量

## 🔒 隐私与安全

- 所有数据存储在本地浏览器
- API Key 加密存储
- 不上传数据到第三方服务器
- 仅与选择的 AI 服务通信

## 📄 许可证

MIT License - 查看 [LICENSE](LICENSE) 文件了解详情

## 🙏 致谢

- 灵感来自 OpenAI Atlas
- 使用了多个优秀的开源项目

## 📧 联系

遇到问题或有建议？欢迎提交 Issue！

---

⭐ 如果这个项目对您有帮助，请给个 Star！

