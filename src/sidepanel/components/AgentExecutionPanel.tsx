import type { AgentExecutionStep } from '@/types';

interface AgentExecutionPanelProps {
  steps: AgentExecutionStep[];
  isExecuting: boolean;
  onStop?: () => void;
}

export const AgentExecutionPanel = ({ 
  steps, 
  isExecuting, 
  onStop 
}: AgentExecutionPanelProps) => {
  if (steps.length === 0 && !isExecuting) {
    return null;
  }

  const getActionIcon = (type: string) => {
    switch (type) {
      case 'click':
        return '🖱️';
      case 'fill':
        return '✏️';
      case 'navigate':
        return '🧭';
      case 'scroll':
        return '📜';
      case 'select':
        return '📋';
      case 'check':
        return '✅';
      case 'press':
        return '⌨️';
      case 'wait':
        return '⏳';
      case 'submit':
        return '📤';
      default:
        return '⚙️';
    }
  };

  const getActionLabel = (type: string) => {
    const labels: Record<string, string> = {
      click: '点击',
      fill: '填写',
      navigate: '导航',
      scroll: '滚动',
      select: '选择',
      check: '勾选',
      press: '按键',
      wait: '等待',
      submit: '提交',
      extract: '提取',
      hover: '悬停',
      drag: '拖拽'
    };
    return labels[type] || type;
  };

  return (
    <div className="border border-blue-200 dark:border-blue-800 rounded-lg p-3 mb-4 bg-blue-50 dark:bg-blue-900/20">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1">
            {isExecuting ? (
              <>
                <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
                <span className="text-sm font-medium text-blue-700 dark:text-blue-300">
                  正在执行...
                </span>
              </>
            ) : (
              <>
                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                <span className="text-sm font-medium text-green-700 dark:text-green-300">
                  执行完成
                </span>
              </>
            )}
          </div>
          <span className="text-xs text-gray-500 dark:text-gray-400">
            {steps.length} 个步骤
          </span>
        </div>
        
        {isExecuting && onStop && (
          <button
            onClick={onStop}
            className="px-2 py-1 text-xs bg-red-500 hover:bg-red-600 text-white rounded transition-colors"
          >
            停止
          </button>
        )}
      </div>

      <div className="space-y-2 max-h-60 overflow-y-auto">
        {steps.map((step, index) => (
          <div
            key={index}
            className={`flex items-start gap-2 text-sm p-2 rounded ${
              step.success
                ? 'bg-white dark:bg-gray-800'
                : 'bg-red-50 dark:bg-red-900/20'
            }`}
          >
            <div className="flex-shrink-0 w-6 h-6 flex items-center justify-center">
              {step.success ? (
                <span className="text-lg">{getActionIcon(step.action.type)}</span>
              ) : (
                <span className="text-red-500">❌</span>
              )}
            </div>
            
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className={`font-medium ${
                  step.success 
                    ? 'text-gray-700 dark:text-gray-300' 
                    : 'text-red-600 dark:text-red-400'
                }`}>
                  {getActionLabel(step.action.type)}
                </span>
                {step.action.selector && (
                  <code className="text-xs text-gray-500 dark:text-gray-400 truncate">
                    {step.action.selector}
                  </code>
                )}
              </div>
              
              <div className={`text-xs mt-1 ${
                step.success 
                  ? 'text-gray-600 dark:text-gray-400' 
                  : 'text-red-600 dark:text-red-400'
              }`}>
                {step.result}
              </div>
            </div>

            <div className="flex-shrink-0 text-xs text-gray-400 dark:text-gray-500">
              {new Date(step.timestamp).toLocaleTimeString('zh-CN', {
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit'
              })}
            </div>
          </div>
        ))}
        
        {isExecuting && (
          <div className="flex items-center gap-2 text-sm p-2 rounded bg-blue-50 dark:bg-blue-900/30">
            <div className="flex gap-1">
              <div className="w-2 h-2 bg-blue-400 rounded-full animate-pulse"></div>
              <div className="w-2 h-2 bg-blue-400 rounded-full animate-pulse" style={{ animationDelay: '0.2s' }}></div>
              <div className="w-2 h-2 bg-blue-400 rounded-full animate-pulse" style={{ animationDelay: '0.4s' }}></div>
            </div>
            <span className="text-blue-600 dark:text-blue-400">处理中...</span>
          </div>
        )}
      </div>
    </div>
  );
};


