/**
 * PlanPanel 组件
 * 
 * 显示 Plan 模式的执行状态
 * 包括：计划步骤列表、当前进度、Planner/Navigator 状态
 */

import type { PlanPhase, TaskPlanFull, PlanStep } from '@/types';

interface PlanPanelProps {
  plan: TaskPlanFull | null;
  phase: PlanPhase;
  plannerThinking: string;
  navigatorStatus: string;
  currentStep: PlanStep | null;
  isExecuting: boolean;
  progress: { current: number; total: number; percentage: number };
  onApprove?: () => void;
  onStop?: () => void;
  onReset?: () => void;
  onEditStep?: (stepId: string) => void;
}

/**
 * 阶段状态徽章
 */
const PhaseBadge = ({ phase }: { phase: PlanPhase }) => {
  const config: Record<PlanPhase, { label: string; color: string; icon: string }> = {
    idle: { label: '空闲', color: 'bg-gray-500', icon: '○' },
    planning: { label: '规划中', color: 'bg-blue-500', icon: '🎯' },
    reviewing: { label: '待确认', color: 'bg-yellow-500', icon: '📋' },
    executing: { label: '执行中', color: 'bg-green-500', icon: '⚡' },
    evaluating: { label: '评估中', color: 'bg-purple-500', icon: '🔍' },
    replanning: { label: '重新规划', color: 'bg-orange-500', icon: '🔄' },
    completed: { label: '已完成', color: 'bg-emerald-500', icon: '✅' },
    error: { label: '错误', color: 'bg-red-500', icon: '❌' },
  };

  const { label, color, icon } = config[phase];

  return (
    <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium text-white ${color}`}>
      <span>{icon}</span>
      <span>{label}</span>
    </span>
  );
};

/**
 * 步骤状态图标
 */
const StepStatusIcon = ({ status }: { status: PlanStep['status'] }) => {
  const icons: Record<PlanStep['status'], { icon: string; color: string }> = {
    pending: { icon: '○', color: 'text-gray-400' },
    running: { icon: '●', color: 'text-blue-500 animate-pulse' },
    success: { icon: '✓', color: 'text-green-500' },
    failed: { icon: '✗', color: 'text-red-500' },
    skipped: { icon: '⏭', color: 'text-gray-400' },
  };

  const { icon, color } = icons[status];

  return <span className={`font-bold ${color}`}>{icon}</span>;
};

/**
 * 单个步骤项
 */
const StepItem = ({
  step,
  isCurrent,
  onEdit,
}: {
  step: PlanStep;
  isCurrent: boolean;
  onEdit?: () => void;
}) => {
  return (
    <div
      className={`
        flex items-start gap-3 p-3 rounded-lg transition-all
        ${isCurrent ? 'bg-blue-50 dark:bg-blue-900/20 ring-1 ring-blue-500' : 'hover:bg-gray-50 dark:hover:bg-gray-800'}
        ${step.status === 'failed' ? 'bg-red-50 dark:bg-red-900/20' : ''}
      `}
    >
      {/* 步骤编号和状态 */}
      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center">
        <StepStatusIcon status={step.status} />
      </div>

      {/* 步骤内容 */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500 dark:text-gray-400">
            步骤 {step.index + 1}
          </span>
          {step.status === 'running' && (
            <span className="text-xs text-blue-500 animate-pulse">执行中...</span>
          )}
        </div>
        <p className="text-sm font-medium text-gray-900 dark:text-gray-100 mt-0.5">
          {step.description}
        </p>

        {/* 操作类型 */}
        <div className="mt-1 flex items-center gap-2">
          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300">
            {step.action.type}
          </span>
          {step.action.selector && (
            <span className="text-xs text-gray-500 dark:text-gray-400 truncate max-w-[200px]">
              {step.action.selector}
            </span>
          )}
        </div>

        {/* 执行结果 */}
        {step.result && (
          <p className={`mt-1 text-xs ${step.status === 'success' ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
            {step.result}
          </p>
        )}

        {/* 错误信息 */}
        {step.error && (
          <p className="mt-1 text-xs text-red-600 dark:text-red-400">
            ❌ {step.error}
          </p>
        )}
      </div>

      {/* 编辑按钮（仅待执行步骤可编辑） */}
      {step.status === 'pending' && onEdit && (
        <button
          onClick={onEdit}
          className="flex-shrink-0 p-1 hover:bg-gray-200 dark:hover:bg-gray-600 rounded"
          title="编辑步骤"
        >
          <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
          </svg>
        </button>
      )}
    </div>
  );
};

/**
 * 进度条
 */
const ProgressBar = ({ percentage }: { percentage: number }) => {
  return (
    <div className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
      <div
        className="h-full bg-gradient-to-r from-blue-500 to-emerald-500 transition-all duration-300"
        style={{ width: `${percentage}%` }}
      />
    </div>
  );
};

/**
 * PlanPanel 主组件
 */
export const PlanPanel = ({
  plan,
  phase,
  plannerThinking,
  navigatorStatus,
  currentStep,
  isExecuting,
  progress,
  onApprove,
  onStop,
  onReset,
  onEditStep,
}: PlanPanelProps) => {
  if (!plan && phase === 'idle') {
    return null;
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden mb-4">
      {/* 头部 */}
      <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-lg flex items-center justify-center text-white text-sm font-bold">
              P
            </div>
            <div>
              <h3 className="font-semibold text-gray-900 dark:text-gray-100">
                Plan 模式
              </h3>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Planner + Navigator 协作
              </p>
            </div>
          </div>
          <PhaseBadge phase={phase} />
        </div>

        {/* 进度条 */}
        {plan && progress.total > 0 && (
          <div className="mt-3">
            <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400 mb-1">
              <span>进度</span>
              <span>{progress.current}/{progress.total} ({progress.percentage}%)</span>
            </div>
            <ProgressBar percentage={progress.percentage} />
          </div>
        )}
      </div>

      {/* 状态信息 */}
      {(plannerThinking || navigatorStatus) && (
        <div className="px-4 py-2 bg-blue-50 dark:bg-blue-900/20 border-b border-blue-200 dark:border-blue-800">
          {plannerThinking && (
            <div className="flex items-center gap-2 text-sm text-blue-700 dark:text-blue-300">
              <span className="animate-pulse">🎯</span>
              <span>Planner: {plannerThinking}</span>
            </div>
          )}
          {navigatorStatus && (
            <div className="flex items-center gap-2 text-sm text-green-700 dark:text-green-300 mt-1">
              <span className="animate-pulse">⚡</span>
              <span>Navigator: {navigatorStatus}</span>
            </div>
          )}
        </div>
      )}

      {/* 计划步骤列表 */}
      {plan && plan.steps.length > 0 && (
        <div className="p-4 max-h-80 overflow-y-auto space-y-2">
          {plan.steps.map((step) => (
            <StepItem
              key={step.id}
              step={step}
              isCurrent={currentStep?.id === step.id}
              onEdit={onEditStep ? () => onEditStep(step.id) : undefined}
            />
          ))}
        </div>
      )}

      {/* 目标信息 */}
      {plan?.goal && (
        <div className="px-4 py-3 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50">
          <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">目标</div>
          <p className="text-sm text-gray-900 dark:text-gray-100">{plan.goal}</p>
        </div>
      )}

      {/* 操作按钮 */}
      <div className="px-4 py-3 border-t border-gray-200 dark:border-gray-700 flex items-center gap-2">
        {/* 确认计划 */}
        {phase === 'reviewing' && onApprove && (
          <button
            onClick={onApprove}
            className="flex-1 py-2 px-4 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg font-medium transition-colors"
          >
            ✓ 确认执行
          </button>
        )}

        {/* 停止执行 */}
        {isExecuting && onStop && (
          <button
            onClick={onStop}
            className="flex-1 py-2 px-4 bg-red-500 hover:bg-red-600 text-white rounded-lg font-medium transition-colors"
          >
            ⏹ 停止
          </button>
        )}

        {/* 重置 */}
        {(phase === 'completed' || phase === 'error') && onReset && (
          <button
            onClick={onReset}
            className="flex-1 py-2 px-4 bg-gray-500 hover:bg-gray-600 text-white rounded-lg font-medium transition-colors"
          >
            🔄 重置
          </button>
        )}
      </div>
    </div>
  );
};

export default PlanPanel;

