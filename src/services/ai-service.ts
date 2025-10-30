import type { AIProvider, AIMessage, AIProviderType, AITool, AIToolResponse } from '@/types';
import { OpenAIProvider } from './ai-providers/openai';
import { AnthropicProvider } from './ai-providers/anthropic';
import { GeminiProvider } from './ai-providers/gemini';
import { storage } from './storage';

class AIService {
  private providers: Map<AIProviderType, AIProvider> = new Map();

  async initialize() {
    const configs = await storage.getAllProviderConfigs();

    if (configs.openai) {
      this.providers.set('openai', new OpenAIProvider(configs.openai));
    }
    if (configs.anthropic) {
      this.providers.set('anthropic', new AnthropicProvider(configs.anthropic));
    }
    if (configs.gemini) {
      this.providers.set('gemini', new GeminiProvider(configs.gemini));
    }
  }

  async refreshProvider(providerType: AIProviderType) {
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
  }

  async getProvider(providerType?: AIProviderType): Promise<AIProvider> {
    if (!providerType) {
      const preferences = await storage.getPreferences();
      providerType = preferences.defaultProvider;
    }

    let provider = this.providers.get(providerType);
    
    if (!provider) {
      await this.refreshProvider(providerType);
      provider = this.providers.get(providerType);
    }

    if (!provider) {
      throw new Error(`Provider ${providerType} not configured. Please add API key in settings.`);
    }

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

  getAvailableProviders(): AIProviderType[] {
    return Array.from(this.providers.keys());
  }

  isProviderConfigured(providerType: AIProviderType): boolean {
    return this.providers.has(providerType);
  }
}

export const aiService = new AIService();

