import type { AIProvider, AIMessage, AIProviderConfig, AITool, AIToolResponse } from '@/types';

export class GeminiProvider implements AIProvider {
  name = 'gemini' as const;
  private config: AIProviderConfig;

  constructor(config: AIProviderConfig) {
    this.config = config;
  }

  async chat(messages: AIMessage[], onChunk: (chunk: string) => void): Promise<string> {
    const model = this.config.model || 'gemini-pro';
    const apiKey = this.config.apiKey;

    // Convert messages to Gemini format
    const contents = messages
      .filter(m => m.role !== 'system')
      .map(m => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: m.content }],
      }));

    // Add system message as first user message if exists
    const systemMessage = messages.find(m => m.role === 'system');
    if (systemMessage) {
      contents.unshift({
        role: 'user',
        parts: [{ text: `System instructions: ${systemMessage.content}` }],
      });
    }

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents,
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 2048,
          },
        }),
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error?.message || 'Gemini API request failed');
    }

    const reader = response.body?.getReader();
    const decoder = new TextDecoder();
    let fullContent = '';

    if (!reader) {
      throw new Error('No response body');
    }

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value);

      // Gemini returns JSON array of responses
      try {
        const lines = chunk.split('\n').filter(line => line.trim());

        for (const line of lines) {
          const parsed = JSON.parse(line);
          const content = parsed.candidates?.[0]?.content?.parts?.[0]?.text;

          if (content) {
            fullContent += content;
            onChunk(content);
          }
        }
      } catch (e) {
        // Continue on parse errors
      }
    }

    return fullContent;
  }

  async chatWithTools(messages: AIMessage[], tools: AITool[]): Promise<AIToolResponse> {
    const model = this.config.model || 'gemini-pro';
    const apiKey = this.config.apiKey;

    // 转换 tools 为 Gemini 格式 (Function Declarations)
    const functionDeclarations = tools.map(t => ({
      name: t.name,
      description: t.description,
      parameters: t.parameters
    }));

    // 转换消息为 Gemini 格式
    const contents = messages
      .filter(m => m.role !== 'system')
      .map(m => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: m.content }],
      }));

    // 添加系统消息作为第一条用户消息
    const systemMessage = messages.find(m => m.role === 'system');
    if (systemMessage) {
      contents.unshift({
        role: 'user',
        parts: [{ text: `System instructions: ${systemMessage.content}` }],
      });
    }

    console.log('[Gemini] 发送 Function Calling 请求，工具数量:', tools.length);

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents,
          tools: [{
            functionDeclarations
          }],
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 2048,
          },
        }),
      }
    );

    if (!response.ok) {
      const error = await response.json();
      console.error('[Gemini] Function Calling 请求失败:', error);
      throw new Error(error.error?.message || 'Gemini Function Calling API request failed');
    }

    const data = await response.json();
    console.log('[Gemini] Function Calling 响应:', data);

    // 解析响应
    const candidate = data.candidates?.[0];
    if (!candidate) {
      return { content: '' };
    }

    const parts = candidate.content?.parts || [];
    let textContent = '';
    const toolCalls: Array<{ name: string; arguments: Record<string, unknown> }> = [];

    // Gemini 的响应格式：parts 数组包含 text 和 functionCall
    for (const part of parts) {
      if (part.text) {
        textContent += part.text;
      } else if (part.functionCall) {
        toolCalls.push({
          name: part.functionCall.name,
          arguments: part.functionCall.args || {}
        });
      }
    }

    console.log('[Gemini] 解析结果 - 文本:', textContent.substring(0, 100), '工具调用:', toolCalls.length);

    if (toolCalls.length > 0) {
      return {
        content: textContent,
        toolCalls
      };
    }

    return {
      content: textContent
    };
  }
}

