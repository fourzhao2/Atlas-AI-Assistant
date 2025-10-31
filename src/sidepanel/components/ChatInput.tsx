import React, { useState, useRef, useEffect } from 'react';

interface ChatInputProps {
  onSend: (message: string) => void;
  disabled?: boolean;
  placeholder?: string;
}

export const ChatInput: React.FC<ChatInputProps> = ({ 
  onSend, 
  disabled = false,
  placeholder = '输入消息...'
}) => {
  const [input, setInput] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedInput = input.trim();
    
    // 验证输入不为空且不超过长度限制
    if (!trimmedInput) {
      return;
    }
    
    if (trimmedInput.length > 10000) {
      alert('消息太长了！请限制在10000字符以内。');
      return;
    }
    
    if (!disabled) {
      onSend(trimmedInput);
      setInput('');
      // Reset textarea height
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
      }
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = textareaRef.current.scrollHeight + 'px';
    }
  }, [input]);

  const charCount = input.length;
  const isOverLimit = charCount > 10000;
  
  return (
    <form onSubmit={handleSubmit} className="border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
      <div className="flex gap-2 p-4">
        <div className="flex-1 relative">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            disabled={disabled}
            rows={1}
            className={`w-full resize-none input-field max-h-32 min-h-[42px] ${isOverLimit ? 'border-red-500 dark:border-red-400' : ''}`}
          />
          {charCount > 0 && (
            <div className={`absolute bottom-2 right-2 text-xs ${
              isOverLimit 
                ? 'text-red-600 dark:text-red-400 font-semibold' 
                : charCount > 8000
                  ? 'text-orange-600 dark:text-orange-400'
                  : 'text-gray-400 dark:text-gray-500'
            }`}>
              {charCount}/10000
            </div>
          )}
        </div>
        <button
          type="submit"
          disabled={disabled || !input.trim() || isOverLimit}
          className="btn-primary px-6 self-end"
          title={isOverLimit ? '消息太长了' : '发送 (Enter)'}
        >
          发送
        </button>
      </div>
      <div className="px-4 pb-2 text-xs text-gray-500 dark:text-gray-400">
        提示: 按 Enter 发送，Shift + Enter 换行
      </div>
    </form>
  );
};

