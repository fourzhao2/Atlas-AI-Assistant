/**
 * DeepResearch 模块导出
 */

// 主控制器
export { deepResearchAgent, DeepResearchAgent } from './deep-research-agent';

// 子模块
export { researchPlanner, ResearchPlanner } from './research-planner';
export { webSearcher, WebSearcher, SEARCH_ENGINES } from './web-searcher';
export { informationAggregator, InformationAggregator } from './information-aggregator';
export { reportGenerator, ReportGenerator } from './report-generator';

// 类型重新导出
export type {
  DeepResearchPhase,
  DeepResearchState,
  DeepResearchConfig,
  DeepResearchCallbacks,
  DeepResearchResult,
  ResearchPlan,
  ResearchSubQuestion,
  ResearchIteration,
  ResearchProgress,
  ResearchEvaluation,
  ResearchReport,
  ReportSection,
  ReportSource,
  SearchResult,
  SearchTask,
  SearchEngine,
  BrowseTask,
  InformationChunk,
  PendingAction,
  ResearchDepth,
} from '@/types/deep-research';

export { DEFAULT_DEEP_RESEARCH_CONFIG } from '@/types/deep-research';

