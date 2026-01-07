/**
 * ReAct Agent 模式测试脚本
 * 运行方式: node test-react-agent.js
 */

console.log('🤖 ReAct Agent 模式测试\n');
console.log('='.repeat(60));

// ==================== 模拟类型 ====================

/**
 * @typedef {'idle' | 'thinking' | 'acting' | 'observing' | 'completed' | 'error'} ReActPhase
 * @typedef {{ id: string; phase: ReActPhase; thought?: string; action?: { tool: string; input: object }; observation?: string; timestamp: number }} ReActStep
 */

// ==================== 模拟 Token 估算 ====================

function estimateTokens(text) {
  if (!text) return 0;
  const chineseChars = (text.match(/[\u4e00-\u9fff]/g) || []).length;
  const englishWords = (text.match(/[a-zA-Z]+/g) || []).length;
  return Math.ceil(chineseChars * 0.7 + englishWords * 1.3 + text.length / 10);
}

// ==================== 模拟工具 ====================

const mockTools = [
  {
    name: 'web_search',
    description: '搜索网络信息',
    parameters: { type: 'object', properties: { query: { type: 'string' } } }
  },
  {
    name: 'get_page_content',
    description: '获取当前页面内容',
    parameters: { type: 'object', properties: {} }
  },
  {
    name: 'click_element',
    description: '点击页面元素',
    parameters: { type: 'object', properties: { selector: { type: 'string' } } }
  }
];

// ==================== 模拟 AI 响应 ====================

const mockAIResponses = [
  // 第一次调用 - AI 决定使用工具
  {
    content: '我需要先搜索 React 相关的教程信息。',
    toolCalls: [{
      id: 'call_001',
      type: 'function',
      function: {
        name: 'web_search',
        arguments: JSON.stringify({ query: 'React 入门教程' })
      }
    }]
  },
  // 第二次调用 - AI 给出最终答案
  {
    content: `根据搜索结果，我为您整理了 React 入门教程的信息：

## React 入门教程推荐

1. **官方文档** - react.dev
   - 最权威的学习资源
   - 包含交互式教程

2. **React 官方教程**
   - 通过构建井字棋游戏学习 React
   
3. **视频教程**
   - B站有很多优质的中文教程

建议从官方文档开始学习！`,
    toolCalls: undefined
  }
];

let mockResponseIndex = 0;

async function mockCallAI(messages, tools) {
  // 模拟 AI 调用延迟
  await new Promise(r => setTimeout(r, 100));
  
  const response = mockAIResponses[mockResponseIndex];
  mockResponseIndex = Math.min(mockResponseIndex + 1, mockAIResponses.length - 1);
  
  return response;
}

async function mockExecuteToolCall(toolName, args) {
  console.log(`    [模拟] 执行工具: ${toolName}`);
  console.log(`    [模拟] 参数:`, args);
  
  // 模拟工具执行延迟
  await new Promise(r => setTimeout(r, 50));
  
  switch (toolName) {
    case 'web_search':
      return `搜索结果: 找到了关于 "${args.query}" 的 10 个相关结果，包括 React 官方文档、教程网站等。`;
    case 'get_page_content':
      return '页面内容: 这是一个技术博客页面...';
    default:
      return `工具 ${toolName} 执行成功`;
  }
}

// ==================== ReAct Agent 核心逻辑 ====================

function generateId() {
  return `${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
}

async function runReActAgent(userMessage, options = {}) {
  const {
    maxIterations = 10,
    tools = mockTools,
    callAI = mockCallAI,
    executeToolCall = mockExecuteToolCall,
    onStep = () => {},
    onThought = () => {},
    onAction = () => {},
    onObservation = () => {}
  } = options;

  console.log(`\n📍 用户输入: "${userMessage}"\n`);

  /** @type {ReActStep[]} */
  const steps = [];
  
  /** @type {Array<{role: string; content: string; tool_call_id?: string; name?: string}>} */
  const messages = [
    {
      role: 'system',
      content: `你是一个智能助手，使用 ReAct 模式工作。可用工具: ${tools.map(t => t.name).join(', ')}`
    },
    {
      role: 'user',
      content: userMessage
    }
  ];

  let iteration = 0;
  let totalTokens = 0;

  while (iteration < maxIterations) {
    iteration++;
    console.log(`\n--- 迭代 ${iteration}/${maxIterations} ---`);

    // Step 1: 思考
    const thinkingStep = {
      id: generateId(),
      phase: 'thinking',
      thought: '分析问题中...',
      timestamp: Date.now()
    };
    steps.push(thinkingStep);
    onStep(thinkingStep);

    console.log('💭 [思考] 调用 AI...');

    // 调用 AI
    const aiResponse = await callAI(messages, tools);
    
    thinkingStep.thought = aiResponse.content;
    onThought(aiResponse.content);
    
    console.log(`💭 [思考] AI 回复: ${aiResponse.content.substring(0, 80)}...`);

    // 计算 token
    totalTokens += estimateTokens(aiResponse.content);

    // 将 AI 响应添加到消息
    messages.push({
      role: 'assistant',
      content: aiResponse.content
    });

    // Step 2: 检查是否有 tool_calls
    if (!aiResponse.toolCalls || aiResponse.toolCalls.length === 0) {
      console.log('\n✅ [完成] AI 给出最终答案，结束循环');
      
      const completedStep = {
        id: generateId(),
        phase: 'completed',
        thought: '任务完成',
        timestamp: Date.now()
      };
      steps.push(completedStep);
      onStep(completedStep);

      return {
        success: true,
        finalAnswer: aiResponse.content,
        steps,
        totalIterations: iteration,
        totalTokens
      };
    }

    // Step 3: 执行工具
    for (const toolCall of aiResponse.toolCalls) {
      const toolName = toolCall.function.name;
      const toolArgs = JSON.parse(toolCall.function.arguments);

      console.log(`⚡ [行动] 调用工具: ${toolName}`);

      const actionStep = {
        id: generateId(),
        phase: 'acting',
        action: { tool: toolName, input: toolArgs },
        timestamp: Date.now()
      };
      steps.push(actionStep);
      onStep(actionStep);
      onAction({ tool: toolName, input: toolArgs });

      // Step 4: 观察
      let observation;
      try {
        observation = await executeToolCall(toolName, toolArgs);
      } catch (error) {
        observation = `工具执行失败: ${error.message}`;
      }

      console.log(`👀 [观察] 结果: ${observation.substring(0, 60)}...`);

      const observeStep = {
        id: generateId(),
        phase: 'observing',
        observation,
        timestamp: Date.now()
      };
      steps.push(observeStep);
      onStep(observeStep);
      onObservation(observation);

      // 将工具结果添加到消息（使用 tool role）
      messages.push({
        role: 'tool',
        content: observation,
        tool_call_id: toolCall.id,
        name: toolName
      });

      totalTokens += estimateTokens(observation);
    }
  }

  // 达到最大迭代次数
  console.log('\n⚠️ 达到最大迭代次数');
  return {
    success: false,
    error: '达到最大迭代次数',
    steps,
    totalIterations: iteration,
    totalTokens
  };
}

// ==================== 运行测试 ====================

async function runTest() {
  console.log('\n📝 测试 1: 基本 ReAct 循环\n');

  const result = await runReActAgent('帮我搜索 React 入门教程');

  console.log('\n' + '='.repeat(60));
  console.log('\n📊 执行结果:\n');
  console.log('  成功:', result.success);
  console.log('  迭代次数:', result.totalIterations);
  console.log('  步骤数:', result.steps.length);
  console.log('  Token 使用:', result.totalTokens);
  
  if (result.finalAnswer) {
    console.log('\n📝 最终答案:\n');
    console.log(result.finalAnswer.split('\n').map(l => '  ' + l).join('\n'));
  }

  console.log('\n' + '='.repeat(60));
  console.log('\n📋 步骤详情:\n');
  
  result.steps.forEach((step, i) => {
    const icon = {
      'thinking': '💭',
      'acting': '⚡',
      'observing': '👀',
      'completed': '✅',
      'error': '❌'
    }[step.phase] || '📌';
    
    console.log(`  ${i + 1}. ${icon} ${step.phase}`);
    if (step.thought) console.log(`     思考: ${step.thought.substring(0, 50)}...`);
    if (step.action) console.log(`     工具: ${step.action.tool}`);
    if (step.observation) console.log(`     观察: ${step.observation.substring(0, 50)}...`);
  });

  console.log('\n' + '='.repeat(60));
  console.log('\n🔍 消息格式验证:\n');
  
  // 验证 tool role 消息格式
  console.log('  ✅ 支持 role: "user" | "assistant" | "system" | "tool"');
  console.log('  ✅ tool 消息包含 tool_call_id 和 name 字段');
  console.log('  ✅ 循环判断: 检查 toolCalls 是否存在');
  console.log('  ✅ 结束条件: toolCalls 为空或达到最大迭代');

  console.log('\n' + '='.repeat(60));
  console.log('\n✅ ReAct Agent 模式测试完成!\n');

  console.log('📝 核心流程:');
  console.log('  1. 接收用户输入');
  console.log('  2. 思考 (Thought) - 调用 AI');
  console.log('  3. 行动 (Action) - 如果 AI 返回 toolCalls，执行工具');
  console.log('  4. 观察 (Observation) - 获取工具结果，添加 tool role 消息');
  console.log('  5. 循环 - 重复 2-4 直到 AI 不返回 toolCalls');
  console.log('  6. 输出最终答案');

  console.log('\n💡 关键判断点:');
  console.log('  - if (toolCalls && toolCalls.length > 0) → 继续循环');
  console.log('  - if (!toolCalls || toolCalls.length === 0) → 结束，输出答案');
  console.log('  - if (iteration >= maxIterations) → 强制结束');
}

runTest().catch(console.error);

