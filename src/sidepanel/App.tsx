import { useEffect, useRef, useState } from 'react';
import { useStore } from '@/store';
import { storage } from '@/services/storage';
import { aiService } from '@/services/ai-service';
import { memoryService } from '@/services/memory';
import { conversationService } from '@/services/conversation';
import { shortTermMemory } from '@/services/short-term-memory';
import { agentTools } from '@/services/agent-tools';
import { getPageContent } from '@/utils/messaging';
import { measurePerf } from '@/utils/performance';
import { useAgent } from '@/hooks/useAgent';
import { usePlanAgent } from '@/hooks/usePlanAgent';
import { ChatMessage } from './components/ChatMessage';
import { ChatInput } from './components/ChatInput';
import { Sidebar } from './components/Sidebar';
import { ReActPanel } from './components/ReActPanel';
import { PlanPanel } from './components/PlanPanel';
import type { AIMessage, PageContent, ShortTermMemoryState, ConversationMode, ImageAttachment } from '@/types';

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
  const [isSending, setIsSending] = useState(false); // 防止重复提交
  const currentRequestRef = useRef<AbortController | null>(null); // 用于取消请求
  
  // 短期记忆状态
  const [, setMemoryState] = useState<ShortTermMemoryState | null>(null);
  const [tokenUsage, setTokenUsage] = useState<{ usage: number; remaining: number } | null>(null);

  // 🎯 对话模式: chat | agent | plan
  const [conversationMode, setConversationMode] = useState<ConversationMode>('chat');

  // 🔄 使用 ReAct Agent Hook
  const agent = useAgent({
    onMessage: (message) => {
      addMessage(message);
      if (currentConversationId) {
        conversationService.addMessage(currentConversationId, message);
      }
    },
    conversationId: currentConversationId,
  });

  // 📋 使用 Plan Agent Hook (Planner + Navigator)
  const planAgent = usePlanAgent({
    onMessage: (message) => {
      addMessage(message);
    },
    conversationId: currentConversationId,
    requireApproval: false, // 可以设置为 true 要求用户确认计划
  });

  // Listen for messages from popup or background
  useEffect(() => {
    const messageListener = (
      message: { type: string; payload?: any },
      _sender: chrome.runtime.MessageSender,
      _sendResponse: (response?: any) => void
    ) => {
      console.log('[SidePanel] 收到消息:', message);

      if (message.type === 'TRIGGER_ACTION') {
        const action = message.payload?.action;
        if (action) {
          console.log('[SidePanel] 触发快捷操作:', action);

          // 延迟一下，确保侧边栏已经完全加载和状态初始化
          setTimeout(() => {
            // 使用内部定义的 triggerAction 函数
            const triggerAction = (actionType: string) => {
              // 对于 summarize,调用 AI 进行总结
              if (actionType === 'summarize') {
                const prompt = '请详细总结当前页面的内容,包括主要观点、关键信息和核心内容。';
                handleSendMessage(prompt);
                return;
              }

              // 其他操作
              let prompt = '';
              switch (actionType) {
                case 'explain':
                  prompt = '请详细解释当前页面的内容，帮助我更好地理解。';
                  break;
                case 'translate':
                  // 使用专业的学术翻译提示词
                  prompt = `请作为专业的学术翻译助手，将当前页面的内容翻译成中文。

【翻译要求】
1. 保持学术严谨性和专业性
2. 专业术语首次出现时保留英文原文，用括号注释中文翻译，例如："Transformer (转换器)"
3. 后续出现的相同术语只保留英文，确保术语一致性
4. 翻译要流畅自然，符合中文表达习惯
5. 保持原文的段落结构和语气
6. 数字、公式、代码、引用格式保持不变

请直接翻译当前页面的主要内容，包括标题、摘要和主要章节。`;
                  break;
                case 'qa':
                  prompt = '我想问一些关于当前页面内容的问题。';
                  break;
              }

              if (prompt) {
                handleSendMessage(prompt);
              }
            };

            triggerAction(action);
          }, 300);
        }
      }

      if (message.type === 'TRIGGER_SUMMARIZE' || message.type === 'SHOW_PAGE_SUMMARY') {
        console.log('[SidePanel] 触发总结操作');

        // 延迟执行,确保组件已完全初始化
        setTimeout(() => {
          console.log('[SidePanel] 开始调用AI总结页面');
          const prompt = '请详细总结当前页面的内容,包括主要观点、关键信息和核心内容。';
          handleSendMessage(prompt);
        }, 300);
      }
    };

    chrome.runtime.onMessage.addListener(messageListener);

    return () => {
      chrome.runtime.onMessage.removeListener(messageListener);
    };
  }, []); // 空依赖数组，只在挂载时注册一次

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

  const handleSendMessage = async (content: string, images?: ImageAttachment[]) => {
    // 🔒 防止重复提交
    if (isSending) {
      console.warn('[Chat] ⚠️ 消息正在发送中，请稍候...');
      return;
    }

    // 🖼️ 多模态日志
    if (images && images.length > 0) {
      console.log('[Chat] 🖼️ 发送多模态消息，包含图片:', images.length);
    }

    // 📋 如果是 Plan 模式，使用 Plan Agent 处理
    if (conversationMode === 'plan') {
      console.log('[Chat] 📋 使用 Plan 模式处理:', content);
      setIsSending(true);
      
      // 添加用户消息（包含图片）
      const userMessage: AIMessage = {
        role: 'user',
        content,
        timestamp: Date.now(),
        images, // 🖼️ 添加图片
      };
      addMessage(userMessage);
      
      if (currentConversationId) {
        await conversationService.addMessage(currentConversationId, userMessage);
      }
      
      try {
        await planAgent.execute(content);
      } catch (error) {
        console.error('[Chat] Plan 模式执行失败:', error);
      } finally {
        setIsSending(false);
      }
      return;
    }

    const endMeasure = measurePerf('发送消息');
    console.log('[Chat] 发送消息:', content);

    // 取消之前的请求（如果有）
    if (currentRequestRef.current) {
      console.log('[Chat] 取消之前的请求');
      currentRequestRef.current.abort();
    }

    // 创建新的请求控制器
    currentRequestRef.current = new AbortController();

    setIsSending(true); // 设置发送中标志

    // 检查是否有当前对话
    if (!currentConversationId) {
      console.error('[Chat] 没有当前对话');
      const errorMessage: AIMessage = {
        role: 'assistant',
        content: '❌ 系统错误：没有活动对话。请刷新页面重试。',
        timestamp: Date.now(),
      };
      addMessage(errorMessage);
      setIsSending(false); // 重置发送状态
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
      setIsSending(false); // 重置发送状态
      return;
    }

    // Add user message（包含图片）
    const userMessage: AIMessage = {
      role: 'user',
      content,
      timestamp: Date.now(),
      images, // 🖼️ 添加图片附件
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

      // Prepare messages with memory (短期记忆 + 长期记忆)
      let messagesToSend = [...messages, userMessage];

      // Step 1: 应用短期记忆管理 - Token 限制和摘要压缩
      console.log('[Chat] 🧠 应用短期记忆管理...');
      const { processedMessages, state: shortTermState } = await conversationService.processMessagesWithMemory(
        currentConversationId,
        messagesToSend
      );
      
      messagesToSend = processedMessages;
      setMemoryState(shortTermState);
      
      // 更新 token 使用统计
      const stats = shortTermMemory.getTokenStats(messagesToSend);
      setTokenUsage({ usage: stats.usage, remaining: stats.remaining });
      
      console.log('[Chat] 短期记忆状态:', {
        wasSummarized: shortTermState.wasSummarized,
        hasSummary: !!shortTermState.summary,
        recentMessagesCount: shortTermState.recentMessages.length,
        totalTokens: shortTermState.totalTokens,
        tokenUsage: `${stats.usage}%`
      });

      // Step 2: 应用长期记忆 - 检索相关记忆
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
                  // 🔄 将页面内容反馈给 AI，让它继续回答
                  console.log('[Chat] 将页面内容发送给 AI...');
                  const contextMsg: AIMessage = {
                    role: 'user',
                    content: `[System] Page Content:\nTitle: ${currentPage.title}\nURL: ${currentPage.url}\nContent:\n${currentPage.content.substring(0, 20000)}`,
                    timestamp: Date.now()
                  };

                  try {
                    const nextResponse = await aiService.chatWithTools(
                      [...messagesToSend, contextMsg],
                      agentTools
                    );

                    if (nextResponse.content) {
                      const finalMsg: AIMessage = {
                        role: 'assistant',
                        content: nextResponse.content,
                        timestamp: Date.now()
                      };
                      addMessage(finalMsg);
                      if (currentConversationId) {
                        await conversationService.addMessage(currentConversationId, finalMsg);
                      }
                    }
                  } catch (err) {
                    console.error('[Chat] 后续对话失败:', err);
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
                // 使用 ReAct Agent 执行
                const result = await agent.execute(instruction);

                // 🔄 将执行结果反馈给 AI
                if (result.success) {
                  console.log('[Chat] Agent 执行完成，将结果反馈给 AI...');
                  const toolOutput = result.steps && result.steps.length > 0
                    ? result.steps.join('\n')
                    : 'Task completed successfully.';

                  const contextMsg: AIMessage = {
                    role: 'user',
                    content: `[System] Tool Execution Result:\n${toolOutput}`,
                    timestamp: Date.now()
                  };

                  try {
                    // 获取最新的对话上下文（包含 Agent 生成的中间步骤消息）
                    // 注意：这里简化处理，直接使用 messagesToSend + contextMsg
                    // 理想情况下应该重新获取 store 中的 messages，但 agent.execute 产生的消息可能还没完全同步到 store

                    const nextResponse = await aiService.chatWithTools(
                      [...messagesToSend, contextMsg],
                      agentTools
                    );

                    if (nextResponse.content) {
                      const finalMsg: AIMessage = {
                        role: 'assistant',
                        content: nextResponse.content,
                        timestamp: Date.now()
                      };
                      addMessage(finalMsg);
                      if (currentConversationId) {
                        await conversationService.addMessage(currentConversationId, finalMsg);
                      }
                    }
                  } catch (err) {
                    console.error('[Chat] Agent 后续对话失败:', err);
                  }
                }
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
    } catch (error: any) {
      console.error('[Chat] 错误:', error);

      // 🔒 如果是取消请求，静默处理
      if (error?.name === 'AbortError') {
        console.log('[Chat] 请求已取消');
        setStreamingMessage('');
        setLoading(false);
        return;
      }

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
      setIsSending(false); // 清除发送中标志
      currentRequestRef.current = null; // 清除请求引用
    }
  };

  const handleQuickAction = async (action: string) => {

    // 其他操作：发送提示给 AI
    let prompt = '';

    switch (action) {
      case 'summarize':
        prompt = '请详细总结当前页面的内容,包括主要观点、关键信息和核心内容。';
        break;
      case 'explain':
        prompt = '请详细解释当前页面的内容，帮助我更好地理解。';
        break;
      case 'translate':
        // 使用专业的学术翻译提示词
        prompt = `请作为专业的学术翻译助手，将当前页面的内容翻译成中文。

【翻译要求】
1. 保持学术严谨性和专业性
2. 专业术语首次出现时保留英文原文，用括号注释中文翻译，例如："Transformer (转换器)"
3. 后续出现的相同术语只保留英文，确保术语一致性
4. 翻译要流畅自然，符合中文表达习惯
5. 保持原文的段落结构和语气
6. 数字、公式、代码、引用格式保持不变

请直接翻译当前页面的主要内容，包括标题、摘要和主要章节。`;
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
    // 🔒 取消正在进行的请求
    if (currentRequestRef.current) {
      console.log('[Chat] 取消正在进行的消息发送');
      currentRequestRef.current.abort();
      currentRequestRef.current = null;
    }

    // 停止Agent执行
    if (agent.isExecuting) {
      console.log('[Chat] 停止ReAct Agent执行');
      agent.stop();
    }

    // 清除loading状态
    setLoading(false);
    setIsSending(false);
    setStreamingMessage('');

    // 🧠 切换前：从当前对话提取长期记忆
    if (currentConversationId && currentConversationId !== id && preferences.memoryEnabled) {
      console.log('[Chat] 🧠 提取当前对话的长期记忆...');
      // 异步提取，不阻塞切换
      conversationService.extractLongTermMemories(currentConversationId).catch(err => {
        console.error('[Chat] 提取长期记忆失败:', err);
      });
    }

    await conversationService.switchConversation(id);
    setCurrentConversationId(id);

    const conv = await storage.getConversation(id);
    if (conv) {
      setMessages(conv.messages);
      console.log('[Chat] 切换到对话:', id, '消息数:', conv.messages.length);
      
      // 更新 token 使用统计
      const stats = shortTermMemory.getTokenStats(conv.messages, conv.summary);
      setTokenUsage({ usage: stats.usage, remaining: stats.remaining });
      setMemoryState(conv.summary ? {
        summary: conv.summary,
        recentMessages: conv.messages,
        totalTokens: stats.totalTokens,
        wasSummarized: false
      } : null);
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

  // ✅ Agent 执行已由 useAgent Hook 处理

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
        <div className="flex items-center justify-between px-3 py-2 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              title="切换侧边栏"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
            <div className="w-6 h-6 bg-gradient-to-br from-blue-500 to-purple-600 rounded-md flex items-center justify-center text-white text-xs font-bold">
              A
            </div>
            <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">
              Atlas
            </span>
          </div>

          {/* 模式切换器 - 紧凑的分段控制器 */}
          <div className="flex items-center bg-gray-100 dark:bg-gray-700 rounded-lg p-0.5">
            <button
              onClick={() => setConversationMode('chat')}
              className={`px-2 py-1 text-xs font-medium rounded-md transition-all ${
                conversationMode === 'chat'
                  ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow-sm'
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
              }`}
              title="对话模式"
            >
              💬
            </button>
            <button
              onClick={() => setConversationMode('agent')}
              className={`px-2 py-1 text-xs font-medium rounded-md transition-all ${
                conversationMode === 'agent'
                  ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow-sm'
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
              }`}
              title="Agent 模式 (ReAct)"
            >
              🤖
            </button>
            <button
              onClick={() => setConversationMode('plan')}
              className={`px-2 py-1 text-xs font-medium rounded-md transition-all ${
                conversationMode === 'plan'
                  ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow-sm'
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
              }`}
              title="Plan 模式 (Planner + Navigator)"
            >
              📋
            </button>
          </div>

          {/* Token 使用情况 */}
          <div className="flex items-center gap-2">
            {tokenUsage && (
              <div className="flex items-center gap-1" title={`Token: ${tokenUsage.usage}% 已使用`}>
                <div className="w-12 h-1 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                  <div 
                    className={`h-full transition-all duration-300 ${
                      tokenUsage.usage > 80 ? 'bg-red-500' : 
                      tokenUsage.usage > 50 ? 'bg-yellow-500' : 'bg-green-500'
                    }`}
                    style={{ width: `${Math.min(100, tokenUsage.usage)}%` }}
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Quick Actions + 模式指示器 */}
        <div className="flex items-center justify-between px-3 py-2 border-b border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-900/30">
          <div className="flex items-center gap-1.5 flex-wrap">
            <button
              onClick={() => handleQuickAction('summarize')}
              disabled={isLoading || planAgent.isExecuting}
              className="px-2.5 py-1 text-xs font-medium rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:border-blue-300 dark:hover:border-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-all disabled:opacity-50"
            >
              📝 总结
            </button>
            <button
              onClick={() => handleQuickAction('explain')}
              disabled={isLoading || planAgent.isExecuting}
              className="px-2.5 py-1 text-xs font-medium rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:border-green-300 dark:hover:border-green-600 hover:bg-green-50 dark:hover:bg-green-900/20 transition-all disabled:opacity-50"
            >
              💡 解释
            </button>
            <button
              onClick={() => handleQuickAction('translate')}
              disabled={isLoading || planAgent.isExecuting}
              className="px-2.5 py-1 text-xs font-medium rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:border-purple-300 dark:hover:border-purple-600 hover:bg-purple-50 dark:hover:bg-purple-900/20 transition-all disabled:opacity-50"
            >
              🌐 翻译
            </button>
          </div>
          
          {/* 当前模式指示器 */}
          <div className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${
            conversationMode === 'chat' 
              ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400'
              : conversationMode === 'agent'
                ? 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400'
                : 'bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400'
          }`}>
            {conversationMode === 'chat' ? '对话' : conversationMode === 'agent' ? 'Agent' : 'Plan'}
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 scrollbar-thin">
          {messages.length === 0 && !streamingMessage && (
            <div className="flex flex-col items-center justify-center h-full text-center text-gray-500 dark:text-gray-400">
              <div className="text-4xl mb-3">👋</div>
              <h2 className="text-lg font-semibold mb-1 text-gray-700 dark:text-gray-200">欢迎使用 Atlas</h2>
              <p className="text-xs max-w-[240px]">
                {conversationMode === 'chat' && '我可以帮您总结网页、回答问题、翻译内容等。'}
                {conversationMode === 'agent' && '我会边思考边执行，自动完成网页操作任务。'}
                {conversationMode === 'plan' && '输入复杂任务，我会先制定计划再逐步执行。'}
              </p>
              
              {/* 模式说明卡片 */}
              <div className={`mt-4 p-3 rounded-lg max-w-[280px] ${
                conversationMode === 'chat' 
                  ? 'bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800'
                  : conversationMode === 'agent'
                    ? 'bg-green-50 dark:bg-green-900/20 border border-green-100 dark:border-green-800'
                    : 'bg-purple-50 dark:bg-purple-900/20 border border-purple-100 dark:border-purple-800'
              }`}>
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="text-lg">
                    {conversationMode === 'chat' ? '💬' : conversationMode === 'agent' ? '🤖' : '📋'}
                  </span>
                  <span className={`text-xs font-semibold ${
                    conversationMode === 'chat' 
                      ? 'text-blue-700 dark:text-blue-300'
                      : conversationMode === 'agent'
                        ? 'text-green-700 dark:text-green-300'
                        : 'text-purple-700 dark:text-purple-300'
                  }`}>
                    {conversationMode === 'chat' ? '对话模式' : conversationMode === 'agent' ? 'Agent 模式' : 'Plan 模式'}
                  </span>
                </div>
                <p className={`text-[10px] ${
                  conversationMode === 'chat' 
                    ? 'text-blue-600 dark:text-blue-400'
                    : conversationMode === 'agent'
                      ? 'text-green-600 dark:text-green-400'
                      : 'text-purple-600 dark:text-purple-400'
                }`}>
                  {conversationMode === 'chat' && '直接与 AI 对话，获取信息和帮助'}
                  {conversationMode === 'agent' && 'ReAct 循环：思考 → 行动 → 观察'}
                  {conversationMode === 'plan' && 'Planner 规划 + Navigator 执行'}
                </p>
              </div>
            </div>
          )}

          {/* Plan Mode Panel */}
          {conversationMode === 'plan' && planAgent.hasPlan && (
            <PlanPanel
              plan={planAgent.plan}
              phase={planAgent.phase}
              plannerThinking={planAgent.plannerThinking}
              navigatorStatus={planAgent.navigatorStatus}
              currentStep={planAgent.currentStep}
              isExecuting={planAgent.isExecuting}
              progress={planAgent.progress}
              onApprove={planAgent.approvePlan}
              onStop={planAgent.stop}
              onReset={planAgent.reset}
            />
          )}

          {/* ReAct Agent Panel */}
          {conversationMode !== 'plan' && agent.hasSteps && (
            <ReActPanel
              steps={agent.reactSteps}
              currentPhase={agent.phase}
              isExecuting={agent.isExecuting}
              onStop={agent.stop}
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
          disabled={isLoading || agent.isExecuting || planAgent.isExecuting || isSending}
          placeholder={
            planAgent.isExecuting
              ? `📋 Plan 模式执行中 (${planAgent.progress.percentage}%)...`
              : agent.isExecuting
                ? '🤖 ReAct Agent 正在执行...'
                : isLoading
                  ? '正在思考...'
                  : conversationMode === 'plan'
                    ? '输入任务，AI 会制定计划并执行...'
                    : '输入消息...'
          }
        />
      </div>
    </div>
  );
};

