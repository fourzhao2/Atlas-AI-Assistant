// AI Provider Types
export type AIProviderType = 'openai' | 'anthropic' | 'gemini';

// 消息角色类型 - 支持 tool role
export type AIMessageRole = 'user' | 'assistant' | 'system' | 'tool';

// ========================================
// 多模态消息类型定义
// ========================================

/**
 * 支持的图片 MIME 类型
 */
export type ImageMediaType = 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp';

/**
 * 图片内容块 - 用于多模态消息
 */
export interface ImageContent {
  type: 'image';
  /** Base64 编码的图片数据（不含 data:xxx;base64, 前缀） */
  data: string;
  /** 图片的 MIME 类型 */
  mediaType: ImageMediaType;
  /** 图片详细程度：low 节省 token，high 更精确，auto 自动 */
  detail?: 'low' | 'high' | 'auto';
}

/**
 * 文本内容块
 */
export interface TextContent {
  type: 'text';
  text: string;
}

/**
 * 消息内容类型 - 可以是纯文本或多模态内容数组
 */
export type MessageContent = string | Array<TextContent | ImageContent>;

/**
 * 图片附件信息（用于 UI 显示）
 */
export interface ImageAttachment {
  id: string;
  data: string;           // Base64 数据
  mediaType: ImageMediaType;
  name?: string;          // 文件名
  size?: number;          // 文件大小（字节）
  width?: number;         // 图片宽度
  height?: number;        // 图片高度
}

export interface AIMessage {
  role: AIMessageRole;
  content: string;
  timestamp?: number;
  // Tool 相关字段
  tool_call_id?: string;      // tool role 消息需要关联的 tool_call id
  name?: string;              // tool role 消息的工具名称
  // 🖼️ 多模态支持
  images?: ImageAttachment[]; // 附带的图片
}

// Assistant 消息可能包含 tool_calls
export interface AIAssistantMessage extends AIMessage {
  role: 'assistant';
  tool_calls?: AIToolCallRequest[];
}

// Tool Call 请求（AI 返回的）
export interface AIToolCallRequest {
  id: string;                 // 唯一 ID，用于关联 tool 响应
  type: 'function';
  function: {
    name: string;
    arguments: string;        // JSON 字符串
  };
}

// 对话模式类型
export type ConversationMode = 'chat' | 'agent' | 'plan';

// Agent 模式配置
export interface AgentModeConfig {
  maxIterations: number;      // 最大循环次数，防止无限循环
  maxTokensPerIteration: number; // 每次迭代的最大 token
  tools: AITool[];            // 可用工具列表
  enableStreaming: boolean;   // 是否启用流式输出
  verbose: boolean;           // 是否输出详细日志
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

// ReAct Agent 相关类型
export type ReActPhase = 'idle' | 'thinking' | 'acting' | 'observing' | 'completed' | 'error';

export interface ReActStep {
  id: string;
  phase: ReActPhase;
  thought?: string;           // 思考内容
  action?: {                  // 行动
    tool: string;
    input: Record<string, unknown>;
  };
  observation?: string;       // 观察结果（工具返回）
  timestamp: number;
}

export interface ReActAgentState {
  mode: 'agent';
  phase: ReActPhase;
  steps: ReActStep[];
  messages: AIMessage[];      // 完整消息历史（包括 tool messages）
  currentIteration: number;
  maxIterations: number;
  totalTokens: number;
  isRunning: boolean;
  error?: string;
}

export interface ReActAgentResult {
  success: boolean;
  finalAnswer?: string;
  steps: ReActStep[];
  totalIterations: number;
  totalTokens: number;
  error?: string;
}

// ========================================
// Plan Mode 类型定义 (Planner + Navigator)
// ========================================

/**
 * Plan 模式的阶段
 */
export type PlanPhase = 
  | 'idle'           // 空闲
  | 'planning'       // Planner 正在规划
  | 'reviewing'      // 用户审核计划
  | 'executing'      // Navigator 正在执行
  | 'evaluating'     // Planner 评估执行结果
  | 'replanning'     // 重新规划
  | 'completed'      // 任务完成
  | 'error';         // 错误

/**
 * 计划步骤状态
 */
export type PlanStepStatus = 'pending' | 'running' | 'success' | 'failed' | 'skipped';

/**
 * 单个计划步骤
 */
export interface PlanStep {
  id: string;
  index: number;              // 步骤序号
  description: string;        // 人类可读的步骤描述
  action: AgentAction;        // 具体的操作
  status: PlanStepStatus;
  result?: string;            // 执行结果
  error?: string;             // 错误信息
  timestamp?: number;         // 执行时间
  retryCount?: number;        // 重试次数
}

/**
 * 完整的任务计划
 */
export interface TaskPlanFull {
  id: string;
  instruction: string;        // 原始用户指令
  goal: string;               // Planner 理解的目标
  steps: PlanStep[];          // 计划步骤
  currentStepIndex: number;   // 当前执行到的步骤
  status: 'draft' | 'approved' | 'executing' | 'paused' | 'completed' | 'failed';
  createdAt: number;
  updatedAt: number;
  completedAt?: number;
  totalRetries: number;       // 总重试次数
  maxRetries: number;         // 最大重试次数
}

/**
 * Planner Agent 配置
 */
export interface PlannerConfig {
  maxSteps: number;           // 单个计划的最大步骤数
  maxRetries: number;         // 最大重试次数
  requireApproval: boolean;   // 是否需要用户确认计划
  verbose: boolean;           // 是否输出详细日志
}

/**
 * Navigator Agent 配置
 */
export interface NavigatorConfig {
  stepTimeout: number;        // 单步超时时间（毫秒）
  waitAfterAction: number;    // 操作后等待时间
  maxElementsToAnalyze: number; // 分析的最大元素数
}

/**
 * Plan Mode 完整状态
 */
export interface PlanModeState {
  mode: 'plan';
  phase: PlanPhase;
  plan: TaskPlanFull | null;
  plannerThinking: string;    // Planner 的思考过程
  navigatorStatus: string;    // Navigator 的当前状态
  messages: AIMessage[];      // 消息历史
  isRunning: boolean;
  error?: string;
}

/**
 * Plan Mode 执行结果
 */
export interface PlanModeResult {
  success: boolean;
  plan: TaskPlanFull | null;
  summary?: string;           // 任务执行总结
  data?: unknown;             // 提取的数据（如有）
  error?: string;
}

/**
 * Planner 的响应
 */
export interface PlannerResponse {
  goal: string;               // 理解的目标
  reasoning: string;          // 推理过程
  steps: Array<{
    description: string;
    action: AgentAction;
  }>;
  confidence: number;         // 置信度 0-1
}

/**
 * Navigator 的执行反馈
 */
export interface NavigatorFeedback {
  stepId: string;
  success: boolean;
  result: string;
  domChanged: boolean;        // DOM 是否发生变化
  newElements?: string[];     // 新出现的重要元素
  error?: string;
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
  // 短期记忆相关
  summary?: string; // 历史对话摘要
  summaryTokens?: number; // 摘要的 token 数
}

// Short-term Memory Types (短期记忆类型)
export interface ShortTermMemoryConfig {
  maxTokens: number; // 最大 token 限制 (默认 4000)
  maxRecentMessages: number; // 保留的最近消息数量 (默认 10)
  summaryMaxTokens: number; // 摘要最大 token 数 (默认 500)
  enableSummarization: boolean; // 是否启用摘要压缩
}

export interface ShortTermMemoryState {
  summary: string | null; // 历史对话摘要
  recentMessages: AIMessage[]; // 最近的消息（保留原文）
  totalTokens: number; // 当前总 token 数
  wasSummarized: boolean; // 是否进行了摘要压缩
}

export interface ProcessedMessages {
  messages: AIMessage[]; // 处理后的消息数组（可直接发送给 AI）
  state: ShortTermMemoryState; // 短期记忆状态
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

// Translation Types
export type TranslationMode = 'sidebar' | 'inline' | 'hover' | 'selection';
export type TranslationLanguage = 'zh-CN' | 'en' | 'ja' | 'ko';
export type DocumentType = 'paper' | 'article' | 'documentation' | 'general';

export interface TranslationConfig {
  targetLanguage: TranslationLanguage;
  sourceLanguage?: TranslationLanguage;
  mode: TranslationMode;
  preserveTerms: boolean; // 保留专业术语的英文
  cacheEnabled: boolean; // 启用翻译缓存
  batchSize: number; // 批量翻译的大小
  showOriginal: boolean; // 是否显示原文
}

export interface TranslationContext {
  title?: string; // 文档标题
  documentType?: DocumentType; // 文档类型
  section?: string; // 当前章节
  field?: string; // 专业领域（如 AI, Biology等）
  previousContext?: string; // 前文内容（用于上下文理解）
}

export interface TranslationResult {
  id: string; // 唯一标识
  original: string; // 原文
  translated: string; // 译文
  terms?: TranslationTerm[]; // 识别的专业术语
  timestamp: number; // 翻译时间
  elementId?: string; // 关联的DOM元素ID
  cached?: boolean; // 是否来自缓存
}

export interface TranslationTerm {
  term: string; // 术语原文
  translation: string; // 术语翻译
  definition?: string; // 术语定义
  occurrences: number; // 出现次数
}

export interface TranslatableElement {
  id: string; // 元素唯一ID
  element: HTMLElement; // DOM元素引用
  selector: string; // CSS选择器
  type: 'heading' | 'paragraph' | 'list-item' | 'table-cell' | 'caption' | 'quote' | 'text'; // 元素类型
  content: string; // 待翻译内容
  priority: number; // 翻译优先级（1-10）
  translated?: boolean; // 是否已翻译
  translationId?: string; // 关联的翻译结果ID
}

export interface TranslationBatch {
  id: string;
  elements: TranslatableElement[];
  status: 'pending' | 'translating' | 'completed' | 'failed';
  progress: number; // 0-100
  results: TranslationResult[];
}

export interface TranslationCache {
  [key: string]: TranslationResult; // key为内容hash
}

export interface TranslationStats {
  totalTranslated: number; // 总翻译数量
  cacheHits: number; // 缓存命中次数
  apiCalls: number; // API调用次数
  estimatedCost: number; // 估算费用
}

