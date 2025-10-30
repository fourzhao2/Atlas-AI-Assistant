import React from 'react';

interface QuickActionsProps {
  onAction: (action: string) => void;
  disabled?: boolean;
}

export const QuickActions: React.FC<QuickActionsProps> = ({ onAction, disabled = false }) => {
  const actions = [
    { id: 'summarize', label: '📝 总结此页', icon: '📝' },
    { id: 'explain', label: '💡 解释内容', icon: '💡' },
    { id: 'translate', label: '🌐 翻译', icon: '🌐' },
    { id: 'qa', label: '❓ 问答', icon: '❓' },
  ];

  return (
    <div className="flex flex-wrap gap-2 p-4 border-b border-gray-200 dark:border-gray-700">
      {actions.map((action) => (
        <button
          key={action.id}
          onClick={() => onAction(action.id)}
          disabled={disabled}
          className="btn-secondary text-sm py-1.5 px-3 flex items-center gap-1"
        >
          <span>{action.icon}</span>
          <span>{action.label.replace(action.icon + ' ', '')}</span>
        </button>
      ))}
    </div>
  );
};

