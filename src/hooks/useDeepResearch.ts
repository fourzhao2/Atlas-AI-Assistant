/**
 * useDeepResearch Hook
 * 
 * 提供 DeepResearch 模式的 React 状态管理和操作接口
 * 封装深度研究智能体的交互逻辑
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import { deepResearchAgent, reportGenerator } from '@/services/deep-research';
import { conversationService } from '@/services/conversation';
import type { AIMessage } from '@/types';
import type {
  DeepResearchPhase,
  DeepResearchConfig,
  DeepResearchResult,
  ResearchPlan,
  ResearchIteration,
  ResearchProgress,
  ResearchEvaluation,
  ResearchReport,
  PendingAction,
  InformationChunk,
  SearchTask,
  BrowseTask,
} from '@/types/deep-research';
import { DEFAULT_DEEP_RESEARCH_CONFIG } from '@/types/deep-research';

interface UseDeepResearchOptions {
  onMessage?: (message: AIMessage) => void;
  conversationId?: string | null;
  config?: Partial<DeepResearchConfig>;
}

/**
 * useDeepResearch Hook
 */
export const useDeepResearch = ({
  onMessage,
  conversationId,
  config = {},
}: UseDeepResearchOptions = {}) => {
  // 状态
  const [isExecuting, setIsExecuting] = useState(false);
  const [phase, setPhase] = useState<DeepResearchPhase>('idle');
  const [plan, setPlan] = useState<ResearchPlan | null>(null);
  const [iterations, setIterations] = useState<ResearchIteration[]>([]);
  const [currentIteration, setCurrentIteration] = useState(0);
  const [progress, setProgress] = useState<ResearchProgress>({
    current: 0,
    total: 0,
    percentage: 0,
    currentTask: '',
    iteration: 0,
    maxIterations: config.maxIterations || DEFAULT_DEEP_RESEARCH_CONFIG.maxIterations,
  });
  const [evaluation, setEvaluation] = useState<ResearchEvaluation | null>(null);
  const [report, setReport] = useState<ResearchReport | null>(null);
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null);
  const [allChunks, setAllChunks] = useState<InformationChunk[]>([]);
  const [messages, setMessages] = useState<AIMessage[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Refs
  const isExecutingRef = useRef(false);

  /**
   * 设置回调
   */
  useEffect(() => {
    // 更新配置
    deepResearchAgent.updateConfig({
      ...DEFAULT_DEEP_RESEARCH_CONFIG,
      ...config,
    });

    // 设置回调
    deepResearchAgent.setCallbacks({
      onPhaseChange: (newPhase) => {
        setPhase(newPhase);
      },
      onPlanCreated: (newPlan) => {
        setPlan(newPlan);
      },
      onIterationStart: (iteration) => {
        setIterations(prev => [...prev, iteration]);
        setCurrentIteration(iteration.index);
      },
      onIterationComplete: (iteration) => {
        setIterations(prev => prev.map(it => 
          it.index === iteration.index ? iteration : it
        ));
      },
      onSearchComplete: (task: SearchTask) => {
        console.log('[useDeepResearch] 搜索完成:', task.id);
      },
      onPageBrowsed: (task: BrowseTask) => {
        console.log('[useDeepResearch] 页面浏览完成:', task.url);
      },
      onChunkExtracted: (chunk) => {
        setAllChunks(prev => [...prev, chunk]);
      },
      onEvaluationComplete: (eval_) => {
        setEvaluation(eval_);
      },
      onProgressUpdate: (prog) => {
        setProgress(prog);
      },
      onPendingAction: (action) => {
        setPendingAction(action);
      },
      onMessage: (message) => {
        setMessages(prev => [...prev, message]);
        onMessage?.(message);

        // 保存到对话历史
        if (conversationId) {
          conversationService.addMessage(conversationId, message).catch(console.error);
        }
      },
      onReportGenerated: (rpt) => {
        setReport(rpt);
      },
      onComplete: async (rpt) => {
        setIsExecuting(false);
        isExecutingRef.current = false;
        setReport(rpt);

        // 添加完成消息
        const completeMessage: AIMessage = {
          role: 'assistant',
          content: `✅ **深度研究完成！**\n\n研究报告已生成，共收集 ${rpt.metadata.infoChunksCollected} 条信息，来自 ${rpt.sources.length} 个来源。`,
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
      deepResearchAgent.setCallbacks({});
    };
  }, [onMessage, conversationId, config]);

  /**
   * 开始深度研究
   */
  const research = useCallback(async (question: string): Promise<DeepResearchResult> => {
    if (isExecutingRef.current) {
      console.warn('[useDeepResearch] 已有研究在进行中');
      return {
        success: false,
        report: null,
        state: deepResearchAgent.getState(),
        error: '已有研究在进行中',
      };
    }

    console.log('[useDeepResearch] 🚀 开始深度研究:', question);

    // 重置状态
    setIsExecuting(true);
    isExecutingRef.current = true;
    setPhase('planning');
    setPlan(null);
    setIterations([]);
    setCurrentIteration(0);
    setProgress({
      current: 0,
      total: 100,
      percentage: 0,
      currentTask: '初始化...',
      iteration: 0,
      maxIterations: config.maxIterations || DEFAULT_DEEP_RESEARCH_CONFIG.maxIterations,
    });
    setEvaluation(null);
    setReport(null);
    setPendingAction(null);
    setAllChunks([]);
    setMessages([]);
    setError(null);

    try {
      const result = await deepResearchAgent.research(question);
      return result;
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : '研究失败';
      setError(errorMsg);
      setIsExecuting(false);
      isExecutingRef.current = false;

      return {
        success: false,
        report: null,
        state: deepResearchAgent.getState(),
        error: errorMsg,
      };
    }
  }, [config]);

  /**
   * 响应用户操作（交互模式）
   */
  const respondToAction = useCallback((value: string) => {
    console.log('[useDeepResearch] 用户响应:', value);
    deepResearchAgent.respondToAction(value);
    setPendingAction(null);
  }, []);

  /**
   * 停止研究
   */
  const stop = useCallback(() => {
    console.log('[useDeepResearch] ⏹️ 停止研究');
    deepResearchAgent.stop();
    setIsExecuting(false);
    isExecutingRef.current = false;
  }, []);

  /**
   * 重置状态
   */
  const reset = useCallback(() => {
    console.log('[useDeepResearch] 🔄 重置状态');
    deepResearchAgent.reset();
    setIsExecuting(false);
    isExecutingRef.current = false;
    setPhase('idle');
    setPlan(null);
    setIterations([]);
    setCurrentIteration(0);
    setProgress({
      current: 0,
      total: 0,
      percentage: 0,
      currentTask: '',
      iteration: 0,
      maxIterations: config.maxIterations || DEFAULT_DEEP_RESEARCH_CONFIG.maxIterations,
    });
    setEvaluation(null);
    setReport(null);
    setPendingAction(null);
    setAllChunks([]);
    setMessages([]);
    setError(null);
  }, [config]);

  /**
   * 导出报告为 Markdown
   */
  const exportReport = useCallback((): string | null => {
    if (!report) return null;
    
    // 导出报告为 Markdown
    const markdown = reportGenerator.exportAsMarkdown(report);
    // 复制到剪贴板
    navigator.clipboard.writeText(markdown).catch(console.error);
    
    return markdown;
  }, [report]);

  /**
   * 获取统计信息
   */
  const getStatistics = useCallback(() => {
    return {
      totalChunks: allChunks.length,
      totalIterations: iterations.length,
      uniqueSources: new Set(allChunks.map(c => c.sourceUrl)).size,
      completedSubQuestions: plan?.subQuestions.filter(sq => sq.status === 'completed').length || 0,
      totalSubQuestions: plan?.subQuestions.length || 0,
    };
  }, [allChunks, iterations, plan]);

  return {
    // 状态
    isExecuting,
    phase,
    plan,
    iterations,
    currentIteration,
    progress,
    evaluation,
    report,
    pendingAction,
    allChunks,
    messages,
    error,

    // 计算属性
    hasPlan: plan !== null,
    hasReport: report !== null,
    isPlanning: phase === 'planning',
    isSearching: phase === 'searching',
    isBrowsing: phase === 'browsing',
    isAnalyzing: phase === 'analyzing',
    isEvaluating: phase === 'evaluating',
    isWaiting: phase === 'waiting',
    isGenerating: phase === 'generating',
    isCompleted: phase === 'completed',
    isError: phase === 'error',
    hasPendingAction: pendingAction !== null,
    statistics: getStatistics(),

    // 方法
    research,
    respondToAction,
    stop,
    reset,
    exportReport,
  };
};

export default useDeepResearch;

