/**
 * DeepResearch 类型定义
 * 
 * 实现 IterResearch 迭代研究范式
 * 支持多轮搜索、信息聚合、研究报告生成
 */

import type { AIMessage } from './index';

// ========================================
// 阶段和状态类型
// ========================================

/**
 * DeepResearch 阶段
 */
export type DeepResearchPhase = 
  | 'idle'           // 空闲
  | 'planning'       // 规划研究策略
  | 'searching'      // 搜索中
  | 'browsing'       // 浏览页面中
  | 'analyzing'      // 分析内容中
  | 'evaluating'     // 评估是否充足
  | 'waiting'        // 等待用户确认（交互模式）
  | 'generating'     // 生成报告中
  | 'completed'      // 完成
  | 'error';         // 错误

/**
 * 搜索引擎类型
 */
export type SearchEngine = 'google' | 'bing' | 'baidu';

/**
 * 研究深度
 */
export type ResearchDepth = 'shallow' | 'medium' | 'deep';

// ========================================
// 搜索相关类型
// ========================================

/**
 * 搜索结果
 */
export interface SearchResult {
  id: string;
  title: string;
  url: string;
  snippet: string;
  engine: SearchEngine;
  rank: number;          // 在搜索结果中的排名
  timestamp: number;
}

/**
 * 搜索任务
 */
export interface SearchTask {
  id: string;
  query: string;
  engine: SearchEngine;
  status: 'pending' | 'running' | 'completed' | 'failed';
  results: SearchResult[];
  error?: string;
}

// ========================================
// 信息提取类型
// ========================================

/**
 * 提取的信息块
 */
export interface InformationChunk {
  id: string;
  content: string;           // 信息内容
  sourceUrl: string;         // 来源 URL
  sourceTitle: string;       // 来源标题
  relevance: number;         // 相关度 0-1
  credibility: number;       // 可信度 0-1
  extractedAt: number;       // 提取时间
  subQuestionId?: string;    // 对应的子问题 ID
}

/**
 * 页面浏览任务
 */
export interface BrowseTask {
  id: string;
  url: string;
  title: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  content?: string;          // 提取的内容
  chunks: InformationChunk[]; // 提取的信息块
  error?: string;
}

// ========================================
// 研究计划类型
// ========================================

/**
 * 研究子问题
 */
export interface ResearchSubQuestion {
  id: string;
  question: string;          // 子问题内容
  priority: number;          // 优先级 1-5
  status: 'pending' | 'researching' | 'completed' | 'skipped';
  searchQueries: string[];   // 搜索关键词列表
  findings: InformationChunk[];  // 收集到的信息
  summary?: string;          // 子问题研究总结
}

/**
 * 研究计划
 */
export interface ResearchPlan {
  id: string;
  originalQuestion: string;   // 原始问题
  refinedQuestion: string;    // 优化后的问题
  goal: string;               // 研究目标
  reasoning: string;          // 规划理由
  subQuestions: ResearchSubQuestion[];  // 子问题列表
  searchStrategy: {
    depth: ResearchDepth;      // 搜索深度
    maxIterations: number;     // 最大迭代次数
    maxPagesPerIteration: number; // 每次迭代最大页面数
    preferredEngines: SearchEngine[];  // 优先使用的搜索引擎
  };
  status: 'draft' | 'approved' | 'executing' | 'completed' | 'failed';
  createdAt: number;
  updatedAt: number;
}

// ========================================
// 迭代状态类型
// ========================================

/**
 * 单次迭代状态
 */
export interface ResearchIteration {
  index: number;              // 迭代序号 (从 1 开始)
  subQuestionId: string;      // 当前研究的子问题
  searchTasks: SearchTask[];  // 搜索任务列表
  browseTasks: BrowseTask[];  // 浏览任务列表
  status: 'pending' | 'searching' | 'browsing' | 'analyzing' | 'completed' | 'failed';
  startedAt?: number;
  completedAt?: number;
}

/**
 * 评估结果
 */
export interface ResearchEvaluation {
  coverageScore: number;      // 覆盖度评分 0-100
  isComplete: boolean;        // 是否信息充足
  gaps: string[];             // 信息缺口
  nextSearches: string[];     // 建议的下一步搜索
  keyFindings: string[];      // 关键发现
  recommendation: 'continue' | 'complete' | 'pivot';  // 建议
  reasoning: string;          // 评估理由
}

// ========================================
// 研究报告类型
// ========================================

/**
 * 报告章节
 */
export interface ReportSection {
  id: string;
  title: string;
  content: string;
  citations: string[];        // 引用的 source ID 列表
  order: number;
}

/**
 * 报告来源
 */
export interface ReportSource {
  id: string;
  index: number;              // 引用序号 [1], [2] 等
  title: string;
  url: string;
  accessedAt: number;
}

/**
 * 研究报告
 */
export interface ResearchReport {
  id: string;
  title: string;
  question: string;           // 研究问题
  summary: string;            // 摘要
  sections: ReportSection[];  // 报告章节
  sources: ReportSource[];    // 引用来源
  metadata: {
    totalSearches: number;     // 总搜索次数
    totalPagesVisited: number; // 访问页面数
    totalIterations: number;   // 迭代次数
    researchDuration: number;  // 研究耗时（毫秒）
    infoChunksCollected: number; // 收集的信息块数
  };
  limitations: string[];       // 研究局限性
  generatedAt: number;
}

// ========================================
// 主状态类型
// ========================================

/**
 * 进度信息
 */
export interface ResearchProgress {
  current: number;            // 当前步骤
  total: number;              // 总步骤数
  percentage: number;         // 百分比 0-100
  currentTask: string;        // 当前任务描述
  iteration: number;          // 当前迭代
  maxIterations: number;
}

/**
 * 待确认的操作（交互模式）
 */
export interface PendingAction {
  type: 'approve_plan' | 'approve_searches' | 'approve_pages' | 'continue_or_complete';
  description: string;
  data?: unknown;
  options?: {
    label: string;
    value: string;
    description?: string;
  }[];
}

/**
 * DeepResearch 完整状态
 */
export interface DeepResearchState {
  phase: DeepResearchPhase;
  plan: ResearchPlan | null;
  iterations: ResearchIteration[];
  currentIteration: number;
  allChunks: InformationChunk[];  // 所有收集的信息
  evaluation: ResearchEvaluation | null;
  report: ResearchReport | null;
  progress: ResearchProgress;
  pendingAction: PendingAction | null;  // 等待用户确认的操作
  messages: AIMessage[];       // 对话消息
  isRunning: boolean;
  startedAt?: number;
  completedAt?: number;
  error?: string;
}

// ========================================
// 配置类型
// ========================================

/**
 * DeepResearch 配置
 */
export interface DeepResearchConfig {
  // 迭代设置
  maxIterations: number;           // 最大迭代次数 (默认 3)
  maxPagesPerIteration: number;    // 每次迭代最多访问页面数 (默认 3)
  
  // 搜索设置
  searchDepth: ResearchDepth;      // 搜索深度
  preferredEngines: SearchEngine[]; // 优先搜索引擎
  
  // 交互设置
  interactiveMode: boolean;        // 是否启用交互模式
  requirePlanApproval: boolean;    // 是否需要确认计划
  requireSearchApproval: boolean;  // 是否需要确认搜索
  requirePageApproval: boolean;    // 是否需要确认访问页面
  
  // 语言设置
  language: 'zh' | 'en' | 'auto';  // 语言偏好
  
  // 调试
  verbose: boolean;                // 是否输出详细日志
}

/**
 * 默认配置
 */
export const DEFAULT_DEEP_RESEARCH_CONFIG: DeepResearchConfig = {
  maxIterations: 3,
  maxPagesPerIteration: 3,
  searchDepth: 'medium',
  preferredEngines: ['google', 'bing'],
  interactiveMode: true,
  requirePlanApproval: true,
  requireSearchApproval: false,
  requirePageApproval: true,
  language: 'auto',
  verbose: true,
};

// ========================================
// 回调类型
// ========================================

/**
 * DeepResearch 回调函数
 */
export interface DeepResearchCallbacks {
  onPhaseChange?: (phase: DeepResearchPhase) => void;
  onPlanCreated?: (plan: ResearchPlan) => void;
  onIterationStart?: (iteration: ResearchIteration) => void;
  onIterationComplete?: (iteration: ResearchIteration) => void;
  onSearchComplete?: (task: SearchTask) => void;
  onPageBrowsed?: (task: BrowseTask) => void;
  onChunkExtracted?: (chunk: InformationChunk) => void;
  onEvaluationComplete?: (evaluation: ResearchEvaluation) => void;
  onProgressUpdate?: (progress: ResearchProgress) => void;
  onPendingAction?: (action: PendingAction) => void;
  onMessage?: (message: AIMessage) => void;
  onReportGenerated?: (report: ResearchReport) => void;
  onComplete?: (report: ResearchReport) => void;
  onError?: (error: Error) => void;
}

// ========================================
// 结果类型
// ========================================

/**
 * DeepResearch 执行结果
 */
export interface DeepResearchResult {
  success: boolean;
  report: ResearchReport | null;
  state: DeepResearchState;
  error?: string;
}

