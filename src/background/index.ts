import { aiService } from '@/services/ai-service';
import { summarizerService } from '@/services/summarizer';
import { historyAnalyzer } from './history-analyzer';
import type { ExtensionMessage, ExtensionResponse, PageContent } from '@/types';

console.log('Atlas extension background service worker started');

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
chrome.action.onClicked.addListener(async (tab) => {
  try {
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
        if (sender.tab?.id) {
          await chrome.sidePanel.open({ tabId: sender.tab.id });
        }
        return { success: true };

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
    if (changes.provider_openai || changes.provider_anthropic || changes.provider_gemini) {
      Object.keys(changes).forEach(key => {
        if (key.startsWith('provider_')) {
          const provider = key.replace('provider_', '') as 'openai' | 'anthropic' | 'gemini';
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

