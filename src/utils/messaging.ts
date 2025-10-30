import type { ExtensionMessage, ExtensionResponse } from '@/types';

export async function sendMessage<T = unknown>(
  message: ExtensionMessage
): Promise<ExtensionResponse<T>> {
  try {
    const response = await chrome.runtime.sendMessage(message);
    return response as ExtensionResponse<T>;
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Message failed',
    };
  }
}

export async function sendMessageToTab<T = unknown>(
  tabId: number,
  message: ExtensionMessage
): Promise<ExtensionResponse<T>> {
  try {
    const response = await chrome.tabs.sendMessage(tabId, message);
    return response as ExtensionResponse<T>;
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Message failed',
    };
  }
}

export async function getCurrentTab(): Promise<chrome.tabs.Tab | null> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab || null;
}

export async function getPageContent(): Promise<ExtensionResponse> {
  const tab = await getCurrentTab();
  console.log('[Messaging] 当前标签页:', tab);
  
  if (!tab?.id) {
    console.error('[Messaging] 没有活动标签页');
    return { success: false, error: 'No active tab' };
  }

  // 检查是否是特殊页面（chrome://, edge://, 扩展页面等）
  if (tab.url?.startsWith('chrome://') || 
      tab.url?.startsWith('edge://') || 
      tab.url?.startsWith('chrome-extension://')) {
    console.warn('[Messaging] 特殊页面，无法注入脚本:', tab.url);
    return { 
      success: false, 
      error: '此页面不支持内容提取（浏览器特殊页面）' 
    };
  }

  console.log('[Messaging] 向标签页发送 EXTRACT_CONTENT 消息, tabId:', tab.id);
  const response = await sendMessageToTab(tab.id, { type: 'EXTRACT_CONTENT' });
  console.log('[Messaging] 页面内容提取结果:', response);
  
  // 如果 Content Script 未加载，尝试手动注入
  if (!response.success && response.error?.includes('Receiving end does not exist')) {
    console.warn('[Messaging] Content Script 未加载，尝试手动注入...');
    
    try {
      // 手动注入 Content Script
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ['content.js']
      });
      
      console.log('[Messaging] Content Script 注入成功，重试获取内容...');
      
      // 等待一下让脚本初始化
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // 重试
      const retryResponse = await sendMessageToTab(tab.id, { type: 'EXTRACT_CONTENT' });
      console.log('[Messaging] 重试结果:', retryResponse);
      
      return retryResponse;
    } catch (injectError) {
      console.error('[Messaging] 手动注入失败:', injectError);
      return {
        success: false,
        error: '💡 请刷新页面后重试（按 F5）'
      };
    }
  }
  
  return response;
}

export async function getPageContext(): Promise<ExtensionResponse> {
  const tab = await getCurrentTab();
  if (!tab?.id) {
    return { success: false, error: 'No active tab' };
  }

  return sendMessageToTab(tab.id, { type: 'GET_PAGE_CONTEXT' });
}

