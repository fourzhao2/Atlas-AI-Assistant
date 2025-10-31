// AI Provider Types
export type AIProviderType = 'openai' | 'anthropic' | 'gemini';

export interface AIMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp?: number;
}

export interface AIProviderConfig {
  apiKey: string;
  model?: string;
  baseUrl?: string;
}

export interface AIStreamResponse {
  content: string;
  done: boolean;
}

export interface AIProvider {
  name: AIProviderType;
  chat(messages: AIMessage[], onChunk: (chunk: string) => void): Promise<string>;
  chatWithTools?(messages: AIMessage[], tools: AITool[]): Promise<AIToolResponse>;
}

export interface AITool {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
}

export interface AIToolResponse {
  content: string;
  toolCalls?: AIToolCall[];
}

export interface AIToolCall {
  name: string;
  arguments: Record<string, unknown>;
}

// Page Content Types
export interface PageContent {
  title: string;
  url: string;
  content: string;
  excerpt?: string;
  siteName?: string;
}

export interface PageSummary {
  summary: string;
  keyPoints: string[];
  timestamp: number;
  url: string;
}

// Memory Types
export interface Memory {
  id: string;
  content: string;
  context: string;
  timestamp: number;
  tags?: string[];
}

export interface UserPreference {
  defaultProvider: AIProviderType;
  theme: 'light' | 'dark' | 'system';
  autoSummarize: boolean;
  agentMode: boolean;
  memoryEnabled: boolean;
}

// Agent Action Types
export interface AgentAction {
  type: 'click' | 'fill' | 'scroll' | 'navigate' | 'extract' | 
        'select' | 'check' | 'upload' | 'hover' | 'drag' | 'press' | 'wait' | 'submit';
  selector?: string;
  value?: string | boolean | string[];
  x?: number;
  y?: number;
  url?: string;
  targetSelector?: string; // for drag
  key?: string; // for press (Enter, Tab, Escape, etc.)
  timeout?: number; // for wait (milliseconds)
}

export interface AgentTask {
  id: string;
  description: string;
  actions: AgentAction[];
  status: 'pending' | 'running' | 'completed' | 'failed';
  result?: string;
}

export interface InteractiveElement {
  id: string;
  selector: string;
  type: string;
  tagName: string;
  text: string;
  value?: string;
  placeholder?: string;
  attributes: Record<string, string>;
  position: {
    top: number;
    left: number;
    width: number;
    height: number;
  };
  isVisible: boolean;
  context?: string;
}

export interface TaskPlan {
  actions: AgentAction[];
  complexity: 'simple' | 'complex';
  completed?: boolean;
  description?: string;
}

export interface ExecutionResult {
  success: boolean;
  steps?: string[];
  error?: string;
  data?: unknown;
}

export interface AgentExecutionStep {
  action: AgentAction;
  result: string;
  success: boolean;
  timestamp: number;
}

// History Analysis Types
export interface HistoryInsight {
  id: string;
  type: 'trend' | 'suggestion' | 'summary';
  title: string;
  description: string;
  data?: Record<string, unknown>;
  timestamp: number;
}

// Conversation Types
export interface Conversation {
  id: string;
  title: string;
  messages: AIMessage[];
  createdAt: number;
  updatedAt: number;
  pageUrl?: string;
}

// Storage Types
export interface StorageData {
  providers: Record<AIProviderType, AIProviderConfig>;
  preferences: UserPreference;
  memories: Memory[];
  chatHistory: AIMessage[]; // 废弃，保留兼容性
  summaries: PageSummary[];
  insights: HistoryInsight[];
  conversations: Conversation[];
  currentConversationId: string | null;
}

// Message Types for Chrome Extension Communication
export type MessageType =
  | 'EXTRACT_CONTENT'
  | 'SUMMARIZE_PAGE'
  | 'EXECUTE_AGENT_ACTION'
  | 'GET_PAGE_CONTEXT'
  | 'OPEN_SIDEPANEL'
  | 'SAVE_MEMORY'
  | 'ANALYZE_HISTORY'
  | 'GET_INTERACTIVE_DOM'
  | 'EXECUTE_AGENT_TASK'
  | 'STOP_AGENT_EXECUTION';

export interface ExtensionMessage<T = unknown> {
  type: MessageType;
  payload?: T;
}

export interface ExtensionResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

