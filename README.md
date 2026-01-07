# Atlas AI Assistant

🤖 AI驱动的智能浏览器扩展，为你的浏览体验注入AI能力。支持多AI服务商（OpenAI、Claude、Gemini、DeepSeek、Qwen），提供网页总结、智能对话、自动化操作、深度研究和记忆系统功能。

> An AI-powered browser extension for intelligent web browsing. Features multi-provider AI support, webpage summarization, smart automation, deep research, and memory system.

![Atlas Extension](https://img.shields.io/badge/version-2.0.0-blue)
![License](https://img.shields.io/badge/license-MIT-green)
![Chrome](https://img.shields.io/badge/Chrome-Compatible-brightgreen)
![Edge](https://img.shields.io/badge/Edge-Compatible-brightgreen)

## ✨ v2.0 新特性

### 🔬 DeepResearch 深度研究模式
全新的 AI 驱动研究引擎，实现 IterResearch 迭代研究范式：
- **智能规划** - AI 自动分解研究问题为子问题
- **多轮迭代** - 搜索 → 浏览 → 分析 → 评估的闭环研究
- **信息聚合** - 从多个来源提取和整合关键信息
- **报告生成** - 自动生成结构化研究报告，支持 Markdown 导出

### 🤖 多模式智能体架构
- **💬 Chat 模式** - 直接对话，获取信息和帮助
- **🤖 Agent 模式 (ReAct)** - 思考 → 行动 → 观察的循环执行
- **📋 Plan 模式** - Planner 规划 + Navigator 执行的分层架构
- **🔬 Research 模式** - 深度搜索 → 信息聚合 → 报告生成

### 🧠 增强记忆系统
- **短期记忆** - Token 限制管理和对话摘要压缩
- **长期记忆** - 跨对话的信息提取和智能检索

---

## ✅ 完整功能列表

### 核心功能
- 🤖 **多 AI 提供商支持** - OpenAI GPT-4/4o、Anthropic Claude、Google Gemini、DeepSeek、Qwen 无缝切换
- 💬 **侧边栏 AI 助手** - 与 AI 实时对话，支持流式响应和 Markdown 渲染
- 📝 **网页内容总结** - 一键提取和总结网页核心内容，支持缓存避免重复请求
- 🎯 **智能操作代理** - AI 驱动的网页自动化（表单填写、点击、滚动等）
- 🔬 **深度研究模式** - 多轮迭代搜索、信息聚合、自动生成研究报告
- 🧠 **记忆系统** - 短期记忆管理 + 长期记忆检索，提供上下文感知对话
- 📊 **历史记录分析** - 分析浏览习惯，AI 生成个性化洞察和建议
- 🖼️ **多模态支持** - 支持图片附件，AI 可理解图片内容

### 用户体验
- 🎨 **现代化 UI** - 支持深色/浅色主题切换，流畅动画效果
- ⚡ **快捷操作** - 右键菜单快速调用，快捷按钮一键总结/问答
- 🔒 **隐私优先** - 所有数据本地存储，API Key 加密保存
- 📱 **响应式设计** - 自适应不同窗口尺寸

---

## 🚧 开发中 / 未来计划

| 功能 | 状态 | 描述 |
|------|------|------|
| 🌐 **网页翻译** | 计划中 | 一键翻译整个网页或选中文本，支持多语言 |
| 🎤 **语音输入** | 计划中 | 语音转文字，解放双手 |
| ⌨️ **快捷键配置** | 计划中 | 自定义快捷键，提升效率 |
| 🔗 **跨设备同步** | 计划中 | 通过云端同步对话和设置 |
| 🦊 **Firefox 支持** | 计划中 | 适配 Firefox 浏览器 |

---

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

| 提供商 | 获取 API Key | 说明 |
|--------|-------------|------|
| **OpenAI** | https://platform.openai.com/api-keys | GPT-4, GPT-4o 等 |
| **Anthropic** | https://console.anthropic.com/ | Claude 3.5 Sonnet 等 |
| **Gemini** | https://makersuite.google.com/app/apikey | Gemini Pro 等 |
| **DeepSeek** | https://platform.deepseek.com/ | DeepSeek V3 等 |
| **Qwen** | https://dashscope.console.aliyun.com/ | 通义千问 |
| **New API** | 兼容 OpenAI 格式的第三方服务 | 自定义 Base URL |

在扩展设置页面配置至少一个 API Key。

💡 **使用 New API？** 查看详细配置指南：[NEW_API_CONFIG.md](NEW_API_CONFIG.md)

---

## 📖 文档

- [安装指南](INSTALL.md) - 详细的安装步骤
- [使用指南](USAGE.md) - 功能使用说明
- [开发文档](DEVELOPMENT.md) - 技术细节和开发指南
- [测试指南](TESTING_GUIDE.md) - 功能测试方法

---

## 🛠️ 技术栈

- **前端框架**: React 18 + TypeScript
- **构建工具**: Vite 5
- **样式**: Tailwind CSS
- **状态管理**: Zustand
- **扩展标准**: Chrome Extension Manifest V3
- **AI 集成**: OpenAI、Anthropic、Gemini、DeepSeek、Qwen API

---

## 📁 项目结构

```
atlas-extension/
├── src/
│   ├── background/           # Service Worker
│   ├── content/              # Content Scripts
│   ├── sidepanel/            # 侧边栏 UI
│   │   └── components/       # React 组件
│   │       ├── ChatMessage.tsx
│   │       ├── ChatInput.tsx
│   │       ├── DeepResearchPanel.tsx   # 🔬 深度研究面板
│   │       ├── PlanPanel.tsx           # 📋 计划面板
│   │       └── ReActPanel.tsx          # 🤖 ReAct 面板
│   ├── popup/                # 工具栏弹窗
│   ├── options/              # 设置页面
│   ├── services/             # 核心服务
│   │   ├── ai-providers/     # AI 提供商适配器
│   │   ├── deep-research/    # 🔬 深度研究模块
│   │   │   ├── deep-research-agent.ts    # 主控制器
│   │   │   ├── research-planner.ts       # 研究规划器
│   │   │   ├── web-searcher.ts           # 网页搜索器
│   │   │   ├── information-aggregator.ts # 信息聚合器
│   │   │   └── report-generator.ts       # 报告生成器
│   │   ├── react-agent.ts    # ReAct 智能体
│   │   ├── planner-agent.ts  # 规划智能体
│   │   ├── navigator-agent.ts# 导航智能体
│   │   └── memory.ts         # 记忆系统
│   ├── hooks/                # React Hooks
│   │   ├── useAgent.ts
│   │   ├── useDeepResearch.ts
│   │   └── usePlanAgent.ts
│   ├── store/                # 状态管理
│   ├── utils/                # 工具函数
│   └── types/                # 类型定义
│       └── deep-research.ts  # 深度研究类型
├── public/
│   ├── manifest.json         # 扩展清单
│   └── icons/                # 图标资源
└── scripts/                  # 构建脚本
```

---

## 🎯 主要功能详解

### 1. 💬 对话模式 (Chat)

- 实时 AI 对话
- 自动获取页面上下文
- 流式响应显示
- 支持 Markdown 格式
- 支持图片附件

### 2. 🤖 Agent 模式 (ReAct)

基于 ReAct (Reasoning + Acting) 范式的智能体：

```
思考 (Thought) → 行动 (Action) → 观察 (Observation) → 循环
```

- 自主规划和执行任务
- 网页元素操作（点击、填写、滚动）
- 实时显示思考过程

### 3. 📋 Plan 模式

分层架构的任务执行：

- **Planner Agent**: 分析任务，制定执行计划
- **Navigator Agent**: 逐步执行计划中的每个步骤
- 支持用户确认计划后再执行

### 4. 🔬 Research 模式 (DeepResearch)

IterResearch 迭代研究范式：

```
规划 (Planning)
    ↓
┌─→ 搜索 (Searching)
│   ↓
│   浏览 (Browsing)
│   ↓
│   分析 (Analyzing)
│   ↓
│   评估 (Evaluating) ─→ 信息不足? ─→ 继续迭代
│   ↓
└───────────────────────┘
    ↓ 信息充足
生成报告 (Generating)
```

**研究流程**:
1. **规划阶段**: AI 分析问题，分解为子问题，制定搜索策略
2. **迭代研究**: 循环执行搜索、浏览、分析、评估
3. **信息聚合**: 从多个来源提取关键信息
4. **报告生成**: 综合所有信息，生成结构化研究报告

**交互功能**:
- ✅ 确认研究计划
- 📄 选择要访问的页面
- 🔄 决定是否继续迭代
- 📥 导出 Markdown 报告

### 5. 🧠 记忆系统

**短期记忆**:
- Token 使用量监控
- 超出限制时自动摘要压缩
- 保持对话上下文连贯

**长期记忆**:
- 跨对话信息提取
- 语义相似度检索
- 增强回答的个性化

---

## 🔧 开发

```bash
# 开发模式（热更新）
npm run dev

# 构建生产版本
npm run build

# 类型检查
npm run type-check
```

---

## 🤝 贡献

欢迎贡献代码！请遵循以下步骤：

1. Fork 项目
2. 创建功能分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 开启 Pull Request

---

## 📝 变更日志

### v2.0.0 (2026-01-07)

**🔬 新增 DeepResearch 深度研究模式**
- ✨ IterResearch 迭代研究范式
- ✨ 智能研究规划器 (Research Planner)
- ✨ 多引擎网页搜索 (Web Searcher)
- ✨ 信息聚合分析 (Information Aggregator)
- ✨ 结构化报告生成 (Report Generator)
- ✨ 交互式研究流程控制
- ✨ Markdown 报告导出

**🤖 智能体架构升级**
- ✨ 新增 Plan 模式 (Planner + Navigator)
- ✨ ReAct Agent 优化
- ✨ 四种对话模式自由切换

**🧠 记忆系统增强**
- ✨ 短期记忆 Token 管理
- ✨ 自动对话摘要压缩
- ✨ 长期记忆检索增强

**🖼️ 多模态支持**
- ✨ 图片附件功能
- ✨ Vision 模型集成

**🔌 新增 AI 提供商**
- ✨ DeepSeek 支持
- ✨ Qwen (通义千问) 支持

**🎨 UI/UX 改进**
- ✨ 模式切换器
- ✨ 深度研究进度面板
- ✨ Token 使用量指示器

### v1.0.0 (2025-10-30)

- ✨ 初始版本发布
- ✅ 多 AI 提供商支持（OpenAI、Claude、Gemini）
- ✅ 侧边栏聊天界面，支持流式响应
- ✅ 网页内容总结与缓存
- ✅ 记忆系统与上下文感知
- ✅ 浏览历史分析与洞察
- ✅ 代理模式（实验性）
- ✅ 深色/浅色主题

---

## ⚠️ 注意事项

- 需要有效的 AI API Key
- 某些页面（如 chrome:// 页面）无法使用
- DeepResearch 模式会进行多次 API 调用，请注意用量
- API 调用会产生费用，建议设置用量限制

---

## 🔒 隐私与安全

- 所有数据存储在本地浏览器
- API Key 加密存储
- 不上传数据到第三方服务器
- 仅与选择的 AI 服务通信
- DeepResearch 搜索结果仅用于当前研究

---

## 📄 许可证

MIT License - 查看 [LICENSE](LICENSE) 文件了解详情

---

## 🙏 致谢

- 灵感来自 OpenAI Atlas
- 使用了多个优秀的开源项目

---

## 📧 联系

遇到问题或有建议？欢迎提交 Issue！

---

⭐ 如果这个项目对您有帮助，请给个 Star！
