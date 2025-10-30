# 🧪 New API 快速测试指南

## 方法 1: 运行测试脚本（推荐）

最简单的方法是运行测试脚本：

```bash
node test-api.js
```

### 测试输出示例

```
═══════════════════════════════════════
   New API 兼容性测试套件
═══════════════════════════════════════

🧪 测试 New API 连接...

API 端点: https://new-api.koyeb.app/v1/chat/completions
API Key: sk-ziNP8HRIfSIRUgE...

📡 响应状态: 200 OK

✅ API 调用成功！

模型: gpt-3.5-turbo
回复内容: 我是一个人工智能助手，可以帮助您解答问题...

🌊 测试流式响应...

✅ 开始接收流式数据:

人工智能是一种...（实时显示）

✅ 流式响应完成

📋 测试获取模型列表...

✅ 可用模型列表:
1. gpt-3.5-turbo
2. gpt-4
3. claude-3-sonnet
...

═══════════════════════════════════════
   测试完成！
═══════════════════════════════════════
```

## 方法 2: 在扩展中测试

### 步骤 1: 构建扩展

```bash
npm install
npm run build
```

### 步骤 2: 加载扩展

1. 打开 Chrome：`chrome://extensions/`
2. 启用"开发者模式"
3. 点击"加载已解压的扩展程序"
4. 选择 `dist` 文件夹

### 步骤 3: 配置 New API

1. 点击扩展图标
2. 点击"设置"
3. 在"AI 提供商"标签，配置 OpenAI：

   ```
   API Key: sk-ziNP8HRIfSIRUgEmfEavBw8qjxz9axaeFWPV3Pj5W9FYDNTL
   模型: gpt-3.5-turbo
   自定义 API 地址: https://new-api.koyeb.app
   ```

4. 点击"保存"
5. 在"常规设置"中选择 OpenAI 为默认提供商

### 步骤 4: 测试功能

1. **测试聊天**
   - 点击"打开 AI 助手"
   - 发送消息："你好！"
   - 查看 AI 回复

2. **测试总结**
   - 访问任意网页（如维基百科）
   - 点击扩展图标 → "总结此页面"
   - 查看总结结果

3. **测试快捷操作**
   - 在侧边栏点击"📝 总结此页"
   - 或点击"🌐 翻译"
   - 查看响应

## 方法 3: 使用浏览器控制台测试

打开浏览器控制台（F12），运行：

```javascript
// 测试 API 连接
fetch('https://new-api.koyeb.app/v1/chat/completions', {
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
})
.then(r => r.json())
.then(data => {
  console.log('✅ API 调用成功！');
  console.log('回复:', data.choices[0].message.content);
})
.catch(error => {
  console.error('❌ API 调用失败:', error);
});
```

## 验证清单

测试以下功能确保一切正常：

- [ ] ✅ 基本 API 调用成功
- [ ] ✅ 流式响应正常工作
- [ ] ✅ 可以获取模型列表
- [ ] ✅ 扩展可以正常加载
- [ ] ✅ 设置页面可以保存配置
- [ ] ✅ 侧边栏聊天功能正常
- [ ] ✅ 网页总结功能正常
- [ ] ✅ 快捷操作按钮有效

## 常见问题

### ❌ 401 Unauthorized

**原因:** API Key 错误

**解决:**
```bash
# 检查 API Key 是否正确
echo "sk-ziNP8HRIfSIRUgEmfEavBw8qjxz9axaeFWPV3Pj5W9FYDNTL"
```

### ❌ CORS Error

**原因:** 扩展权限配置

**解决:** 检查 `manifest.json` 中是否包含：
```json
"host_permissions": [
  "http://*/*",
  "https://*/*"
]
```

### ❌ 模型不可用

**原因:** 模型名称错误

**解决:** 运行测试脚本查看可用模型：
```bash
node test-api.js
```

## 调试技巧

### 1. 查看扩展日志

**Background Service Worker:**
- `chrome://extensions/` → Atlas 扩展 → "Service Worker" → 检查

**Popup/Options/Sidepanel:**
- 右键点击扩展界面 → 检查

**Content Script:**
- 打开网页 F12 → Console

### 2. 监控 API 请求

在 Chrome DevTools 中：
1. 打开 Network 标签
2. 过滤 "chat/completions"
3. 查看请求和响应

### 3. 检查存储数据

在 Chrome DevTools 中：
1. Application → Storage → Local Storage
2. 找到扩展 ID
3. 查看 `provider_openai` 配置

## 性能测试

### 响应时间

```bash
# 使用 curl 测试
time curl -X POST https://new-api.koyeb.app/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer sk-ziNP8HRIfSIRUgEmfEavBw8qjxz9axaeFWPV3Pj5W9FYDNTL" \
  -d '{
    "model": "gpt-3.5-turbo",
    "messages": [{"role": "user", "content": "Hi"}]
  }'
```

### 流式响应延迟

运行测试脚本并观察：
```bash
node test-api.js
```

注意观察：
- 首字节时间（TTFB）
- 流式输出是否流畅
- 总响应时间

## 下一步

✅ 测试通过后：
1. 阅读 [使用指南](USAGE.md)
2. 探索更多功能
3. 自定义配置

❌ 测试失败：
1. 查看错误信息
2. 参考 [NEW_API_CONFIG.md](NEW_API_CONFIG.md)
3. 检查 API 账户状态

---

祝测试顺利！有问题请查看完整文档。🚀

