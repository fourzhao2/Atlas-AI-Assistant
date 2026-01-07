/**
 * DeepResearch Agent - 深度研究智能体主控制器
 * 
 * 实现 IterResearch 迭代研究范式
 * 协调 Planner、Searcher、Aggregator、Reporter 的工作
 * 
 * 工作流程：
 * 1. Planning: 规划研究策略
 * 2. IterResearch Loop:
 *    - Searching: 搜索信息
 *    - Browsing: 浏览页面
 *    - Analyzing: 分析内容
 *    - Evaluating: 评估进度
 * 3. Generating: 生成报告
 */

import type { AIMessage } from '@/types';
import type {
  DeepResearchPhase,
  DeepResearchState,
  DeepResearchConfig,
  DeepResearchCallbacks,
  DeepResearchResult,
  ResearchIteration,
  PendingAction,
  BrowseTask,
} from '@/types/deep-research';
import { DEFAULT_DEEP_RESEARCH_CONFIG } from '@/types/deep-research';
import { researchPlanner } from './research-planner';
import { webSearcher } from './web-searcher';
import { informationAggregator } from './information-aggregator';
import { reportGenerator } from './report-generator';
import { getPageContent } from '@/utils/messaging';

/**
 * 生成唯一 ID
 */
function generateId(prefix = 'dr'): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * DeepResearch Agent 类
 */
class DeepResearchAgent {
  private config: DeepResearchConfig;
  private state: DeepResearchState;
  private callbacks: DeepResearchCallbacks;
  private abortController: AbortController | null = null;
  private pendingResolve: ((value: string) => void) | null = null;

  constructor(config?: Partial<DeepResearchConfig>) {
    this.config = { ...DEFAULT_DEEP_RESEARCH_CONFIG, ...config };
    this.state = this.createInitialState();
    this.callbacks = {};
  }

  /**
   * 创建初始状态
   */
  private createInitialState(): DeepResearchState {
    return {
      phase: 'idle',
      plan: null,
      iterations: [],
      currentIteration: 0,
      allChunks: [],
      evaluation: null,
      report: null,
      progress: {
        current: 0,
        total: 0,
        percentage: 0,
        currentTask: '',
        iteration: 0,
        maxIterations: this.config.maxIterations,
      },
      pendingAction: null,
      messages: [],
      isRunning: false,
    };
  }

  /**
   * 更新配置
   */
  updateConfig(config: Partial<DeepResearchConfig>): void {
    this.config = { ...this.config, ...config };
    console.log('[DeepResearch] 配置已更新');
  }

  /**
   * 设置回调
   */
  setCallbacks(callbacks: DeepResearchCallbacks): void {
    this.callbacks = callbacks;
  }

  /**
   * 获取当前状态
   */
  getState(): DeepResearchState {
    return { ...this.state };
  }

  /**
   * 执行深度研究
   * 
   * @param question 研究问题
   */
  async research(question: string): Promise<DeepResearchResult> {
    console.log('[DeepResearch] 🚀 开始深度研究:', question);

    // 重置状态
    this.state = this.createInitialState();
    this.state.isRunning = true;
    this.state.startedAt = Date.now();
    this.abortController = new AbortController();

    // 更新进度
    this.updateProgress(0, 100, '初始化研究...');

    try {
      // ========================================
      // Phase 1: Planning (规划)
      // ========================================
      this.setPhase('planning');
      this.addMessage({
        role: 'user',
        content: question,
        timestamp: Date.now(),
      });
      this.addMessage({
        role: 'assistant',
        content: '🎯 **开始规划研究策略...**\n\n正在分析您的问题并制定研究计划。',
        timestamp: Date.now(),
      });

      // 获取当前页面上下文
      let pageContext: { pageTitle?: string; pageUrl?: string } = {};
      try {
        const pageResponse = await getPageContent();
        if (pageResponse.success && pageResponse.data) {
          const data = pageResponse.data as { title: string; url: string };
          pageContext = { pageTitle: data.title, pageUrl: data.url };
        }
      } catch {
        console.log('[DeepResearch] 无法获取页面上下文');
      }

      // 创建研究计划
      const plan = await researchPlanner.createPlan(question, pageContext);
      this.state.plan = plan;
      this.callbacks.onPlanCreated?.(plan);

      this.addMessage({
        role: 'assistant',
        content: researchPlanner.formatPlanAsText(plan),
        timestamp: Date.now(),
      });

      // 如果需要用户确认计划
      if (this.config.requirePlanApproval) {
        const approved = await this.waitForUserAction({
          type: 'approve_plan',
          description: '请确认研究计划是否合适',
          options: [
            { label: '✅ 开始研究', value: 'approve', description: '按照计划开始研究' },
            { label: '❌ 取消', value: 'cancel', description: '取消本次研究' },
          ],
        });

        if (approved !== 'approve') {
          throw new Error('用户取消了研究');
        }

        plan.status = 'approved';
      }

      plan.status = 'executing';
      this.updateProgress(10, 100, '计划已确认，开始研究...');

      // ========================================
      // Phase 2-5: IterResearch Loop (迭代研究)
      // ========================================
      let iterationIndex = 0;
      const maxIterations = plan.searchStrategy.maxIterations;

      while (iterationIndex < maxIterations && this.state.isRunning) {
        this.checkAborted();

        iterationIndex++;
        this.state.currentIteration = iterationIndex;
        
        // 获取当前要研究的子问题
        const pendingSubQuestions = plan.subQuestions.filter(sq => sq.status === 'pending');
        if (pendingSubQuestions.length === 0) {
          console.log('[DeepResearch] 所有子问题已完成');
          break;
        }

        const currentSubQ = pendingSubQuestions[0];
        currentSubQ.status = 'researching';

        // 创建迭代记录
        const iteration: ResearchIteration = {
          index: iterationIndex,
          subQuestionId: currentSubQ.id,
          searchTasks: [],
          browseTasks: [],
          status: 'pending',
          startedAt: Date.now(),
        };
        this.state.iterations.push(iteration);
        this.callbacks.onIterationStart?.(iteration);

        this.addMessage({
          role: 'assistant',
          content: `## 🔄 迭代 ${iterationIndex}/${maxIterations}\n\n**研究子问题**: ${currentSubQ.question}`,
          timestamp: Date.now(),
        });

        // ----------------------------------------
        // Step 2: Searching (搜索)
        // ----------------------------------------
        this.setPhase('searching');
        iteration.status = 'searching';
        this.updateProgress(
          10 + (iterationIndex - 1) * 25 + 5,
          100,
          `搜索: ${currentSubQ.searchQueries[0] || currentSubQ.question}`
        );

        this.addMessage({
          role: 'assistant',
          content: `🔍 **搜索中...**\n\n关键词: ${currentSubQ.searchQueries.join(', ')}`,
          timestamp: Date.now(),
        });

        // 执行搜索
        const searchTask = await webSearcher.search(
          currentSubQ.searchQueries,
          plan.searchStrategy.preferredEngines[0] || 'google',
          10
        );
        iteration.searchTasks.push(searchTask);
        this.callbacks.onSearchComplete?.(searchTask);

        if (searchTask.status === 'failed') {
          this.addMessage({
            role: 'assistant',
            content: `⚠️ 搜索失败: ${searchTask.error}\n\n继续下一步...`,
            timestamp: Date.now(),
          });
          continue;
        }

        // 过滤和合并结果
        const filteredResults = webSearcher.filterResults(searchTask.results);
        
        this.addMessage({
          role: 'assistant',
          content: webSearcher.formatResultsAsText(filteredResults.slice(0, 5)),
          timestamp: Date.now(),
        });

        // ----------------------------------------
        // Step 3: Browsing (浏览)
        // ----------------------------------------
        this.setPhase('browsing');
        iteration.status = 'browsing';

        // 选择要访问的页面
        const pagesToVisit = filteredResults.slice(0, plan.searchStrategy.maxPagesPerIteration);
        
        // 如果需要用户确认要访问的页面
        if (this.config.requirePageApproval && pagesToVisit.length > 0) {
          const pageOptions = pagesToVisit.map((r, i) => ({
            label: `${i + 1}. ${r.title.substring(0, 50)}`,
            value: r.url,
            description: r.url,
          }));

          this.addMessage({
            role: 'assistant',
            content: `📄 **选择要访问的页面** (最多 ${plan.searchStrategy.maxPagesPerIteration} 个)`,
            timestamp: Date.now(),
          });

          const selectedUrls = await this.waitForUserAction({
            type: 'approve_pages',
            description: '请确认要访问的页面',
            data: pagesToVisit,
            options: [
              ...pageOptions,
              { label: '✅ 访问以上所有页面', value: 'all' },
              { label: '⏭️ 跳过浏览，直接分析', value: 'skip' },
            ],
          });

          if (selectedUrls === 'skip') {
            console.log('[DeepResearch] 用户跳过页面浏览');
          } else if (selectedUrls !== 'all') {
            // 用户选择了特定页面
            // 这里简化处理，实际可以支持多选
          }
        }

        // 浏览页面并提取内容
        this.updateProgress(
          10 + (iterationIndex - 1) * 25 + 10,
          100,
          `浏览页面 (0/${pagesToVisit.length})`
        );

        for (let pageIndex = 0; pageIndex < pagesToVisit.length; pageIndex++) {
          this.checkAborted();

          const result = pagesToVisit[pageIndex];
          this.updateProgress(
            10 + (iterationIndex - 1) * 25 + 10 + (pageIndex / pagesToVisit.length) * 5,
            100,
            `浏览: ${result.title.substring(0, 30)}...`
          );

          // 创建浏览任务
          const browseTask: BrowseTask = {
            id: generateId('browse'),
            url: result.url,
            title: result.title,
            status: 'running',
            chunks: [],
          };
          iteration.browseTasks.push(browseTask);

          try {
            // 通过 background script 获取页面内容
            const content = await this.fetchPageContent(result.url);
            browseTask.content = content;
            browseTask.status = 'completed';

            this.callbacks.onPageBrowsed?.(browseTask);

            // 分析页面内容
            const chunks = await informationAggregator.analyzePageContent(
              browseTask,
              plan,
              currentSubQ.id
            );

            browseTask.chunks = chunks;
            this.state.allChunks.push(...chunks);
            currentSubQ.findings.push(...chunks);

            for (const chunk of chunks) {
              this.callbacks.onChunkExtracted?.(chunk);
            }

            if (chunks.length > 0) {
              this.addMessage({
                role: 'assistant',
                content: `📝 从 "${result.title}" 提取了 ${chunks.length} 条信息`,
                timestamp: Date.now(),
              });
            }

          } catch (error) {
            console.error('[DeepResearch] 浏览页面失败:', error);
            browseTask.status = 'failed';
            browseTask.error = error instanceof Error ? error.message : '访问失败';
          }
        }

        // ----------------------------------------
        // Step 4: Analyzing (分析)
        // ----------------------------------------
        this.setPhase('analyzing');
        iteration.status = 'analyzing';
        this.updateProgress(
          10 + (iterationIndex - 1) * 25 + 18,
          100,
          '分析收集的信息...'
        );

        // 标记子问题完成
        currentSubQ.status = 'completed';
        currentSubQ.summary = `收集了 ${currentSubQ.findings.length} 条相关信息`;

        // ----------------------------------------
        // Step 5: Evaluating (评估)
        // ----------------------------------------
        this.setPhase('evaluating');
        this.updateProgress(
          10 + (iterationIndex - 1) * 25 + 22,
          100,
          '评估研究进度...'
        );

        // 评估研究进度
        const evaluation = await informationAggregator.evaluateProgress(
          plan,
          this.state.allChunks
        );
        this.state.evaluation = evaluation;
        this.callbacks.onEvaluationComplete?.(evaluation);

        this.addMessage({
          role: 'assistant',
          content: informationAggregator.formatEvaluationAsText(evaluation),
          timestamp: Date.now(),
        });

        // 完成迭代
        iteration.status = 'completed';
        iteration.completedAt = Date.now();
        this.callbacks.onIterationComplete?.(iteration);

        // 检查是否完成
        if (evaluation.isComplete || evaluation.recommendation === 'complete') {
          console.log('[DeepResearch] 评估显示信息充足，结束迭代');
          break;
        }

        // 询问用户是否继续
        if (this.config.interactiveMode && iterationIndex < maxIterations) {
          const decision = await this.waitForUserAction({
            type: 'continue_or_complete',
            description: '是否继续研究？',
            options: [
              { label: '🔄 继续研究', value: 'continue', description: '继续下一轮迭代' },
              { label: '✅ 生成报告', value: 'complete', description: '结束研究，生成报告' },
            ],
          });

          if (decision === 'complete') {
            console.log('[DeepResearch] 用户选择结束研究');
            break;
          }
        }

        // 根据评估更新搜索策略
        if (evaluation.nextSearches.length > 0) {
          // 更新待研究的子问题搜索词
          const nextPending = plan.subQuestions.find(sq => sq.status === 'pending');
          if (nextPending) {
            nextPending.searchQueries = [
              ...evaluation.nextSearches,
              ...nextPending.searchQueries,
            ].slice(0, 5);
          }
        }
      }

      // ========================================
      // Phase 6: Generating Report (生成报告)
      // ========================================
      this.setPhase('generating');
      this.updateProgress(90, 100, '生成研究报告...');

      this.addMessage({
        role: 'assistant',
        content: '📝 **正在生成研究报告...**\n\n综合所有收集的信息，撰写最终报告。',
        timestamp: Date.now(),
      });

      // 生成报告
      const report = await reportGenerator.generateReport(
        plan,
        this.state.allChunks,
        this.state
      );
      this.state.report = report;
      this.callbacks.onReportGenerated?.(report);

      // 添加报告消息
      this.addMessage({
        role: 'assistant',
        content: reportGenerator.formatReportAsMessage(report),
        timestamp: Date.now(),
      });

      // ========================================
      // Complete (完成)
      // ========================================
      this.setPhase('completed');
      this.state.completedAt = Date.now();
      this.updateProgress(100, 100, '研究完成！');

      plan.status = 'completed';

      const result: DeepResearchResult = {
        success: true,
        report,
        state: this.state,
      };

      this.callbacks.onComplete?.(report);
      console.log('[DeepResearch] ✅ 深度研究完成');

      return result;

    } catch (error) {
      console.error('[DeepResearch] ❌ 研究失败:', error);
      this.setPhase('error');
      this.state.error = error instanceof Error ? error.message : '研究失败';

      this.addMessage({
        role: 'assistant',
        content: `❌ **研究出错**\n\n${this.state.error}`,
        timestamp: Date.now(),
      });

      this.callbacks.onError?.(error instanceof Error ? error : new Error(this.state.error));

      return {
        success: false,
        report: null,
        state: this.state,
        error: this.state.error,
      };

    } finally {
      this.state.isRunning = false;
      this.abortController = null;
    }
  }

  /**
   * 停止研究
   */
  stop(): void {
    console.log('[DeepResearch] ⏹️ 停止研究');
    this.state.isRunning = false;
    this.abortController?.abort();

    // 如果有等待用户操作，取消它
    if (this.pendingResolve) {
      this.pendingResolve('cancel');
      this.pendingResolve = null;
    }

    this.addMessage({
      role: 'assistant',
      content: '⏹️ **研究已停止**\n\n用户手动终止了研究。',
      timestamp: Date.now(),
    });
  }

  /**
   * 重置状态
   */
  reset(): void {
    this.state = this.createInitialState();
    this.abortController = null;
    this.pendingResolve = null;
  }

  /**
   * 响应用户操作（交互模式）
   */
  respondToAction(value: string): void {
    if (this.pendingResolve) {
      this.pendingResolve(value);
      this.pendingResolve = null;
      this.state.pendingAction = null;
    }
  }

  /**
   * 等待用户操作
   */
  private waitForUserAction(action: PendingAction): Promise<string> {
    return new Promise((resolve) => {
      this.state.pendingAction = action;
      this.pendingResolve = resolve;
      this.setPhase('waiting');
      this.callbacks.onPendingAction?.(action);
    });
  }

  /**
   * 检查是否被中止
   */
  private checkAborted(): void {
    if (this.abortController?.signal.aborted) {
      throw new Error('研究被用户中止');
    }
  }

  /**
   * 设置阶段
   */
  private setPhase(phase: DeepResearchPhase): void {
    this.state.phase = phase;
    this.callbacks.onPhaseChange?.(phase);
    console.log('[DeepResearch] 📍 阶段:', phase);
  }

  /**
   * 更新进度
   */
  private updateProgress(current: number, total: number, task: string): void {
    this.state.progress = {
      current,
      total,
      percentage: Math.round((current / total) * 100),
      currentTask: task,
      iteration: this.state.currentIteration,
      maxIterations: this.config.maxIterations,
    };
    this.callbacks.onProgressUpdate?.(this.state.progress);
  }

  /**
   * 添加消息
   */
  private addMessage(message: AIMessage): void {
    this.state.messages.push(message);
    this.callbacks.onMessage?.(message);
  }

  /**
   * 获取页面内容
   * 
   * 通过 background script 获取指定 URL 的页面内容
   */
  private async fetchPageContent(url: string): Promise<string> {
    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage(
        {
          type: 'DEEP_RESEARCH_FETCH_PAGE',
          payload: { url },
        },
        (response) => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
            return;
          }

          if (response?.success && response.data) {
            resolve(response.data.content || '');
          } else {
            // 备用：返回空内容
            console.warn('[DeepResearch] 无法获取页面内容:', url);
            resolve('');
          }
        }
      );

      // 超时处理
      setTimeout(() => {
        resolve(''); // 超时时返回空内容
      }, 15000);
    });
  }
}

// 导出单例
export const deepResearchAgent = new DeepResearchAgent();

// 导出类
export { DeepResearchAgent };

