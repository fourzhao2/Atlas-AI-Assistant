/**
 * ReAct Agent Service
 * 
 * 实现 ReAct (Reasoning + Acting) 循环模式
 * 
 * 流程：
 * 1. Thought (思考) - AI 分析问题，决定是否需要调用工具
 * 2. Action (行动) - 如果需要，调用工具
 * 3. Observation (观察) - 获取工具返回结果
 * 4. 循环 - 重复 1-3 直到 AI 给出最终答案
 * 
 * 消息格式支持：
 * - system: 系统提示
 * - user: 用户输入
 * - assistant: AI 回复（可能包含 tool_calls）
 * - tool: 工具返回结果
 */

import type {
  AIMessage,
  AITool,
  AIToolCallRequest,
  ReActStep,
  ReActAgentState,
  ReActAgentResult,
  ReActPhase,
  AgentModeConfig,
} from '@/types';
import { shortTermMemory } from './short-term-memory';

// 默认配置
const DEFAULT_CONFIG: AgentModeConfig = {
  maxIterations: 10,
  maxTokensPerIteration: 4000,
  tools: [],
  enableStreaming: true,
  verbose: true,
};

// ReAct 系统提示词
const REACT_SYSTEM_PROMPT = `你是一个智能助手，能够使用工具来帮助用户完成任务。

## 工作模式
你使用 ReAct (Reasoning and Acting) 模式工作：
1. **思考 (Thought)**: 分析用户请求，决定下一步行动
2. **行动 (Action)**: 如果需要，调用合适的工具
3. **观察 (Observation)**: 查看工具返回的结果
4. **循环**: 重复以上步骤直到能够给出最终答案

## 重要规则
- 每次只调用一个工具
- 仔细分析工具返回的结果
- 如果工具调用失败，尝试其他方法
- 当你有足够信息时，直接回答用户，不要再调用工具
- 如果无法完成任务，诚实地告诉用户

## 回答格式
- 当你需要调用工具时，使用 tool_calls 格式
- 当你准备好最终回答时，直接用文本回复，不要调用任何工具
`;

/**
 * 生成唯一 ID
 */
function generateId(): string {
  return `${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
}

/**
 * ReAct Agent 服务
 */
class ReActAgentService {
  private config: AgentModeConfig;
  private state: ReActAgentState | null = null;
  private abortController: AbortController | null = null;

  constructor(config: Partial<AgentModeConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * 更新配置
   */
  updateConfig(config: Partial<AgentModeConfig>): void {
    this.config = { ...this.config, ...config };
    console.log('[ReActAgent] 配置已更新:', this.config);
  }

  /**
   * 设置可用工具
   */
  setTools(tools: AITool[]): void {
    this.config.tools = tools;
    console.log('[ReActAgent] 工具已设置:', tools.map(t => t.name));
  }

  /**
   * 执行 ReAct Agent
   * 
   * @param userMessage 用户输入
   * @param existingMessages 现有消息历史
   * @param callbacks 回调函数
   */
  async run(
    userMessage: string,
    existingMessages: AIMessage[] = [],
    callbacks: {
      onThought?: (thought: string) => void;
      onAction?: (action: { tool: string; input: Record<string, unknown> }) => void;
      onObservation?: (observation: string) => void;
      onStep?: (step: ReActStep) => void;
      onChunk?: (chunk: string) => void;
      onComplete?: (result: ReActAgentResult) => void;
      onError?: (error: Error) => void;
      // 工具执行器 - 必须提供
      executeToolCall: (toolName: string, args: Record<string, unknown>) => Promise<string>;
      // AI 调用器 - 必须提供
      callAI: (
        messages: AIMessage[],
        tools: AITool[],
        onChunk?: (chunk: string) => void
      ) => Promise<{
        content: string;
        toolCalls?: AIToolCallRequest[];
      }>;
    }
  ): Promise<ReActAgentResult> {
    console.log('[ReActAgent] 🚀 开始执行, 用户消息:', userMessage);

    // 初始化状态
    this.state = {
      mode: 'agent',
      phase: 'thinking',
      steps: [],
      messages: [...existingMessages],
      currentIteration: 0,
      maxIterations: this.config.maxIterations,
      totalTokens: 0,
      isRunning: true,
    };

    this.abortController = new AbortController();

    // 构建初始消息
    const systemMessage: AIMessage = {
      role: 'system',
      content: this.buildSystemPrompt(),
    };

    const userMsg: AIMessage = {
      role: 'user',
      content: userMessage,
      timestamp: Date.now(),
    };

    // 处理短期记忆
    let messagesToProcess = [systemMessage, ...this.state.messages, userMsg];
    const memoryResult = await shortTermMemory.processMessages(messagesToProcess);
    messagesToProcess = memoryResult.messages;
    this.state.totalTokens = memoryResult.state.totalTokens;

    // 添加用户消息到状态
    this.state.messages.push(userMsg);

    try {
      // ReAct 循环
      while (
        this.state.currentIteration < this.state.maxIterations &&
        this.state.isRunning
      ) {
        // 检查是否被中止
        if (this.abortController.signal.aborted) {
          throw new Error('执行被用户中止');
        }

        this.state.currentIteration++;
        console.log(`[ReActAgent] 📍 迭代 ${this.state.currentIteration}/${this.state.maxIterations}`);

        // Step 1: 思考 - 调用 AI
        this.setPhase('thinking');
        const thinkingStep: ReActStep = {
          id: generateId(),
          phase: 'thinking',
          thought: '分析问题中...',
          timestamp: Date.now(),
        };
        this.state.steps.push(thinkingStep);
        callbacks.onStep?.(thinkingStep);

        // 调用 AI
        let aiResponse: { content: string; toolCalls?: AIToolCallRequest[] };
        let streamedContent = '';

        try {
          aiResponse = await callbacks.callAI(
            messagesToProcess,
            this.config.tools,
            (chunk) => {
              streamedContent += chunk;
              callbacks.onChunk?.(chunk);
            }
          );
        } catch (error) {
          throw new Error(`AI 调用失败: ${error instanceof Error ? error.message : '未知错误'}`);
        }

        // 更新思考步骤
        thinkingStep.thought = aiResponse.content || streamedContent;
        callbacks.onThought?.(thinkingStep.thought);

        // 将 AI 响应添加到消息历史
        const assistantMessage: AIMessage = {
          role: 'assistant',
          content: aiResponse.content || streamedContent,
          timestamp: Date.now(),
        };
        this.state.messages.push(assistantMessage);
        messagesToProcess.push(assistantMessage);

        // Step 2: 检查是否有 tool_calls
        if (!aiResponse.toolCalls || aiResponse.toolCalls.length === 0) {
          // 没有工具调用，AI 给出了最终答案
          console.log('[ReActAgent] ✅ AI 给出最终答案，结束循环');
          this.setPhase('completed');

          const result: ReActAgentResult = {
            success: true,
            finalAnswer: aiResponse.content || streamedContent,
            steps: this.state.steps,
            totalIterations: this.state.currentIteration,
            totalTokens: this.state.totalTokens,
          };

          callbacks.onComplete?.(result);
          return result;
        }

        // Step 3: 执行工具调用
        this.setPhase('acting');

        for (const toolCall of aiResponse.toolCalls) {
          const toolName = toolCall.function.name;
          let toolArgs: Record<string, unknown>;

          try {
            toolArgs = JSON.parse(toolCall.function.arguments);
          } catch {
            toolArgs = {};
          }

          console.log(`[ReActAgent] 🔧 调用工具: ${toolName}`, toolArgs);

          const actionStep: ReActStep = {
            id: generateId(),
            phase: 'acting',
            action: {
              tool: toolName,
              input: toolArgs,
            },
            timestamp: Date.now(),
          };
          this.state.steps.push(actionStep);
          callbacks.onStep?.(actionStep);
          callbacks.onAction?.({ tool: toolName, input: toolArgs });

          // Step 4: 观察 - 执行工具并获取结果
          this.setPhase('observing');

          let observation: string;
          try {
            observation = await callbacks.executeToolCall(toolName, toolArgs);
          } catch (error) {
            observation = `工具执行失败: ${error instanceof Error ? error.message : '未知错误'}`;
          }

          console.log(`[ReActAgent] 👀 观察结果: ${observation.substring(0, 100)}...`);

          const observeStep: ReActStep = {
            id: generateId(),
            phase: 'observing',
            observation,
            timestamp: Date.now(),
          };
          this.state.steps.push(observeStep);
          callbacks.onStep?.(observeStep);
          callbacks.onObservation?.(observation);

          // 将工具结果添加到消息历史
          const toolMessage: AIMessage = {
            role: 'tool',
            content: observation,
            tool_call_id: toolCall.id,
            name: toolName,
            timestamp: Date.now(),
          };
          this.state.messages.push(toolMessage);
          messagesToProcess.push(toolMessage);
        }

        // 更新 token 计数
        const newStats = shortTermMemory.getTokenStats(messagesToProcess);
        this.state.totalTokens = newStats.totalTokens;

        // 继续下一次迭代
        this.setPhase('thinking');
      }

      // 达到最大迭代次数
      console.log('[ReActAgent] ⚠️ 达到最大迭代次数');
      this.setPhase('error');

      const result: ReActAgentResult = {
        success: false,
        error: `达到最大迭代次数 (${this.config.maxIterations})`,
        steps: this.state.steps,
        totalIterations: this.state.currentIteration,
        totalTokens: this.state.totalTokens,
      };

      callbacks.onComplete?.(result);
      return result;

    } catch (error) {
      console.error('[ReActAgent] ❌ 执行错误:', error);
      this.setPhase('error');

      const errorMessage = error instanceof Error ? error.message : '未知错误';
      this.state.error = errorMessage;

      const result: ReActAgentResult = {
        success: false,
        error: errorMessage,
        steps: this.state.steps,
        totalIterations: this.state.currentIteration,
        totalTokens: this.state.totalTokens,
      };

      callbacks.onError?.(error instanceof Error ? error : new Error(errorMessage));
      callbacks.onComplete?.(result);
      return result;

    } finally {
      this.state.isRunning = false;
      this.abortController = null;
    }
  }

  /**
   * 停止执行
   */
  stop(): void {
    console.log('[ReActAgent] ⏹️ 停止执行');
    if (this.abortController) {
      this.abortController.abort();
    }
    if (this.state) {
      this.state.isRunning = false;
    }
  }

  /**
   * 获取当前状态
   */
  getState(): ReActAgentState | null {
    return this.state;
  }

  /**
   * 重置状态
   */
  reset(): void {
    this.state = null;
    this.abortController = null;
  }

  /**
   * 设置阶段
   */
  private setPhase(phase: ReActPhase): void {
    if (this.state) {
      this.state.phase = phase;
    }
  }

  /**
   * 构建系统提示词
   */
  private buildSystemPrompt(): string {
    let prompt = REACT_SYSTEM_PROMPT;

    // 添加工具描述
    if (this.config.tools.length > 0) {
      prompt += '\n\n## 可用工具\n';
      for (const tool of this.config.tools) {
        prompt += `\n### ${tool.name}\n`;
        prompt += `${tool.description}\n`;
        prompt += `参数: ${JSON.stringify(tool.parameters, null, 2)}\n`;
      }
    }

    return prompt;
  }

  /**
   * 估算消息的 token 数
   */
  estimateTokens(messages: AIMessage[]): number {
    return shortTermMemory.getTokenStats(messages).totalTokens;
  }

  /**
   * 将 tool 消息转换为 OpenAI 格式
   */
  static formatMessagesForOpenAI(messages: AIMessage[]): Array<{
    role: string;
    content: string;
    tool_call_id?: string;
    name?: string;
  }> {
    return messages.map(msg => {
      if (msg.role === 'tool') {
        return {
          role: 'tool',
          content: msg.content,
          tool_call_id: msg.tool_call_id || '',
          name: msg.name || '',
        };
      }
      return {
        role: msg.role,
        content: msg.content,
      };
    });
  }
}

// 导出单例
export const reactAgent = new ReActAgentService();

// 导出类以便创建自定义实例
export { ReActAgentService };

