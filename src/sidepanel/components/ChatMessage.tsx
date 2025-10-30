import React from 'react';
import type { AIMessage } from '@/types';
import { marked } from 'marked';

interface ChatMessageProps {
  message: AIMessage;
  isStreaming?: boolean;
}

export const ChatMessage: React.FC<ChatMessageProps> = ({ message, isStreaming = false }) => {
  const isUser = message.role === 'user';
  
  const renderContent = () => {
    if (isUser) {
      return <div className="whitespace-pre-wrap">{message.content}</div>;
    }
    
    // Render markdown for assistant messages
    try {
      const html = marked(message.content, { breaks: true });
      return (
        <div 
          className="prose prose-sm dark:prose-invert max-w-none"
          dangerouslySetInnerHTML={{ __html: html }}
        />
      );
    } catch {
      return <div className="whitespace-pre-wrap">{message.content}</div>;
    }
  };

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-4 animate-fade-in`}>
      <div className={`max-w-[85%] ${isUser ? 'message-user' : 'message-assistant'}`}>
        {renderContent()}
        {isStreaming && (
          <span className="inline-block ml-1 w-2 h-4 bg-current animate-pulse">▋</span>
        )}
        {message.timestamp && !isStreaming && (
          <div className="text-xs opacity-50 mt-2">
            {new Date(message.timestamp).toLocaleTimeString('zh-CN', {
              hour: '2-digit',
              minute: '2-digit',
            })}
          </div>
        )}
      </div>
    </div>
  );
};

