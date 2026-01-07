/**
 * DeepResearchPanel - 深度研究面板组件
 * 
 * 显示深度研究的进度、计划、发现和交互控件
 */

import React from 'react';
import type {
  DeepResearchPhase,
  ResearchPlan,
  ResearchProgress,
  ResearchEvaluation,
  ResearchReport,
  ResearchIteration,
  PendingAction,
  InformationChunk,
} from '@/types/deep-research';

interface DeepResearchPanelProps {
  phase: DeepResearchPhase;
  plan: ResearchPlan | null;
  progress: ResearchProgress;
  evaluation: ResearchEvaluation | null;
  report: ResearchReport | null;
  iterations: ResearchIteration[];
  currentIteration: number;
  allChunks: InformationChunk[];
  pendingAction: PendingAction | null;
  isExecuting: boolean;
  onRespond: (value: string) => void;
  onStop: () => void;
  onReset: () => void;
  onExport?: () => void;
}

/**
 * 获取阶段标签
 */
const getPhaseLabel = (phase: DeepResearchPhase): string => {
  const labels: Record<DeepResearchPhase, string> = {
    idle: '空闲',
    planning: '规划中',
    searching: '搜索中',
    browsing: '浏览中',
    analyzing: '分析中',
    evaluating: '评估中',
    waiting: '等待确认',
    generating: '生成报告',
    completed: '已完成',
    error: '错误',
  };
  return labels[phase] || phase;
};

/**
 * 获取阶段图标
 */
const getPhaseIcon = (phase: DeepResearchPhase): string => {
  const icons: Record<DeepResearchPhase, string> = {
    idle: '⏸️',
    planning: '🎯',
    searching: '🔍',
    browsing: '📄',
    analyzing: '🧠',
    evaluating: '📊',
    waiting: '⏳',
    generating: '📝',
    completed: '✅',
    error: '❌',
  };
  return icons[phase] || '❓';
};

/**
 * 进度条组件
 */
const ProgressBar: React.FC<{ percentage: number; label?: string }> = ({ percentage, label }) => (
  <div className="w-full">
    {label && (
      <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 mb-1">
        <span>{label}</span>
        <span>{percentage}%</span>
      </div>
    )}
    <div className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
      <div
        className="h-full bg-gradient-to-r from-blue-500 to-purple-500 transition-all duration-300"
        style={{ width: `${Math.min(100, percentage)}%` }}
      />
    </div>
  </div>
);

/**
 * 子问题列表组件
 */
const SubQuestionList: React.FC<{ plan: ResearchPlan }> = ({ plan }) => (
  <div className="space-y-2">
    {plan.subQuestions.map((sq, index) => (
      <div
        key={sq.id}
        className={`flex items-start gap-2 p-2 rounded-lg text-xs ${
          sq.status === 'completed'
            ? 'bg-green-50 dark:bg-green-900/20'
            : sq.status === 'researching'
            ? 'bg-blue-50 dark:bg-blue-900/20'
            : 'bg-gray-50 dark:bg-gray-800/50'
        }`}
      >
        <span className="flex-shrink-0">
          {sq.status === 'completed' ? '✅' : sq.status === 'researching' ? '🔄' : '⏳'}
        </span>
        <div className="flex-1 min-w-0">
          <p className="font-medium truncate">{sq.question}</p>
          {sq.findings.length > 0 && (
            <p className="text-gray-500 dark:text-gray-400 text-[10px] mt-0.5">
              收集 {sq.findings.length} 条信息
            </p>
          )}
        </div>
        <span className="text-[10px] text-gray-400">#{index + 1}</span>
      </div>
    ))}
  </div>
);

/**
 * 待确认操作组件
 */
const PendingActionCard: React.FC<{
  action: PendingAction;
  onRespond: (value: string) => void;
}> = ({ action, onRespond }) => (
  <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-3">
    <p className="text-sm font-medium text-yellow-800 dark:text-yellow-200 mb-2">
      ⏳ {action.description}
    </p>
    <div className="flex flex-wrap gap-2">
      {action.options?.map((opt) => (
        <button
          key={opt.value}
          onClick={() => onRespond(opt.value)}
          className="px-3 py-1.5 text-xs font-medium rounded-md bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          title={opt.description}
        >
          {opt.label}
        </button>
      ))}
    </div>
  </div>
);

/**
 * 统计卡片组件
 */
const StatsCard: React.FC<{
  icon: string;
  label: string;
  value: number | string;
}> = ({ icon, label, value }) => (
  <div className="flex items-center gap-2 p-2 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
    <span className="text-lg">{icon}</span>
    <div>
      <p className="text-[10px] text-gray-500 dark:text-gray-400">{label}</p>
      <p className="text-sm font-semibold">{value}</p>
    </div>
  </div>
);

/**
 * DeepResearchPanel 主组件
 */
export const DeepResearchPanel: React.FC<DeepResearchPanelProps> = ({
  phase,
  plan,
  progress,
  evaluation,
  report,
  iterations: _iterations,
  currentIteration,
  allChunks,
  pendingAction,
  isExecuting,
  onRespond,
  onStop,
  onReset,
  onExport,
}) => {
  // 如果是空闲状态且没有计划，不显示面板
  if (phase === 'idle' && !plan && !report) {
    return null;
  }

  return (
    <div className="bg-gradient-to-br from-purple-50 to-blue-50 dark:from-purple-900/20 dark:to-blue-900/20 border border-purple-200 dark:border-purple-800 rounded-xl p-4 mb-4 space-y-4">
      {/* 头部：阶段和进度 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-2xl">{getPhaseIcon(phase)}</span>
          <div>
            <h3 className="text-sm font-bold text-purple-800 dark:text-purple-200">
              深度研究
            </h3>
            <p className="text-xs text-purple-600 dark:text-purple-400">
              {getPhaseLabel(phase)}
              {currentIteration > 0 && ` · 迭代 ${currentIteration}/${progress.maxIterations}`}
            </p>
          </div>
        </div>

        {/* 控制按钮 */}
        <div className="flex items-center gap-2">
          {isExecuting && (
            <button
              onClick={onStop}
              className="px-2 py-1 text-xs font-medium text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/30 rounded-md transition-colors"
            >
              ⏹️ 停止
            </button>
          )}
          {phase === 'completed' && (
            <>
              {onExport && (
                <button
                  onClick={onExport}
                  className="px-2 py-1 text-xs font-medium text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/30 rounded-md transition-colors"
                >
                  📥 导出
                </button>
              )}
              <button
                onClick={onReset}
                className="px-2 py-1 text-xs font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors"
              >
                🔄 重置
              </button>
            </>
          )}
        </div>
      </div>

      {/* 进度条 */}
      {isExecuting && (
        <div className="space-y-1">
          <ProgressBar percentage={progress.percentage} />
          <p className="text-[10px] text-gray-500 dark:text-gray-400 truncate">
            {progress.currentTask}
          </p>
        </div>
      )}

      {/* 待确认操作 */}
      {pendingAction && (
        <PendingActionCard action={pendingAction} onRespond={onRespond} />
      )}

      {/* 研究计划 */}
      {plan && phase !== 'completed' && (
        <div className="space-y-2">
          <h4 className="text-xs font-semibold text-gray-700 dark:text-gray-300 flex items-center gap-1">
            📋 研究计划
            <span className="text-[10px] font-normal text-gray-500">
              ({plan.subQuestions.length} 个子问题)
            </span>
          </h4>
          <SubQuestionList plan={plan} />
        </div>
      )}

      {/* 评估结果 */}
      {evaluation && phase !== 'completed' && (
        <div className="bg-white/50 dark:bg-gray-800/30 rounded-lg p-3 space-y-2">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-semibold text-gray-700 dark:text-gray-300">
              📊 研究进度
            </h4>
            <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
              evaluation.coverageScore >= 80
                ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300'
                : evaluation.coverageScore >= 50
                ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300'
                : 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300'
            }`}>
              覆盖度 {evaluation.coverageScore}%
            </span>
          </div>
          
          {evaluation.keyFindings.length > 0 && (
            <div className="text-xs text-gray-600 dark:text-gray-400">
              <p className="font-medium mb-1">主要发现:</p>
              <ul className="list-disc list-inside space-y-0.5">
                {evaluation.keyFindings.slice(0, 3).map((f, i) => (
                  <li key={i} className="truncate">{f}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* 统计信息 */}
      {(isExecuting || phase === 'completed') && (
        <div className="grid grid-cols-3 gap-2">
          <StatsCard icon="🔄" label="迭代" value={currentIteration} />
          <StatsCard icon="📝" label="信息" value={allChunks.length} />
          <StatsCard icon="🌐" label="来源" value={new Set(allChunks.map(c => c.sourceUrl)).size} />
        </div>
      )}

      {/* 完成状态 */}
      {phase === 'completed' && report && (
        <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-3">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-lg">📊</span>
            <h4 className="text-sm font-semibold text-green-800 dark:text-green-200">
              研究报告已生成
            </h4>
          </div>
          <p className="text-xs text-green-700 dark:text-green-300">
            {report.title}
          </p>
          <div className="flex flex-wrap gap-2 mt-2 text-[10px] text-green-600 dark:text-green-400">
            <span>📄 {report.sections.length} 个章节</span>
            <span>📚 {report.sources.length} 个来源</span>
            <span>⏱️ {Math.round(report.metadata.researchDuration / 1000)}秒</span>
          </div>
        </div>
      )}

      {/* 错误状态 */}
      {phase === 'error' && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3">
          <p className="text-sm text-red-700 dark:text-red-300">
            ❌ 研究过程中出现错误
          </p>
          <button
            onClick={onReset}
            className="mt-2 px-3 py-1 text-xs font-medium bg-red-100 dark:bg-red-800 text-red-700 dark:text-red-200 rounded-md hover:bg-red-200 dark:hover:bg-red-700 transition-colors"
          >
            重新开始
          </button>
        </div>
      )}
    </div>
  );
};

export default DeepResearchPanel;

