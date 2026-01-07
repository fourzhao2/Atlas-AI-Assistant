import type { AIProvider, AIMessage, AIProviderType, AITool, AIToolResponse, AIToolCallRequest } from '@/types';
import { OpenAIProvider } from './ai-providers/openai';
import { AnthropicProvider } from './ai-providers/anthropic';
import { GeminiProvider } from './ai-providers/gemini';
import { storage } from './storage';

class AIService {
  private providers: Map<AIProviderType, AIProvider> = new Map();

  async initialize() {
    try {
      console.log('[AIService] 开始初始化...');
      const configs = await storage.getAllProviderConfigs();
      console.log('[AIService] 配置:', {
        openai: configs.openai ? '已配置' : '未配置',
        anthropic: configs.anthropic ? '已配置' : '未配置',
        gemini: configs.gemini ? '已配置' : '未配置',
      });

      if (configs.openai) {
        try {
          console.log('[AIService] 初始化 OpenAI provider');
          console.log('[AIService] OpenAI baseUrl:', configs.openai.baseUrl);
          console.log('[AIService] OpenAI model:', configs.openai.model);
          this.providers.set('openai', new OpenAIProvider(configs.openai));
        } catch (error) {
          console.error('[AIService] OpenAI provider 初始化失败:', error);
        }
      }
      if (configs.anthropic) {
        try {
          this.providers.set('anthropic', new AnthropicProvider(configs.anthropic));
        } catch (error) {
          console.error('[AIService] Anthropic provider 初始化失败:', error);
        }
      }
      if (configs.gemini) {
        try {
          this.providers.set('gemini', new GeminiProvider(configs.gemini));
        } catch (error) {
          console.error('[AIService] Gemini provider 初始化失败:', error);
        }
      }
      
      console.log('[AIService] 初始化完成，可用提供商:', Array.from(this.providers.keys()));
    } catch (error) {
      console.error('[AIService] 初始化失败:', error);
      throw error;
    }
  }

  async refreshProvider(providerType: AIProviderType) {
    try {
      const config = await storage.getProviderConfig(providerType);
      if (!config) {
        this.providers.delete(providerType);
        return;
      }

      switch (providerType) {
        case 'openai':
          this.providers.set('openai', new OpenAIProvider(config));
          break;
        case 'anthropic':
          this.providers.set('anthropic', new AnthropicProvider(config));
          break;
        case 'gemini':
          this.providers.set('gemini', new GeminiProvider(config));
          break;
      }
    } catch (error) {
      console.error(`[AIService] 刷新 ${providerType} provider 失败:`, error);
      throw error;
    }
  }

  async getProvider(providerType?: AIProviderType): Promise<AIProvider> {
    if (!providerType) {
      const preferences = await storage.getPreferences();
      providerType = preferences.defaultProvider;
      console.log('[AIService] 使用默认提供商:', providerType);
    }

    let provider = this.providers.get(providerType);
    
    if (!provider) {
      console.log('[AIService] 提供商未初始化，尝试刷新:', providerType);
      await this.refreshProvider(providerType);
      provider = this.providers.get(providerType);
    }

    if (!provider) {
      console.error('[AIService] 提供商配置失败:', providerType);
      throw new Error(`❌ ${providerType} 未配置\n\n请到扩展设置中配置 API Key`);
    }

    console.log('[AIService] 获取到提供商:', providerType);
    return provider;
  }

  async chat(
    messages: AIMessage[],
    onChunk: (chunk: string) => void,
    providerType?: AIProviderType
  ): Promise<string> {
    const provider = await this.getProvider(providerType);
    return provider.chat(messages, onChunk);
  }

  async chatWithTools(
    messages: AIMessage[],
    tools: AITool[],
    providerType?: AIProviderType
  ): Promise<AIToolResponse> {
    const provider = await this.getProvider(providerType);
    
    if (!provider.chatWithTools) {
      throw new Error(`Provider ${provider.name} does not support tool calling`);
    }

    return provider.chatWithTools(messages, tools);
  }

  /**
   * ReAct Agent 模式使用的 chat with tools
   * 返回原始的 tool_calls 格式，包含 id 用于后续关联 tool 消息
   */
  async chatWithToolsForAgent(
    messages: AIMessage[],
    tools: AITool[],
    providerType?: AIProviderType
  ): Promise<{ content: string; toolCalls?: AIToolCallRequest[] }> {
    const provider = await this.getProvider(providerType);
    
    // 目前只有 OpenAI 支持这个方法
    if (provider.name === 'openai') {
      const openaiProvider = provider as import('./ai-providers/openai').OpenAIProvider;
      return openaiProvider.chatWithToolsRaw(messages, tools);
    }

    // 其他提供商回退到普通的 chatWithTools
    if (!provider.chatWithTools) {
      throw new Error(`Provider ${provider.name} does not support tool calling`);
    }

    const response = await provider.chatWithTools(messages, tools);
    
    // 转换格式
    if (response.toolCalls && response.toolCalls.length > 0) {
      return {
        content: response.content,
        toolCalls: response.toolCalls.map((tc, index) => ({
          id: `call_${Date.now()}_${index}`,
          type: 'function' as const,
          function: {
            name: tc.name,
            arguments: JSON.stringify(tc.arguments),
          },
        })),
      };
    }

    return {
      content: response.content,
    };
  }

  getAvailableProviders(): AIProviderType[] {
    return Array.from(this.providers.keys());
  }

  isProviderConfigured(providerType: AIProviderType): boolean {
    return this.providers.has(providerType);
  }
}

export const aiService = new AIService();

