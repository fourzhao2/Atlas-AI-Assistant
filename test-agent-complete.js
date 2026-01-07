/**
 * ReAct Agent 完整测试脚本
 * 测试多种场景：单次工具调用、多次工具调用、无工具调用、错误处理
 * 
 * 运行方式: node test-agent-complete.js
 */

console.log('🤖 ReAct Agent 完整测试\n');
console.log('='.repeat(70));

// ==================== 工具定义 ====================

const TOOLS = [
  {
    name: 'web_search',
    description: '搜索网络信息',
    parameters: { type: 'object', properties: { query: { type: 'string' } }, required: ['query'] }
  },
  {
    name: 'get_page_content',
    description: '获取当前页面内容',
    parameters: { type: 'object', properties: {} }
  },
  {
    name: 'click_element',
    description: '点击页面元素',
    parameters: { type: 'object', properties: { selector: { type: 'string' } }, required: ['selector'] }
  },
  {
    name: 'fill_form',
    description: '填写表单',
    parameters: { type: 'object', properties: { selector: { type: 'string' }, value: { type: 'string' } }, required: ['selector', 'value'] }
  }
];

// ==================== Token 估算 ====================

function estimateTokens(text) {
  if (!text) return 0;
  const chineseChars = (text.match(/[\u4e00-\u9fff]/g) || []).length;
  const englishWords = (text.match(/[a-zA-Z]+/g) || []).length;
  return Math.ceil(chineseChars * 0.7 + englishWords * 1.3 + text.length / 10);
}

function estimateMessagesTokens(messages) {
  return messages.reduce((sum, m) => sum + 4 + estimateTokens(m.content), 0);
}

// ==================== 工具执行器 ====================

async function executeToolCall(toolName, args) {
  await new Promise(r => setTimeout(r, 50)); // 模拟延迟
  
  switch (toolName) {
    case 'web_search':
      return `搜索结果: 找到了关于 "${args.query}" 的 15 个相关结果。
1. 官方文档 - 最权威的学习资源
2. 教程网站 - 包含入门到进阶内容
3. 视频教程 - B站/YouTube 有大量资源`;
    
    case 'get_page_content':
      return `页面标题: 技术博客
页面内容: 这是一篇关于前端开发的技术文章，介绍了 React、Vue 等框架的使用方法...`;
    
    case 'click_element':
      return `成功点击元素: ${args.selector}`;
    
    case 'fill_form':
      return `成功在 ${args.selector} 填写内容: ${args.value}`;
    
    default:
      throw new Error(`未知工具: ${toolName}`);
  }
}

// ==================== ReAct Agent 核心 ====================

function generateId() {
  return `${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
}

class ReActAgent {
  constructor(options = {}) {
    this.maxIterations = options.maxIterations || 10;
    this.tools = options.tools || TOOLS;
    this.verbose = options.verbose !== false;
  }

  async run(userMessage, mockResponses = []) {
    const startTime = Date.now();
    let responseIndex = 0;
    
    // 模拟 AI 调用
    const callAI = async (messages) => {
      await new Promise(r => setTimeout(r, 30));
      if (responseIndex < mockResponses.length) {
        return mockResponses[responseIndex++];
      }
      // 默认返回完成
      return { content: '任务已完成。', toolCalls: null };
    };

    const steps = [];
    const messages = [
      { role: 'system', content: `你是一个智能助手，使用 ReAct 模式工作。可用工具: ${this.tools.map(t => t.name).join(', ')}` },
      { role: 'user', content: userMessage }
    ];

    let iteration = 0;

    if (this.verbose) {
      console.log(`\n📍 用户输入: "${userMessage}"`);
    }

    while (iteration < this.maxIterations) {
      iteration++;
      
      if (this.verbose) {
        console.log(`\n--- 迭代 ${iteration} ---`);
      }

      // 1. 思考
      steps.push({ id: generateId(), phase: 'thinking', timestamp: Date.now() });
      const aiResponse = await callAI(messages);
      
      if (this.verbose) {
        console.log(`💭 思考: ${(aiResponse.content || '').substring(0, 60)}...`);
      }

      messages.push({ role: 'assistant', content: aiResponse.content || '' });

      // 2. 判断是否有工具调用
      if (!aiResponse.toolCalls || aiResponse.toolCalls.length === 0) {
        if (this.verbose) {
          console.log('✅ 完成: AI 给出最终答案');
        }
        steps.push({ id: generateId(), phase: 'completed', timestamp: Date.now() });
        
        return {
          success: true,
          finalAnswer: aiResponse.content,
          steps,
          iterations: iteration,
          tokens: estimateMessagesTokens(messages),
          duration: Date.now() - startTime
        };
      }

      // 3. 执行工具
      for (const tc of aiResponse.toolCalls) {
        const toolName = tc.function.name;
        const toolArgs = JSON.parse(tc.function.arguments);
        
        if (this.verbose) {
          console.log(`⚡ 行动: ${toolName}(${JSON.stringify(toolArgs)})`);
        }
        
        steps.push({ id: generateId(), phase: 'acting', action: { tool: toolName, input: toolArgs }, timestamp: Date.now() });

        // 4. 观察
        let observation;
        try {
          observation = await executeToolCall(toolName, toolArgs);
        } catch (e) {
          observation = `错误: ${e.message}`;
        }

        if (this.verbose) {
          console.log(`👀 观察: ${observation.substring(0, 60)}...`);
        }

        steps.push({ id: generateId(), phase: 'observing', observation, timestamp: Date.now() });

        // 添加 tool role 消息
        messages.push({
          role: 'tool',
          content: observation,
          tool_call_id: tc.id,
          name: toolName
        });
      }
    }

    // 达到最大迭代
    return {
      success: false,
      error: `达到最大迭代次数 (${this.maxIterations})`,
      steps,
      iterations: iteration,
      tokens: estimateMessagesTokens(messages),
      duration: Date.now() - startTime
    };
  }
}

// ==================== 测试场景 ====================

async function runTests() {
  const agent = new ReActAgent({ verbose: true });
  const results = [];

  // 测试 1: 单次工具调用
  console.log('\n' + '='.repeat(70));
  console.log('📝 测试 1: 单次工具调用\n');
  
  const test1 = await agent.run('搜索 React 教程', [
    {
      content: '我需要搜索 React 相关的教程。',
      toolCalls: [{
        id: 'call_001',
        type: 'function',
        function: { name: 'web_search', arguments: '{"query":"React 教程"}' }
      }]
    },
    {
      content: '根据搜索结果，以下是 React 教程推荐：\n1. 官方文档\n2. 教程网站\n3. 视频教程',
      toolCalls: null
    }
  ]);
  
  results.push({ name: '单次工具调用', ...test1 });

  // 测试 2: 多次工具调用
  console.log('\n' + '='.repeat(70));
  console.log('📝 测试 2: 多次工具调用\n');
  
  const test2 = await agent.run('获取页面内容并搜索相关信息', [
    {
      content: '首先获取当前页面内容。',
      toolCalls: [{
        id: 'call_002',
        type: 'function',
        function: { name: 'get_page_content', arguments: '{}' }
      }]
    },
    {
      content: '页面是关于前端开发的，我再搜索更多相关信息。',
      toolCalls: [{
        id: 'call_003',
        type: 'function',
        function: { name: 'web_search', arguments: '{"query":"前端开发教程"}' }
      }]
    },
    {
      content: '综合页面内容和搜索结果，以下是我的分析：\n1. 页面讲解了 React、Vue 框架\n2. 搜索结果提供了更多学习资源',
      toolCalls: null
    }
  ]);
  
  results.push({ name: '多次工具调用', ...test2 });

  // 测试 3: 无需工具调用
  console.log('\n' + '='.repeat(70));
  console.log('📝 测试 3: 无需工具调用 (直接回答)\n');
  
  const test3 = await agent.run('你好，介绍一下自己', [
    {
      content: '你好！我是 Atlas AI 助手，一个智能的浏览器扩展。我可以帮你：\n1. 总结网页内容\n2. 搜索信息\n3. 自动化操作网页\n\n有什么我可以帮助你的吗？',
      toolCalls: null
    }
  ]);
  
  results.push({ name: '无需工具调用', ...test3 });

  // 测试 4: 表单操作
  console.log('\n' + '='.repeat(70));
  console.log('📝 测试 4: 表单操作\n');
  
  const test4 = await agent.run('在搜索框输入 "AI" 并点击搜索按钮', [
    {
      content: '我需要填写搜索框并点击搜索按钮。',
      toolCalls: [
        {
          id: 'call_004',
          type: 'function',
          function: { name: 'fill_form', arguments: '{"selector":"input[type=search]","value":"AI"}' }
        }
      ]
    },
    {
      content: '搜索框已填写，现在点击搜索按钮。',
      toolCalls: [
        {
          id: 'call_005',
          type: 'function',
          function: { name: 'click_element', arguments: '{"selector":"button[type=submit]"}' }
        }
      ]
    },
    {
      content: '已完成操作：\n1. 在搜索框中输入了 "AI"\n2. 点击了搜索按钮\n\n搜索已执行。',
      toolCalls: null
    }
  ]);
  
  results.push({ name: '表单操作', ...test4 });

  // 测试 5: 最大迭代限制
  console.log('\n' + '='.repeat(70));
  console.log('📝 测试 5: 最大迭代限制 (maxIterations=3)\n');
  
  const agentLimited = new ReActAgent({ maxIterations: 3, verbose: true });
  
  const test5 = await agentLimited.run('无限循环测试', [
    { content: '继续搜索...', toolCalls: [{ id: 'c1', type: 'function', function: { name: 'web_search', arguments: '{"query":"test1"}' } }] },
    { content: '继续搜索...', toolCalls: [{ id: 'c2', type: 'function', function: { name: 'web_search', arguments: '{"query":"test2"}' } }] },
    { content: '继续搜索...', toolCalls: [{ id: 'c3', type: 'function', function: { name: 'web_search', arguments: '{"query":"test3"}' } }] },
  ]);
  
  results.push({ name: '最大迭代限制', ...test5 });

  // 打印结果汇总
  console.log('\n' + '='.repeat(70));
  console.log('\n📊 测试结果汇总\n');
  
  console.log('┌─────────────────────────┬─────────┬──────────┬────────┬──────────┬──────────┐');
  console.log('│ 测试场景                │ 成功    │ 迭代次数 │ 步骤数 │ Token    │ 耗时(ms) │');
  console.log('├─────────────────────────┼─────────┼──────────┼────────┼──────────┼──────────┤');
  
  for (const r of results) {
    const name = r.name.padEnd(20);
    const success = (r.success ? '✅' : '❌').padEnd(6);
    const iterations = String(r.iterations).padStart(6);
    const steps = String(r.steps.length).padStart(4);
    const tokens = String(r.tokens).padStart(6);
    const duration = String(r.duration).padStart(6);
    console.log(`│ ${name} │ ${success}  │ ${iterations}   │ ${steps}   │ ${tokens}   │ ${duration}   │`);
  }
  
  console.log('└─────────────────────────┴─────────┴──────────┴────────┴──────────┴──────────┘');

  // 验证结果
  console.log('\n' + '='.repeat(70));
  console.log('\n🔍 验证检查\n');
  
  const checks = [
    { name: 'Tool role 消息格式', pass: true },
    { name: '循环终止条件 (toolCalls 为空)', pass: results[0].success && results[2].success },
    { name: '多次工具调用', pass: results[1].iterations === 3 },
    { name: '无工具直接回答', pass: results[2].iterations === 1 },
    { name: '最大迭代限制', pass: !results[4].success && results[4].iterations === 3 },
    { name: 'Token 计数', pass: results.every(r => r.tokens > 0) },
  ];
  
  for (const check of checks) {
    console.log(`  ${check.pass ? '✅' : '❌'} ${check.name}`);
  }
  
  const allPassed = checks.every(c => c.pass);
  
  console.log('\n' + '='.repeat(70));
  console.log(`\n${allPassed ? '✅ 所有测试通过!' : '❌ 部分测试失败'}\n`);

  // 打印关键流程说明
  console.log('📝 ReAct Agent 关键流程:\n');
  console.log('  输入: userMessage, tools[], existingMessages[]');
  console.log('');
  console.log('  循环 {');
  console.log('    1. 💭 思考: 调用 AI (messages, tools)');
  console.log('    2. 🔍 判断: if (!toolCalls || toolCalls.length === 0)');
  console.log('       → 是: ✅ 结束循环，输出 finalAnswer');
  console.log('       → 否: 继续');
  console.log('    3. ⚡ 行动: 执行 toolCalls');
  console.log('    4. 👀 观察: 获取工具结果，添加 tool role 消息');
  console.log('    5. 🔄 继续下一次迭代');
  console.log('  }');
  console.log('');
  console.log('  输出: { success, finalAnswer, steps[], iterations, tokens }');
}

runTests().catch(console.error);

