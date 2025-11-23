import React from 'react';

interface ReActStep {
  phase: 'idle' | 'thinking' | 'acting' | 'observing' | 'completed' | 'error';
  thought?: string;
  action?: string;
  observation?: string;
  timestamp: number;
}

interface ReActPanelProps {
  steps: ReActStep[];
  currentPhase: string;
  isExecuting: boolean;
  onStop?: () => void;
}

/**
 * ReAct 可视化面板
 * 显示 ReAct 循环的每个阶段：思考 → 行动 → 观察
 */
export const ReActPanel: React.FC<ReActPanelProps> = ({
  steps,
  currentPhase,
  isExecuting,
  onStop,
}) => {
  if (steps.length === 0) return null;

  const getPhaseIcon = (phase: string) => {
    switch (phase) {
      case 'thinking': return '🤔';
      case 'acting': return '⚡';
      case 'observing': return '👀';
      case 'completed': return '✅';
      case 'error': return '❌';
      default: return '📋';
    }
  };

  const getPhaseColor = (phase: string) => {
    switch (phase) {
      case 'thinking': return 'bg-blue-100 dark:bg-blue-900 border-blue-300 dark:border-blue-700';
      case 'acting': return 'bg-yellow-100 dark:bg-yellow-900 border-yellow-300 dark:border-yellow-700';
      case 'observing': return 'bg-purple-100 dark:bg-purple-900 border-purple-300 dark:border-purple-700';
      case 'completed': return 'bg-green-100 dark:bg-green-900 border-green-300 dark:border-green-700';
      case 'error': return 'bg-red-100 dark:bg-red-900 border-red-300 dark:border-red-700';
      default: return 'bg-gray-100 dark:bg-gray-800 border-gray-300 dark:border-gray-600';
    }
  };

  const getPhaseName = (phase: string) => {
    switch (phase) {
      case 'thinking': return '思考';
      case 'acting': return '行动';
      case 'observing': return '观察';
      case 'completed': return '完成';
      case 'error': return '错误';
      default: return phase;
    }
  };

  return (
    <div className="mb-4 p-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <span className="text-2xl">🔄</span>
          <div>
            <h3 className="font-semibold text-gray-900 dark:text-gray-100">
              ReAct Agent
            </h3>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              推理 + 行动模式
            </p>
          </div>
        </div>
        {isExecuting && onStop && (
          <button
            onClick={onStop}
            className="px-3 py-1 text-sm bg-red-500 text-white rounded hover:bg-red-600 transition-colors"
          >
            ⏹️ 停止
          </button>
        )}
      </div>

      {/* Current Phase */}
      {isExecuting && (
        <div className="mb-3 p-2 rounded bg-primary-50 dark:bg-primary-900/20 border border-primary-200 dark:border-primary-800">
          <div className="flex items-center gap-2">
            <span className="text-lg">{getPhaseIcon(currentPhase)}</span>
            <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
              当前阶段: {getPhaseName(currentPhase)}
            </span>
            <div className="ml-auto flex gap-1">
              <div className="w-2 h-2 bg-primary-500 rounded-full animate-pulse"></div>
              <div className="w-2 h-2 bg-primary-500 rounded-full animate-pulse" style={{ animationDelay: '0.2s' }}></div>
              <div className="w-2 h-2 bg-primary-500 rounded-full animate-pulse" style={{ animationDelay: '0.4s' }}></div>
            </div>
          </div>
        </div>
      )}

      {/* Steps Timeline */}
      <div className="space-y-2">
        {steps.map((step, index) => (
          <div
            key={index}
            className={`p-3 rounded-lg border-2 ${getPhaseColor(step.phase)} transition-all`}
          >
            <div className="flex items-start gap-2">
              <span className="text-xl flex-shrink-0">{getPhaseIcon(step.phase)}</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-semibold text-sm text-gray-900 dark:text-gray-100">
                    {getPhaseName(step.phase)}
                  </span>
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    {new Date(step.timestamp).toLocaleTimeString('zh-CN')}
                  </span>
                </div>
                <div className="text-sm text-gray-700 dark:text-gray-300">
                  {step.thought && (
                    <p className="mb-1">
                      <span className="font-medium">思考：</span>
                      {step.thought}
                    </p>
                  )}
                  {step.action && (
                    <p className="mb-1">
                      <span className="font-medium">行动：</span>
                      {step.action}
                    </p>
                  )}
                  {step.observation && (
                    <p>
                      <span className="font-medium">观察：</span>
                      {step.observation}
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Flow Diagram */}
      <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-center gap-2 text-xs text-gray-600 dark:text-gray-400">
          <span className="flex items-center gap-1">
            <span>🤔</span>
            <span>思考</span>
          </span>
          <span>→</span>
          <span className="flex items-center gap-1">
            <span>⚡</span>
            <span>行动</span>
          </span>
          <span>→</span>
          <span className="flex items-center gap-1">
            <span>👀</span>
            <span>观察</span>
          </span>
          <span>→</span>
          <span className="flex items-center gap-1">
            <span>🔄</span>
            <span>循环</span>
          </span>
        </div>
      </div>
    </div>
  );
};


