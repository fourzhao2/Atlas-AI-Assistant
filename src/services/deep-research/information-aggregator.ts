/**
 * Information Aggregator - 信息聚合器
 * 
 * 职责：
 * 1. 整合从多个来源收集的信息
 * 2. 提取关键信息块
 * 3. 评估信息覆盖度
 * 4. 交叉验证信息可信度
 * 5. 识别信息缺口
 */

import type { AIMessage } from '@/types';
import type { 
  InformationChunk, 
  ResearchPlan,
  ResearchEvaluation,
  BrowseTask,
} from '@/types/deep-research';
import { aiService } from '../ai-service';

// 信息分析提示词
const ANALYZE_PROMPT = `你是信息提取专家。从给定的网页内容中提取与研究问题相关的关键信息。

## 研究问题
{question}

## 子问题
{subQuestion}

## 网页内容
标题: {title}
URL: {url}
内容:
{content}

## 任务
1. 提取与研究问题相关的关键信息点
2. 评估信息的相关性 (0-1)
3. 评估信息的可信度 (0-1)
4. 忽略广告、导航等无关内容

## 输出格式 (JSON)
{
  "chunks": [
    {
      "content": "提取的关键信息（保持原文的准确性）",
      "relevance": 0.9,
      "credibility": 0.8
    }
  ],
  "pageSummary": "页面内容简要总结"
}

如果页面内容与研究问题无关，返回空的 chunks 数组。`;

// 评估提示词
const EVALUATE_PROMPT = `你是研究进度评估专家。评估当前收集的信息是否足够回答研究问题。

## 研究问题
{question}

## 研究目标
{goal}

## 子问题及其状态
{subQuestions}

## 已收集的信息
{collectedInfo}

## 任务
1. 评估信息覆盖度 (0-100)
2. 判断信息是否充足
3. 识别信息缺口
4. 提供后续建议

## 输出格式 (JSON)
{
  "coverageScore": 75,
  "isComplete": false,
  "gaps": ["尚未覆盖的方面1", "缺少的信息2"],
  "nextSearches": ["建议搜索的关键词1", "建议搜索的关键词2"],
  "keyFindings": ["主要发现1", "主要发现2", "主要发现3"],
  "recommendation": "continue|complete|pivot",
  "reasoning": "评估理由说明"
}

recommendation 说明:
- continue: 继续当前研究方向
- complete: 信息已充足，可以生成报告
- pivot: 需要调整研究方向`;

/**
 * 生成唯一 ID
 */
function generateId(prefix = 'chunk'): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Information Aggregator 类
 */
class InformationAggregator {
  
  /**
   * 分析页面内容，提取信息块
   * 
   * @param task 浏览任务（包含页面内容）
   * @param plan 研究计划
   * @param subQuestionId 当前子问题 ID
   */
  async analyzePageContent(
    task: BrowseTask,
    plan: ResearchPlan,
    subQuestionId?: string
  ): Promise<InformationChunk[]> {
    console.log('[InfoAggregator] 📊 分析页面:', task.title);

    if (!task.content || task.content.length < 100) {
      console.log('[InfoAggregator] 页面内容过短，跳过');
      return [];
    }

    // 找到对应的子问题
    const subQuestion = subQuestionId 
      ? plan.subQuestions.find(sq => sq.id === subQuestionId)
      : plan.subQuestions[0];

    // 构建提示
    const prompt = ANALYZE_PROMPT
      .replace('{question}', plan.refinedQuestion)
      .replace('{subQuestion}', subQuestion?.question || '')
      .replace('{title}', task.title)
      .replace('{url}', task.url)
      .replace('{content}', this.truncateContent(task.content, 8000));

    const messages: AIMessage[] = [
      { role: 'user', content: prompt },
    ];

    try {
      let response = '';
      await aiService.chat(messages, (chunk) => {
        response += chunk;
      });

      const parsed = this.parseAnalyzeResponse(response);
      
      // 转换为 InformationChunk
      const chunks: InformationChunk[] = parsed.chunks.map(c => ({
        id: generateId('chunk'),
        content: c.content,
        sourceUrl: task.url,
        sourceTitle: task.title,
        relevance: c.relevance,
        credibility: c.credibility,
        extractedAt: Date.now(),
        subQuestionId,
      }));

      console.log(`[InfoAggregator] ✅ 提取了 ${chunks.length} 个信息块`);
      return chunks;

    } catch (error) {
      console.error('[InfoAggregator] ❌ 分析失败:', error);
      return [];
    }
  }

  /**
   * 评估研究进度
   * 
   * @param plan 研究计划
   * @param allChunks 所有收集的信息块
   */
  async evaluateProgress(
    plan: ResearchPlan,
    allChunks: InformationChunk[]
  ): Promise<ResearchEvaluation> {
    console.log('[InfoAggregator] 📊 评估研究进度');
    console.log(`[InfoAggregator] 总信息块: ${allChunks.length}`);

    // 如果信息过少，直接返回继续
    if (allChunks.length < 3) {
      return {
        coverageScore: Math.min(allChunks.length * 15, 30),
        isComplete: false,
        gaps: ['需要更多信息'],
        nextSearches: plan.subQuestions
          .filter(sq => sq.status === 'pending')
          .flatMap(sq => sq.searchQueries.slice(0, 2)),
        keyFindings: allChunks.map(c => c.content.substring(0, 100)),
        recommendation: 'continue',
        reasoning: '收集的信息过少，需要继续研究',
      };
    }

    // 构建子问题状态
    const subQuestionsStatus = plan.subQuestions.map(sq => {
      const findings = allChunks.filter(c => c.subQuestionId === sq.id);
      return `- ${sq.question} [${sq.status}]: ${findings.length} 条信息`;
    }).join('\n');

    // 构建已收集信息摘要
    const collectedInfo = allChunks
      .sort((a, b) => b.relevance - a.relevance)
      .slice(0, 20)
      .map((c, i) => `${i + 1}. [相关度:${c.relevance}] ${c.content.substring(0, 200)}`)
      .join('\n\n');

    // 构建提示
    const prompt = EVALUATE_PROMPT
      .replace('{question}', plan.refinedQuestion)
      .replace('{goal}', plan.goal)
      .replace('{subQuestions}', subQuestionsStatus)
      .replace('{collectedInfo}', collectedInfo);

    const messages: AIMessage[] = [
      { role: 'user', content: prompt },
    ];

    try {
      let response = '';
      await aiService.chat(messages, (chunk) => {
        response += chunk;
      });

      const evaluation = this.parseEvaluateResponse(response);
      console.log('[InfoAggregator] ✅ 评估完成:', {
        coverageScore: evaluation.coverageScore,
        isComplete: evaluation.isComplete,
        recommendation: evaluation.recommendation,
      });

      return evaluation;

    } catch (error) {
      console.error('[InfoAggregator] ❌ 评估失败:', error);
      
      // 返回默认评估
      return {
        coverageScore: Math.min(allChunks.length * 10, 60),
        isComplete: false,
        gaps: ['评估过程出错'],
        nextSearches: [],
        keyFindings: [],
        recommendation: 'continue',
        reasoning: '评估过程出错，建议继续研究',
      };
    }
  }

  /**
   * 合并信息块（去重）
   */
  mergeChunks(chunks: InformationChunk[]): InformationChunk[] {
    const seen = new Set<string>();
    const merged: InformationChunk[] = [];

    for (const chunk of chunks) {
      // 使用内容的 hash 进行去重
      const key = this.hashContent(chunk.content);
      if (!seen.has(key)) {
        seen.add(key);
        merged.push(chunk);
      }
    }

    // 按相关度排序
    merged.sort((a, b) => b.relevance - a.relevance);

    return merged;
  }

  /**
   * 按子问题分组信息
   */
  groupBySubQuestion(
    chunks: InformationChunk[],
    plan: ResearchPlan
  ): Map<string, InformationChunk[]> {
    const groups = new Map<string, InformationChunk[]>();

    // 初始化所有子问题的分组
    for (const sq of plan.subQuestions) {
      groups.set(sq.id, []);
    }
    groups.set('other', []); // 未分类

    // 分组
    for (const chunk of chunks) {
      const groupId = chunk.subQuestionId || 'other';
      const group = groups.get(groupId) || groups.get('other')!;
      group.push(chunk);
    }

    return groups;
  }

  /**
   * 计算信息统计
   */
  getStatistics(chunks: InformationChunk[]): {
    totalChunks: number;
    averageRelevance: number;
    averageCredibility: number;
    uniqueSources: number;
  } {
    if (chunks.length === 0) {
      return {
        totalChunks: 0,
        averageRelevance: 0,
        averageCredibility: 0,
        uniqueSources: 0,
      };
    }

    const sources = new Set(chunks.map(c => c.sourceUrl));
    const avgRelevance = chunks.reduce((sum, c) => sum + c.relevance, 0) / chunks.length;
    const avgCredibility = chunks.reduce((sum, c) => sum + c.credibility, 0) / chunks.length;

    return {
      totalChunks: chunks.length,
      averageRelevance: Math.round(avgRelevance * 100) / 100,
      averageCredibility: Math.round(avgCredibility * 100) / 100,
      uniqueSources: sources.size,
    };
  }

  /**
   * 截断内容
   */
  private truncateContent(content: string, maxLength: number): string {
    if (content.length <= maxLength) {
      return content;
    }
    return content.substring(0, maxLength) + '...(内容已截断)';
  }

  /**
   * 内容 hash（用于去重）
   */
  private hashContent(content: string): string {
    // 简化的 hash：取关键词
    const normalized = content
      .toLowerCase()
      .replace(/\s+/g, ' ')
      .trim()
      .substring(0, 200);
    return normalized;
  }

  /**
   * 解析分析响应
   */
  private parseAnalyzeResponse(response: string): {
    chunks: Array<{ content: string; relevance: number; credibility: number }>;
    pageSummary?: string;
  } {
    try {
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return {
          chunks: Array.isArray(parsed.chunks) ? parsed.chunks : [],
          pageSummary: parsed.pageSummary,
        };
      }
    } catch (error) {
      console.warn('[InfoAggregator] JSON 解析失败');
    }

    return { chunks: [] };
  }

  /**
   * 解析评估响应
   */
  private parseEvaluateResponse(response: string): ResearchEvaluation {
    try {
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return {
          coverageScore: parsed.coverageScore ?? 50,
          isComplete: parsed.isComplete ?? false,
          gaps: Array.isArray(parsed.gaps) ? parsed.gaps : [],
          nextSearches: Array.isArray(parsed.nextSearches) ? parsed.nextSearches : [],
          keyFindings: Array.isArray(parsed.keyFindings) ? parsed.keyFindings : [],
          recommendation: parsed.recommendation ?? 'continue',
          reasoning: parsed.reasoning ?? '',
        };
      }
    } catch (error) {
      console.warn('[InfoAggregator] 评估响应解析失败');
    }

    return {
      coverageScore: 50,
      isComplete: false,
      gaps: [],
      nextSearches: [],
      keyFindings: [],
      recommendation: 'continue',
      reasoning: '无法解析评估结果',
    };
  }

  /**
   * 格式化信息块为可读文本
   */
  formatChunksAsText(chunks: InformationChunk[]): string {
    if (chunks.length === 0) {
      return '暂无收集的信息';
    }

    let text = `### 📝 收集的信息 (${chunks.length} 条)\n\n`;

    // 按来源分组
    const bySource = new Map<string, InformationChunk[]>();
    for (const chunk of chunks) {
      const source = chunk.sourceTitle || chunk.sourceUrl;
      if (!bySource.has(source)) {
        bySource.set(source, []);
      }
      bySource.get(source)!.push(chunk);
    }

    let sourceIndex = 1;
    for (const [source, sourceChunks] of bySource) {
      text += `**来源 ${sourceIndex}: ${source}**\n`;
      for (const chunk of sourceChunks) {
        text += `- ${chunk.content.substring(0, 200)}${chunk.content.length > 200 ? '...' : ''}\n`;
      }
      text += '\n';
      sourceIndex++;
    }

    return text;
  }

  /**
   * 格式化评估结果为可读文本
   */
  formatEvaluationAsText(evaluation: ResearchEvaluation): string {
    let text = `### 📊 研究进度评估\n\n`;
    text += `**覆盖度**: ${evaluation.coverageScore}%\n`;
    text += `**状态**: ${evaluation.isComplete ? '✅ 信息充足' : '🔄 继续研究'}\n`;
    text += `**建议**: ${this.getRecommendationLabel(evaluation.recommendation)}\n\n`;

    if (evaluation.keyFindings.length > 0) {
      text += `**主要发现**:\n`;
      evaluation.keyFindings.forEach((f, i) => {
        text += `${i + 1}. ${f}\n`;
      });
      text += '\n';
    }

    if (evaluation.gaps.length > 0) {
      text += `**信息缺口**:\n`;
      evaluation.gaps.forEach((g, i) => {
        text += `${i + 1}. ${g}\n`;
      });
      text += '\n';
    }

    if (evaluation.reasoning) {
      text += `**评估说明**: ${evaluation.reasoning}\n`;
    }

    return text;
  }

  private getRecommendationLabel(rec: string): string {
    switch (rec) {
      case 'continue': return '继续研究';
      case 'complete': return '可以生成报告';
      case 'pivot': return '调整研究方向';
      default: return rec;
    }
  }
}

// 导出单例
export const informationAggregator = new InformationAggregator();

// 导出类
export { InformationAggregator };

