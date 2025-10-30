# 使用 New API 服务配置指南

## 什么是 New API？

New API 是一个开源的 OpenAI API 代理服务，它提供了与 OpenAI API 兼容的接口，支持多种 AI 模型。

网站：https://new-api.koyeb.app

## 配置步骤

### 1. 测试 API 连接

在配置扩展之前，先测试 API 是否正常工作：

```bash
# 运行测试脚本
node test-api.js
```

这将测试：
- ✅ 基本 API 调用
- ✅ 流式响应
- ✅ 可用模型列表

### 2. 在扩展中配置

#### 方法 A: 通过扩展设置界面（推荐）

1. 构建并加载扩展：
   ```bash
   npm run build
   ```

2. 在浏览器中加载扩展（`chrome://extensions/`）

3. 点击扩展图标 → 设置

4. 在"AI 提供商"标签页，配置 OpenAI：
   - **API Key**: `sk-ziNP8HRIfSIRUgEmfEavBw8qjxz9axaeFWPV3Pj5W9FYDNTL`
   - **模型**: `gpt-3.5-turbo` 或 `gpt-4`（根据您的账户可用模型）
   - **自定义 API 地址**: `https://new-api.koyeb.app`

5. 点击"保存"

6. 在"常规设置"中选择 OpenAI 为默认提供商

#### 方法 B: 手动配置（开发测试）

创建一个测试配置文件 `test-config.json`：

```json
{
  "provider_openai": {
    "apiKey": "sk-ziNP8HRIfSIRUgEmfEavBw8qjxz9axaeFWPV3Pj5W9FYDNTL",
    "model": "gpt-3.5-turbo",
    "baseUrl": "https://new-api.koyeb.app"
  },
  "preferences": {
    "defaultProvider": "openai",
    "theme": "system",
    "autoSummarize": false,
    "agentMode": false,
    "memoryEnabled": true
  }
}
```

## API 配置说明

### API 密钥
```
sk-ziNP8HRIfSIRUgEmfEavBw8qjxz9axaeFWPV3Pj5W9FYDNTL
```

### API 端点
```
https://new-api.koyeb.app/v1/chat/completions
```

### 支持的功能

✅ **已支持:**
- 聊天补全（Chat Completions）
- 流式响应（Streaming）
- 多种模型选择
- 上下文对话

⚠️ **可能不支持:**
- Function Calling（取决于服务配置）
- 图片分析（需要特定模型）
- 语音功能

### 推荐模型

根据您的需求选择：

1. **GPT-3.5-turbo** (推荐)
   - 速度快
   - 成本低
   - 适合日常对话和总结

2. **GPT-4**
   - 更强大
   - 推理能力更好
   - 适合复杂任务

3. **其他模型**
   - 运行 `node test-api.js` 查看完整列表

## 使用示例

### 示例 1: 基本对话

```javascript
const response = await fetch('https://new-api.koyeb.app/v1/chat/completions', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer sk-ziNP8HRIfSIRUgEmfEavBw8qjxz9axaeFWPV3Pj5W9FYDNTL',
  },
  body: JSON.stringify({
    model: 'gpt-3.5-turbo',
    messages: [
      { role: 'user', content: '你好！' }
    ],
  }),
});

const data = await response.json();
console.log(data.choices[0].message.content);
```

### 示例 2: 流式响应

```javascript
const response = await fetch('https://new-api.koyeb.app/v1/chat/completions', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer sk-ziNP8HRIfSIRUgEmfEavBw8qjxz9axaeFWPV3Pj5W9FYDNTL',
  },
  body: JSON.stringify({
    model: 'gpt-3.5-turbo',
    messages: [{ role: 'user', content: '讲个笑话' }],
    stream: true,
  }),
});

// 处理流式数据...
```

## 故障排除

### 问题 1: 401 Unauthorized

**原因:** API Key 无效或已过期

**解决方案:**
- 检查 API Key 是否正确复制
- 访问 https://new-api.koyeb.app/console/token 确认密钥状态
- 尝试重新生成密钥

### 问题 2: 429 Too Many Requests

**原因:** 请求频率过高

**解决方案:**
- 降低请求频率
- 检查账户配额
- 等待一段时间后重试

### 问题 3: 模型不可用

**原因:** 请求的模型在服务中不可用

**解决方案:**
- 运行 `node test-api.js` 查看可用模型
- 使用可用的模型名称
- 默认使用 `gpt-3.5-turbo`

### 问题 4: CORS 错误

**原因:** 浏览器扩展的跨域限制

**解决方案:**
- 确保在 `manifest.json` 中添加了正确的 `host_permissions`
- 已包含在项目配置中，无需额外操作

## 成本和限制

请访问 New API 服务的控制台查看：
- 账户余额
- 使用量统计
- 速率限制
- 模型价格

网站：https://new-api.koyeb.app/console

## 安全建议

1. **保护 API Key**
   - 不要将 API Key 提交到公开仓库
   - 不要分享给他人
   - 定期更换密钥

2. **监控使用**
   - 定期检查使用量
   - 设置使用限制
   - 注意异常请求

3. **本地存储**
   - API Key 存储在浏览器本地
   - 使用 Chrome Storage API 加密
   - 不会上传到服务器

## 切换回官方 OpenAI API

如果想切换回官方 OpenAI API：

1. 打开扩展设置
2. 编辑 OpenAI 配置
3. 清空"自定义 API 地址"字段
4. 输入官方 OpenAI API Key
5. 保存

官方 API 将使用默认端点：`https://api.openai.com`

## 参考资料

- New API 项目：https://github.com/Calcium-Ion/new-api
- OpenAI API 文档：https://platform.openai.com/docs
- 扩展开发文档：[DEVELOPMENT.md](DEVELOPMENT.md)

---

配置完成后，享受 AI 助手带来的便利！🚀

