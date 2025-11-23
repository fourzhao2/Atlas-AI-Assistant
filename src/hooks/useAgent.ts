import { useState, useCallback, useRef } from 'react';
import { agentExecutor } from '@/services/agent-executor';
import { conversationService } from '@/services/conversation';
import type { AgentExecutionStep, AIMessage } from '@/types';

/**
 * ReAct Agent Phase (Reasoning + Acting)
 * 思考 → 行动 → 观察 → 循环
 */
type AgentPhase = 'idle' | 'thinking' | 'acting' | 'observing' | 'completed' | 'error';

interface ReActStep {
  phase: AgentPhase;
  thought?: string;      // 思考内容
  action?: string;       // 行动名称
  observation?: string;  // 观察结果
  timestamp: number;
}

interface UseAgentOptions {
  onMessage?: (message: AIMessage) => void;
  conversationId?: string | null;
}

/**
 * useAgent Hook - 基于 ReAct 模式的 AI Agent
 * 
 * ReAct = Reasoning (推理) + Acting (行动)
 * 循环流程：思考 → 行动 → 观察 → 思考 → ...
 */
export const useAgent = ({ onMessage, conversationId }: UseAgentOptions = {}) => {
  const [isExecuting, setIsExecuting] = useState(false);
  const [phase, setPhase] = useState<AgentPhase>('idle');
  const [steps, setSteps] = useState<AgentExecutionStep[]>([]);
  const [reactSteps, setReactSteps] = useState<ReActStep[]>([]);
  const [currentTask, setCurrentTask] = useState<string>('');
  const abortControllerRef = useRef<AbortController | null>(null);

  // 添加 ReAct 步骤
  const addReActStep = useCallback((reactStep: ReActStep) => {
    setReactSteps(prev => [...prev, reactStep]);
    setPhase(reactStep.phase);
    
    // 根据阶段创建不同的消息
    let content = '';
    let icon = '';
    
    switch (reactStep.phase) {
      case 'thinking':
        icon = '🤔';
        content = `**思考中...**\n${reactStep.thought || '分析问题...'}`;
        break;
      case 'acting':
        icon = '⚡';
        content = `**执行行动**\n操作: ${reactStep.action}`;
        break;
      case 'observing':
        icon = '👀';
        content = `**观察结果**\n${reactStep.observation}`;
        break;
      case 'completed':
        icon = '✅';
        content = `**任务完成**`;
        break;
      case 'error':
        icon = '❌';
        content = `**出错了**\n${reactStep.observation}`;
        break;
    }
    
    if (content) {
      const message: AIMessage = {
        role: 'assistant',
        content: `${icon} ${content}`,
        timestamp: reactStep.timestamp,
      };
      onMessage?.(message);
    }
  }, [onMessage]);

  const addStep = useCallback((step: AgentExecutionStep) => {
    setSteps(prev => [...prev, step]);
    
    // 创建步骤消息
    const stepMessage: AIMessage = {
      role: 'assistant',
      content: `${step.success ? '✓' : '✗'} ${step.result}`,
      timestamp: step.timestamp,
    };
    
    onMessage?.(stepMessage);
  }, [onMessage]);

  /**
   * 执行任务 - ReAct 模式
   * 1. Thought: AI 思考如何解决问题
   * 2. Action: 执行具体操作
   * 3. Observation: 观察结果
   * 4. 循环直到完成
   */
  const execute = useCallback(async (instruction: string) => {
    console.log('[useAgent/ReAct] 🚀 开始执行任务:', instruction);
    
    setIsExecuting(true);
    setSteps([]);
    setReactSteps([]);
    setCurrentTask(instruction);
    setPhase('thinking');
    
    // 创建中止控制器
    abortControllerRef.current = new AbortController();
    
    // 第一步：思考
    addReActStep({
      phase: 'thinking',
      thought: `分析任务：${instruction}`,
      timestamp: Date.now(),
    });
    
    try {
      const result = await agentExecutor.executeTask(instruction, {
        onStep: (step) => {
          console.log('[useAgent/ReAct] 📋 步骤:', step);
          
          // 转换为 ReAct 步骤
          addReActStep({
            phase: 'acting',
            action: typeof step.action === 'string' ? step.action : '执行操作',
            timestamp: step.timestamp,
          });
          
          // 观察结果
          setTimeout(() => {
            addReActStep({
              phase: 'observing',
              observation: step.result,
              timestamp: Date.now(),
            });
          }, 100);
          
          addStep(step);
        },
        onComplete: async (result) => {
          console.log('[useAgent/ReAct] ✅ 任务完成:', result);
          
          // 最终阶段
          addReActStep({
            phase: result.success ? 'completed' : 'error',
            observation: result.success 
              ? `成功执行了 ${result.steps?.length || 0} 个步骤`
              : result.error || '任务失败',
            timestamp: Date.now(),
          });
          
          setIsExecuting(false);
          setPhase(result.success ? 'completed' : 'error');
          
          const completeMessage: AIMessage = {
            role: 'assistant',
            content: result.success 
              ? `✅ **任务完成！**\n\n通过 ReAct 模式执行了 ${result.steps?.length || 0} 个步骤。\n\n**流程**：思考 → 行动 → 观察 → 完成`
              : `❌ **任务失败**\n\n${result.error}`,
            timestamp: Date.now(),
          };
          
          onMessage?.(completeMessage);
          
          // 保存到对话历史
          if (conversationId) {
            await conversationService.addMessage(conversationId, completeMessage);
          }
        },
        onError: (error) => {
          console.error('[useAgent/ReAct] ❌ 任务错误:', error);
          
          addReActStep({
            phase: 'error',
            observation: error.message,
            timestamp: Date.now(),
          });
          
          setIsExecuting(false);
          setPhase('error');
          
          const errorMessage: AIMessage = {
            role: 'assistant',
            content: `❌ **执行错误**\n\n${error.message}`,
            timestamp: Date.now(),
          };
          
          onMessage?.(errorMessage);
          
          // 保存到对话历史
          if (conversationId) {
            conversationService.addMessage(conversationId, errorMessage);
          }
        },
      });
      
      return result;
    } catch (error) {
      console.error('[useAgent/ReAct] 💥 执行异常:', error);
      
      addReActStep({
        phase: 'error',
        observation: error instanceof Error ? error.message : '未知错误',
        timestamp: Date.now(),
      });
      
      setIsExecuting(false);
      setPhase('error');
      
      const errorMessage: AIMessage = {
        role: 'assistant',
        content: `❌ **执行异常**\n\n${error instanceof Error ? error.message : '未知错误'}`,
        timestamp: Date.now(),
      };
      
      onMessage?.(errorMessage);
      
      return {
        success: false,
        error: error instanceof Error ? error.message : '未知错误',
      };
    }
  }, [addStep, addReActStep, onMessage, conversationId]);

  const stop = useCallback(() => {
    console.log('[useAgent/ReAct] ⏹️ 停止执行');
    
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    
    agentExecutor.stopExecution();
    setIsExecuting(false);
    setPhase('idle');
    
    const stopMessage: AIMessage = {
      role: 'assistant',
      content: '⏹️ **任务已停止**\n\n用户手动停止了 ReAct 循环。',
      timestamp: Date.now(),
    };
    
    onMessage?.(stopMessage);
  }, [onMessage]);

  const reset = useCallback(() => {
    console.log('[useAgent/ReAct] 🔄 重置状态');
    setIsExecuting(false);
    setPhase('idle');
    setSteps([]);
    setReactSteps([]);
    setCurrentTask('');
    abortControllerRef.current = null;
  }, []);

  return {
    // 状态
    isExecuting,
    phase,
    steps,
    reactSteps,
    currentTask,
    hasSteps: steps.length > 0,
    
    // 方法
    execute,
    stop,
    reset,
    
    // ReAct 模式信息
    isThinking: phase === 'thinking',
    isActing: phase === 'acting',
    isObserving: phase === 'observing',
    isCompleted: phase === 'completed',
    isError: phase === 'error',
  };
};

