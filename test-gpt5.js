// 测试 gpt-5 模型
const API_KEY = 'sk-ziNP8HRIfSIRUgEmfEavBw8qjxz9axaeFWPV3Pj5W9FYDNTL';
const BASE_URL = 'https://new-api.koyeb.app';

async function testGPT5() {
  console.log('🧪 测试 gpt-5 模型...\n');

  try {
    const response = await fetch(`${BASE_URL}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${API_KEY}`,
      },
      body: JSON.stringify({
        model: 'gpt-5',
        messages: [
          { role: 'user', content: '你好' }
        ],
        stream: false,
      }),
    });

    console.log('响应状态:', response.status, response.statusText);

    if (!response.ok) {
      const error = await response.text();
      console.error('❌ 错误响应:', error);
      return;
    }

    const data = await response.json();
    console.log('\n✅ gpt-5 调用成功！');
    console.log('模型:', data.model);
    console.log('回复:', data.choices[0].message.content);
  } catch (error) {
    console.error('❌ 请求失败:', error.message);
  }
}

testGPT5();

