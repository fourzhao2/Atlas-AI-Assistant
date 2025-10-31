import type { AgentAction, InteractiveElement, TaskPlan, ExecutionResult, AgentExecutionStep, AIMessage } from '@/types';
import { sendMessageToTab, getCurrentTab } from '@/utils/messaging';
import { aiService } from './ai-service';
import { generateActionsFromTemplate } from './agent-templates';

export class AgentExecutor {
  private isExecuting = false;
  private shouldStop = false;

  /**
   * 执行 Agent 任务
   */
  async executeTask(
    instruction: string,
    callbacks?: {
      onStep?: (step: AgentExecutionStep) => void;
      onComplete?: (result: ExecutionResult) => void;
      onError?: (error: Error) => void;
    }
  ): Promise<ExecutionResult> {
    if (this.isExecuting) {
      return {
        success: false,
        error: '已有任务正在执行中'
      };
    }

    this.isExecuting = true;
    this.shouldStop = false;
    const steps: string[] = [];

    try {
      console.log('[AgentExecutor] 开始执行任务:', instruction);

      // 1. 先尝试使用预定义模板
      const tab = await getCurrentTab();
      if (!tab?.id) {
        throw new Error('没有活动标签页');
      }

      const context = {
        url: tab.url || '',
        title: tab.title || ''
      };

      const templateActions = await generateActionsFromTemplate(instruction, context);
      
      if (templateActions && templateActions.length > 0) {
        console.log('[AgentExecutor] 使用模板生成的操作');
        return await this.executeSimpleTask(templateActions, callbacks);
      }

      // 2. 如果模板没有匹配，使用 AI 分析
      const dom = await this.getInteractiveDOM();
      const plan = await this.analyzeTask(instruction, dom);

      console.log('[AgentExecutor] 任务计划:', plan);

      if (plan.complexity === 'simple') {
        return await this.executeSimpleTask(plan.actions, callbacks);
      } else {
        return await this.executeComplexTask(instruction, plan, dom, callbacks);
      }
    } catch (error) {
      console.error('[AgentExecutor] 执行失败:', error);
      const result: ExecutionResult = {
        success: false,
        error: error instanceof Error ? error.message : '未知错误',
        steps
      };

      callbacks?.onError?.(error instanceof Error ? error : new Error(String(error)));
      callbacks?.onComplete?.(result);

      return result;
    } finally {
      this.isExecuting = false;
    }
  }

  /**
   * 停止执行
   */
  stopExecution(): void {
    console.log('[AgentExecutor] 停止执行');
    this.shouldStop = true;
  }

  /**
   * 获取当前页面的可交互元素
   */
  private async getInteractiveDOM(): Promise<InteractiveElement[]> {
    const tab = await getCurrentTab();
    if (!tab?.id) {
      return [];
    }

    const response = await sendMessageToTab<InteractiveElement[]>(tab.id, {
      type: 'GET_INTERACTIVE_DOM'
    });

    if (response.success && response.data) {
      return response.data;
    }

    return [];
  }

  /**
   * 使用 AI 分析任务并生成执行计划
   */
  private async analyzeTask(instruction: string, dom: InteractiveElement[]): Promise<TaskPlan> {
    // 构建 DOM 摘要（限制长度）
    const domSummary = dom.slice(0, 50).map(el => ({
      id: el.id,
      type: el.type,
      text: el.text.substring(0, 50),
      selector: el.selector
    }));

    const messages: AIMessage[] = [
      {
        role: 'system',
        content: `你是一个网页自动化代理。分析用户指令并生成操作序列。

可用操作：
- click: 点击元素
- fill: 填写输入框
- select: 选择下拉框选项
- check: 勾选复选框
- press: 按键（Enter, Tab, Escape等）
- wait: 等待元素或延迟
- submit: 提交表单
- navigate: 导航到URL
- scroll: 滚动页面

当前页面的可交互元素（前50个）：
${JSON.stringify(domSummary, null, 2)}

请分析指令的复杂度：
- simple: 1-3步操作，直接可以执行
- complex: 4步以上，或需要根据页面反馈调整

返回JSON格式：
{
  "complexity": "simple" | "complex",
  "description": "任务描述",
  "actions": [
    {"type": "click", "selector": "#button1"},
    {"type": "fill", "selector": "input[name='q']", "value": "search query"}
  ]
}`
      },
      {
        role: 'user',
        content: instruction
      }
    ];

    try {
      let response = '';
      await aiService.chat(messages, (chunk) => {
        response += chunk;
      });

      // 尝试从响应中提取 JSON
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const plan = JSON.parse(jsonMatch[0]) as TaskPlan;
        return plan;
      }

      // 如果无法解析，返回一个简单的计划
      return {
        complexity: 'simple',
        description: instruction,
        actions: []
      };
    } catch (error) {
      console.error('[AgentExecutor] AI 分析失败:', error);
      return {
        complexity: 'simple',
        description: instruction,
        actions: []
      };
    }
  }

  /**
   * 执行简单任务（直接执行所有步骤）
   */
  private async executeSimpleTask(
    actions: AgentAction[],
    callbacks?: {
      onStep?: (step: AgentExecutionStep) => void;
      onComplete?: (result: ExecutionResult) => void;
    }
  ): Promise<ExecutionResult> {
    const steps: string[] = [];
    const tab = await getCurrentTab();

    if (!tab?.id) {
      return {
        success: false,
        error: '没有活动标签页'
      };
    }

    for (let i = 0; i < actions.length; i++) {
      if (this.shouldStop) {
        return {
          success: false,
          error: '用户停止执行',
          steps
        };
      }

      const action = actions[i];
      console.log(`[AgentExecutor] 执行步骤 ${i + 1}/${actions.length}:`, action);

      try {
      // 特殊处理 navigate 操作 - 直接使用 Chrome API
      if (action.type === 'navigate' && action.url) {
        try {
          // 验证 URL 格式
          if (!action.url.startsWith('http://') && !action.url.startsWith('https://')) {
            throw new Error('URL 必须以 http:// 或 https:// 开头');
          }
          
          await chrome.tabs.update(tab.id, { url: action.url });
          
          const stepResult: AgentExecutionStep = {
            action,
            result: `导航到: ${action.url}`,
            success: true,
            timestamp: Date.now()
          };
          
          steps.push(stepResult.result);
          callbacks?.onStep?.(stepResult);
          
          // 导航后等待页面加载
          await new Promise(resolve => setTimeout(resolve, 1000));
          continue;
        } catch (navError) {
          const errorMsg = navError instanceof Error ? navError.message : '导航失败';
          console.error('[AgentExecutor] 导航失败:', errorMsg);
          const stepResult: AgentExecutionStep = {
            action,
            result: errorMsg,
            success: false,
            timestamp: Date.now()
          };
          
          callbacks?.onStep?.(stepResult);
          
          const result: ExecutionResult = {
            success: false,
            error: errorMsg,
            steps
          };
          
          callbacks?.onComplete?.(result);
          return result;
        }
      }
        
        // 其他操作通过 content script 执行
        const response = await sendMessageToTab<string>(tab.id, {
          type: 'EXECUTE_AGENT_ACTION',
          payload: action
        });

        if (response.success && response.data) {
          const stepResult: AgentExecutionStep = {
            action,
            result: response.data,
            success: true,
            timestamp: Date.now()
          };

          steps.push(response.data);
          callbacks?.onStep?.(stepResult);
        } else {
          const stepResult: AgentExecutionStep = {
            action,
            result: response.error || '执行失败',
            success: false,
            timestamp: Date.now()
          };

          callbacks?.onStep?.(stepResult);
          
          // 简单任务中，一步失败就终止
          const result: ExecutionResult = {
            success: false,
            error: response.error || '操作执行失败',
            steps
          };

          callbacks?.onComplete?.(result);
          return result;
        }
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : '未知错误';
        const stepResult: AgentExecutionStep = {
          action,
          result: errorMsg,
          success: false,
          timestamp: Date.now()
        };

        callbacks?.onStep?.(stepResult);

        const result: ExecutionResult = {
          success: false,
          error: errorMsg,
          steps
        };

        callbacks?.onComplete?.(result);
        return result;
      }

      // 在某些操作后添加短暂延迟
      if (action.type === 'click' || action.type === 'submit' || action.type === 'navigate') {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }

    const result: ExecutionResult = {
      success: true,
      steps
    };

    callbacks?.onComplete?.(result);
    return result;
  }

  /**
   * 执行复杂任务（分步执行，每步反馈给 AI）
   */
  private async executeComplexTask(
    instruction: string,
    plan: TaskPlan,
    _initialDom: InteractiveElement[],
    callbacks?: {
      onStep?: (step: AgentExecutionStep) => void;
      onComplete?: (result: ExecutionResult) => void;
    }
  ): Promise<ExecutionResult> {
    const steps: string[] = [];
    const tab = await getCurrentTab();

    if (!tab?.id) {
      return {
        success: false,
        error: '没有活动标签页'
      };
    }

    let currentStep = 0;
    const maxSteps = 10; // 防止无限循环
    let completed = false;

    while (currentStep < maxSteps && !completed && !this.shouldStop) {
      if (currentStep >= plan.actions.length) {
        completed = true;
        break;
      }

      const action = plan.actions[currentStep];
      console.log(`[AgentExecutor] 复杂任务步骤 ${currentStep + 1}:`, action);

      try {
        const response = await sendMessageToTab<string>(tab.id, {
          type: 'EXECUTE_AGENT_ACTION',
          payload: action
        });

        if (response.success && response.data) {
          const stepResult: AgentExecutionStep = {
            action,
            result: response.data,
            success: true,
            timestamp: Date.now()
          };

          steps.push(response.data);
          callbacks?.onStep?.(stepResult);

          // 等待页面更新
          await new Promise(resolve => setTimeout(resolve, 1000));

          // 获取新的页面状态
          const newDom = await this.getInteractiveDOM();

          // 让 AI 决定下一步
          const nextPlan = await this.getNextStep(instruction, steps, newDom);

          if (nextPlan.completed) {
            completed = true;
            break;
          }

          plan = nextPlan;
          currentStep++;
        } else {
          const stepResult: AgentExecutionStep = {
            action,
            result: response.error || '执行失败',
            success: false,
            timestamp: Date.now()
          };

          callbacks?.onStep?.(stepResult);

          // 尝试恢复
          currentStep++;
        }
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : '未知错误';
        const stepResult: AgentExecutionStep = {
          action,
          result: errorMsg,
          success: false,
          timestamp: Date.now()
        };

        callbacks?.onStep?.(stepResult);
        currentStep++;
      }
    }

    const result: ExecutionResult = {
      success: completed,
      steps,
      error: this.shouldStop ? '用户停止执行' : (!completed ? '达到最大步骤限制' : undefined)
    };

    callbacks?.onComplete?.(result);
    return result;
  }

  /**
   * 根据当前状态让 AI 决定下一步
   */
  private async getNextStep(
    instruction: string,
    previousSteps: string[],
    currentDom: InteractiveElement[]
  ): Promise<TaskPlan> {
    const domSummary = currentDom.slice(0, 50).map(el => ({
      id: el.id,
      type: el.type,
      text: el.text.substring(0, 50),
      selector: el.selector
    }));

    const messages: AIMessage[] = [
      {
        role: 'system',
        content: `你是一个网页自动化代理。根据任务目标和已执行的步骤，决定下一步操作。

原始指令：${instruction}

已执行的步骤：
${previousSteps.map((s, i) => `${i + 1}. ${s}`).join('\n')}

当前页面状态：
${JSON.stringify(domSummary, null, 2)}

如果任务已完成，返回 {"completed": true}
否则返回下一步操作计划：
{
  "completed": false,
  "actions": [...]
}`
      },
      {
        role: 'user',
        content: '根据当前状态，我应该继续执行什么操作？'
      }
    ];

    try {
      let response = '';
      await aiService.chat(messages, (chunk) => {
        response += chunk;
      });

      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const plan = JSON.parse(jsonMatch[0]) as TaskPlan;
        return plan;
      }

      return {
        complexity: 'simple',
        completed: true,
        actions: []
      };
    } catch (error) {
      console.error('[AgentExecutor] 获取下一步失败:', error);
      return {
        complexity: 'simple',
        completed: true,
        actions: []
      };
    }
  }
}

export const agentExecutor = new AgentExecutor();

