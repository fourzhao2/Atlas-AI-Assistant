// New API 测试脚本
// 使用方法: node test-api.js

const API_KEY = 'sk-ziNP8HRIfSIRUgEmfEavBw8qjxz9axaeFWPV3Pj5W9FYDNTL';
const BASE_URL = 'https://new-api.koyeb.app';

async function testAPI() {
  console.log('🧪 测试 New API 连接...\n');
  console.log('API 端点:', `${BASE_URL}/v1/chat/completions`);
  console.log('API Key:', API_KEY.substring(0, 20) + '...\n');

  try {
    const response = await fetch(`${BASE_URL}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${API_KEY}`,
      },
      body: JSON.stringify({
        model: 'gpt-3.5-turbo',
        messages: [
          {
            role: 'user',
            content: '你好！请用一句话介绍你自己。'
          }
        ],
        stream: false,
      }),
    });

    console.log('📡 响应状态:', response.status, response.statusText);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ API 调用失败:');
      console.error('错误详情:', errorText);
      return;
    }

    const data = await response.json();
    console.log('\n✅ API 调用成功！\n');
    console.log('模型:', data.model);
    console.log('回复内容:', data.choices[0].message.content);
    console.log('\n完整响应:');
    console.log(JSON.stringify(data, null, 2));

  } catch (error) {
    console.error('❌ 发生错误:', error.message);
    console.error('详细信息:', error);
  }
}

// 测试流式响应
async function testStreamAPI() {
  console.log('\n\n🌊 测试流式响应...\n');

  try {
    const response = await fetch(`${BASE_URL}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${API_KEY}`,
      },
      body: JSON.stringify({
        model: 'gpt-3.5-turbo',
        messages: [
          {
            role: 'user',
            content: '请用一句话介绍人工智能。'
          }
        ],
        stream: true,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ 流式 API 调用失败:');
      console.error('错误详情:', errorText);
      return;
    }

    console.log('✅ 开始接收流式数据:\n');

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let fullContent = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value);
      const lines = chunk.split('\n').filter(line => line.trim() !== '');

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6);
          if (data === '[DONE]') {
            console.log('\n\n✅ 流式响应完成');
            continue;
          }

          try {
            const parsed = JSON.parse(data);
            const content = parsed.choices?.[0]?.delta?.content;
            if (content) {
              process.stdout.write(content);
              fullContent += content;
            }
          } catch (e) {
            // Skip invalid JSON
          }
        }
      }
    }

    console.log('\n\n完整内容:', fullContent);

  } catch (error) {
    console.error('❌ 流式调用错误:', error.message);
  }
}

// 测试模型列表
async function testModels() {
  console.log('\n\n📋 测试获取模型列表...\n');

  try {
    const response = await fetch(`${BASE_URL}/v1/models`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${API_KEY}`,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ 获取模型列表失败:', errorText);
      return;
    }

    const data = await response.json();
    console.log('✅ 可用模型列表:');
    
    if (data.data && Array.isArray(data.data)) {
      data.data.slice(0, 10).forEach((model, index) => {
        console.log(`${index + 1}. ${model.id}`);
      });
      console.log(`\n总共 ${data.data.length} 个模型`);
    } else {
      console.log(JSON.stringify(data, null, 2));
    }

  } catch (error) {
    console.error('❌ 获取模型列表错误:', error.message);
  }
}

// 运行所有测试
async function runAllTests() {
  console.log('═══════════════════════════════════════');
  console.log('   New API 兼容性测试套件');
  console.log('═══════════════════════════════════════\n');

  await testAPI();
  await testStreamAPI();
  await testModels();

  console.log('\n═══════════════════════════════════════');
  console.log('   测试完成！');
  console.log('═══════════════════════════════════════\n');
}

runAllTests();

