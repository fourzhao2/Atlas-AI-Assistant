import type { AIProvider, AIMessage, AIProviderConfig, AITool, AIToolResponse } from '@/types';

export class OpenAIProvider implements AIProvider {
  name = 'openai' as const;
  private config: AIProviderConfig;

  constructor(config: AIProviderConfig) {
    this.config = config;
  }

  async chat(messages: AIMessage[], onChunk: (chunk: string) => void): Promise<string> {
    const baseUrl = this.config.baseUrl || 'https://api.openai.com';
    const apiUrl = `${baseUrl}/v1/chat/completions`;
    
    console.log('[OpenAI] 发送请求到:', apiUrl);
    console.log('[OpenAI] 使用模型:', this.config.model || 'gpt-4o-mini');
    
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.config.apiKey}`,
      },
      body: JSON.stringify({
        model: this.config.model || 'gpt-4o-mini',
        messages: messages.map(m => ({ role: m.role, content: m.content })),
        stream: true,
      }),
    });

    console.log('[OpenAI] 响应状态:', response.status, response.statusText);

    if (!response.ok) {
      let errorMessage = `API 请求失败 (${response.status})`;
      try {
        const error = await response.json();
        errorMessage = error.error?.message || error.message || errorMessage;
        console.error('[OpenAI] 错误详情:', error);
      } catch (e) {
        const text = await response.text();
        console.error('[OpenAI] 错误响应:', text);
        errorMessage = text || errorMessage;
      }
      throw new Error(errorMessage);
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
          if (data === '[DONE]') continue;

          try {
            const parsed = JSON.parse(data);
            const content = parsed.choices?.[0]?.delta?.content;
            if (content) {
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
    const baseUrl = this.config.baseUrl || 'https://api.openai.com';
    const response = await fetch(`${baseUrl}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.config.apiKey}`,
      },
      body: JSON.stringify({
        model: this.config.model || 'gpt-4o-mini',
        messages: messages.map(m => ({ role: m.role, content: m.content })),
        tools: tools.map(t => ({
          type: 'function',
          function: {
            name: t.name,
            description: t.description,
            parameters: t.parameters,
          },
        })),
        tool_choice: 'auto',
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error?.message || 'OpenAI API request failed');
    }

    const data = await response.json();
    const choice = data.choices?.[0];
    
    if (choice?.message?.tool_calls) {
      return {
        content: choice.message.content || '',
        toolCalls: choice.message.tool_calls.map((tc: any) => ({
          name: tc.function.name,
          arguments: JSON.parse(tc.function.arguments),
        })),
      };
    }

    return {
      content: choice?.message?.content || '',
    };
  }
}

