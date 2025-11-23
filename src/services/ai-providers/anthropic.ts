import type { AIProvider, AIMessage, AIProviderConfig, AITool, AIToolResponse } from '@/types';

export class AnthropicProvider implements AIProvider {
  name = 'anthropic' as const;
  private config: AIProviderConfig;

  constructor(config: AIProviderConfig) {
    this.config = config;
  }

  async chat(messages: AIMessage[], onChunk: (chunk: string) => void): Promise<string> {
    // Separate system messages
    const systemMessages = messages.filter(m => m.role === 'system');
    const conversationMessages = messages.filter(m => m.role !== 'system');

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.config.apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: this.config.model || 'claude-3-5-sonnet-20241022',
        max_tokens: 4096,
        system: systemMessages.map(m => m.content).join('\n') || undefined,
        messages: conversationMessages.map(m => ({
          role: m.role === 'assistant' ? 'assistant' : 'user',
          content: m.content
        })),
        stream: true,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error?.message || 'Anthropic API request failed');
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
      const lines = chunk.split('\n').filter(line => line.trim() !== '');

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6);

          try {
            const parsed = JSON.parse(data);

            if (parsed.type === 'content_block_delta' && parsed.delta?.text) {
              const content = parsed.delta.text;
              fullContent += content;
              onChunk(content);
            }
          } catch (e) {
            // Skip invalid JSON
          }
        }
      }
    }

    return fullContent;
  }

  async chatWithTools(messages: AIMessage[], tools: AITool[]): Promise<AIToolResponse> {
    // 转换 tools 为 Anthropic 格式
    const anthropicTools = tools.map(t => ({
      name: t.name,
      description: t.description,
      input_schema: t.parameters
    }));

    // 分离系统消息和对话消息
    const systemMessages = messages.filter(m => m.role === 'system');
    const conversationMessages = messages.filter(m => m.role !== 'system');

    console.log('[Anthropic] 发送 Tool Use 请求，工具数量:', tools.length);

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.config.apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: this.config.model || 'claude-3-5-sonnet-20241022',
        max_tokens: 4096,
        system: systemMessages.map(m => m.content).join('\n') || undefined,
        messages: conversationMessages.map(m => ({
          role: m.role === 'assistant' ? 'assistant' : 'user',
          content: m.content
        })),
        tools: anthropicTools,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      console.error('[Anthropic] Tool Use 请求失败:', error);
      throw new Error(error.error?.message || 'Anthropic Tool Use API request failed');
    }

    const data = await response.json();
    console.log('[Anthropic] Tool Use 响应:', data);

    // 解析响应
    const content = data.content || [];
    let textContent = '';
    const toolCalls: Array<{ name: string; arguments: Record<string, unknown> }> = [];

    // Anthropic 的响应格式：content 是一个数组，包含 text 和 tool_use 块
    for (const block of content) {
      if (block.type === 'text') {
        textContent += block.text;
      } else if (block.type === 'tool_use') {
        toolCalls.push({
          name: block.name,
          arguments: block.input || {}
        });
      }
    }

    console.log('[Anthropic] 解析结果 - 文本:', textContent.substring(0, 100), '工具调用:', toolCalls.length);

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

