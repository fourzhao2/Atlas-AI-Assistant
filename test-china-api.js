/**
 * 国内 AI API 测试脚本
 * 
 * 使用方法:
 * 1. 设置环境变量 (PowerShell):
 *    $env:DEEPSEEK_API_KEY = "你的DeepSeek API Key"
 *    $env:QWEN_API_KEY = "你的通义千问 API Key"
 * 
 * 2. 运行测试:
 *    node test-china-api.js
 */

const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY;
const QWEN_API_KEY = process.env.QWEN_API_KEY;

// 测试 DeepSeek API
async function testDeepSeek() {
  if (!DEEPSEEK_API_KEY) {
    console.log('⚠️  跳过 DeepSeek 测试 (未设置 DEEPSEEK_API_KEY)');
    return;
  }

  console.log('\n🔷 测试 DeepSeek API...');
  console.log('   API 地址: https://api.deepseek.com/v1/chat/completions');
  console.log('   模型: deepseek-chat');

  try {
    const response = await fetch('https://api.deepseek.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${DEEPSEEK_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: [
          { role: 'user', content: '你好，请用一句话介绍你自己' }
        ],
        max_tokens: 100,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error?.message || `HTTP ${response.status}`);
    }

    const data = await response.json();
    console.log('   ✅ DeepSeek 连接成功!');
    console.log('   回复:', data.choices[0].message.content);
    console.log('   Token 使用:', data.usage);
  } catch (error) {
    console.log('   ❌ DeepSeek 测试失败:', error.message);
  }
}

// 测试通义千问 API
async function testQwen() {
  if (!QWEN_API_KEY) {
    console.log('⚠️  跳过通义千问测试 (未设置 QWEN_API_KEY)');
    return;
  }

  console.log('\n🔶 测试通义千问 API...');
  console.log('   API 地址: https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions');
  console.log('   模型: qwen-plus');

  try {
    const response = await fetch('https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${QWEN_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'qwen-plus',
        messages: [
          { role: 'user', content: '你好，请用一句话介绍你自己' }
        ],
        max_tokens: 100,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error?.message || `HTTP ${response.status}`);
    }

    const data = await response.json();
    console.log('   ✅ 通义千问 连接成功!');
    console.log('   回复:', data.choices[0].message.content);
    console.log('   Token 使用:', data.usage);
  } catch (error) {
    console.log('   ❌ 通义千问 测试失败:', error.message);
  }
}

// 测试通义千问多模态 API
async function testQwenVision() {
  if (!QWEN_API_KEY) {
    console.log('⚠️  跳过通义千问多模态测试 (未设置 QWEN_API_KEY)');
    return;
  }

  console.log('\n🖼️  测试通义千问多模态 API...');
  console.log('   模型: qwen-vl-plus');

  try {
    // 使用一个公开的测试图片 URL
    const response = await fetch('https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${QWEN_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'qwen-vl-plus',
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: '这张图片里有什么？请简短描述。' },
              {
                type: 'image_url',
                image_url: {
                  url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/4/47/PNG_transparency_demonstration_1.png/280px-PNG_transparency_demonstration_1.png'
                }
              }
            ]
          }
        ],
        max_tokens: 100,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error?.message || `HTTP ${response.status}`);
    }

    const data = await response.json();
    console.log('   ✅ 通义千问多模态 连接成功!');
    console.log('   图片描述:', data.choices[0].message.content);
  } catch (error) {
    console.log('   ❌ 通义千问多模态测试失败:', error.message);
  }
}

// 主函数
async function main() {
  console.log('=========================================');
  console.log('        国内 AI API 连通性测试');
  console.log('=========================================');
  
  await testDeepSeek();
  await testQwen();
  await testQwenVision();
  
  console.log('\n=========================================');
  console.log('                测试完成');
  console.log('=========================================');
  console.log('\n如需在扩展中使用，请:');
  console.log('1. 重新加载扩展 (chrome://extensions/)');
  console.log('2. 打开扩展设置页面');
  console.log('3. 在 "国内 AI 服务" 分组中配置 API Key');
}

main();

