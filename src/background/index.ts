import { aiService } from '@/services/ai-service';
import { summarizerService } from '@/services/summarizer';
import { historyAnalyzer } from './history-analyzer';
import type { ExtensionMessage, ExtensionResponse, PageContent } from '@/types';

console.log('Atlas extension background service worker started');

// Check sidePanel API availability
if (typeof chrome.sidePanel === 'undefined') {
  console.error('[Background] ❌ chrome.sidePanel API 不可用！');
  console.error('[Background] 请确保：');
  console.error('[Background] 1. 使用 Chrome 114+ 或 Edge 114+');
  console.error('[Background] 2. manifest.json 中包含 "sidePanel" 权限');
} else {
  console.log('[Background] ✅ chrome.sidePanel API 可用');
  // 设置点击图标直接打开侧边栏
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true })
    .catch((error) => console.error('[Background] setPanelBehavior failed:', error));
}

// Initialize services
aiService.initialize().catch(error => {
  console.error('[Background] AI Service initialization failed:', error);
});

// Schedule history analysis
try {
  historyAnalyzer.scheduleAnalysis();
} catch (error) {
  console.error('[Background] History analyzer scheduling failed:', error);
}

// Handle extension icon click - open side panel
// 设置点击图标直接打开侧边栏
if (chrome.sidePanel && chrome.sidePanel.setPanelBehavior) {
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true })
    .catch((error) => console.error('[Background] Failed to set panel behavior:', error));
}

chrome.action.onClicked.addListener(async (tab) => {
  try {
    // Fallback for older browsers or if setPanelBehavior is not supported
    if (tab.id) {
      await chrome.sidePanel.open({ tabId: tab.id });
    }
  } catch (error) {
    console.error('[Background] Failed to open side panel:', error);
  }
});

// Handle messages from content scripts and UI
chrome.runtime.onMessage.addListener((
  message: ExtensionMessage,
  sender,
  sendResponse: (response: ExtensionResponse) => void
) => {
  handleBackgroundMessage(message, sender)
    .then(sendResponse)
    .catch(error => {
      console.error('[Background] Message handler error:', error);
      sendResponse({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    });
  return true; // Keep message channel open
});

async function handleBackgroundMessage(
  message: ExtensionMessage,
  sender: chrome.runtime.MessageSender
): Promise<ExtensionResponse> {
  try {
    switch (message.type) {
      case 'OPEN_SIDEPANEL':
        console.log('[Background] 收到 OPEN_SIDEPANEL 消息');
        console.log('[Background] sender.tab:', sender.tab);

        // 如果消息来自 popup，sender.tab 为空，需要获取当前活动 tab
        let tabId = sender.tab?.id;
        if (!tabId) {
          console.log('[Background] sender.tab 为空，查询当前活动标签页');
          const [activeTab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
          console.log('[Background] 找到活动标签页:', activeTab);
          tabId = activeTab?.id;
        }

        if (tabId) {
          console.log('[Background] 尝试打开侧边栏, tabId:', tabId);
          try {
            await chrome.sidePanel.open({ tabId });
            console.log('[Background] ✅ 侧边栏打开成功');
            return { success: true };
          } catch (error) {
            console.error('[Background] ❌ 侧边栏打开失败:', error);
            return {
              success: false,
              error: error instanceof Error ? error.message : '打开侧边栏失败'
            };
          }
        } else {
          console.error('[Background] ❌ 无法找到活动标签页');
          return { success: false, error: '无法找到活动标签页' };
        }

      case 'SUMMARIZE_PAGE':
        const pageContent = message.payload as PageContent;
        const summary = await summarizerService.summarizePage(pageContent);
        return { success: true, data: summary };

      case 'ANALYZE_HISTORY':
        const insights = await historyAnalyzer.analyzeHistory();
        return { success: true, data: insights };

      case 'EXTRACT_CONTENT':
        // Forward to content script
        if (sender.tab?.id) {
          const response = await chrome.tabs.sendMessage(sender.tab.id, message);
          return response;
        }
        return { success: false, error: 'No active tab' };

      // DeepResearch: 搜索页面并提取搜索结果
      case 'DEEP_RESEARCH_SEARCH':
        return await handleDeepResearchSearch(message.payload as {
          url: string;
          engine: string;
          selectors: { result: string; title: string; link: string; snippet: string };
          maxResults: number;
        });

      // DeepResearch: 获取指定 URL 的页面内容
      case 'DEEP_RESEARCH_FETCH_PAGE':
        return await handleDeepResearchFetchPage(message.payload as { url: string });

      default:
        return { success: false, error: `Unknown message type: ${message.type}` };
    }
  } catch (error) {
    console.error('Background message handler error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

// Handle storage changes (e.g., API key updates)
chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName === 'local') {
    // Refresh AI providers if configs changed
    if (changes.provider_openai || changes.provider_anthropic || changes.provider_gemini || changes.provider_deepseek || changes.provider_qwen) {
      Object.keys(changes).forEach(key => {
        if (key.startsWith('provider_')) {
          const provider = key.replace('provider_', '') as 'openai' | 'anthropic' | 'gemini' | 'deepseek' | 'qwen';
          aiService.refreshProvider(provider);
        }
      });
    }
  }
});

// Context menu for quick actions
chrome.runtime.onInstalled.addListener(() => {
  // Create context menu items
  chrome.contextMenus.create({
    id: 'atlas-summarize',
    title: '总结此页面',
    contexts: ['page'],
  });

  chrome.contextMenus.create({
    id: 'atlas-explain',
    title: '解释选中内容',
    contexts: ['selection'],
  });

  chrome.contextMenus.create({
    id: 'atlas-translate',
    title: '翻译选中内容',
    contexts: ['selection'],
  });
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  try {
    if (!tab?.id) return;

    switch (info.menuItemId) {
      case 'atlas-summarize':
        // Open side panel and trigger summarization
        await chrome.sidePanel.open({ tabId: tab.id });
        // Send message to side panel
        chrome.runtime.sendMessage({
          type: 'TRIGGER_SUMMARIZE',
          payload: { tabId: tab.id },
        });
        break;

      case 'atlas-explain':
      case 'atlas-translate':
        await chrome.sidePanel.open({ tabId: tab.id });
        chrome.runtime.sendMessage({
          type: 'TRIGGER_ACTION',
          payload: {
            action: info.menuItemId.replace('atlas-', ''),
            text: info.selectionText,
          },
        });
        break;
    }
  } catch (error) {
    console.error('[Background] Context menu action failed:', error);
  }
});

// Keep service worker alive
const keepAlive = () => {
  setInterval(() => {
    try {
      chrome.runtime.getPlatformInfo(() => {
        // Simple call to prevent service worker from sleeping
      });
    } catch (error) {
      console.error('[Background] Keep alive failed:', error);
    }
  }, 20000); // Every 20 seconds
};

// Start keep alive mechanism
try {
  keepAlive();
} catch (error) {
  console.error('[Background] Failed to start keep alive:', error);
}

// ========================================
// DeepResearch 相关处理函数
// ========================================

/**
 * 处理 DeepResearch 搜索请求
 * 在新标签页中打开搜索页面并提取结果
 */
async function handleDeepResearchSearch(payload: {
  url: string;
  engine: string;
  selectors: {
    result: string;
    title: string;
    link: string;
    snippet: string;
  };
  maxResults: number;
}): Promise<ExtensionResponse> {
  console.log('[Background] 🔍 DeepResearch 搜索:', payload.url);

  try {
    // 创建新标签页（不激活，在后台执行）
    const tab = await chrome.tabs.create({
      url: payload.url,
      active: false,
    });

    if (!tab.id) {
      return { success: false, error: '无法创建标签页' };
    }

    // 等待页面加载完成
    await waitForTabLoad(tab.id, 15000);

    // 注入脚本提取搜索结果
    const results = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: extractSearchResults,
      args: [payload.selectors, payload.maxResults],
    });

    // 关闭标签页
    await chrome.tabs.remove(tab.id);

    if (results && results[0] && results[0].result) {
      console.log('[Background] ✅ 搜索完成，结果数:', results[0].result.length);
      return { success: true, data: results[0].result };
    }

    return { success: true, data: [] };
  } catch (error) {
    console.error('[Background] ❌ DeepResearch 搜索失败:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : '搜索失败',
    };
  }
}

/**
 * 处理 DeepResearch 页面获取请求
 * 访问指定 URL 并提取内容
 */
async function handleDeepResearchFetchPage(payload: {
  url: string;
}): Promise<ExtensionResponse> {
  console.log('[Background] 📄 DeepResearch 获取页面:', payload.url);

  try {
    // 创建新标签页
    const tab = await chrome.tabs.create({
      url: payload.url,
      active: false,
    });

    if (!tab.id) {
      return { success: false, error: '无法创建标签页' };
    }

    // 等待页面加载
    await waitForTabLoad(tab.id, 15000);

    // 注入脚本提取内容
    const results = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: extractPageContent,
    });

    // 关闭标签页
    await chrome.tabs.remove(tab.id);

    if (results && results[0] && results[0].result) {
      console.log('[Background] ✅ 页面内容获取成功');
      return { success: true, data: results[0].result };
    }

    return { success: false, error: '无法提取页面内容' };
  } catch (error) {
    console.error('[Background] ❌ DeepResearch 页面获取失败:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : '页面获取失败',
    };
  }
}

/**
 * 等待标签页加载完成
 */
function waitForTabLoad(tabId: number, timeout: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const startTime = Date.now();

    const checkStatus = async () => {
      try {
        const tab = await chrome.tabs.get(tabId);
        if (tab.status === 'complete') {
          // 额外等待一小段时间确保 JS 执行完成
          setTimeout(resolve, 500);
          return;
        }

        if (Date.now() - startTime > timeout) {
          reject(new Error('页面加载超时'));
          return;
        }

        setTimeout(checkStatus, 200);
      } catch (error) {
        reject(error);
      }
    };

    checkStatus();
  });
}

/**
 * 提取搜索结果（在页面中执行）
 */
function extractSearchResults(
  selectors: { result: string; title: string; link: string; snippet: string },
  maxResults: number
): Array<{ title: string; url: string; snippet: string }> {
  const results: Array<{ title: string; url: string; snippet: string }> = [];
  
  try {
    const elements = document.querySelectorAll(selectors.result);
    
    for (let i = 0; i < Math.min(elements.length, maxResults); i++) {
      const el = elements[i];
      
      // 提取标题
      const titleEl = el.querySelector(selectors.title);
      const title = titleEl?.textContent?.trim() || '';
      
      // 提取链接
      const linkEl = el.querySelector(selectors.link) as HTMLAnchorElement;
      const url = linkEl?.href || '';
      
      // 提取摘要
      const snippetEl = el.querySelector(selectors.snippet);
      const snippet = snippetEl?.textContent?.trim() || '';
      
      if (title && url && url.startsWith('http')) {
        results.push({ title, url, snippet });
      }
    }
  } catch (error) {
    console.error('提取搜索结果失败:', error);
  }
  
  return results;
}

/**
 * 提取页面内容（在页面中执行）
 */
function extractPageContent(): { title: string; url: string; content: string } {
  try {
    // 获取标题
    const title = document.title || '';
    
    // 获取 URL
    const url = window.location.href;
    
    // 获取正文内容
    let content = '';
    
    // 优先使用 article 标签
    const article = document.querySelector('article');
    if (article) {
      content = article.innerText;
    } else {
      // 尝试 main 标签
      const main = document.querySelector('main');
      if (main) {
        content = main.innerText;
      } else {
        // 回退到 body，但过滤一些不需要的元素
        const body = document.body.cloneNode(true) as HTMLElement;
        
        // 移除脚本、样式、导航等
        const removeSelectors = ['script', 'style', 'nav', 'header', 'footer', 'aside', 'iframe', 'noscript'];
        removeSelectors.forEach(sel => {
          body.querySelectorAll(sel).forEach(el => el.remove());
        });
        
        content = body.innerText;
      }
    }
    
    // 清理内容：移除多余空白
    content = content
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0)
      .join('\n')
      .substring(0, 50000); // 限制长度
    
    return { title, url, content };
  } catch (error) {
    console.error('提取页面内容失败:', error);
    return { title: '', url: '', content: '' };
  }
}

