import { create } from 'zustand';
import type { AIMessage, AIProviderType, UserPreference, PageContent, Memory, HistoryInsight, Conversation } from '@/types';

interface AppState {
  // Chat state
  messages: AIMessage[];
  isLoading: boolean;
  currentProvider: AIProviderType;
  
  // Page context
  currentPage: PageContent | null;
  
  // Preferences
  preferences: UserPreference;
  
  // Memories
  memories: Memory[];
  
  // Insights
  insights: HistoryInsight[];
  
  // Theme
  theme: 'light' | 'dark';
  
  // Conversations
  conversations: Conversation[];
  currentConversationId: string | null;
  sidebarOpen: boolean;
  
  // Actions
  addMessage: (message: AIMessage) => void;
  setMessages: (messages: AIMessage[]) => void;
  clearMessages: () => void;
  setLoading: (loading: boolean) => void;
  setCurrentProvider: (provider: AIProviderType) => void;
  setCurrentPage: (page: PageContent | null) => void;
  setPreferences: (preferences: UserPreference) => void;
  setMemories: (memories: Memory[]) => void;
  setInsights: (insights: HistoryInsight[]) => void;
  setTheme: (theme: 'light' | 'dark') => void;
  
  // Conversation Actions
  setConversations: (conversations: Conversation[]) => void;
  setCurrentConversationId: (id: string | null) => void;
  updateConversation: (id: string, updates: Partial<Conversation>) => void;
  setSidebarOpen: (open: boolean) => void;
}

export const useStore = create<AppState>((set) => ({
  messages: [],
  isLoading: false,
  currentProvider: 'openai',
  currentPage: null,
  preferences: {
    defaultProvider: 'openai',
    theme: 'system',
    autoSummarize: false,
    agentMode: false,
    memoryEnabled: true,
  },
  memories: [],
  insights: [],
  theme: 'light',
  conversations: [],
  currentConversationId: null,
  sidebarOpen: false,
  
  addMessage: (message) => set((state) => ({
    messages: [...state.messages, message],
  })),
  
  setMessages: (messages) => set({ messages }),
  
  clearMessages: () => set({ messages: [] }),
  
  setLoading: (isLoading) => set({ isLoading }),
  
  setCurrentProvider: (currentProvider) => set({ currentProvider }),
  
  setCurrentPage: (currentPage) => set({ currentPage }),
  
  setPreferences: (preferences) => set({ preferences }),
  
  setMemories: (memories) => set({ memories }),
  
  setInsights: (insights) => set({ insights }),
  
  setTheme: (theme) => set({ theme }),
  
  setConversations: (conversations) => set({ conversations }),
  
  setCurrentConversationId: (currentConversationId) => set({ currentConversationId }),
  
  updateConversation: (id, updates) => set((state) => ({
    conversations: state.conversations.map(conv =>
      conv.id === id ? { ...conv, ...updates, updatedAt: Date.now() } : conv
    ),
  })),
  
  setSidebarOpen: (sidebarOpen) => set({ sidebarOpen }),
}));

