import type { AIProvider, AIMessage, AIProviderConfig, AITool, AIToolResponse, AIToolCallRequest } from '@/types';

/**
 * DeepSeek API Provider
 * 
 * DeepSeek API 兼容 OpenAI 格式
 * 官网: https://platform.deepseek.com/
 * API Base URL: https://api.deepseek.com
 * 
 * 支持的模型:
 * - deepseek-chat: 通用对话模型
 * - deepseek-coder: 代码生成模型
 * - deepseek-reasoner: 推理模型 (DeepSeek-R1)
 * 
 * 注意: DeepSeek 目前不支持多模态(图片输入)，但支持 Function Calling
 */

/**
 * 将 AIMessage 转换为 DeepSeek API 格式
 */
function formatMessageForDeepSeek(msg: AIMessage): Record<string, unknown> {
  const base: Record<string, unknown> = {
    role: msg.role,
  };

  // tool role 需要额外字段
  if (msg.role === 'tool') {
    base.tool_call_id = msg.tool_call_id || '';
    if (msg.name) {
      base.name = msg.name;
    }
    base.content = msg.content;
    return base;
  }

  // DeepSeek 不支持多模态，只使用文本内容
  // 如果有图片，添加提示信息
  if (msg.images && msg.images.length > 0) {
    base.content = `${msg.content}\n\n[注意: 用户上传了 ${msg.images.length} 张图片，但当前模型不支持图片理解]`;
  } else {
    base.content = msg.content;
  }

  return base;
}

export class DeepSeekProvider implements AIProvider {
  name = 'deepseek' as const;
  private config: AIProviderConfig;

  constructor(config: AIProviderConfig) {
    this.config = config;
  }

  async chat(messages: AIMessage[], onChunk: (chunk: string) => void): Promise<string> {
    const baseUrl = this.config.baseUrl || 'https://api.deepseek.com';
    const apiUrl = `${baseUrl}/v1/chat/completions`;
    
    console.log('[DeepSeek] 发送请求到:', apiUrl);
    console.log('[DeepSeek] 使用模型:', this.config.model || 'deepseek-chat');
    
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.config.apiKey}`,
      },
      body: JSON.stringify({
        model: this.config.model || 'deepseek-chat',
        messages: messages.map(formatMessageForDeepSeek),
        stream: true,
      }),
    });

    console.log('[DeepSeek] 响应状态:', response.status, response.statusText);

    if (!response.ok) {
      let errorMessage = `API 请求失败 (${response.status})`;
      try {
        const error = await response.json();
        errorMessage = error.error?.message || error.message || errorMessage;
        console.error('[DeepSeek] 错误详情:', error);
      } catch (e) {
        const text = await response.text();
        console.error('[DeepSeek] 错误响应:', text);
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
    const baseUrl = this.config.baseUrl || 'https://api.deepseek.com';
    const response = await fetch(`${baseUrl}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.config.apiKey}`,
      },
      body: JSON.stringify({
        model: this.config.model || 'deepseek-chat',
        messages: messages.map(formatMessageForDeepSeek),
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
      throw new Error(error.error?.message || 'DeepSeek API request failed');
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

  /**
   * 支持 ReAct Agent 模式的 chat with tools
   * 返回原始的 tool_calls 格式，包含 id 用于后续关联
   */
  async chatWithToolsRaw(
    messages: AIMessage[], 
    tools: AITool[]
  ): Promise<{ content: string; toolCalls?: AIToolCallRequest[] }> {
    const baseUrl = this.config.baseUrl || 'https://api.deepseek.com';
    const response = await fetch(`${baseUrl}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.config.apiKey}`,
      },
      body: JSON.stringify({
        model: this.config.model || 'deepseek-chat',
        messages: messages.map(formatMessageForDeepSeek),
        tools: tools.length > 0 ? tools.map(t => ({
          type: 'function',
          function: {
            name: t.name,
            description: t.description,
            parameters: t.parameters,
          },
        })) : undefined,
        tool_choice: tools.length > 0 ? 'auto' : undefined,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error?.message || 'DeepSeek API request failed');
    }

    const data = await response.json();
    const choice = data.choices?.[0];
    
    if (choice?.message?.tool_calls) {
      return {
        content: choice.message.content || '',
        toolCalls: choice.message.tool_calls.map((tc: any) => ({
          id: tc.id,
          type: 'function' as const,
          function: {
            name: tc.function.name,
            arguments: tc.function.arguments, // 保持为字符串
          },
        })),
      };
    }

    return {
      content: choice?.message?.content || '',
    };
  }
}

