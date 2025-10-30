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
  if (!tab?.id) {
    return { success: false, error: 'No active tab' };
  }

  return sendMessageToTab(tab.id, { type: 'EXTRACT_CONTENT' });
}

export async function getPageContext(): Promise<ExtensionResponse> {
  const tab = await getCurrentTab();
  if (!tab?.id) {
    return { success: false, error: 'No active tab' };
  }

  return sendMessageToTab(tab.id, { type: 'GET_PAGE_CONTEXT' });
}

