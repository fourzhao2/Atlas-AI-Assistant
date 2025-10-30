import type { AIProviderType, AIProviderConfig, UserPreference, Memory, AIMessage, PageSummary, HistoryInsight } from '@/types';

const DEFAULT_PREFERENCES: UserPreference = {
  defaultProvider: 'openai',
  theme: 'system',
  autoSummarize: false,
  agentMode: false,
  memoryEnabled: true,
};

class StorageService {
  // Provider Config
  async getProviderConfig(provider: AIProviderType): Promise<AIProviderConfig | null> {
    const result = await chrome.storage.local.get([`provider_${provider}`]);
    return result[`provider_${provider}`] || null;
  }

  async setProviderConfig(provider: AIProviderType, config: AIProviderConfig): Promise<void> {
    await chrome.storage.local.set({ [`provider_${provider}`]: config });
  }

  async getAllProviderConfigs(): Promise<Record<AIProviderType, AIProviderConfig | null>> {
    const result = await chrome.storage.local.get(['provider_openai', 'provider_anthropic', 'provider_gemini']);
    return {
      openai: result.provider_openai || null,
      anthropic: result.provider_anthropic || null,
      gemini: result.provider_gemini || null,
    };
  }

  // User Preferences
  async getPreferences(): Promise<UserPreference> {
    const result = await chrome.storage.local.get(['preferences']);
    return result.preferences || DEFAULT_PREFERENCES;
  }

  async setPreferences(preferences: Partial<UserPreference>): Promise<void> {
    const current = await this.getPreferences();
    await chrome.storage.local.set({ preferences: { ...current, ...preferences } });
  }

  // Chat History
  async getChatHistory(limit = 100): Promise<AIMessage[]> {
    const result = await chrome.storage.local.get(['chatHistory']);
    const history = result.chatHistory || [];
    return history.slice(-limit);
  }

  async addChatMessage(message: AIMessage): Promise<void> {
    const history = await this.getChatHistory();
    history.push({ ...message, timestamp: Date.now() });
    // Keep only last 500 messages
    const trimmed = history.slice(-500);
    await chrome.storage.local.set({ chatHistory: trimmed });
  }

  async clearChatHistory(): Promise<void> {
    await chrome.storage.local.set({ chatHistory: [] });
  }

  // Memories
  async getMemories(limit = 50): Promise<Memory[]> {
    const result = await chrome.storage.local.get(['memories']);
    const memories = result.memories || [];
    return memories.slice(-limit);
  }

  async addMemory(memory: Omit<Memory, 'id' | 'timestamp'>): Promise<Memory> {
    const memories = await this.getMemories();
    const newMemory: Memory = {
      ...memory,
      id: `memory_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: Date.now(),
    };
    memories.push(newMemory);
    await chrome.storage.local.set({ memories: memories.slice(-200) });
    return newMemory;
  }

  async deleteMemory(id: string): Promise<void> {
    const memories = await this.getMemories();
    const filtered = memories.filter(m => m.id !== id);
    await chrome.storage.local.set({ memories: filtered });
  }

  // Page Summaries
  async getPageSummaries(limit = 30): Promise<PageSummary[]> {
    const result = await chrome.storage.local.get(['summaries']);
    const summaries = result.summaries || [];
    return summaries.slice(-limit);
  }

  async addPageSummary(summary: PageSummary): Promise<void> {
    const summaries = await this.getPageSummaries();
    summaries.push(summary);
    await chrome.storage.local.set({ summaries: summaries.slice(-100) });
  }

  async getPageSummary(url: string): Promise<PageSummary | null> {
    const summaries = await this.getPageSummaries();
    return summaries.find(s => s.url === url) || null;
  }

  // History Insights
  async getInsights(): Promise<HistoryInsight[]> {
    const result = await chrome.storage.local.get(['insights']);
    return result.insights || [];
  }

  async addInsight(insight: Omit<HistoryInsight, 'id' | 'timestamp'>): Promise<HistoryInsight> {
    const insights = await this.getInsights();
    const newInsight: HistoryInsight = {
      ...insight,
      id: `insight_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: Date.now(),
    };
    insights.push(newInsight);
    await chrome.storage.local.set({ insights: insights.slice(-50) });
    return newInsight;
  }

  async clearInsights(): Promise<void> {
    await chrome.storage.local.set({ insights: [] });
  }

  // Utility
  async clearAllData(): Promise<void> {
    await chrome.storage.local.clear();
  }
}

export const storage = new StorageService();

