import type { AIProvider, AIMessage, AIProviderConfig, AITool, AIToolResponse, AIToolCallRequest, ImageAttachment } from '@/types';

/**
 * 阿里云通义千问 (Qwen) API Provider
 * 
 * 使用 DashScope OpenAI 兼容模式
 * 官网: https://dashscope.aliyuncs.com/
 * API Base URL: https://dashscope.aliyuncs.com/compatible-mode
 * 
 * 支持的模型:
 * - qwen-turbo: 快速响应模型
 * - qwen-plus: 增强版模型
 * - qwen-max: 最强模型
 * - qwen-vl-plus: 多模态模型 (支持图片)
 * - qwen-vl-max: 多模态旗舰模型
 * 
 * 多模态支持: qwen-vl-plus, qwen-vl-max 支持图片理解
 */

/**
 * 将图片附件转换为 Qwen Vision 格式
 */
function formatImageForQwen(image: ImageAttachment): Record<string, unknown> {
  return {
    type: 'image_url',
    image_url: {
      url: `data:${image.mediaType};base64,${image.data}`,
    },
  };
}

/**
 * 将 AIMessage 转换为 Qwen API 格式
 * 支持多模态消息（文本 + 图片）
 */
function formatMessageForQwen(msg: AIMessage, supportsVision: boolean): Record<string, unknown> {
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

  // 🖼️ 检查是否有图片附件 - 多模态消息
  if (msg.images && msg.images.length > 0 && supportsVision) {
    // 多模态格式：content 是数组
    const contentParts: Record<string, unknown>[] = [];
    
    // 添加文本部分（如果有）
    if (msg.content) {
      contentParts.push({
        type: 'text',
        text: msg.content,
      });
    }
    
    // 添加图片部分
    for (const image of msg.images) {
      contentParts.push(formatImageForQwen(image));
    }
    
    base.content = contentParts;
  } else {
    // 普通文本消息
    base.content = msg.content;
  }

  return base;
}

/**
 * 判断模型是否支持多模态
 */
function isVisionModel(model: string): boolean {
  const visionModels = ['qwen-vl-plus', 'qwen-vl-max', 'qwen2-vl', 'qwen2.5-vl'];
  return visionModels.some(vm => model.toLowerCase().includes(vm.toLowerCase()));
}

export class QwenProvider implements AIProvider {
  name = 'qwen' as const;
  private config: AIProviderConfig;

  constructor(config: AIProviderConfig) {
    this.config = config;
  }

  private getDefaultModel(): string {
    // 如果没有指定模型，默认使用 qwen-plus
    return this.config.model || 'qwen-plus';
  }

  async chat(messages: AIMessage[], onChunk: (chunk: string) => void): Promise<string> {
    // 阿里云 DashScope OpenAI 兼容模式
    const baseUrl = this.config.baseUrl || 'https://dashscope.aliyuncs.com/compatible-mode';
    const apiUrl = `${baseUrl}/v1/chat/completions`;
    const model = this.getDefaultModel();
    const supportsVision = isVisionModel(model);
    
    console.log('[Qwen] 发送请求到:', apiUrl);
    console.log('[Qwen] 使用模型:', model);
    console.log('[Qwen] 多模态支持:', supportsVision);
    
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.config.apiKey}`,
      },
      body: JSON.stringify({
        model: model,
        messages: messages.map(m => formatMessageForQwen(m, supportsVision)),
        stream: true,
      }),
    });

    console.log('[Qwen] 响应状态:', response.status, response.statusText);

    if (!response.ok) {
      let errorMessage = `API 请求失败 (${response.status})`;
      try {
        const error = await response.json();
        errorMessage = error.error?.message || error.message || errorMessage;
        console.error('[Qwen] 错误详情:', error);
      } catch (e) {
        const text = await response.text();
        console.error('[Qwen] 错误响应:', text);
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
    const baseUrl = this.config.baseUrl || 'https://dashscope.aliyuncs.com/compatible-mode';
    const model = this.getDefaultModel();
    const supportsVision = isVisionModel(model);
    
    const response = await fetch(`${baseUrl}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.config.apiKey}`,
      },
      body: JSON.stringify({
        model: model,
        messages: messages.map(m => formatMessageForQwen(m, supportsVision)),
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
      throw new Error(error.error?.message || 'Qwen API request failed');
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
    const baseUrl = this.config.baseUrl || 'https://dashscope.aliyuncs.com/compatible-mode';
    const model = this.getDefaultModel();
    const supportsVision = isVisionModel(model);
    
    const response = await fetch(`${baseUrl}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.config.apiKey}`,
      },
      body: JSON.stringify({
        model: model,
        messages: messages.map(m => formatMessageForQwen(m, supportsVision)),
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
      throw new Error(error.error?.message || 'Qwen API request failed');
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

