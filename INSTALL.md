# Atlas 浏览器扩展安装指南

## 前置要求

- Node.js 18+ 和 npm
- Chrome 或 Edge 浏览器（最新版本）
- 至少一个 AI 服务的 API Key

## 安装步骤

### 1. 克隆或下载项目

```bash
git clone <repository-url>
cd atlas-extension
```

### 2. 安装依赖

```bash
npm install
```

这会安装所有必需的依赖包。

### 3. 生成图标（可选）

项目需要扩展图标。您有两个选择：

**选项 A: 使用图标生成器**

1. 在浏览器中打开 `scripts/generate-icons.html`
2. 点击每个图标的"下载"按钮
3. 将下载的图标保存到 `public/icons/` 文件夹

**选项 B: 使用自己的图标**

创建以下尺寸的 PNG 图标并放入 `public/icons/`：
- `icon16.png` (16x16)
- `icon32.png` (32x32)
- `icon48.png` (48x48)
- `icon128.png` (128x128)

### 4. 构建扩展

```bash
npm run build
```

构建完成后，会在 `dist/` 文件夹生成扩展文件。

### 5. 加载到浏览器

#### Chrome 浏览器：

1. 打开 Chrome
2. 访问 `chrome://extensions/`
3. 启用右上角的"开发者模式"
4. 点击"加载已解压的扩展程序"
5. 选择项目中的 `dist` 文件夹
6. 扩展图标会出现在工具栏

#### Edge 浏览器：

1. 打开 Edge
2. 访问 `edge://extensions/`
3. 启用左下角的"开发人员模式"
4. 点击"加载解压缩的扩展"
5. 选择项目中的 `dist` 文件夹
6. 扩展图标会出现在工具栏

### 6. 配置 AI 服务

1. 点击扩展图标
2. 点击"设置"按钮
3. 进入"AI 提供商"标签页
4. 至少配置一个 AI 服务：

#### OpenAI (推荐)

1. 访问 https://platform.openai.com/api-keys
2. 创建新的 API Key
3. 复制 API Key
4. 在扩展设置中粘贴到 OpenAI 配置
5. 保存

#### Anthropic Claude

1. 访问 https://console.anthropic.com/
2. 创建账号并获取 API Key
3. 在扩展设置中配置
4. 保存

#### Google Gemini

1. 访问 https://makersuite.google.com/app/apikey
2. 生成 API Key
3. 在扩展设置中配置
4. 保存

### 7. 测试扩展

1. 访问任意网页（如 Wikipedia）
2. 点击扩展图标
3. 点击"打开 AI 助手"
4. 尝试发送消息
5. 测试"总结此页面"功能

## 开发模式

如果您想进行开发或自定义：

```bash
# 启动开发服务器（支持热更新）
npm run dev

# 类型检查
npm run type-check
```

开发时的注意事项：
- 修改代码后需要重新加载扩展
- Content Scripts 和 Background 修改需要刷新页面
- UI 修改通常支持热更新

## 故障排除

### 问题：扩展加载失败

**解决方案：**
- 确保运行了 `npm run build`
- 检查 `dist` 文件夹是否存在且包含文件
- 查看浏览器扩展页面的错误信息

### 问题：图标不显示

**解决方案：**
- 检查 `public/icons/` 文件夹是否有所需的图标文件
- 重新构建：`npm run build`
- 重新加载扩展

### 问题：API 请求失败

**解决方案：**
- 确认 API Key 正确配置
- 检查网络连接
- 查看浏览器控制台的错误信息
- 确认 API 账户有足够的额度

### 问题：某些页面无法使用

**解决方案：**
- Chrome 安全限制，以下页面无法使用扩展：
  - chrome:// 开头的页面
  - chrome.google.com/webstore
  - 浏览器内置页面
- 这是正常的浏览器安全机制

### 问题：Service Worker 错误

**解决方案：**
- 打开 `chrome://extensions/`
- 找到 Atlas 扩展
- 点击"Service Worker"旁的"检查视图"
- 查看控制台错误信息

## 更新扩展

当有新版本时：

```bash
# 拉取最新代码
git pull

# 安装新依赖（如果有）
npm install

# 重新构建
npm run build

# 在浏览器扩展页面重新加载扩展
```

## 卸载

1. 打开 `chrome://extensions/` 或 `edge://extensions/`
2. 找到 Atlas 扩展
3. 点击"移除"
4. 如需删除所有数据，在移除前进入设置 → 高级设置 → 清除所有数据

## 数据备份

扩展数据存储在浏览器本地，卸载会丢失。如需备份：

1. 打开浏览器开发者工具
2. Application → Storage → Local Storage
3. 找到扩展相关数据
4. 手动导出（未来版本会添加导出功能）

## 下一步

安装完成后，查看：
- [使用指南](USAGE.md) - 了解如何使用各项功能
- [开发文档](DEVELOPMENT.md) - 了解技术细节和自定义开发

## 获取帮助

遇到问题？
1. 查看上述故障排除部分
2. 查看浏览器控制台错误
3. 提交 Issue（包含错误信息和复现步骤）

---

祝使用愉快！🎉

