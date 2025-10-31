import { contentExtractor } from './extractor';
import { pageAgent } from './agent';
import type { ExtensionMessage, ExtensionResponse, AgentAction } from '@/types';

// Listen for messages from the extension
chrome.runtime.onMessage.addListener((
  message: ExtensionMessage,
  _sender,
  sendResponse: (response: ExtensionResponse) => void
) => {
  handleMessage(message).then(sendResponse);
  return true; // Keep the message channel open for async response
});

async function handleMessage(message: ExtensionMessage): Promise<ExtensionResponse> {
  try {
    switch (message.type) {
      case 'EXTRACT_CONTENT':
        const content = contentExtractor.extractPageContent();
        return { success: true, data: content };

      case 'GET_PAGE_CONTEXT':
        const context = contentExtractor.getPageContext();
        return { success: true, data: context };

      case 'GET_INTERACTIVE_DOM':
        console.log('[Content] 提取可交互 DOM');
        const interactiveElements = contentExtractor.extractInteractiveDOM();
        return { success: true, data: interactiveElements };

      case 'EXECUTE_AGENT_ACTION':
        if (!message.payload) {
          return { success: false, error: 'No action provided' };
        }
        const action = message.payload as AgentAction;
        const result = await pageAgent.executeAction(action);
        return { success: true, data: result };

      case 'STOP_AGENT_EXECUTION':
        console.log('[Content] 停止 Agent 执行');
        return { success: true, data: 'Agent execution stopped' };

      default:
        return { success: false, error: `Unknown message type: ${message.type}` };
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

// Add a visual indicator when the extension is active
const indicator = document.createElement('div');
indicator.id = 'atlas-extension-indicator';
indicator.style.cssText = `
  position: fixed;
  top: 10px;
  right: 10px;
  width: 8px;
  height: 8px;
  background: #10b981;
  border-radius: 50%;
  z-index: 999999;
  opacity: 0;
  transition: opacity 0.3s;
  pointer-events: none;
`;
document.body.appendChild(indicator);

// Show indicator briefly when content script loads
indicator.style.opacity = '1';
setTimeout(() => {
  indicator.style.opacity = '0';
}, 2000);

console.log('Atlas extension content script loaded');

