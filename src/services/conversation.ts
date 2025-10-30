import type { Conversation, AIMessage } from '@/types';
import { storage } from './storage';

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

  // Migrate old chat history to conversation format
  async migrateOldChatHistory(): Promise<void> {
    console.log('[ConversationService] 检查旧数据迁移...');
    
    const conversations = await storage.getConversations();
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

