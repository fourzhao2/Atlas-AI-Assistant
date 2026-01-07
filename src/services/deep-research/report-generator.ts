/**
 * Report Generator - 研究报告生成器
 * 
 * 职责：
 * 1. 综合所有收集的信息
 * 2. 生成结构化的研究报告
 * 3. 添加引用标注
 * 4. 生成摘要和结论
 */

import type { AIMessage } from '@/types';
import type { 
  ResearchReport,
  ReportSection,
  ReportSource,
  ResearchPlan,
  InformationChunk,
  DeepResearchState,
} from '@/types/deep-research';
import { aiService } from '../ai-service';

// 报告生成提示词
const REPORT_PROMPT = `你是专业的研究报告撰写专家。根据收集的信息，生成一份高质量的研究报告。

## 研究问题
{question}

## 研究目标
{goal}

## 收集的信息（按来源分组）
{information}

## 报告要求
1. **专业性**: 保持客观、准确、有深度
2. **结构清晰**: 包含摘要、主要发现、详细分析、结论
3. **引用标注**: 每个结论都要标注来源，使用 [1], [2] 格式
4. **诚实透明**: 指出信息的局限性和不确定性
5. **可读性**: 使用 Markdown 格式，便于阅读

## 输出格式 (JSON)
{
  "title": "报告标题",
  "summary": "报告摘要（200-300字）",
  "sections": [
    {
      "title": "章节标题",
      "content": "章节内容（Markdown 格式，使用 [1] 等引用标注）",
      "citations": ["source_id_1", "source_id_2"]
    }
  ],
  "limitations": ["局限性1", "局限性2"],
  "conclusion": "总结性结论"
}

请确保引用标注与来源对应。`;

/**
 * 生成唯一 ID
 */
function generateId(prefix = 'report'): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Report Generator 类
 */
class ReportGenerator {
  
  /**
   * 生成研究报告
   * 
   * @param plan 研究计划
   * @param chunks 收集的所有信息块
   * @param state 研究状态
   */
  async generateReport(
    plan: ResearchPlan,
    chunks: InformationChunk[],
    state: DeepResearchState
  ): Promise<ResearchReport> {
    console.log('[ReportGenerator] 📝 开始生成研究报告');
    console.log(`[ReportGenerator] 信息块数量: ${chunks.length}`);

    // 构建来源列表
    const sources = this.buildSourceList(chunks);
    
    // 构建信息文本（带来源引用）
    const informationText = this.formatInformationWithSources(chunks, sources);

    // 构建提示
    const prompt = REPORT_PROMPT
      .replace('{question}', plan.refinedQuestion)
      .replace('{goal}', plan.goal)
      .replace('{information}', informationText);

    const messages: AIMessage[] = [
      { role: 'user', content: prompt },
    ];

    try {
      let response = '';
      await aiService.chat(messages, (chunk) => {
        response += chunk;
      });

      // 解析响应
      const parsed = this.parseReportResponse(response);

      // 构建完整报告
      const report: ResearchReport = {
        id: generateId('report'),
        title: parsed.title || `研究报告: ${plan.refinedQuestion}`,
        question: plan.refinedQuestion,
        summary: parsed.summary || '',
        sections: parsed.sections.map((s, index) => ({
          id: generateId('section'),
          title: s.title,
          content: s.content,
          citations: s.citations || [],
          order: index,
        })),
        sources,
        metadata: {
          totalSearches: state.iterations.reduce(
            (sum, it) => sum + it.searchTasks.length, 0
          ),
          totalPagesVisited: state.iterations.reduce(
            (sum, it) => sum + it.browseTasks.filter(t => t.status === 'completed').length, 0
          ),
          totalIterations: state.currentIteration,
          researchDuration: state.completedAt 
            ? state.completedAt - (state.startedAt || 0)
            : Date.now() - (state.startedAt || 0),
          infoChunksCollected: chunks.length,
        },
        limitations: parsed.limitations || [],
        generatedAt: Date.now(),
      };

      // 如果有结论，添加结论章节
      if (parsed.conclusion) {
        report.sections.push({
          id: generateId('section'),
          title: '结论',
          content: parsed.conclusion,
          citations: [],
          order: report.sections.length,
        });
      }

      console.log('[ReportGenerator] ✅ 报告生成完成');
      console.log(`[ReportGenerator] 章节数: ${report.sections.length}, 来源数: ${report.sources.length}`);

      return report;

    } catch (error) {
      console.error('[ReportGenerator] ❌ 报告生成失败:', error);
      
      // 返回简化报告
      return this.generateFallbackReport(plan, chunks, sources, state);
    }
  }

  /**
   * 构建来源列表
   */
  private buildSourceList(chunks: InformationChunk[]): ReportSource[] {
    const sourceMap = new Map<string, ReportSource>();
    let index = 1;

    for (const chunk of chunks) {
      if (!sourceMap.has(chunk.sourceUrl)) {
        sourceMap.set(chunk.sourceUrl, {
          id: `src_${index}`,
          index,
          title: chunk.sourceTitle,
          url: chunk.sourceUrl,
          accessedAt: chunk.extractedAt,
        });
        index++;
      }
    }

    return Array.from(sourceMap.values());
  }

  /**
   * 格式化信息（带来源引用）
   */
  private formatInformationWithSources(
    chunks: InformationChunk[],
    sources: ReportSource[]
  ): string {
    // 按来源分组
    const bySource = new Map<string, InformationChunk[]>();
    for (const chunk of chunks) {
      if (!bySource.has(chunk.sourceUrl)) {
        bySource.set(chunk.sourceUrl, []);
      }
      bySource.get(chunk.sourceUrl)!.push(chunk);
    }

    let text = '';
    for (const [url, sourceChunks] of bySource) {
      const source = sources.find(s => s.url === url);
      if (!source) continue;

      text += `### [${source.index}] ${source.title}\n`;
      text += `URL: ${source.url}\n\n`;
      
      for (const chunk of sourceChunks) {
        text += `- ${chunk.content}\n`;
      }
      text += '\n';
    }

    return text;
  }

  /**
   * 解析报告响应
   */
  private parseReportResponse(response: string): {
    title?: string;
    summary?: string;
    sections: Array<{ title: string; content: string; citations?: string[] }>;
    limitations?: string[];
    conclusion?: string;
  } {
    try {
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return {
          title: parsed.title,
          summary: parsed.summary,
          sections: Array.isArray(parsed.sections) ? parsed.sections : [],
          limitations: parsed.limitations,
          conclusion: parsed.conclusion,
        };
      }
    } catch (error) {
      console.warn('[ReportGenerator] JSON 解析失败，尝试提取 Markdown');
    }

    // 备用：从 Markdown 格式提取
    return this.parseMarkdownReport(response);
  }

  /**
   * 从 Markdown 格式提取报告结构
   */
  private parseMarkdownReport(markdown: string): {
    title?: string;
    summary?: string;
    sections: Array<{ title: string; content: string; citations?: string[] }>;
    limitations?: string[];
    conclusion?: string;
  } {
    const sections: Array<{ title: string; content: string; citations?: string[] }> = [];
    
    // 简单的 Markdown 解析
    const lines = markdown.split('\n');
    let currentSection: { title: string; content: string } | null = null;
    let title: string | undefined;
    let summary: string | undefined;

    for (const line of lines) {
      // 一级标题作为报告标题
      if (line.startsWith('# ') && !title) {
        title = line.substring(2).trim();
        continue;
      }

      // 二级标题作为章节
      if (line.startsWith('## ')) {
        if (currentSection) {
          sections.push(currentSection);
        }
        currentSection = {
          title: line.substring(3).trim(),
          content: '',
        };
        continue;
      }

      // 添加内容到当前章节
      if (currentSection) {
        currentSection.content += line + '\n';
      } else if (!summary) {
        // 第一段作为摘要
        if (line.trim()) {
          summary = (summary || '') + line + '\n';
        }
      }
    }

    // 添加最后一个章节
    if (currentSection) {
      sections.push(currentSection);
    }

    return { title, summary, sections };
  }

  /**
   * 生成备用报告（当 AI 解析失败时）
   */
  private generateFallbackReport(
    plan: ResearchPlan,
    chunks: InformationChunk[],
    sources: ReportSource[],
    state: DeepResearchState
  ): ResearchReport {
    console.log('[ReportGenerator] 使用备用报告生成');

    // 按子问题组织信息
    const sectionsBySubQ: ReportSection[] = plan.subQuestions.map((sq, index) => {
      const sqChunks = chunks.filter(c => c.subQuestionId === sq.id);
      let content = '';
      
      if (sqChunks.length > 0) {
        content = sqChunks.map(c => {
          const source = sources.find(s => s.url === c.sourceUrl);
          return `- ${c.content}${source ? ` [${source.index}]` : ''}`;
        }).join('\n\n');
      } else {
        content = '*暂无相关信息*';
      }

      return {
        id: generateId('section'),
        title: sq.question,
        content,
        citations: sqChunks.map(c => {
          const source = sources.find(s => s.url === c.sourceUrl);
          return source?.id || '';
        }).filter(Boolean),
        order: index,
      };
    });

    // 生成摘要
    const summary = `本研究针对"${plan.refinedQuestion}"进行了调研，` +
      `共收集了 ${chunks.length} 条信息，来自 ${sources.length} 个来源。` +
      `研究涵盖了 ${plan.subQuestions.length} 个子问题。`;

    return {
      id: generateId('report'),
      title: `研究报告: ${plan.refinedQuestion}`,
      question: plan.refinedQuestion,
      summary,
      sections: sectionsBySubQ,
      sources,
      metadata: {
        totalSearches: state.iterations.reduce(
          (sum, it) => sum + it.searchTasks.length, 0
        ),
        totalPagesVisited: state.iterations.reduce(
          (sum, it) => sum + it.browseTasks.filter(t => t.status === 'completed').length, 0
        ),
        totalIterations: state.currentIteration,
        researchDuration: Date.now() - (state.startedAt || 0),
        infoChunksCollected: chunks.length,
      },
      limitations: [
        '本报告基于有限的网络搜索结果',
        '信息可能不够全面或存在偏差',
        '建议进一步验证关键信息',
      ],
      generatedAt: Date.now(),
    };
  }

  /**
   * 将报告导出为 Markdown 格式
   */
  exportAsMarkdown(report: ResearchReport): string {
    let md = `# ${report.title}\n\n`;
    md += `> ${report.summary}\n\n`;
    md += `---\n\n`;

    // 研究信息
    md += `## 研究概览\n\n`;
    md += `- **研究问题**: ${report.question}\n`;
    md += `- **搜索次数**: ${report.metadata.totalSearches}\n`;
    md += `- **访问页面**: ${report.metadata.totalPagesVisited}\n`;
    md += `- **迭代次数**: ${report.metadata.totalIterations}\n`;
    md += `- **收集信息**: ${report.metadata.infoChunksCollected} 条\n`;
    md += `- **研究耗时**: ${Math.round(report.metadata.researchDuration / 1000)} 秒\n\n`;

    // 章节内容
    for (const section of report.sections) {
      md += `## ${section.title}\n\n`;
      md += `${section.content}\n\n`;
    }

    // 局限性
    if (report.limitations.length > 0) {
      md += `## 研究局限性\n\n`;
      for (const lim of report.limitations) {
        md += `- ${lim}\n`;
      }
      md += '\n';
    }

    // 参考来源
    md += `## 参考来源\n\n`;
    for (const source of report.sources) {
      md += `[${source.index}] ${source.title}\n`;
      md += `    ${source.url}\n\n`;
    }

    // 生成时间
    md += `---\n\n`;
    md += `*报告生成时间: ${new Date(report.generatedAt).toLocaleString('zh-CN')}*\n`;

    return md;
  }

  /**
   * 格式化报告为聊天消息
   */
  formatReportAsMessage(report: ResearchReport): string {
    let text = `# 📊 ${report.title}\n\n`;
    text += `> ${report.summary}\n\n`;

    // 章节
    for (const section of report.sections) {
      text += `## ${section.title}\n\n`;
      text += `${section.content}\n\n`;
    }

    // 来源
    if (report.sources.length > 0) {
      text += `---\n\n`;
      text += `### 📚 参考来源\n\n`;
      for (const source of report.sources.slice(0, 10)) {
        text += `[${source.index}] [${source.title}](${source.url})\n`;
      }
      if (report.sources.length > 10) {
        text += `\n*...还有 ${report.sources.length - 10} 个来源*\n`;
      }
    }

    // 元数据
    text += `\n---\n\n`;
    text += `📈 **研究统计**: `;
    text += `${report.metadata.totalIterations} 次迭代 | `;
    text += `${report.metadata.totalPagesVisited} 个页面 | `;
    text += `${report.metadata.infoChunksCollected} 条信息 | `;
    text += `耗时 ${Math.round(report.metadata.researchDuration / 1000)} 秒\n`;

    return text;
  }
}

// 导出单例
export const reportGenerator = new ReportGenerator();

// 导出类
export { ReportGenerator };

