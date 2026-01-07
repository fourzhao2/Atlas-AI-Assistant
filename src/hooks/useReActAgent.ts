import { useCallback } from 'react';
import { useStore } from '@/store';
import { reactAgent } from '@/services/react-agent';
import { aiService } from '@/services/ai-service';
import { agentTools, executeToolCall } from '@/services/agent-tools';
import { conversationService } from '@/services/conversation';
import type { AIMessage, ReActStep, ReActAgentResult } from '@/types';

/**
 * useReActAgent Hook
 * 
 * 提供 ReAct Agent 模式的完整功能封装
 * 
 * 使用方式：
 * ```tsx
 * const { runAgent, stopAgent, isRunning, steps } = useReActAgent();
 * 
 * // 运行 agent
 * await runAgent("帮我搜索 React 教程");
 * ```
 */
export const useReActAgent = () => {
  const {
    messages,
    conversationMode,
    agentPhase,
    agentSteps,
    agentIteration,
    currentConversationId,
    preferences,
    addMessage,
    setConversationMode,
    setAgentPhase,
    addAgentStep,
    setAgentIteration,
    resetAgentState,
    setLoading,
  } = useStore();

  /**
   * 运行 ReAct Agent
   */
  const runAgent = useCallback(async (
    userMessage: string,
    options?: {
      onChunk?: (chunk: string) => void;
      onComplete?: (result: ReActAgentResult) => void;
    }
  ): Promise<ReActAgentResult> => {
    console.log('[useReActAgent] 🚀 启动 Agent 模式:', userMessage);

    // 切换到 agent 模式
    setConversationMode('agent');
    resetAgentState();
    setLoading(true);

    // 添加用户消息
    const userMsg: AIMessage = {
      role: 'user',
      content: userMessage,
      timestamp: Date.now(),
    };
    addMessage(userMsg);

    // 保存到对话历史
    if (currentConversationId) {
      await conversationService.addMessage(currentConversationId, userMsg);
    }

    // 设置工具
    reactAgent.setTools(agentTools);

    // 运行 agent
    const result = await reactAgent.run(
      userMessage,
      messages.filter(m => m.role !== 'tool'), // 过滤掉之前的 tool 消息
      {
        // 思考回调
        onThought: (thought) => {
          console.log('[useReActAgent] 💭 思考:', thought.substring(0, 100));
        },

        // 行动回调
        onAction: (action) => {
          console.log('[useReActAgent] ⚡ 行动:', action.tool);
        },

        // 观察回调
        onObservation: (observation) => {
          console.log('[useReActAgent] 👀 观察:', observation.substring(0, 100));
        },

        // 步骤回调
        onStep: (step: ReActStep) => {
          addAgentStep(step);
          setAgentPhase(step.phase);
          
          // 根据步骤类型添加消息
          if (step.phase === 'thinking' && step.thought) {
            const thinkMsg: AIMessage = {
              role: 'assistant',
              content: `🤔 **思考中...**\n${step.thought}`,
              timestamp: step.timestamp,
            };
            addMessage(thinkMsg);
          } else if (step.phase === 'acting' && step.action) {
            const actMsg: AIMessage = {
              role: 'assistant',
              content: `⚡ **执行工具**: ${step.action.tool}\n\`\`\`json\n${JSON.stringify(step.action.input, null, 2)}\n\`\`\``,
              timestamp: step.timestamp,
            };
            addMessage(actMsg);
          } else if (step.phase === 'observing' && step.observation) {
            const obsMsg: AIMessage = {
              role: 'assistant',
              content: `👀 **观察结果**:\n${step.observation.substring(0, 500)}${step.observation.length > 500 ? '...' : ''}`,
              timestamp: step.timestamp,
            };
            addMessage(obsMsg);
          }
        },

        // 流式输出回调
        onChunk: options?.onChunk,

        // 完成回调
        onComplete: async (result) => {
          console.log('[useReActAgent] ✅ Agent 完成:', result.success);
          
          setAgentPhase(result.success ? 'completed' : 'error');
          setAgentIteration(result.totalIterations);
          setLoading(false);

          // 添加最终结果消息
          if (result.finalAnswer) {
            const finalMsg: AIMessage = {
              role: 'assistant',
              content: result.finalAnswer,
              timestamp: Date.now(),
            };
            addMessage(finalMsg);

            // 保存到对话历史
            if (currentConversationId) {
              await conversationService.addMessage(currentConversationId, finalMsg);
            }
          }

          // 添加统计信息
          const statsMsg: AIMessage = {
            role: 'assistant',
            content: `📊 **Agent 统计**\n- 迭代次数: ${result.totalIterations}\n- 步骤数: ${result.steps.length}\n- Token 使用: ${result.totalTokens}`,
            timestamp: Date.now(),
          };
          addMessage(statsMsg);

          options?.onComplete?.(result);
        },

        // 错误回调
        onError: (error) => {
          console.error('[useReActAgent] ❌ 错误:', error);
          setAgentPhase('error');
          setLoading(false);

          const errorMsg: AIMessage = {
            role: 'assistant',
            content: `❌ **Agent 错误**\n${error.message}`,
            timestamp: Date.now(),
          };
          addMessage(errorMsg);
        },

        // 工具执行器
        executeToolCall: async (toolName: string, args: Record<string, unknown>) => {
          console.log('[useReActAgent] 🔧 执行工具:', toolName, args);
          
          const result = await executeToolCall(toolName, args);
          
          if (result.success) {
            return result.result || '工具执行成功';
          } else {
            throw new Error(result.error || '工具执行失败');
          }
        },

        // AI 调用器
        callAI: async (msgs, tools, _onChunk) => {
          return await aiService.chatWithToolsForAgent(
            msgs,
            tools,
            preferences.defaultProvider
          );
        },
      }
    );

    return result;
  }, [
    messages,
    currentConversationId,
    preferences.defaultProvider,
    addMessage,
    setConversationMode,
    setAgentPhase,
    addAgentStep,
    setAgentIteration,
    resetAgentState,
    setLoading,
  ]);

  /**
   * 停止 Agent
   */
  const stopAgent = useCallback(() => {
    console.log('[useReActAgent] ⏹️ 停止 Agent');
    reactAgent.stop();
    setAgentPhase('idle');
    setLoading(false);

    const stopMsg: AIMessage = {
      role: 'assistant',
      content: '⏹️ **Agent 已停止**\n用户手动中止了执行。',
      timestamp: Date.now(),
    };
    addMessage(stopMsg);
  }, [addMessage, setAgentPhase, setLoading]);

  /**
   * 重置 Agent 状态
   */
  const resetAgent = useCallback(() => {
    resetAgentState();
    reactAgent.reset();
  }, [resetAgentState]);

  /**
   * 切换回 Chat 模式
   */
  const switchToChat = useCallback(() => {
    setConversationMode('chat');
    resetAgentState();
  }, [setConversationMode, resetAgentState]);

  return {
    // 状态
    isAgentMode: conversationMode === 'agent',
    isRunning: agentPhase !== 'idle' && agentPhase !== 'completed' && agentPhase !== 'error',
    phase: agentPhase,
    steps: agentSteps,
    iteration: agentIteration,
    
    // 方法
    runAgent,
    stopAgent,
    resetAgent,
    switchToChat,
    
    // 状态判断
    isThinking: agentPhase === 'thinking',
    isActing: agentPhase === 'acting',
    isObserving: agentPhase === 'observing',
    isCompleted: agentPhase === 'completed',
    isError: agentPhase === 'error',
  };
};

