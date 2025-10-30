import React, { useEffect, useRef, useState } from 'react';
import { useStore } from '@/store';
import { storage } from '@/services/storage';
import { aiService } from '@/services/ai-service';
import { memoryService } from '@/services/memory';
import { getPageContent } from '@/utils/messaging';
import { ChatMessage } from './components/ChatMessage';
import { ChatInput } from './components/ChatInput';
import { QuickActions } from './components/QuickActions';
import type { AIMessage, PageContent } from '@/types';

export const App: React.FC = () => {
  const {
    messages,
    isLoading,
    currentPage,
    preferences,
    theme,
    addMessage,
    setMessages,
    setLoading,
    setCurrentPage,
    setPreferences,
    setTheme,
  } = useStore();

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [streamingMessage, setStreamingMessage] = useState('');

  // Initialize
  useEffect(() => {
    const init = async () => {
      // Load preferences
      const prefs = await storage.getPreferences();
      setPreferences(prefs);
      
      // Set theme
      const systemTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
      const activeTheme = prefs.theme === 'system' ? systemTheme : prefs.theme;
      setTheme(activeTheme);
      document.documentElement.classList.toggle('dark', activeTheme === 'dark');
      
      // Load chat history
      const history = await storage.getChatHistory(50);
      setMessages(history);
      
      // Initialize AI service
      await aiService.initialize();
      
      // Get current page content
      const response = await getPageContent();
      if (response.success && response.data) {
        setCurrentPage(response.data as PageContent);
      }
    };

    init();
  }, []);

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streamingMessage]);

  const handleSendMessage = async (content: string) => {
    // Add user message
    const userMessage: AIMessage = {
      role: 'user',
      content,
      timestamp: Date.now(),
    };
    
    addMessage(userMessage);
    await storage.addChatMessage(userMessage);
    
    setLoading(true);
    setStreamingMessage('');

    try {
      // Prepare messages with memory
      let messagesToSend = [...messages, userMessage];
      
      if (preferences.memoryEnabled) {
        messagesToSend = await memoryService.enhanceMessageWithMemory(messagesToSend);
      }
      
      // Add page context if available
      if (currentPage) {
        const systemMessage: AIMessage = {
          role: 'system',
          content: `Current page context:\nTitle: ${currentPage.title}\nURL: ${currentPage.url}\nExcerpt: ${currentPage.excerpt}`,
        };
        messagesToSend = [systemMessage, ...messagesToSend];
      }

      // Stream response
      let fullResponse = '';
      await aiService.chat(
        messagesToSend,
        (chunk) => {
          fullResponse += chunk;
          setStreamingMessage(fullResponse);
        }
      );

      // Add assistant message
      const assistantMessage: AIMessage = {
        role: 'assistant',
        content: fullResponse,
        timestamp: Date.now(),
      };
      
      addMessage(assistantMessage);
      await storage.addChatMessage(assistantMessage);
      setStreamingMessage('');
    } catch (error) {
      console.error('Chat error:', error);
      const errorMessage: AIMessage = {
        role: 'assistant',
        content: `错误: ${error instanceof Error ? error.message : '发送消息失败'}`,
        timestamp: Date.now(),
      };
      addMessage(errorMessage);
      setStreamingMessage('');
    } finally {
      setLoading(false);
    }
  };

  const handleQuickAction = async (action: string) => {
    let prompt = '';
    
    switch (action) {
      case 'summarize':
        prompt = '请总结当前页面的主要内容和关键要点。';
        break;
      case 'explain':
        prompt = '请详细解释当前页面的内容，帮助我更好地理解。';
        break;
      case 'translate':
        prompt = '请将当前页面的主要内容翻译成英文。';
        break;
      case 'qa':
        prompt = '我想问一些关于当前页面内容的问题。';
        break;
    }
    
    if (prompt) {
      handleSendMessage(prompt);
    }
  };

  return (
    <div className="flex flex-col h-screen bg-white dark:bg-gray-900">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-primary-600 rounded-lg flex items-center justify-center text-white font-bold">
            A
          </div>
          <h1 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            Atlas AI Assistant
          </h1>
        </div>
        {currentPage && (
          <div className="text-xs text-gray-500 dark:text-gray-400 truncate max-w-[200px]">
            {currentPage.title}
          </div>
        )}
      </div>

      {/* Quick Actions */}
      <QuickActions onAction={handleQuickAction} disabled={isLoading} />

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 scrollbar-thin">
        {messages.length === 0 && !streamingMessage && (
          <div className="flex flex-col items-center justify-center h-full text-center text-gray-500 dark:text-gray-400">
            <div className="text-4xl mb-4">👋</div>
            <h2 className="text-xl font-semibold mb-2">欢迎使用 Atlas</h2>
            <p className="text-sm">我可以帮您总结网页、回答问题、翻译内容等。</p>
            <p className="text-sm mt-2">使用快捷操作或直接输入消息开始对话。</p>
          </div>
        )}
        
        {messages.map((message, index) => (
          <ChatMessage key={index} message={message} />
        ))}
        
        {streamingMessage && (
          <ChatMessage 
            message={{ 
              role: 'assistant', 
              content: streamingMessage,
              timestamp: Date.now(),
            }} 
          />
        )}
        
        {isLoading && !streamingMessage && (
          <div className="flex justify-start mb-4">
            <div className="message-assistant">
              <div className="flex gap-1">
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-pulse"></div>
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-pulse" style={{ animationDelay: '0.2s' }}></div>
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-pulse" style={{ animationDelay: '0.4s' }}></div>
              </div>
            </div>
          </div>
        )}
        
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <ChatInput 
        onSend={handleSendMessage} 
        disabled={isLoading}
        placeholder={isLoading ? '正在思考...' : '输入消息...'}
      />
    </div>
  );
};

