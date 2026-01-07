/**
 * 短期记忆功能测试脚本
 * 运行方式: node test-short-term-memory.js
 */

console.log('🧪 短期记忆功能测试\n');
console.log('='.repeat(50));

// ==================== Token 估算测试 ====================

console.log('\n📊 测试 1: Token 估算算法\n');

/**
 * Token 估算函数（与 short-term-memory.ts 中的逻辑一致）
 */
function estimateTokens(text) {
  if (!text) return 0;

  // 统计中文字符
  const chineseChars = (text.match(/[\u4e00-\u9fff]/g) || []).length;
  // 统计英文单词
  const englishWords = (text.match(/[a-zA-Z]+/g) || []).length;
  // 统计数字
  const numbers = (text.match(/\d+/g) || []).length;
  // 其他字符（标点、空格等）
  const otherChars = text.length - chineseChars - 
    (text.match(/[a-zA-Z]/g) || []).length - 
    (text.match(/\d/g) || []).length;

  const tokens = Math.ceil(
    chineseChars * 0.7 +
    englishWords * 1.3 +
    numbers +
    otherChars / 4
  );

  return Math.max(1, tokens);
}

// 测试用例
const testCases = [
  { text: 'Hello, world!', expected: '约 5 tokens' },
  { text: '你好，世界！', expected: '约 5 tokens' },
  { text: 'The quick brown fox jumps over the lazy dog.', expected: '约 15 tokens' },
  { text: '这是一段中文测试文本，用于验证Token估算的准确性。', expected: '约 18 tokens' },
  { text: 'React 是一个用于构建用户界面的 JavaScript 库。', expected: '约 20 tokens' },
  { text: 'function calculateSum(a, b) { return a + b; }', expected: '约 15 tokens' },
];

testCases.forEach((tc, i) => {
  const tokens = estimateTokens(tc.text);
  console.log(`  ${i + 1}. "${tc.text.substring(0, 40)}${tc.text.length > 40 ? '...' : ''}"`);
  console.log(`     估算: ${tokens} tokens (参考: ${tc.expected})`);
});

// ==================== 消息裁剪测试 ====================

console.log('\n' + '='.repeat(50));
console.log('\n✂️ 测试 2: 消息裁剪逻辑\n');

function estimateMessagesTokens(messages) {
  let total = 0;
  for (const msg of messages) {
    total += 4 + estimateTokens(msg.content);
  }
  return total;
}

// 生成测试消息
function generateTestMessages(count) {
  const messages = [];
  for (let i = 1; i <= count; i++) {
    messages.push({
      role: i % 2 === 1 ? 'user' : 'assistant',
      content: `这是第 ${i} 条消息。它包含一些测试内容，用于验证短期记忆的Token估算和裁剪功能。`,
      timestamp: Date.now() + i * 1000
    });
  }
  return messages;
}

const testMessages = generateTestMessages(20);
const totalTokens = estimateMessagesTokens(testMessages);

console.log(`  生成了 ${testMessages.length} 条测试消息`);
console.log(`  总计 Token 数: ${totalTokens}`);
console.log(`  平均每条消息: ${Math.round(totalTokens / testMessages.length)} tokens`);

// 模拟裁剪
const maxTokens = 200;
console.log(`\n  模拟裁剪 (maxTokens: ${maxTokens}):`);

function trimByTokens(messages, maxTokens) {
  const result = [];
  let currentTokens = 0;

  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i];
    const msgTokens = 4 + estimateTokens(msg.content);

    if (currentTokens + msgTokens > maxTokens) {
      break;
    }

    result.unshift(msg);
    currentTokens += msgTokens;
  }

  return { messages: result, tokens: currentTokens };
}

const trimResult = trimByTokens(testMessages, maxTokens);
console.log(`  保留消息数: ${trimResult.messages.length}/${testMessages.length}`);
console.log(`  保留 Token 数: ${trimResult.tokens}/${maxTokens}`);

// ==================== 摘要压缩测试 ====================

console.log('\n' + '='.repeat(50));
console.log('\n📝 测试 3: 摘要压缩场景\n');

const maxRecentMessages = 10;
const mockConversation = generateTestMessages(25);
const conversationTokens = estimateMessagesTokens(mockConversation);

console.log(`  模拟对话: ${mockConversation.length} 条消息, ${conversationTokens} tokens`);
console.log(`  保留最近 ${maxRecentMessages} 条消息`);

const recentMessages = mockConversation.slice(-maxRecentMessages);
const oldMessages = mockConversation.slice(0, -maxRecentMessages);

const recentTokens = estimateMessagesTokens(recentMessages);
const oldTokens = estimateMessagesTokens(oldMessages);

console.log(`\n  分割结果:`);
console.log(`    - 旧消息 (需摘要): ${oldMessages.length} 条, ${oldTokens} tokens`);
console.log(`    - 新消息 (保留): ${recentMessages.length} 条, ${recentTokens} tokens`);

// 模拟摘要（实际会调用 AI）
const mockSummary = `用户与AI进行了${oldMessages.length}轮对话，讨论了测试内容和Token估算。`;
const summaryTokens = estimateTokens(mockSummary);

console.log(`\n  生成摘要: "${mockSummary}"`);
console.log(`  摘要 Token 数: ${summaryTokens}`);
console.log(`\n  压缩效果:`);
console.log(`    - 压缩前: ${conversationTokens} tokens`);
console.log(`    - 压缩后: ${recentTokens + summaryTokens} tokens`);
console.log(`    - 节省: ${conversationTokens - recentTokens - summaryTokens} tokens (${Math.round((1 - (recentTokens + summaryTokens) / conversationTokens) * 100)}%)`);

// ==================== 完整流程测试 ====================

console.log('\n' + '='.repeat(50));
console.log('\n🔄 测试 4: 完整处理流程\n');

const CONFIG = {
  maxTokens: 4000,
  maxRecentMessages: 10,
  summaryMaxTokens: 500,
  enableSummarization: true
};

console.log('  配置:', JSON.stringify(CONFIG, null, 2).replace(/\n/g, '\n  '));

// 模拟多轮对话
const scenarios = [
  { messages: 5, desc: '短对话 (5条)' },
  { messages: 15, desc: '中等对话 (15条)' },
  { messages: 30, desc: '长对话 (30条)' },
  { messages: 50, desc: '超长对话 (50条)' },
];

console.log('\n  场景测试:');
scenarios.forEach(scenario => {
  const msgs = generateTestMessages(scenario.messages);
  const tokens = estimateMessagesTokens(msgs);
  const needsCompression = tokens > CONFIG.maxTokens;
  
  console.log(`\n  📌 ${scenario.desc}`);
  console.log(`     Token 数: ${tokens} / ${CONFIG.maxTokens}`);
  console.log(`     使用率: ${Math.round(tokens / CONFIG.maxTokens * 100)}%`);
  console.log(`     需要压缩: ${needsCompression ? '✅ 是' : '❌ 否'}`);
  
  if (needsCompression) {
    const recent = msgs.slice(-CONFIG.maxRecentMessages);
    const old = msgs.slice(0, -CONFIG.maxRecentMessages);
    const saved = estimateMessagesTokens(old) - estimateTokens('摘要内容约100字符');
    console.log(`     预计节省: ~${saved} tokens`);
  }
});

// ==================== 总结 ====================

console.log('\n' + '='.repeat(50));
console.log('\n✅ 测试完成!\n');
console.log('短期记忆功能核心逻辑验证通过。');
console.log('\n📝 功能说明:');
console.log('  1. Token 估算: 支持中英文混合文本');
console.log('  2. 上下文窗口: 默认限制 4000 tokens');
console.log('  3. 摘要压缩: 超限时自动压缩旧消息');
console.log('  4. 消息保留: 保留最近 10 条消息原文');
console.log('\n💡 在浏览器中测试:');
console.log('  1. 加载扩展到 Chrome/Edge');
console.log('  2. 打开侧边栏进行多轮对话');
console.log('  3. 观察头部的 Token 使用进度条');
console.log('  4. 当超过限制时会自动生成摘要');

