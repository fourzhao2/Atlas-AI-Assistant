import type { 
  AIMessage, 
  ShortTermMemoryConfig, 
  ProcessedMessages 
} from '@/types';
import { aiService } from './ai-service';

// 默认配置
const DEFAULT_CONFIG: ShortTermMemoryConfig = {
  maxTokens: 4000,           // 最大 token 限制
  maxRecentMessages: 10,     // 保留最近 10 条消息
  summaryMaxTokens: 500,     // 摘要最大 500 token
  enableSummarization: true, // 启用摘要
};

/**
 * 短期记忆服务
 * 
 * 功能：
 * 1. Token 估算 - 估算消息的 token 数量
 * 2. 上下文窗口管理 - 当 token 超限时裁剪消息
 * 3. 摘要压缩 - 将旧消息压缩成摘要，保留关键信息
 */
class ShortTermMemoryService {
  private config: ShortTermMemoryConfig;

  constructor(config: Partial<ShortTermMemoryConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * 更新配置
   */
  updateConfig(config: Partial<ShortTermMemoryConfig>): void {
    this.config = { ...this.config, ...config };
    console.log('[ShortTermMemory] 配置已更新:', this.config);
  }

  /**
   * 估算文本的 token 数量
   * 
   * 采用混合估算策略：
   * - 英文: 约 4 字符 = 1 token
   * - 中文: 约 1.5 字符 = 1 token
   * - 标点和空格: 单独计算
   */
  estimateTokens(text: string): number {
    if (!text) return 0;

    // 统计中文字符
    const chineseChars = (text.match(/[\u4e00-\u9fff]/g) || []).length;
    // 统计英文单词
    const englishWords = (text.match(/[a-zA-Z]+/g) || []).length;
    // 统计数字
    const numbers = (text.match(/\d+/g) || []).length;
    // 其他字符（标点、空格等）
    const otherChars = text.length - chineseChars - 
      (text.match(/[a-zA-Z]/g) || []).length - 
      (text.match(/\d/g) || []).length;

    // 估算 token 数
    // 中文: 每个字符约 0.7 token (因为中文 tokenizer 通常将字符拆分)
    // 英文: 每个单词约 1.3 token
    // 数字: 每组数字约 1 token
    // 其他: 每 4 个字符约 1 token
    const tokens = Math.ceil(
      chineseChars * 0.7 +
      englishWords * 1.3 +
      numbers +
      otherChars / 4
    );

    return Math.max(1, tokens);
  }

  /**
   * 估算消息数组的总 token 数
   */
  estimateMessagesTokens(messages: AIMessage[]): number {
    let total = 0;
    for (const msg of messages) {
      // 每条消息有固定开销 (role, 格式化等) 约 4 token
      total += 4 + this.estimateTokens(msg.content);
    }
    return total;
  }

  /**
   * 处理消息 - 核心方法
   * 
   * 流程：
   * 1. 计算当前消息的 token 数
   * 2. 如果未超限，直接返回
   * 3. 如果超限且启用摘要，生成摘要
   * 4. 如果超限但未启用摘要，裁剪旧消息
   */
  async processMessages(
    messages: AIMessage[],
    existingSummary?: string
  ): Promise<ProcessedMessages> {
    console.log('[ShortTermMemory] 处理消息，数量:', messages.length);

    // 分离 system 消息和对话消息
    const systemMessages = messages.filter(m => m.role === 'system');
    const conversationMessages = messages.filter(m => m.role !== 'system');

    // 计算当前 token 数
    const systemTokens = this.estimateMessagesTokens(systemMessages);
    const conversationTokens = this.estimateMessagesTokens(conversationMessages);
    const existingSummaryTokens = existingSummary ? this.estimateTokens(existingSummary) : 0;
    const totalTokens = systemTokens + conversationTokens + existingSummaryTokens;

    console.log('[ShortTermMemory] Token 统计:', {
      system: systemTokens,
      conversation: conversationTokens,
      existingSummary: existingSummaryTokens,
      total: totalTokens,
      limit: this.config.maxTokens
    });

    // 如果未超限，直接返回
    if (totalTokens <= this.config.maxTokens) {
      const result = this.buildMessages(systemMessages, conversationMessages, existingSummary);
      return {
        messages: result,
        state: {
          summary: existingSummary || null,
          recentMessages: conversationMessages,
          totalTokens,
          wasSummarized: false
        }
      };
    }

    // 超限了，需要处理
    console.log('[ShortTermMemory] ⚠️ Token 超限，开始压缩...');

    if (this.config.enableSummarization && conversationMessages.length > this.config.maxRecentMessages) {
      // 启用摘要：将旧消息压缩成摘要
      return await this.compressWithSummary(systemMessages, conversationMessages, existingSummary);
    } else {
      // 不启用摘要：简单裁剪
      return this.compressWithTrim(systemMessages, conversationMessages, existingSummary);
    }
  }

  /**
   * 使用摘要压缩消息
   */
  private async compressWithSummary(
    systemMessages: AIMessage[],
    conversationMessages: AIMessage[],
    existingSummary?: string
  ): Promise<ProcessedMessages> {
    console.log('[ShortTermMemory] 使用摘要压缩...');

    // 保留最近的 N 条消息
    const recentMessages = conversationMessages.slice(-this.config.maxRecentMessages);
    const oldMessages = conversationMessages.slice(0, -this.config.maxRecentMessages);

    // 如果没有旧消息需要摘要，直接返回
    if (oldMessages.length === 0) {
      const result = this.buildMessages(systemMessages, recentMessages, existingSummary);
      return {
        messages: result,
        state: {
          summary: existingSummary || null,
          recentMessages,
          totalTokens: this.estimateMessagesTokens(result),
          wasSummarized: false
        }
      };
    }

    // 生成新摘要
    const newSummary = await this.generateSummary(oldMessages, existingSummary);
    
    const result = this.buildMessages(systemMessages, recentMessages, newSummary);
    const finalTokens = this.estimateMessagesTokens(result);

    console.log('[ShortTermMemory] ✅ 摘要压缩完成:', {
      oldMessagesCount: oldMessages.length,
      recentMessagesCount: recentMessages.length,
      summaryTokens: this.estimateTokens(newSummary),
      finalTokens
    });

    return {
      messages: result,
      state: {
        summary: newSummary,
        recentMessages,
        totalTokens: finalTokens,
        wasSummarized: true
      }
    };
  }

  /**
   * 使用裁剪压缩消息（不生成摘要）
   */
  private compressWithTrim(
    systemMessages: AIMessage[],
    conversationMessages: AIMessage[],
    existingSummary?: string
  ): ProcessedMessages {
    console.log('[ShortTermMemory] 使用裁剪压缩...');

    const systemTokens = this.estimateMessagesTokens(systemMessages);
    const summaryTokens = existingSummary ? this.estimateTokens(existingSummary) + 20 : 0;
    const availableTokens = this.config.maxTokens - systemTokens - summaryTokens;

    // 从最新消息开始保留，直到达到 token 限制
    const recentMessages: AIMessage[] = [];
    let currentTokens = 0;

    for (let i = conversationMessages.length - 1; i >= 0; i--) {
      const msg = conversationMessages[i];
      const msgTokens = 4 + this.estimateTokens(msg.content);

      if (currentTokens + msgTokens > availableTokens) {
        break;
      }

      recentMessages.unshift(msg);
      currentTokens += msgTokens;
    }

    console.log('[ShortTermMemory] ✅ 裁剪完成:', {
      originalCount: conversationMessages.length,
      keptCount: recentMessages.length,
      removedCount: conversationMessages.length - recentMessages.length
    });

    const result = this.buildMessages(systemMessages, recentMessages, existingSummary);

    return {
      messages: result,
      state: {
        summary: existingSummary || null,
        recentMessages,
        totalTokens: this.estimateMessagesTokens(result),
        wasSummarized: false
      }
    };
  }

  /**
   * 生成对话摘要
   */
  private async generateSummary(
    messagesToSummarize: AIMessage[],
    existingSummary?: string
  ): Promise<string> {
    console.log('[ShortTermMemory] 生成摘要，消息数:', messagesToSummarize.length);

    // 构建对话文本
    const conversationText = messagesToSummarize
      .map(m => `${m.role === 'user' ? '用户' : 'AI'}: ${m.content}`)
      .join('\n\n');

    // 构建摘要提示词
    const summaryPrompt: AIMessage[] = [
      {
        role: 'system',
        content: `你是一个对话摘要助手。请将以下对话内容压缩成简洁的摘要，保留关键信息。

要求：
1. 保留重要的事实、决定、用户偏好
2. 保留关键的技术细节和代码片段（如有）
3. 使用简洁的语言，控制在 ${this.config.summaryMaxTokens} 个 token 以内
4. 使用第三人称描述
5. 按时间顺序组织信息`
      },
      {
        role: 'user',
        content: existingSummary 
          ? `现有摘要：\n${existingSummary}\n\n新增对话：\n${conversationText}\n\n请整合现有摘要和新增对话，生成更新后的摘要。`
          : `请为以下对话生成摘要：\n\n${conversationText}`
      }
    ];

    try {
      let summary = '';
      await aiService.chat(summaryPrompt, (chunk) => {
        summary += chunk;
      });

      console.log('[ShortTermMemory] 摘要生成成功，长度:', summary.length);
      return summary.trim();
    } catch (error) {
      console.error('[ShortTermMemory] 摘要生成失败:', error);
      // 如果摘要失败，返回简单的概述
      return existingSummary || `[对话包含 ${messagesToSummarize.length} 条消息]`;
    }
  }

  /**
   * 构建最终消息数组
   */
  private buildMessages(
    systemMessages: AIMessage[],
    conversationMessages: AIMessage[],
    summary?: string
  ): AIMessage[] {
    const result: AIMessage[] = [];

    // 1. 添加 system 消息
    if (systemMessages.length > 0) {
      // 如果有摘要，将摘要添加到第一个 system 消息中
      if (summary) {
        const firstSystem = { ...systemMessages[0] };
        firstSystem.content = `${firstSystem.content}\n\n## 之前的对话摘要\n${summary}`;
        result.push(firstSystem);
        result.push(...systemMessages.slice(1));
      } else {
        result.push(...systemMessages);
      }
    } else if (summary) {
      // 没有 system 消息但有摘要，创建一个
      result.push({
        role: 'system',
        content: `## 之前的对话摘要\n${summary}`
      });
    }

    // 2. 添加对话消息
    result.push(...conversationMessages);

    return result;
  }

  /**
   * 快速检查是否需要压缩
   */
  needsCompression(messages: AIMessage[], existingSummary?: string): boolean {
    const tokens = this.estimateMessagesTokens(messages);
    const summaryTokens = existingSummary ? this.estimateTokens(existingSummary) : 0;
    return tokens + summaryTokens > this.config.maxTokens;
  }

  /**
   * 获取当前配置
   */
  getConfig(): ShortTermMemoryConfig {
    return { ...this.config };
  }

  /**
   * 获取 token 统计信息
   */
  getTokenStats(messages: AIMessage[], summary?: string): {
    messagesTokens: number;
    summaryTokens: number;
    totalTokens: number;
    remaining: number;
    usage: number; // 百分比
  } {
    const messagesTokens = this.estimateMessagesTokens(messages);
    const summaryTokens = summary ? this.estimateTokens(summary) : 0;
    const totalTokens = messagesTokens + summaryTokens;
    const remaining = Math.max(0, this.config.maxTokens - totalTokens);
    const usage = Math.round((totalTokens / this.config.maxTokens) * 100);

    return {
      messagesTokens,
      summaryTokens,
      totalTokens,
      remaining,
      usage
    };
  }
}

// 导出单例
export const shortTermMemory = new ShortTermMemoryService();

// 导出类以便创建自定义实例
export { ShortTermMemoryService };

