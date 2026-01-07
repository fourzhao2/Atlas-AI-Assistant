import React, { useState } from 'react';
import type { AIMessage, ImageAttachment } from '@/types';
import { marked } from 'marked';

interface ChatMessageProps {
  message: AIMessage;
  isStreaming?: boolean;
}

/**
 * 图片预览组件
 */
const ImagePreview: React.FC<{ image: ImageAttachment }> = ({ image }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const imageUrl = `data:${image.mediaType};base64,${image.data}`;
  
  return (
    <>
      {/* 缩略图 */}
      <div 
        className="relative cursor-pointer rounded-lg overflow-hidden border border-gray-200 dark:border-gray-600 hover:border-blue-400 dark:hover:border-blue-500 transition-colors"
        onClick={() => setIsExpanded(true)}
      >
        <img 
          src={imageUrl}
          alt={image.name || '图片'}
          className="max-w-[200px] max-h-[150px] object-cover"
          loading="lazy"
        />
        {/* 放大提示 */}
        <div className="absolute inset-0 bg-black/0 hover:bg-black/20 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
          <svg className="w-6 h-6 text-white drop-shadow-lg" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7" />
          </svg>
        </div>
      </div>
      
      {/* 全屏预览模态框 */}
      {isExpanded && (
        <div 
          className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
          onClick={() => setIsExpanded(false)}
        >
          <div className="relative max-w-full max-h-full">
            <img 
              src={imageUrl}
              alt={image.name || '图片'}
              className="max-w-[90vw] max-h-[90vh] object-contain rounded-lg"
            />
            {/* 关闭按钮 */}
            <button
              onClick={() => setIsExpanded(false)}
              className="absolute top-2 right-2 w-10 h-10 bg-black/50 hover:bg-black/70 text-white rounded-full flex items-center justify-center transition-colors"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
            {/* 图片信息 */}
            {(image.name || image.width) && (
              <div className="absolute bottom-2 left-2 right-2 bg-black/50 text-white text-sm px-3 py-1 rounded-lg">
                {image.name && <span>{image.name}</span>}
                {image.width && image.height && (
                  <span className="ml-2 text-gray-300">
                    {image.width} × {image.height}
                  </span>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
};

export const ChatMessage: React.FC<ChatMessageProps> = ({ message, isStreaming = false }) => {
  const isUser = message.role === 'user';
  const hasImages = message.images && message.images.length > 0;
  
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
        {/* 🖼️ 图片内容（用户消息时显示在文本上方） */}
        {hasImages && (
          <div className={`flex flex-wrap gap-2 ${message.content ? 'mb-2' : ''}`}>
            {message.images!.map((img) => (
              <ImagePreview key={img.id} image={img} />
            ))}
          </div>
        )}
        
        {/* 文本内容 */}
        {message.content && renderContent()}
        
        {isStreaming && (
          <span className="inline-block ml-1 w-2 h-4 bg-current animate-pulse">▋</span>
        )}
        
        {message.timestamp && !isStreaming && (
          <div className="text-xs opacity-50 mt-2 flex items-center gap-2">
            <span>
              {new Date(message.timestamp).toLocaleTimeString('zh-CN', {
                hour: '2-digit',
                minute: '2-digit',
              })}
            </span>
            {hasImages && (
              <span className="text-blue-500 dark:text-blue-400">
                🖼️ {message.images!.length}
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

