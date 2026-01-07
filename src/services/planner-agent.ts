/**
 * Planner Agent Service
 * 
 * 负责高级别的任务理解和步骤规划
 * 类似 Nanobrowser 的 Planner 角色
 * 
 * 职责：
 * 1. 理解用户的模糊指令
 * 2. 分析当前页面状态
 * 3. 生成可执行的步骤计划
 * 4. 评估执行结果并决定下一步
 * 5. 在必要时重新规划
 */

import type {
  AIMessage,
  AgentAction,
  InteractiveElement,
  PlannerConfig,
  PlannerResponse,
  TaskPlanFull,
  NavigatorFeedback,
} from '@/types';
import { aiService } from './ai-service';

// 默认配置
const DEFAULT_CONFIG: PlannerConfig = {
  maxSteps: 15,
  maxRetries: 3,
  requireApproval: false,
  verbose: true,
};

// Planner 系统提示词
const PLANNER_SYSTEM_PROMPT = `你是一个智能任务规划助手（Planner），专门负责将用户的自然语言指令分解成具体的网页操作步骤。

## 你的角色
你是一个"规划者"，不直接执行操作，而是制定详细的执行计划，由另一个"执行者"（Navigator）来完成具体操作。

## 工作流程
1. 理解用户意图：分析用户想要完成什么任务
2. 分析页面状态：查看当前页面有哪些可交互元素
3. 制定计划：生成一系列具体、可执行的步骤
4. 评估反馈：根据执行结果调整计划

## 可用的操作类型
- click: 点击元素（按钮、链接、菜单项等）
- fill: 填写输入框
- select: 选择下拉框选项
- check: 勾选/取消勾选复选框
- scroll: 滚动页面（top/bottom/up/down）
- navigate: 导航到指定 URL
- press: 按键（Enter, Tab, Escape 等）
- wait: 等待页面加载或元素出现
- submit: 提交表单
- hover: 悬停在元素上
- extract: 提取页面内容

## 规划原则
1. 步骤要具体明确，每步只做一件事
2. 使用可靠的选择器（优先使用 ID、name、明确的类名）
3. 考虑页面加载时间，必要时添加等待步骤
4. 预判可能的错误，提供备选方案
5. 步骤数量控制在合理范围内（通常不超过 10 步）

## 响应格式
请返回 JSON 格式：
{
  "goal": "理解的任务目标",
  "reasoning": "分析和推理过程",
  "steps": [
    {
      "description": "人类可读的步骤说明",
      "action": {
        "type": "click|fill|scroll|...",
        "selector": "CSS选择器或元素描述",
        "value": "要输入的值（如适用）"
      }
    }
  ],
  "confidence": 0.8
}`;

// 评估反馈的提示词
const EVALUATE_FEEDBACK_PROMPT = `根据执行结果，评估当前任务进度并决定下一步行动。

## 原始目标
{goal}

## 已执行的步骤
{executedSteps}

## 最新执行结果
步骤：{stepDescription}
结果：{result}
成功：{success}
DOM变化：{domChanged}

## 当前页面元素
{currentDOM}

## 请评估并返回 JSON：
{
  "assessment": "对当前进度的评估",
  "shouldContinue": true/false,
  "shouldReplan": true/false,
  "nextStepIndex": 下一步的索引（如果继续）,
  "newSteps": [...] // 如果需要重新规划，提供新的步骤
  "isCompleted": true/false,
  "summary": "如果完成，提供总结"
}`;

/**
 * 生成唯一 ID
 */
function generateId(): string {
  return `plan_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Planner Agent 类
 */
class PlannerAgent {
  private config: PlannerConfig;

  constructor(config: Partial<PlannerConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * 更新配置
   */
  updateConfig(config: Partial<PlannerConfig>): void {
    this.config = { ...this.config, ...config };
    console.log('[Planner] 配置已更新:', this.config);
  }

  /**
   * 创建任务计划
   * 
   * @param instruction 用户指令
   * @param pageContext 页面上下文
   * @param dom 可交互元素列表
   */
  async createPlan(
    instruction: string,
    pageContext: { url: string; title: string },
    dom: InteractiveElement[]
  ): Promise<TaskPlanFull> {
    console.log('[Planner] 🎯 开始规划任务:', instruction);

    // 构建 DOM 摘要
    const domSummary = this.buildDOMSummary(dom);

    // 构建消息
    const messages: AIMessage[] = [
      {
        role: 'system',
        content: PLANNER_SYSTEM_PROMPT,
      },
      {
        role: 'user',
        content: `## 用户指令
${instruction}

## 当前页面信息
- URL: ${pageContext.url}
- 标题: ${pageContext.title}

## 页面可交互元素（前 ${dom.length > 50 ? 50 : dom.length} 个）
${domSummary}

请分析任务并生成执行计划。`,
      },
    ];

    try {
      // 调用 AI 生成计划
      let response = '';
      await aiService.chat(messages, (chunk) => {
        response += chunk;
      });

      // 解析响应
      const plannerResponse = this.parsePlannerResponse(response);

      // 创建完整的任务计划
      const plan: TaskPlanFull = {
        id: generateId(),
        instruction,
        goal: plannerResponse.goal,
        steps: plannerResponse.steps.map((step, index) => ({
          id: `step_${index}_${Date.now()}`,
          index,
          description: step.description,
          action: step.action,
          status: 'pending',
        })),
        currentStepIndex: 0,
        status: this.config.requireApproval ? 'draft' : 'approved',
        createdAt: Date.now(),
        updatedAt: Date.now(),
        totalRetries: 0,
        maxRetries: this.config.maxRetries,
      };

      console.log('[Planner] ✅ 计划创建完成:', {
        goal: plan.goal,
        stepsCount: plan.steps.length,
        status: plan.status,
      });

      return plan;
    } catch (error) {
      console.error('[Planner] ❌ 规划失败:', error);
      throw new Error(`规划失败: ${error instanceof Error ? error.message : '未知错误'}`);
    }
  }

  /**
   * 评估执行反馈并决定下一步
   */
  async evaluateFeedback(
    plan: TaskPlanFull,
    feedback: NavigatorFeedback,
    currentDOM: InteractiveElement[]
  ): Promise<{
    shouldContinue: boolean;
    shouldReplan: boolean;
    isCompleted: boolean;
    updatedPlan?: TaskPlanFull;
    summary?: string;
  }> {
    console.log('[Planner] 📊 评估执行反馈:', {
      stepId: feedback.stepId,
      success: feedback.success,
    });

    // 获取已执行的步骤
    const executedSteps = plan.steps
      .filter(s => s.status === 'success' || s.status === 'failed')
      .map(s => `${s.index + 1}. ${s.description} [${s.status}]`)
      .join('\n');

    // 获取当前步骤
    const currentStep = plan.steps.find(s => s.id === feedback.stepId);

    // 构建评估提示
    const prompt = EVALUATE_FEEDBACK_PROMPT
      .replace('{goal}', plan.goal)
      .replace('{executedSteps}', executedSteps || '无')
      .replace('{stepDescription}', currentStep?.description || '未知步骤')
      .replace('{result}', feedback.result)
      .replace('{success}', feedback.success.toString())
      .replace('{domChanged}', feedback.domChanged.toString())
      .replace('{currentDOM}', this.buildDOMSummary(currentDOM));

    const messages: AIMessage[] = [
      {
        role: 'system',
        content: '你是一个任务评估专家。根据执行反馈评估任务进度。',
      },
      {
        role: 'user',
        content: prompt,
      },
    ];

    try {
      let response = '';
      await aiService.chat(messages, (chunk) => {
        response += chunk;
      });

      // 解析评估结果
      const evaluation = this.parseEvaluationResponse(response);

      // 如果需要重新规划
      if (evaluation.shouldReplan && evaluation.newSteps) {
        const updatedPlan: TaskPlanFull = {
          ...plan,
          steps: [
            // 保留已完成的步骤
            ...plan.steps.filter(s => s.status === 'success'),
            // 添加新步骤
            ...evaluation.newSteps.map((step: { description: string; action: AgentAction }, index: number) => ({
              id: `step_replan_${index}_${Date.now()}`,
              index: plan.steps.filter(s => s.status === 'success').length + index,
              description: step.description,
              action: step.action,
              status: 'pending' as const,
            })),
          ],
          currentStepIndex: plan.steps.filter(s => s.status === 'success').length,
          totalRetries: plan.totalRetries + 1,
          updatedAt: Date.now(),
        };

        return {
          shouldContinue: true,
          shouldReplan: true,
          isCompleted: false,
          updatedPlan,
        };
      }

      // 如果任务完成
      if (evaluation.isCompleted) {
        return {
          shouldContinue: false,
          shouldReplan: false,
          isCompleted: true,
          summary: evaluation.summary,
        };
      }

      // 继续执行下一步
      return {
        shouldContinue: evaluation.shouldContinue,
        shouldReplan: false,
        isCompleted: false,
      };
    } catch (error) {
      console.error('[Planner] ❌ 评估失败:', error);
      
      // 评估失败时的默认行为：如果当前步骤成功，继续；否则停止
      return {
        shouldContinue: feedback.success,
        shouldReplan: false,
        isCompleted: false,
      };
    }
  }

  /**
   * 构建 DOM 摘要
   */
  private buildDOMSummary(dom: InteractiveElement[]): string {
    const elements = dom.slice(0, 50);
    
    return elements.map((el, index) => {
      const text = el.text.substring(0, 50);
      return `[${index}] ${el.type} - "${text}" (${el.selector})`;
    }).join('\n');
  }

  /**
   * 解析 Planner 响应
   */
  private parsePlannerResponse(response: string): PlannerResponse {
    try {
      // 尝试提取 JSON
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return {
          goal: parsed.goal || '完成用户任务',
          reasoning: parsed.reasoning || '',
          steps: parsed.steps || [],
          confidence: parsed.confidence || 0.5,
        };
      }
    } catch (error) {
      console.warn('[Planner] JSON 解析失败，尝试备用解析');
    }

    // 备用：返回空计划
    return {
      goal: '无法理解任务',
      reasoning: response,
      steps: [],
      confidence: 0,
    };
  }

  /**
   * 解析评估响应
   */
  private parseEvaluationResponse(response: string): {
    shouldContinue: boolean;
    shouldReplan: boolean;
    isCompleted: boolean;
    newSteps?: Array<{ description: string; action: AgentAction }>;
    summary?: string;
  } {
    try {
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return {
          shouldContinue: parsed.shouldContinue ?? true,
          shouldReplan: parsed.shouldReplan ?? false,
          isCompleted: parsed.isCompleted ?? false,
          newSteps: parsed.newSteps,
          summary: parsed.summary,
        };
      }
    } catch (error) {
      console.warn('[Planner] 评估响应解析失败');
    }

    // 默认：继续执行
    return {
      shouldContinue: true,
      shouldReplan: false,
      isCompleted: false,
    };
  }
}

// 导出单例
export const plannerAgent = new PlannerAgent();

// 导出类以便创建自定义实例
export { PlannerAgent };

