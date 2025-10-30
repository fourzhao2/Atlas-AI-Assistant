# Atlas 浏览器扩展开发文档

## 项目结构

```
atlas-extension/
├── src/
│   ├── background/          # 后台服务 (Service Worker)
│   │   ├── index.ts        # 主入口，处理扩展生命周期
│   │   └── history-analyzer.ts  # 历史记录分析
│   ├── content/             # Content Scripts (页面注入)
│   │   ├── index.ts        # 主入口，消息处理
│   │   ├── extractor.ts    # 网页内容提取
│   │   └── agent.ts        # 页面操作代理
│   ├── sidepanel/           # 侧边栏 UI
│   │   ├── App.tsx         # 主应用组件
│   │   ├── index.tsx       # 入口
│   │   └── components/     # UI 组件
│   ├── popup/               # 工具栏弹窗
│   │   ├── App.tsx
│   │   └── index.tsx
│   ├── options/             # 设置页面
│   │   ├── App.tsx
│   │   └── index.tsx
│   ├── services/            # 核心服务
│   │   ├── ai-service.ts   # AI 服务管理器
│   │   ├── ai-providers/   # AI 提供商实现
│   │   │   ├── openai.ts
│   │   │   ├── anthropic.ts
│   │   │   └── gemini.ts
│   │   ├── storage.ts      # 存储服务
│   │   ├── memory.ts       # 记忆系统
│   │   ├── summarizer.ts   # 总结服务
│   │   └── action-parser.ts # 代理指令解析
│   ├── store/               # Zustand 状态管理
│   │   └── index.ts
│   ├── utils/               # 工具函数
│   │   ├── messaging.ts    # Chrome 消息通信
│   │   └── theme.ts        # 主题管理
│   ├── types/               # TypeScript 类型定义
│   │   └── index.ts
│   └── styles/              # 全局样式
│       └── global.css
├── public/
│   ├── manifest.json       # 扩展清单
│   └── icons/              # 扩展图标
├── scripts/
│   └── build.js            # 构建脚本
└── [配置文件]
```

## 核心功能实现

### 1. AI 服务抽象层

**位置:** `src/services/ai-service.ts` 和 `src/services/ai-providers/`

- 统一的 AI 提供商接口
- 支持多个 AI 服务（OpenAI, Anthropic, Gemini）
- 流式响应处理
- Function Calling 支持（用于代理模式）

**使用示例:**
```typescript
import { aiService } from '@/services/ai-service';

// 初始化
await aiService.initialize();

// 发送消息
await aiService.chat(messages, (chunk) => {
  console.log('Received chunk:', chunk);
});
```

### 2. 存储系统

**位置:** `src/services/storage.ts`

使用 Chrome Storage API 持久化数据：
- AI 提供商配置
- 用户偏好设置
- 聊天历史
- 记忆
- 页面总结
- 历史洞察

### 3. Content Scripts

**位置:** `src/content/`

注入到每个网页，负责：
- 提取页面内容
- 执行代理操作（点击、填表等）
- 与后台服务通信

### 4. 后台服务 (Service Worker)

**位置:** `src/background/index.ts`

负责：
- 处理扩展事件
- 转发消息
- 周期性任务（历史分析）
- 上下文菜单

### 5. 记忆系统

**位置:** `src/services/memory.ts`

- 自动提取对话中的重要信息
- 基于相关性检索记忆
- 增强 AI 对话上下文

### 6. 网页操作代理

**位置:** `src/content/agent.ts` 和 `src/services/action-parser.ts`

- 使用 AI Function Calling 解析用户指令
- 执行页面操作（点击、填表、滚动等）
- 安全控制

## 开发流程

### 安装依赖

```bash
npm install
```

### 开发模式

```bash
npm run dev
```

这会启动 Vite 开发服务器，支持热更新。

### 构建生产版本

```bash
npm run build
```

构建产物会输出到 `dist/` 目录。

### 加载扩展

1. 打开 Chrome/Edge 浏览器
2. 访问 `chrome://extensions/`
3. 启用"开发者模式"
4. 点击"加载已解压的扩展程序"
5. 选择 `dist/` 文件夹

### 调试

- **Popup/Options/Sidepanel:** 右键 → 检查
- **Background Service Worker:** Extensions 页面 → Service Worker → 检查
- **Content Scripts:** 页面开发者工具 → Sources

## API Keys 配置

扩展支持三个 AI 提供商：

1. **OpenAI:** 访问 https://platform.openai.com/api-keys
2. **Anthropic:** 访问 https://console.anthropic.com/
3. **Gemini:** 访问 https://makersuite.google.com/app/apikey

在扩展的设置页面配置 API Keys。

## 消息通信

扩展使用 Chrome 消息 API 进行组件间通信：

```typescript
// 发送消息
chrome.runtime.sendMessage({
  type: 'EXTRACT_CONTENT',
  payload: data,
});

// 监听消息
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // 处理消息
  sendResponse({ success: true, data: result });
  return true; // 保持消息通道打开
});
```

## 状态管理

使用 Zustand 进行状态管理：

```typescript
import { useStore } from '@/store';

const { messages, addMessage, setLoading } = useStore();
```

## 样式

使用 Tailwind CSS + 自定义全局样式：

- 支持深色/浅色主题
- 响应式设计
- 平滑动画

## 类型安全

使用 TypeScript 确保类型安全：

```bash
npm run type-check
```

## 性能优化

1. **懒加载:** 组件按需加载
2. **流式响应:** AI 响应实时显示
3. **数据限制:** 存储数据有上限，自动清理旧数据
4. **Service Worker:** 保持后台服务活跃

## 安全考虑

1. API Keys 存储在本地 Chrome Storage
2. 敏感操作需要用户确认
3. 最小权限原则
4. 不上传数据到第三方服务器

## 常见问题

### 1. Service Worker 休眠

Chrome 会在不活跃时休眠 Service Worker。代码中包含了保活逻辑。

### 2. Content Script 注入失败

某些页面（如 chrome:// 页面）不允许注入 Content Script。

### 3. API 请求失败

检查：
- API Key 是否正确
- 网络连接
- API 配额是否用完

## 扩展功能

可以添加的功能：
- 向量化存储（使用 IndexedDB + embeddings）
- 多语言支持
- 更多 AI 提供商
- 导出/导入数据
- 同步到云端

## 发布

要发布到 Chrome Web Store：

1. 创建开发者账号
2. 打包扩展：`npm run build`
3. 压缩 dist 目录
4. 上传到 Chrome Web Store
5. 填写商店信息
6. 等待审核

## 贡献

欢迎贡献代码！请遵循现有的代码风格和结构。

## 许可证

MIT License

