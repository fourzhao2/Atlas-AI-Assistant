import type { Conversation, AIMessage, ShortTermMemoryState } from '@/types';
import { storage } from './storage';
import { shortTermMemory } from './short-term-memory';
import { memoryService } from './memory';

class ConversationService {
  async createConversation(title?: string, pageUrl?: string): Promise<Conversation> {
    console.log('[ConversationService] 创建新对话:', title);
    const conversation = await storage.createConversation(title, pageUrl);
    await storage.setCurrentConversationId(conversation.id);
    return conversation;
  }

  async getConversations(): Promise<Conversation[]> {
    return storage.getConversations();
  }

  async getCurrentConversation(): Promise<Conversation | null> {
    const id = await storage.getCurrentConversationId();
    if (!id) return null;
    return storage.getConversation(id);
  }

  async switchConversation(id: string): Promise<void> {
    console.log('[ConversationService] 切换对话:', id);
    await storage.setCurrentConversationId(id);
  }

  async deleteConversation(id: string): Promise<void> {
    console.log('[ConversationService] 删除对话:', id);
    await storage.deleteConversation(id);
    
    // If deleting current conversation, switch to another one
    const currentId = await storage.getCurrentConversationId();
    if (currentId === id) {
      const conversations = await storage.getConversations();
      if (conversations.length > 0) {
        await storage.setCurrentConversationId(conversations[0].id);
      } else {
        await storage.setCurrentConversationId(null);
      }
    }
  }

  async addMessage(conversationId: string, message: AIMessage): Promise<void> {
    await storage.addMessageToConversation(conversationId, message);
  }

  async updateTitle(conversationId: string, title: string): Promise<void> {
    console.log('[ConversationService] 更新标题:', conversationId, title);
    await storage.updateConversation(conversationId, { title });
  }

  async generateTitle(conversation: Conversation): Promise<string> {
    if (conversation.messages.length === 0) {
      return '新对话';
    }

    // Use first user message to generate title
    const firstUserMessage = conversation.messages.find(m => m.role === 'user');
    if (firstUserMessage) {
      // Take first 30 characters
      const title = firstUserMessage.content.substring(0, 30);
      return title.length < firstUserMessage.content.length ? title + '...' : title;
    }

    return '新对话';
  }

  async autoGenerateTitle(conversationId: string): Promise<void> {
    const conversation = await storage.getConversation(conversationId);
    if (conversation && conversation.title === '新对话' && conversation.messages.length > 0) {
      const title = await this.generateTitle(conversation);
      await this.updateTitle(conversationId, title);
    }
  }

  /**
   * 处理消息 - 应用短期记忆管理
   * 当消息过多时，自动生成摘要并压缩
   */
  async processMessagesWithMemory(
    conversationId: string,
    messages: AIMessage[]
  ): Promise<{ processedMessages: AIMessage[]; state: ShortTermMemoryState }> {
    const conversation = await storage.getConversation(conversationId);
    const existingSummary = conversation?.summary;

    console.log('[ConversationService] 处理短期记忆, 对话ID:', conversationId);
    console.log('[ConversationService] 现有摘要:', existingSummary ? '有' : '无');

    // 使用短期记忆服务处理消息
    const result = await shortTermMemory.processMessages(messages, existingSummary);

    // 如果生成了新摘要，保存到对话中
    if (result.state.wasSummarized && result.state.summary) {
      console.log('[ConversationService] 保存新摘要到对话');
      await storage.updateConversation(conversationId, {
        summary: result.state.summary,
        summaryTokens: shortTermMemory.getTokenStats([], result.state.summary).summaryTokens
      });
    }

    return {
      processedMessages: result.messages,
      state: result.state
    };
  }

  /**
   * 获取对话的 token 统计信息
   */
  async getTokenStats(conversationId: string): Promise<{
    messagesTokens: number;
    summaryTokens: number;
    totalTokens: number;
    remaining: number;
    usage: number;
  } | null> {
    const conversation = await storage.getConversation(conversationId);
    if (!conversation) return null;

    return shortTermMemory.getTokenStats(conversation.messages, conversation.summary);
  }

  /**
   * 对话结束时提取长期记忆
   */
  async extractLongTermMemories(conversationId: string): Promise<void> {
    const conversation = await storage.getConversation(conversationId);
    if (!conversation || conversation.messages.length < 4) {
      // 对话太短，不提取记忆
      return;
    }

    console.log('[ConversationService] 提取长期记忆, 消息数:', conversation.messages.length);

    try {
      const memories = await memoryService.extractAndSaveMemories(conversation.messages);
      console.log('[ConversationService] 提取到记忆数量:', memories.length);
    } catch (error) {
      console.error('[ConversationService] 提取长期记忆失败:', error);
    }
  }

  // Migrate old chat history to conversation format
  async migrateOldChatHistory(): Promise<void> {
    console.log('[ConversationService] 检查旧数据迁移...');
    
    const conversations = await storage.getConversations();
    const currentId = await storage.getCurrentConversationId();
    
    // 如果有对话但没有当前对话ID，设置第一个为当前对话
    if (conversations.length > 0 && !currentId) {
      console.log('[ConversationService] 设置第一个对话为当前对话');
      await storage.setCurrentConversationId(conversations[0].id);
      return;
    }
    
    // 如果有对话数据，跳过迁移
    if (conversations.length > 0) {
      console.log('[ConversationService] 已有对话数据，跳过迁移');
      return;
    }

    const oldHistory = await storage.getChatHistory();
    if (oldHistory.length > 0) {
      console.log('[ConversationService] 迁移旧聊天历史:', oldHistory.length, '条消息');
      
      const conversation = await storage.createConversation('历史对话');
      await storage.updateConversation(conversation.id, { messages: oldHistory });
      await storage.setCurrentConversationId(conversation.id);
      
      // Clear old chat history
      await storage.clearChatHistory();
      
      console.log('[ConversationService] 迁移完成');
    } else {
      // No old data, create first conversation
      console.log('[ConversationService] 创建首个对话');
      const conversation = await storage.createConversation();
      await storage.setCurrentConversationId(conversation.id);
    }
  }
}

export const conversationService = new ConversationService();

