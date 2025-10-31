import { useEffect, useRef, useState } from 'react';
import { useStore } from '@/store';
import { storage } from '@/services/storage';
import { aiService } from '@/services/ai-service';
import { memoryService } from '@/services/memory';
import { conversationService } from '@/services/conversation';
import { agentExecutor } from '@/services/agent-executor';
import { agentTools } from '@/services/agent-tools';
import { getPageContent } from '@/utils/messaging';
import { measurePerf } from '@/utils/performance';
import { ChatMessage } from './components/ChatMessage';
import { ChatInput } from './components/ChatInput';
import { QuickActions } from './components/QuickActions';
import { Sidebar } from './components/Sidebar';
import { AgentExecutionPanel } from './components/AgentExecutionPanel';
import type { AIMessage, PageContent, AgentExecutionStep } from '@/types';

export const App = () => {
  const {
    messages,
    isLoading,
    currentPage,
    preferences,
    conversations,
    currentConversationId,
    sidebarOpen,
    addMessage,
    setMessages,
    setLoading,
    setCurrentPage,
    setPreferences,
    setTheme,
    setConversations,
    setCurrentConversationId,
    setSidebarOpen,
  } = useStore();

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [streamingMessage, setStreamingMessage] = useState('');
  const [agentExecuting, setAgentExecuting] = useState(false);
  const [agentSteps, setAgentSteps] = useState<AgentExecutionStep[]>([]);

  // Initialize
  useEffect(() => {
    const init = async () => {
      const perfStart = performance.now();
      console.log('[SidePanel] 🚀 开始并行初始化...');
      
      try {
        // 阶段1: 并行加载核心数据（最快，立即需要的）
        const [prefs, _] = await Promise.all([
          storage.getPreferences(),
          conversationService.migrateOldChatHistory(),
        ]);
        
        // 应用偏好设置
        let finalPrefs = prefs;
        if (!prefs.agentMode) {
          console.log('[SidePanel] ⚙️ 自动启用 Agent 模式');
          finalPrefs = { ...prefs, agentMode: true };
          // 异步保存，不阻塞
          storage.setPreferences(finalPrefs).catch(console.error);
        }
        
        setPreferences(finalPrefs);
        
        // 立即设置主题（不需要等待）
        const systemTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
        const activeTheme = finalPrefs.theme === 'system' ? systemTheme : finalPrefs.theme;
        setTheme(activeTheme);
        document.documentElement.classList.toggle('dark', activeTheme === 'dark');
        
        // 阶段2: 并行加载对话数据和AI服务
        const [allConversations, currentId, __] = await Promise.all([
          conversationService.getConversations(),
          storage.getCurrentConversationId(),
          aiService.initialize(),
        ]);
        
        setConversations(allConversations);
        setCurrentConversationId(currentId);
        console.log('[SidePanel] 加载对话:', allConversations.length, '个');
        
        // 阶段3: 加载当前对话消息（如果有）
        let currentMessages: AIMessage[] = [];
        if (currentId) {
          const currentConv = await storage.getConversation(currentId);
          if (currentConv) {
            currentMessages = currentConv.messages;
            setMessages(currentConv.messages);
            console.log('[SidePanel] 加载消息:', currentConv.messages.length, '条');
          }
        }
        
        // 阶段4: 并行检查配置和获取页面内容（允许失败）
        const [configs, pageResponse] = await Promise.all([
          storage.getAllProviderConfigs(),
          getPageContent().catch((err: Error) => {
            console.warn('[SidePanel] 页面内容获取失败（非致命）:', err);
            return { success: false as const, error: err.message };
          }),
        ]);
        
        // 检查是否需要显示欢迎消息
        const hasAnyProvider = configs.openai || configs.anthropic || configs.gemini;
        if (!hasAnyProvider && currentMessages.length === 0) {
          const welcomeMessage: AIMessage = {
            role: 'assistant',
            content: `👋 欢迎使用 Atlas AI 助手！\n\n` +
                     `要开始使用，请先配置 AI 提供商：\n\n` +
                     `📝 配置步骤：\n` +
                     `1. 点击右上角的扩展图标\n` +
                     `2. 选择"设置"或"选项"\n` +
                     `3. 在"AI 提供商"标签中配置您的 API Key\n\n` +
                     `💡 支持的提供商：\n` +
                     `• OpenAI GPT (推荐)\n` +
                     `• Anthropic Claude\n` +
                     `• Google Gemini\n\n` +
                     `⚡ 配置完成后，就可以开始使用了！`,
            timestamp: Date.now(),
          };
          addMessage(welcomeMessage);
        }
        
        // 更新页面内容（非阻塞）
        if ('data' in pageResponse && pageResponse.success && pageResponse.data) {
          setCurrentPage(pageResponse.data as PageContent);
          console.log('[SidePanel] 页面标题:', (pageResponse.data as PageContent).title);
        }
        
        const perfEnd = performance.now();
        console.log(`[SidePanel] ✅ 初始化完成，耗时: ${(perfEnd - perfStart).toFixed(2)}ms`);
      } catch (error) {
        console.error('[SidePanel] ❌ 初始化失败:', error);
        // 显示错误提示给用户
        addMessage({
          role: 'assistant',
          content: '⚠️ 初始化出现问题，请刷新页面重试。',
          timestamp: Date.now(),
        });
      }
    };

    init();
  }, []);

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streamingMessage]);

  const handleSendMessage = async (content: string) => {
    const endMeasure = measurePerf('发送消息');
    console.log('[Chat] 发送消息:', content);
    
    // 检查是否有当前对话
    if (!currentConversationId) {
      console.error('[Chat] 没有当前对话');
      const errorMessage: AIMessage = {
        role: 'assistant',
        content: '❌ 系统错误：没有活动对话。请刷新页面重试。',
        timestamp: Date.now(),
      };
      addMessage(errorMessage);
      return;
    }
    
    // 检查是否配置了API Key
    const configs = await storage.getAllProviderConfigs();
    const defaultConfig = configs[preferences.defaultProvider];
    
    if (!defaultConfig || !defaultConfig.apiKey) {
      const errorMessage: AIMessage = {
        role: 'assistant',
        content: `❌ 请先配置 ${preferences.defaultProvider.toUpperCase()} API Key\n\n` +
                 `📝 配置步骤：\n` +
                 `1. 点击扩展图标，选择"设置"\n` +
                 `2. 进入"AI 提供商"标签\n` +
                 `3. 配置您的 API Key\n\n` +
                 `💡 如果您没有 API Key，可以到官网申请：\n` +
                 `- OpenAI: https://platform.openai.com/\n` +
                 `- Anthropic: https://console.anthropic.com/\n` +
                 `- Google AI: https://ai.google.dev/`,
        timestamp: Date.now(),
      };
      addMessage(errorMessage);
      return;
    }
    
    // Add user message
    const userMessage: AIMessage = {
      role: 'user',
      content,
      timestamp: Date.now(),
    };
    
    addMessage(userMessage);
    
    // 批量更新：合并多个操作，减少storage写入
    const conversation = await storage.getConversation(currentConversationId);
    if (conversation) {
      // 自动生成标题（如果需要）
      let newTitle = conversation.title;
      if (conversation.title === '新对话' && conversation.messages.length === 0) {
        const titleText = userMessage.content.substring(0, 30);
        newTitle = titleText.length < userMessage.content.length ? titleText + '...' : titleText;
      }
      
      // 一次性更新对话（减少storage写入）
      await storage.updateConversation(currentConversationId, {
        messages: [...conversation.messages, userMessage],
        title: newTitle,
        updatedAt: Date.now(),
      });
      
      // 更新本地conversations状态
      const updatedConvs = conversations.map(c => 
        c.id === currentConversationId 
          ? { ...c, title: newTitle, updatedAt: Date.now() }
          : c
      );
      setConversations(updatedConvs);
    }
    
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

      // 🎯 使用 Function Calling 架构
      console.log('[Chat] 调用 AI 服务，消息数量:', messagesToSend.length);
      console.log('[Chat] Agent 模式状态:', preferences.agentMode ? '✅ 已启用' : '❌ 未启用');
      
      // Step 1: 如果启用了 Agent 模式，先用 chatWithTools 判断是否需要调用工具
      if (preferences.agentMode) {
        console.log('[Chat] 🤖 Agent 模式已启用，检查是否需要调用工具...');
        console.log('[Chat] 可用工具数量:', agentTools.length);
        console.log('[Chat] 工具列表:', agentTools.map(t => t.name));
        
        try {
          const toolResponse = await aiService.chatWithTools(
            messagesToSend,
            agentTools
          );
          
          console.log('[Chat] ✓ chatWithTools 响应:', {
            hasContent: !!toolResponse.content,
            hasToolCalls: !!toolResponse.toolCalls,
            toolCallsCount: toolResponse.toolCalls?.length || 0
          });
          
          // 检查是否有 tool calls
          if (toolResponse.toolCalls && toolResponse.toolCalls.length > 0) {
            console.log('[Chat] 🔧 AI 决定调用工具:', toolResponse.toolCalls);
            
            // 先显示 AI 的回复（如果有）
            if (toolResponse.content) {
              const preMessage: AIMessage = {
                role: 'assistant',
                content: toolResponse.content,
                timestamp: Date.now(),
              };
              
              addMessage(preMessage);
              
              if (currentConversationId) {
                await conversationService.addMessage(currentConversationId, preMessage);
              }
            }
            
            setLoading(false);
            
            // 执行 tool calls
            for (const toolCall of toolResponse.toolCalls) {
              console.log('[Chat] 执行 tool:', toolCall.name, toolCall.arguments);
              
              // 特殊处理 get_page_content
              if (toolCall.name === 'get_page_content') {
                console.log('[Chat] AI 请求获取页面内容');
                
                if (currentPage) {
                  const pageContentMsg: AIMessage = {
                    role: 'assistant',
                    content: `📄 **当前页面信息**\n\n**标题**: ${currentPage.title}\n**网址**: ${currentPage.url}\n\n**页面内容摘要**:\n${currentPage.excerpt || currentPage.content.substring(0, 500)}...`,
                    timestamp: Date.now()
                  };
                  
                  addMessage(pageContentMsg);
                  
                  if (currentConversationId) {
                    await conversationService.addMessage(currentConversationId, pageContentMsg);
                  }
                } else {
                  const errorMsg: AIMessage = {
                    role: 'assistant',
                    content: '⚠️ 无法获取页面内容，请刷新页面后重试。',
                    timestamp: Date.now()
                  };
                  
                  addMessage(errorMsg);
                  
                  if (currentConversationId) {
                    await conversationService.addMessage(currentConversationId, errorMsg);
                  }
                }
                
                continue;
              }
              
              // 其他 tool calls 转换为 Agent instruction
              const instruction = convertToolCallToInstruction(toolCall);
              
              if (instruction) {
                await handleAgentExecution(instruction);
              }
            }
            
            // 刷新对话列表
            if (currentConversationId) {
              const updatedConversations = await conversationService.getConversations();
              setConversations(updatedConversations);
            }
            
            return; // 完成，不需要继续流式响应
          }
          
          // 没有 tool calls，显示 AI 的文本回复
          if (toolResponse.content) {
            const assistantMessage: AIMessage = {
              role: 'assistant',
              content: toolResponse.content,
              timestamp: Date.now(),
            };
            
            addMessage(assistantMessage);
            
            if (currentConversationId) {
              await conversationService.addMessage(currentConversationId, assistantMessage);
              
              const updatedConversations = await conversationService.getConversations();
              setConversations(updatedConversations);
            }
            
            setLoading(false);
            return;
          }
        } catch (toolError) {
          console.warn('[Chat] Tool calling 失败，回退到流式响应:', toolError);
          // 如果 tool calling 失败，继续使用流式响应
        }
      }
      
      // Step 2: 流式响应（没有启用 Agent 或 tool calling 失败时）
      let fullResponse = '';
      let isFirstChunk = true;
      await aiService.chat(
        messagesToSend,
        (chunk) => {
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

      const assistantMessage: AIMessage = {
        role: 'assistant',
        content: fullResponse,
        timestamp: Date.now(),
      };
      
      addMessage(assistantMessage);
      
      if (currentConversationId) {
        await conversationService.addMessage(currentConversationId, assistantMessage);
        
        const updatedConversations = await conversationService.getConversations();
        setConversations(updatedConversations);
      }
      
      setStreamingMessage('');
      setLoading(false);
    } catch (error) {
      console.error('[Chat] 错误:', error);
      
      let errorMsg = error instanceof Error ? error.message : '发送消息失败';
      let troubleshootSteps = '';
      
      // 根据错误类型提供针对性的解决方案
      if (errorMsg.includes('Failed to fetch') || errorMsg.includes('NetworkError')) {
        troubleshootSteps = `🔍 网络连接问题，可能的原因：\n\n` +
                           `1. 无法访问 API 服务器\n` +
                           `   • 检查网络连接是否正常\n` +
                           `   • 如果使用自定义 API，确认地址正确\n` +
                           `   • 可能需要使用代理或VPN\n\n` +
                           `2. CORS 或防火墙问题\n` +
                           `   • 某些网络环境可能阻止请求\n` +
                           `   • 尝试更换网络环境\n\n` +
                           `3. API 服务暂时不可用\n` +
                           `   • 稍后再试`;
      } else if (errorMsg.includes('401') || errorMsg.includes('Unauthorized') || errorMsg.includes('API key')) {
        troubleshootSteps = `🔑 API Key 问题：\n\n` +
                           `1. API Key 可能无效或已过期\n` +
                           `2. 请检查设置中的 API Key 是否正确\n` +
                           `3. 确认 API Key 有足够的配额\n\n` +
                           `📝 如何解决：\n` +
                           `• 进入"设置" → "AI 提供商"\n` +
                           `• 重新配置正确的 API Key`;
      } else if (errorMsg.includes('429') || errorMsg.includes('rate limit')) {
        troubleshootSteps = `⏱️ 请求频率限制：\n\n` +
                           `API 调用过于频繁，请稍后再试。\n\n` +
                           `💡 建议：\n` +
                           `• 等待 1-2 分钟后重试\n` +
                           `• 考虑升级 API 套餐以获得更高配额`;
      } else if (errorMsg.includes('未配置')) {
        troubleshootSteps = `📋 配置检查清单：\n\n` +
                           `✓ 是否已配置 AI 提供商？\n` +
                           `✓ API Key 是否填写正确？\n` +
                           `✓ 默认提供商是否选择正确？\n\n` +
                           `📝 配置步骤：\n` +
                           `1. 点击扩展图标 → 设置\n` +
                           `2. 选择"AI 提供商"标签\n` +
                           `3. 配置您的 API Key`;
      } else {
        troubleshootSteps = `💡 常规排查步骤：\n\n` +
                           `1. 检查 API Key 配置是否正确\n` +
                           `2. 确认网络连接正常\n` +
                           `3. 检查自定义 API 地址（如有）\n` +
                           `4. 查看浏览器控制台的详细错误信息\n` +
                           `5. 尝试切换到其他 AI 提供商`;
      }
      
      const errorMessage: AIMessage = {
        role: 'assistant',
        content: `❌ 发送失败\n\n**错误信息**：${errorMsg}\n\n${troubleshootSteps}`,
        timestamp: Date.now(),
      };
      addMessage(errorMessage);
      setStreamingMessage('');
      setLoading(false);
    } finally {
      endMeasure();
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

  // Handle conversation actions
  const handleNewConversation = async () => {
    const pageResponse = await getPageContent();
    const pageUrl = pageResponse.success && pageResponse.data 
      ? (pageResponse.data as PageContent).url 
      : undefined;
    
    const newConv = await conversationService.createConversation(undefined, pageUrl);
    
    const updatedConversations = await conversationService.getConversations();
    setConversations(updatedConversations);
    setCurrentConversationId(newConv.id);
    setMessages([]);
    
    console.log('[Chat] 创建新对话:', newConv.id);
  };

  const handleSelectConversation = async (id: string) => {
    await conversationService.switchConversation(id);
    setCurrentConversationId(id);
    
    const conv = await storage.getConversation(id);
    if (conv) {
      setMessages(conv.messages);
      console.log('[Chat] 切换到对话:', id, '消息数:', conv.messages.length);
    }
    
    setSidebarOpen(false);
  };

  const handleDeleteConversation = async (id: string) => {
    await conversationService.deleteConversation(id);
    
    const updatedConversations = await conversationService.getConversations();
    setConversations(updatedConversations);
    
    const newCurrentId = await storage.getCurrentConversationId();
    setCurrentConversationId(newCurrentId);
    
    if (newCurrentId) {
      const conv = await storage.getConversation(newCurrentId);
      if (conv) {
        setMessages(conv.messages);
      }
    } else {
      setMessages([]);
    }
    
    console.log('[Chat] 删除对话:', id);
  };

  const handleRenameConversation = async (id: string, title: string) => {
    await conversationService.updateTitle(id, title);
    
    const updatedConversations = await conversationService.getConversations();
    setConversations(updatedConversations);
    
    console.log('[Chat] 重命名对话:', id, title);
  };

  // Agent 相关函数
  const convertToolCallToInstruction = (toolCall: { name: string; arguments: Record<string, unknown> }): string => {
    const args = toolCall.arguments;
    
    switch (toolCall.name) {
      case 'web_search':
        return `搜索 ${args.query}`;
      
      case 'navigate_to_url':
        return `打开 ${args.url}`;
      
      case 'click_element':
        return `点击 ${args.selector}`;
      
      case 'fill_form':
        return `在 ${args.selector} 填写 ${args.value}`;
      
      case 'scroll_page':
        return `滚动到 ${args.direction}`;
      
      case 'play_video':
        return `播放视频 ${args.query}`;
      
      case 'submit_form':
        return `提交表单`;
      
      case 'select_option':
        return `在 ${args.selector} 选择 ${args.value}`;
      
      default:
        return JSON.stringify(args);
    }
  };

  const handleAgentExecution = async (instruction: string) => {
    setAgentExecuting(true);
    setAgentSteps([]);
    
    try {
      const result = await agentExecutor.executeTask(instruction, {
        onStep: (step) => {
          setAgentSteps(prev => [...prev, step]);
          
          // 同时添加到聊天消息中
          const stepMessage: AIMessage = {
            role: 'assistant',
            content: `${step.success ? '✓' : '✗'} ${step.result}`,
            timestamp: step.timestamp
          };
          
          addMessage(stepMessage);
          
          if (currentConversationId) {
            conversationService.addMessage(currentConversationId, stepMessage);
          }
        },
        onComplete: async (result) => {
          setAgentExecuting(false);
          
          const completeMessage: AIMessage = {
            role: 'assistant',
            content: result.success 
              ? `✅ 任务完成！执行了 ${result.steps?.length || 0} 个步骤。`
              : `❌ 任务失败：${result.error}`,
            timestamp: Date.now()
          };
          
          addMessage(completeMessage);
          
          if (currentConversationId) {
            await conversationService.addMessage(currentConversationId, completeMessage);
            
            const updatedConversations = await conversationService.getConversations();
            setConversations(updatedConversations);
          }
        },
        onError: (error) => {
          setAgentExecuting(false);
          
          const errorMessage: AIMessage = {
            role: 'assistant',
            content: `❌ 执行错误：${error.message}`,
            timestamp: Date.now()
          };
          
          addMessage(errorMessage);
          
          if (currentConversationId) {
            conversationService.addMessage(currentConversationId, errorMessage);
          }
        }
      });
      
      console.log('[Chat] Agent 执行结果:', result);
    } catch (error) {
      console.error('[Chat] Agent 执行异常:', error);
      setAgentExecuting(false);
      
      const errorMessage: AIMessage = {
        role: 'assistant',
        content: `❌ 执行异常：${error instanceof Error ? error.message : '未知错误'}`,
        timestamp: Date.now()
      };
      
      addMessage(errorMessage);
    }
  };

  const handleStopAgent = () => {
    agentExecutor.stopExecution();
    setAgentExecuting(false);
  };

  return (
    <div className="flex h-screen bg-white dark:bg-gray-900">
      {/* Sidebar */}
      <Sidebar
        isOpen={sidebarOpen}
        conversations={conversations}
        currentConversationId={currentConversationId}
        onClose={() => setSidebarOpen(false)}
        onNewConversation={handleNewConversation}
        onSelectConversation={handleSelectConversation}
        onDeleteConversation={handleDeleteConversation}
        onRenameConversation={handleRenameConversation}
      />
      
      {/* Main Content */}
      <div className="flex flex-col flex-1 min-w-0">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              title="切换侧边栏"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
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
          
          {/* Agent Execution Panel */}
          {(agentExecuting || agentSteps.length > 0) && (
            <AgentExecutionPanel
              steps={agentSteps}
              isExecuting={agentExecuting}
              onStop={handleStopAgent}
            />
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
          disabled={isLoading || agentExecuting}
          placeholder={
            agentExecuting 
              ? '🤖 Agent 正在执行...' 
              : isLoading 
                ? '正在思考...' 
                : '输入消息...'
          }
        />
      </div>
    </div>
  );
};

