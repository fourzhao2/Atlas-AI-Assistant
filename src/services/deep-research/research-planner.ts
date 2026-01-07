/**
 * Research Planner - 研究规划器
 * 
 * 职责：
 * 1. 分析用户的研究问题
 * 2. 将大问题分解为可搜索的子问题
 * 3. 为每个子问题生成搜索关键词
 * 4. 规划研究策略和深度
 */

import type { AIMessage } from '@/types';
import type { 
  ResearchPlan, 
  ResearchSubQuestion,
  DeepResearchConfig,
} from '@/types/deep-research';
import { aiService } from '../ai-service';

// Planner 系统提示词
const PLANNER_SYSTEM_PROMPT = `你是一个专业的研究规划专家。你的任务是分析用户的研究问题，并生成结构化的研究计划。

## 你的职责
1. 理解用户问题的核心意图
2. 将复杂问题分解为 3-5 个可独立研究的子问题
3. 为每个子问题设计有效的搜索关键词
4. 评估研究所需的深度

## 分解原则
- 子问题应该相互独立，覆盖问题的不同方面
- 每个子问题应该可以通过网络搜索找到答案
- 优先考虑最关键、最有价值的子问题
- 搜索词要具体、明确，避免过于宽泛

## 输出格式
请严格按照以下 JSON 格式输出：
{
  "refinedQuestion": "优化后的研究问题（更清晰、更具体）",
  "goal": "研究目标（简洁描述预期产出）",
  "reasoning": "规划思路说明",
  "subQuestions": [
    {
      "question": "子问题1",
      "priority": 5,
      "searchQueries": ["搜索词1", "搜索词2", "搜索词3"]
    },
    {
      "question": "子问题2", 
      "priority": 4,
      "searchQueries": ["搜索词1", "搜索词2"]
    }
  ],
  "depth": "shallow|medium|deep"
}

priority 范围 1-5，5 为最高优先级。
depth: shallow(快速了解), medium(中等深度), deep(深入研究)`;

/**
 * 生成唯一 ID
 */
function generateId(prefix = 'plan'): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Research Planner 类
 */
class ResearchPlanner {
  private config: DeepResearchConfig;

  constructor(config?: Partial<DeepResearchConfig>) {
    this.config = {
      maxIterations: 3,
      maxPagesPerIteration: 3,
      searchDepth: 'medium',
      preferredEngines: ['google', 'bing'],
      interactiveMode: true,
      requirePlanApproval: true,
      requireSearchApproval: false,
      requirePageApproval: true,
      language: 'auto',
      verbose: true,
      ...config,
    };
  }

  /**
   * 更新配置
   */
  updateConfig(config: Partial<DeepResearchConfig>): void {
    this.config = { ...this.config, ...config };
    console.log('[ResearchPlanner] 配置已更新');
  }

  /**
   * 创建研究计划
   * 
   * @param question 用户的研究问题
   * @param context 额外上下文（可选）
   */
  async createPlan(
    question: string, 
    context?: { pageTitle?: string; pageUrl?: string }
  ): Promise<ResearchPlan> {
    console.log('[ResearchPlanner] 🎯 开始规划研究:', question);

    // 构建消息
    const messages: AIMessage[] = [
      {
        role: 'system',
        content: PLANNER_SYSTEM_PROMPT,
      },
      {
        role: 'user',
        content: this.buildPlannerPrompt(question, context),
      },
    ];

    try {
      // 调用 AI 生成计划
      let response = '';
      await aiService.chat(messages, (chunk) => {
        response += chunk;
      });

      // 解析响应
      const parsed = this.parsePlannerResponse(response);

      // 构建完整的研究计划
      const plan: ResearchPlan = {
        id: generateId('plan'),
        originalQuestion: question,
        refinedQuestion: parsed.refinedQuestion || question,
        goal: parsed.goal || '完成用户的研究请求',
        reasoning: parsed.reasoning || '',
        subQuestions: parsed.subQuestions.map((sq, index) => ({
          id: generateId('sq'),
          question: sq.question,
          priority: sq.priority || (5 - index),
          status: 'pending' as const,
          searchQueries: sq.searchQueries || [],
          findings: [],
        })),
        searchStrategy: {
          depth: parsed.depth || this.config.searchDepth,
          maxIterations: this.config.maxIterations,
          maxPagesPerIteration: this.config.maxPagesPerIteration,
          preferredEngines: this.config.preferredEngines,
        },
        status: this.config.requirePlanApproval ? 'draft' : 'approved',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      // 按优先级排序子问题
      plan.subQuestions.sort((a, b) => b.priority - a.priority);

      console.log('[ResearchPlanner] ✅ 计划创建完成:', {
        goal: plan.goal,
        subQuestions: plan.subQuestions.length,
        depth: plan.searchStrategy.depth,
      });

      return plan;
    } catch (error) {
      console.error('[ResearchPlanner] ❌ 规划失败:', error);
      throw new Error(`研究规划失败: ${error instanceof Error ? error.message : '未知错误'}`);
    }
  }

  /**
   * 根据评估结果更新计划
   */
  async refinePlan(
    plan: ResearchPlan,
    evaluation: { gaps: string[]; nextSearches: string[] }
  ): Promise<ResearchPlan> {
    console.log('[ResearchPlanner] 🔄 根据评估结果优化计划');

    // 如果有信息缺口，添加新的子问题
    if (evaluation.gaps.length > 0) {
      const newSubQuestions: ResearchSubQuestion[] = evaluation.gaps.map((gap, index) => ({
        id: generateId('sq'),
        question: gap,
        priority: 3, // 中等优先级
        status: 'pending' as const,
        searchQueries: evaluation.nextSearches.slice(index * 2, index * 2 + 2),
        findings: [],
      }));

      plan.subQuestions.push(...newSubQuestions);
      plan.updatedAt = Date.now();
    }

    return plan;
  }

  /**
   * 构建 Planner 提示词
   */
  private buildPlannerPrompt(question: string, context?: { pageTitle?: string; pageUrl?: string }): string {
    let prompt = `## 研究问题\n${question}\n\n`;

    if (context?.pageTitle || context?.pageUrl) {
      prompt += `## 上下文\n`;
      if (context.pageTitle) {
        prompt += `- 当前页面标题: ${context.pageTitle}\n`;
      }
      if (context.pageUrl) {
        prompt += `- 当前页面 URL: ${context.pageUrl}\n`;
      }
      prompt += '\n';
    }

    prompt += `## 语言偏好\n`;
    if (this.config.language === 'zh') {
      prompt += '请优先使用中文搜索词，研究中文资料。\n';
    } else if (this.config.language === 'en') {
      prompt += '请优先使用英文搜索词，研究英文资料。\n';
    } else {
      prompt += '根据问题内容自动选择合适的语言。\n';
    }

    prompt += `\n## 要求\n`;
    prompt += `- 生成 3-5 个子问题\n`;
    prompt += `- 每个子问题提供 2-3 个搜索关键词\n`;
    prompt += `- 请输出 JSON 格式\n`;

    return prompt;
  }

  /**
   * 解析 Planner 响应
   */
  private parsePlannerResponse(response: string): {
    refinedQuestion?: string;
    goal?: string;
    reasoning?: string;
    subQuestions: Array<{
      question: string;
      priority?: number;
      searchQueries?: string[];
    }>;
    depth?: 'shallow' | 'medium' | 'deep';
  } {
    try {
      // 尝试提取 JSON
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return {
          refinedQuestion: parsed.refinedQuestion,
          goal: parsed.goal,
          reasoning: parsed.reasoning,
          subQuestions: Array.isArray(parsed.subQuestions) ? parsed.subQuestions : [],
          depth: parsed.depth,
        };
      }
    } catch (error) {
      console.warn('[ResearchPlanner] JSON 解析失败，尝试备用解析:', error);
    }

    // 备用：尝试从文本中提取信息
    console.warn('[ResearchPlanner] 使用备用解析策略');
    return {
      subQuestions: this.extractSubQuestionsFromText(response),
      depth: 'medium',
    };
  }

  /**
   * 从文本中提取子问题（备用解析）
   */
  private extractSubQuestionsFromText(text: string): Array<{
    question: string;
    priority?: number;
    searchQueries?: string[];
  }> {
    const questions: Array<{ question: string; priority?: number; searchQueries?: string[] }> = [];
    
    // 尝试匹配编号列表
    const listPattern = /(?:\d+[.、]|[-*])\s*(.+)/g;
    let match;
    
    while ((match = listPattern.exec(text)) !== null) {
      const questionText = match[1].trim();
      if (questionText.length > 5 && questionText.length < 200) {
        questions.push({
          question: questionText,
          searchQueries: [questionText],
        });
      }
      
      if (questions.length >= 5) break;
    }

    // 如果没找到，使用原问题
    if (questions.length === 0) {
      questions.push({
        question: '深入了解该主题',
        searchQueries: [],
      });
    }

    return questions;
  }

  /**
   * 格式化计划为可读文本
   */
  formatPlanAsText(plan: ResearchPlan): string {
    let text = `## 📋 研究计划\n\n`;
    text += `**研究问题**: ${plan.refinedQuestion}\n\n`;
    text += `**研究目标**: ${plan.goal}\n\n`;
    
    if (plan.reasoning) {
      text += `**规划思路**: ${plan.reasoning}\n\n`;
    }

    text += `### 研究子问题\n\n`;
    plan.subQuestions.forEach((sq, index) => {
      const priorityStars = '⭐'.repeat(sq.priority);
      text += `${index + 1}. **${sq.question}** ${priorityStars}\n`;
      text += `   搜索词: ${sq.searchQueries.join(', ')}\n\n`;
    });

    text += `### 研究策略\n`;
    text += `- 深度: ${this.getDepthLabel(plan.searchStrategy.depth)}\n`;
    text += `- 最大迭代: ${plan.searchStrategy.maxIterations} 次\n`;
    text += `- 每次访问页面: ${plan.searchStrategy.maxPagesPerIteration} 个\n`;

    return text;
  }

  /**
   * 获取深度标签
   */
  private getDepthLabel(depth: 'shallow' | 'medium' | 'deep'): string {
    switch (depth) {
      case 'shallow': return '浅层（快速了解）';
      case 'medium': return '中等（常规研究）';
      case 'deep': return '深入（详尽研究）';
    }
  }
}

// 导出单例
export const researchPlanner = new ResearchPlanner();

// 导出类以便创建自定义实例
export { ResearchPlanner };

