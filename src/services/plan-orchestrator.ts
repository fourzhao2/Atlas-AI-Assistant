/**
 * Plan Mode Orchestrator
 * 
 * 协调 Planner 和 Navigator 之间的工作流程
 * 实现完整的 Plan 模式执行循环
 * 
 * 工作流程：
 * 1. 用户输入指令
 * 2. Planner 生成计划
 * 3. (可选) 用户审核/修改计划
 * 4. Navigator 逐步执行
 * 5. Planner 评估反馈
 * 6. 根据需要重新规划或继续
 * 7. 完成任务，汇总结果
 */

import type {
  AIMessage,
  PlanPhase,
  PlanModeState,
  PlanModeResult,
  TaskPlanFull,
  PlanStep,
  NavigatorFeedback,
} from '@/types';
import { plannerAgent } from './planner-agent';
import { navigatorAgent } from './navigator-agent';
import { getCurrentTab } from '@/utils/messaging';

/**
 * 回调函数类型
 */
interface OrchestratorCallbacks {
  onPhaseChange?: (phase: PlanPhase) => void;
  onPlanCreated?: (plan: TaskPlanFull) => void;
  onPlanUpdated?: (plan: TaskPlanFull) => void;
  onStepStart?: (step: PlanStep) => void;
  onStepComplete?: (step: PlanStep, feedback: NavigatorFeedback) => void;
  onPlannerThinking?: (thinking: string) => void;
  onNavigatorStatus?: (status: string) => void;
  onMessage?: (message: AIMessage) => void;
  onComplete?: (result: PlanModeResult) => void;
  onError?: (error: Error) => void;
}

/**
 * Plan Mode Orchestrator 类
 */
class PlanOrchestrator {
  private state: PlanModeState;
  private callbacks: OrchestratorCallbacks = {};
  private abortController: AbortController | null = null;

  constructor() {
    this.state = this.createInitialState();
  }

  /**
   * 创建初始状态
   */
  private createInitialState(): PlanModeState {
    return {
      mode: 'plan',
      phase: 'idle',
      plan: null,
      plannerThinking: '',
      navigatorStatus: '',
      messages: [],
      isRunning: false,
    };
  }

  /**
   * 设置回调函数
   */
  setCallbacks(callbacks: OrchestratorCallbacks): void {
    this.callbacks = callbacks;
  }

  /**
   * 执行任务
   * 
   * @param instruction 用户指令
   * @param requireApproval 是否需要用户确认计划
   */
  async execute(instruction: string, requireApproval = false): Promise<PlanModeResult> {
    console.log('[Orchestrator] 🚀 开始执行任务:', instruction);
    console.log('[Orchestrator] 需要用户确认:', requireApproval);

    // 重置状态
    this.state = this.createInitialState();
    this.state.isRunning = true;
    this.abortController = new AbortController();

    try {
      // Phase 1: Planning
      this.setPhase('planning');
      this.addMessage({
        role: 'user',
        content: instruction,
        timestamp: Date.now(),
      });

      this.callbacks.onPlannerThinking?.('正在分析任务并制定计划...');
      this.addMessage({
        role: 'assistant',
        content: '🎯 **Planner 正在分析任务...**\n\n正在理解您的意图并制定执行计划。',
        timestamp: Date.now(),
      });

      // 获取页面上下文
      const tab = await getCurrentTab();
      const pageContext = {
        url: tab?.url || '',
        title: tab?.title || '',
      };

      // 获取页面 DOM
      const dom = await navigatorAgent.getInteractiveDOM();

      // 创建计划
      const plan = await plannerAgent.createPlan(instruction, pageContext, dom);
      this.state.plan = plan;
      this.callbacks.onPlanCreated?.(plan);

      this.addMessage({
        role: 'assistant',
        content: this.formatPlanMessage(plan),
        timestamp: Date.now(),
      });

      // 如果需要用户确认
      if (requireApproval) {
        this.setPhase('reviewing');
        this.addMessage({
          role: 'assistant',
          content: '📋 请审核上述计划，确认后开始执行。',
          timestamp: Date.now(),
        });

        // 等待用户确认（通过 approvePlan 方法）
        return {
          success: true,
          plan,
          summary: '计划已创建，等待用户确认',
        };
      }

      // 自动开始执行
      return await this.executePlan();
    } catch (error) {
      console.error('[Orchestrator] ❌ 执行失败:', error);
      this.setPhase('error');
      this.state.error = error instanceof Error ? error.message : '未知错误';

      const errorResult: PlanModeResult = {
        success: false,
        plan: this.state.plan,
        error: this.state.error,
      };

      this.callbacks.onError?.(error instanceof Error ? error : new Error(this.state.error));
      this.callbacks.onComplete?.(errorResult);

      return errorResult;
    }
  }

  /**
   * 用户确认计划后执行
   */
  async approvePlan(): Promise<PlanModeResult> {
    if (!this.state.plan) {
      return {
        success: false,
        plan: null,
        error: '没有待确认的计划',
      };
    }

    this.state.plan.status = 'approved';
    this.addMessage({
      role: 'assistant',
      content: '✅ 计划已确认，开始执行...',
      timestamp: Date.now(),
    });

    return await this.executePlan();
  }

  /**
   * 执行计划
   */
  private async executePlan(): Promise<PlanModeResult> {
    if (!this.state.plan) {
      return {
        success: false,
        plan: null,
        error: '没有计划可执行',
      };
    }

    this.setPhase('executing');
    this.state.plan.status = 'executing';

    const plan = this.state.plan;
    let currentIndex = plan.currentStepIndex;

    while (currentIndex < plan.steps.length && this.state.isRunning) {
      // 检查是否被中止
      if (this.abortController?.signal.aborted) {
        throw new Error('执行被用户中止');
      }

      const step = plan.steps[currentIndex];
      step.status = 'running';
      this.callbacks.onStepStart?.(step);
      this.callbacks.onNavigatorStatus?.(`执行步骤 ${currentIndex + 1}/${plan.steps.length}: ${step.description}`);

      this.addMessage({
        role: 'assistant',
        content: `⚡ **执行步骤 ${currentIndex + 1}**\n\n${step.description}`,
        timestamp: Date.now(),
      });

      // Navigator 执行步骤
      const feedback = await navigatorAgent.executeStep(step);
      step.timestamp = Date.now();

      if (feedback.success) {
        step.status = 'success';
        step.result = feedback.result;
      } else {
        step.status = 'failed';
        step.error = feedback.error;
        step.retryCount = (step.retryCount || 0) + 1;
      }

      this.callbacks.onStepComplete?.(step, feedback);
      this.callbacks.onPlanUpdated?.(plan);

      this.addMessage({
        role: 'assistant',
        content: feedback.success
          ? `✅ **步骤完成**\n\n${feedback.result}`
          : `❌ **步骤失败**\n\n${feedback.error || feedback.result}`,
        timestamp: Date.now(),
      });

      // Phase: Evaluating
      this.setPhase('evaluating');
      this.callbacks.onPlannerThinking?.('评估执行结果...');

      // 获取当前 DOM
      const currentDOM = await navigatorAgent.getInteractiveDOM();

      // Planner 评估反馈
      const evaluation = await plannerAgent.evaluateFeedback(plan, feedback, currentDOM);

      if (evaluation.isCompleted) {
        // 任务完成
        plan.status = 'completed';
        plan.completedAt = Date.now();
        this.setPhase('completed');

        const result: PlanModeResult = {
          success: true,
          plan,
          summary: evaluation.summary || '任务已完成',
        };

        this.addMessage({
          role: 'assistant',
          content: `🎉 **任务完成！**\n\n${evaluation.summary || '所有步骤已成功执行。'}`,
          timestamp: Date.now(),
        });

        this.callbacks.onComplete?.(result);
        return result;
      }

      if (evaluation.shouldReplan && evaluation.updatedPlan) {
        // 需要重新规划
        this.setPhase('replanning');
        this.state.plan = evaluation.updatedPlan;
        plan.totalRetries++;

        this.addMessage({
          role: 'assistant',
          content: '🔄 **重新规划中...**\n\nPlanner 正在根据当前状态调整计划。',
          timestamp: Date.now(),
        });

        this.callbacks.onPlanUpdated?.(evaluation.updatedPlan);
        currentIndex = evaluation.updatedPlan.currentStepIndex;

        // 检查重试次数
        if (plan.totalRetries > plan.maxRetries) {
          plan.status = 'failed';
          this.setPhase('error');

          const result: PlanModeResult = {
            success: false,
            plan,
            error: '达到最大重试次数',
          };

          this.callbacks.onComplete?.(result);
          return result;
        }
      } else if (!evaluation.shouldContinue) {
        // 不应该继续
        plan.status = 'failed';
        this.setPhase('error');

        const result: PlanModeResult = {
          success: false,
          plan,
          error: '执行中断',
        };

        this.callbacks.onComplete?.(result);
        return result;
      } else {
        // 继续下一步
        currentIndex++;
        plan.currentStepIndex = currentIndex;
        this.setPhase('executing');
      }
    }

    // 所有步骤执行完毕
    plan.status = 'completed';
    plan.completedAt = Date.now();
    this.setPhase('completed');

    const result: PlanModeResult = {
      success: true,
      plan,
      summary: '所有步骤已执行完毕',
    };

    this.addMessage({
      role: 'assistant',
      content: '🎉 **任务完成！**\n\n所有步骤已执行完毕。',
      timestamp: Date.now(),
    });

    this.callbacks.onComplete?.(result);
    return result;
  }

  /**
   * 停止执行
   */
  stop(): void {
    console.log('[Orchestrator] ⏹️ 停止执行');
    this.state.isRunning = false;
    this.abortController?.abort();
    navigatorAgent.stop();

    if (this.state.plan) {
      this.state.plan.status = 'paused';
    }

    this.addMessage({
      role: 'assistant',
      content: '⏹️ **任务已暂停**\n\n用户手动停止了执行。',
      timestamp: Date.now(),
    });
  }

  /**
   * 修改计划步骤
   */
  updateStep(stepId: string, updates: Partial<PlanStep>): void {
    if (!this.state.plan) return;

    const step = this.state.plan.steps.find(s => s.id === stepId);
    if (step) {
      Object.assign(step, updates);
      this.state.plan.updatedAt = Date.now();
      this.callbacks.onPlanUpdated?.(this.state.plan);
    }
  }

  /**
   * 添加新步骤
   */
  addStep(afterStepId: string, newStep: Omit<PlanStep, 'id' | 'index' | 'status'>): void {
    if (!this.state.plan) return;

    const afterIndex = this.state.plan.steps.findIndex(s => s.id === afterStepId);
    if (afterIndex === -1) return;

    const step: PlanStep = {
      ...newStep,
      id: `step_manual_${Date.now()}`,
      index: afterIndex + 1,
      status: 'pending',
    };

    this.state.plan.steps.splice(afterIndex + 1, 0, step);

    // 更新后续步骤的索引
    for (let i = afterIndex + 2; i < this.state.plan.steps.length; i++) {
      this.state.plan.steps[i].index = i;
    }

    this.state.plan.updatedAt = Date.now();
    this.callbacks.onPlanUpdated?.(this.state.plan);
  }

  /**
   * 删除步骤
   */
  removeStep(stepId: string): void {
    if (!this.state.plan) return;

    const index = this.state.plan.steps.findIndex(s => s.id === stepId);
    if (index === -1) return;

    this.state.plan.steps.splice(index, 1);

    // 更新后续步骤的索引
    for (let i = index; i < this.state.plan.steps.length; i++) {
      this.state.plan.steps[i].index = i;
    }

    this.state.plan.updatedAt = Date.now();
    this.callbacks.onPlanUpdated?.(this.state.plan);
  }

  /**
   * 获取当前状态
   */
  getState(): PlanModeState {
    return { ...this.state };
  }

  /**
   * 重置状态
   */
  reset(): void {
    this.state = this.createInitialState();
    this.abortController = null;
    navigatorAgent.reset();
  }

  /**
   * 设置阶段
   */
  private setPhase(phase: PlanPhase): void {
    this.state.phase = phase;
    this.callbacks.onPhaseChange?.(phase);
    console.log('[Orchestrator] 📍 阶段变更:', phase);
  }

  /**
   * 添加消息
   */
  private addMessage(message: AIMessage): void {
    this.state.messages.push(message);
    this.callbacks.onMessage?.(message);
  }

  /**
   * 格式化计划消息
   */
  private formatPlanMessage(plan: TaskPlanFull): string {
    let message = `📋 **任务计划**\n\n`;
    message += `**目标**: ${plan.goal}\n\n`;
    message += `**步骤** (共 ${plan.steps.length} 步):\n\n`;

    plan.steps.forEach((step, index) => {
      const statusIcon = this.getStepStatusIcon(step.status);
      message += `${index + 1}. ${statusIcon} ${step.description}\n`;
    });

    return message;
  }

  /**
   * 获取步骤状态图标
   */
  private getStepStatusIcon(status: PlanStep['status']): string {
    switch (status) {
      case 'pending':
        return '⏳';
      case 'running':
        return '🔄';
      case 'success':
        return '✅';
      case 'failed':
        return '❌';
      case 'skipped':
        return '⏭️';
      default:
        return '○';
    }
  }
}

// 导出单例
export const planOrchestrator = new PlanOrchestrator();

// 导出类以便创建自定义实例
export { PlanOrchestrator };

