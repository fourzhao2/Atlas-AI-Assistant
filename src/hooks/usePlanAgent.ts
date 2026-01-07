/**
 * usePlanAgent Hook
 * 
 * 提供 Plan 模式的 React 状态管理和操作接口
 * 封装 Planner + Navigator 多智能体协作逻辑
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import { planOrchestrator } from '@/services/plan-orchestrator';
import { conversationService } from '@/services/conversation';
import type {
  AIMessage,
  PlanPhase,
  PlanModeResult,
  TaskPlanFull,
  PlanStep,
} from '@/types';

interface UsePlanAgentOptions {
  onMessage?: (message: AIMessage) => void;
  conversationId?: string | null;
  requireApproval?: boolean;
}

/**
 * usePlanAgent Hook
 * 
 * 用于管理 Plan 模式的状态和操作
 */
export const usePlanAgent = ({
  onMessage,
  conversationId,
  requireApproval = false,
}: UsePlanAgentOptions = {}) => {
  // 状态
  const [isExecuting, setIsExecuting] = useState(false);
  const [phase, setPhase] = useState<PlanPhase>('idle');
  const [plan, setPlan] = useState<TaskPlanFull | null>(null);
  const [plannerThinking, setPlannerThinking] = useState('');
  const [navigatorStatus, setNavigatorStatus] = useState('');
  const [messages, setMessages] = useState<AIMessage[]>([]);
  const [error, setError] = useState<string | null>(null);

  // 当前步骤
  const [currentStep, setCurrentStep] = useState<PlanStep | null>(null);

  // Refs
  const isExecutingRef = useRef(false);

  /**
   * 设置回调
   */
  useEffect(() => {
    planOrchestrator.setCallbacks({
      onPhaseChange: (newPhase) => {
        setPhase(newPhase);
      },
      onPlanCreated: (newPlan) => {
        setPlan(newPlan);
      },
      onPlanUpdated: (updatedPlan) => {
        setPlan({ ...updatedPlan });
      },
      onStepStart: (step) => {
        setCurrentStep(step);
      },
      onStepComplete: (step, _feedback) => {
        setCurrentStep(step);
        setPlan((prev) => prev ? { ...prev } : null);
      },
      onPlannerThinking: (thinking) => {
        setPlannerThinking(thinking);
      },
      onNavigatorStatus: (status) => {
        setNavigatorStatus(status);
      },
      onMessage: (message) => {
        setMessages((prev) => [...prev, message]);
        onMessage?.(message);

        // 保存到对话历史
        if (conversationId) {
          conversationService.addMessage(conversationId, message).catch(console.error);
        }
      },
      onComplete: async (result) => {
        setIsExecuting(false);
        isExecutingRef.current = false;

        if (!result.success && result.error) {
          setError(result.error);
        }

        // 添加完成消息
        const completeMessage: AIMessage = {
          role: 'assistant',
          content: result.success
            ? `✅ **Plan 模式任务完成！**\n\n${result.summary || '所有步骤已成功执行。'}`
            : `❌ **任务失败**\n\n${result.error}`,
          timestamp: Date.now(),
        };

        onMessage?.(completeMessage);

        if (conversationId) {
          await conversationService.addMessage(conversationId, completeMessage);
        }
      },
      onError: (err) => {
        setError(err.message);
        setIsExecuting(false);
        isExecutingRef.current = false;
      },
    });

    return () => {
      // 清理回调
      planOrchestrator.setCallbacks({});
    };
  }, [onMessage, conversationId]);

  /**
   * 执行任务
   */
  const execute = useCallback(async (instruction: string): Promise<PlanModeResult> => {
    if (isExecutingRef.current) {
      console.warn('[usePlanAgent] 已有任务在执行中');
      return {
        success: false,
        plan: null,
        error: '已有任务在执行中',
      };
    }

    console.log('[usePlanAgent] 🚀 开始执行 Plan 模式:', instruction);

    // 重置状态
    setIsExecuting(true);
    isExecutingRef.current = true;
    setPhase('planning');
    setPlan(null);
    setPlannerThinking('');
    setNavigatorStatus('');
    setMessages([]);
    setError(null);
    setCurrentStep(null);

    try {
      const result = await planOrchestrator.execute(instruction, requireApproval);
      return result;
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : '执行失败';
      setError(errorMsg);
      setIsExecuting(false);
      isExecutingRef.current = false;

      return {
        success: false,
        plan: null,
        error: errorMsg,
      };
    }
  }, [requireApproval]);

  /**
   * 确认计划
   */
  const approvePlan = useCallback(async (): Promise<PlanModeResult> => {
    console.log('[usePlanAgent] ✅ 确认计划');
    return await planOrchestrator.approvePlan();
  }, []);

  /**
   * 停止执行
   */
  const stop = useCallback(() => {
    console.log('[usePlanAgent] ⏹️ 停止执行');
    planOrchestrator.stop();
    setIsExecuting(false);
    isExecutingRef.current = false;
  }, []);

  /**
   * 重置状态
   */
  const reset = useCallback(() => {
    console.log('[usePlanAgent] 🔄 重置状态');
    planOrchestrator.reset();
    setIsExecuting(false);
    isExecutingRef.current = false;
    setPhase('idle');
    setPlan(null);
    setPlannerThinking('');
    setNavigatorStatus('');
    setMessages([]);
    setError(null);
    setCurrentStep(null);
  }, []);

  /**
   * 修改步骤
   */
  const updateStep = useCallback((stepId: string, updates: Partial<PlanStep>) => {
    planOrchestrator.updateStep(stepId, updates);
  }, []);

  /**
   * 添加步骤
   */
  const addStep = useCallback((afterStepId: string, newStep: Omit<PlanStep, 'id' | 'index' | 'status'>) => {
    planOrchestrator.addStep(afterStepId, newStep);
  }, []);

  /**
   * 删除步骤
   */
  const removeStep = useCallback((stepId: string) => {
    planOrchestrator.removeStep(stepId);
  }, []);

  /**
   * 获取步骤进度
   */
  const getProgress = useCallback(() => {
    if (!plan) return { current: 0, total: 0, percentage: 0 };

    const completed = plan.steps.filter(s => s.status === 'success').length;
    const total = plan.steps.length;
    const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;

    return { current: completed, total, percentage };
  }, [plan]);

  return {
    // 状态
    isExecuting,
    phase,
    plan,
    plannerThinking,
    navigatorStatus,
    messages,
    error,
    currentStep,

    // 计算属性
    hasPlan: plan !== null,
    isPlanning: phase === 'planning',
    isReviewing: phase === 'reviewing',
    isNavigating: phase === 'executing',
    isEvaluating: phase === 'evaluating',
    isReplanning: phase === 'replanning',
    isCompleted: phase === 'completed',
    isError: phase === 'error',
    progress: getProgress(),

    // 方法
    execute,
    approvePlan,
    stop,
    reset,
    updateStep,
    addStep,
    removeStep,
  };
};

