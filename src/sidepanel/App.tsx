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
      console.log('[SidePanel] 开始初始化...');
      
      // Load preferences
      const prefs = await storage.getPreferences();
      setPreferences(prefs);
      console.log('[SidePanel] 用户偏好:', prefs);
      
      // Set theme
      const systemTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
      const activeTheme = prefs.theme === 'system' ? systemTheme : prefs.theme;
      setTheme(activeTheme);
      document.documentElement.classList.toggle('dark', activeTheme === 'dark');
      
      // Load chat history
      const history = await storage.getChatHistory(50);
      setMessages(history);
      console.log('[SidePanel] 加载历史消息:', history.length, '条');
      
      // Initialize AI service
      console.log('[SidePanel] 初始化 AI 服务...');
      await aiService.initialize();
      
      // Get current page content
      console.log('[SidePanel] 获取页面内容...');
      const response = await getPageContent();
      console.log('[SidePanel] 页面内容响应:', response);
      
      if (response.success && response.data) {
        setCurrentPage(response.data as PageContent);
        console.log('[SidePanel] 当前页面标题:', (response.data as PageContent).title);
        console.log('[SidePanel] 页面内容长度:', (response.data as PageContent).content?.length);
      } else {
        console.error('[SidePanel] 获取页面内容失败:', response.error);
      }
      
      console.log('[SidePanel] 初始化完成');
    };

    init();
  }, []);

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streamingMessage]);

  const handleSendMessage = async (content: string) => {
    console.log('[Chat] 发送消息:', content);
    
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
      console.log('[Chat] 开始准备消息...');
      
      // 重新获取当前页面内容
      const pageResponse = await getPageContent();
      if (pageResponse.success && pageResponse.data) {
        setCurrentPage(pageResponse.data as PageContent);
        console.log('[Chat] 已更新页面内容');
      }
      
      // Prepare messages with memory
      let messagesToSend = [...messages, userMessage];
      
      if (preferences.memoryEnabled) {
        messagesToSend = await memoryService.enhanceMessageWithMemory(messagesToSend);
      }
      
      // Add page context if available
      if (currentPage) {
        // 将页面内容直接添加到用户最后一条消息中
        const lastMessage = messagesToSend[messagesToSend.length - 1];
        const pageInfo = `

【当前网页信息】
标题：${currentPage.title}
网址：${currentPage.url}

【网页内容】
${currentPage.content.substring(0, 4000)}

---
用户问题：${lastMessage.content}`;

        // 修改最后一条消息，添加页面内容
        messagesToSend[messagesToSend.length - 1] = {
          ...lastMessage,
          content: pageInfo
        };
        
        console.log('[Chat] 已添加页面上下文，内容长度:', currentPage.content.length);
      } else {
        console.log('[Chat] 警告：当前页面内容为空');
      }

      // Stream response - 流式显示，实时更新
      console.log('[Chat] 调用 AI 服务，消息数量:', messagesToSend.length);
      
      let fullResponse = '';
      let isFirstChunk = true;
      await aiService.chat(
        messagesToSend,
        (chunk) => {
          // 收到第一个响应块时立即隐藏加载动画
          if (isFirstChunk) {
            console.log('[Chat] 收到第一个响应块');
            setLoading(false);
            isFirstChunk = false;
          }
          fullResponse += chunk;
          setStreamingMessage(fullResponse);
        }
      );
      
      console.log('[Chat] 响应完成，总长度:', fullResponse.length);

      // 流式完成，保存最终消息
      const assistantMessage: AIMessage = {
        role: 'assistant',
        content: fullResponse,
        timestamp: Date.now(),
      };
      
      addMessage(assistantMessage);
      await storage.addChatMessage(assistantMessage);
      setStreamingMessage('');
      setLoading(false);
    } catch (error) {
      console.error('[Chat] 错误:', error);
      
      let errorMsg = error instanceof Error ? error.message : '发送消息失败';
      
      // 检查是否是网络错误
      if (errorMsg.includes('Failed to fetch') || errorMsg.includes('NetworkError')) {
        errorMsg = '网络连接失败，请检查：\n1. 是否能访问 API 地址\n2. 网络是否正常\n3. API 地址是否正确';
      }
      
      const errorMessage: AIMessage = {
        role: 'assistant',
        content: `❌ 错误: ${errorMsg}\n\n💡 请检查：\n1. 扩展设置中是否已配置 API Key\n2. API Key 是否正确\n3. 自定义 API 地址是否正确\n4. 打开浏览器控制台查看详细日志`,
        timestamp: Date.now(),
      };
      addMessage(errorMessage);
      setStreamingMessage('');
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
            isStreaming={true}
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

