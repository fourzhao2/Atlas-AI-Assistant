import type { Memory, AIMessage } from '@/types';
import { storage } from './storage';
import { aiService } from './ai-service';

class MemoryService {
  async createMemory(content: string, context: string, tags?: string[]): Promise<Memory> {
    return storage.addMemory({ content, context, tags });
  }

  async getRelevantMemories(query: string, limit = 5): Promise<Memory[]> {
    const allMemories = await storage.getMemories();
    
    // Simple keyword-based relevance (in a real app, you'd use embeddings)
    const keywords = query.toLowerCase().split(/\s+/);
    
    const scored = allMemories.map(memory => {
      let score = 0;
      const memoryText = `${memory.content} ${memory.context}`.toLowerCase();
      
      keywords.forEach(keyword => {
        if (memoryText.includes(keyword)) {
          score += 1;
        }
      });
      
      // Boost recent memories
      const daysSince = (Date.now() - memory.timestamp) / (1000 * 60 * 60 * 24);
      score += Math.max(0, 1 - daysSince / 30); // Decay over 30 days
      
      return { memory, score };
    });

    return scored
      .filter(item => item.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map(item => item.memory);
  }

  async enhanceMessageWithMemory(messages: AIMessage[]): Promise<AIMessage[]> {
    const preferences = await storage.getPreferences();
    if (!preferences.memoryEnabled) {
      return messages;
    }

    // Get the last user message
    const lastUserMessage = [...messages].reverse().find(m => m.role === 'user');
    if (!lastUserMessage) {
      return messages;
    }

    // Find relevant memories
    const relevantMemories = await this.getRelevantMemories(lastUserMessage.content);
    
    if (relevantMemories.length === 0) {
      return messages;
    }

    // Add memory context as a system message
    const memoryContext = relevantMemories
      .map(m => `- ${m.content} (${m.context})`)
      .join('\n');

    const enhancedMessages = [...messages];
    
    // Find or create system message
    const systemMessageIndex = enhancedMessages.findIndex(m => m.role === 'system');
    
    if (systemMessageIndex >= 0) {
      enhancedMessages[systemMessageIndex].content += `\n\nRelevant context from memory:\n${memoryContext}`;
    } else {
      enhancedMessages.unshift({
        role: 'system',
        content: `Relevant context from memory:\n${memoryContext}`,
      });
    }

    return enhancedMessages;
  }

  async extractAndSaveMemories(conversation: AIMessage[]): Promise<Memory[]> {
    // Use AI to extract important information from the conversation
    const conversationText = conversation
      .map(m => `${m.role}: ${m.content}`)
      .join('\n');

    const extractionPrompt: AIMessage[] = [
      {
        role: 'system',
        content: `You are a memory extraction assistant. Extract important facts, preferences, or context from the conversation that should be remembered.
Return a JSON array of memories, each with "content" and "tags" fields.
Example: [{"content": "User prefers dark mode", "tags": ["preference", "ui"]}]`,
      },
      {
        role: 'user',
        content: `Extract memorable information from this conversation:\n\n${conversationText}`,
      },
    ];

    let response = '';
    try {
      await aiService.chat(extractionPrompt, (chunk) => {
        response += chunk;
      });

      // Try to parse JSON
      const jsonMatch = response.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        const extracted = JSON.parse(jsonMatch[0]);
        const memories: Memory[] = [];

        for (const item of extracted) {
          if (item.content) {
            const memory = await this.createMemory(
              item.content,
              'Extracted from conversation',
              item.tags || []
            );
            memories.push(memory);
          }
        }

        return memories;
      }
    } catch (e) {
      console.error('Failed to extract memories:', e);
    }

    return [];
  }

  async deleteMemory(id: string): Promise<void> {
    await storage.deleteMemory(id);
  }

  async getAllMemories(): Promise<Memory[]> {
    return storage.getMemories();
  }
}

export const memoryService = new MemoryService();

